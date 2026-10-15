// ============================================================================
// Tool: impact_of (The "What Breaks?" Question)
// Variable-length incoming dependency traversal up to 4 hops deep.
// Follows (dependent)-[:DEPENDS_ON*1..4]->(target).
// Ranked by severity = criticality / hop_distance.
// ============================================================================

MATCH (d:Decision {id: $id})-[:AFFECTS]->(target:System)
MATCH path = (dependent:System)-[:DEPENDS_ON*1..4]->(target)
WHERE dependent <> target
RETURN 
    target.name AS changed_system,
    dependent.id AS dependent_id,
    dependent.name AS dependent_name,
    dependent.criticality AS criticality,
    length(path) AS hop_distance,
    (toFloat(dependent.criticality) / length(path)) AS severity_score,
    path
ORDER BY severity_score DESC, hop_distance ASC;