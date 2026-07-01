"""FAISS vector store - embeddings via Gemini API."""
from __future__ import annotations

import json
import hashlib
import re
import unicodedata
from pathlib import Path

import faiss
import google.generativeai as genai
import numpy as np

import config


EMBED_MODEL_FALLBACKS = ("gemini-embedding-001", "text-embedding-004", "embedding-001")
TOKEN_RE = re.compile(r"\w+", re.UNICODE)


def _model_name(name: str) -> str:
    return name if name.startswith("models/") else f"models/{name}"


def _stable_hash(value: str) -> int:
    digest = hashlib.blake2b(value.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, "little", signed=False)


def _normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value or "")
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return without_marks.replace("đ", "d").replace("Đ", "D").lower()


class FaissVectorStore:
    def __init__(self, store_path: Path | None = None):
        self.store_path = store_path or config.VECTOR_STORE_PATH
        self.store_path.mkdir(parents=True, exist_ok=True)
        self.index_file = self.store_path / "index.faiss"
        self.meta_file = self.store_path / "metadata.json"
        self.index: faiss.IndexFlatIP | None = None
        self.metadata: list[dict] = []
        if config.GEMINI_API_KEY:
            genai.configure(api_key=config.GEMINI_API_KEY)
        self._load()

    def _load(self):
        if self.index_file.exists() and self.meta_file.exists():
            self.index = faiss.read_index(str(self.index_file))
            self.metadata = json.loads(self.meta_file.read_text(encoding="utf-8"))

    def _save(self):
        if self.index is not None:
            faiss.write_index(self.index, str(self.index_file))
        self.meta_file.write_text(
            json.dumps(self.metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _embed_with_fallback(self, content: str, task_type: str) -> list[float]:
        candidates = [config.GEMINI_EMBED_MODEL]
        candidates.extend(m for m in EMBED_MODEL_FALLBACKS if m not in candidates)
        last_error: Exception | None = None
        for model in candidates:
            try:
                result = genai.embed_content(
                    model=_model_name(model),
                    content=content,
                    task_type=task_type,
                )
                return result["embedding"]
            except Exception as exc:
                last_error = exc
        raise RuntimeError(
            "Khong tao duoc embedding bang cac model: "
            + ", ".join(candidates)
        ) from last_error

    def _embed(self, texts: list[str]) -> np.ndarray:
        if config.EMBEDDING_PROVIDER == "local":
            return self._embed_local(texts)
        if not config.GEMINI_API_KEY:
            raise RuntimeError("Thieu GEMINI_API_KEY de tao embedding")
        vectors = []
        for text in texts:
            vectors.append(self._embed_with_fallback(text, "retrieval_document"))
        arr = np.array(vectors, dtype=np.float32)
        norms = np.linalg.norm(arr, axis=1, keepdims=True)
        norms[norms == 0] = 1
        return arr / norms

    def _embed_query(self, query: str) -> np.ndarray:
        if config.EMBEDDING_PROVIDER == "local":
            return self._embed_local([query])
        vec = np.array(
            [self._embed_with_fallback(query, "retrieval_query")],
            dtype=np.float32,
        )
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec

    def _embed_local(self, texts: list[str]) -> np.ndarray:
        dim = config.LOCAL_EMBED_DIM
        matrix = np.zeros((len(texts), dim), dtype=np.float32)
        for row, text in enumerate(texts):
            normalized = _normalize_text(text)
            tokens = TOKEN_RE.findall(normalized)
            features = tokens[:]
            compact = " ".join(tokens)
            features.extend(compact[i : i + 5] for i in range(max(0, len(compact) - 4)))
            for feature in features:
                if not feature:
                    continue
                hashed = _stable_hash(feature)
                sign = 1.0 if hashed & 1 else -1.0
                matrix[row, hashed % dim] += sign
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1
        return matrix / norms

    def add_documents(self, docs: list[dict], batch_size: int = 16):
        if not docs:
            return
        for i in range(0, len(docs), batch_size):
            batch = docs[i : i + batch_size]
            texts = [
                d.get("text_content")
                or d.get("full_text")
                or d.get("content")
                or d.get("title", "")
                for d in batch
            ]
            matrix = self._embed(texts).astype(np.float32)
            if self.index is None:
                dim = matrix.shape[1]
                self.index = faiss.IndexFlatIP(dim)
            if self.index.d != matrix.shape[1]:
                raise RuntimeError(
                    f"Vector dimension mismatch: index={self.index.d}, batch={matrix.shape[1]}. "
                    "Hay chay ingest voi --clear."
                )
            self.index.add(matrix)
            self.metadata.extend(batch)
            self._save()
            print(f"  FAISS {len(self.metadata)}/{len(docs)} vectors")

    def search(self, query: str, top_k: int | None = None) -> list[dict]:
        if self.index is None or not self.metadata:
            return []
        k = top_k or config.TOP_K_VECTOR
        query_vec = self._embed_query(query)
        scores, indices = self.index.search(query_vec, min(k, len(self.metadata)))
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                continue
            item = dict(self.metadata[idx])
            item["score"] = float(score)
            results.append(item)
        return results

    def count(self) -> int:
        return len(self.metadata)

    def clear(self):
        self.index = None
        self.metadata = []
        if self.index_file.exists():
            self.index_file.unlink()
        if self.meta_file.exists():
            self.meta_file.unlink()
