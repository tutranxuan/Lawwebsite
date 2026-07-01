"""Neo4j client – Semantic & Contextual Graph Model."""
from __future__ import annotations

from neo4j import GraphDatabase

import config
from app.graph import schema as S
from app.graph.graph_model import SemanticGraph
from app.pipelines.standard_law import normalize_title_key


class Neo4jClient:
    def __init__(self):
        self._driver = GraphDatabase.driver(
            config.NEO4J_URI,
            auth=(config.NEO4J_USER, config.NEO4J_PASSWORD),
        )

    def _session(self):
        return self._driver.session(database=config.NEO4J_DATABASE)

    def close(self):
        self._driver.close()

    def verify(self) -> bool:
        self._driver.verify_connectivity()
        with self._session() as session:
            session.run("RETURN 1")
        return True

    def init_schema(self):
        with self._session() as session:
            for cypher in S.CONSTRAINTS:
                session.run(cypher)

    def clear_all(self):
        with self._session() as session:
            session.run("MATCH (n) DETACH DELETE n")

    def purge_legacy_schema(self) -> dict:
        allowed_labels = list(S.ALL_LABELS)
        allowed_rels = list(S.ALL_RELS)
        with self._session() as session:
            deleted_nodes = session.run(
                """
                MATCH (n)
                WHERE none(lbl IN labels(n) WHERE lbl IN $allowed_labels)
                WITH collect(n) AS nodes
                FOREACH (x IN nodes | DETACH DELETE x)
                RETURN size(nodes) AS deleted_nodes
                """,
                allowed_labels=allowed_labels,
            ).single()["deleted_nodes"]
            deleted_rels = session.run(
                """
                MATCH ()-[r]->()
                WHERE NOT type(r) IN $allowed_rels
                WITH collect(r) AS rels
                FOREACH (x IN rels | DELETE x)
                RETURN size(rels) AS deleted_rels
                """,
                allowed_rels=allowed_rels,
            ).single()["deleted_rels"]
            return {"deleted_nodes": deleted_nodes, "deleted_rels": deleted_rels}

    def upsert_graph(self, graph: SemanticGraph) -> None:
        with self._session() as session:
            for node in graph.nodes:
                label = node["label"]
                node_id = node["id"]
                props = {k: v for k, v in node.items() if k not in ("label", "id")}
                session.run(
                    f"""
                    MERGE (n:{label} {{id: $id}})
                    SET n += $props, n.label = $label
                    """,
                    id=node_id,
                    label=label,
                    props=props,
                )

            for rel in graph.relationships:
                rel_type = rel["type"]
                if rel_type not in S.ALL_RELS:
                    rel_type = S.THAM_CHIEU
                props = {
                    k: v
                    for k, v in rel.items()
                    if k not in ("type", "from_id", "to_id")
                }
                session.run(
                    f"""
                    MATCH (a {{id: $from_id}})
                    MATCH (b {{id: $to_id}})
                    MERGE (a)-[r:{rel_type}]->(b)
                    SET r += $props
                    """,
                    from_id=rel["from_id"],
                    to_id=rel["to_id"],
                    props=props,
                )

    def link_documents(self, links: list[dict]) -> int:
        """Tạo quan hệ GUIDES / BASED_ON / REFERENCES giữa Document."""
        created = 0
        with self._session() as session:
            for link in links:
                rel = link.get("relation", S.HUONG_DAN).upper()
                if rel in ("HUONG_DAN", "GUIDES"):
                    rel = S.HUONG_DAN
                elif rel in ("CAN_CU", "BASED_ON"):
                    rel = S.CAN_CU
                elif rel in ("THAM_CHIEU", "REFERENCES"):
                    rel = S.THAM_CHIEU
                elif rel in ("THAY_THE", "REPLACES"):
                    rel = S.THAY_THE
                if rel not in S.ALL_RELS:
                    rel = S.HUONG_DAN

                from_doc = link.get("from_document_number") or ""
                from_doc_id = link.get("from_doc_id") or ""
                to_doc = link.get("to_document_number") or ""
                to_title = (link.get("to_title") or "")[:40]
                to_title_norm = normalize_title_key(link.get("to_title") or "")
                note = link.get("note") or ""
                to_dieu = str(link.get("to_dieu") or link.get("target_dieu") or "")

                result = session.run(
                    f"""
                    MATCH (from:{S.VAN_BAN})
                    WHERE ($from_doc <> '' AND from.document_number = $from_doc)
                       OR ($from_doc_id <> '' AND (from.doc_id = $from_doc_id OR from.id = $from_doc_id))
                    MATCH (to:{S.VAN_BAN})
                    WHERE ($to_doc <> '' AND to.document_number = $to_doc)
                       OR ($to_title <> '' AND to.title CONTAINS $to_title)
                       OR ($to_title_norm <> '' AND coalesce(to.normalized_title, '') CONTAINS $to_title_norm)
                    WITH from, to WHERE from <> to
                    MERGE (from)-[r:{rel}]->(to)
                    SET r.note = $note, r.target_dieu = $to_dieu
                    RETURN 1 AS c
                    """,
                    from_doc=from_doc,
                    from_doc_id=from_doc_id,
                    to_doc=to_doc,
                    to_title=to_title,
                    to_title_norm=to_title_norm,
                    note=note,
                    to_dieu=to_dieu,
                )
                if result.peek():
                    created += 1
        return created

    def expand_neighbors(self, node_ids: list[str], limit: int = 5) -> list[dict]:
        # SỬA LỖI LOANG QUÁ RỘNG: Chỉ cho phép đi qua quan hệ cấu trúc nội bộ (Điều, Khoản, Điểm) và Xử phạt
        # Không đi qua các quan hệ liên kết liên văn bản (HUONG_DAN, CAN_CU...) để tránh bị loãng sang văn bản khác.
        allowed_rels = [S.CO_DIEU, S.CO_KHOAN, S.CO_DIEM, S.QUY_DINH_TAI, S.AP_DUNG_CHO, S.CO_HINH_PHAT]
        pattern = "|".join(allowed_rels)
        with self._session() as session:
            result = session.run(
                f"""
                MATCH (n) WHERE n.id IN $ids
                OPTIONAL MATCH (n)-[:{pattern}*0..1]-(neighbor)
                WITH neighbor WHERE neighbor IS NOT NULL AND NOT neighbor:VanBan
                RETURN DISTINCT
                    neighbor.id AS id,
                    coalesce(neighbor.label, labels(neighbor)[0]) AS label,
                    neighbor.level AS level,
                    neighbor.number AS number,
                    neighbor.title AS title,
                    coalesce( neighbor.text,  neighbor.description, 'Không có nội dung') AS content,
                    neighbor.path AS path,
                    neighbor.doc_id AS doc_id,
                    neighbor.document_number AS document_number,
                    neighbor.description AS description
                LIMIT $limit
                """,
                ids=node_ids,
                limit=limit,
            )
            rows = []
            for r in result:
                d = dict(r)
                d["level"] = d.get("level") or (d.get("label") or "").lower()
                rows.append(d)
            return rows

    def search_violations_by_vehicle(self, vehicle_terms: list[str], limit: int = 5) -> list[dict]:
        terms = [t.strip().lower() for t in (vehicle_terms or []) if t and str(t).strip()]
        if not terms:
            return []
        with self._session() as session:
            result = session.run(
                f"""
                MATCH (v:{S.VI_PHAM})-[:{S.AP_DUNG_CHO}]->(p:{S.PHUONG_TIEN})
                WHERE any(t IN $terms WHERE
                    toLower(coalesce(p.type,'')) CONTAINS t OR toLower(coalesce(p.sub_type,'')) CONTAINS t
                )
                RETURN DISTINCT
                    v.id AS id,
                    coalesce(v.label, labels(v)[0]) AS label,
                    v.level AS level,
                    v.number AS number,
                    v.title AS title,
                    coalesce( v.text,  v.description, 'Không có nội dung') AS content,
                    v.path AS path,
                    v.doc_id AS doc_id,
                    v.document_number AS document_number,
                    v.description AS description
                LIMIT $limit
                """,
                terms=terms,
                limit=limit,
            )
            rows = []
            for r in result:
                d = dict(r)
                d["level"] = d.get("level") or (d.get("label") or "").lower()
                rows.append(d)
            return rows

    def search_by_keywords(self, terms: list[str], limit: int = 5) -> list[dict]:
        terms = [str(t).strip().lower() for t in (terms or []) if str(t).strip()]
        if not terms:
            return []
        # TỐI ƯU HÓA TRUY VẤN: Loại bỏ việc quét toàn bộ DB (MATCH n).
        # Chỉ quét các Node thuộc Ontology có chứa thông tin chi tiết điều khoản để tăng tốc độ và độ chính xác.
        target_labels = [S.DIEU, S.KHOAN, S.DIEM, S.YEU_CAU, S.VI_PHAM]
        with self._session() as session:
            result = session.run(
                """
                MATCH (n)
                WHERE any(lbl IN labels(n) WHERE lbl IN $target_labels)
                WITH n,
                    toLower(
                        coalesce(n.title, '') + ' ' +
                        coalesce(n.text, '') + ' ' +
                        coalesce(n.description, '') + ' ' +
                    ) AS haystack
                WHERE any(t IN $terms WHERE haystack CONTAINS t)
                RETURN
                    n.id AS id,
                    coalesce(n.label, labels(n)[0]) AS label,
                    n.level AS level,
                    n.number AS number,
                    n.title AS title,
                    coalesce( n.text,  n.description, 'Không có nội dung') AS content,
                    n.path AS path,
                    n.doc_id AS doc_id,
                    n.document_number AS document_number,
                    n.description AS description
                LIMIT $limit
                """,
                terms=terms,
                target_labels=target_labels,
                limit=limit,
            )
            rows = []
            for r in result:
                d = dict(r)
                d["level"] = d.get("level") or (d.get("label") or "").lower()
                rows.append(d)
            return rows

    def stats(self) -> dict:
        with self._session() as session:
            result = session.run(
                """
                MATCH (n)
                RETURN labels(n)[0] AS label, count(*) AS count
                ORDER BY count DESC
                """
            )
            return {r["label"]: r["count"] for r in result}