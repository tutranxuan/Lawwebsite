"""Mô hình dữ liệu đồ thị."""
from __future__ import annotations

from dataclasses import dataclass, field

from app.graph import schema as S
from app.vector.vector_chunk import collect_leaf_chunks


@dataclass
class SemanticGraph:
    nodes: list[dict] = field(default_factory=list)
    relationships: list[dict] = field(default_factory=list)
    pipeline: str = S.STANDARD_LAW
    source_file: str = ""

    def add_node(self, label: str, node_id: str, **props) -> str:
        self.nodes.append({"label": label, "id": node_id, **props})
        return node_id

    def add_rel(self, rel_type: str, from_id: str, to_id: str, **props) -> None:
        self.relationships.append(
            {"type": rel_type, "from_id": from_id, "to_id": to_id, **props}
        )

    def index_docs(self) -> list[dict]:
        """FAISS – metadata thống nhất từ node lá."""
        return collect_leaf_chunks(self.nodes, self.source_file, self.pipeline)

    def stats_summary(self) -> dict:
        counts: dict[str, int] = {}
        for n in self.nodes:
            lbl = n.get("label", "?")
            counts[lbl] = counts.get(lbl, 0) + 1
        return {
            "nodes": counts,
            "relationships": len(self.relationships),
            "dieu": counts.get(S.DIEU, 0),
            "khoan": counts.get(S.KHOAN, 0) + counts.get(S.DIEM, 0),
            "yeu_cau": counts.get(S.YEU_CAU, 0),
            "vi_pham": counts.get(S.VI_PHAM, 0),
        }
