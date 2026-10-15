package tools

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/THARUN-BART/whyline/backend/internal/graph"
)

type Engine struct {
	client    *graph.Client
	graphName string
}

func NewEngine(client *graph.Client, graphName string) *Engine {
	return &Engine{
		client:    client,
		graphName: graphName,
	}
}

// FindEntity searches for decisions, systems, or people matching conversational user text.
func (e *Engine) FindEntity(ctx context.Context, query string) ([]EntityMatch, error) {
	q := strings.TrimSpace(query)
	if q == "" {
		return nil, nil
	}

	var matches []EntityMatch

	// 1. Search Decisions
	cypherDec := `
MATCH (d:Decision)
WHERE toLower(d.title) CONTAINS toLower($q) 
   OR toLower(d.aliases) CONTAINS toLower($q)
   OR d.id = $q
RETURN d.id AS id, d.title AS name, d.summary AS desc
LIMIT 5
`
	resDec, err := e.client.ROQuery(ctx, e.graphName, cypherDec, map[string]interface{}{"q": q})
	if err == nil {
		for _, rec := range resDec.Records {
			matches = append(matches, EntityMatch{
				ID:          toString(rec["id"]),
				Label:       "Decision",
				Name:        toString(rec["name"]),
				Description: toString(rec["desc"]),
			})
		}
	}

	// 2. Search Systems
	cypherSys := `
MATCH (s:System)
WHERE toLower(s.name) CONTAINS toLower($q) 
   OR toLower(s.aliases) CONTAINS toLower($q)
   OR s.id = $q
RETURN s.id AS id, s.name AS name, toString(s.criticality) AS desc
LIMIT 5
`
	resSys, err := e.client.ROQuery(ctx, e.graphName, cypherSys, map[string]interface{}{"q": q})
	if err == nil {
		for _, rec := range resSys.Records {
			matches = append(matches, EntityMatch{
				ID:          toString(rec["id"]),
				Label:       "System",
				Name:        toString(rec["name"]),
				Description: "Criticality: " + toString(rec["desc"]),
			})
		}
	}

	// 3. Search People
	cypherPerson := `
MATCH (p:Person)
WHERE toLower(p.name) CONTAINS toLower($q) 
   OR toLower(p.role) CONTAINS toLower($q)
   OR p.id = $q
RETURN p.id AS id, p.name AS name, p.role AS desc
LIMIT 5
`
	resPerson, err := e.client.ROQuery(ctx, e.graphName, cypherPerson, map[string]interface{}{"q": q})
	if err == nil {
		for _, rec := range resPerson.Records {
			matches = append(matches, EntityMatch{
				ID:          toString(rec["id"]),
				Label:       "Person",
				Name:        toString(rec["name"]),
				Description: toString(rec["desc"]),
			})
		}
	}

	return matches, nil
}

// TraceDecision returns the multi-hop provenance chain of a decision and computes Honest Gaps.
func (e *Engine) TraceDecision(ctx context.Context, decisionID string) (*TraceResult, error) {
	cypher := `
MATCH (d:Decision)
WHERE d.id = $id OR toLower(d.title) CONTAINS toLower($id)
OPTIONAL MATCH (p:Person)-[:DECIDED]->(d)
OPTIONAL MATCH (d)-[:APPROVED_IN]->(t:Ticket)
OPTIONAL MATCH (t)-[:DISCUSSED_IN]->(th:Thread)
OPTIONAL MATCH (d)-[:SUMMARIZED_IN]->(doc:Document)
OPTIONAL MATCH (d)-[:AFFECTS]->(sys:System)
RETURN 
    d.id AS decision_id,
    d.title AS title,
    d.summary AS summary,
    d.date AS date,
    d.status AS status,
    p.name AS decider_name,
    p.role AS decider_role,
    t.title AS ticket_title,
    t.url AS ticket_url,
    th.channel AS thread_channel,
    th.excerpt AS thread_excerpt,
    doc.title AS doc_title,
    doc.url AS doc_url,
    sys.name AS affected_system
LIMIT 1
`
	res, err := e.client.ROQuery(ctx, e.graphName, cypher, map[string]interface{}{"id": decisionID})
	if err != nil || len(res.Records) == 0 {
		return nil, fmt.Errorf("decision not found with identifier '%s'", decisionID)
	}

	rec := res.Records[0]
	tr := &TraceResult{
		DecisionID:     toString(rec["decision_id"]),
		Title:          toString(rec["title"]),
		Summary:        toString(rec["summary"]),
		Date:           toString(rec["date"]),
		Status:         toString(rec["status"]),
		DeciderName:    toString(rec["decider_name"]),
		DeciderRole:    toString(rec["decider_role"]),
		TicketTitle:    toString(rec["ticket_title"]),
		TicketURL:      toString(rec["ticket_url"]),
		ThreadChannel:  toString(rec["thread_channel"]),
		ThreadExcerpt:  toString(rec["thread_excerpt"]),
		DocumentTitle:  toString(rec["doc_title"]),
		DocumentURL:    toString(rec["doc_url"]),
		AffectedSystem: toString(rec["affected_system"]),
		GapLevel:       "NONE",
	}

	// Fetch graph path proof
	pathCypher := `
MATCH (d:Decision {id: $id})
OPTIONAL MATCH path = (d)-[:APPROVED_IN]->(:Ticket)-[:DISCUSSED_IN]->(:Thread)
RETURN path
`
	pathRes, _ := e.client.ROQuery(ctx, e.graphName, pathCypher, map[string]interface{}{"id": tr.DecisionID})
	if len(pathRes.Paths) > 0 {
		tr.Path = &pathRes.Paths[0]
	}

	// Compute Honest Gap Levels in Go (matching idea.md section 5)
	if tr.TicketTitle == "" {
		tr.GapLevel = "RATIONALE_MISSING"
		tr.MissingLink = "No recorded Jira/ticket rationale in the connected company sources."
	} else if tr.ThreadExcerpt == "" {
		tr.GapLevel = "DISCUSSION_MISSING"
		tr.MissingLink = "Ticket exists, but no recorded Slack discussion thread was captured."
	} else if tr.DocumentTitle == "" {
		tr.GapLevel = "DOC_MISSING"
		tr.MissingLink = "Discussion exists, but no RFC summary document was recorded."
	} else if tr.DeciderName == "" {
		tr.GapLevel = "DECIDER_MISSING"
		tr.MissingLink = "Decision is recorded, but no decider author was recorded."
	}

	return tr, nil
}

// ImpactOf computes what systems break if a decision is changed or reversed.
func (e *Engine) ImpactOf(ctx context.Context, decisionID string) (*ImpactResult, error) {
	cypher := `
MATCH (d:Decision)-[:AFFECTS]->(target:System)
WHERE d.id = $id OR toLower(d.title) CONTAINS toLower($id)
MATCH path = (dependent:System)-[:DEPENDS_ON*1..4]->(target)
WHERE dependent <> target
RETURN 
    target.name AS target_system,
    dependent.id AS dependent_id,
    dependent.name AS dependent_name,
    dependent.criticality AS criticality,
    length(path) AS hop_distance,
    path
`
	res, err := e.client.ROQuery(ctx, e.graphName, cypher, map[string]interface{}{"id": decisionID})
	if err != nil {
		return nil, err
	}

	if len(res.Records) == 0 {
		// Check target system alone
		targetCypher := "MATCH (d:Decision)-[:AFFECTS]->(target:System) WHERE d.id = $id RETURN target.name AS target"
		tRes, _ := e.client.ROQuery(ctx, e.graphName, targetCypher, map[string]interface{}{"id": decisionID})
		targetName := "Unknown"
		if len(tRes.Records) > 0 {
			targetName = toString(tRes.Records[0]["target"])
		}
		return &ImpactResult{
			DecisionID:      decisionID,
			ChangedSystem:   targetName,
			ImpactedSystems: []ImpactedSystem{},
		}, nil
	}

	targetName := toString(res.Records[0]["target_system"])

	// Keep only the shortest path per system in Go (satisfies Plan rule 6)
	shortestMap := make(map[string]ImpactedSystem)
	for i, rec := range res.Records {
		depID := toString(rec["dependent_id"])
		depName := toString(rec["dependent_name"])
		crit := toInt(rec["criticality"])
		hops := toInt(rec["hop_distance"])
		if hops == 0 {
			hops = 1
		}
		severity := float64(crit) / float64(hops)

		var p *graph.Path
		if i < len(res.Paths) {
			p = &res.Paths[i]
		}

		existing, exists := shortestMap[depID]
		if !exists || hops < existing.HopDistance {
			shortestMap[depID] = ImpactedSystem{
				SystemID:      depID,
				SystemName:    depName,
				Criticality:   crit,
				HopDistance:   hops,
				SeverityScore: severity,
				Path:          p,
			}
		}
	}

	var impacted []ImpactedSystem
	for _, item := range shortestMap {
		impacted = append(impacted, item)
	}

	// Rank by Severity descending, then hop distance ascending
	sort.Slice(impacted, func(i, j int) bool {
		if impacted[i].SeverityScore == impacted[j].SeverityScore {
			return impacted[i].HopDistance < impacted[j].HopDistance
		}
		return impacted[i].SeverityScore > impacted[j].SeverityScore
	})

	return &ImpactResult{
		DecisionID:      decisionID,
		ChangedSystem:   targetName,
		ImpactedSystems: impacted,
	}, nil
}

// WhoKnows returns people who worked on a system ranked by contribution weights.
func (e *Engine) WhoKnows(ctx context.Context, systemName string) (*WhoKnowsResult, error) {
	cypher := `
MATCH (p:Person)-[w:WORKED_ON]->(s:System)
WHERE toLower(s.name) = toLower($system) OR s.id = $system
RETURN 
    s.name AS system,
    p.id AS person_id,
    p.name AS person_name,
    p.role AS role,
    p.active AS is_active,
    w.contributions AS contributions
ORDER BY w.contributions DESC
`
	res, err := e.client.ROQuery(ctx, e.graphName, cypher, map[string]interface{}{"system": systemName})
	if err != nil {
		return nil, err
	}

	resolvedSystem := systemName
	var contributors []Contributor
	for _, rec := range res.Records {
		resolvedSystem = toString(rec["system"])
		contributors = append(contributors, Contributor{
			PersonID:      toString(rec["person_id"]),
			Name:          toString(rec["person_name"]),
			Role:          toString(rec["role"]),
			IsActive:      toBool(rec["is_active"]),
			Contributions: toInt(rec["contributions"]),
		})
	}

	return &WhoKnowsResult{
		SystemName:   resolvedSystem,
		Contributors: contributors,
	}, nil
}

// BusFactor computes active owners, transitive dependents, and orphaned systems.
func (e *Engine) BusFactor(ctx context.Context, systemFilter string) (*BusFactorReport, error) {
	cypher := `
MATCH (s:System)
OPTIONAL MATCH (active_p:Person {active: true})-[:OWNS]->(s)
OPTIONAL MATCH (inactive_p:Person {active: false})-[:OWNS]->(s)
OPTIONAL MATCH (dep:System)-[:DEPENDS_ON*1..4]->(s)
WHERE dep <> s
WITH s, 
     count(DISTINCT active_p) AS active_owners, 
     count(DISTINCT inactive_p) AS departed_owners,
     count(DISTINCT dep) AS transitive_dependents
RETURN 
    s.id AS system_id,
    s.name AS system_name,
    s.criticality AS criticality,
    active_owners,
    departed_owners,
    transitive_dependents,
    (toFloat(s.criticality) * transitive_dependents / CASE WHEN active_owners = 0 THEN 0.5 ELSE toFloat(active_owners) END) AS risk_score,
    CASE 
        WHEN active_owners = 0 AND transitive_dependents > 0 THEN 'ORPHANED'
        WHEN active_owners = 0 AND transitive_dependents = 0 THEN 'UNOWNED_NO_DEPENDENTS'
        WHEN active_owners = 1 THEN 'HIGH_RISK_SINGLE_OWNER'
        ELSE 'HEALTHY'
    END AS status
ORDER BY risk_score DESC, criticality DESC
`
	res, err := e.client.ROQuery(ctx, e.graphName, cypher, nil)
	if err != nil {
		return nil, err
	}

	var all []BusFactorItem
	var orphaned []BusFactorItem

	for _, rec := range res.Records {
		sysID := toString(rec["system_id"])
		sysName := toString(rec["system_name"])

		if systemFilter != "" && !strings.EqualFold(sysID, systemFilter) && !strings.EqualFold(sysName, systemFilter) {
			continue
		}

		crit := toInt(rec["criticality"])
		act := toInt(rec["active_owners"])
		dep := toInt(rec["departed_owners"])
		transit := toInt(rec["transitive_dependents"])
		status := toString(rec["status"])

		// Formula: risk = criticality * dependents / max(active_owners, 0.5)
		divisor := float64(act)
		if divisor <= 0 {
			divisor = 0.5
		}
		risk := (float64(crit) * float64(transit)) / divisor
		if act == 0 && transit == 0 {
			risk = 0 // Unowned with 0 dependents has risk 0
		}

		item := BusFactorItem{
			SystemID:             sysID,
			SystemName:           sysName,
			Criticality:          crit,
			ActiveOwners:         act,
			DepartedOwners:       dep,
			TransitiveDependents: transit,
			RiskScore:            risk,
			Status:               status,
		}

		all = append(all, item)
		if status == "ORPHANED" {
			orphaned = append(orphaned, item)
		}
	}

	sort.Slice(all, func(i, j int) bool {
		return all[i].RiskScore > all[j].RiskScore
	})

	return &BusFactorReport{
		TotalSystems:    len(all),
		OrphanedSystems: orphaned,
		AllSystems:      all,
	}, nil
}

func toString(val interface{}) string {
	if val == nil {
		return ""
	}
	return fmt.Sprintf("%v", val)
}

func toInt(val interface{}) int {
	if val == nil {
		return 0
	}
	switch v := val.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	default:
		return 0
	}
}

func toFloat(val interface{}) float64 {
	if val == nil {
		return 0.0
	}
	switch v := val.(type) {
	case float64:
		return v
	case int:
		return float64(v)
	case int64:
		return float64(v)
	default:
		return 0.0
	}
}

func toBool(val interface{}) bool {
	if val == nil {
		return false
	}
	if b, ok := val.(bool); ok {
		return b
	}
	return false
}
