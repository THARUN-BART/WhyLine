package ticket

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"time"

	"github.com/THARUN-BART/whyline/backend/internal/graph"
)

var (
	ErrTicketNotFound = errors.New("ticket not found")
	ErrEmptyTitle     = errors.New("ticket title cannot be empty")
)

type Service struct {
	client    *graph.Client
	graphName string
	mu        sync.RWMutex
	memStore  map[string]*Ticket
}

func NewService(client *graph.Client, graphName string) *Service {
	return &Service{
		client:    client,
		graphName: graphName,
		memStore:  make(map[string]*Ticket),
	}
}

// CreateTicket creates a new ticket in FalkorDB and links it to decision/system/user nodes.
func (s *Service) CreateTicket(ctx context.Context, userID, company string, req CreateTicketRequest) (*Ticket, error) {
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, ErrEmptyTitle
	}

	id := strings.TrimSpace(req.ID)
	if id == "" {
		id = fmt.Sprintf("TICK-%d", 2000+rand.Intn(7999))
	}

	priority := strings.TrimSpace(req.Priority)
	if priority == "" {
		priority = "P2"
	}

	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "Open"
	}

	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)

	ticket := &Ticket{
		ID:          id,
		Title:       title,
		Description: strings.TrimSpace(req.Description),
		URL:         strings.TrimSpace(req.URL),
		Priority:    priority,
		Status:      status,
		Company:     company,
		CreatedBy:   userID,
		CreatedAt:   now,
		DecisionID:  strings.TrimSpace(req.DecisionID),
		SystemID:    strings.TrimSpace(req.SystemID),
	}

	// Persist to FalkorDB if connected
	if s.client != nil {
		mergeCypher := `
MERGE (tk:Ticket {id: $id})
SET tk.title = $title,
    tk.description = $description,
    tk.url = $url,
    tk.priority = $priority,
    tk.status = $status,
    tk.company = $company,
    tk.created_by = $created_by,
    tk.created_at = $created_at
`
		_, err := s.client.Query(ctx, s.graphName, mergeCypher, map[string]interface{}{
			"id":          ticket.ID,
			"title":       ticket.Title,
			"description": ticket.Description,
			"url":         ticket.URL,
			"priority":    ticket.Priority,
			"status":      ticket.Status,
			"company":     ticket.Company,
			"created_by":  ticket.CreatedBy,
			"created_at":  nowStr,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to save ticket in FalkorDB: %w", err)
		}

		// Link Decision ADR if provided
		if ticket.DecisionID != "" {
			linkDecCypher := `
MATCH (d:Decision {id: $decision_id}), (tk:Ticket {id: $ticket_id})
MERGE (d)-[:APPROVED_IN]->(tk)
RETURN d.title AS decision_title
`
			res, err := s.client.Query(ctx, s.graphName, linkDecCypher, map[string]interface{}{
				"decision_id": ticket.DecisionID,
				"ticket_id":   ticket.ID,
			})
			if err == nil && len(res.Records) > 0 {
				if dt, ok := res.Records[0]["decision_title"].(string); ok {
					ticket.DecisionTitle = dt
				}
			}
		}

		// Link System if provided
		if ticket.SystemID != "" {
			linkSysCypher := `
MATCH (s:System {id: $system_id}), (tk:Ticket {id: $ticket_id})
MERGE (tk)-[:AFFECTS]->(s)
RETURN s.name AS system_name
`
			res, err := s.client.Query(ctx, s.graphName, linkSysCypher, map[string]interface{}{
				"system_id": ticket.SystemID,
				"ticket_id": ticket.ID,
			})
			if err == nil && len(res.Records) > 0 {
				if sn, ok := res.Records[0]["system_name"].(string); ok {
					ticket.SystemName = sn
				}
			}
		}

		// Link User if provided
		if ticket.CreatedBy != "" {
			linkUserCypher := `
MATCH (u:User {id: $user_id}), (tk:Ticket {id: $ticket_id})
MERGE (u)-[:CREATED]->(tk)
`
			_, _ = s.client.Query(ctx, s.graphName, linkUserCypher, map[string]interface{}{
				"user_id":   ticket.CreatedBy,
				"ticket_id": ticket.ID,
			})
		}
	}

	// In-memory cache
	s.mu.Lock()
	s.memStore[ticket.ID] = ticket
	s.mu.Unlock()

	return ticket, nil
}

// ListTickets returns all tickets from FalkorDB or memory store, optionally filtered.
func (s *Service) ListTickets(ctx context.Context, companyFilter string) ([]*Ticket, error) {
	if s.client != nil {
		cypher := `
MATCH (t:Ticket)
OPTIONAL MATCH (d:Decision)-[:APPROVED_IN]->(t)
OPTIONAL MATCH (t)-[:AFFECTS]->(s:System)
RETURN t.id AS id, t.title AS title, t.description AS description, t.url AS url,
       t.priority AS priority, t.status AS status, t.company AS company,
       t.created_by AS created_by, t.created_at AS created_at,
       d.id AS decision_id, d.title AS decision_title,
       s.id AS system_id, s.name AS system_name
`
		res, err := s.client.Query(ctx, s.graphName, cypher, nil)
		if err == nil && len(res.Records) > 0 {
			var tickets []*Ticket
			for _, rec := range res.Records {
				t := recordToTicket(rec)
				if companyFilter == "" || t.Company == "" || strings.EqualFold(t.Company, companyFilter) {
					tickets = append(tickets, t)
				}
			}
			return tickets, nil
		}
	}

	// Fallback to in-memory store
	s.mu.RLock()
	defer s.mu.RUnlock()
	var tickets []*Ticket
	for _, t := range s.memStore {
		if companyFilter == "" || t.Company == "" || strings.EqualFold(t.Company, companyFilter) {
			tickets = append(tickets, t)
		}
	}
	return tickets, nil
}

// GetTicketByID fetches a ticket with its linked Decision and System.
func (s *Service) GetTicketByID(ctx context.Context, id string) (*Ticket, error) {
	if s.client != nil {
		cypher := `
MATCH (t:Ticket {id: $id})
OPTIONAL MATCH (d:Decision)-[:APPROVED_IN]->(t)
OPTIONAL MATCH (t)-[:AFFECTS]->(s:System)
RETURN t.id AS id, t.title AS title, t.description AS description, t.url AS url,
       t.priority AS priority, t.status AS status, t.company AS company,
       t.created_by AS created_by, t.created_at AS created_at,
       d.id AS decision_id, d.title AS decision_title,
       s.id AS system_id, s.name AS system_name
`
		res, err := s.client.Query(ctx, s.graphName, cypher, map[string]interface{}{"id": id})
		if err == nil && len(res.Records) > 0 {
			return recordToTicket(res.Records[0]), nil
		}
	}

	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.memStore[id]
	if !ok {
		return nil, ErrTicketNotFound
	}
	return t, nil
}

// UpdateTicket updates an existing ticket's metadata or status.
func (s *Service) UpdateTicket(ctx context.Context, id string, req UpdateTicketRequest) (*Ticket, error) {
	ticket, err := s.GetTicketByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.Title != "" {
		ticket.Title = strings.TrimSpace(req.Title)
	}
	if req.Description != "" {
		ticket.Description = strings.TrimSpace(req.Description)
	}
	if req.URL != "" {
		ticket.URL = strings.TrimSpace(req.URL)
	}
	if req.Priority != "" {
		ticket.Priority = strings.TrimSpace(req.Priority)
	}
	if req.Status != "" {
		ticket.Status = strings.TrimSpace(req.Status)
	}

	if s.client != nil {
		cypher := `
MATCH (t:Ticket {id: $id})
SET t.title = $title,
    t.description = $description,
    t.url = $url,
    t.priority = $priority,
    t.status = $status
`
		_, _ = s.client.Query(ctx, s.graphName, cypher, map[string]interface{}{
			"id":          ticket.ID,
			"title":       ticket.Title,
			"description": ticket.Description,
			"url":         ticket.URL,
			"priority":    ticket.Priority,
			"status":      ticket.Status,
		})
	}

	s.mu.Lock()
	s.memStore[ticket.ID] = ticket
	s.mu.Unlock()

	return ticket, nil
}

func recordToTicket(rec map[string]interface{}) *Ticket {
	t := &Ticket{
		ID:            getString(rec, "id"),
		Title:         getString(rec, "title"),
		Description:   getString(rec, "description"),
		URL:           getString(rec, "url"),
		Priority:      getString(rec, "priority"),
		Status:        getString(rec, "status"),
		Company:       getString(rec, "company"),
		CreatedBy:     getString(rec, "created_by"),
		DecisionID:    getString(rec, "decision_id"),
		DecisionTitle: getString(rec, "decision_title"),
		SystemID:      getString(rec, "system_id"),
		SystemName:    getString(rec, "system_name"),
	}

	if rawCreatedAt := getString(rec, "created_at"); rawCreatedAt != "" {
		if parsed, err := time.Parse(time.RFC3339, rawCreatedAt); err == nil {
			t.CreatedAt = parsed
		}
	}
	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now().UTC()
	}
	return t
}

func getString(rec map[string]interface{}, key string) string {
	if val, ok := rec[key]; ok && val != nil {
		if s, ok := val.(string); ok {
			return s
		}
		return fmt.Sprintf("%v", val)
	}
	return ""
}
