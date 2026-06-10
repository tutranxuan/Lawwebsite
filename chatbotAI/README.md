# Graph RAG AI Chatbot – Luật Giao thông

Hệ thống chatbot AI tư vấn luật sử dụng **Graph RAG** với cấu trúc phân cấp:

```
Văn bản → Điều → Khoản → Điểm
```

## Kiến trúc

```
Frontend (chatbot.js)
    ↓ POST /api/chatbot
Node.js Backend (port 4000)
    ↓ POST /chat  (khi USE_GRAPH_RAG=true)
Python AI Service (port 8000)
    ├── FAISS (vector search)
    ├── Neo4j (graph relationships)
    └── Gemini API (LLM + embeddings)
         ↑
    datavbpl/ (*.doc, *.docx)
```

## Yêu cầu

1. **Python 3.10+** – [python.org](https://www.python.org/downloads/)
2. **Neo4j AuraDB Free** (khuyến nghị) hoặc Neo4j Desktop / Docker
3. **Gemini API Key** – [Google AI Studio](https://aistudio.google.com/apikey)
4. **antiword** (Linux/Docker) – đọc file `.doc` cũ; trên Windows có thể dùng Docker

## Cài đặt nhanh

### Bước 1: Cấu hình môi trường

```powershell
cd chatbotAI
copy .env.example .env
# Sửa GEMINI_API_KEY trong .env
```

Thêm vào `backend/.env` (hoặc biến môi trường):

```
GEMINI_API_KEY=your_key
USE_GRAPH_RAG=true
AI_SERVICE_URL=http://localhost:8000
```

### Bước 2: Neo4j AuraDB (cloud — khuyến nghị)

1. Đăng ký [Neo4j Aura](https://neo4j.com/cloud/aura/) → tạo **Free instance**
2. Copy connection string vào `chatbotAI/.env`:
```
NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=<password-tu-console>
NEO4J_DATABASE=neo4j
USE_NEO4J=true
```
3. Chi tiết: `NEO4J_AURA.md`

**Lưu ý:** Username luôn là `neo4j`, không phải instance id.

**Không có Aura?** Xem `NEO4J_DESKTOP.md` hoặc đặt `USE_NEO4J=false` (chỉ FAISS).

### Bước 3: Python (local, không Docker)

```powershell
cd chatbotAI\python-service
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

### Bước 4: Nạp dữ liệu từ datavbpl

```powershell
cd chatbotAI\python-service
# Gemini tách Điều/Khoản/Điểm + quan hệ văn bản (khuyến nghị):
python scripts/ingest_datavbpl.py --clear
# Chỉ regex (nhanh):
python scripts/ingest_datavbpl.py --clear --no-gemini
```

Quan hệ văn bản (Nghị định hướng dẫn Luật...) nằm trong `python-service/data/document_relations_seed.json`.

Script sẽ:
- Đọc ~50 file `.doc` trong `datavbpl/`
- Parse cấu trúc Điều/Khoản/Điểm
- Lưu graph vào Neo4j
- Tạo vector FAISS (Gemini embedding)

### Bước 5: Chạy AI Service

```powershell
cd chatbotAI\python-service
uvicorn main:app --reload --port 8000
```

### Bước 6: Chạy Backend Node.js

```powershell
cd backend
npm install
npm start
```

Chatbot trên website sẽ tự gọi Graph RAG khi `USE_GRAPH_RAG=true`.

## API Endpoints (Python – port 8000)

| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/health` | Trạng thái Neo4j, số vector |
| POST | `/chat` | `{ "question": "..." }` → Graph RAG |
| POST | `/ingest` | `{ "clear_existing": false }` → nạp lại data |
| GET | `/stats` | Thống kê Neo4j + vector |

## Cấu trúc thư mục

```
chatbotAI/
├── docker-compose.yml      # Neo4j + AI service
├── .env.example
├── README.md
└── python-service/
    ├── main.py             # FastAPI
    ├── config.py
    ├── requirements.txt
    ├── Dockerfile
    ├── app/
    │   ├── parser/         # Đọc .doc, parse cây luật
    │   ├── graph/          # Neo4j client
    │   ├── vector/         # FAISS store
    │   └── rag/            # Graph RAG pipeline
    └── scripts/
        └── ingest_datavbpl.py
```

## Xử lý sự cố

| Vấn đề | Giải pháp |
|--------|-----------|
| Không đọc được `.doc` | Cài antiword hoặc chạy qua Docker |
| Neo4j connection refused | `docker compose up -d neo4j`, kiểm tra port 7687 |
| Vector count = 0 | Chạy lại `ingest_datavbpl.py --clear` |
| Chatbot fallback cũ | Kiểm tra `USE_GRAPH_RAG=true` và AI service port 8000 |

## Neo4j Browser

- URL: http://localhost:7474
- Query mẫu: `MATCH (d:Dieu)-[:CO_KHOAN]->(k:Khoan) RETURN d, k LIMIT 25`
