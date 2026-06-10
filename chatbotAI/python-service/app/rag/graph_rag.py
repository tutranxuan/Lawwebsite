"""Graph RAG pipeline: Vector search + Neo4j graph expansion + Gemini."""
from __future__ import annotations

import google.generativeai as genai

import config
from app.graph.neo4j_client import Neo4jClient
from app.vector.faiss_store import FaissVectorStore


SYSTEM_PROMPT = """
Bạn là trợ lý chuyên tư vấn luật giao thông đường bộ Việt Nam.
Chỉ trả lời trong phạm vi: quy định, mức phạt, thủ tục, biển báo, nồng độ cồn, đăng ký/đổi GPLX.
Khi trích dẫn, ghi rõ Điều/Khoản và số hiệu văn bản nếu có trong ngữ cảnh.
Nếu ngữ cảnh không đủ, hãy nói rõ và khuyên người dùng tra cứu thêm.
Không bịa đặt số liệu hoặc điều khoản không có trong ngữ cảnh.
Trả lời bằng tiếng Việt, ngắn gọn, có cấu trúc.
"""


class GraphRAGService:
    def __init__(self):
        self.neo4j = Neo4jClient() if config.USE_NEO4J else None
        self.vector_store = FaissVectorStore()
        if config.GEMINI_API_KEY:
            genai.configure(api_key=config.GEMINI_API_KEY)
            self.model = genai.GenerativeModel(config.GEMINI_MODEL)
        else:
            self.model = None

    def close(self):
        if self.neo4j:
            self.neo4j.close()

    def _format_context(self, nodes: list[dict]) -> str:
        if not nodes:
            return "Không tìm thấy điều khoản liên quan trong cơ sở dữ liệu."
        blocks = []
        seen = set()
        for node in nodes:
            nid = node.get("id")
            if nid in seen:
                continue
            seen.add(nid)
            label = node.get("label") or node.get("level", "")
            number = node.get("number", "")
            title = node.get("title", "") or node.get("description", "")
            content = node.get("content") or node.get("text", "")
            path = node.get("path", "")
            doc_num = node.get("document_number", "")
            header = f"[{label} {number}] {title}".strip()
            if doc_num:
                header += f"\n   Văn bản: {doc_num}"
            if path:
                header += f"\n   Đường dẫn: {path}"
            ref = node.get("reference_path") or path
            if ref and ref != path:
                header += f"\n   Đường dẫn: {ref}"
            if node.get("fine_min") is not None or node.get("fine_max") is not None:
                header += f"\n   Mức phạt: {node.get('fine_min', '?')} – {node.get('fine_max', '?')} VNĐ"
            body = (content or title)[:1200]
            blocks.append(f"{header}\n{body}")
        return "\n\n---\n\n".join(blocks)

    def retrieve(self, question: str) -> tuple[list[dict], str]:
        vector_hits = self.vector_store.search(question, top_k=config.TOP_K_VECTOR)
        seed_ids = [h["id"] for h in vector_hits if h.get("id")]

        graph_nodes = []
        if self.neo4j and seed_ids:
            try:
                graph_nodes = self.neo4j.expand_neighbors(seed_ids, limit=config.TOP_K_GRAPH)
            except Exception:
                graph_nodes = []
        if not graph_nodes and vector_hits:
            graph_nodes = vector_hits

        by_id: dict[str, dict] = {}
        for node in vector_hits + graph_nodes:
            nid = node.get("id")
            if nid:
                by_id[nid] = node

        ordered = list(by_id.values())[: config.TOP_K_GRAPH]
        context = self._format_context(ordered)
        return ordered, context

    def answer(self, question: str) -> dict:
        if not self.model:
            return {
                "answer": "Thiếu GEMINI_API_KEY. Vui lòng cấu hình trong chatbotAI/.env",
                "sources": [],
            }

        nodes, context = self.retrieve(question)
        prompt = f"""{SYSTEM_PROMPT}

NGỮ CẢNH (từ Graph RAG – văn bản luật đã lập chỉ mục):
{context}

CÂU HỎI: {question}
"""
        response = self.model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
                max_output_tokens=900,
            ),
        )
        answer = response.text if response.text else "Xin lỗi, tôi chưa có câu trả lời phù hợp."
        sources = [
            {
                "id": n.get("id"),
                "level": n.get("label") or n.get("level"),
                "number": n.get("number"),
                "title": (n.get("title") or n.get("description") or "")[:200],
                "path": n.get("path"),
                "document_number": n.get("document_number"),
            }
            for n in nodes[:5]
        ]
        return {"answer": answer, "sources": sources}
