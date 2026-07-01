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

{{
  "violations": [
    {{
      "id_hint": "mã gợi ý ngắn",
      "description": "mô tả hành vi vi phạm",
      "fine_min": 0,
      "fine_max": 0,
      "article_number": "5",
      "clause_number": "1",
      "point": "a",
      "vehicles": [{{"type": "Xe máy", "sub_type": "Xe mô tô"}}],
      "penalties": [
        {{"type": "Trừ điểm GPLX", "duration": "4 điểm"}},
        {{"type": "Tước quyền sử dụng GPLX", "duration": "22 tháng"}}
      ]
    }}
  ]
}}

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
ARTICLE_RE = re.compile(r"(?mi)^\s*Điều\s+(\d+[a-zA-Z]?)\s*\.\s*(.+?)\s*$")
VEHICLE_PATTERNS = [
    ("ô tô", ("ô tô", "xe chở người bốn bánh có gắn động cơ", "xe chở hàng bốn bánh có gắn động cơ")),
    ("xe máy", ("xe mô tô", "xe gắn máy", "xe máy điện")),
    ("xe máy chuyên dùng", ("xe máy chuyên dùng",)),
    ("xe đạp", ("xe đạp", "xe đạp máy", "xe thô sơ")),
    ("người đi bộ", ("người đi bộ",)),
    ("vật nuôi", ("vật nuôi", "xe vật nuôi kéo")),
]
PENALTY_HINTS = (
    "trừ điểm giấy phép lái xe",
    "tước quyền sử dụng giấy phép",
    "tịch thu phương tiện",
    "đình chỉ hoạt động",
    "biện pháp khắc phục hậu quả",
)


def _normalize_penalty_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\s+(Chương\s+[0-9IVXLC]+\s+)", r"\n\1", text, flags=re.I)
    text = re.sub(r"\s+(Điều\s+\d+[a-zA-Z]?\s*\.)", r"\n\1", text, flags=re.I)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_json_payload(raw: str) -> dict:
    text = (raw or "").strip()
    if not text:
        return {}
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            return {}
    return {}


def _split_articles(text: str) -> list[dict]:
    text = _normalize_penalty_text(text)
    matches = list(ARTICLE_RE.finditer(text))
    articles = []
    for idx, match in enumerate(matches):
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        articles.append(
            {
                "number": (match.group(1) or "").strip(),
                "title": (match.group(2) or "").strip(),
                "body": text[start:end].strip(),
            }
        )
    return articles


def _infer_vehicles(title: str, body: str) -> list[dict]:
    haystack = f"{title} {body}".lower()
    vehicles = []
    for vehicle_type, hints in VEHICLE_PATTERNS:
        if any(hint in haystack for hint in hints):
            vehicles.append({"type": vehicle_type, "sub_type": ""})
    return vehicles


def _infer_penalties(body: str) -> list[dict]:
    body_l = body.lower()
    penalties = []
    for hint in PENALTY_HINTS:
        if hint in body_l:
            penalties.append({"type": hint.capitalize(), "duration": ""})
    return penalties


def _fallback_violations(text: str) -> list[dict]:
    results: list[dict] = []
    for article in _split_articles(text):
        title = article["title"]
        body = article["body"]
        title_l = title.lower()
        if "xử phạt" not in title_l and "trừ điểm" not in title_l:
            continue
        vehicles = _infer_vehicles(title, body)
        penalties = _infer_penalties(body)
        results.append(
            {
                "id_hint": f"dieu_{article['number']}",
                "description": title[:2000],
                "fine_min": None,
                "fine_max": None,
                "article_number": article["number"],
                "clause_number": "",
                "point": "",
                "vehicles": vehicles,
                "penalties": penalties,
            }
        )
    return results


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
            data = _extract_json_payload(model.generate_content(prompt).text or "{}")
            all_violations.extend(data.get("violations") or [])
        except Exception:
            continue
    return all_violations or _fallback_violations(text)
