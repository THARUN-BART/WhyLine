package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/THARUN-BART/whyline/backend/internal/graph"
	"github.com/THARUN-BART/whyline/backend/internal/memory"
	"github.com/THARUN-BART/whyline/backend/internal/tools"
)

type StepListener func(step AgentStep)

type GeminiAgent struct {
	apiKey        string
	model         string
	toolsEngine   *tools.Engine
	memoryService *memory.Service
	validator     *IDValidator
	httpClient    *http.Client
}

func NewGeminiAgent(
	apiKey string,
	model string,
	toolsEngine *tools.Engine,
	memoryService *memory.Service,
	validator *IDValidator,
) *GeminiAgent {
	if model == "" {
		model = "gemini-2.5-flash"
	}
	return &GeminiAgent{
		apiKey:        apiKey,
		model:         model,
		toolsEngine:   toolsEngine,
		memoryService: memoryService,
		validator:     validator,
		httpClient:    &http.Client{Timeout: 45 * time.Second},
	}
}

// Ask runs the agent reasoning loop, calling tools against FalkorDB, validating IDs, and saving memory.
func (a *GeminiAgent) Ask(ctx context.Context, userID, question string, onStep StepListener) (*ChatResponse, error) {
	start := time.Now()
	var steps []AgentStep

	recordStep := func(stepType, toolName, msg string, input, output interface{}) {
		step := AgentStep{
			StepNumber: len(steps) + 1,
			Type:       stepType,
			ToolName:   toolName,
			Input:      input,
			Output:     output,
			Message:    msg,
			Timestamp:  time.Now().UTC(),
		}
		steps = append(steps, step)
		if onStep != nil {
			onStep(step)
		}
	}

	recordStep("thinking", "", fmt.Sprintf("Analyzing question: '%s'", question), nil, nil)

	// Recall past context from user memory graph
	memSummary, _ := a.memoryService.RecallMemory(ctx, userID)
	if memSummary != nil && len(memSummary.Questions) > 0 {
		recordStep("thinking", "", fmt.Sprintf("Recalled %d past inquiries from memory_%s", len(memSummary.Questions), userID), nil, nil)
	}

	// If no Gemini API key is configured, execute deterministic graph agent (Offline / Dev Fallback)
	if a.apiKey == "" {
		log.Println("[INFO] GEMINI_API_KEY not configured. Running deterministic Whyline graph agent...")
		return a.executeDeterministicAgent(ctx, userID, question, recordStep, steps, start)
	}

	// Run Gemini Tool Calling Loop
	return a.executeGeminiLoop(ctx, userID, question, memSummary, recordStep, steps, start)
}

func (a *GeminiAgent) executeGeminiLoop(
	ctx context.Context,
	userID, question string,
	mem *memory.MemorySummary,
	recordStep func(string, string, string, interface{}, interface{}),
	steps []AgentStep,
	start time.Time,
) (*ChatResponse, error) {
	apiURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", a.model, a.apiKey)

	// Construct system instruction and function declarations
	systemPrompt := `You are Whyline, an enterprise AI agent built for Graph Hacks that reasons exclusively over a FalkorDB company graph.
RULES:
1. Always pick a tool first to query the graph. NEVER guess or make up decisions, systems, or people.
2. Tools available:
   - find_entity(query): map conversational text to node IDs.
   - trace_decision(decision_id): multi-hop provenance (Decision -> Ticket -> Thread -> Person -> Document).
   - impact_of(decision_id): variable-length dependency traversal (*1..4) showing what breaks if reversed.
   - who_knows(system_name): find people with contribution weights.
   - bus_factor(system_id): knowledge concentration risk analysis and orphaned systems.
3. If a ticket or thread is missing, report the Honest Gap clearly.
4. Output your final answer citing exact IDs.`

	geminiTools := []map[string]interface{}{
		{
			"functionDeclarations": []map[string]interface{}{
				{
					"name":        "find_entity",
					"description": "Search for decisions, systems, or people to find exact node IDs in FalkorDB",
					"parameters": map[string]interface{}{
						"type": "OBJECT",
						"properties": map[string]interface{}{
							"query": map[string]interface{}{"type": "STRING", "description": "Search keyword or name"},
						},
						"required": []string{"query"},
					},
				},
				{
					"name":        "trace_decision",
					"description": "Trace why a decision was made by following its multi-hop provenance chain in FalkorDB",
					"parameters": map[string]interface{}{
						"type": "OBJECT",
						"properties": map[string]interface{}{
							"decision_id": map[string]interface{}{"type": "STRING", "description": "The decision ID, e.g. dec_billing_v2"},
						},
						"required": []string{"decision_id"},
					},
				},
				{
					"name":        "impact_of",
					"description": "Find what systems break if a decision is changed by traversing incoming dependencies up to 4 hops in FalkorDB",
					"parameters": map[string]interface{}{
						"type": "OBJECT",
						"properties": map[string]interface{}{
							"decision_id": map[string]interface{}{"type": "STRING", "description": "The decision ID, e.g. dec_billing_v2"},
						},
						"required": []string{"decision_id"},
					},
				},
				{
					"name":        "who_knows",
					"description": "Find people who contributed to a system ranked by contribution weights",
					"parameters": map[string]interface{}{
						"type": "OBJECT",
						"properties": map[string]interface{}{
							"system_name": map[string]interface{}{"type": "STRING", "description": "The system name, e.g. billing-api"},
						},
						"required": []string{"system_name"},
					},
				},
				{
					"name":        "bus_factor",
					"description": "Compute knowledge concentration risk and flag orphaned systems with 0 active owners",
					"parameters": map[string]interface{}{
						"type": "OBJECT",
						"properties": map[string]interface{}{
							"system_id": map[string]interface{}{"type": "STRING", "description": "Optional system name or ID"},
						},
					},
				},
			},
		},
	}

	contents := []map[string]interface{}{
		{
			"role": "user",
			"parts": []map[string]interface{}{
				{"text": question},
			},
		},
	}

	var citedIDs []string
	var lastPath *graph.Path
	var lastImpact *tools.ImpactResult
	var lastGap string
	var lastMissing string

	// Loop for up to 4 turns of tool calling
	for turn := 0; turn < 4; turn++ {
		payload := map[string]interface{}{
			"contents": contents,
			"tools":    geminiTools,
			"systemInstruction": map[string]interface{}{
				"parts": []map[string]interface{}{
					{"text": systemPrompt},
				},
			},
		}

		bodyBytes, _ := json.Marshal(payload)
		httpReq, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(bodyBytes))
		if err != nil {
			return nil, err
		}
		httpReq.Header.Set("Content-Type", "application/json")

		resp, err := a.httpClient.Do(httpReq)
		if err != nil {
			log.Printf("[WARN] Gemini API call error: %v. Falling back to deterministic agent.", err)
			return a.executeDeterministicAgent(ctx, userID, question, recordStep, steps, start)
		}
		defer resp.Body.Close()

		respBytes, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusOK {
			log.Printf("[WARN] Gemini API returned status %d (%s). Falling back to deterministic agent.", resp.StatusCode, string(respBytes))
			return a.executeDeterministicAgent(ctx, userID, question, recordStep, steps, start)
		}

		var geminiResp struct {
			Candidates []struct {
				Content struct {
					Parts []map[string]interface{} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}

		if err := json.Unmarshal(respBytes, &geminiResp); err != nil || len(geminiResp.Candidates) == 0 {
			return a.executeDeterministicAgent(ctx, userID, question, recordStep, steps, start)
		}

		parts := geminiResp.Candidates[0].Content.Parts
		hasToolCall := false

		for _, part := range parts {
			if fnCall, ok := part["functionCall"].(map[string]interface{}); ok {
				hasToolCall = true
				fnName := toString(fnCall["name"])
				fnArgs, _ := fnCall["args"].(map[string]interface{})

				recordStep("tool_call", fnName, fmt.Sprintf("Agent called tool: %s", fnName), fnArgs, nil)

				// Execute tool in Go
				resultData, p, imp, gap, miss, ids := a.executeTool(ctx, fnName, fnArgs)
				if p != nil {
					lastPath = p
				}
				if imp != nil {
					lastImpact = imp
				}
				if gap != "" {
					lastGap = gap
					lastMissing = miss
				}
				citedIDs = append(citedIDs, ids...)

				recordStep("tool_result", fnName, fmt.Sprintf("Tool %s returned results from FalkorDB", fnName), nil, resultData)

				// Append function response back to Gemini contents
				fnResp := map[string]interface{}{
					"name": fnName,
					"response": map[string]interface{}{
						"content": resultData,
					},
				}
				if callID, ok := fnCall["id"].(string); ok && callID != "" {
					fnResp["id"] = callID
				}

				contents = append(contents, map[string]interface{}{
					"role":  "model",
					"parts": parts,
				})
				contents = append(contents, map[string]interface{}{
					"role": "user",
					"parts": []map[string]interface{}{
						{"functionResponse": fnResp},
					},
				})
				break
			}
		}

		// If no tool call, Gemini produced the final text answer
		if !hasToolCall {
			var answerBuilder strings.Builder
			for _, part := range parts {
				if t, ok := part["text"].(string); ok {
					answerBuilder.WriteString(t)
				}
			}
			finalAnswer := answerBuilder.String()

			// Validate cited IDs against FalkorDB
			validIDs, invalidIDs := a.validator.ValidateIDs(ctx, citedIDs)

			// Persist question in user memory graph
			var entitiesToSave []memory.EntityRef
			for _, id := range validIDs {
				entitiesToSave = append(entitiesToSave, memory.EntityRef{
					CompanyID: id,
					Name:      id,
					Label:     "Entity",
				})
			}
			_, _ = a.memoryService.SaveQuestion(ctx, userID, question, entitiesToSave)

			return &ChatResponse{
				Question:       question,
				Answer:         finalAnswer,
				CitedEntities:  citedIDs,
				ValidatedIDs:   validIDs,
				InvalidIDs:     invalidIDs,
				GapLevel:       lastGap,
				MissingLink:    lastMissing,
				GraphPath:      lastPath,
				ImpactAnalysis: lastImpact,
				Steps:          steps,
				ExecutionTime:  time.Since(start).String(),
			}, nil
		}
	}

	return a.executeDeterministicAgent(ctx, userID, question, recordStep, steps, start)
}

func (a *GeminiAgent) executeTool(
	ctx context.Context,
	name string,
	args map[string]interface{},
) (interface{}, *graph.Path, *tools.ImpactResult, string, string, []string) {
	var ids []string
	switch name {
	case "find_entity":
		q := toString(args["query"])
		matches, err := a.toolsEngine.FindEntity(ctx, q)
		if err == nil {
			for _, m := range matches {
				ids = append(ids, m.ID)
			}
		}
		return map[string]interface{}{"matches": matches}, nil, nil, "", "", ids

	case "trace_decision":
		id := toString(args["decision_id"])
		ids = append(ids, id)
		tr, err := a.toolsEngine.TraceDecision(ctx, id)
		if err != nil {
			return map[string]string{"error": err.Error()}, nil, nil, "", "", ids
		}
		return tr, tr.Path, nil, tr.GapLevel, tr.MissingLink, ids

	case "impact_of":
		id := toString(args["decision_id"])
		ids = append(ids, id)
		imp, err := a.toolsEngine.ImpactOf(ctx, id)
		if err != nil {
			return map[string]string{"error": err.Error()}, nil, nil, "", "", ids
		}
		for _, s := range imp.ImpactedSystems {
			ids = append(ids, s.SystemID)
		}
		return imp, nil, imp, "", "", ids

	case "who_knows":
		sys := toString(args["system_name"])
		wk, err := a.toolsEngine.WhoKnows(ctx, sys)
		if err != nil {
			return map[string]string{"error": err.Error()}, nil, nil, "", "", ids
		}
		for _, c := range wk.Contributors {
			ids = append(ids, c.PersonID)
		}
		return wk, nil, nil, "", "", ids

	case "bus_factor":
		sys := toString(args["system_id"])
		bf, err := a.toolsEngine.BusFactor(ctx, sys)
		if err != nil {
			return map[string]string{"error": err.Error()}, nil, nil, "", "", ids
		}
		for _, s := range bf.OrphanedSystems {
			ids = append(ids, s.SystemID)
		}
		return bf, nil, nil, "", "", ids
	}

	return map[string]string{"error": "unknown tool"}, nil, nil, "", "", ids
}

// executeDeterministicAgent runs rule-based tool execution when API key is not present.
func (a *GeminiAgent) executeDeterministicAgent(
	ctx context.Context,
	userID, question string,
	recordStep func(string, string, string, interface{}, interface{}),
	steps []AgentStep,
	start time.Time,
) (*ChatResponse, error) {
	qLower := strings.ToLower(question)

	var citedIDs []string
	var lastPath *graph.Path
	var lastImpact *tools.ImpactResult
	var gapLevel string = "NONE"
	var missingLink string
	var answerText string

	// Step 1: Entity lookup
	recordStep("tool_call", "find_entity", "Resolving entities in user query against FalkorDB", map[string]string{"query": question}, nil)
	entities, _ := a.toolsEngine.FindEntity(ctx, question)
	recordStep("tool_result", "find_entity", fmt.Sprintf("Found %d matching graph entities", len(entities)), nil, entities)

	for _, e := range entities {
		citedIDs = append(citedIDs, e.ID)
	}

	// Step 2: Route question
	if strings.Contains(qLower, "break") || strings.Contains(qLower, "impact") || strings.Contains(qLower, "reverse") {
		// Impact analysis
		targetDecision := "dec_billing_v2"
		for _, e := range entities {
			if e.Label == "Decision" {
				targetDecision = e.ID
				break
			}
		}

		recordStep("tool_call", "impact_of", fmt.Sprintf("Running variable-length dependency traversal for %s", targetDecision), map[string]string{"decision_id": targetDecision}, nil)
		imp, _ := a.toolsEngine.ImpactOf(ctx, targetDecision)
		lastImpact = imp
		recordStep("tool_result", "impact_of", fmt.Sprintf("Traversed dependencies: %d systems impacted", len(imp.ImpactedSystems)), nil, imp)

		var impNames []string
		for _, s := range imp.ImpactedSystems {
			citedIDs = append(citedIDs, s.SystemID)
			impNames = append(impNames, fmt.Sprintf("**%s** (Severity: %.1f, %d hops)", s.SystemName, s.SeverityScore, s.HopDistance))
		}

		answerText = fmt.Sprintf("Reversing decision `%s` on system `%s` impacts %d downstream systems:\n\n%s\n\nProof path traversed incoming `[:DEPENDS_ON*1..4]` edges in FalkorDB.",
			targetDecision, imp.ChangedSystem, len(imp.ImpactedSystems), strings.Join(impNames, "\n- "))

	} else if strings.Contains(qLower, "orphan") || strings.Contains(qLower, "lose") || strings.Contains(qLower, "bus factor") || strings.Contains(qLower, "left") {
		// Bus factor & orphaned system
		recordStep("tool_call", "bus_factor", "Calculating active owners vs transitive dependents across systems", nil, nil)
		bf, _ := a.toolsEngine.BusFactor(ctx, "")
		recordStep("tool_result", "bus_factor", fmt.Sprintf("Found %d orphaned systems with 0 active owners", len(bf.OrphanedSystems)), nil, bf)

		if len(bf.OrphanedSystems) > 0 {
			orph := bf.OrphanedSystems[0]
			citedIDs = append(citedIDs, orph.SystemID)
			answerText = fmt.Sprintf("⚠️ **Orphaned System Alert**: **%s** has **0 active owners** (owner Dave Miller departed the company), yet **%d systems transitively depend on it**! Risk score: **%.1f** (Rank #1).\n\nAction: Immediate knowledge transfer is required.",
				orph.SystemName, orph.TransitiveDependents, orph.RiskScore)
		}

	} else if strings.Contains(qLower, "who knows") || strings.Contains(qLower, "worked on") || strings.Contains(qLower, "expert") {
		// Who knows
		targetSys := "billing-api"
		for _, e := range entities {
			if e.Label == "System" {
				targetSys = e.Name
				break
			}
		}

		recordStep("tool_call", "who_knows", fmt.Sprintf("Traversing weighted contributions for %s", targetSys), map[string]string{"system_name": targetSys}, nil)
		wk, _ := a.toolsEngine.WhoKnows(ctx, targetSys)
		recordStep("tool_result", "who_knows", fmt.Sprintf("Found %d contributors with weighted edges", len(wk.Contributors)), nil, wk)

		var contribs []string
		for _, c := range wk.Contributors {
			citedIDs = append(citedIDs, c.PersonID)
			contribs = append(contribs, fmt.Sprintf("**%s** (%s) - %d contributions", c.Name, c.Role, c.Contributions))
		}
		answerText = fmt.Sprintf("Top experts who contributed to **%s**:\n\n- %s", targetSys, strings.Join(contribs, "\n- "))

	} else {
		// Provenance Trace (The "Why?" Question)
		targetDecision := "dec_billing_v2"
		for _, e := range entities {
			if e.Label == "Decision" {
				targetDecision = e.ID
				break
			}
		}

		recordStep("tool_call", "trace_decision", fmt.Sprintf("Tracing provenance path for decision %s", targetDecision), map[string]string{"decision_id": targetDecision}, nil)
		tr, _ := a.toolsEngine.TraceDecision(ctx, targetDecision)
		lastPath = tr.Path
		gapLevel = tr.GapLevel
		missingLink = tr.MissingLink
		recordStep("tool_result", "trace_decision", "Provenance chain retrieved from FalkorDB", nil, tr)

		if tr.GapLevel != "NONE" {
			answerText = fmt.Sprintf("Decision: **%s** (`%s`)\n\n⚠️ **Honest Gap Detected**: %s\n\nNo further rationale was recorded in the connected company graph sources.",
				tr.Title, tr.DecisionID, tr.MissingLink)
		} else {
			answerText = fmt.Sprintf("Decision: **%s**\n\n- **Decided by**: %s (%s)\n- **Approved in Ticket**: [%s](%s)\n- **Rationale from Thread**: *\"%s\"*\n- **RFC Documentation**: [%s](%s)\n\nFull multi-hop provenance verified across 4 hops in FalkorDB.",
				tr.Title, tr.DeciderName, tr.DeciderRole, tr.TicketTitle, tr.TicketURL, tr.ThreadExcerpt, tr.DocumentTitle, tr.DocumentURL)
		}
	}

	// Validate cited IDs against FalkorDB
	validIDs, invalidIDs := a.validator.ValidateIDs(ctx, citedIDs)

	// Save to user personal memory graph
	var entitiesToSave []memory.EntityRef
	for _, id := range validIDs {
		entitiesToSave = append(entitiesToSave, memory.EntityRef{
			CompanyID: id,
			Name:      id,
			Label:     "Entity",
		})
	}
	_, _ = a.memoryService.SaveQuestion(ctx, userID, question, entitiesToSave)

	return &ChatResponse{
		Question:       question,
		Answer:         answerText,
		CitedEntities:  citedIDs,
		ValidatedIDs:   validIDs,
		InvalidIDs:     invalidIDs,
		GapLevel:       gapLevel,
		MissingLink:    missingLink,
		GraphPath:      lastPath,
		ImpactAnalysis: lastImpact,
		Steps:          steps,
		ExecutionTime:  time.Since(start).String(),
	}, nil
}

func toString(val interface{}) string {
	if val == nil {
		return ""
	}
	return fmt.Sprintf("%v", val)
}

