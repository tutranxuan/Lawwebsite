"""Kiem tra ket noi Neo4j Desktop."""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv

load_dotenv(BASE_DIR.parent / ".env")

import config
from app.graph.neo4j_client import Neo4jClient


def main():
    print(f"URI:      {config.NEO4J_URI}")
    print(f"User:     {config.NEO4J_USER}")
    print(f"Database: {config.NEO4J_DATABASE}")
    print(f"USE_NEO4J: {config.USE_NEO4J}")

    if not config.USE_NEO4J:
        print("USE_NEO4J=false — dat true trong chatbotAI/.env de dung graph.")
        return

    neo = Neo4jClient()
    try:
        neo.verify()
        stats = neo.stats()
        print(f"Neo4j OK: {config.NEO4J_URI}")
        if stats:
            print("Nodes:", stats)
        else:
            print("(Chua co du lieu — chay ingest_datavbpl.py --clear)")
    except Exception as exc:
        print(f"Neo4j LOI: {exc}")
        print("\nKiem tra:")
        print("  1. Neo4j Community/D Desktop dang chay (bolt://localhost:7687)")
        print("  2. NEO4J_USER=neo4j, NEO4J_PASSWORD khop mat khau DB")
        print("  3. NEO4J_DATABASE=neo4j (mac dinh Community)")
        sys.exit(1)
    finally:
        neo.close()


if __name__ == "__main__":
    main()
