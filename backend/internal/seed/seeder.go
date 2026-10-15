package seed

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/THARUN-BART/whyline/backend/internal/graph"
)

// Seeder manages loading synthetic data into FalkorDB.
type Seeder struct {
	client    *graph.Client
	graphName string
}

func NewSeeder(client *graph.Client, graphName string) *Seeder {
	return &Seeder{
		client:    client,
		graphName: graphName,
	}
}

// CheckAndAutoSeed checks if company knowledge graph is empty and seeds it if needed.
func (s *Seeder) CheckAndAutoSeed(ctx context.Context) error {
	// Count existing non-User nodes
	query := "MATCH (n) WHERE NOT n:User RETURN count(n) AS cnt"
	res, err := s.client.ROQuery(ctx, s.graphName, query, nil)
	if err == nil && len(res.Records) > 0 {
		if cnt, ok := res.Records[0]["cnt"].(int64); ok && cnt > 0 {
			log.Printf("[INFO] Graph '%s' already contains %d knowledge nodes. Skipping auto-seed.", s.graphName, cnt)
			return nil
		}
	}

	log.Printf("[INFO] Knowledge graph '%s' is unseeded. Auto-seeding synthetic dataset...", s.graphName)
	return s.SeedAll(ctx)
}

// SeedAll clears existing knowledge graph and loads complete synthetic data.
func (s *Seeder) SeedAll(ctx context.Context) error {
	log.Println("[INFO] Seeding People...")
	for _, p := range DefaultPeople {
		cypher := `
MERGE (p:Person {id: $id})
SET p.name = $name, p.role = $role, p.active = $active
`
		_, err := s.client.Query(ctx, s.graphName, cypher, map[string]interface{}{
			"id":     p.ID,
			"name":   p.Name,
			"role":   p.Role,
			"active": p.Active,
		})
		if err != nil {
			return fmt.Errorf("failed to seed person %s: %w", p.ID, err)
		}
	}

	log.Println("[INFO] Seeding Teams...")
	for _, t := range DefaultTeams {
		cypher := `
MERGE (tm:Team {id: $id})
SET tm.name = $name
`
		_, err := s.client.Query(ctx, s.graphName, cypher, map[string]interface{}{
			"id":   t.ID,
			"name": t.Name,
		})
		if err != nil {
			return fmt.Errorf("failed to seed team %s: %w", t.ID, err)
		}
	}

	log.Println("[INFO] Seeding Systems...")
	for _, sys := range DefaultSystems {
		cypher := `
MERGE (s:System {id: $id})
SET s.name = $name, s.criticality = $criticality, s.aliases = $aliases
`
		_, err := s.client.Query(ctx, s.graphName, cypher, map[string]interface{}{
			"id":          sys.ID,
			"name":        sys.Name,
			"criticality": sys.Criticality,
			"aliases":     strings.Join(sys.Aliases, ","),
		})
		if err != nil {
			return fmt.Errorf("failed to seed system %s: %w", sys.ID, err)
		}
	}

	log.Println("[INFO] Seeding Decisions...")
	for _, d := range DefaultDecisions {
		cypher := `
MERGE (d:Decision {id: $id})
SET d.title = $title, d.summary = $summary, d.date = $date, d.status = $status, d.aliases = $aliases
`
		_, err := s.client.Query(ctx, s.graphName, cypher, map[string]interface{}{
			"id":      d.ID,
			"title":   d.Title,
			"summary": d.Summary,
			"date":    d.Date,
			"status":  d.Status,
			"aliases": strings.Join(d.Aliases, ","),
		})
		if err != nil {
			return fmt.Errorf("failed to seed decision %s: %w", d.ID, err)
		}
	}

	log.Println("[INFO] Seeding Tickets...")
	for _, t := range DefaultTickets {
		cypher := `
MERGE (tk:Ticket {id: $id})
SET tk.title = $title, tk.description = $description, tk.url = $url
`
		_, err := s.client.Query(ctx, s.graphName, cypher, map[string]interface{}{
			"id":          t.ID,
			"title":       t.Title,
			"description": t.Description,
			"url":         t.URL,
		})
		if err != nil {
			return fmt.Errorf("failed to seed ticket %s: %w", t.ID, err)
		}
	}

	log.Println("[INFO] Seeding Threads...")
	for _, th := range DefaultThreads {
		cypher := `
MERGE (thr:Thread {id: $id})
SET thr.channel = $channel, thr.excerpt = $excerpt, thr.body = $body
`
		_, err := s.client.Query(ctx, s.graphName, cypher, map[string]interface{}{
			"id":      th.ID,
			"channel": th.Channel,
			"excerpt": th.Excerpt,
			"body":    th.Body,
		})
		if err != nil {
			return fmt.Errorf("failed to seed thread %s: %w", th.ID, err)
		}
	}

	log.Println("[INFO] Seeding Documents...")
	for _, doc := range DefaultDocuments {
		cypher := `
MERGE (dc:Document {id: $id})
SET dc.title = $title, dc.url = $url, dc.text = $text
`
		_, err := s.client.Query(ctx, s.graphName, cypher, map[string]interface{}{
			"id":    doc.ID,
			"title": doc.Title,
			"url":   doc.URL,
			"text":  doc.Text,
		})
		if err != nil {
			return fmt.Errorf("failed to seed document %s: %w", doc.ID, err)
		}
	}

	log.Println("[INFO] Seeding Relationships (Edges)...")
	return s.seedEdges(ctx)
}

func (s *Seeder) seedEdges(ctx context.Context) error {
	edgeQueries := []string{
		// Provenance Chains
		"MATCH (p:Person {id: 'usr_alice'}), (d:Decision {id: 'dec_billing_v2'}) MERGE (p)-[:DECIDED {confidence: 1.0}]->(d)",
		"MATCH (d:Decision {id: 'dec_billing_v2'}), (t:Ticket {id: 'TICK-1042'}) MERGE (d)-[:APPROVED_IN {confidence: 1.0}]->(t)",
		"MATCH (t:Ticket {id: 'TICK-1042'}), (th:Thread {id: 'TH-882'}) MERGE (t)-[:DISCUSSED_IN {confidence: 1.0}]->(th)",
		"MATCH (d:Decision {id: 'dec_billing_v2'}), (doc:Document {id: 'DOC-101'}) MERGE (d)-[:SUMMARIZED_IN {confidence: 1.0}]->(doc)",
		"MATCH (d:Decision {id: 'dec_billing_v2'}), (sys:System {id: 'sys_billing'}) MERGE (d)-[:AFFECTS {confidence: 1.0}]->(sys)",

		"MATCH (p:Person {id: 'usr_dave'}), (d:Decision {id: 'dec_ledger_isolation'}) MERGE (p)-[:DECIDED {confidence: 1.0}]->(d)",
		"MATCH (d:Decision {id: 'dec_ledger_isolation'}), (t:Ticket {id: 'TICK-884'}) MERGE (d)-[:APPROVED_IN {confidence: 1.0}]->(t)",
		"MATCH (t:Ticket {id: 'TICK-884'}), (th:Thread {id: 'TH-741'}) MERGE (t)-[:DISCUSSED_IN {confidence: 1.0}]->(th)",
		"MATCH (d:Decision {id: 'dec_ledger_isolation'}), (doc:Document {id: 'DOC-102'}) MERGE (d)-[:SUMMARIZED_IN {confidence: 1.0}]->(doc)",
		"MATCH (d:Decision {id: 'dec_ledger_isolation'}), (sys:System {id: 'sys_ledger'}) MERGE (d)-[:AFFECTS {confidence: 1.0}]->(sys)",

		"MATCH (p:Person {id: 'usr_bob'}), (d:Decision {id: 'dec_payments_gateway_split'}) MERGE (p)-[:DECIDED {confidence: 1.0}]->(d)",
		"MATCH (d:Decision {id: 'dec_payments_gateway_split'}), (t:Ticket {id: 'TICK-901'}) MERGE (d)-[:APPROVED_IN {confidence: 1.0}]->(t)",
		"MATCH (t:Ticket {id: 'TICK-901'}), (th:Thread {id: 'TH-902'}) MERGE (t)-[:DISCUSSED_IN {confidence: 1.0}]->(th)",
		"MATCH (d:Decision {id: 'dec_payments_gateway_split'}), (doc:Document {id: 'DOC-103'}) MERGE (d)-[:SUMMARIZED_IN {confidence: 1.0}]->(doc)",
		"MATCH (d:Decision {id: 'dec_payments_gateway_split'}), (sys:System {id: 'sys_payments'}) MERGE (d)-[:AFFECTS {confidence: 1.0}]->(sys)",

		"MATCH (p:Person {id: 'usr_elena'}), (d:Decision {id: 'dec_jwt_auth_migration'}) MERGE (p)-[:DECIDED {confidence: 1.0}]->(d)",
		"MATCH (d:Decision {id: 'dec_jwt_auth_migration'}), (t:Ticket {id: 'TICK-955'}) MERGE (d)-[:APPROVED_IN {confidence: 1.0}]->(t)",
		"MATCH (t:Ticket {id: 'TICK-955'}), (th:Thread {id: 'TH-956'}) MERGE (t)-[:DISCUSSED_IN {confidence: 1.0}]->(th)",
		"MATCH (d:Decision {id: 'dec_jwt_auth_migration'}), (doc:Document {id: 'DOC-104'}) MERGE (d)-[:SUMMARIZED_IN {confidence: 1.0}]->(doc)",
		"MATCH (d:Decision {id: 'dec_jwt_auth_migration'}), (sys:System {id: 'sys_auth'}) MERGE (d)-[:AFFECTS {confidence: 1.0}]->(sys)",

		// Honest Gap Edges
		"MATCH (p:Person {id: 'usr_frank'}), (d:Decision {id: 'dec_gap_no_ticket'}) MERGE (p)-[:DECIDED]->(d)",
		"MATCH (d:Decision {id: 'dec_gap_no_ticket'}), (sys:System {id: 'sys_auth'}) MERGE (d)-[:AFFECTS]->(sys)",

		"MATCH (p:Person {id: 'usr_alice'}), (d:Decision {id: 'dec_gap_no_thread'}) MERGE (p)-[:DECIDED]->(d)",
		"MATCH (d:Decision {id: 'dec_gap_no_thread'}), (t:Ticket {id: 'TICK-2011'}) MERGE (d)-[:APPROVED_IN]->(t)",

		"MATCH (p:Person {id: 'usr_carol'}), (d:Decision {id: 'dec_gap_no_doc'}) MERGE (p)-[:DECIDED]->(d)",
		"MATCH (d:Decision {id: 'dec_gap_no_doc'}), (t:Ticket {id: 'TICK-2030'}) MERGE (d)-[:APPROVED_IN]->(t)",
		"MATCH (t:Ticket {id: 'TICK-2030'}), (th:Thread {id: 'TH-2031'}) MERGE (t)-[:DISCUSSED_IN]->(th)",
		"MATCH (d:Decision {id: 'dec_gap_no_doc'}), (sys:System {id: 'sys_billing'}) MERGE (d)-[:AFFECTS]->(sys)",

		// System Dependencies: (A)-[:DEPENDS_ON]->(B) means A depends on B
		"MATCH (a:System {id: 'sys_checkout'}), (b:System {id: 'sys_billing'}) MERGE (a)-[:DEPENDS_ON]->(b)",
		"MATCH (a:System {id: 'sys_checkout'}), (b:System {id: 'sys_inventory'}) MERGE (a)-[:DEPENDS_ON]->(b)",
		"MATCH (a:System {id: 'sys_checkout'}), (b:System {id: 'sys_auth'}) MERGE (a)-[:DEPENDS_ON]->(b)",
		"MATCH (a:System {id: 'sys_billing'}), (b:System {id: 'sys_payments'}) MERGE (a)-[:DEPENDS_ON]->(b)",
		"MATCH (a:System {id: 'sys_billing'}), (b:System {id: 'sys_ledger'}) MERGE (a)-[:DEPENDS_ON]->(b)",
		"MATCH (a:System {id: 'sys_order'}), (b:System {id: 'sys_billing'}) MERGE (a)-[:DEPENDS_ON]->(b)",
		"MATCH (a:System {id: 'sys_order'}), (b:System {id: 'sys_inventory'}) MERGE (a)-[:DEPENDS_ON]->(b)",
		"MATCH (a:System {id: 'sys_inventory'}), (b:System {id: 'sys_order'}) MERGE (a)-[:DEPENDS_ON]->(b)", // Circular cycle
		"MATCH (a:System {id: 'sys_analytics'}), (b:System {id: 'sys_order'}) MERGE (a)-[:DEPENDS_ON]->(b)",
		"MATCH (a:System {id: 'sys_user_profile'}), (b:System {id: 'sys_auth'}) MERGE (a)-[:DEPENDS_ON]->(b)",

		// Ownership Edges (Person OWNS System)
		"MATCH (p:Person {id: 'usr_dave'}), (s:System {id: 'sys_ledger'}) MERGE (p)-[:OWNS {role: 'owner'}]->(s)", // Dave is inactive -> Orphaned!
		"MATCH (p:Person {id: 'usr_bob'}), (s:System {id: 'sys_billing'}) MERGE (p)-[:OWNS {role: 'owner'}]->(s)",
		"MATCH (p:Person {id: 'usr_alice'}), (s:System {id: 'sys_billing'}) MERGE (p)-[:OWNS {role: 'maintainer'}]->(s)",
		"MATCH (p:Person {id: 'usr_carol'}), (s:System {id: 'sys_payments'}) MERGE (p)-[:OWNS {role: 'owner'}]->(s)",
		"MATCH (p:Person {id: 'usr_elena'}), (s:System {id: 'sys_auth'}) MERGE (p)-[:OWNS {role: 'owner'}]->(s)",
		"MATCH (p:Person {id: 'usr_grace'}), (s:System {id: 'sys_order'}) MERGE (p)-[:OWNS {role: 'owner'}]->(s)",
		"MATCH (p:Person {id: 'usr_henry'}), (s:System {id: 'sys_inventory'}) MERGE (p)-[:OWNS {role: 'owner'}]->(s)",
		"MATCH (p:Person {id: 'usr_maya'}), (s:System {id: 'sys_analytics'}) MERGE (p)-[:OWNS {role: 'owner'}]->(s)",
		"MATCH (p:Person {id: 'usr_jack'}), (s:System {id: 'sys_user_profile'}) MERGE (p)-[:OWNS {role: 'maintainer'}]->(s)",

		// Contribution Edges (Person WORKED_ON System)
		"MATCH (p:Person {id: 'usr_dave'}), (s:System {id: 'sys_ledger'}) MERGE (p)-[:WORKED_ON {contributions: 240}]->(s)",
		"MATCH (p:Person {id: 'usr_bob'}), (s:System {id: 'sys_billing'}) MERGE (p)-[:WORKED_ON {contributions: 180}]->(s)",
		"MATCH (p:Person {id: 'usr_alice'}), (s:System {id: 'sys_billing'}) MERGE (p)-[:WORKED_ON {contributions: 120}]->(s)",
		"MATCH (p:Person {id: 'usr_carol'}), (s:System {id: 'sys_payments'}) MERGE (p)-[:WORKED_ON {contributions: 160}]->(s)",
		"MATCH (p:Person {id: 'usr_elena'}), (s:System {id: 'sys_auth'}) MERGE (p)-[:WORKED_ON {contributions: 210}]->(s)",
		"MATCH (p:Person {id: 'usr_alice'}), (s:System {id: 'sys_auth'}) MERGE (p)-[:WORKED_ON {contributions: 75}]->(s)",
		"MATCH (p:Person {id: 'usr_bob'}), (s:System {id: 'sys_payments'}) MERGE (p)-[:WORKED_ON {contributions: 90}]->(s)",

		// Team memberships
		"MATCH (p:Person {id: 'usr_alice'}), (t:Team {id: 'team_platform'}) MERGE (p)-[:MEMBER_OF]->(t)",
		"MATCH (p:Person {id: 'usr_bob'}), (t:Team {id: 'team_payments'}) MERGE (p)-[:MEMBER_OF]->(t)",
		"MATCH (p:Person {id: 'usr_carol'}), (t:Team {id: 'team_payments'}) MERGE (p)-[:MEMBER_OF]->(t)",
		"MATCH (p:Person {id: 'usr_elena'}), (t:Team {id: 'team_infra'}) MERGE (p)-[:MEMBER_OF]->(t)",
	}

	for _, q := range edgeQueries {
		if _, err := s.client.Query(ctx, s.graphName, q, nil); err != nil {
			log.Printf("[WARN] Error creating edge [%s]: %v", q, err)
		}
	}

	log.Println("[INFO] Successfully seeded all synthetic nodes and relationships into FalkorDB!")
	return nil
}
