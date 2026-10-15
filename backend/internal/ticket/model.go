package ticket

import "time"

// Ticket represents a Jira/issue tracker engineering ticket tied to architectural provenance.
type Ticket struct {
	ID            string    `json:"id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	URL           string    `json:"url,omitempty"`
	Priority      string    `json:"priority,omitempty"`
	Status        string    `json:"status,omitempty"`
	Company       string    `json:"company,omitempty"`
	CreatedBy     string    `json:"created_by,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	DecisionID    string    `json:"decision_id,omitempty"`
	DecisionTitle string    `json:"decision_title,omitempty"`
	SystemID      string    `json:"system_id,omitempty"`
	SystemName    string    `json:"system_name,omitempty"`
}

// CreateTicketRequest defines the incoming payload for creating a new engineering ticket.
type CreateTicketRequest struct {
	ID          string `json:"id,omitempty"`
	Title       string `json:"title"`
	Description string `json:"description"`
	URL         string `json:"url,omitempty"`
	Priority    string `json:"priority,omitempty"`
	Status      string `json:"status,omitempty"`
	DecisionID  string `json:"decision_id,omitempty"`
	SystemID    string `json:"system_id,omitempty"`
}

// UpdateTicketRequest defines the incoming payload for updating a ticket status or metadata.
type UpdateTicketRequest struct {
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	URL         string `json:"url,omitempty"`
	Priority    string `json:"priority,omitempty"`
	Status      string `json:"status,omitempty"`
	DecisionID  string `json:"decision_id,omitempty"`
	SystemID    string `json:"system_id,omitempty"`
}
