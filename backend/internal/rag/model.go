package rag

// Chunk represents an indexed text chunk from Jira, Slack, Docs, or Decisions.
type Chunk struct {
	ID         string            `json:"id"`
	SourceType string            `json:"source_type"` // "Ticket", "Thread", "Document", "Decision"
	SourceID   string            `json:"source_id"`
	Title      string            `json:"title"`
	Content    string            `json:"content"`
	Metadata   map[string]string `json:"metadata,omitempty"`
	Vector     []float32         `json:"-"` // in-memory embedding
}

// SearchResult represents a chunk matched by cosine similarity.
type SearchResult struct {
	Chunk Chunk   `json:"chunk"`
	Score float64 `json:"score"`
}

// ComparisonPreset represents a pre-curated question showcasing Graph vs RAG differences.
type ComparisonPreset struct {
	ID              string `json:"id"`
	Title           string `json:"title"`
	Question        string `json:"question"`
	Category        string `json:"category"` // "blast_radius", "provenance", "bus_factor", "honest_gap"
	ExpectedWinner  string `json:"expected_winner"` // "GRAPH", "TIE", "RAG"
	Description     string `json:"description"`
}

// RAGSide represents the naive vector retrieval results and synthesis.
type RAGSide struct {
	RetrievedChunks []SearchResult `json:"retrieved_chunks"`
	Answer          string         `json:"answer"`
	Blindspots      []string       `json:"blindspots"`
}

// GraphSide represents the FalkorDB graph-grounded provenance results.
type GraphSide struct {
	Answer             string                 `json:"answer"`
	EntitiesIdentified []string               `json:"entities_identified"`
	ProofPath          interface{}            `json:"proof_path,omitempty"`
	HonestGap          string                 `json:"honest_gap,omitempty"`
	KeyMetrics         map[string]interface{} `json:"key_metrics,omitempty"`
}

// ComparisonResult represents the full split-screen comparison report.
type ComparisonResult struct {
	Question                 string    `json:"question"`
	Category                 string    `json:"category"`
	Verdict                  string    `json:"verdict"` // "GRAPH_WIN", "TIE", "RAG_WIN"
	WhyGraphWins             string    `json:"why_graph_wins"`
	RAG                      RAGSide   `json:"rag"`
	Graph                    GraphSide `json:"graph"`
}

// SearchRequest represents a payload for /api/rag/search.
type SearchRequest struct {
	Query string `json:"query"`
	TopK  int    `json:"top_k"`
}

// CompareRequest represents a payload for /api/rag/compare.
type CompareRequest struct {
	Question string `json:"question"`
	PresetID string `json:"preset_id,omitempty"`
}
