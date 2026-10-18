# Whyline Setup Guide

How to run **Whyline** locally: FalkorDB (Podman or Docker), the Go backend, and the Next.js frontend.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Start FalkorDB](#2-start-falkordb)
3. [Create Indexes and the Platform Admin](#3-create-indexes-and-the-platform-admin)
4. [Seed Sample Data (Optional)](#4-seed-sample-data-optional)
5. [Run Queries and Verify](#5-run-queries-and-verify)
6. [Configure Environment Variables](#6-configure-environment-variables)
7. [Run the Backend (Go)](#7-run-the-backend-go)
8. [Run the Frontend (Next.js)](#8-run-the-frontend-nextjs)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

- **Container engine:** [Podman](https://podman.io) or [Docker](https://www.docker.com)
- **Go:** 1.22 or newer
- **Bun 1.0+** (recommended) or **Node.js 20+**
- **Google Gemini API key:** from [Google AI Studio](https://aistudio.google.com/)

> The commands below use `podman`. If you use Docker, replace `podman` with `docker`. Everything else is identical.

---

## 2. Start FalkorDB

Whyline stores its data in **FalkorDB**, a graph database that speaks the Redis protocol.

### Podman

```bash
podman run -d \
  --name whyline-falkordb \
  -p 6379:6379 \
  -p 3001:3000 \
  -v falkordb_data:/var/lib/falkordb/data:Z \
  --restart unless-stopped \
  falkordb/falkordb:latest
```

> The `:Z` flag fixes SELinux permissions for rootless Podman. Docker does not need it.

### Docker

```bash
docker run -d \
  --name whyline-falkordb \
  -p 6379:6379 \
  -p 3001:3000 \
  -v falkordb_data:/var/lib/falkordb/data \
  --restart unless-stopped \
  falkordb/falkordb:latest
```

### Docker Compose

```bash
docker compose up -d
# or: podman-compose up -d
```

### Check that it is running

```bash
podman ps
podman exec -it whyline-falkordb redis-cli PING
# Expected: PONG
```

| Port | Purpose |
|---|---|
| `6379` | Database (Redis protocol) |
| `3001` | FalkorDB web UI, open http://localhost:3001 |

---

## 3. Create Indexes and the Platform Admin

In a graph database, "tables" are **node labels** (`:User`, `:Company`, `:System`, `:Decision`, `:Ticket`, `:Person`, `:Thread`, `:Document`) and relationships are **edges** (`:BELONGS_TO`, `:DECIDED`, `:APPROVED_IN`, `:DEPENDS_ON`, `:OWNS`).

All queries run against the graph named **`company`**.

> FalkorDB executes **one Cypher statement per `GRAPH.QUERY` call**. Run each statement below separately.

### 3.1 Create indexes

Indexes speed up login, profile lookups and multi-tenant resolution.

```bash
for q in \
  "CREATE INDEX FOR (u:User) ON (u.email)" \
  "CREATE INDEX FOR (u:User) ON (u.username)" \
  "CREATE INDEX FOR (u:User) ON (u.id)" \
  "CREATE INDEX FOR (c:Company) ON (c.name)" \
  "CREATE INDEX FOR (c:Company) ON (c.id)" \
  "CREATE INDEX FOR (t:Ticket) ON (t.id)" \
  "CREATE INDEX FOR (d:Decision) ON (d.id)" \
  "CREATE INDEX FOR (s:System) ON (s.id)" \
  "CREATE INDEX FOR (s:System) ON (s.name)" \
  "CREATE INDEX FOR (p:Person) ON (p.id)"
do
  podman exec -i whyline-falkordb redis-cli GRAPH.QUERY company "$q"
done
```

### 3.2 Generate a password hash for the admin

Never store the plaintext password. Generate a bcrypt hash and keep the plaintext somewhere safe (a password manager).

```bash
# Requires htpasswd (apache2-utils / httpd-tools)
htpasswd -bnBC 10 "" 'YOUR_STRONG_PASSWORD' | tr -d ':\n' | sed 's/^\$2y/$2a/'
```

Copy the output (it starts with `$2a$10$...`) and use it as `<BCRYPT_HASH>` below.

### 3.3 Create the root company and the platform admin

Replace the placeholders, then run each statement separately.

| Field | Value |
|---|---|
| Email | `<ADMIN_EMAIL>` |
| Username | `<ADMIN_USERNAME>` |
| Password hash | `<BCRYPT_HASH>` |
| Role | `admin` |
| Status | `approved` |

**Statement 1: company**

```cypher
MERGE (c:Company {name: "Whyline"})
ON CREATE SET c.id = "comp_whyline", c.created_at = "2026-10-01T00:00:00Z"
```

**Statement 2: admin user linked to the company**

```cypher
MERGE (u:User {email: "<ADMIN_EMAIL>"})
ON CREATE SET
  u.id = "usr_admin_01",
  u.username = "<ADMIN_USERNAME>",
  u.password_hash = "<BCRYPT_HASH>",
  u.role = "admin",
  u.company = "Whyline",
  u.approval_status = "approved",
  u.is_verified = true,
  u.created_at = "2026-10-01T00:00:00Z"
WITH u
MATCH (c:Company {name: "Whyline"})
MERGE (u)-[:BELONGS_TO]->(c)
```

**Run it from the shell** (single quotes protect the `$` signs in the hash):

```bash
podman exec -i whyline-falkordb redis-cli GRAPH.QUERY company \
  'MERGE (c:Company {name: "Whyline"}) ON CREATE SET c.id = "comp_whyline", c.created_at = "2026-10-01T00:00:00Z"'

podman exec -i whyline-falkordb redis-cli GRAPH.QUERY company \
  'MERGE (u:User {email: "<ADMIN_EMAIL>"}) ON CREATE SET u.id = "usr_admin_01", u.username = "<ADMIN_USERNAME>", u.password_hash = "<BCRYPT_HASH>", u.role = "admin", u.company = "Whyline", u.approval_status = "approved", u.is_verified = true, u.created_at = "2026-10-01T00:00:00Z" WITH u MATCH (c:Company {name: "Whyline"}) MERGE (u)-[:BELONGS_TO]->(c)'
```

---

## 4. Seed Sample Data (Optional)

This creates a demo tenant with two microservices, an engineer, a decision record, a ticket, a thread and an RFC, all connected. Useful for testing the AI chat and decision tracing.

Run each statement as its own `GRAPH.QUERY` call.

```cypher
// Tenant company
MERGE (c:Company {name: "Acme Technologies"})
ON CREATE SET c.id = "comp_acme", c.created_at = "2026-10-01T00:00:00Z"

// Microservices
MERGE (s1:System {id: "sys_auth"})
ON CREATE SET s1.name = "auth-service", s1.criticality = 5, s1.aliases = "oauth, sso, authentication"

MERGE (s2:System {id: "sys_billing"})
ON CREATE SET s2.name = "billing-api", s2.criticality = 4, s2.aliases = "payments, stripe, checkout"

// Engineer
MERGE (p1:Person {id: "usr_alice"})
ON CREATE SET p1.name = "Alice Chen", p1.role = "Staff Infrastructure Engineer", p1.active = true

// Decision record
MERGE (d1:Decision {id: "DEC-101"})
ON CREATE SET d1.title = "Migrate Authentication to OAuth2 & JWT",
              d1.summary = "Replaced legacy session cookie store with stateless JWT tokens to support microservice scaling.",
              d1.date = "2026-09-15",
              d1.status = "Implemented",
              d1.aliases = "auth migration, jwt switch"

// Ticket
MERGE (tk1:Ticket {id: "TICK-2001"})
ON CREATE SET tk1.title = "Implement JWT validation middleware in billing-api",
              tk1.description = "Update billing-api to validate incoming Bearer tokens from auth-service.",
              tk1.url = "https://jira.acme.corp/browse/TICK-2001",
              tk1.priority = "P1",
              tk1.status = "Closed",
              tk1.company = "Acme Technologies",
              tk1.created_by = "usr_alice",
              tk1.created_at = "2026-09-16T10:00:00Z"

// Thread
MERGE (th1:Thread {id: "TH-3001"})
ON CREATE SET th1.channel = "#arch-decisions",
              th1.excerpt = "Consensus reached: JWT with RS256 signing allows independent verification without database hit."

// RFC document
MERGE (doc1:Document {id: "DOC-4001"})
ON CREATE SET doc1.title = "RFC 42: Modern Authentication Architecture",
              doc1.url = "https://wiki.acme.corp/rfc-42-auth"
```

Then connect them (one statement each):

```cypher
MATCH (p:Person {id: "usr_alice"}), (d:Decision {id: "DEC-101"}) MERGE (p)-[:DECIDED]->(d)
MATCH (d:Decision {id: "DEC-101"}), (tk:Ticket {id: "TICK-2001"}) MERGE (d)-[:APPROVED_IN]->(tk)
MATCH (tk:Ticket {id: "TICK-2001"}), (th:Thread {id: "TH-3001"}) MERGE (tk)-[:DISCUSSED_IN]->(th)
MATCH (d:Decision {id: "DEC-101"}), (doc:Document {id: "DOC-4001"}) MERGE (d)-[:SUMMARIZED_IN]->(doc)
MATCH (d:Decision {id: "DEC-101"}), (s:System {id: "sys_auth"}) MERGE (d)-[:AFFECTS]->(s)
MATCH (dep:System {id: "sys_billing"}), (target:System {id: "sys_auth"}) MERGE (dep)-[:DEPENDS_ON]->(target)
MATCH (p:Person {id: "usr_alice"}), (s:System {id: "sys_auth"}) MERGE (p)-[:OWNS {role: "owner"}]->(s)
```

### Seed everything from `schema.cypher`

If you keep all statements in `backend/queries/schema.cypher`, run them one by one. From the project root:

```bash
# Splits on ";" and runs each non-empty statement. Remove "//" comment lines first.
grep -v '^\s*//' backend/queries/schema.cypher \
  | awk 'BEGIN{RS=";"} NF {gsub(/\n/," "); print}' \
  | while IFS= read -r stmt; do
      podman exec -i whyline-falkordb redis-cli GRAPH.QUERY company "$stmt"
    done
```

---

## 5. Run Queries and Verify

### Interactive shell

```bash
podman exec -it whyline-falkordb redis-cli
```

Inside the prompt:

```
GRAPH.QUERY company "MATCH (u:User) RETURN u.email, u.role, u.company"
GRAPH.QUERY company "MATCH (s:System) RETURN s.name, s.criticality"
GRAPH.QUERY company "CALL db.indexes()"
EXIT
```

### Useful verification queries

**Confirm the platform admin exists**

```bash
podman exec -it whyline-falkordb redis-cli GRAPH.QUERY company \
  "MATCH (u:User {role: 'admin'}) RETURN u.email, u.username, u.approval_status"
```

**Count nodes by label**

```bash
podman exec -it whyline-falkordb redis-cli GRAPH.QUERY company \
  "MATCH (n) RETURN labels(n) AS label, count(n) AS count"
```

**Trace the provenance of decision DEC-101**

```bash
podman exec -it whyline-falkordb redis-cli GRAPH.QUERY company \
  "MATCH (d:Decision {id: 'DEC-101'}) OPTIONAL MATCH (p:Person)-[:DECIDED]->(d) OPTIONAL MATCH (d)-[:APPROVED_IN]->(t:Ticket) RETURN d.title, p.name, t.title"
```

### Web UI

Open **http://localhost:3001** to explore and query the `company` graph visually.

> If the UI still shows a label after you delete its nodes, run a query to check the real data. The UI can show stale metadata.

---

## 6. Configure Environment Variables

### Backend: `backend/.env`

```bash
cp backend/.env.example backend/.env
```

```env
# Server
PORT=8080

# Security (required). Generate long random values, e.g.: openssl rand -hex 32
JWT_SECRET=<RANDOM_SECRET>
JWT_EXPIRY=24h
ADMIN_SECRET=<RANDOM_SECRET>

# FalkorDB (local Podman/Docker)
FALKORDB_HOST=localhost
FALKORDB_PORT=6379
FALKORDB_USERNAME=
FALKORDB_PASSWORD=
FALKORDB_GRAPH=company
FALKORDB_TLS=false

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Google Gemini (required for AI chat and GraphRAG)
GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>
GEMINI_MODEL=<MODEL_NAME>   # use a model name listed in Google AI Studio

# Email OTP (Gmail SMTP, used for registration)
APP_EMAIL=<YOUR_EMAIL>@gmail.com
APP_PASSWORD=<GMAIL_16_CHAR_APP_PASSWORD>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
OTP_EXPIRY=10m
```

> **Using a cloud-hosted FalkorDB instead?** Set `FALKORDB_HOST`, `FALKORDB_PORT`, `FALKORDB_USERNAME` and `FALKORDB_PASSWORD` from your provider's dashboard, and set `FALKORDB_TLS=true` if it requires TLS. Double-check which instance you are connected to before running any destructive query.

### Frontend: `frontend/.env.local`

```bash
cp frontend/.env.example frontend/.env.local
```

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

> Never commit `.env` or `.env.local`. Make sure both are in `.gitignore`.

---

## 7. Run the Backend (Go)

```bash
cd backend
go mod download
go run main.go
```

To build and run a production binary instead:

```bash
go build -o bin/whyline-backend main.go
./bin/whyline-backend
```

Check health:

```bash
curl -s http://localhost:8080/health
# Expected: {"status":"ok","service":"whyline-backend","graph":"connected"}
```

---

## 8. Run the Frontend (Next.js)

```bash
cd frontend
bun install        # or: npm install
bun run dev        # or: npm run dev
```

| What | URL |
|---|---|
| User interface | http://localhost:3000 |
| Platform admin console | http://localhost:3000/admin |

Sign in to the admin console with the email and password you chose in section 3.

---

## 9. Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| `dial tcp 127.0.0.1:6379: connect: connection refused` | FalkorDB container is not running | `podman start whyline-falkordb` (or `docker start ...`) |
| `permission denied` on the volume (Podman) | SELinux label missing | Add `:Z` to the volume: `-v falkordb_data:/var/lib/falkordb/data:Z` |
| `[FATAL] JWT_SECRET environment variable is required` | `backend/.env` is missing or empty | Copy `backend/.env.example` to `backend/.env` and set `JWT_SECRET` |
| 401 / invalid admin credentials | Admin node not created, or hash mismatch | Re-run the admin query in section 3.3 and confirm the hash was generated from the password you are typing |
| CORS blocked in the browser | Origin not allowed | Add `http://localhost:3000` to `CORS_ALLOWED_ORIGINS` in `backend/.env` |
| Port 6379 already in use | Another Redis/FalkorDB is running | Find it with `ss -tulpn \| grep 6379`, stop it, or map a different host port |
| Graph resets after restart | No volume mounted | Make sure the `-v falkordb_data:...` flag is in your run command |