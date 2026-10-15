// ============================================================================
// Tool: trace_decision (The "Why?" Question)
// Multi-hop provenance traversal returning full context and graph path proof.
// Uses OPTIONAL MATCH so missing links (no ticket, no thread, no doc) are 
// returned as nulls and detected as "Honest Gaps" in Go.
// ============================================================================

MATCH (d:Decision {id: $id})
OPTIONAL MATCH (p:Person)-[:DECIDED]->(d)
OPTIONAL MATCH (d)-[:APPROVED_IN]->(t:Ticket)
OPTIONAL MATCH (t)-[:DISCUSSED_IN]->(th:Thread)
OPTIONAL MATCH (d)-[:SUMMARIZED_IN]->(doc:Document)
OPTIONAL MATCH (d)-[:AFFECTS]->(sys:System)
RETURN 
    d.id AS decision_id,
    d.title AS title,
    d.summary AS summary,
    d.date AS date,
    d.status AS status,
    p.id AS decider_id,
    p.name AS decider_name,
    p.role AS decider_role,
    t.id AS ticket_id,
    t.title AS ticket_title,
    t.url AS ticket_url,
    th.id AS thread_id,
    th.channel AS thread_channel,
    th.excerpt AS thread_excerpt,
    doc.id AS doc_id,
    doc.title AS doc_title,
    doc.url AS doc_url,
    sys.id AS system_id,
    sys.name AS system_name;
