"""Điều hướng file vào đúng pipeline ETL."""
from __future__ import annotations

import re

from app.graph import schema as S


def detect_document_type(file_name: str, text_content: str) -> str:
    """
    STANDARD_LAW      – Luật, NĐ, TT phân cấp Chương/Điều/Khoản
    TECHNICAL_REGULATION – QCVN, phụ lục bảng biểu (1. / 1.1. / 2.1.5.)
    PENALTY_DECREE    – Nghị định xử phạt (168/2024)
    """
    name_l = file_name.lower()
    text_head = (text_content or "")[:8000].lower()

    if any(h in name_l for h in S.PENALTY_FILE_HINTS) or "xử phạt vi phạm hành chính" in text_head:
        return S.PENALTY_DECREE

    if "qcvn" in name_l or "quy chuẩn kỹ thuật" in text_head or "quy chuan ky thuat" in text_head:
        return S.TECHNICAL_REGULATION

    if any(h in name_l for h in S.TECHNICAL_FILE_HINTS):
        return S.TECHNICAL_REGULATION

    # Nhiều số phân cấp 1.1.1 hơn Điều → QCVN/phụ lục
    dotted = len(re.findall(r"\b\d+\.\d+\.\d+(?:\.\d+)*\b", text_content[:50000]))
    dieu_count = len(re.findall(r"(?:^|\s)điều\s+\d+", text_head, re.I))
    if dotted >= 12 and dotted > dieu_count * 2:
        return S.TECHNICAL_REGULATION

    return S.STANDARD_LAW
