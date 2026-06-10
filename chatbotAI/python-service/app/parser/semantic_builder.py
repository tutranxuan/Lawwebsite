"""Xây SemanticGraph từ Gemini / regex / violation parser."""
from __future__ import annotations

import json
import re
from pathlib import Path

import config
from app.graph import schema as S
from app.graph.graph_model import SemanticGraph
from app.parser.law_parser import flatten_for_index, make_id, parse_law_text
from app.parser.semantic_parser import SemanticParseResult, parse_semantic
from app.parser.violation_parser import is_penalty_decree, parse_violations

SEED_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "document_relations_seed.json"


def normalize_so_hieu(value: str) -> str:
    if not value:
        return ""
    s = value.strip()
    m = re.match(r"^(\d+)[_/](\d{4})[_/](.+)$", s, re.I)
    if m:
        typ = m.group(3).replace("_", "-").upper().replace("ND-CP", "NĐ-CP")
        return f"{m.group(1)}/{m.group(2)}/{typ}"
    return s


def _doc_type_from_number(num: str, fallback: str = "") -> str:
    u = (num + fallback).upper()
    if "NĐ-CP" in u or "ND-CP" in u:
        return "Nghị định"
    if "TT-" in u:
        return "Thông tư"
    if "QH" in u:
        return "Luật"
    if "luật" in fallback.lower():
        return "Luật"
    return "Văn bản QPPL"


def _add_clause_refs(graph: SemanticGraph, clause_id: str, refs: list[dict], doc_id: str) -> None:
    for ref in refs or []:
        target_art = ref.get("target_article") or ref.get("target_dieu")
        target_doc = normalize_so_hieu(ref.get("target_so_hieu") or "")
        rel = (ref.get("relation") or S.REFERENCES).upper()
        if rel not in S.ALL_RELS:
            rel = S.REFERENCES
        if target_art:
            to_id = make_id("article", doc_id, str(target_art), target_doc or "ref")
            graph.add_node(
                S.ARTICLE,
                to_id,
                number=str(target_art),
                title=f"Điều {target_art}",
                document_number=target_doc,
                doc_id=doc_id,
            )
            graph.add_rel(rel, clause_id, to_id, note=ref.get("note", ""))
        elif target_doc:
            to_id = make_id("document", target_doc.replace("/", "_"))
            graph.add_node(S.DOCUMENT, to_id, document_number=target_doc, title=target_doc)
            graph.add_rel(rel, clause_id, to_id, note=ref.get("note", ""))


def _ingest_articles(
    graph: SemanticGraph,
    articles: list[dict],
    parent_id: str,
    doc_id: str,
    doc_number: str,
    path_prefix: list[str],
) -> int:
    count = 0
    for art in articles:
        anum = str(art.get("number", ""))
        art_id = make_id("article", doc_id, anum)
        title = (art.get("title") or f"Điều {anum}")[:500]
        full_text = (art.get("full_text") or "")[:12000]
        art_path = path_prefix + [f"Article:{anum}"]
        graph.add_node(
            S.ARTICLE,
            art_id,
            number=anum,
            title=title,
            full_text=full_text,
            text=full_text,
            document_number=doc_number,
            doc_id=doc_id,
            path=" > ".join(art_path),
        )
        graph.add_rel(S.HAS_ARTICLE, parent_id, art_id)
        count += 1

        for cl in art.get("clauses") or []:
            cnum = str(cl.get("number", ""))
            sub = str(cl.get("sub_number") or "")
            cl_id = make_id("clause", doc_id, anum, cnum, sub or "x")
            ctext = (cl.get("text") or "")[:8000]
            cl_path = art_path + [f"Clause:{cnum}{sub}"]
            graph.add_node(
                S.CLAUSE,
                cl_id,
                number=cnum + sub,
                title=title[:200],
                text=ctext,
                full_text=ctext,
                document_number=doc_number,
                doc_id=doc_id,
                path=" > ".join(cl_path),
            )
            graph.add_rel(S.HAS_CLAUSE, art_id, cl_id)
            _add_clause_refs(graph, cl_id, cl.get("references") or [], doc_id)
    return count


def from_semantic_result(
    parsed: SemanticParseResult,
    doc_id: str,
    meta: dict,
    file_name: str,
) -> SemanticGraph:
    graph = SemanticGraph()
    doc = parsed.document or {}
    doc_number = normalize_so_hieu(doc.get("so_hieu") or meta.get("document_number", ""))
    title = doc.get("title") or meta.get("title", file_name)
    doc_type = doc.get("type") or _doc_type_from_number(doc_number, title)

    graph.add_node(
        S.DOCUMENT,
        doc_id,
        document_number=doc_number,
        title=title,
        type=doc_type,
        issuer=doc.get("issuer", ""),
        effective_date=doc.get("effective_date"),
        status=doc.get("status", "Còn hiệu lực"),
        file_name=file_name,
        doc_id=doc_id,
        path=f"Document:{title[:40]}",
        full_text=title,
    )

    article_count = 0
    if parsed.chapters:
        for ch in parsed.chapters:
            ch_id = make_id("chapter", doc_id, str(ch.get("number", "")))
            ch_title = (ch.get("title") or "")[:300]
            graph.add_node(
                S.CHAPTER,
                ch_id,
                number=str(ch.get("number", "")),
                title=ch_title,
                document_number=doc_number,
                doc_id=doc_id,
                path=f"Document > Chapter {ch.get('number')}",
            )
            graph.add_rel(S.HAS_CHAPTER, doc_id, ch_id)
            article_count += _ingest_articles(
                graph,
                ch.get("articles") or [],
                ch_id,
                doc_id,
                doc_number,
                [f"Document:{title[:20]}", f"Chapter:{ch.get('number')}"],
            )
    else:
        article_count += _ingest_articles(
            graph,
            parsed.articles,
            doc_id,
            doc_id,
            doc_number,
            [f"Document:{title[:20]}"],
        )

    for ref in parsed.document_references or []:
        target = ref.get("target_so_hieu") or ""
        is_num = bool(re.search(r"\d+/\d{4}", target))
        rel = (ref.get("relation") or S.BASED_ON).upper()
        if rel not in S.ALL_RELS:
            rel = S.BASED_ON
        if is_num:
            to_id = make_id("document", normalize_so_hieu(target).replace("/", "_"))
            graph.add_node(S.DOCUMENT, to_id, document_number=normalize_so_hieu(target), title=target)
            graph.add_rel(rel, doc_id, to_id, note=ref.get("note", ""))

    for v in parsed.entities.get("vehicles") or []:
        vid = make_id("vehicle", doc_id, v.get("type", ""), v.get("sub_type", ""))
        graph.add_node(S.VEHICLE, vid, type=v.get("type", ""), sub_type=v.get("sub_type", ""), doc_id=doc_id)
    for s in parsed.entities.get("subjects") or []:
        sid = make_id("subject", doc_id, s.get("name", "")[:30])
        graph.add_node(S.SUBJECT, sid, name=s.get("name", ""), doc_id=doc_id)

    return graph


def from_regex_tree(doc_id: str, meta: dict, file_name: str, text: str) -> SemanticGraph:
    tree = parse_law_text(text, doc_id, meta.get("title", file_name))
    rows = flatten_for_index(tree)
    graph = SemanticGraph()
    doc_number = normalize_so_hieu(meta.get("document_number", ""))

    for row in rows:
        level_map = {
            "van_ban": S.DOCUMENT,
            "dieu": S.ARTICLE,
            "khoan": S.CLAUSE,
            "diem": S.CLAUSE,
            "muc": S.CHAPTER,
        }
        label = level_map.get(row["level"], S.CLAUSE)
        graph.add_node(
            label,
            row["id"],
            number=row.get("number", ""),
            title=row.get("title", ""),
            text=row.get("content", ""),
            full_text=row.get("full_text", ""),
            document_number=doc_number,
            doc_id=doc_id,
            file_name=file_name,
            path=row.get("path", ""),
        )

    rel_map = {
        ("van_ban", "dieu"): S.HAS_ARTICLE,
        ("van_ban", "muc"): S.HAS_CHAPTER,
        ("muc", "dieu"): S.HAS_ARTICLE,
        ("dieu", "khoan"): S.HAS_CLAUSE,
        ("dieu", "diem"): S.HAS_CLAUSE,
        ("khoan", "diem"): S.HAS_CLAUSE,
    }
    by_id = {r["id"]: r for r in rows}
    for row in rows:
        pid = row.get("parent_id")
        if not pid or pid not in by_id:
            continue
        parent_level = by_id[pid]["level"]
        child_level = row["level"]
        rel = rel_map.get((parent_level, child_level), S.HAS_CLAUSE)
        graph.add_rel(rel, pid, row["id"])

    return graph


def add_violations_to_graph(
    graph: SemanticGraph,
    violations: list[dict],
    doc_id: str,
    doc_number: str,
) -> int:
    count = 0
    for i, v in enumerate(violations):
        vid = make_id("violation", doc_id, str(i), v.get("id_hint", "")[:20])
        graph.add_node(
            S.VIOLATION,
            vid,
            description=(v.get("description") or "")[:2000],
            fine_min=v.get("fine_min"),
            fine_max=v.get("fine_max"),
            document_number=doc_number,
            doc_id=doc_id,
        )
        count += 1

        anum = str(v.get("article_number") or "")
        cnum = str(v.get("clause_number") or "")
        pt = str(v.get("point") or "")
        if anum:
            cl_id = make_id("clause", doc_id, anum, cnum, pt or "v")
            if any(n["id"] == cl_id for n in graph.nodes):
                graph.add_rel(S.DEFINED_IN, vid, cl_id)
            else:
                graph.add_node(
                    S.CLAUSE,
                    cl_id,
                    number=cnum + pt,
                    text=v.get("description", "")[:500],
                    full_text=v.get("description", "")[:500],
                    document_number=doc_number,
                    doc_id=doc_id,
                    path=f"Article:{anum} > Clause:{cnum}{pt}",
                )
                art_id = make_id("article", doc_id, anum)
                if not any(n["id"] == art_id for n in graph.nodes):
                    graph.add_node(S.ARTICLE, art_id, number=anum, title=f"Điều {anum}", doc_id=doc_id, document_number=doc_number)
                    graph.add_rel(S.HAS_ARTICLE, doc_id, art_id)
                graph.add_rel(S.HAS_CLAUSE, art_id, cl_id)
                graph.add_rel(S.DEFINED_IN, vid, cl_id)

        for veh in v.get("vehicles") or []:
            veh_id = make_id("vehicle", doc_id, veh.get("type", ""), veh.get("sub_type", ""))
            if not any(n["id"] == veh_id for n in graph.nodes):
                graph.add_node(S.VEHICLE, veh_id, type=veh.get("type", ""), sub_type=veh.get("sub_type", ""))
            graph.add_rel(S.APPLIES_TO, vid, veh_id)

        for pen in v.get("penalties") or []:
            pen_id = make_id("penalty", doc_id, pen.get("type", "")[:25], str(i))
            graph.add_node(
                S.PENALTY,
                pen_id,
                type=pen.get("type", ""),
                duration=pen.get("duration", ""),
            )
            graph.add_rel(S.HAS_PENALTY, vid, pen_id)
    return count


def build_graph_for_document(
    text: str,
    meta: dict,
    doc_id: str,
    file_name: str,
    use_gemini: bool,
) -> tuple[SemanticGraph, dict]:
    doc_number = normalize_so_hieu(meta.get("document_number", ""))
    title = meta.get("title", file_name)
    mode = "regex"
    violations_n = 0

    if use_gemini and config.GEMINI_API_KEY:
        try:
            if is_penalty_decree(file_name, title):
                semantic = parse_semantic(text, meta)
                graph = from_semantic_result(semantic, doc_id, meta, file_name)
                violations = parse_violations(text, doc_number)
                violations_n = add_violations_to_graph(graph, violations, doc_id, doc_number)
                mode = "gemini_penalty"
            else:
                semantic = parse_semantic(text, meta)
                graph = from_semantic_result(semantic, doc_id, meta, file_name)
                mode = "gemini_semantic"
        except Exception as exc:
            graph = from_regex_tree(doc_id, meta, file_name, text)
            mode = f"regex_fallback:{exc}"
    else:
        graph = from_regex_tree(doc_id, meta, file_name, text)

    summary = graph.stats_summary()
    stats = {
        "nodes": len(graph.nodes),
        "articles": summary["articles"],
        "clauses": summary["clauses"],
        "violations": violations_n or summary["violations"],
        "relationships": summary["relationships"],
        "mode": mode,
    }
    return graph, stats


def load_seed_relations() -> tuple[list[dict], list[dict]]:
    if not SEED_PATH.exists():
        return [], []
    data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    doc_links: list[dict] = []
    for group in data.get("groups") or []:
        parent = group.get("parent_title", "")
        relation = group.get("relation", S.GUIDES)
        if relation == "HUONG_DAN":
            relation = S.GUIDES
        for child in group.get("children") or []:
            doc_links.append(
                {
                    "from_document_number": normalize_so_hieu(child),
                    "to_title": parent[:40],
                    "relation": relation,
                    "note": f"Hướng dẫn {parent}",
                }
            )
    return doc_links, data.get("special_links") or []
