"""
Nạp datavbpl – 2 pipeline ETL + nhánh xử phạt.

  STANDARD_LAW          → VanBan → Chuong → Dieu → Khoan → Diem  (regex)
  TECHNICAL_REGULATION  → VanBan → Phan → TieuMuc → YeuCau       (số 1.1.1)
  PENALTY_DECREE        → STANDARD_LAW + ViPham/PhuongTien/HinhPhat (168)
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv

load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR / ".env")

import config
from app.graph import schema as S
from app.graph.graph_model import SemanticGraph
from app.graph.neo4j_client import Neo4jClient
from app.parser.doc_reader import extract_document_meta, list_datavbpl_files, read_document
from app.parser.document_router import detect_document_type
from app.parser.law_parser import new_doc_id
from app.pipelines.common import load_seed_relations
from app.pipelines.penalty import parse_penalty_decree
from app.pipelines.standard_law import normalize_so_hieu, parse_standard_law
from app.pipelines.technical import parse_technical_regulation
from app.vector.faiss_store import FaissVectorStore


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", name.lower()).strip("_")
    return slug[:40] or new_doc_id()


def ingest_document(
    path: Path,
    use_gemini_penalty: bool,
) -> tuple[SemanticGraph, dict]:
    meta = extract_document_meta(path.name)
    meta["document_number"] = normalize_so_hieu(meta.get("document_number", ""))
    doc_id = _slugify(path.stem)
    text = read_document(path)
    doc_type = detect_document_type(path.name, text)

    if doc_type == S.PENALTY_DECREE:
        print(f"    [PENALTY_DECREE] {path.name}")
        graph = parse_penalty_decree(text, doc_id, meta, path.name, use_gemini=use_gemini_penalty)
    elif doc_type == S.TECHNICAL_REGULATION:
        print(f"    [TECHNICAL] {path.name}")
        graph = parse_technical_regulation(text, doc_id, meta, path.name)
    else:
        print(f"    [STANDARD_LAW] {path.name}")
        graph = parse_standard_law(text, doc_id, meta, path.name)

    graph.pipeline = doc_type
    graph.source_file = path.name
    summary = graph.stats_summary()
    stats = {
        "file": path.name,
        "pipeline": doc_type,
        "nodes": len(graph.nodes),
        "dieu": summary.get("dieu", 0),
        "khoan": summary.get("khoan", 0),
        "yeu_cau": summary.get("yeu_cau", 0),
        "vi_pham": summary.get("vi_pham", 0),
        "relationships": summary.get("relationships", 0),
    }
    return graph, stats


def ingest_all(
    clear_existing: bool = False,
    vector_only: bool | None = None,
    use_gemini_penalty: bool | None = None,
) -> dict:
    files = list_datavbpl_files(config.DATAVBPL_PATH)
    if not files:
        raise FileNotFoundError(f"Không tìm thấy file trong {config.DATAVBPL_PATH}")

    use_neo4j = config.USE_NEO4J if vector_only is None else not vector_only
    use_gemini_penalty = config.USE_GEMINI_PARSER if use_gemini_penalty is None else use_gemini_penalty
    neo = Neo4jClient() if use_neo4j else None
    store = FaissVectorStore()

    master = SemanticGraph()
    file_stats = []
    errors = []
    all_faiss: list[dict] = []

    try:
        if neo:
            neo.init_schema()
            if clear_existing:
                neo.clear_all()
        if clear_existing:
            store.clear()

        for i, path in enumerate(files):
            try:
                graph, stat = ingest_document(path, use_gemini_penalty)
                master.nodes.extend(graph.nodes)
                master.relationships.extend(graph.relationships)
                all_faiss.extend(graph.index_docs())
                file_stats.append(stat)
                print(
                    f"  OK  {stat['pipeline']}: {stat['nodes']} nodes, "
                    f"{stat['dieu']} Điều, {stat['khoan']} Khoản/Điểm, "
                    f"{stat['yeu_cau']} YC, {stat['vi_pham']} VP"
                )
                if use_gemini_penalty and stat["pipeline"] == S.PENALTY_DECREE and i < len(files) - 1:
                    time.sleep(1.5)
            except Exception as exc:
                errors.append({"file": path.name, "error": str(exc)})
                print(f"  ERR {path.name}: {exc}")

        if master.nodes:
            if neo:
                neo.upsert_graph(master)
            if all_faiss:
                store.add_documents(all_faiss)

        if neo:
            seed_doc, seed_special = load_seed_relations()
            all_links = list(seed_doc)
            for s in seed_special:
                rel = s.get("relation", S.HUONG_DAN)
                all_links.append(
                    {
                        "from_document_number": normalize_so_hieu(s.get("from", "")),
                        "to_document_number": normalize_so_hieu(s.get("to", "")),
                        "to_title": (s.get("to_title") or s.get("to", ""))[:40],
                        "to_dieu": s.get("to_dieu"),
                        "relation": rel,
                        "note": s.get("note", ""),
                    }
                )
            linked = neo.link_documents(all_links)
            print(f"\n  Quan hệ văn bản ({S.HUONG_DAN}/{S.CAN_CU}): {linked} cạnh")

        return {
            "files_processed": len(file_stats),
            "files_failed": len(errors),
            "total_nodes": len(master.nodes),
            "total_relationships": len(master.relationships),
            "vector_count": store.count(),
            "neo4j_enabled": use_neo4j,
            "neo4j": neo.stats() if neo else {},
            "files": file_stats,
            "errors": errors,
        }
    finally:
        if neo:
            neo.close()


def main():
    parser = argparse.ArgumentParser(description="Ingest 2-pipeline GraphRAG")
    parser.add_argument("--clear", action="store_true")
    parser.add_argument("--vector-only", action="store_true")
    parser.add_argument("--no-gemini", action="store_true", help="Tắt Gemini cho NĐ 168")
    args = parser.parse_args()
    print(f"Data: {config.DATAVBPL_PATH}")
    print("Pipeline 1: VanBan→Chuong→Dieu→Khoan→Diem (regex)")
    print("Pipeline 2: VanBan→Phan→TieuMuc→YeuCau (QCVN)")
    stats = ingest_all(
        clear_existing=args.clear,
        vector_only=args.vector_only or None,
        use_gemini_penalty=False if args.no_gemini else None,
    )
    print("\n=== Kết quả ===")
    for key, val in stats.items():
        if key not in ("files", "errors"):
            print(f"  {key}: {val}")


if __name__ == "__main__":
    main()
