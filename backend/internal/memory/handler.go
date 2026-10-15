package memory

import (
	"encoding/json"
	"net/http"

	"github.com/THARUN-BART/whyline/backend/internal/auth"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/api/memory", func(r chi.Router) {
		r.Get("/", h.HandleRecall)
		r.Post("/save", h.HandleSaveQuestion)
		r.Post("/simulate", h.HandleSimulateChange)
		r.Post("/reset", h.HandleReset)
	})
}

func (h *Handler) getUserID(r *http.Request) string {
	// First check authenticated JWT context
	if userID, ok := auth.GetUserIDFromContext(r.Context()); ok && userID != "" {
		return userID
	}
	// Fall back to query param ?user_id=... (useful for demo user picker)
	if qID := r.URL.Query().Get("user_id"); qID != "" {
		return qID
	}
	return "usr_demo"
}

func (h *Handler) HandleRecall(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	summary, err := h.service.RecallMemory(r.Context(), userID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func (h *Handler) HandleSaveQuestion(w http.ResponseWriter, r *http.Request) {
	var req SaveQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	if req.Question == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "question cannot be empty"})
		return
	}

	if req.UserID == "" {
		req.UserID = h.getUserID(r)
	}

	record, err := h.service.SaveQuestion(r.Context(), req.UserID, req.Question, req.Entities)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, record)
}

func (h *Handler) HandleSimulateChange(w http.ResponseWriter, r *http.Request) {
	var req SimulateChangeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	if req.UserID == "" {
		req.UserID = h.getUserID(r)
	}

	simulation, err := h.service.SimulateChange(r.Context(), req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, simulation)
}

func (h *Handler) HandleReset(w http.ResponseWriter, r *http.Request) {
	userID := h.getUserID(r)
	if err := h.service.ResetMemory(r.Context(), userID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Memory graph for user " + userID + " reset successfully",
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
