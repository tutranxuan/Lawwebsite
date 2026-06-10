"""Điều hướng file vào đúng pipeline ETL."""
from __future__ import annotations

import re

from app.graph import schema as S


# Các mốc kết thúc tiêu đề (phần nội dung bắt đầu sau các mốc này).
_TITLE_END_MARKERS = (
    r"Căn\s+cứ",
    r"\bĐiều\s+1\b",
    r"\bChương\s+I\b",
    r"QUY ĐỊNH CHUNG",
)


def extract_title(text_content: str) -> str:
    """Trích tiêu đề văn bản: phần nằm sau khối header (quốc hiệu) và trước "Căn cứ".

    Ví dụ:
        ... Hạnh phúc ...      <- kết thúc header
        THÔNG TƯ
        BAN HÀNH QUY CHUẨN KỸ THUẬT QUỐC GIA VỀ ...   <- tiêu đề
        Căn cứ ...             <- bắt đầu nội dung
    """
    if not text_content:
        return ""

    region = text_content[:8000]

    # Bỏ phần header (quốc hiệu) để loại nhiễu, nhưng vẫn nằm TRƯỚC phần nội dung.
    header = re.search(r"Hạnh\s+phúc", region)
    if header:
        region = region[header.end():]

    # Cắt tại mốc bắt đầu nội dung gần nhất (Căn cứ / Điều 1 / Chương I ...).
    cut = len(region)
    for marker in _TITLE_END_MARKERS:
        m = re.search(marker, region)
        if m:
            cut = min(cut, m.start())
    title = region[:cut]

    # Dọn ký tự bảng (| ---) còn sót lại từ trình đọc .doc.
    title = re.sub(r"[|]", " ", title)
    title = re.sub(r"-{2,}", " ", title)
    title = re.sub(r"\s+", " ", title).strip()

    # Bỏ phần số hiệu + ngày ban hành còn sót ở đầu (vd "Số: 49/2024/TT-BGTVT
    # Hà Nội, ngày 15 tháng 11 năm 2024 THÔNG TƯ ...").
    title = re.sub(r"^.*?ng[àa]y\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4}\s*", "", title, flags=re.I)
    return title.strip()


def detect_document_type(file_name: str, text_content: str) -> str:
    """
    STANDARD_LAW         – Luật, NĐ, TT phân cấp Chương/Điều/Khoản (mặc định)
    TECHNICAL_REGULATION – CHỈ khi tiêu đề có chữ "quy chuẩn"
    PENALTY_DECREE       – Nghị định xử phạt (168/2024)
    """
    name_l = file_name.lower()
    title_l = extract_title(text_content or "").lower()

    # 1) Xử phạt (NĐ 168) – giữ riêng: theo số hiệu file hoặc tiêu đề "xử phạt".
    if any(h in name_l for h in S.PENALTY_FILE_HINTS) or "xử phạt vi phạm hành chính" in title_l:
        return S.PENALTY_DECREE

    # 2) Quy chuẩn kỹ thuật – chỉ khi TIÊU ĐỀ có chữ "quy chuẩn".
    if "quy chuẩn" in title_l or "quy chuan" in title_l:
        return S.TECHNICAL_REGULATION

    # 3) Còn lại → văn bản chuẩn.
    return S.STANDARD_LAW
