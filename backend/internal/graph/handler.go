package graph

import (
	"encoding/json"
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	client    *Client
	graphName string
}

func NewHandler(client *Client, graphName string) *Handler {
	return &Handler{
		client:    client,
		graphName: graphName,
	}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/api/graph", func(r chi.Router) {
		r.Get("/stats", h.HandleStats)
		r.Post("/query", h.HandleQuery)
		r.Post("/reset", h.HandleReset)
	})
}

type QueryPayload struct {
	Query     string                 `json:"query"`
	GraphName string                 `json:"graph_name,omitempty"`
	Params    map[string]interface{} `json:"params,omitempty"`
}

var graphNameRegex = regexp.MustCompile(`^[a-zA-Z0-9_\-]+$`)

func isValidGraphName(name string) bool {
	return len(name) > 0 && len(name) <= 64 && graphNameRegex.MatchString(name)
}

func (h *Handler) HandleStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	graphName := r.URL.Query().Get("graph")
	if graphName == "" {
		graphName = h.graphName
	}
	if !isValidGraphName(graphName) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid graph name: must be alphanumeric, underscores or hyphens"})
		return
	}

	nodes, err := h.client.CountNodes(ctx, graphName)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to retrieve graph stats"})
		return
	}

	edges, err := h.client.CountEdges(ctx, graphName)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to retrieve graph stats"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"graph":       graphName,
		"total_nodes": nodes,
		"total_edges": edges,
		"status":      "connected",
	})
}

func (h *Handler) HandleQuery(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // Fix #10: 1MB limit
	ctx := r.Context()
	var payload QueryPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	if payload.Query == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "query cannot be empty"})
		return
	}

	graphName := payload.GraphName
	if graphName == "" {
		graphName = h.graphName
	}
	if !isValidGraphName(graphName) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid graph name: must be alphanumeric, underscores or hyphens"})
		return
	}

	res, err := h.client.Query(ctx, graphName, payload.Query, payload.Params)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "query execution failed"})
		return
	}

	writeJSON(w, http.StatusOK, res)
}

func (h *Handler) HandleReset(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	graphName := r.URL.Query().Get("graph")
	if graphName == "" {
		graphName = h.graphName
	}
	if !isValidGraphName(graphName) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid graph name: must be alphanumeric, underscores or hyphens"})
		return
	}

	if err := h.client.DeleteGraph(ctx, graphName); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to reset graph"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Graph " + graphName + " successfully deleted",
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
