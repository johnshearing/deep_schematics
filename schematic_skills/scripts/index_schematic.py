#!/usr/bin/env python3
"""
Index a schematic custom knowledge graph into a LightRAG working directory.

Uses `ainsert_custom_kg`, so the graph produced by
build_kg.py is injected exactly as built - LightRAG runs no entity extraction over it. The
troubleshooting manual for the same machine should be inserted into the SAME working_dir
with the ordinary `ainsert` path; the two graphs merge on shared entity names, which is why
the schematic must use the drawing's exact designators as entity names.

Usage:
    python index_schematic.py custom_kg.json -w /path/to/work_dir
    python index_schematic.py custom_kg.json -w /path/to/work_dir --dry-run
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import numpy as np

from lightrag import LightRAG
from lightrag.kg.shared_storage import initialize_pipeline_status
from lightrag.llm.openai import gpt_4o_mini_complete, openai_embed
from lightrag.utils import EmbeddingFunc

# The embedding model must match every other document in the working directory. Changing it
# means clearing vector storage and re-indexing everything.
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-large")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", 3072))
MAX_TOKEN_SIZE = int(os.getenv("MAX_TOKEN_SIZE", 8192))


async def initialize_rag(working_dir: str) -> LightRAG:
    api_key = os.getenv("EMBEDDING_BINDING_API_KEY") or os.getenv("OPENAI_API_KEY")
    base_url = os.getenv("OPENAI_BASE_URL")

    async def embed(texts: list[str]) -> np.ndarray:
        return await openai_embed.func(
            texts, model=EMBEDDING_MODEL, api_key=api_key, base_url=base_url
        )

    rag = LightRAG(
        working_dir=working_dir,
        embedding_func=EmbeddingFunc(
            embedding_dim=EMBEDDING_DIM, max_token_size=MAX_TOKEN_SIZE, func=embed
        ),
        llm_model_func=gpt_4o_mini_complete,
    )
    # Both calls are mandatory; skipping them is the most common LightRAG failure.
    await rag.initialize_storages()
    await initialize_pipeline_status()
    return rag


def summarise(kg: dict) -> str:
    return (
        f"{len(kg.get('chunks', []))} chunks, "
        f"{len(kg.get('entities', []))} entities, "
        f"{len(kg.get('relationships', []))} relationships"
    )


async def run(kg_path: Path, working_dir: str, doc_id: str, dry_run: bool) -> None:
    kg = json.loads(kg_path.read_text())
    print(f"Loaded {kg_path.name}: {summarise(kg)}")

    missing = [k for k in ("chunks", "entities", "relationships") if k not in kg]
    if missing:
        raise SystemExit(f"ERROR: custom KG is missing required keys: {missing}")
    for rel in kg["relationships"]:
        if "keywords" not in rel:
            raise SystemExit(
                f"ERROR: relationship {rel.get('src_id')} -> {rel.get('tgt_id')} has no "
                "'keywords'; ainsert_custom_kg reads it without a default and will raise."
            )

    if dry_run:
        print("Dry run - nothing was indexed.")
        return

    if not (os.getenv("OPENAI_API_KEY") or os.getenv("EMBEDDING_BINDING_API_KEY")):
        raise SystemExit("ERROR: set OPENAI_API_KEY or EMBEDDING_BINDING_API_KEY")

    Path(working_dir).mkdir(parents=True, exist_ok=True)
    rag = await initialize_rag(working_dir)
    try:
        await rag.ainsert_custom_kg(kg, full_doc_id=doc_id)
        print(f"Indexed {kg_path.name} into {working_dir} as document '{doc_id}'")
    finally:
        await rag.finalize_storages()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Index a schematic custom KG into LightRAG"
    )
    parser.add_argument("kg_path", help="custom_kg.json produced by build_kg.py")
    parser.add_argument(
        "-w", "--working_dir", required=True, help="LightRAG working directory"
    )
    parser.add_argument("--doc-id", help="full_doc_id (default: the KG filename)")
    parser.add_argument(
        "--dry-run", action="store_true", help="Validate without indexing"
    )
    args = parser.parse_args()

    kg_path = Path(args.kg_path)
    if not kg_path.exists():
        print(f"ERROR: File not found: {kg_path}", file=sys.stderr)
        sys.exit(1)

    asyncio.run(
        run(kg_path, args.working_dir, args.doc_id or kg_path.name, args.dry_run)
    )


if __name__ == "__main__":
    main()
