"""Tách văn bản luật bằng Gemini: Điều / Khoản / Điểm + quan hệ tham chiếu."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

import google.generativeai as genai

import config

PARSE_PROMPT = """
Bạn là chuyên gia phân tích văn bản pháp luật Việt Nam.
Nhiệm vụ: phân tích văn bản sau thành JSON (chỉ JSON hợp lệ, không markdown).

Cấu trúc bắt buộc:
{
  "document": {
    "so_hieu": "số hiệu đầy đủ nếu có (vd 168/2024/NĐ-CP)",
    "ten": "tên văn bản",
    "loai": "Luật|Nghị định|Thông tư|..."
  },
  "nodes": [
    {
      "level": "dieu|khoan|diem",
      "number": "1",
      "title": "tiêu đề ngắn",
      "content": "nội dung đầy đủ",
      "children": []
    }
  ],
  "references": [
    {
      "relation": "CAN_CU|HUONG_DAN|THAM_CHIEU|BO_SUNG|THI_HANH|SUA_DOI",
      "target_so_hieu": "168/2024/NĐ-CP hoặc tên luật",
      "target_dieu": "52 hoặc null",
      "source_dieu": "điều nguồn trong văn bản này hoặc null",
      "note": "mô tả ngắn"
    }
  ]
}

Quy tắc:
- Mỗi Điều là node level "dieu", Khoản "khoan", Điểm "diem" lồng trong children.
- Giữ nguyên số thứ tự (1, 2, 1a, a, b...).
- references: trích mọi chỗ "Căn cứ Luật...", "theo Điều X Luật Y", "Nghị định số...", "hướng dẫn".
- Không bịa nội dung không có trong văn bản.
- Nếu văn bản quá dài, ưu tiên các Điều có trong đoạn text được cung cấp.

Metadata file: {meta}
"""

CHUNK_CHARS = 55_000


@dataclass
class ParsedDocument:
    document: dict
    nodes: list[dict] = field(default_factory=list)
    references: list[dict] = field(default_factory=list)


def _get_model():
    if not config.GEMINI_API_KEY:
        raise RuntimeError("Thiếu GEMINI_API_KEY")
    genai.configure(api_key=config.GEMINI_API_KEY)
    return genai.GenerativeModel(
        config.GEMINI_PARSE_MODEL,
        generation_config=genai.types.GenerationConfig(
            temperature=0.1,
            response_mime_type="application/json",
            max_output_tokens=8192,
        ),
    )


def _split_chunks(text: str) -> list[str]:
    if len(text) <= CHUNK_CHARS:
        return [text]
    parts = re.split(r"(?=(?:^|\s)Điều\s+\d+)", text, flags=re.IGNORECASE)
    chunks: list[str] = []
    current = ""
    for part in parts:
        if len(current) + len(part) > CHUNK_CHARS and current:
            chunks.append(current)
            current = part
        else:
            current += part
    if current:
        chunks.append(current)
    return chunks or [text[:CHUNK_CHARS]]


def _call_gemini(model, text: str, meta: dict) -> dict:
    prompt = PARSE_PROMPT.format(meta=json.dumps(meta, ensure_ascii=False)) + "\n\nVĂN BẢN:\n" + text
    response = model.generate_content(prompt)
    raw = response.text or "{}"
    return json.loads(raw)


def _merge_nodes(existing: list[dict], new_nodes: list[dict]) -> list[dict]:
    by_key: dict[str, dict] = {}
    for node in existing + new_nodes:
        key = f"{node.get('level')}:{node.get('number')}"
        if key not in by_key:
            by_key[key] = node
        else:
            old = by_key[key]
            old_children = old.get("children") or []
            new_children = node.get("children") or []
            old["children"] = _merge_nodes(old_children, new_children)
            if len(node.get("content") or "") > len(old.get("content") or ""):
                old["content"] = node["content"]
                old["title"] = node.get("title") or old.get("title")
    return list(by_key.values())


def parse_with_gemini(text: str, meta: dict) -> ParsedDocument:
    """Phân tích văn bản bằng Gemini (có chunk nếu dài)."""
    model = _get_model()
    chunks = _split_chunks(text[: config.GEMINI_PARSE_MAX_CHARS])
    merged_doc: dict = {}
    all_nodes: list[dict] = []
    all_refs: list[dict] = []

    for i, chunk in enumerate(chunks):
        data = _call_gemini(model, chunk, {**meta, "chunk": i + 1, "total_chunks": len(chunks)})
        if not merged_doc and data.get("document"):
            merged_doc = data["document"]
        all_nodes = _merge_nodes(all_nodes, data.get("nodes") or [])
        all_refs.extend(data.get("references") or [])

    return ParsedDocument(
        document=merged_doc,
        nodes=all_nodes,
        references=all_refs,
    )
