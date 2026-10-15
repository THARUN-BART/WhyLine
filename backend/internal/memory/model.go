package memory

import "time"

// EntityRef represents a reference to a company entity tracked in user memory.
type EntityRef struct {
	CompanyID string `json:"company_id"`
	Name      string `json:"name"`
	Label     string `json:"label"` // "Decision", "System", "Person"
}

// QuestionRecord represents a question previously asked by a user.
type QuestionRecord struct {
	QuestionID string      `json:"question_id"`
	Text       string      `json:"text"`
	Timestamp  time.Time   `json:"timestamp"`
	Entities   []EntityRef `json:"entities"`
}

// SimulationRecord stores a what-if simulation run by the user.
type SimulationRecord struct {
	ID              string    `json:"id"`
	TargetSystem    string    `json:"target_system"`
	Action          string    `json:"action"` // "simulate_reverse_decision", "simulate_add_dependency"
	Timestamp       time.Time `json:"timestamp"`
	PreviousImpact  []string  `json:"previous_impact"`
	NewImpact       []string  `json:"new_impact"`
	DiffAdded       []string  `json:"diff_added"`
	DiffRemoved     []string  `json:"diff_removed"`
}

// MemorySummary aggregates a user's isolated memory graph state.
type MemorySummary struct {
	UserID        string             `json:"user_id"`
	GraphName     string             `json:"graph_name"`
	TotalMemory   int                `json:"total_memory_items"`
	Questions     []QuestionRecord   `json:"recent_questions"`
	Simulations   []SimulationRecord `json:"simulations"`
}

// SaveQuestionRequest represents payload to store a question into user memory.
type SaveQuestionRequest struct {
	UserID   string      `json:"user_id,omitempty"`
	Question string      `json:"question"`
	Entities []EntityRef `json:"entities"`
}

// SimulateChangeRequest holds what-if analysis parameters.
type SimulateChangeRequest struct {
	UserID          string `json:"user_id,omitempty"`
	DecisionID      string `json:"decision_id,omitempty"`
	SystemID        string `json:"system_id,omitempty"`
	Action          string `json:"action"` // "reverse_decision", "add_dependency", "remove_dependency"
	RelatedSystemID string `json:"related_system_id,omitempty"`
}
