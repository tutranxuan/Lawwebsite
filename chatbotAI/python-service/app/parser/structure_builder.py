"""Chuyển kết quả Gemini + seed thành rows Neo4j."""
from __future__ import annotations

import json
import re
from pathlib import Path

from app.parser.gemini_parser import ParsedDocument
from app.parser.law_parser import make_id

SEED_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "document_relations_seed.json"

RELATION_TYPES = {
    "CAN_CU",
    "HUONG_DAN",
    "THAM_CHIEU",
    "THAM_CHIEU_DIEU",
    "BO_SUNG",
    "THI_HANH",
    "SUA_DOI",
    "LIEN_QUAN",
}


def normalize_so_hieu(value: str) -> str:
    """Chuẩn hóa số hiệu: 168_2024_ND-CP -> 168/2024/NĐ-CP."""
    if not value:
        return ""
    s = value.strip()
    m = re.match(r"^(\d+)[_/](\d{4})[_/](.+)$", s, re.I)
    if m:
        typ = m.group(3).replace("_", "-").upper()
        typ = typ.replace("ND-CP", "NĐ-CP").replace("TT-", "TT-")
        return f"{m.group(1)}/{m.group(2)}/{typ}"
    return s


def _walk_gemini_nodes(
    nodes: list[dict],
    doc_id: str,
    parent_id: str | None,
    path: list[str],
    doc_number: str,
    file_name: str,
    rows: list[dict],
):
    for node in nodes:
        level = (node.get("level") or "dieu").lower()
        if level not in ("dieu", "khoan", "diem", "muc"):
            level = "dieu"
        number = str(node.get("number") or "")
        title = (node.get("title") or "")[:500]
        content = (node.get("content") or "")[:8000]
        node_id = make_id(level, doc_id, number, parent_id or "root")
        current_path = path + [f"{level}:{number or title[:20]}"]
        children = node.get("children") or []

        child_text = "\n".join(c.get("content", "") for c in children if c.get("content"))
        full_text = "\n".join(p for p in [title, content, child_text] if p).strip()

        rows.append(
            {
                "id": node_id,
                "level": level,
                "number": number,
                "title": title,
                "content": content,
                "full_text": full_text,
                "parent_id": parent_id,
                "doc_id": doc_id,
                "path": " > ".join(current_path),
                "document_number": doc_number,
                "file_name": file_name,
            }
        )
        _walk_gemini_nodes(
            children, doc_id, node_id, current_path, doc_number, file_name, rows
        )


def gemini_to_rows(
    parsed: ParsedDocument,
    doc_id: str,
    meta: dict,
    file_name: str,
) -> tuple[list[dict], list[dict]]:
    """Trả về (rows cho graph, cross_references)."""
    doc_number = normalize_so_hieu(
        parsed.document.get("so_hieu") or meta.get("document_number", "")
    )
    rows: list[dict] = []

    van_ban_id = doc_id
    doc_title = parsed.document.get("ten") or meta.get("title", file_name)
    rows.append(
        {
            "id": van_ban_id,
            "level": "van_ban",
            "number": "",
            "title": doc_title,
            "content": doc_title,
            "full_text": doc_title,
            "parent_id": None,
            "doc_id": doc_id,
            "path": f"van_ban:{doc_title[:40]}",
            "document_number": doc_number,
            "file_name": file_name,
        }
    )

    _walk_gemini_nodes(
        parsed.nodes,
        doc_id,
        van_ban_id,
        [f"van_ban:{doc_title[:30]}"],
        doc_number,
        file_name,
        rows,
    )

    refs = []
    for ref in parsed.references:
        target = ref.get("target_so_hieu") or ref.get("target_document") or ""
        is_number = bool(re.search(r"\d+/\d{4}", target))
        refs.append(
            {
                "from_doc_id": doc_id,
                "from_document_number": doc_number,
                "to_document_number": normalize_so_hieu(target) if is_number else "",
                "to_title": target if not is_number else "",
                "to_dieu": ref.get("target_dieu"),
                "relation": (ref.get("relation") or "THAM_CHIEU").upper(),
                "note": (ref.get("note") or "")[:500],
            }
        )
    return rows, refs


def refs_to_links(
    refs: list[dict],
    from_doc_id: str,
    from_document_number: str,
) -> list[dict]:
    """Chuyển references từ Gemini thành link Neo4j (đã có sẵn format link thì giữ)."""
    links: list[dict] = []
    for ref in refs:
        if ref.get("from_document_number") or ref.get("from_doc_id"):
            links.append(ref)
            continue
        target = ref.get("target_so_hieu") or ref.get("target_document") or ""
        is_number = bool(re.search(r"\d{2,4}/\d{4}", target))
        links.append(
            {
                "from_doc_id": from_doc_id,
                "from_document_number": from_document_number,
                "to_document_number": target if is_number else "",
                "to_title": target if not is_number else "",
                "target_dieu": ref.get("target_dieu"),
                "relation": ref.get("relation", "THAM_CHIEU"),
                "note": ref.get("note", ""),
            }
        )
    return links


def load_seed_relations() -> tuple[list[dict], list[dict]]:
    """Đọc quan hệ văn bản cha-con từ seed JSON."""
    if not SEED_PATH.exists():
        return [], []
    data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    doc_links: list[dict] = []
    special: list[dict] = data.get("special_links") or []

    for group in data.get("groups") or []:
        parent = group.get("parent_title", "")
        relation = group.get("relation", "HUONG_DAN")
        for child in group.get("children") or []:
            doc_links.append(
                {
                    "from_document_number": normalize_so_hieu(child),
                    "to_document_number": "",
                    "to_title": parent,
                    "relation": relation,
                    "note": f"Hướng dẫn {parent}",
                }
            )
    return doc_links, special
