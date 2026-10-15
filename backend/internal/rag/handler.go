package rag

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// Handler handles HTTP requests for Vs-RAG baseline comparisons.
type Handler struct {
	service *Service
}

// NewHandler creates a new RAG Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers RAG endpoints onto the chi router.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/api/rag", func(r chi.Router) {
		r.Get("/chunks", h.HandleGetChunks)
		r.Get("/presets", h.HandleGetPresets)
		r.Post("/search", h.HandleSearch)
		r.Post("/compare", h.HandleCompare)
	})
}

// HandleGetChunks returns all ingested chunks.
func (h *Handler) HandleGetChunks(w http.ResponseWriter, r *http.Request) {
	chunks := h.service.GetChunks()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"total":  len(chunks),
		"chunks": chunks,
	})
}

// HandleGetPresets returns benchmark questions.
func (h *Handler) HandleGetPresets(w http.ResponseWriter, r *http.Request) {
	presets := h.service.GetPresets()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"presets": presets,
	})
}

// HandleSearch performs cosine similarity search.
func (h *Handler) HandleSearch(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req SearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json body"}`, http.StatusBadRequest)
		return
	}

	if req.Query == "" {
		http.Error(w, `{"error":"query is required"}`, http.StatusBadRequest)
		return
	}

	results, err := h.service.Search(req.Query, req.TopK)
	if err != nil {
		http.Error(w, `{"error":"search failed"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"query":   req.Query,
		"top_k":   req.TopK,
		"results": results,
	})
}

// HandleCompare runs the split-screen comparison between Vector RAG and FalkorDB.
func (h *Handler) HandleCompare(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req CompareRequest
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}

	comparison, err := h.service.Compare(r.Context(), req.Question, req.PresetID)
	if err != nil {
		http.Error(w, `{"error":"comparison failed"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(comparison)
}
