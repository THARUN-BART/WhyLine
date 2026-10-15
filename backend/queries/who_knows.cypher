// ============================================================================
// Tool: who_knows
// Weighted traversal finding people who have contributed to or worked on a system.
// Ranked by contribution score.
// ============================================================================

MATCH (p:Person)-[w:WORKED_ON]->(s:System)
WHERE toLower(s.name) = toLower($system) OR s.id = $system
RETURN 
    s.name AS system,
    p.id AS person_id,
    p.name AS person_name,
    p.role AS role,
    p.active AS is_active,
    w.contributions AS contributions
ORDER BY w.contributions DESC;
