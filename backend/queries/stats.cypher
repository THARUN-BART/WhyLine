// ============================================================================
// Queries Used Till Now: Graph Health & Diagnostics
// Executed by: internal/graph/client.go & internal/graph/handler.go
// ============================================================================

// 1. Total Nodes Count
// Used by GET /api/graph/stats and startup seeder check.
MATCH (n) 
RETURN count(n) AS cnt;

// 2. Total Relationships Count
// Used by GET /api/graph/stats to measure graph connections.
MATCH ()-[r]->() 
RETURN count(r) AS cnt;
