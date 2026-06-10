# Neo4j AuraDB Free (Cloud)

Database chạy trên đám mây — **không cần** Neo4j Desktop Start hay Docker.

## Cấu hình `chatbotAI/.env`

```env
NEO4J_URI=neo4j+s://<instance-id>.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=<mat-khau-tu-aura-console>
NEO4J_DATABASE=neo4j
USE_NEO4J=true
```

| Biến | Ghi chú |
|------|---------|
| `NEO4J_URI` | Dùng `neo4j+s://` (TLS), copy từ Aura Console |
| `NEO4J_USER` | Luôn là **`neo4j`** — không dùng instance id |
| `NEO4J_DATABASE` | Thường là `neo4j`; nếu lỗi database, thử tên instance id |

## Quản lý trên web

1. [Neo4j Aura Console](https://console.neo4j.io/)
2. Chọn instance **Free instance** (Running)
3. **Query** / **Explore** → chạy Cypher trên trình duyệt

## Kiểm tra từ project

```powershell
cd chatbotAI\python-service
.\venv\Scripts\python scripts\test_neo4j.py
```

## Nạp dữ liệu luật

```powershell
.\venv\Scripts\python scripts\ingest_datavbpl.py --clear
```

## Lỗi thường gặp

| Lỗi | Cách xử lý |
|-----|------------|
| `Authentication failed` | `NEO4J_USER=neo4j`, kiểm tra password từ Aura |
| `Database not found` | Đổi `NEO4J_DATABASE` giữa `neo4j` và instance id |
| `SSL` / connection | URI phải bắt đầu `neo4j+s://` |
