"""Parser chuyên biệt Nghị định xử phạt (vd. 168/2024/NĐ-CP)."""
from __future__ import annotations

import json
import re

import google.generativeai as genai

import config
from app.graph import schema as S

VIOLATION_PROMPT = """
Bạn phân tích Nghị định xử phạt hành chính giao thông Việt Nam.
Trả về JSON (không markdown):

{
  "violations": [
    {
      "id_hint": "mã gợi ý ngắn",
      "description": "mô tả hành vi vi phạm",
      "fine_min": 0,
      "fine_max": 0,
      "article_number": "5",
      "clause_number": "1",
      "point": "a",
      "vehicles": [{"type": "Xe máy", "sub_type": "Xe mô tô"}],
      "penalties": [
        {"type": "Trừ điểm GPLX", "duration": "4 điểm"},
        {"type": "Tước quyền sử dụng GPLX", "duration": "22 tháng"}
      ]
    }
  ]
}

Quy tắc:
- fine_min/fine_max đơn vị VNĐ (số nguyên).
- Mỗi hành vi vi phạm riêng biệt.
- vehicles: loại phương tiện áp dụng (ô tô / xe máy / xe thô sơ...).
- penalties: hình phạt bổ sung, biện pháp khắc phục.
- Chỉ trích từ văn bản, không bịa.

Số hiệu văn bản: {so_hieu}
Đoạn văn bản (có thể là một phần):
"""

CHUNK = 45_000


def is_penalty_decree(file_name: str, title: str = "") -> bool:
    combined = (file_name + " " + title).lower()
    return any(h in combined for h in S.PENALTY_DECREE_HINTS)


def parse_violations(text: str, so_hieu: str) -> list[dict]:
    if not config.GEMINI_API_KEY:
        return []
    genai.configure(api_key=config.GEMINI_API_KEY)
    model = genai.GenerativeModel(
        config.GEMINI_PARSE_MODEL,
        generation_config=genai.types.GenerationConfig(
            temperature=0.1,
            response_mime_type="application/json",
            max_output_tokens=8192,
        ),
    )
    chunks = [text[i : i + CHUNK] for i in range(0, min(len(text), 200_000), CHUNK)]
    all_violations: list[dict] = []
    for chunk in chunks[:4]:
        prompt = VIOLATION_PROMPT.format(so_hieu=so_hieu) + chunk
        try:
            data = json.loads((model.generate_content(prompt).text or "{}"))
            all_violations.extend(data.get("violations") or [])
        except Exception:
            continue
    return all_violations
