// ============================================================================
// Queries: Ticket Creation & Architectural Provenance Linking
// Executed by: internal/ticket/service.go
// ============================================================================

// 1. Create / Merge Ticket Node with Company & Creator Metadata
// Used by POST /api/tickets
MERGE (tk:Ticket {id: $id})
SET tk.title = $title,
    tk.description = $description,
    tk.url = $url,
    tk.priority = $priority,
    tk.status = $status,
    tk.company = $company,
    tk.created_by = $created_by,
    tk.created_at = $created_at;

// 2. Link Ticket to Architectural Decision ADR
// Used when decision_id is provided in ticket creation
MATCH (d:Decision {id: $decision_id}), (tk:Ticket {id: $ticket_id})
MERGE (d)-[:APPROVED_IN]->(tk)
RETURN d.title AS decision_title;

// 3. Link Ticket to Affected System
// Used when system_id is provided in ticket creation
MATCH (s:System {id: $system_id}), (tk:Ticket {id: $ticket_id})
MERGE (tk)-[:AFFECTS]->(s)
RETURN s.name AS system_name;

// 4. Link Creator User to Ticket
MATCH (u:User {id: $user_id}), (tk:Ticket {id: $ticket_id})
MERGE (u)-[:CREATED]->(tk);

// 5. List Tickets with Linked Decision and Affected System
// Used by GET /api/tickets
MATCH (t:Ticket)
OPTIONAL MATCH (d:Decision)-[:APPROVED_IN]->(t)
OPTIONAL MATCH (t)-[:AFFECTS]->(s:System)
RETURN t.id AS id, t.title AS title, t.description AS description, t.url AS url,
       t.priority AS priority, t.status AS status, t.company AS company,
       t.created_by AS created_by, t.created_at AS created_at,
       d.id AS decision_id, d.title AS decision_title,
       s.id AS system_id, s.name AS system_name;

// 6. Get Ticket by ID with Full Provenance
// Used by GET /api/tickets/{id}
MATCH (t:Ticket {id: $id})
OPTIONAL MATCH (d:Decision)-[:APPROVED_IN]->(t)
OPTIONAL MATCH (t)-[:AFFECTS]->(s:System)
RETURN t.id AS id, t.title AS title, t.description AS description, t.url AS url,
       t.priority AS priority, t.status AS status, t.company AS company,
       t.created_by AS created_by, t.created_at AS created_at,
       d.id AS decision_id, d.title AS decision_title,
       s.id AS system_id, s.name AS system_name;
