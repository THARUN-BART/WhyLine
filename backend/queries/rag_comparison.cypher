// ==============================================================================
// Whyline: Module 7 Vs-RAG Baseline Comparison Cypher Queries
// Graph: company
//
// These Cypher queries power the Graph side of the split-screen comparison,
// demonstrating why FalkorDB graph traversals outperform Vector RAG
// on multi-hop blast radius, orphaned system detection, and honest gap proofs.
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. Multi-Hop Blast Radius Traversal (Beats Vector RAG on "What breaks if we reverse billing?")
// Vector RAG only retrieves text mentioning monolith issues.
// FalkorDB traverses variable-length dependency chains to find all affected systems.
// ------------------------------------------------------------------------------
MATCH (target:System {id: 'sys_billing'})
MATCH path = (dependent:System)-[:DEPENDS_ON*1..4]->(target)
WITH dependent,
     min(length(path)) AS hops,
     dependent.criticality AS crit,
     nodes(path) AS path_nodes
ORDER BY crit DESC, hops ASC
RETURN dependent.id AS system_id,
       dependent.name AS system_name,
       crit,
       hops,
       [n IN path_nodes | n.name] AS proof_path;

// ------------------------------------------------------------------------------
// 2. Bus Factor & Orphaned System Detection (Beats Vector RAG on "Who maintains ledger?")
// Vector RAG reads old docs citing Dave Miller without checking employment state.
// FalkorDB checks (active: false) and calculates true Bus Factor risk score.
// ------------------------------------------------------------------------------
MATCH (s:System {id: 'sys_ledger'})
OPTIONAL MATCH (s)<-[:OWNS]-(activeOwner:Person {active: true})
OPTIONAL MATCH (s)<-[:OWNS]-(departedOwner:Person {active: false})
OPTIONAL MATCH (dependent:System)-[:DEPENDS_ON*1..4]->(s)
WITH s,
     count(DISTINCT activeOwner) AS active_owners,
     collect(DISTINCT departedOwner.name) AS departed_owners,
     count(DISTINCT dependent) AS transitive_dependents
RETURN s.id AS system_id,
       s.name AS system_name,
       s.criticality AS criticality,
       active_owners,
       departed_owners,
       transitive_dependents,
       CASE 
         WHEN active_owners = 0 AND transitive_dependents > 0 THEN 'ORPHANED'
         WHEN active_owners = 1 THEN 'AT_RISK'
         ELSE 'HEALTHY'
       END AS bus_factor_status,
       (s.criticality * (transitive_dependents + 1) * 1.0) / 
       (CASE WHEN active_owners = 0 THEN 0.5 ELSE active_owners END) AS risk_score;

// ------------------------------------------------------------------------------
// 3. Honest Provenance Gap Proof (Beats Vector RAG on "Where is the RFC for Protobuf?")
// Vector RAG cites Jira/Slack and hallucinates RFC existence.
// FalkorDB explicitly proves absence of (:Document) node.
// ------------------------------------------------------------------------------
MATCH (d:Decision {id: 'dec_gap_no_doc'})
OPTIONAL MATCH (d)-[:RECORDED_IN]->(t:Ticket)
OPTIONAL MATCH (d)-[:DISCUSSED_IN]->(th:Thread)
OPTIONAL MATCH (d)-[:SUMMARIZED_IN]->(doc:Document)
RETURN d.id AS decision_id,
       d.title AS title,
       t.id AS ticket_id,
       th.id AS thread_id,
       doc.id AS doc_id,
       CASE WHEN doc IS NULL THEN 'DOC_MISSING' ELSE 'COMPLETE' END AS provenance_gap;
