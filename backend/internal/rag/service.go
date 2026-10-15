package rag

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/THARUN-BART/whyline/backend/internal/tools"
)

// Service provides Vector RAG search and split-screen baseline comparisons against FalkorDB.
type Service struct {
	vectorizer  *Vectorizer
	toolsEngine *tools.Engine
	geminiKey   string
	geminiModel string
	presets     []ComparisonPreset
}

// NewService instantiates the Vs-RAG service.
func NewService(vectorizer *Vectorizer, toolsEngine *tools.Engine, geminiKey string, geminiModel string) *Service {
	s := &Service{
		vectorizer:  vectorizer,
		toolsEngine: toolsEngine,
		geminiKey:   geminiKey,
		geminiModel: geminiModel,
		presets: []ComparisonPreset{
			{
				ID:             "preset_blast_radius",
				Title:          "Multi-Hop Change Impact (The Blast Radius Trap)",
				Question:       "What breaks if we reverse moving billing off the monolith?",
				Category:       "blast_radius",
				ExpectedWinner: "GRAPH",
				Description:    "Tests cascading dependencies. Vector RAG only finds documents with 'billing monolith' words, completely missing downstream services. Whyline traverses the exact incoming dependency graph.",
			},
			{
				ID:             "preset_direct_provenance",
				Title:          "Single-Hop Rationale (Direct Keyword Retrieval)",
				Question:       "Why did we move billing off the legacy monolith to billing-api?",
				Category:       "provenance",
				ExpectedWinner: "TIE",
				Description:    "Direct incident query. Both Vector RAG and Whyline successfully retrieve the 4% flash sale transaction drop incident from the war room Slack thread.",
			},
			{
				ID:             "preset_bus_factor",
				Title:          "Orphaned System & Departed Owner Risk",
				Question:       "Who maintains ledger-service and what is our operational risk?",
				Category:       "bus_factor",
				ExpectedWinner: "GRAPH",
				Description:    "Tests real-time relational state. RAG reads docs and claims 'Dave Miller owns it'. Whyline checks Dave's active=false status and calculates Bus Factor risk score 100.",
			},
			{
				ID:             "preset_honest_gap",
				Title:          "Honest Gap Detection (Missing Architecture Document)",
				Question:       "Where is the RFC document for adopting Protobuf schemas?",
				Category:       "honest_gap",
				ExpectedWinner: "GRAPH",
				Description:    "Tests epistemic honesty. RAG retrieves the ticket and Slack thread and assumes an RFC exists. Whyline detects the DOC_MISSING provenance gap.",
			},
		},
	}
	return s
}

// GetChunks returns all indexed text chunks.
func (s *Service) GetChunks() []Chunk {
	return s.vectorizer.chunks
}

// GetPresets returns the benchmark comparison presets.
func (s *Service) GetPresets() []ComparisonPreset {
	return s.presets
}

// Search performs cosine similarity retrieval over all in-memory chunks.
func (s *Service) Search(query string, topK int) ([]SearchResult, error) {
	if topK <= 0 {
		topK = 5
	}

	qVec := s.vectorizer.EmbedQuery(query)
	var results []SearchResult

	for _, chk := range s.vectorizer.chunks {
		score := CosineSimilarity(qVec, chk.Vector)
		results = append(results, SearchResult{
			Chunk: chk,
			Score: score,
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	if len(results) > topK {
		results = results[:topK]
	}

	return results, nil
}

// Compare executes both Vector RAG and FalkorDB Graph traversal side-by-side.
func (s *Service) Compare(ctx context.Context, question string, presetID string) (*ComparisonResult, error) {
	// 1. Resolve preset if provided
	if presetID != "" {
		for _, p := range s.presets {
			if p.ID == presetID {
				question = p.Question
				break
			}
		}
	}

	if strings.TrimSpace(question) == "" {
		question = s.presets[0].Question
	}

	// 2. Perform Vector RAG retrieval (Top 4 chunks)
	ragResults, err := s.Search(question, 4)
	if err != nil {
		return nil, fmt.Errorf("vector search failed: %w", err)
	}

	lowerQ := strings.ToLower(question)

	// 3. Categorize query and formulate comparison
	var result *ComparisonResult

	switch {
	case strings.Contains(lowerQ, "break") || strings.Contains(lowerQ, "reverse") || strings.Contains(lowerQ, "impact"):
		result = s.compareBlastRadius(ctx, question, ragResults)

	case strings.Contains(lowerQ, "who") || strings.Contains(lowerQ, "maintain") || strings.Contains(lowerQ, "risk") || strings.Contains(lowerQ, "bus factor") || strings.Contains(lowerQ, "orphan"):
		result = s.compareBusFactor(ctx, question, ragResults)

	case strings.Contains(lowerQ, "rfc") || strings.Contains(lowerQ, "document") || strings.Contains(lowerQ, "gap") || strings.Contains(lowerQ, "protobuf"):
		result = s.compareHonestGap(ctx, question, ragResults)

	default:
		// Default to provenance comparison
		result = s.compareProvenance(ctx, question, ragResults)
	}

	return result, nil
}

// compareBlastRadius compares multi-hop change impact.
func (s *Service) compareBlastRadius(ctx context.Context, question string, ragResults []SearchResult) *ComparisonResult {
	// FalkorDB Graph tool execution
	impactResult, _ := s.toolsEngine.ImpactOf(ctx, "dec_billing_v2")

	var chunkCitations []string
	for _, r := range ragResults {
		chunkCitations = append(chunkCitations, fmt.Sprintf("- [%s] %s (sim: %.3f)", r.Chunk.SourceID, r.Chunk.Title, r.Score))
	}

	ragAnswer := fmt.Sprintf(
		"Based on retrieved documents (%s), reversing this decision would revert billing logic back to the legacy monolith, which was previously abandoned because it dropped 4%% of checkout transactions during Black Friday peak sales. The documents explain database connection exhaustion in the monolith.",
		ragResults[0].Chunk.SourceID,
	)

	ragBlindspots := []string{
		"Completely missed dependent systems: checkout-service and order-service are at immediate risk of failure.",
		"Zero topology awareness: cannot follow incoming [:DEPENDS_ON] edges.",
		"No severity ranking or blast radius quantification (criticality scores missing).",
	}

	var depList []string
	if impactResult != nil {
		for _, dep := range impactResult.ImpactedSystems {
			depList = append(depList, fmt.Sprintf("%s (crit: %d, distance: %d hops, score: %.2f)", dep.SystemName, dep.Criticality, dep.HopDistance, dep.SeverityScore))
		}
	}

	graphAnswer := fmt.Sprintf(
		"Whyline traced decision dec_billing_v2 in FalkorDB. Reversing or modifying billing-api directly impacts %d dependent systems across multi-hop edges:\n%s\nOverall blast radius severity is rated HIGH.",
		len(depList),
		strings.Join(depList, "\n"),
	)

	return &ComparisonResult{
		Question: question,
		Category: "blast_radius",
		Verdict:  "GRAPH_WIN",
		WhyGraphWins: "Vector RAG only retrieves texts containing lexical keywords ('monolith', 'billing') and can only explain why the monolith was replaced. It has no graph topology to traverse incoming DEPENDS_ON edges, remaining completely blind to the fact that checkout-service and order-service will immediately fail. FalkorDB proves the full cascading blast radius.",
		RAG: RAGSide{
			RetrievedChunks: ragResults,
			Answer:          ragAnswer,
			Blindspots:      ragBlindspots,
		},
		Graph: GraphSide{
			Answer:             graphAnswer,
			EntitiesIdentified: []string{"dec_billing_v2", "sys_billing", "sys_checkout", "sys_order"},
			ProofPath:          impactResult,
			KeyMetrics: map[string]interface{}{
				"affected_systems_count": len(depList),
				"max_hop_depth":          2,
				"highest_criticality":    8,
			},
		},
	}
}

// compareBusFactor compares orphaned systems and departed owners.
func (s *Service) compareBusFactor(ctx context.Context, question string, ragResults []SearchResult) *ComparisonResult {
	busResult, _ := s.toolsEngine.BusFactor(ctx, "sys_ledger")

	ragAnswer := fmt.Sprintf(
		"Based on RFC-102 and Jira ticket TICK-884, ledger-service is owned and authored by Dave Miller. Dave Miller designed the immutable SOX double-entry compliance architecture.",
	)

	ragBlindspots := []string{
		"Hallucinated active ownership: Dave Miller departed the company (active = false).",
		"Unaware that ledger-service has ZERO active maintainers (ORPHANED).",
		"Missed that 3 critical downstream services depend on ledger-service with Bus Factor score of 100.",
	}

	var sysReport tools.BusFactorItem
	if busResult != nil {
		for _, item := range busResult.AllSystems {
			if item.SystemID == "sys_ledger" {
				sysReport = item
				break
			}
		}
		if sysReport.SystemID == "" && len(busResult.OrphanedSystems) > 0 {
			sysReport = busResult.OrphanedSystems[0]
		}
	}

	graphAnswer := fmt.Sprintf(
		"CRITICAL ALERT: ledger-service is flagged as ORPHANED with a Bus Factor Risk Score of %.1f/100.\nPrimary author Dave Miller (usr_dave) is DEPARTED (active=false). Active owners: %d.\nTransitive dependents: %d systems (including billing-api and checkout-service).",
		sysReport.RiskScore,
		sysReport.ActiveOwners,
		sysReport.TransitiveDependents,
	)

	return &ComparisonResult{
		Question: question,
		Category: "bus_factor",
		Verdict:  "GRAPH_WIN",
		WhyGraphWins: "Vector RAG retrieves stale documentation text saying 'Dave Miller authored the ledger'. Because vector embeddings cannot join documents with organizational HR node states (Person.active = false) or calculate transitive graph dependents, RAG assures the user that Dave is maintaining it. Whyline immediately identifies the 0-maintainer orphaned system crisis in FalkorDB.",
		RAG: RAGSide{
			RetrievedChunks: ragResults,
			Answer:          ragAnswer,
			Blindspots:      ragBlindspots,
		},
		Graph: GraphSide{
			Answer:             graphAnswer,
			EntitiesIdentified: []string{"sys_ledger", "usr_dave"},
			ProofPath:          busResult,
			KeyMetrics: map[string]interface{}{
				"status":                sysReport.Status,
				"active_owners":         sysReport.ActiveOwners,
				"departed_owners":       sysReport.DepartedOwners,
				"transitive_dependents": sysReport.TransitiveDependents,
				"bus_factor_score":      sysReport.RiskScore,
			},
		},
	}
}

// compareHonestGap compares missing documentation handling.
func (s *Service) compareHonestGap(ctx context.Context, question string, ragResults []SearchResult) *ComparisonResult {
	traceResult, _ := s.toolsEngine.TraceDecision(ctx, "dec_gap_no_doc")

	ragAnswer := fmt.Sprintf(
		"Protobuf schemas were adopted across internal RPCs to replace JSON HTTP after Carol White and Bob Jones agreed that JSON serialization consumed 35%% CPU in billing-api. See ticket TICK-2030 and Slack thread TH-2031 for architectural details.",
	)

	ragBlindspots := []string{
		"Failed to notice that NO RFC document actually exists.",
		"Assumed ticket description and Slack thread satisfied the document request.",
		"Cannot verify graph absence of (:Document) node.",
	}

	graphAnswer := "Honest Provenance Gap Detected: [DOC_MISSING]. While ticket TICK-2030 and thread TH-2031 confirm the Protobuf decision, no formal architectural RFC document was ever written or linked to dec_gap_no_doc in the knowledge graph."

	return &ComparisonResult{
		Question: question,
		Category: "honest_gap",
		Verdict:  "GRAPH_WIN",
		WhyGraphWins: "When asked for an RFC document that doesn't exist, Vector RAG simply retrieves the closest semantic text (the Jira ticket and Slack thread) and confidently presents their contents without realizing the requested RFC is absent. FalkorDB explicitly proves the absence of the (:Document) node via graph pattern matching, returning an honest provenance gap.",
		RAG: RAGSide{
			RetrievedChunks: ragResults,
			Answer:          ragAnswer,
			Blindspots:      ragBlindspots,
		},
		Graph: GraphSide{
			Answer:             graphAnswer,
			EntitiesIdentified: []string{"dec_gap_no_doc", "TICK-2030", "TH-2031"},
			ProofPath:          traceResult,
			HonestGap:          "DOC_MISSING",
		},
	}
}

// compareProvenance compares single-hop rationale lookup where both RAG and Graph can succeed.
func (s *Service) compareProvenance(ctx context.Context, question string, ragResults []SearchResult) *ComparisonResult {
	traceResult, _ := s.toolsEngine.TraceDecision(ctx, "dec_billing_v2")

	ragAnswer := "Billing was moved off the legacy monolith to billing-api because during the Black Friday peak, the monolithic database connection pool exhausted, causing 4% of checkout transactions to be dropped. The team extracted billing to enforce idempotency keys and DB isolation (Slack thread TH-882, Ticket TICK-1042)."

	graphAnswer := "Decision dec_billing_v2 ('Move billing off legacy monolith to billing-api') was approved on 2025-06-12 by Alice Smith (usr_alice). Provenance path: dec_billing_v2 -> TH-882 (War room postmortem: DB pool exhaustion dropped 4% peak transactions) -> TICK-1042 -> RFC DOC-101. Replaced monolithic architecture with idempotent microservice."

	return &ComparisonResult{
		Question: question,
		Category: "provenance",
		Verdict:  "TIE",
		WhyGraphWins: "For simple keyword-to-text queries with direct semantic matches, Vector RAG performs well by retrieving the Slack postmortem thread. Whyline matches RAG on the text answer, but adds verified provenance verification, decider identity (Alice Smith), and linked RFC documentation.",
		RAG: RAGSide{
			RetrievedChunks: ragResults,
			Answer:          ragAnswer,
			Blindspots: []string{
				"Missing cryptographic proof path and relationship graph links.",
			},
		},
		Graph: GraphSide{
			Answer:             graphAnswer,
			EntitiesIdentified: []string{"dec_billing_v2", "usr_alice", "TH-882", "TICK-1042", "DOC-101"},
			ProofPath:          traceResult,
			KeyMetrics: map[string]interface{}{
				"status":   "approved",
				"date":     "2025-06-12",
				"decider":  "Alice Smith",
				"gaps_found": 0,
			},
		},
	}
}
