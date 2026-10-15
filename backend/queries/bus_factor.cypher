// ============================================================================
// Tool: bus_factor (Knowledge Concentration & Orphaned Systems)
// Formula:
// active_owners = count(DISTINCT active Persons with OWNS edge)
// dependents = count(DISTINCT systems transitively depending on it up to 4 hops)
// risk = criticality * dependents / max(active_owners, 0.5)
// Orphaned = active_owners == 0 AND dependents > 0
// ============================================================================

// 1. Find all active and inactive owners of systems
MATCH (s:System)
OPTIONAL MATCH (active_p:Person {active: true})-[:OWNS]->(s)
OPTIONAL MATCH (inactive_p:Person {active: false})-[:OWNS]->(s)
OPTIONAL MATCH (dep:System)-[:DEPENDS_ON*1..4]->(s)
WHERE dep <> s
WITH s, 
     count(DISTINCT active_p) AS active_owners, 
     count(DISTINCT inactive_p) AS departed_owners,
     count(DISTINCT dep) AS transitive_dependents
RETURN 
    s.id AS system_id,
    s.name AS system_name,
    s.criticality AS criticality,
    active_owners,
    departed_owners,
    transitive_dependents,
    (toFloat(s.criticality) * transitive_dependents / CASE WHEN active_owners = 0 THEN 0.5 ELSE toFloat(active_owners) END) AS risk_score,
    CASE 
        WHEN active_owners = 0 AND transitive_dependents > 0 THEN 'ORPHANED'
        WHEN active_owners = 0 AND transitive_dependents = 0 THEN 'UNOWNED_NO_DEPENDENTS'
        WHEN active_owners = 1 THEN 'HIGH_RISK_SINGLE_OWNER'
        ELSE 'HEALTHY'
    END AS status
ORDER BY risk_score DESC, criticality DESC;
