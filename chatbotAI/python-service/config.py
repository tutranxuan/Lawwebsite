"""Cấu hình cho AI Service Graph RAG."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_PARSE_MODEL = os.getenv("GEMINI_PARSE_MODEL", "gemini-2.0-flash")
GEMINI_EMBED_MODEL = os.getenv("GEMINI_EMBED_MODEL", "text-embedding-004")
GEMINI_PARSE_MAX_CHARS = int(os.getenv("GEMINI_PARSE_MAX_CHARS", "120000"))
USE_GEMINI_PARSER = os.getenv("USE_GEMINI_PARSER", "true").lower() in ("1", "true", "yes")

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
# Aura: username luôn là neo4j (không dùng instance id)
NEO4J_USER = os.getenv("NEO4J_USER") or os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "")
# Aura Free: tên database (vd. neo4j hoặc instance id)
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

# lawwebsite/ (cha của chatbotAI)
LAWWEBSITE_ROOT = BASE_DIR.parent.parent


def _resolve_path(raw: str | None, default: Path, base: Path) -> Path:
    """Đường dẫn tương đối trong .env luôn tính từ `base`, không phụ thuộc cwd."""
    if not raw:
        return default.resolve()
    p = Path(raw)
    if p.is_absolute():
        return p.resolve()
    return (base / p).resolve()


DATAVBPL_PATH = _resolve_path(
    os.getenv("DATAVBPL_PATH"),
    LAWWEBSITE_ROOT / "datavbpl",
    LAWWEBSITE_ROOT,
)
VECTOR_STORE_PATH = _resolve_path(
    os.getenv("VECTOR_STORE_PATH"),
    BASE_DIR / "vector_store",
    BASE_DIR,
)

TOP_K_VECTOR = int(os.getenv("TOP_K_VECTOR", "8"))
TOP_K_GRAPH = int(os.getenv("TOP_K_GRAPH", "12"))

# false = chỉ FAISS + Gemini (không cần Docker/Neo4j)
USE_NEO4J = os.getenv("USE_NEO4J", "true").lower() in ("1", "true", "yes")
