package memory

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/THARUN-BART/whyline/backend/internal/graph"
	"github.com/THARUN-BART/whyline/backend/internal/tools"
)

type Service struct {
	client       *graph.Client
	companyGraph string
	toolsEngine  *tools.Engine
}

func NewService(client *graph.Client, companyGraph string, toolsEngine *tools.Engine) *Service {
	return &Service{
		client:       client,
		companyGraph: companyGraph,
		toolsEngine:  toolsEngine,
	}
}

var safeMemoryIDRegex = regexp.MustCompile(`[^a-zA-Z0-9_]+`)

func (s *Service) getMemoryGraph(userID string) string {
	cleanID := strings.TrimSpace(userID)
	if cleanID == "" {
		cleanID = "default"
	}
	cleanID = strings.ReplaceAll(cleanID, "-", "_")
	cleanID = safeMemoryIDRegex.ReplaceAllString(cleanID, "_")
	cleanID = strings.Trim(cleanID, "_")
	if cleanID == "" {
		cleanID = "default"
	}
	return "memory_" + cleanID
}

// SaveQuestion saves a user question and its referenced company entities into the user's isolated graph.
func (s *Service) SaveQuestion(ctx context.Context, userID, questionText string, entities []EntityRef) (*QuestionRecord, error) {
	memGraph := s.getMemoryGraph(userID)
	qID := "q_" + generateID(6)
	now := time.Now().UTC()
	nowStr := now.Format(time.RFC3339)

	// 1. Ensure user node exists
	userCypher := `
MERGE (u:User {id: $user_id})
SET u.updated_at = $timestamp
`
	if _, err := s.client.Query(ctx, memGraph, userCypher, map[string]interface{}{
		"user_id":   userID,
		"timestamp": nowStr,
	}); err != nil {
		return nil, fmt.Errorf("failed to initialize user in memory graph: %w", err)
	}

	// 2. Create Question node
	qCypher := `
MATCH (u:User {id: $user_id})
CREATE (q:Question {
    id: $q_id,
    text: $text,
    timestamp: $timestamp
})
CREATE (u)-[:ASKED]->(q)
`
	if _, err := s.client.Query(ctx, memGraph, qCypher, map[string]interface{}{
		"user_id":   userID,
		"q_id":      qID,
		"text":      questionText,
		"timestamp": nowStr,
	}); err != nil {
		return nil, fmt.Errorf("failed to save question to memory: %w", err)
	}

	// 3. Link question to referenced entities
	for _, ent := range entities {
		entCypher := `
MATCH (q:Question {id: $q_id})
MERGE (e:Entity {company_id: $company_id})
ON CREATE SET e.name = $name, e.label = $label
CREATE (q)-[:ABOUT]->(e)
`
		_, _ = s.client.Query(ctx, memGraph, entCypher, map[string]interface{}{
			"q_id":       qID,
			"company_id": ent.CompanyID,
			"name":       ent.Name,
			"label":      ent.Label,
		})
	}

	return &QuestionRecord{
		QuestionID: qID,
		Text:       questionText,
		Timestamp:  now,
		Entities:   entities,
	}, nil
}

// RecallMemory retrieves recent questions, tracked entities, and past simulations from the user's graph.
func (s *Service) RecallMemory(ctx context.Context, userID string) (*MemorySummary, error) {
	memGraph := s.getMemoryGraph(userID)

	// Recall Questions
	qCypher := `
MATCH (u:User {id: $user_id})-[:ASKED]->(q:Question)
RETURN q.id AS q_id, q.text AS text, q.timestamp AS timestamp
ORDER BY q.timestamp DESC
LIMIT 10
`
	qRes, err := s.client.ROQuery(ctx, memGraph, qCypher, map[string]interface{}{"user_id": userID})
	var questions []QuestionRecord

	if err == nil {
		for _, rec := range qRes.Records {
			qid := toString(rec["q_id"])
			text := toString(rec["text"])
			ts := parseTime(rec["timestamp"])

			// Fetch linked entities
			entCypher := `
MATCH (q:Question {id: $q_id})-[:ABOUT]->(e:Entity)
RETURN e.company_id AS id, e.name AS name, e.label AS label
`
			entRes, _ := s.client.ROQuery(ctx, memGraph, entCypher, map[string]interface{}{"q_id": qid})
			var entities []EntityRef
			for _, eRec := range entRes.Records {
				entities = append(entities, EntityRef{
					CompanyID: toString(eRec["id"]),
					Name:      toString(eRec["name"]),
					Label:     toString(eRec["label"]),
				})
			}

			questions = append(questions, QuestionRecord{
				QuestionID: qid,
				Text:       text,
				Timestamp:  ts,
				Entities:   entities,
			})
		}
	}

	// Recall Simulations
	simCypher := `
MATCH (u:User {id: $user_id})-[:SIMULATED]->(s:Simulation)
RETURN 
    s.id AS id, 
    s.target_system AS target, 
    s.action AS action, 
    s.timestamp AS timestamp,
    s.diff_added AS added, 
    s.diff_removed AS removed
ORDER BY s.timestamp DESC
LIMIT 5
`
	simRes, _ := s.client.ROQuery(ctx, memGraph, simCypher, map[string]interface{}{"user_id": userID})
	var simulations []SimulationRecord

	if simRes != nil {
		for _, rec := range simRes.Records {
			simulations = append(simulations, SimulationRecord{
				ID:           toString(rec["id"]),
				TargetSystem: toString(rec["target"]),
				Action:       toString(rec["action"]),
				Timestamp:    parseTime(rec["timestamp"]),
				DiffAdded:    splitList(toString(rec["added"])),
				DiffRemoved:  splitList(toString(rec["removed"])),
			})
		}
	}

	return &MemorySummary{
		UserID:        userID,
		GraphName:     memGraph,
		TotalMemory:   len(questions) + len(simulations),
		Questions:     questions,
		Simulations:   simulations,
	}, nil
}

// SimulateChange performs what-if impact analysis and diffs against baseline impact.
func (s *Service) SimulateChange(ctx context.Context, req SimulateChangeRequest) (*SimulationRecord, error) {
	memGraph := s.getMemoryGraph(req.UserID)
	simID := "sim_" + generateID(6)
	now := time.Now().UTC()

	decisionID := req.DecisionID
	if decisionID == "" {
		decisionID = "dec_billing_v2"
	}

	// 1. Compute baseline impact of the decision in company graph
	baseImpact, err := s.toolsEngine.ImpactOf(ctx, decisionID)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate baseline impact: %w", err)
	}

	var previousImpact []string
	for _, imp := range baseImpact.ImpactedSystems {
		previousImpact = append(previousImpact, imp.SystemName)
	}

	// 2. Compute simulated impact
	var newImpact []string
	var diffAdded []string
	var diffRemoved []string

	action := req.Action
	if action == "" {
		action = "simulate_add_dependency"
	}

	switch action {
	case "simulate_add_dependency":
		// Simulating that a new service (e.g. notification-service or user-profile-service) now depends on the target
		related := req.RelatedSystemID
		if related == "" {
			related = "notification-service"
		}
		newImpact = append([]string{}, previousImpact...)
		newImpact = append(newImpact, related)
		diffAdded = []string{related}

	case "simulate_reverse_decision":
		// Simulating reversal drops billing-api dependencies and cascades
		for _, name := range previousImpact {
			newImpact = append(newImpact, name+" (cascade-affected)")
		}
		diffAdded = []string{"legacy-monolith-fallback (unstable)"}

	case "simulate_remove_dependency":
		if len(previousImpact) > 1 {
			diffRemoved = []string{previousImpact[len(previousImpact)-1]}
			newImpact = previousImpact[:len(previousImpact)-1]
		} else {
			newImpact = previousImpact
		}
	default:
		newImpact = previousImpact
	}

	// 3. Save simulation snapshot to user memory graph
	saveCypher := `
MERGE (u:User {id: $user_id})
CREATE (sim:Simulation {
    id: $id,
    target_system: $target,
    action: $action,
    timestamp: $timestamp,
    diff_added: $diff_added,
    diff_removed: $diff_removed
})
CREATE (u)-[:SIMULATED]->(sim)
`
	_, err = s.client.Query(ctx, memGraph, saveCypher, map[string]interface{}{
		"user_id":      req.UserID,
		"id":           simID,
		"target":       baseImpact.ChangedSystem,
		"action":       action,
		"timestamp":    now.Format(time.RFC3339),
		"diff_added":   strings.Join(diffAdded, ","),
		"diff_removed": strings.Join(diffRemoved, ","),
	})
	if err != nil {
		log.Printf("[WARN] Failed to persist simulation to memory graph: %v", err)
	}

	return &SimulationRecord{
		ID:             simID,
		TargetSystem:   baseImpact.ChangedSystem,
		Action:         action,
		Timestamp:      now,
		PreviousImpact: previousImpact,
		NewImpact:      newImpact,
		DiffAdded:      diffAdded,
		DiffRemoved:    diffRemoved,
	}, nil
}

// ResetMemory deletes the user's isolated memory graph.
func (s *Service) ResetMemory(ctx context.Context, userID string) error {
	memGraph := s.getMemoryGraph(userID)
	return s.client.DeleteGraph(ctx, memGraph)
}

func generateID(length int) string {
	b := make([]byte, length)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func toString(val interface{}) string {
	if val == nil {
		return ""
	}
	return fmt.Sprintf("%v", val)
}

func parseTime(val interface{}) time.Time {
	if val == nil {
		return time.Now().UTC()
	}
	str := toString(val)
	if t, err := time.Parse(time.RFC3339, str); err == nil {
		return t
	}
	return time.Now().UTC()
}

func splitList(val string) []string {
	if strings.TrimSpace(val) == "" {
		return nil
	}
	parts := strings.Split(val, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return parts
}
