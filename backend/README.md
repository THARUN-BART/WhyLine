# Whyline Backend Engine

High-performance Go backend service providing REST APIs, SSE agent streaming, and FalkorDB graph operations for Whyline.

---

## 🛠 Tech Stack
- **Language:** Go 1.22+
- **Router:** [go-chi/chi/v5](https://github.com/go-chi/chi)
- **Database:** [FalkorDB](https://falkordb.com) via pooled `gomodule/redigo` client
- **AI Agent:** Google Gemini 2.5 Flash via REST + Server-Sent Events (SSE)
- **Embeddings:** Google Gemini `text-embedding-004` (for Vs-RAG baseline comparison)
- **Authentication:** JWT with HMAC-SHA256 & sliding-window IP rate limiter
- **Email:** Native Gmail SMTP for OTP verification

---

## 📂 Architecture Overview

```
backend/
├── cmd/
│   └── server/             # Application entry point
├── internal/
│   ├── agent/              # Gemini AI agent loop, tool declarations & SSE streaming
│   ├── auth/               # JWT authentication, company approvals & IP rate limiter
│   ├── config/             # Environment variable loader and validator
│   ├── graph/              # FalkorDB client, Cypher query executor & sanitization
│   ├── memory/             # Isolated per-user memory graphs (memory_<user_id>)
│   ├── rag/                # Vector RAG baseline search & split-screen comparator
│   ├── ticket/             # Engineering ticket management & graph sync
│   └── tools/              # Graph tool definitions (trace, impact, bus factor)
├── ENDPOINTS.md            # Exhaustive REST & SSE API specification
└── main.go                 # Server bootstrap
```

---

## 🚀 Running the Backend

### Build and Run
```bash
# Build the binary
go build -o bin/whyline-backend main.go

# Start the server
./bin/whyline-backend
```

### Health Check
```bash
curl -s http://localhost:8080/health
# {"status":"ok","service":"whyline-backend","graph":"connected"}
```

---

## 📖 API Documentation
For complete request/response payloads, authentication flows, and status codes, see:
👉 **[backend/ENDPOINTS.md](ENDPOINTS.md)**
