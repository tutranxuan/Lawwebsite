"""Pipeline 3: Nghị định xử phạt (168) – cấu trúc luật + ViPham."""
from __future__ import annotations

import re

from app.graph import schema as S
from app.graph.graph_model import SemanticGraph
from app.parser.law_parser import make_id
from app.parser.violation_parser import parse_violations
from app.pipelines.standard_law import parse_standard_law, normalize_so_hieu


def parse_penalty_decree(
    text: str,
    doc_id: str,
    meta: dict,
    file_name: str,
    use_gemini: bool = True,
) -> SemanticGraph:
    """Regex cấu trúc Điều/Khoản + Gemini trích ViPham (nếu bật)."""
    graph = parse_standard_law(text, doc_id, meta, file_name)
    doc_number = normalize_so_hieu(meta.get("document_number", ""))

    if not use_gemini:
        return graph

    violations = parse_violations(text, doc_number)
    for i, v in enumerate(violations):
        vid = make_id("vi_pham", doc_id, str(i))
        graph.add_node(
            S.VI_PHAM,
            vid,
            level="vi_pham",
            description=(v.get("description") or "")[:2000],
            fine_min=v.get("fine_min"),
            fine_max=v.get("fine_max"),
            document_number=doc_number,
            doc_id=doc_id,
        )

        anum = str(v.get("article_number") or "")
        cnum = str(v.get("clause_number") or "")
        pt = str(v.get("point") or "")
        if anum:
            cl_id = make_id("khoan", doc_id, anum, cnum, pt or "v")
            existing = {n["id"] for n in graph.nodes}
            if cl_id in existing:
                graph.add_rel(S.QUY_DINH_TAI, vid, cl_id)

        for veh in v.get("vehicles") or []:
            veh_id = make_id("phuong_tien", doc_id, veh.get("type", ""), veh.get("sub_type", ""))
            if veh_id not in {n["id"] for n in graph.nodes}:
                graph.add_node(
                    S.PHUONG_TIEN,
                    veh_id,
                    type=veh.get("type", ""),
                    sub_type=veh.get("sub_type", ""),
                )
            graph.add_rel(S.AP_DUNG_CHO, vid, veh_id)

        for pen in v.get("penalties") or []:
            pen_id = make_id("hinh_phat", doc_id, str(i), pen.get("type", "")[:20])
            graph.add_node(
                S.HINH_PHAT,
                pen_id,
                type=pen.get("type", ""),
                duration=pen.get("duration", ""),
            )
            graph.add_rel(S.CO_HINH_PHAT, vid, pen_id)

    return graph
