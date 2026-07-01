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

    existing = {n["id"] for n in graph.nodes}
    violations = parse_violations(text, doc_number)
    for i, v in enumerate(violations):
        vid = make_id("vi_pham", doc_id, str(i))
        description = (v.get("description") or "")[:2000]
        graph.add_node(
            S.VI_PHAM,
            vid,
            level="vi_pham",
            title=description[:200],
            description=description,
            text=description,
            fine_min=v.get("fine_min"),
            fine_max=v.get("fine_max"),
            document_number=doc_number,
            doc_id=doc_id,
        )

        anum = str(v.get("article_number") or "")
        cnum = str(v.get("clause_number") or "")
        pt = str(v.get("point") or "").strip().lower()
        if anum:
            dieu_id = make_id("dieu", doc_id, anum)
            khoan_id = make_id("khoan", dieu_id, cnum) if cnum else ""
            diem_id = make_id("diem", khoan_id, pt) if khoan_id and pt else ""
            target_id = ""
            if diem_id and diem_id in existing:
                target_id = diem_id
            elif khoan_id and khoan_id in existing:
                target_id = khoan_id
            elif dieu_id in existing:
                target_id = dieu_id
            if target_id:
                graph.add_rel(S.QUY_DINH_TAI, vid, target_id)

        for veh in v.get("vehicles") or []:
            veh_id = make_id("phuong_tien", doc_id, veh.get("type", ""), veh.get("sub_type", ""))
            if veh_id not in existing:
                veh_label = " ".join(
                    p.strip()
                    for p in (veh.get("type", ""), veh.get("sub_type", ""))
                    if p and str(p).strip()
                ).strip()
                graph.add_node(
                    S.PHUONG_TIEN,
                    veh_id,
                    type=veh.get("type", ""),
                    sub_type=veh.get("sub_type", ""),
                    title=veh_label[:200],
                    text=veh_label,
                    document_number=doc_number,
                    doc_id=doc_id,
                )
                existing.add(veh_id)
            graph.add_rel(S.AP_DUNG_CHO, vid, veh_id)

        for pen in v.get("penalties") or []:
            pen_id = make_id("hinh_phat", doc_id, str(i), pen.get("type", "")[:20])
            pen_text = " ".join(
                p.strip()
                for p in (pen.get("type", ""), pen.get("duration", ""))
                if p and str(p).strip()
            ).strip()
            graph.add_node(
                S.HINH_PHAT,
                pen_id,
                type=pen.get("type", ""),
                duration=pen.get("duration", ""),
                title=pen_text[:200],
                text=pen_text,
                document_number=doc_number,
                doc_id=doc_id,
            )
            graph.add_rel(S.CO_HINH_PHAT, vid, pen_id)

    return graph