"""Graph RAG pipeline: Gemini analysis -> retrieval -> Gemini answer."""
from __future__ import annotations

import json
import re
import unicodedata
import time
import itertools

import google.generativeai as genai
import httpx

import config
from app.graph.neo4j_client import Neo4jClient
from app.vector.faiss_store import FaissVectorStore

genai.configure(api_key=config.GEMINI_API_KEY)



SYSTEM_PROMPT = """
Bạn là một chuyên gia tư vấn luật giao thông đường bộ Việt Nam. Nếu người dùng có các câu hỏi không liên quan đến luật giao thông đường bộ xin hãy từ chối trả lời
Đừng sao chép nguyên văn điều luật. Hãy đóng vai một người am hiểu luật đang giải thích cho người dân.

QUY TẮC PHÂN TÍCH:
1. Từ khóa đồng nghĩa: Nếu người dùng hỏi "vượt đèn đỏ", hãy tự hiểu đó là "không chấp hành tín hiệu đèn giao thông". Nếu hỏi "không có bằng lái", hãy hiểu là "không có giấy phép lái xe".
2. Nếu không thấy từ khóa khớp chính xác trong ngữ cảnh, hãy sử dụng logic suy luận để tìm các hành vi tương đương trong dữ liệu.
3. Cấu trúc câu trả lời:
   - Mở đầu: Xác nhận hành vi (ví dụ: "Hành vi vượt đèn đỏ mà bạn hỏi được quy định là không chấp hành tín hiệu đèn...").
   - Tư vấn: Nêu rõ mức phạt, đối tượng áp dụng.
   - Lời khuyên: Gợi ý cách tránh vi phạm hoặc lưu ý quan trọng.
4. KHÔNG liệt kê danh sách tham chiếu (Diem a, Diem b...) ở cuối câu trả lời. Chỉ tập trung vào nội dung tư vấn hữu ích.
"""

VEHICLE_TERMS = ("xe máy", "ô tô", "xe tải", "xe buýt", "xe đạp", "xe khách")

class GraphRAGService:
    def __init__(self):
        self.neo4j = Neo4jClient()
        self.vector_store = FaissVectorStore()
        self.key_cycle = itertools.cycle(config.GEMINI_API_KEYS)
        self.current_model = self._get_new_model()
        self.history = []

    def _get_new_model(self):
        # Lấy key tiếp theo trong danh sách
        current_key = next(self.key_cycle)
        genai.configure(api_key=current_key)
        return genai.GenerativeModel(config.GEMINI_MODEL)

    def _strip_accents(self, text: str) -> str:
        decomposed = unicodedata.normalize("NFD", text or "")
        without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
        return without_marks.replace("đ", "d").replace("Đ", "D").lower()

    def _clean_text(self, text: str, max_len: int = 450) -> str:
        cleaned = re.sub(r"\s+", " ", text or "").strip()
        return cleaned[:max_len].rstrip()


    def _json_from_text(self, text: str) -> dict:
        raw = (text or "").strip()
        raw = re.sub(r"""^.*?({.*}).*$""", r"\1", raw, flags=re.DOTALL)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

    def _format_context(self, nodes: list[dict]) -> str:
            return "\n".join([f"- {n.get('title')}: {n.get('text') or n.get('description')}" for n in nodes[:5]])

    def _analyze_question(self, question: str) -> dict:
            """
            Phân tích ý định câu hỏi bằng Gemini để tối ưu hóa truy vấn.
            Trả về JSON: {"intent": "penalty|procedure|definition", "entities": [...]}
            """
            prompt = f"""
            Người dùng hỏi: "{question}".
            Hãy phân tích ý định và trích xuất từ khóa. 
            Nếu hành vi là ngôn ngữ đời thường (VD: 'vượt đèn đỏ'), hãy cung cấp thêm từ khóa pháp lý (VD: 'không chấp hành tín hiệu đèn').
            Trả về JSON: {{"intent": "...", "keywords": ["từ khóa 1", "từ khóa 2", "từ khóa mở rộng"]}}
            """
            try:
                # Sử dụng _gemini_generate đã có sẵn trong class của bạn
                response_text = self._gemini_generate(prompt, model=config.GEMINI_MODEL)
                return self._json_from_text(response_text)
            except Exception:
                return {"intent": "general", "keywords": []}

    def _gemini_generate(self, prompt: str, **kwargs) -> str:
        # 1. Cấu hình generation_config (nếu cần dùng cho tất cả các lần gọi)
        gen_config = {"temperature": 0.2}

        # 2. Vòng lặp thử tối đa 2 lần với 2 API Key khác nhau
        for attempt in range(2):
            try:
                response = self.current_model.generate_content(
                    prompt, 
                    request_options={"timeout": 20},
                    generation_config=gen_config
                )
                
                # Trả về kết quả nếu thành công
                return response.text if (response and response.text) else ""
                
            except Exception as e:
                print(f"DEBUG: Lần gọi {attempt+1} với Key hiện tại bị lỗi: {e}")
                self.current_model = self._init_model()
                time.sleep(1) 
        
        # Nếu đã thử cả 2 lần (2 Key) mà vẫn lỗi, trả về chuỗi rỗng để hàm answer xử lý fallback
        return ""

    def retrieve(self, question: str, analysis: dict | None = None) -> tuple[list[dict], str]:
        start_time = time.time() # Bắt đầu đo
        analysis = analysis or self._analyze_question(question)
        queries = [question]
        queries.extend(analysis.get("search_queries") or [])
        queries.extend(analysis.get("legal_terms") or [])
        queries = [q for q in dict.fromkeys(q.strip() for q in queries if q and str(q).strip())]

        keyword_hits: list[dict] = []
        if self.neo4j:
            keyword_terms = []
            for q in queries:
                keyword_terms.append(q)
                keyword_terms.append(self._strip_accents(q))
            try:
                keyword_hits = self.neo4j.search_by_keywords(keyword_terms, limit=config.TOP_K_GRAPH)
            except Exception:
                keyword_hits = []

        vector_hits = []
        vector_queries = [question] + (analysis.get("search_queries") or [])
        vector_queries = list(dict.fromkeys(vq.strip() for vq in vector_queries if vq and vq.strip()))
        
        for q in vector_queries:
            vector_hits.extend(self.vector_store.search(q, top_k=config.TOP_K_VECTOR))

        vehicle_hits = []
        if self.neo4j:
            try:
                vehicle_hits = self.neo4j.search_violations_by_vehicle(
                    analysis.get("vehicle_terms") or [],
                    limit=max(4, config.TOP_K_VECTOR),
                )
            except Exception:
                vehicle_hits = []

        seed_ids = [h["id"] for h in (keyword_hits + vector_hits) if h.get("id")]
        graph_nodes = []
        if self.neo4j and seed_ids:
            try:
                graph_nodes = self.neo4j.expand_neighbors(seed_ids[:5], limit=config.TOP_K_GRAPH)
            except Exception:
                graph_nodes = []
        all_hits = keyword_hits + vector_hits + vehicle_hits + graph_nodes
        by_id: dict[str, dict] = {}
        for node in all_hits:
            nid = node.get("id")
            if nid:
                # Chỉ lấy nếu nó có title hoặc content hợp lệ
                has_content = node.get("title") or node.get("text") or node.get("description")
                if nid not in by_id and has_content:
                    by_id[nid] = node

        ordered = list(by_id.values())[: config.TOP_K_GRAPH]
        end_time = time.time() # Kết thúc đo
        print(f"DEBUG: Thời gian thực thi retrieve: {end_time - start_time:.4f} giây")
        return ordered, self._format_context(ordered)

    def _sources(self, nodes: list[dict]) -> list[dict]:
        return [
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

    def answer(self, question: str) -> dict:
        analysis = self._analyze_question(question)
        time.sleep(1)
        nodes, context = self.retrieve(question, analysis)
        sources = []

        history_text = "\n".join([f"{item['role']}: {item['parts'][0]}" for item in self.history[-6:]])

        if not config.USE_GEMINI_ANSWER or not self.current_model:
            return {"answer": self._fallback_answer(question, nodes), "sources": sources, "analysis": analysis}


        # ĐƯA RA NGOÀI KHỐI ELIF: Đảm bảo prompt luôn được định nghĩa cho mọi intent
        prompt = f"""{SYSTEM_PROMPT}

LỊCH SỬ HỘI THOẠI GẦN ĐÂY:
{history_text}

Bạn là chuyên gia tư vấn luật giao thông. 
    Dựa trên ngữ cảnh: {context}
    Hãy giải đáp câu hỏi: {question}
    Lưu ý: Không liệt kê nguồn tham chiếu rườm rà. Viết như một lời tư vấn trực tiếp.

    TƯ DUY CỦA BẠN:
    1. Phân tích đối tượng (ví dụ: xe máy/ô tô) và hành vi trong câu hỏi.
    2. Dùng dữ liệu trong NGỮ CẢNH để đối chiếu. 
    3. Nếu ngữ cảnh chứa nhiều khung phạt, hãy tóm tắt logic: "Với trường hợp A thì phạt X, với trường hợp B thì phạt Y".
    4. KHÔNG liệt kê kiểu văn bản điều luật khô khan. Hãy viết lại thành ngôn ngữ tư vấn dễ hiểu cho người dân.
    5. Nếu ngữ cảnh không đủ thông tin, hãy nói rõ: "Dữ liệu hiện tại chưa cập nhật chi tiết cho hành vi này".
    """
        try:
            answer = self._gemini_generate(
                prompt,
                model=config.GEMINI_MODEL,
                temperature=0.2,
                max_output_tokens=2048,
                request_options={"timeout": 20}
            )
            answer = answer or self._fallback_answer(question, nodes)

            if answer and not answer.startswith("Xin lỗi"):
                    self.history.append({"role": "user", "parts": [question]})
                    self.history.append({"role": "model", "parts": [answer]})
                    if len(self.history) > 20: self.history = self.history[-20:]

        except Exception as exc:
            answer = self._fallback_answer(question, nodes, reason=str(exc))

        return {"answer": answer, "sources": [], "analysis": analysis}



    def _fallback_answer(self, question: str, nodes: list, reason: str = "") -> str:
        # Logic dự phòng khi không thể gọi Gemini
        return "Xin lỗi, hệ thống đang gặp lỗi kỹ thuật trong việc kết nối với AI. Vui lòng thử lại sau."

    def close(self):
            if hasattr(self, 'neo4j'):
                self.neo4j.close()