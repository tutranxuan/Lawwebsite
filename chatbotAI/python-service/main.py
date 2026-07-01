"""FastAPI AI Service – Graph RAG cho chatbot luật giao thông."""
from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR / ".env")

sys.path.insert(0, str(BASE_DIR))

import config
from app.graph.neo4j_client import Neo4jClient
from app.parser.doc_reader import list_datavbpl_files
from app.rag.graph_rag import GraphRAGService
from app.vector.faiss_store import FaissVectorStore
from scripts.ingest_datavbpl import ingest_all


rag_service: GraphRAGService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_service
    if config.AUTO_INGEST_ON_START:
        store = FaissVectorStore()
        should_ingest = config.AUTO_INGEST_CLEAR or store.count() == 0
        if should_ingest:
            ingest_all(clear_existing=config.AUTO_INGEST_CLEAR)
    rag_service = GraphRAGService()
    yield
    if rag_service:
        rag_service.close()


app = FastAPI(
    title="Law Website Graph RAG AI Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict] = []


class IngestRequest(BaseModel):
    clear_existing: bool = False


@app.get("/health")
def health():
    neo_ok = False
    vector_count = 0
    try:
        if rag_service:
            vector_count = rag_service.vector_store.count()
            if rag_service.neo4j:
                rag_service.neo4j.verify()
                neo_ok = True
    except Exception:
        neo_ok = False
    return {
        "status": "ok",
        "neo4j_enabled": config.USE_NEO4J,
        "neo4j": neo_ok,
        "vector_count": vector_count,
        "datavbpl_path": str(config.DATAVBPL_PATH),
        "doc_files": len(list_datavbpl_files(config.DATAVBPL_PATH)),
    }


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    if not rag_service:
        raise HTTPException(503, "AI service chưa sẵn sàng")
    result = rag_service.answer(req.question.strip())
    return result


@app.post("/ingest")
def ingest(req: IngestRequest):
    try:
        stats = ingest_all(clear_existing=req.clear_existing)
        return {"success": True, "stats": stats}
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc


@app.get("/stats")
def stats():
    neo_stats = {}
    if config.USE_NEO4J:
        neo = Neo4jClient()
        try:
            neo_stats = neo.stats()
        except Exception as exc:
            neo_stats = {"error": str(exc)}
        finally:
            neo.close()
    store = FaissVectorStore()
    return {
        "neo4j_enabled": config.USE_NEO4J,
        "neo4j": neo_stats,
        "vector_count": store.count(),
        "datavbpl_files": len(list_datavbpl_files(config.DATAVBPL_PATH)),
    }
