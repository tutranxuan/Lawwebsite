"""Pipeline 2: QCVN / Phụ lục – Phan → TieuMuc → YeuCau."""
from __future__ import annotations

import re

from app.graph import schema as S
from app.graph.graph_model import SemanticGraph
from app.parser.law_parser import make_id
from app.pipelines.standard_law import normalize_so_hieu, normalize_title_key

PART_RE = re.compile(r"(?mi)^\s*PH[ẦA]N\s+([0-9IVXLC]+)\s*[:\-]?\s*(.+?)\s*$")
CHAPTER_RE = re.compile(r"(?mi)^\s*Chương\s+([0-9IVXLC]+)\s*[-:\.]?\s*(.+?)\s*$")
APPENDIX_RE = re.compile(r"(?mi)^\s*Phụ\s+lục\s+([A-Z0-9]+)\s*[-:\.]?\s*(.+?)\s*$")
ARTICLE_RE = re.compile(r"(?mi)^\s*Điều\s+(\d+[a-zA-Z]?)\s*\.\s*(.+?)\s*$")
DECIMAL_RE = re.compile(r"(?mi)^\s*((?:\d+\.)+\d+|\d+)\.\s+(.+?)\s*$")


def _clean_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    # File .doc quy chuẩn thường bị dính thành một dòng; dựng lại các mốc cấu trúc chính.
    text = re.sub(r"\s+(MỤC LỤC)\s+", r"\n\1\n", text, flags=re.I)
    text = re.sub(r"\s+(PH[ẦA]N\s+[0-9IVXLC]+\s*[:\-])", r"\n\1", text, flags=re.I)
    text = re.sub(r"\s+(Chương\s+[0-9IVXLC]+\s*[-:\.])", r"\n\1", text, flags=re.I)
    text = re.sub(r"\s+(Phụ\s+lục\s+[A-Z0-9]+\s*[-:\.])", r"\n\1", text, flags=re.I)
    text = re.sub(r"\s+(Điều\s+\d+[a-zA-Z]?\s*\.)", r"\n\1", text, flags=re.I)
    text = re.sub(r"(?<=[\.:;])\s+((?:\d+\.)+\d+\.\s+)", r"\n\1", text)
    text = re.sub(r"(?<=[\.:;])\s+(\d+\.\s+[A-ZÀ-Ỵ])", lambda m: "\n" + m.group(1), text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _strip_table_of_contents(text: str) -> str:
    upper = text.upper()
    if "MỤC LỤC" not in upper:
        return text
    part_matches = list(PART_RE.finditer(text))
    part_one_matches = [m for m in part_matches if (m.group(1) or "").strip() == "1"]
    if len(part_one_matches) >= 2:
        return text[part_one_matches[1].start() :].strip()
    for match in part_matches:
        window = text[match.start() : match.start() + 4000]
        if re.search(r"(?i)^\s*Điều\s+1\.", window, flags=re.M):
            return text[match.start() :].strip()
    if len(part_matches) >= 2:
        return text[part_matches[-1].start() :].strip()
    return text


def _segment_text(kind: str, number: str) -> str:
    mapping = {
        "phan": "Phần",
        "chuong": "Chương",
        "phu_luc": "Phụ lục",
        "dieu": "Điều",
        "tieu_muc": "Tiểu mục",
        "yeu_cau": "Yêu cầu",
    }
    return f"{mapping.get(kind, kind)} {number}".strip()


def _split_sections(text: str, pattern: re.Pattern) -> list[tuple[str, str, str]]:
    matches = list(pattern.finditer(text))
    sections: list[tuple[str, str, str]] = []
    for idx, match in enumerate(matches):
        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        number = (match.group(1) or "").strip().rstrip(".")
        title = (match.group(2) or "").strip()
        body = text[start:end].strip()
        sections.append((number, title, body))
    return sections


def _add_node(
    graph: SemanticGraph,
    label: str,
    node_id: str,
    number: str,
    title: str,
    body: str,
    rel: str,
    parent_id: str,
    parent_path: str,
    doc_number: str,
    doc_id: str,
    file_name: str,
) -> str:
    level = label.lower()
    current_path = f"{parent_path} > {_segment_text(level, number)}".strip(" >")
    graph.add_node(
        label,
        node_id,
        level=level,
        number=number,
        title=(title or body.split("\n", 1)[0].strip())[:300],
        text=body[:8000],
        full_text=body[:8000],
        reference_path=current_path[:500],
        path=current_path[:500],
        document_number=doc_number,
        doc_id=doc_id,
        file_name=file_name,
    )
    graph.add_rel(rel, parent_id, node_id)
    return current_path[:500]


def _parse_decimal_sections(
    graph: SemanticGraph,
    text: str,
    parent_id: str,
    parent_path: str,
    doc_number: str,
    doc_id: str,
    file_name: str,
) -> None:
    for number, title, body in _split_sections(text, DECIMAL_RE):
        depth = number.count(".") + 1
        label = S.TIEU_MUC if depth <= 1 else S.YEU_CAU
        rel = S.CO_TIEU_MUC if label == S.TIEU_MUC else S.CO_YEU_CAU
        node_id = make_id(label.lower(), doc_id, number.replace(".", "_"))
        current_path = _add_node(
            graph,
            label,
            node_id,
            number,
            title,
            body or title,
            rel,
            parent_id,
            parent_path,
            doc_number,
            doc_id,
            file_name,
        )
        if label == S.TIEU_MUC:
            _parse_decimal_sections(
                graph,
                body,
                node_id,
                current_path,
                doc_number,
                doc_id,
                file_name,
            )


def _parse_part_body(
    graph: SemanticGraph,
    text: str,
    parent_id: str,
    parent_path: str,
    doc_number: str,
    doc_id: str,
    file_name: str,
) -> None:
    chapter_sections = _split_sections(text, CHAPTER_RE)
    appendix_sections = _split_sections(text, APPENDIX_RE)
    article_sections = _split_sections(text, ARTICLE_RE)

    if chapter_sections:
        for number, title, body in chapter_sections:
            node_id = make_id("tieu_muc", doc_id, "chuong", number)
            current_path = _add_node(
                graph,
                S.TIEU_MUC,
                node_id,
                number,
                title,
                body or title,
                S.CO_TIEU_MUC,
                parent_id,
                parent_path,
                doc_number,
                doc_id,
                file_name,
            )
            if _split_sections(body, ARTICLE_RE):
                _parse_part_body(
                    graph, body, node_id, current_path, doc_number, doc_id, file_name
                )
            else:
                _parse_decimal_sections(
                    graph, body, node_id, current_path, doc_number, doc_id, file_name
                )
        return

    if appendix_sections:
        for number, title, body in appendix_sections:
            node_id = make_id("tieu_muc", doc_id, "phu_luc", number)
            current_path = _add_node(
                graph,
                S.TIEU_MUC,
                node_id,
                number,
                title,
                body or title,
                S.CO_TIEU_MUC,
                parent_id,
                parent_path,
                doc_number,
                doc_id,
                file_name,
            )
            _parse_decimal_sections(
                graph, body, node_id, current_path, doc_number, doc_id, file_name
            )
        return

    if article_sections:
        for number, title, body in article_sections:
            node_id = make_id("tieu_muc", doc_id, "dieu", number)
            current_path = _add_node(
                graph,
                S.TIEU_MUC,
                node_id,
                number,
                title,
                body or title,
                S.CO_TIEU_MUC,
                parent_id,
                parent_path,
                doc_number,
                doc_id,
                file_name,
            )
            _parse_decimal_sections(
                graph, body, node_id, current_path, doc_number, doc_id, file_name
            )
        return

    _parse_decimal_sections(graph, text, parent_id, parent_path, doc_number, doc_id, file_name)


def parse_technical_regulation(
    text: str,
    doc_id: str,
    meta: dict,
    file_name: str,
) -> SemanticGraph:
    graph = SemanticGraph()
    doc_number = normalize_so_hieu(meta.get("document_number", ""))
    title = meta.get("title", file_name)
    text = _strip_table_of_contents(_clean_text(text))

    graph.add_node(
        S.VAN_BAN,
        doc_id,
        level="van_ban",
        title=title,
        text=title,
        document_number=doc_number,
        normalized_title=normalize_title_key(title),
        doc_id=doc_id,
        file_name=file_name,
        reference_path=f"Văn bản: {title[:50]}",
        path=f"Văn bản: {title[:50]}",
    )

    part_sections = _split_sections(text, PART_RE)
    if not part_sections:
        graph.add_node(
            S.YEU_CAU,
            make_id("yeu_cau", doc_id, "0"),
            level="yeu_cau",
            number="0",
            title=title[:200],
            text=text[:8000],
            document_number=doc_number,
            doc_id=doc_id,
            reference_path=title[:80],
            path=title[:80],
        )
        graph.add_rel(S.CO_YEU_CAU, doc_id, make_id("yeu_cau", doc_id, "0"))
        return graph

    for number, part_title, body in part_sections:
        part_id = make_id("phan", doc_id, number)
        part_path = _add_node(
            graph,
            S.PHAN,
            part_id,
            number,
            part_title,
            body or part_title,
            S.CO_PHAN,
            doc_id,
            f"Văn bản: {title[:50]}",
            doc_number,
            doc_id,
            file_name,
        )
        _parse_part_body(graph, body, part_id, part_path, doc_number, doc_id, file_name)

    return graph
