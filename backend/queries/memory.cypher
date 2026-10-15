// ============================================================================
// Module: Per-User Memory Graph
// Graph Name Convention: memory_<userId>
// Structure: (:User)-[:ASKED]->(:Question)-[:ABOUT]->(:Entity {company_id})
// ============================================================================

// 1. Initialize User Node in Personal Memory Graph
MERGE (u:User {id: $user_id})
SET u.updated_at = $timestamp;

// 2. Record Asked Question and Link to Company Entities
MATCH (u:User {id: $user_id})
CREATE (q:Question {
    id: $question_id,
    text: $text,
    timestamp: $timestamp
})
CREATE (u)-[:ASKED]->(q)
WITH q
UNWIND $entities AS ent
MERGE (e:Entity {company_id: ent.company_id})
ON CREATE SET e.name = ent.name, e.label = ent.label
CREATE (q)-[:ABOUT]->(e);

// 3. Recall Recent Questions and Tracked Entities for a User
MATCH (u:User {id: $user_id})-[:ASKED]->(q:Question)
OPTIONAL MATCH (q)-[:ABOUT]->(e:Entity)
RETURN 
    q.id AS question_id,
    q.text AS question_text,
    q.timestamp AS timestamp,
    collect({company_id: e.company_id, name: e.name, label: e.label}) AS entities
ORDER BY q.timestamp DESC
LIMIT 10;

// 4. Record Simulated Change Snapshot in User Memory
MATCH (u:User {id: $user_id})
CREATE (sim:Simulation {
    id: $sim_id,
    target_system: $target_system,
    action: $action,
    timestamp: $timestamp,
    diff_added: $diff_added,
    diff_removed: $diff_removed
})
CREATE (u)-[:SIMULATED]->(sim);

// 5. Recall Past Simulations
MATCH (u:User {id: $user_id})-[:SIMULATED]->(sim:Simulation)
RETURN 
    sim.id AS sim_id,
    sim.target_system AS target_system,
    sim.action AS action,
    sim.timestamp AS timestamp,
    sim.diff_added AS diff_added,
    sim.diff_removed AS diff_removed
ORDER BY sim.timestamp DESC
LIMIT 5;

// 6. Reset User Memory Graph
// In FalkorDB Redis protocol: GRAPH.DELETE memory_<userId>
