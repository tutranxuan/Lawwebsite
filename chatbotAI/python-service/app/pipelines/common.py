"""Tiện ích chung pipelines."""
from __future__ import annotations

import json
from pathlib import Path

from app.graph import schema as S
from app.pipelines.standard_law import normalize_so_hieu

SEED_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "document_relations_seed.json"


def load_seed_relations() -> tuple[list[dict], list[dict]]:
    if not SEED_PATH.exists():
        return [], []
    data = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    doc_links: list[dict] = []
    for group in data.get("groups") or []:
        parent = group.get("parent_title", "")
        relation = group.get("relation", S.HUONG_DAN)
        if relation in ("GUIDES", "HUONG_DAN"):
            relation = S.HUONG_DAN
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
