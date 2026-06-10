"""Pipeline 2: QCVN / Phụ lục – Phan → TieuMuc → YeuCau (1. / 1.1. / 2.1.5.)."""
from __future__ import annotations

import re

from app.graph import schema as S
from app.graph.graph_model import SemanticGraph
from app.parser.law_parser import make_id, parse_law_text
from app.pipelines.standard_law import normalize_so_hieu

SECTION_RE = re.compile(
    r"(?m)^(\d+(?:\.\d+)*)\.\s+(.+)$",
)


def _label_for_depth(depth: int) -> str:
    if depth <= 1:
        return S.PHAN
    if depth == 2:
        return S.TIEU_MUC
    return S.YEU_CAU


def _rel_for_child(depth: int) -> str:
    if depth <= 1:
        return S.CO_PHAN
    if depth == 2:
        return S.CO_TIEU_MUC
    return S.CO_YEU_CAU


def _format_tech_path(parts: list[str]) -> str:
    labels = []
    for p in parts:
        depth = p.count(".") + 1
        if depth <= 1:
            labels.append(f"Mục {p}")
        elif depth == 2:
            labels.append(f"Tiểu mục {p}")
        else:
            labels.append(f"Yêu cầu {p}")
    return " > ".join(labels)


def parse_technical_regulation(
    text: str,
    doc_id: str,
    meta: dict,
    file_name: str,
) -> SemanticGraph:
    graph = SemanticGraph()
    doc_number = normalize_so_hieu(meta.get("document_number", ""))
    title = meta.get("title", file_name)
    trimmed = parse_law_text(text, doc_id, title)
    text = trimmed.content if trimmed.content and len(trimmed.content) > 500 else text

    graph.add_node(
        S.VAN_BAN,
        doc_id,
        level="van_ban",
        title=title,
        text=title,
        document_number=doc_number,
        doc_id=doc_id,
        file_name=file_name,
        reference_path=f"Văn bản: {title[:50]}",
        path=f"Văn bản: {title[:50]}",
    )

    matches = list(SECTION_RE.finditer(text))
    if not matches:
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

    id_by_number: dict[str, str] = {}

    for i, match in enumerate(matches):
        number = match.group(1)
        body_start = match.end()
        next_start = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[body_start:next_start].strip()
        first_line = body.split("\n", 1)[0].strip()[:300]
        depth = number.count(".") + 1
        label = _label_for_depth(depth)
        level = label.lower()
        node_id = make_id(level, doc_id, number.replace(".", "_"))

        path_parts = number.split(".")
        ref_parts = [".".join(path_parts[:i]) for i in range(1, len(path_parts) + 1)]
        ref_path = _format_tech_path(ref_parts)

        graph.add_node(
            label,
            node_id,
            level=level,
            number=number,
            title=first_line,
            text=body[:8000],
            full_text=body[:8000],
            reference_path=ref_path,
            path=ref_path,
            document_number=doc_number,
            doc_id=doc_id,
            file_name=file_name,
        )
        id_by_number[number] = node_id

        parent_number = ".".join(number.split(".")[:-1])
        if parent_number and parent_number in id_by_number:
            graph.add_rel(_rel_for_child(depth), id_by_number[parent_number], node_id)
        else:
            graph.add_rel(S.CO_PHAN if depth == 1 else S.CO_TIEU_MUC, doc_id, node_id)

    return graph
