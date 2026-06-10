"""Gemini – phân tích đồ thị ngữ nghĩa văn bản pháp luật."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

import google.generativeai as genai

import config

SEMANTIC_PROMPT = """
Bạn là chuyên gia phân tích văn bản pháp luật giao thông Việt Nam.
Trả về JSON hợp lệ (không markdown) theo schema:

{
  "document": {
    "so_hieu": "168/2024/NĐ-CP",
    "title": "tên đầy đủ",
    "type": "Luật|Nghị định|Thông tư|Quyết định",
    "issuer": "Quốc hội|Chính phủ|Bộ Công an|Bộ GTVT|...",
    "effective_date": "YYYY-MM-DD hoặc null",
    "status": "Còn hiệu lực"
  },
  "chapters": [
    {
      "number": "I",
      "title": "tiêu đề chương",
      "articles": [
        {
          "number": "1",
          "title": "tiêu đề điều",
          "full_text": "toàn văn điều",
          "clauses": [
            {
              "number": "1",
              "sub_number": "a",
              "text": "nội dung khoản/điểm",
              "references": [
                {
                  "target_so_hieu": "số hiệu VB hoặc tên luật",
                  "target_article": "38",
                  "target_clause": null,
                  "relation": "REFERENCES|BASED_ON",
                  "note": "mô tả"
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "articles": [],
  "document_references": [
    {
      "target_so_hieu": "Luật Đường bộ 2024",
      "relation": "BASED_ON|GUIDES|REPLACES",
      "note": "Căn cứ Luật..."
    }
  ],
  "entities": {
    "vehicles": [{"type": "Xe cơ giới", "sub_type": "Xe ô tô"}],
    "subjects": [{"name": "Người điều khiển phương tiện"}]
  }
}

Quy tắc:
- Nếu không có Chương, đặt articles ở root "articles" (không chapters).
- clauses: đơn vị nhỏ nhất (khoản + điểm); mỗi điểm a,b,c là một clause riêng.
- Trích references trong "Căn cứ...", "theo Điều X...", "Nghị định số...".
- Không bịa; chỉ trích từ đoạn text.

Metadata: {meta}
"""

CHUNK_CHARS = 50_000


@dataclass
class SemanticParseResult:
    document: dict = field(default_factory=dict)
    chapters: list[dict] = field(default_factory=list)
    articles: list[dict] = field(default_factory=list)
    document_references: list[dict] = field(default_factory=list)
    entities: dict = field(default_factory=dict)


def _get_model(max_tokens: int = 8192):
    if not config.GEMINI_API_KEY:
        raise RuntimeError("Thiếu GEMINI_API_KEY")
    genai.configure(api_key=config.GEMINI_API_KEY)
    return genai.GenerativeModel(
        config.GEMINI_PARSE_MODEL,
        generation_config=genai.types.GenerationConfig(
            temperature=0.1,
            response_mime_type="application/json",
            max_output_tokens=max_tokens,
        ),
    )


def _split_chunks(text: str) -> list[str]:
    if len(text) <= CHUNK_CHARS:
        return [text]
    parts = re.split(r"(?=(?:^|\s)(?:Chương|Điều)\s+)", text, flags=re.IGNORECASE)
    chunks, current = [], ""
    for part in parts:
        if len(current) + len(part) > CHUNK_CHARS and current:
            chunks.append(current)
            current = part
        else:
            current += part
    if current:
        chunks.append(current)
    return chunks or [text[:CHUNK_CHARS]]


def _merge_articles(existing: list[dict], new: list[dict]) -> list[dict]:
    by_key: dict[str, dict] = {}
    for art in existing + new:
        key = str(art.get("number", ""))
        if key not in by_key:
            by_key[key] = art
        else:
            old = by_key[key]
            if len(art.get("full_text") or "") > len(old.get("full_text") or ""):
                old["full_text"] = art.get("full_text")
                old["title"] = art.get("title")
            old_clauses = {c.get("number"): c for c in old.get("clauses") or []}
            for c in art.get("clauses") or []:
                old_clauses[str(c.get("number")) + str(c.get("sub_number", ""))] = c
            old["clauses"] = list(old_clauses.values())
    return list(by_key.values())


def parse_semantic(text: str, meta: dict) -> SemanticParseResult:
    model = _get_model()
    chunks = _split_chunks(text[: config.GEMINI_PARSE_MAX_CHARS])
    result = SemanticParseResult()
    all_articles: list[dict] = []

    for i, chunk in enumerate(chunks):
        prompt = SEMANTIC_PROMPT.format(meta=json.dumps({**meta, "chunk": i + 1}, ensure_ascii=False))
        prompt += "\n\nVĂN BẢN:\n" + chunk
        data = json.loads((model.generate_content(prompt).text or "{}"))
        if not result.document and data.get("document"):
            result.document = data["document"]
        result.chapters.extend(data.get("chapters") or [])
        all_articles = _merge_articles(all_articles, data.get("articles") or [])
        for ch in data.get("chapters") or []:
            all_articles = _merge_articles(all_articles, ch.get("articles") or [])
        result.document_references.extend(data.get("document_references") or [])
        ent = data.get("entities") or {}
        for k in ("vehicles", "subjects"):
            result.entities.setdefault(k, []).extend(ent.get(k) or [])

    result.articles = all_articles
    return result
