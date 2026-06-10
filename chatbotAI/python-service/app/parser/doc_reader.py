"""Đọc nội dung từ file .doc / .docx trong datavbpl."""
from __future__ import annotations

import re
import subprocess
import shutil
from pathlib import Path

try:
    import olefile
except ImportError:
    olefile = None

try:
    from docx import Document
except ImportError:
    Document = None


def _normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _read_docx(path: Path) -> str:
    if Document is None:
        raise RuntimeError("Thiếu python-docx")
    doc = Document(str(path))
    parts = [p.text for p in doc.paragraphs if p.text.strip()]
    return _normalize_text("\n".join(parts))


def _read_doc_ole(path: Path) -> str:
    """Trích xuất text từ Word .doc qua OLE stream (fallback)."""
    if olefile is None or not olefile.isOleFile(str(path)):
        return ""
    ole = olefile.OleFileIO(str(path))
    chunks: list[str] = []
    for stream_name in ("WordDocument", "1Table", "0Table"):
        if ole.exists(stream_name):
            raw = ole.openstream(stream_name).read()
            decoded = raw.decode("utf-16-le", errors="ignore")
            cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", " ", decoded)
            chunks.append(cleaned)
    ole.close()
    text = " ".join(chunks)
    text = re.sub(r"\s+", " ", text)
    return _normalize_text(text)


def _read_doc_word_com(path: Path) -> str:
    """Đọc .doc qua Microsoft Word (Windows, cần cài MS Word)."""
    import sys

    if sys.platform != "win32":
        return ""
    try:
        import win32com.client  # type: ignore
    except ImportError:
        return ""
    word = None
    doc = None
    try:
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        doc = word.Documents.Open(str(path.resolve()), ReadOnly=True)
        text = doc.Content.Text
        return _normalize_text(text.replace("\r", "\n"))
    except Exception:
        return ""
    finally:
        if doc:
            doc.Close(False)
        if word:
            word.Quit()


def _read_doc_antiword(path: Path) -> str:
    antiword = shutil.which("antiword")
    if not antiword:
        return ""
    result = subprocess.run(
        [antiword, "-m", "UTF-8.txt", str(path)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
        check=False,
    )
    if result.returncode != 0:
        return ""
    return _normalize_text(result.stdout)


def read_document(path: Path) -> str:
    """Đọc văn bản luật từ file .doc hoặc .docx."""
    suffix = path.suffix.lower()
    if suffix == ".docx":
        return _read_docx(path)
    if suffix == ".doc":
        text = _read_doc_antiword(path)
        if len(text) > 200:
            return text
        text = _read_doc_ole(path)
        if len(text) > 200:
            return text
        text = _read_doc_word_com(path)
        if len(text) > 200:
            return text
        raise RuntimeError(f"Không đọc được file .doc: {path.name}")
    raise ValueError(f"Định dạng không hỗ trợ: {suffix}")


def extract_document_meta(filename: str) -> dict:
    """
    Parse metadata từ tên file: 119_2024_ND-CP_626100.doc
    hoặc Luật giao thông đường bộ 2024.doc
    """
    stem = Path(filename).stem
    match = re.match(
        r"^(?P<number>\d+)_(?P<year>\d{4})_(?P<type>ND-CP|TT-[A-Z]+)_",
        stem,
        re.IGNORECASE,
    )
    if match:
        return {
            "document_number": f"{match.group('number')}/{match.group('year')}/{match.group('type')}",
            "title": stem.replace("_", " "),
            "year": match.group("year"),
            "doc_type": match.group("type"),
        }
    return {
        "document_number": stem,
        "title": stem.replace("_", " "),
        "year": "",
        "doc_type": "VBPL",
    }


def list_datavbpl_files(root: Path) -> list[Path]:
    files: list[Path] = []
    if not root.exists():
        return files
    for pattern in ("*.doc", "*.docx"):
        files.extend(root.glob(pattern))
    return sorted(files, key=lambda p: p.name.lower())
