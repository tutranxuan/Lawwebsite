# Kết nối Neo4j Desktop

## 1. Tạo / mở database

1. Mở **Neo4j Desktop**
2. **New** → **Create project** (nếu chưa có)
3. **Add** → **Local DBMS** → đặt tên ví dụ `lawwebsite`
4. Đặt mật khẩu cho user `neo4j` (ghi nhớ để ghi vào `.env`)

## 2. Khởi động database

1. Nhấn **Start** trên DBMS `lawwebsite`
2. Đợi trạng thái **Running** (màu xanh)
3. Bolt mặc định: `bolt://localhost:7687`

## 3. Cấu hình `chatbotAI/.env`

```env
USE_NEO4J=true
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=<mat-khau-ban-dat-khi-tao-DB>
```

Nếu bạn đặt mật khẩu khác `lawwebsite123`, **bắt buộc** sửa `NEO4J_PASSWORD` cho khớp.

## 4. Kiểm tra kết nối

```powershell
cd chatbotAI\python-service
.\venv\Scripts\python scripts\test_neo4j.py
```

Kết quả mong đợi: `Neo4j OK: bolt://localhost:7687`

## 5. Nạp dữ liệu vào graph + vector

```powershell
.\venv\Scripts\python scripts\ingest_datavbpl.py --clear
```

(Lần đầu có thể mất vài phút vì ~50 file `.doc` + embedding Gemini.)

## 6. Chạy AI Service

```powershell
.\venv\Scripts\uvicorn main:app --reload --port 8000
```

Mở http://localhost:8000/health — `"neo4j": true`, `"neo4j_enabled": true`.

## 7. Xem graph trong Neo4j Browser

1. Trong Neo4j Desktop → **Open** → **Neo4j Browser**
2. Chạy:

```cypher
MATCH (d:Dieu)-[:CO_KHOAN]->(k:Khoan)
RETURN d, k LIMIT 25
```

## Xử lý lỗi thường gặp

| Lỗi | Cách xử lý |
|-----|------------|
| `ServiceUnavailable` / connection refused | DBMS chưa **Start** trong Desktop |
| `Authentication failed` | Sửa `NEO4J_PASSWORD` trong `.env` |
| Port khác 7687 | Trong Desktop → DBMS → **...** → Connection details → cập nhật `NEO4J_URI` |
