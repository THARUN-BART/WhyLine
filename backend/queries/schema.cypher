// ============================================================================
// Whyline: Schema & Initial Graph Creation Queries
// Database: FalkorDB (OpenCypher)
// Graph Name: company
//
// In FalkorDB (Graph Database), there are no SQL "TABLES".
// Instead, the schema consists of:
//   1. Schema Indexes (Fast lookups for authentication, tickets, systems)
//   2. Nodes (Entities: Company, User, Person, System, Decision, Ticket, etc.)
//   3. Edges (Relationships: BELONGS_TO, DECIDED, APPROVED_IN, DEPENDS_ON, etc.)
// ============================================================================

// ----------------------------------------------------------------------------
// 1. Schema Index Creation Queries (Run once on database initialization)
// ----------------------------------------------------------------------------

// Index Users for fast authentication and profile lookup
CREATE INDEX FOR (u:User) ON (u.email);
CREATE INDEX FOR (u:User) ON (u.username);
CREATE INDEX FOR (u:User) ON (u.id);

// Index Companies for multi-tenant isolation
CREATE INDEX FOR (c:Company) ON (c.name);
CREATE INDEX FOR (c:Company) ON (c.id);

// Index Engineering Tickets
CREATE INDEX FOR (t:Ticket) ON (t.id);

// Index Architecture Decisions (ADRs)
CREATE INDEX FOR (d:Decision) ON (d.id);

// Index Software Systems & Microservices
CREATE INDEX FOR (s:System) ON (s.id);
CREATE INDEX FOR (s:System) ON (s.name);

// Index People & Engineers
CREATE INDEX FOR (p:Person) ON (p.id);

// Verify all indexes are operational:
// CALL db.indexes();


// ----------------------------------------------------------------------------
// 2. Base Node Creation Structure
// ----------------------------------------------------------------------------

// Create Company Node
CREATE (c:Company {
    id: "comp_acme",
    name: "Acme Technologies",
    created_at: "2026-10-01T00:00:00Z"
});

// Create Platform Administrator Node
CREATE (admin:User {
    id: "usr_admin_01",
    email: "whylineadmin@gmail.com",
    username: "whylineadmin",
    password_hash: "$2a$10$aSYctBveFCoPvRytMoiG5.VsXelUmY1izZbiXq8o/NNlL8H19MAAe", // Tharun@2304
    role: "admin",
    company: "Whyline",
    approval_status: "approved",
    is_verified: true,
    created_at: "2026-10-01T00:00:00Z"
});

// Create Systems / Microservices Nodes
CREATE (s1:System {
    id: "sys_auth",
    name: "auth-service",
    criticality: 5,
    aliases: "oauth, sso, authentication"
});

CREATE (s2:System {
    id: "sys_billing",
    name: "billing-api",
    criticality: 4,
    aliases: "payments, stripe, checkout"
});

// Create Person / Engineer Node
CREATE (p1:Person {
    id: "usr_alice",
    name: "Alice Chen",
    role: "Staff Infrastructure Engineer",
    active: true
});

// Create Architecture Decision Record (ADR)
CREATE (d1:Decision {
    id: "DEC-101",
    title: "Migrate Authentication to OAuth2 & JWT",
    summary: "Replaced legacy session cookie store with stateless JWT tokens to support microservice scaling.",
    date: "2026-09-15",
    status: "Implemented",
    aliases: "auth migration, jwt switch"
});

// Create Engineering Ticket
CREATE (tk1:Ticket {
    id: "TICK-2001",
    title: "Implement JWT validation middleware in billing-api",
    description: "Update billing-api to validate incoming Bearer tokens from auth-service.",
    url: "https://jira.acme.corp/browse/TICK-2001",
    priority: "P1",
    status: "Closed",
    company: "Acme Technologies",
    created_by: "usr_alice",
    created_at: "2026-09-16T10:00:00Z"
});

// Create Discussion Thread
CREATE (th1:Thread {
    id: "TH-3001",
    channel: "#arch-decisions",
    excerpt: "Consensus reached: JWT with RS256 signing allows independent verification without database hit."
});

// Create Documentation
CREATE (doc1:Document {
    id: "DOC-4001",
    title: "RFC 42: Modern Authentication Architecture",
    url: "https://wiki.acme.corp/rfc-42-auth"
});


// ----------------------------------------------------------------------------
// 3. Core Graph Relationships (Edges) Creation
// ----------------------------------------------------------------------------

// User belongs to Company
MATCH (u:User {id: "usr_admin_01"}), (c:Company {name: "Whyline"})
MERGE (u)-[:BELONGS_TO]->(c);

// Person decided Architecture Decision
MATCH (p:Person {id: "usr_alice"}), (d:Decision {id: "DEC-101"})
MERGE (p)-[:DECIDED]->(d);

// Decision was approved in Ticket
MATCH (d:Decision {id: "DEC-101"}), (tk:Ticket {id: "TICK-2001"})
MERGE (d)-[:APPROVED_IN]->(tk);

// Ticket was discussed in Thread
MATCH (tk:Ticket {id: "TICK-2001"}), (th:Thread {id: "TH-3001"})
MERGE (tk)-[:DISCUSSED_IN]->(th);

// Decision is summarized in Document
MATCH (d:Decision {id: "DEC-101"}), (doc:Document {id: "DOC-4001"})
MERGE (d)-[:SUMMARIZED_IN]->(doc);

// Decision affects System
MATCH (d:Decision {id: "DEC-101"}), (s:System {id: "sys_auth"})
MERGE (d)-[:AFFECTS]->(s);

// System Dependency (billing-api depends on auth-service)
MATCH (dep:System {id: "sys_billing"}), (target:System {id: "sys_auth"})
MERGE (dep)-[:DEPENDS_ON]->(target);

// Ownership (Alice Chen owns auth-service)
MATCH (p:Person {id: "usr_alice"}), (s:System {id: "sys_auth"})
MERGE (p)-[:OWNS {role: "owner"}]->(s);
