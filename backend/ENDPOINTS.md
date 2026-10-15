# Whyline Backend API Reference & Endpoints

Base URL: `http://localhost:8080`

All endpoints return and accept JSON unless specified otherwise (e.g. SSE stream).

---

## Table of Contents
1. [Health & Diagnostics](#1-health--diagnostics)
2. [Authentication & Users (`/api/auth`)](#2-authentication--users-apiauth)
3. [Company Management & Approval Flow (`/api/auth/company`)](#3-company-management--approval-flow-apiauthcompany)
4. [Engineering Tickets API (`/api/tickets`)](#4-engineering-tickets-api-apitickets)
5. [FalkorDB Graph Operations (`/api/graph`)](#5-falkordb-graph-operations-apigraph)
6. [Synthetic Data Seeding (`/api/seed`)](#6-synthetic-data-seeding-apiseed)
7. [Graph Query Tools Layer (`/api/tools`)](#7-graph-query-tools-layer-apitools)
8. [Per-User Memory Graph (`/api/memory`)](#8-per-user-memory-graph-apimemory)
9. [Google Gemini Agent & SSE Stream (`/api/agent`)](#9-google-gemini-agent--sse-stream-apiagent)
10. [Vs-RAG Baseline Comparison (`/api/rag`)](#10-vs-rag-baseline-comparison-apirag)

---

## 1. Health & Diagnostics

### `GET /health`
Returns the status of the Whyline server and FalkorDB connection.
```bash
curl -s http://localhost:8080/health
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "service": "whyline-backend",
  "graph": "connected"
}
```

### `GET /api/protected-ping`
Test endpoint to verify Bearer JWT authentication and company approval.
```bash
curl -s http://localhost:8080/api/protected-ping \
  -H "Authorization: Bearer <JWT_TOKEN>"
```
**Response (200 OK):**
```json
{
  "message": "pong",
  "authenticated_user_id": "usr_alice",
  "company": "Acme Technologies",
  "approval_status": "approved"
}
```

### `GET /api/dashboard/status`
Checks if the authenticated caller has access to the application dashboard.
- If user registration is **pending**, returns `403 Forbidden` (`{"error":"forbidden: your registration is pending approval by your company administrator"}`).
- If user is **approved** (or platform/company admin), returns `200 OK`.
```bash
curl -s http://localhost:8080/api/dashboard/status \
  -H "Authorization: Bearer <JWT_TOKEN>"
```
**Response (200 OK):**
```json
{
  "status": "approved",
  "message": "Dashboard access granted",
  "company": "Acme Technologies"
}
```

---

## 2. Authentication & Users (`/api/auth`)

Users are stored directly as `(:User)` nodes in FalkorDB with bcrypt-hashed passwords.

### `POST /api/auth/send-otp`
Sends a 6-digit verification code to the given email via Gmail SMTP.
```bash
curl -s -X POST http://localhost:8080/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"engineer@company.com"}'
```
**Response (200 OK):**
```json
{
  "message": "OTP verification code sent to your email"
}
```

### `POST /api/auth/verify-otp`
Validates the OTP code without registering.
```bash
curl -s -X POST http://localhost:8080/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"engineer@company.com","otp":"123456"}'
```
**Response (200 OK):**
```json
{
  "message": "OTP verified successfully"
}
```

### `POST /api/auth/register`
Creates a new employee account in FalkorDB. Registration defaults to `"approval_status": "pending"` until approved by the company's main administrator.
```bash
curl -s -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "engineer@company.com",
    "username": "janedoe",
    "company": "Acme Technologies",
    "password": "Password123!"
  }'
```
**Response (201 Created):**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "usr_c48a19b2",
    "email": "engineer@company.com",
    "username": "janedoe",
    "company": "Acme Technologies",
    "role": "user",
    "approval_status": "pending",
    "is_verified": false,
    "created_at": "2026-10-13T12:00:00Z"
  }
}
```

### Direct Admin Insertion in FalkorDB (Falcon)
Administrators can be inserted directly into the FalkorDB database without requiring hardcoded code credentials:
```cypher
MERGE (u:User {email: 'whylineadmin@gmail.com'})
SET u.id = 'usr_whylineadmin_gmail.com',
    u.username = 'whylineadmin@gmail.com',
    u.password = 'Tharun@29112304',
    u.role = 'admin',
    u.company = 'Whyline',
    u.approval_status = 'approved',
    u.is_verified = true
WITH u
MERGE (c:Company {name: 'Whyline'})
MERGE (u)-[:BELONGS_TO]->(c);
```

### `POST /api/auth/login`
Authenticates user and returns JWT token. Supports direct database admins with either plaintext password or bcrypt hash.
```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"whylineadmin@gmail.com","password":"Tharun@29112304"}'
```
**Response (200 OK):**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "usr_whylineadmin_gmail.com",
    "email": "whylineadmin@gmail.com",
    "username": "whylineadmin@gmail.com",
    "company": "Whyline",
    "role": "admin",
    "approval_status": "approved",
    "is_verified": true,
    "created_at": "2026-10-13T12:00:00Z"
  }
}
```

### `GET /api/auth/me`
Fetches currently authenticated user profile including `approval_status`.
```bash
curl -s http://localhost:8080/api/auth/me \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### `GET /api/auth/companies`
Returns all registered companies with user counts. Used by Frontend during signup so users can select only from available organizations created by an admin.
```bash
curl -s http://localhost:8080/api/auth/companies
```
**Response (200 OK):**
```json
{
  "total": 3,
  "companies": [
    { "id": "comp_acme", "name": "Acme Technologies", "user_count": 5, "created_at": "2026-10-10T18:00:00Z" },
    { "id": "comp_stripe", "name": "Stripe", "user_count": 3, "created_at": "2026-10-10T18:00:00Z" },
    { "id": "comp_whyline", "name": "Whyline", "user_count": 1, "created_at": "2026-10-10T18:00:00Z" }
  ]
}
```

### `POST /api/auth/admin/register`
Registers a new Administrator with username, password, email, and admin secret key.
```bash
curl -s -X POST http://localhost:8080/api/auth/admin/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@whyline.dev",
    "username": "sysadmin",
    "password": "AdminPassword123!",
    "admin_secret": "whyline-admin-secret-2026"
  }'
```

### `POST /api/auth/companies` *(Admin Only)*
Adds a new company to FalkorDB. Only accessible with a valid Bearer JWT of an account having `"role": "admin"`.
```bash
curl -s -X POST http://localhost:8080/api/auth/companies \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "NovaTech"}'
```

### `GET /api/auth/users`
Returns registered users with company affiliations.
```bash
curl -s http://localhost:8080/api/auth/users
```

---

## 3. Company Management & Approval Flow (`/api/auth/company`)

### `POST /api/auth/admin/create-user` *(Platform Admin Only)*
Platform admin creates a company and its initial company administrator (`company_admin`).
```bash
curl -s -X POST http://localhost:8080/api/auth/admin/create-user \
  -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "NovaTech",
    "email": "lead@novatech.io",
    "username": "nova_lead",
    "password": "NovaPassword123!",
    "role": "company_admin"
  }'
```
**Response (201 Created):**
```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "usr_93dbf3b1",
    "email": "lead@novatech.io",
    "username": "nova_lead",
    "company": "NovaTech",
    "role": "company_admin",
    "approval_status": "approved",
    "is_verified": true,
    "created_at": "2026-10-13T12:00:00Z"
  }
}
```

### `GET /api/auth/company/stats` *(Company Admin / Admin)*
Fetches company employee metrics for the caller's company alone. Company admins are strictly isolated to their own company.
```bash
curl -s http://localhost:8080/api/auth/company/stats \
  -H "Authorization: Bearer <COMPANY_ADMIN_TOKEN>"
```
**Response (200 OK):**
```json
{
  "company": "NovaTech",
  "user_count": 2,
  "approved_count": 1,
  "pending_count": 1,
  "rejected_count": 0
}
```

### `GET /api/auth/company/employees` *(Company Admin / Admin)*
Lists employees belonging to the caller's company, with optional status filter (`?status=pending` or `?status=approved`).
```bash
curl -s "http://localhost:8080/api/auth/company/employees?status=pending" \
  -H "Authorization: Bearer <COMPANY_ADMIN_TOKEN>"
```
**Response (200 OK):**
```json
{
  "total": 1,
  "employees": [
    {
      "id": "3eccc525-92b1-443c-bbcf-64e19db90322",
      "email": "dave@novatech.io",
      "username": "dave_dev",
      "company": "NovaTech",
      "role": "user",
      "approval_status": "pending",
      "is_verified": true,
      "created_at": "2026-10-13T12:00:00Z"
    }
  ]
}
```

### `POST /api/auth/company/approve-user` *(Company Admin / Admin)*
Approves or rejects an employee registration. Once approved, the employee can immediately access the dashboard and data graph.
```bash
curl -s -X POST http://localhost:8080/api/auth/company/approve-user \
  -H "Authorization: Bearer <COMPANY_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "3eccc525-92b1-443c-bbcf-64e19db90322",
    "status": "approved"
  }'
```
**Response (200 OK):**
```json
{
  "message": "User status updated to approved",
  "user": {
    "id": "3eccc525-92b1-443c-bbcf-64e19db90322",
    "email": "dave@novatech.io",
    "username": "dave_dev",
    "company": "NovaTech",
    "role": "user",
    "approval_status": "approved",
    "is_verified": true,
    "created_at": "2026-10-13T12:00:00Z"
  }
}
```

---

## 4. Engineering Tickets API (`/api/tickets`)

Full provenance engineering issue tracker linking Jira tickets directly to architectural decisions (`(:Decision)-[:APPROVED_IN]->(:Ticket)`), affected systems (`(:Ticket)-[:AFFECTS]->(:System)`), and users (`(:User)-[:CREATED]->(:Ticket)`). Requires valid JWT and approved user status.

### `POST /api/tickets`
Creates an engineering ticket in FalkorDB.
```bash
curl -s -X POST http://localhost:8080/api/tickets \
  -H "Authorization: Bearer <APPROVED_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "NOVA-101: Migrate Payment Gateway to Async Webhooks",
    "description": "Establish idempotent webhook receiver for credit card authorizations.",
    "url": "https://jira.novatech.io/browse/NOVA-101",
    "priority": "P0",
    "decision_id": "dec_billing_v2",
    "system_id": "sys_billing"
  }'
```
**Response (201 Created):**
```json
{
  "id": "TICK-7286",
  "title": "NOVA-101: Migrate Payment Gateway to Async Webhooks",
  "description": "Establish idempotent webhook receiver for credit card authorizations.",
  "url": "https://jira.novatech.io/browse/NOVA-101",
  "priority": "P0",
  "status": "Open",
  "company": "NovaTech",
  "created_by": "3eccc525-92b1-443c-bbcf-64e19db90322",
  "created_at": "2026-10-13T12:00:00Z",
  "decision_id": "dec_billing_v2",
  "decision_title": "Move billing off legacy monolith to billing-api",
  "system_id": "sys_billing",
  "system_name": "billing-api"
}
```

### `GET /api/tickets`
Lists all tickets with linked Decision ADR and System metadata. Scoped to caller's company (platform admins can view all).
```bash
curl -s http://localhost:8080/api/tickets \
  -H "Authorization: Bearer <APPROVED_JWT_TOKEN>"
```
**Response (200 OK):**
```json
{
  "total": 8,
  "tickets": [
    {
      "id": "TICK-7286",
      "title": "NOVA-101: Migrate Payment Gateway to Async Webhooks",
      "description": "Establish idempotent webhook receiver for credit card authorizations.",
      "url": "https://jira.novatech.io/browse/NOVA-101",
      "priority": "P0",
      "status": "Open",
      "company": "NovaTech",
      "created_by": "3eccc525-92b1-443c-bbcf-64e19db90322",
      "created_at": "2026-10-13T12:00:00Z",
      "decision_id": "dec_billing_v2",
      "decision_title": "Move billing off legacy monolith to billing-api"
    }
  ]
}
```

### `GET /api/tickets/{id}`
Fetches a single engineering ticket by ID with complete provenance links.
```bash
curl -s http://localhost:8080/api/tickets/TICK-7286 \
  -H "Authorization: Bearer <APPROVED_JWT_TOKEN>"
```

### `PUT /api/tickets/{id}`
Updates an engineering ticket's status, priority, or description.
```bash
curl -s -X PUT http://localhost:8080/api/tickets/TICK-7286 \
  -H "Authorization: Bearer <APPROVED_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Resolved",
    "priority": "P1"
  }'
```

---

## 5. FalkorDB Graph Operations (`/api/graph`)

### `GET /api/graph/stats`
Returns node count, edge count, and label breakdown for the knowledge graph.
```bash
curl -s http://localhost:8080/api/graph/stats
```
**Response (200 OK):**
```json
{
  "graph_name": "company",
  "node_count": 68,
  "edge_count": 58,
  "labels": ["Decision", "Document", "Person", "System", "Team", "Thread", "Ticket", "User"]
}
```

### `POST /api/graph/query`
Executes raw Cypher queries directly against FalkorDB.
```bash
curl -s -X POST http://localhost:8080/api/graph/query \
  -H "Content-Type: application/json" \
  -d '{"query":"MATCH (s:System) RETURN s.id AS id, s.name AS name, s.criticality AS crit LIMIT 3"}'
```

### `POST /api/graph/reset`
Drops the entire graph.
```bash
curl -s -X POST http://localhost:8080/api/graph/reset
```

---

## 6. Synthetic Data Seeding (`/api/seed`)

### `POST /api/seed/load`
Idempotently loads 68 nodes, 58 edges, and deliberate architectural edge cases (honest gaps, departed owners, orphaned services).
```bash
curl -s -X POST http://localhost:8080/api/seed/load
```
**Response (200 OK):**
```json
{
  "message": "Graph successfully seeded",
  "nodes_created": 68,
  "edges_created": 58
}
```

### `POST /api/seed/reset`
Clears graph nodes without reseeding.
```bash
curl -s -X POST http://localhost:8080/api/seed/reset
```

---

## 7. Graph Query Tools Layer (`/api/tools`)

These tools are invoked deterministically by the Gemini Agent or called directly by the UI.

### `GET /api/tools/find-entity?q={query}`
Fuzzy multi-entity resolver matching names, aliases, titles, and IDs.
```bash
curl -s "http://localhost:8080/api/tools/find-entity?q=billing"
```
**Response (200 OK):**
```json
[
  { "id": "dec_billing_v2", "label": "Decision", "name": "Move billing off legacy monolith to billing-api" },
  { "id": "sys_billing", "label": "System", "name": "billing-api", "description": "9" }
]
```

### `GET /api/tools/trace-decision?id={decision_id}`
Multi-hop provenance traversal returning decider, ticket, thread, RFC document, and Honest Gap level.
```bash
curl -s "http://localhost:8080/api/tools/trace-decision?id=dec_billing_v2"
```
**Response (200 OK):**
```json
{
  "decision_id": "dec_billing_v2",
  "title": "Move billing off legacy monolith to billing-api",
  "date": "2025-06-12",
  "status": "approved",
  "decider_name": "Alice Smith",
  "decider_role": "Principal Architect",
  "ticket_title": "PROV-1042: Extract billing to dedicated microservice",
  "thread_channel": "#eng-billing-war-room",
  "thread_excerpt": "Legacy monolith dropped 4% of checkout transactions...",
  "document_title": "RFC-101: Billing Architecture & Service Boundary Isolation",
  "gap_level": "NONE",
  "missing_link": ""
}
```
*Honest Gap Example:* `?id=dec_gap_no_doc` returns `"gap_level": "DOC_MISSING"`.

### `GET /api/tools/impact-of?id={decision_id}`
Follows variable-length incoming `[:DEPENDS_ON*1..4]` edges, ranking affected systems by severity ($\text{criticality} / \text{hop}$).
```bash
curl -s "http://localhost:8080/api/tools/impact-of?id=dec_billing_v2"
```
**Response (200 OK):**
```json
{
  "decision_id": "dec_billing_v2",
  "changed_system": "billing-api",
  "impacted_systems": [
    { "system_id": "sys_checkout", "system_name": "checkout-service", "criticality": 8, "hop_distance": 1, "severity_score": 8.0 },
    { "system_id": "sys_order", "system_name": "order-service", "criticality": 7, "hop_distance": 1, "severity_score": 7.0 },
    { "system_id": "sys_inventory", "system_name": "inventory-service", "criticality": 7, "hop_distance": 2, "severity_score": 3.5 },
    { "system_id": "sys_analytics", "system_name": "analytics-pipeline", "criticality": 5, "hop_distance": 2, "severity_score": 2.5 }
  ]
}
```

### `GET /api/tools/who-knows?system={system_name}`
Identifies subject matter experts and ownership status based on weighted contributions.
```bash
curl -s "http://localhost:8080/api/tools/who-knows?system=ledger-service"
```
**Response (200 OK):**
```json
{
  "system_name": "ledger-service",
  "contributors": [
    { "person_id": "usr_dave", "name": "Dave Miller", "role": "Former Staff Engineer", "is_active": false, "contributions": 3 }
  ]
}
```

### `GET /api/tools/bus-factor`
Returns company-wide bus factor analysis, flagging orphaned systems ($active = 0$) and high-risk single-owner systems.
```bash
curl -s "http://localhost:8080/api/tools/bus-factor"
```
**Response (200 OK):**
```json
{
  "total_systems": 10,
  "orphaned_systems": [
    {
      "system_id": "sys_ledger",
      "system_name": "ledger-service",
      "criticality": 10,
      "active_owners": 0,
      "departed_owners": 1,
      "transitive_dependents": 5,
      "risk_score": 100.0,
      "status": "ORPHANED"
    }
  ]
}
```

---

## 8. Per-User Memory Graph (`/api/memory`)

Stores questions and simulated architecture changes in isolated per-user subgraphs `memory_<user_id>`.

### `GET /api/memory`
Recalls past questions and simulated changes for the current user.
```bash
curl -s http://localhost:8080/api/memory \
  -H "X-User-ID: usr_alice"
```
*(Also accepts `Authorization: Bearer <JWT_TOKEN>`)*

### `POST /api/memory/save`
Saves an interaction to user memory.
```bash
curl -s -X POST http://localhost:8080/api/memory/save \
  -H "X-User-ID: usr_alice" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What breaks if we reverse billing?",
    "entity_id": "dec_billing_v2",
    "entity_type": "Decision"
  }'
```

### `POST /api/memory/simulate`
Simulates proposed architectural dependency changes and computes delta diff (`diff_added`, `diff_removed`).
```bash
curl -s -X POST http://localhost:8080/api/memory/simulate \
  -H "X-User-ID: usr_alice" \
  -H "Content-Type: application/json" \
  -d '{
    "system_id": "sys_billing",
    "action": "add_dependency",
    "new_dependency_id": "sys_auth"
  }'
```

### `POST /api/memory/reset`
Clears the user's isolated memory graph.
```bash
curl -s -X POST http://localhost:8080/api/memory/reset \
  -H "X-User-ID: usr_alice"
```

---

## 9. Google Gemini Agent & SSE Stream (`/api/agent`)

Powered by `gemini-3.8-flash` with multi-turn tool calling, anti-hallucination ID validation, and deterministic offline fallback.

### `POST /api/agent/chat` (Standard JSON)
```bash
curl -s -X POST http://localhost:8080/api/agent/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What breaks if we reverse moving billing off the monolith?",
    "user_id": "usr_alice"
  }'
```
**Response (200 OK):**
```json
{
  "answer": "Reversing the decision to move billing off the monolith (dec_billing_v2)...",
  "steps": [
    { "type": "tool_call", "name": "find_entity", "input": {"query": "billing"} },
    { "type": "tool_call", "name": "impact_of", "input": {"decision_id": "dec_billing_v2"} }
  ],
  "cited_node_ids": ["dec_billing_v2", "sys_billing", "sys_checkout", "sys_order"],
  "invalid_ids": null
}
```

### `POST /api/agent/chat` (Server-Sent Events / SSE Stream)
Streams thought signatures, tool calling parameters, tool outputs, and answer chunks in real-time.
```bash
curl -N -X POST http://localhost:8080/api/agent/chat \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Who maintains ledger-service and what is our risk?",
    "user_id": "usr_alice"
  }'
```
**Stream Events:**
```
event: step
data: {"type":"thought","content":"User is inquiring about ledger-service maintainers and risk."}

event: step
data: {"type":"tool_call","name":"bus_factor","input":{"system_id":"sys_ledger"}}

event: step
data: {"type":"tool_result","name":"bus_factor","output":{...}}

event: done
data: {"answer":"ledger-service is ORPHANED with Risk Score 100...","cited_node_ids":["sys_ledger","usr_dave"]}
```

---

## 10. Vs-RAG Baseline Comparison (`/api/rag`)

Demonstrates Whyline's split-screen: Naive Vector RAG vs FalkorDB Graph Agent.

### `GET /api/rag/chunks`
Lists all 36 indexed chunks with source types (`Ticket`, `Thread`, `Document`, `Decision`).
```bash
curl -s http://localhost:8080/api/rag/chunks | jq '{total, sample: .chunks[0]}'
```

### `GET /api/rag/presets`
Returns curated benchmark comparison questions.
```bash
curl -s http://localhost:8080/api/rag/presets
```
**Presets Available:**
1. `preset_blast_radius`: Multi-Hop Change Impact (The Blast Radius Trap)
2. `preset_direct_provenance`: Single-Hop Rationale (Direct Keyword Retrieval)
3. `preset_bus_factor`: Orphaned System & Departed Owner Risk
4. `preset_honest_gap`: Honest Gap Detection (Missing Architecture Document)

### `POST /api/rag/search`
Pure vector similarity search over text chunks.
```bash
curl -s -X POST http://localhost:8080/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query":"database pool exhaustion monolith dropped checkout transactions","top_k":3}'
```

### `POST /api/rag/compare`
Executes both Vector RAG and FalkorDB traversal side-by-side.
```bash
curl -s -X POST http://localhost:8080/api/rag/compare \
  -H "Content-Type: application/json" \
  -d '{"preset_id":"preset_blast_radius"}'
```
*(Also accepts custom free-form questions via `{"question": "What breaks if billing-api fails?"}`)*

**Response (200 OK):**
```json
{
  "question": "What breaks if we reverse moving billing off the monolith?",
  "category": "blast_radius",
  "verdict": "GRAPH_WIN",
  "why_graph_wins": "Vector RAG only retrieves texts containing lexical keywords ('monolith', 'billing')... FalkorDB proves the full cascading blast radius.",
  "rag": {
    "retrieved_chunks": [...],
    "answer": "Based on retrieved documents, reversing this would revert to the legacy monolith...",
    "blindspots": [
      "Completely missed dependent systems: checkout-service and order-service are at immediate risk of failure.",
      "Zero topology awareness: cannot follow incoming [:DEPENDS_ON] edges."
    ]
  },
  "graph": {
    "answer": "Whyline traced dec_billing_v2. Impacts 4 dependent systems across multi-hop edges...",
    "entities_identified": ["dec_billing_v2", "sys_billing", "sys_checkout", "sys_order"],
    "key_metrics": {
      "affected_systems_count": 4,
      "highest_criticality": 8,
      "max_hop_depth": 2
    }
  }
}
```
