"""FAISS vector store – embedding qua Gemini API."""
from __future__ import annotations

import json
import pickle
from pathlib import Path

import faiss
import google.generativeai as genai
import numpy as np

import config


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

    def _embed(self, texts: list[str]) -> np.ndarray:
        if not config.GEMINI_API_KEY:
            raise RuntimeError("Thiếu GEMINI_API_KEY để tạo embedding")
        vectors = []
        for text in texts:
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document",
            )
            vectors.append(result["embedding"])
        arr = np.array(vectors, dtype=np.float32)
        norms = np.linalg.norm(arr, axis=1, keepdims=True)
        norms[norms == 0] = 1
        return arr / norms

    def _embed_query(self, query: str) -> np.ndarray:
        result = genai.embed_content(
            model=f"models/{config.GEMINI_EMBED_MODEL}",
            content=query,
            task_type="retrieval_query",
        )
        vec = np.array([result["embedding"]], dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec

    def add_documents(self, docs: list[dict], batch_size: int = 16):
        if not docs:
            return
        all_vectors = []
        for i in range(0, len(docs), batch_size):
            batch = docs[i : i + batch_size]
            texts = [
                d.get("text_content") or d.get("full_text") or d.get("content") or d.get("title", "")
                for d in batch
            ]
            all_vectors.append(self._embed(texts))
        matrix = np.vstack(all_vectors).astype(np.float32)
        if self.index is None:
            dim = matrix.shape[1]
            self.index = faiss.IndexFlatIP(dim)
        self.index.add(matrix)
        self.metadata.extend(docs)
        self._save()

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
