# Khởi động AI Chatbot (nhanh)

Can **2 cua so PowerShell**.

---

## Lan dau (chi 1 lan)

```powershell
cd c:\Users\PC\Documents\DA\lawwebsite\chatbotAI
.\start-ai.ps1 -Setup -Ingest
```

- `-Setup`: cai Python packages + test Neo4j Aura
- `-Ingest`: Gemini tach Dieu/Khoan/Diem + quan he van ban -> Aura + FAISS (~15-45 phut, 48 file)
- Chi regex (nhanh, khong goi Gemini): `python scripts\ingest_datavbpl.py --clear --no-gemini`

Neu chua co Python: cai [Python 3.10+](https://www.python.org/downloads/) — tick **Add Python to PATH**, mo lai PowerShell.

---

## Moi lan dung chatbot

### Cua so 1 — AI Service

```powershell
cd c:\Users\PC\Documents\DA\lawwebsite\chatbotAI
.\start-ai.ps1
```

Mo trinh duyet: http://localhost:8000/health → `"neo4j": true`, `"vector_count" > 0`.

### Cua so 2 — Backend website

```powershell
cd c:\Users\PC\Documents\DA\lawwebsite\backend
npm start
```

### Cua so 3 (tuy chon) — Frontend

Mo file HTML hoac dung Live Server; chatbot goi `http://localhost:4000/api/chatbot`.

---

## Thu chatbot

1. Mo trang web co nut chat
2. Hoi: "Muc phat nong do con la bao nhieu?"
3. Neu AI Service tat → backend tu fallback Postgres/Gemini

---

## Lenh thu cong (neu khong dung script)

```powershell
cd chatbotAI\python-service
.\venv\Scripts\python scripts\test_neo4j.py
.\venv\Scripts\python scripts\ingest_datavbpl.py --clear
.\venv\Scripts\uvicorn main:app --reload --port 8000
```
