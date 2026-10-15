package tools

import "github.com/THARUN-BART/whyline/backend/internal/graph"

// EntityMatch represents a fuzzy match returned by find_entity.
type EntityMatch struct {
	ID          string `json:"id"`
	Label       string `json:"label"` // "Decision", "System", "Person"
	Name        string `json:"name"`
	Description string `json:"description"`
}

// TraceResult represents the multi-hop provenance chain of a decision.
type TraceResult struct {
	DecisionID     string       `json:"decision_id"`
	Title          string       `json:"title"`
	Summary        string       `json:"summary"`
	Date           string       `json:"date"`
	Status         string       `json:"status"`
	DeciderName    string       `json:"decider_name,omitempty"`
	DeciderRole    string       `json:"decider_role,omitempty"`
	TicketTitle    string       `json:"ticket_title,omitempty"`
	TicketURL      string       `json:"ticket_url,omitempty"`
	ThreadChannel  string       `json:"thread_channel,omitempty"`
	ThreadExcerpt  string       `json:"thread_excerpt,omitempty"`
	DocumentTitle  string       `json:"document_title,omitempty"`
	DocumentURL    string       `json:"document_url,omitempty"`
	AffectedSystem string       `json:"affected_system,omitempty"`
	GapLevel       string       `json:"gap_level"`    // "NONE", "RATIONALE_MISSING", "DISCUSSION_MISSING", "DOC_MISSING"
	MissingLink    string       `json:"missing_link"` // human-friendly explanation of honest gap
	Path           *graph.Path  `json:"path,omitempty"`
}

// ImpactedSystem represents a service affected by a reversed decision.
type ImpactedSystem struct {
	SystemID      string       `json:"system_id"`
	SystemName    string       `json:"system_name"`
	Criticality   int          `json:"criticality"`
	HopDistance   int          `json:"hop_distance"`
	SeverityScore float64      `json:"severity_score"`
	Path          *graph.Path  `json:"path,omitempty"`
}

// ImpactResult represents the outcome of impact_of analysis.
type ImpactResult struct {
	DecisionID     string           `json:"decision_id"`
	ChangedSystem  string           `json:"changed_system"`
	ImpactedSystems []ImpactedSystem `json:"impacted_systems"`
}

// Contributor represents a person who contributed to a system.
type Contributor struct {
	PersonID      string `json:"person_id"`
	Name          string `json:"name"`
	Role          string `json:"role"`
	IsActive      bool   `json:"is_active"`
	Contributions int    `json:"contributions"`
}

// WhoKnowsResult represents who knows a system based on contribution weights.
type WhoKnowsResult struct {
	SystemName   string        `json:"system_name"`
	Contributors []Contributor `json:"contributors"`
}

// BusFactorItem represents the risk profile of a system.
type BusFactorItem struct {
	SystemID             string  `json:"system_id"`
	SystemName           string  `json:"system_name"`
	Criticality          int     `json:"criticality"`
	ActiveOwners         int     `json:"active_owners"`
	DepartedOwners       int     `json:"departed_owners"`
	TransitiveDependents int     `json:"transitive_dependents"`
	RiskScore            float64 `json:"risk_score"`
	Status               string  `json:"status"` // "ORPHANED", "HIGH_RISK_SINGLE_OWNER", "HEALTHY", "UNOWNED_NO_DEPENDENTS"
}

// BusFactorReport represents the full organizational bus-factor report.
type BusFactorReport struct {
	TotalSystems    int             `json:"total_systems"`
	OrphanedSystems []BusFactorItem `json:"orphaned_systems"`
	AllSystems      []BusFactorItem `json:"all_systems"`
}
