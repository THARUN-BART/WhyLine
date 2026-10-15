package agent

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/THARUN-BART/whyline/backend/internal/auth"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	agent *GeminiAgent
}

func NewHandler(agent *GeminiAgent) *Handler {
	return &Handler{agent: agent}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/api/agent", func(r chi.Router) {
		r.Post("/chat", h.HandleChat)
	})
}

func (h *Handler) getUserID(r *http.Request, reqUserID string) string {
	// Fix #8: Only read userID from JWT context — never from query params or anonymous defaults.
	if userID, ok := auth.GetUserIDFromContext(r.Context()); ok && userID != "" {
		return userID
	}
	return ""
}

func (h *Handler) HandleChat(w http.ResponseWriter, r *http.Request) {
	// Fix #10: Limit request body to 1MB.
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

	var req ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON request body"})
		return
	}

	if strings.TrimSpace(req.Question) == "" {
		if strings.TrimSpace(req.Prompt) != "" {
			req.Question = req.Prompt
		} else if strings.TrimSpace(req.Message) != "" {
			req.Question = req.Message
		}
	}

	if strings.TrimSpace(req.Question) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "question cannot be empty"})
		return
	}

	userID := h.getUserID(r, req.UserID)
	if userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	// Check if SSE streaming is requested
	isSSE := req.Stream || strings.Contains(r.Header.Get("Accept"), "text/event-stream")

	if isSSE {
		h.handleSSEChat(w, r, userID, req.Question)
		return
	}

	// Standard synchronous JSON response
	response, err := h.agent.Ask(r.Context(), userID, req.Question, nil)
	if err != nil {
		// Fix #18: Do not expose internal error details to the client.
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "agent request failed"})
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) handleSSEChat(w http.ResponseWriter, r *http.Request, userID, question string) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "streaming not supported"})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	onStep := func(step AgentStep) {
		data, _ := json.Marshal(step)
		_, _ = fmt.Fprintf(w, "event: step\ndata: %s\n\n", string(data))
		flusher.Flush()
	}

	response, err := h.agent.Ask(r.Context(), userID, question, onStep)
	if err != nil {
		// Fix #18: Do not expose internal error details over SSE.
		errData, _ := json.Marshal(map[string]string{"error": "agent request failed"})
		_, _ = fmt.Fprintf(w, "event: error\ndata: %s\n\n", string(errData))
		flusher.Flush()
		return
	}

	// Stream final complete answer payload
	ansData, _ := json.Marshal(response)
	_, _ = fmt.Fprintf(w, "event: answer\ndata: %s\n\n", string(ansData))
	_, _ = fmt.Fprintf(w, "event: done\ndata: {\"status\":\"completed\"}\n\n")
	flusher.Flush()
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
