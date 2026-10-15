package tools

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	engine *Engine
}

func NewHandler(engine *Engine) *Handler {
	return &Handler{engine: engine}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/api/tools", func(r chi.Router) {
		r.Get("/find-entity", h.HandleFindEntity)
		r.Get("/trace-decision", h.HandleTraceDecision)
		r.Get("/impact-of", h.HandleImpactOf)
		r.Get("/who-knows", h.HandleWhoKnows)
		r.Get("/bus-factor", h.HandleBusFactor)
	})
}

func (h *Handler) HandleFindEntity(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "query parameter 'q' is required"})
		return
	}

	matches, err := h.engine.FindEntity(r.Context(), q)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"query":   q,
		"matches": matches,
	})
}

func (h *Handler) HandleTraceDecision(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "parameter 'id' is required"})
		return
	}

	trace, err := h.engine.TraceDecision(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, trace)
}

func (h *Handler) HandleImpactOf(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "parameter 'id' is required"})
		return
	}

	impact, err := h.engine.ImpactOf(r.Context(), id)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, impact)
}

func (h *Handler) HandleWhoKnows(w http.ResponseWriter, r *http.Request) {
	system := r.URL.Query().Get("system")
	if system == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "parameter 'system' is required"})
		return
	}

	res, err := h.engine.WhoKnows(r.Context(), system)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, res)
}

func (h *Handler) HandleBusFactor(w http.ResponseWriter, r *http.Request) {
	system := r.URL.Query().Get("system")
	report, err := h.engine.BusFactor(r.Context(), system)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, report)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
