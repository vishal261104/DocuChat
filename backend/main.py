"""
DocuChat Backend — FastAPI + LangChain + ChromaDB + Gemini 2.5 Flash
"""

import os
import uuid
import logging
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# LangChain imports
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain.chat_models import init_chat_model

load_dotenv()

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ─── Config ──────────────────────────────────────────────────────────────────
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

CHROMA_DIR = "./chroma_langchain_db"
COLLECTION_NAME = "docuchat_collection"

EMBEDDING_MODEL = "sentence-transformers/all-mpnet-base-v2"
LLM_MODEL = "google_genai:gemini-2.5-flash"

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
RETRIEVAL_K = 4

# ─── Lazy-loaded globals ──────────────────────────────────────────────────────
_embeddings: Optional[HuggingFaceEmbeddings] = None
_vector_store: Optional[Chroma] = None
_llm = None
_current_api_key: Optional[str] = None  # track key so LLM is rebuilt on key change

# In-memory document registry {doc_id: {name, pages, chunk_ids}}
document_registry: dict = {}


def get_embeddings() -> HuggingFaceEmbeddings:
    global _embeddings
    if _embeddings is None:
        logger.info("Loading embedding model: %s", EMBEDDING_MODEL)
        _embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    return _embeddings


def get_vector_store() -> Chroma:
    global _vector_store
    if _vector_store is None:
        logger.info("Initialising ChromaDB at %s", CHROMA_DIR)
        _vector_store = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=get_embeddings(),
            persist_directory=CHROMA_DIR,
        )
    return _vector_store


def get_llm(api_key: str):
    """Return an LLM instance; re-create when the API key changes."""
    global _llm, _current_api_key
    if _llm is None or api_key != _current_api_key:
        logger.info("Initialising Gemini LLM")
        _llm = init_chat_model(LLM_MODEL, api_key=api_key)
        _current_api_key = api_key
    return _llm


# ─── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="DocuChat API",
    description="Chat with your PDF documents using AI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static files
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


# ─── Pydantic models ─────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    query: str
    api_key: str
    k: int = RETRIEVAL_K


class ChatResponse(BaseModel):
    answer: str
    sources: List[dict]
    context_used: str


class DocumentInfo(BaseModel):
    id: str
    name: str
    pages: int
    chunks: int


class DocumentListResponse(BaseModel):
    documents: List[DocumentInfo]
    total: int


class DeleteResponse(BaseModel):
    message: str
    deleted_chunks: int


class HealthResponse(BaseModel):
    status: str
    documents_indexed: int
    total_chunks: int
    embedding_model: str
    llm_model: str


# ─── Helper functions ─────────────────────────────────────────────────────────
def retrieve_context(query: str, k: int = RETRIEVAL_K):
    """Retrieve top-k relevant chunks and format context string."""
    vs = get_vector_store()
    results = vs.similarity_search_with_score(query, k=k)

    source_docs = []
    context_parts = []

    for i, (doc, score) in enumerate(results):
        context_parts.append(f"[Source {i+1}]\n{doc.page_content}")
        # ChromaDB returns L2 distance (lower = more similar).
        # Convert to a 0–100 similarity percentage for display.
        similarity_pct = round(max(0.0, 1.0 / (1.0 + float(score))) * 100, 1)
        source_docs.append(
            {
                "content": doc.page_content[:400] + ("..." if len(doc.page_content) > 400 else ""),
                "metadata": doc.metadata,
                "relevance_score": round(float(score), 4),
                "similarity_pct": similarity_pct,
                "source_index": i + 1,
            }
        )

    context = "\n\n---\n\n".join(context_parts)
    return context, source_docs


# ─── Routes ───────────────────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Check service health and stats."""
    total_chunks = 0
    try:
        vs = get_vector_store()
        total_chunks = vs._collection.count()
    except Exception:
        pass

    return HealthResponse(
        status="healthy",
        documents_indexed=len(document_registry),
        total_chunks=total_chunks,
        embedding_model=EMBEDDING_MODEL,
        llm_model=LLM_MODEL,
    )


@app.post("/upload", tags=["Documents"])
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a PDF, chunk it, embed it, and store in ChromaDB.
    Returns document metadata and chunk count.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    if file.size and file.size > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File size exceeds 50 MB limit.")

    doc_id = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{doc_id}_{file.filename}"

    # Save uploaded file
    try:
        content = await file.read()
        if len(content) > 50 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File size exceeds 50 MB limit.")
        save_path.write_bytes(content)
        logger.info("Saved upload: %s", save_path)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    # Load & split PDF
    try:
        loader = PyPDFLoader(str(save_path))
        pages = loader.load()

        if not pages:
            save_path.unlink(missing_ok=True)
            raise HTTPException(status_code=422, detail="PDF appears to be empty or unreadable.")

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
        )
        splits = splitter.split_documents(pages)

        # Tag each chunk with doc_id for later deletion
        for split in splits:
            split.metadata["doc_id"] = doc_id
            split.metadata["filename"] = file.filename

        logger.info("Split '%s' into %d chunks", file.filename, len(splits))
    except HTTPException:
        raise
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {e}")

    # Embed & store
    try:
        vs = get_vector_store()
        chunk_ids = vs.add_documents(splits)
        logger.info("Embedded %d chunks for doc_id=%s", len(chunk_ids), doc_id)
    except Exception as e:
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to embed document: {e}")

    # Register document
    document_registry[doc_id] = {
        "name": file.filename,
        "pages": len(pages),
        "chunk_ids": chunk_ids,
        "file_path": str(save_path),
    }

    return {
        "doc_id": doc_id,
        "filename": file.filename,
        "pages": len(pages),
        "chunks_created": len(chunk_ids),
        "message": f"'{file.filename}' processed and indexed successfully!",
    }


@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat(request: ChatRequest):
    """
    Send a question → retrieve relevant context → get Gemini answer.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    if not request.api_key.strip():
        raise HTTPException(status_code=400, detail="API key is required.")

    # Check if any documents are indexed
    try:
        vs = get_vector_store()
        total = vs._collection.count()
        if total == 0:
            raise HTTPException(
                status_code=400,
                detail="No documents indexed yet. Please upload a PDF first.",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vector store error: {e}")

    # Retrieve context
    try:
        context, source_docs = retrieve_context(request.query, k=request.k)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retrieval error: {e}")

    # Build prompt & call LLM
    try:
        llm = get_llm(request.api_key)

        system_message = (
            "You are DocuChat, an expert AI assistant that answers questions strictly "
            "based on the provided document context. Be precise, helpful, and cite which "
            "source (Source 1, Source 2, etc.) your information comes from. "
            "If the context doesn't contain the answer, say so clearly — do NOT fabricate information.\n\n"
            f"Context from documents:\n{context}"
        )

        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": request.query},
        ]

        response = llm.invoke(messages)
        logger.info("LLM response generated for query: '%s'", request.query[:60])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {e}")

    return ChatResponse(
        answer=response.content,
        sources=source_docs,
        context_used=context,
    )


@app.get("/documents", response_model=DocumentListResponse, tags=["Documents"])
async def list_documents():
    """List all uploaded and indexed documents."""
    docs = [
        DocumentInfo(
            id=doc_id,
            name=info["name"],
            pages=info["pages"],
            chunks=len(info["chunk_ids"]),
        )
        for doc_id, info in document_registry.items()
    ]
    return DocumentListResponse(documents=docs, total=len(docs))


@app.delete("/documents/{doc_id}", response_model=DeleteResponse, tags=["Documents"])
async def delete_document(doc_id: str):
    """Remove a document and all its chunks from ChromaDB."""
    if doc_id not in document_registry:
        raise HTTPException(status_code=404, detail="Document not found.")

    info = document_registry[doc_id]
    chunk_ids = info["chunk_ids"]

    try:
        vs = get_vector_store()
        vs.delete(ids=chunk_ids)
        logger.info("Deleted %d chunks for doc_id=%s", len(chunk_ids), doc_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete chunks: {e}")

    # Remove uploaded file
    file_path = Path(info.get("file_path", ""))
    if file_path.exists():
        file_path.unlink()

    del document_registry[doc_id]

    return DeleteResponse(
        message=f"'{info['name']}' deleted successfully.",
        deleted_chunks=len(chunk_ids),
    )


# ─── Static frontend (mount LAST so API routes take priority) ─────────────────
# Mounts at "/" so the browser can resolve /style.css, /app.js from index.html
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
