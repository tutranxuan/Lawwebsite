"""Metadata thống nhất cho FAISS – cả 2 pipeline."""
from __future__ import annotations

from app.graph import schema as S


def is_vector_leaf(label: str, level: str = "") -> bool:
    lbl = label or level
    return lbl in S.VECTOR_LEAF_LABELS or level in (
        "khoan",
        "diem",
        "yeu_cau",
        "vi_pham",
        "phuong_tien",
        "hinh_phat",
    )


def to_faiss_chunk(node: dict, source_file: str, pipeline: str) -> dict:
    """
    Cấu trúc phẳng chung (LangChain-compatible metadata).
    """
    text = (
        node.get("text_content")
        or node.get("text")
        or node.get("content")
        or node.get("full_text")
        or node.get("title")
        or ""
    )
    ref_path = node.get("reference_path") or node.get("path") or ""
    node_type = (node.get("level") or node.get("label") or "").lower()

    return {
        "id": node["id"],
        "source_file": source_file,
        "doc_id": node.get("doc_id", ""),
        "document_number": node.get("document_number", ""),
        "reference_path": ref_path,
        "text_content": text[:8000],
        "node_type": node_type,
        "pipeline": pipeline,
        # Tương thích faiss_store hiện tại
        "full_text": text[:8000],
        "title": node.get("title", ""),
        "number": node.get("number", ""),
        "path": ref_path,
        "level": node_type,
        "label": node.get("label", ""),
    }


def collect_leaf_chunks(
    nodes: list[dict],
    source_file: str,
    pipeline: str,
) -> list[dict]:
    chunks = []
    for n in nodes:
        label = n.get("label", "")
        level = n.get("level", "")
        if not is_vector_leaf(label, level):
            continue
        text = n.get("text") or n.get("content") or n.get("full_text") or ""
        if not text.strip():
            continue
        chunks.append(to_faiss_chunk(n, source_file, pipeline))
    return chunks
