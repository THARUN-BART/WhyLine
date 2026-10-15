package ticket

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/THARUN-BART/whyline/backend/internal/auth"
	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes mounts ticket endpoints onto Chi router.
func (h *Handler) RegisterRoutes(r chi.Router, authMiddleware func(http.Handler) http.Handler, approvedMiddleware func(http.Handler) http.Handler) {
	r.Route("/api/tickets", func(r chi.Router) {
		// Strict authentication & approval middleware
		if authMiddleware != nil {
			r.Use(authMiddleware)
		}
		if approvedMiddleware != nil {
			r.Use(approvedMiddleware)
		}

		r.Post("/", h.HandleCreateTicket)
		r.Get("/", h.HandleListTickets)
		r.Get("/{id}", h.HandleGetTicket)
		r.Put("/{id}", h.HandleUpdateTicket)
	})
}

// HandleCreateTicket handles POST /api/tickets
func (h *Handler) HandleCreateTicket(w http.ResponseWriter, r *http.Request) {
	var req CreateTicketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	if strings.TrimSpace(req.Title) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ticket title cannot be empty"})
		return
	}

	userID := ""
	company := ""
	if claims, ok := auth.GetClaimsFromContext(r.Context()); ok && claims != nil {
		userID = claims.UserID
		company = claims.Company
	}
	if userID == "" {
		if uid, ok := auth.GetUserIDFromContext(r.Context()); ok {
			userID = uid
		}
	}

	ticket, err := h.service.CreateTicket(r.Context(), userID, company, req)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, ticket)
}

// HandleListTickets handles GET /api/tickets
func (h *Handler) HandleListTickets(w http.ResponseWriter, r *http.Request) {
	companyFilter := ""
	if claims, ok := auth.GetClaimsFromContext(r.Context()); ok && claims != nil {
		if claims.Role != "admin" {
			companyFilter = claims.Company
		}
	}
	// Query param override if specified
	if qCompany := r.URL.Query().Get("company"); qCompany != "" {
		companyFilter = qCompany
	}

	tickets, err := h.service.ListTickets(r.Context(), companyFilter)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"total":   len(tickets),
		"tickets": tickets,
	})
}

// HandleGetTicket handles GET /api/tickets/{id}
func (h *Handler) HandleGetTicket(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing ticket id"})
		return
	}

	ticket, err := h.service.GetTicketByID(r.Context(), id)
	if err != nil {
		if err == ErrTicketNotFound {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "ticket not found"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, ticket)
}

// HandleUpdateTicket handles PUT /api/tickets/{id}
func (h *Handler) HandleUpdateTicket(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing ticket id"})
		return
	}

	var req UpdateTicketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	ticket, err := h.service.UpdateTicket(r.Context(), id, req)
	if err != nil {
		if err == ErrTicketNotFound {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "ticket not found"})
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, ticket)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
