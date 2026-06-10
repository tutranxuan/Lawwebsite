"""Neo4j client – Semantic & Contextual Graph Model."""
from __future__ import annotations

from neo4j import GraphDatabase

import config
from app.graph import schema as S
from app.graph.graph_model import SemanticGraph


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
                note = link.get("note") or ""
                to_dieu = str(link.get("to_dieu") or link.get("target_dieu") or "")

                result = session.run(
                    f"""
                    MATCH (from:{S.VAN_BAN})
                    WHERE ($from_doc <> '' AND from.document_number = $from_doc)
                       OR ($from_doc_id <> '' AND (from.doc_id = $from_doc_id OR from.id = $from_doc_id))
                    MATCH (to:{S.VAN_BAN})
                    WHERE ($to_doc <> '' AND to.document_number = $to_doc)
                       OR ($to_title <> '' AND
                           replace(toLower(to.title), ',', '')
                           CONTAINS replace(toLower($to_title), ',', ''))
                    WITH from, to WHERE from <> to
                    MERGE (from)-[r:{rel}]->(to)
                    SET r.note = $note, r.target_dieu = $to_dieu
                    RETURN 1 AS c
                    """,
                    from_doc=from_doc,
                    from_doc_id=from_doc_id,
                    to_doc=to_doc,
                    to_title=to_title,
                    note=note,
                    to_dieu=to_dieu,
                )
                if result.peek():
                    created += 1
        return created

    def expand_neighbors(self, node_ids: list[str], limit: int = 12) -> list[dict]:
        pattern = S.EXPAND_REL_PATTERN
        with self._session() as session:
            result = session.run(
                f"""
                MATCH (n) WHERE n.id IN $ids
                OPTIONAL MATCH (n)-[:{pattern}*0..2]-(neighbor)
                WITH neighbor WHERE neighbor IS NOT NULL
                RETURN DISTINCT
                    neighbor.id AS id,
                    coalesce(neighbor.label, labels(neighbor)[0]) AS label,
                    neighbor.level AS level,
                    neighbor.number AS number,
                    neighbor.title AS title,
                    coalesce(neighbor.text, neighbor.content, neighbor.full_text) AS content,
                    neighbor.path AS path,
                    neighbor.doc_id AS doc_id,
                    neighbor.document_number AS document_number,
                    neighbor.description AS description,
                    neighbor.fine_min AS fine_min,
                    neighbor.fine_max AS fine_max
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
