"""Pipeline 1: Luật / NĐ / TT – Regex Chương → Điều → Khoản → Điểm."""
from __future__ import annotations

import re

from app.graph import schema as S
from app.graph.graph_model import SemanticGraph
from app.parser.law_parser import flatten_for_index, make_id, parse_law_text


def normalize_so_hieu(value: str) -> str:
    if not value:
        return ""
    m = re.match(r"^(\d+)[_/](\d{4})[_/](.+)$", value.strip(), re.I)
    if m:
        typ = m.group(3).replace("_", "-").upper().replace("ND-CP", "NĐ-CP")
        return f"{m.group(1)}/{m.group(2)}/{typ}"
    return value.strip()


LEVEL_LABEL = {
    "van_ban": S.VAN_BAN,
    "chuong": S.CHUONG,
    "muc": S.MUC,
    "dieu": S.DIEU,
    "khoan": S.KHOAN,
    "diem": S.DIEM,
}

REL_MAP = {
    ("van_ban", "chuong"): S.CO_CHUONG,
    ("van_ban", "muc"): S.CO_MUC,
    ("van_ban", "dieu"): S.CO_DIEU,
    ("chuong", "muc"): S.CO_MUC,
    ("chuong", "dieu"): S.CO_DIEU,
    ("muc", "dieu"): S.CO_DIEU,
    ("dieu", "khoan"): S.CO_KHOAN,
    ("khoan", "diem"): S.CO_DIEM,
    ("dieu", "diem"): S.CO_DIEM,
}


def parse_standard_law(
    text: str,
    doc_id: str,
    meta: dict,
    file_name: str,
) -> SemanticGraph:
    graph = SemanticGraph()
    doc_number = normalize_so_hieu(meta.get("document_number", ""))
    title = meta.get("title", file_name)

    tree = parse_law_text(text, doc_id, title)
    rows = flatten_for_index(tree)

    for row in rows:
        level = row["level"]
        label = LEVEL_LABEL.get(level, S.DIEU)
        ref_path = _format_reference_path(row.get("path", ""))
        graph.add_node(
            label,
            row["id"],
            level=level,
            number=row.get("number", ""),
            title=row.get("title", ""),
            text=row.get("content", ""),
            full_text=row.get("full_text", ""),
            reference_path=ref_path,
            path=ref_path,
            document_number=doc_number,
            doc_id=doc_id,
            file_name=file_name,
        )

    by_id = {r["id"]: r for r in rows}
    for row in rows:
        pid = row.get("parent_id")
        if not pid or pid not in by_id:
            continue
        rel = REL_MAP.get((by_id[pid]["level"], row["level"]), S.CO_KHOAN)
        graph.add_rel(rel, pid, row["id"])

    return graph


def _format_reference_path(raw: str) -> str:
    """Chương II > Điều 15 > Khoản 1"""
    parts = []
    for seg in raw.split(">"):
        seg = seg.strip()
        if not seg:
            continue
        kind, _, num = seg.partition(":")
        mapping = {
            "van_ban": "Văn bản",
            "chuong": "Chương",
            "muc": "Mục",
            "dieu": "Điều",
            "khoan": "Khoản",
            "diem": "Điểm",
        }
        parts.append(f"{mapping.get(kind, kind)} {num}".strip())
    return " > ".join(parts) if parts else raw
