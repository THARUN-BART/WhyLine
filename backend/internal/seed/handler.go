package seed

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	seeder *Seeder
}

func NewHandler(seeder *Seeder) *Handler {
	return &Handler{seeder: seeder}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/api/seed", func(r chi.Router) {
		r.Post("/load", h.HandleLoad)
		r.Post("/reset", h.HandleReset)
	})
}

func (h *Handler) HandleLoad(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if err := h.seeder.SeedAll(ctx); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": "Synthetic company dataset successfully loaded into FalkorDB",
	})
}

func (h *Handler) HandleReset(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	// Clear non-User knowledge nodes first
	clearQuery := "MATCH (n) WHERE NOT n:User DETACH DELETE n"
	_, _ = h.seeder.client.Query(ctx, h.seeder.graphName, clearQuery, nil)

	// Re-seed pristine data
	if err := h.seeder.SeedAll(ctx); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "success",
		"message": "Company knowledge graph successfully reset and re-seeded to pristine demo state",
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
