// ============================================================================
// Tool: find_entity
// Searches Nodes (Decision, System, Person) by title, name, or aliases
// Used by AI Agent to map conversational user text to exact Graph Node IDs.
// ============================================================================

// 1. Search Decisions by title or aliases
MATCH (d:Decision)
WHERE toLower(d.title) CONTAINS toLower($query) 
   OR toLower(d.aliases) CONTAINS toLower($query)
RETURN 
    d.id AS id, 
    'Decision' AS label, 
    d.title AS name, 
    d.summary AS description
LIMIT 5;

// 2. Search Systems by name or aliases
MATCH (s:System)
WHERE toLower(s.name) CONTAINS toLower($query) 
   OR toLower(s.aliases) CONTAINS toLower($query)
RETURN 
    s.id AS id, 
    'System' AS label, 
    s.name AS name, 
    toString(s.criticality) AS description
LIMIT 5;

// 3. Search Persons by name or role
MATCH (p:Person)
WHERE toLower(p.name) CONTAINS toLower($query) 
   OR toLower(p.role) CONTAINS toLower($query)
RETURN 
    p.id AS id, 
    'Person' AS label, 
    p.name AS name, 
    p.role AS description
LIMIT 5;
