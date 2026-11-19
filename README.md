# DocuChat 📄⚡

> **AI-Powered Document Intelligence & Retrieval-Augmented Generation (RAG) Platform**  
> Upload PDFs and chat with them using Google Gemini 2.5 Flash, LangChain, ChromaDB, and HuggingFace dense embeddings with verified source citations.

[![AI - Gemini 2.5 Flash](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://aistudio.google.com/)
[![LangChain](https://img.shields.io/badge/LangChain-0.3-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://www.langchain.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![ChromaDB](https://img.shields.io/badge/ChromaDB-0.5-orange?style=for-the-badge)](https://www.trychroma.com/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

---

## ✨ Key Features

- 📤 **Intelligent PDF Ingestion:** Drag-and-drop document upload with real-time extraction, recursive chunking (1,000 chars / 200 overlap), and metadata tagging.
- 🧠 **Dense Semantic Embeddings:** Encodes document chunks into high-dimensional vector space using `sentence-transformers/all-mpnet-base-v2`.
- 🔍 **Vector Retrieval with Relevance Scoring:** ChromaDB vector database with top-$k$ similarity search and relevance score attribution.
- 💬 **Context-Grounded Generation:** Powered by **Google Gemini 2.5 Flash** with strict anti-hallucination prompting, ensuring answers rely strictly on indexed sources.
- 📎 **Verifiable Source Citations:** Every synthesized answer displays clickable source references, relevant text excerpts, page numbers, and similarity metrics.
- 🗂️ **Dynamic Document Management:** Full lifecycle controls to upload, inspect chunk metrics, and delete indexed documents along with vector collections.
- 🎨 **Modern Responsive UI:** Polished dark-mode interface featuring glassmorphic cards, smooth animations, and real-time backend health monitoring.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Frontend (SPA)                       │
│        HTML5 • Modern Glassmorphic CSS3 • JS           │
└──────────────────────────┬─────────────────────────────┘
                           │ REST API
                           ▼
┌────────────────────────────────────────────────────────┐
│                   FastAPI Backend                      │
│                                                        │
│   ┌───────────────────────┐   ┌────────────────────┐   │
│   │   PDF Ingestion &     │   │  RAG Engine &      │   │
│   │   Recursive Splitting │   │  Prompt Orchestr.  │   │
│   └───────────┬───────────┘   └─────────┬──────────┘   │
└───────────────┼─────────────────────────┼──────────────┘
                │                         │
                ▼                         ▼
   ┌─────────────────────────┐   ┌───────────────────┐
   │ ChromaDB Vector Store   │   │ Google Gemini 2.5 │
   │ (all-mpnet-base-v2)     │   │ Flash LLM         │
   └─────────────────────────┘   └───────────────────┘
```

---

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/vishal261104/DocuChat.git
cd DocuChat
```

### 2. Set up virtual environment
```bash
# Create virtual environment
python -m venv .venv

# Activate environment
# On Windows (PowerShell):
.venv\Scripts\Activate.ps1
# On Windows (cmd):
.venv\Scripts\activate.bat
# On macOS/Linux:
source .venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r backend/requirements.txt
```

### 4. Configure environment variables
```bash
cp backend/.env.example backend/.env
```
Open `backend/.env` and insert your Google Gemini API key:
```env
GOOGLE_API_KEY=your_gemini_api_key_here
```
> Obtain a Gemini API key free from [Google AI Studio](https://aistudio.google.com/apikey).

### 5. Launch the application
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Access the application
Open your web browser and navigate to:
**[http://localhost:8000](http://localhost:8000)**

---

## 📡 API Reference

Interactive OpenAPI documentation is available at **[http://localhost:8000/docs](http://localhost:8000/docs)**.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health status and indexing statistics |
| `POST` | `/upload` | Upload, parse, chunk, and embed a PDF document |
| `POST` | `/chat` | Submit queries for semantic retrieval and LLM synthesis |
| `GET` | `/documents` | Retrieve list of all currently indexed documents |
| `DELETE` | `/documents/{id}` | Purge document and remove associated vectors from ChromaDB |

---

## 📁 Project Structure

```
DocuChat/
├── backend/
│   ├── main.py              # FastAPI application & RAG orchestration
│   ├── requirements.txt     # Python runtime dependencies
│   └── .env.example         # Environment variables template
├── frontend/
│   ├── index.html           # Single-page interface structure
│   ├── style.css            # Dark glassmorphic design system
│   └── app.js               # Reactive client-side application logic
├── .gitignore               # Ignored artifacts, virtual envs, & storage
└── README.md                # Project documentation
```

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **LLM Inference** | Google Gemini 2.5 Flash | Fast context-grounded conversational synthesis |
| **Embeddings** | `sentence-transformers/all-mpnet-base-v2` | State-of-the-art dense semantic text representations |
| **Vector Database** | ChromaDB | Local vector indexing and similarity search |
| **Framework** | LangChain | Document loaders, text splitters, and model integration |
| **Backend** | FastAPI / Uvicorn | Async REST API endpoints and static file serving |
| **Frontend** | Vanilla JS / CSS3 / HTML5 | Responsive, dependency-free glassmorphic web UI |

---

## 👨‍💻 Author

**Dhasi Vishal**
- GitHub: [@vishal261104](https://github.com/vishal261104)
- LinkedIn: [Dhasi Vishal](https://www.linkedin.com/in/vishal-dhasi-762238322/)
- LeetCode: [@dhasivishal](https://leetcode.com/u/dhasivishal/)

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for details.
