package agent

import (
	"time"

	"github.com/THARUN-BART/whyline/backend/internal/graph"
	"github.com/THARUN-BART/whyline/backend/internal/tools"
)

// AgentStep represents a live reasoning/tool step streamed to the frontend via SSE.
type AgentStep struct {
	StepNumber int         `json:"step_number"`
	Type       string      `json:"type"`   // "thinking", "tool_call", "tool_result", "validation"
	ToolName   string      `json:"tool_name,omitempty"`
	Input      interface{} `json:"input,omitempty"`
	Output     interface{} `json:"output,omitempty"`
	Message    string      `json:"message"`
	Timestamp  time.Time   `json:"timestamp"`
}

// ChatRequest is the user question payload.
type ChatRequest struct {
	UserID   string `json:"user_id,omitempty"`
	Question string `json:"question"`
	Stream   bool   `json:"stream,omitempty"`
}

// ChatResponse is the complete structured answer returned by the agent.
type ChatResponse struct {
	Question       string           `json:"question"`
	Answer         string           `json:"answer"`
	CitedEntities  []string         `json:"cited_entities"`  // Node IDs validated against FalkorDB
	ValidatedIDs   []string         `json:"validated_ids"`   // IDs confirmed to exist in graph
	InvalidIDs     []string         `json:"invalid_ids"`     // Any hallucinated IDs rejected by Go
	GapLevel       string           `json:"gap_level"`       // "NONE", "RATIONALE_MISSING", etc.
	MissingLink    string           `json:"missing_link"`    // Explanation of missing source
	GraphPath      *graph.Path      `json:"graph_path,omitempty"`
	ImpactAnalysis *tools.ImpactResult `json:"impact_analysis,omitempty"`
	Steps          []AgentStep      `json:"steps"`
	ExecutionTime  string           `json:"execution_time"`
}
