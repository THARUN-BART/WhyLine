package graph

// Node represents a graph vertex in FalkorDB.
type Node struct {
	ID         int64                  `json:"id"`
	Labels     []string               `json:"labels"`
	Properties map[string]interface{} `json:"properties"`
}

// Edge represents a directed relationship between two nodes in FalkorDB.
type Edge struct {
	ID         int64                  `json:"id"`
	Type       string                 `json:"type"`
	SourceNode int64                  `json:"source_node"`
	TargetNode int64                  `json:"target_node"`
	Properties map[string]interface{} `json:"properties"`
}

// Path represents a sequence of alternating nodes and edges (graph proof path).
type Path struct {
	Nodes []Node `json:"nodes"`
	Edges []Edge `json:"edges"`
}

// Record represents a single row returned by a Cypher query mapped by column name.
type Record map[string]interface{}

// QueryResult contains the parsed results of a FalkorDB Cypher execution.
type QueryResult struct {
	Columns []string               `json:"columns"`
	Records []Record               `json:"records"`
	Nodes   []Node                 `json:"nodes,omitempty"`
	Edges   []Edge                 `json:"edges,omitempty"`
	Paths   []Path                 `json:"paths,omitempty"`
	Stats   map[string]interface{} `json:"stats"`
}
