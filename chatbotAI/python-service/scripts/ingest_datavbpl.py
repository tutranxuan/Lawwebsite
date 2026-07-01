"""
Nạp datavbpl – 2 pipeline ETL + nhánh xử phạt.

  STANDARD_LAW          → VanBan → Chuong → Dieu → Khoan → Diem  (regex)
  TECHNICAL_REGULATION  → VanBan → Phan → TieuMuc → YeuCau       (số 1.1.1)
  PENALTY               → STANDARD_LAW + ViPham/PhuongTien/HinhPhat (168)
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
from app.parser.doc_reader import (
    extract_document_meta,
    list_attachment_files,
    list_datavbpl_files,
    read_document,
)
from app.parser.document_router import detect_document_type
from app.parser.law_parser import new_doc_id
from app.pipelines.common import load_seed_relations
# Đã sửa lại tên module là penalty
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

    if doc_type == S.TECHNICAL_REGULATION:
        attachment_texts = []
        for attachment in list_attachment_files(path):
            try:
                attachment_texts.append(read_document(attachment))
            except Exception:
                continue
        if attachment_texts:
            text = "\n\n".join(t for t in attachment_texts if t.strip())

    if doc_type == S.PENALTY_DECREE:
        print(f"    [PENALTY] {path.name}")
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

    try:
        if neo:
            neo.init_schema()
            if clear_existing:
                neo.clear_all()
            neo.purge_legacy_schema()
        if clear_existing:
            store.clear()

        # Nạp dữ liệu tuần tự: Mỗi file xử lý xong sẽ đẩy thẳng vào cả Neo4j và FAISS
        for i, path in enumerate(files):
            try:
                graph, stat = ingest_document(path, use_gemini_penalty)
                
                # Lưu đồ thị vào Neo4j
                if neo and graph.nodes:
                    print(f"    -> Đang đồng bộ {len(graph.nodes)} nodes vào Neo4j...")
                    neo.upsert_graph(graph)
                
                # Lưu embedding vào FAISS
                file_faiss_docs = graph.index_docs()
                if file_faiss_docs:
                    print(f"    -> Đang lưu {len(file_faiss_docs)} vectors vào FAISS...")
                    store.add_documents(file_faiss_docs)

                master.nodes.extend(graph.nodes)
                master.relationships.extend(graph.relationships)
                file_stats.append(stat)
                
                print(f"  [OK] {stat['file']} ({stat['pipeline']})")
                
                if use_gemini_penalty and stat["pipeline"] == S.PENALTY_DECREE and i < len(files) - 1:
                    time.sleep(1.5)
            except Exception as exc:
                errors.append({"file": path.name, "error": str(exc)})
                print(f"  [FAIL] {path.name}: {exc}")

        # Xây dựng liên kết chéo sau khi đã nạp xong các file
        if neo and master.nodes:
            print("\n  -> Đang xây dựng liên kết chéo giữa các văn bản...")
            seed_doc, seed_special = load_seed_relations()
            all_links = list(seed_doc) + seed_special
            linked = neo.link_documents(all_links)
            print(f"  [✓] Đã tạo thành công {linked} quan hệ liên kết chéo.")

        return {
            "files_processed": len(file_stats),
            "files_failed": len(errors),
            "total_nodes": len(master.nodes),
            "vector_count": store.count(),
            "errors": errors,
        }
    finally:
        if neo:
            neo.close()


def main():
    parser = argparse.ArgumentParser(description="Ingest 2-pipeline GraphRAG")
    parser.add_argument("--clear", action="store_true")
    parser.add_argument("--vector-only", action="store_true")
    parser.add_argument("--no-gemini", action="store_true")
    args = parser.parse_args()
    stats = ingest_all(
        clear_existing=args.clear,
        vector_only=args.vector_only or None,
        use_gemini_penalty=False if args.no_gemini else None,
    )
    print(f"\n=== Kết quả: {stats['files_processed']} file thành công ===")


if __name__ == "__main__":
    main()