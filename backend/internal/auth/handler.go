package auth

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service *Service
	limiter *IPRateLimiter
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
		limiter: NewIPRateLimiter(10, time.Minute),
	}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Route("/api/auth", func(r chi.Router) {
		r.Group(func(public chi.Router) {
			public.Use(h.limiter.Middleware)
			public.Post("/send-otp", h.HandleSendOTP)
			public.Post("/verify-otp", h.HandleVerifyOTP)
			public.Post("/register", h.HandleRegister)
			public.Post("/login", h.HandleLogin)
		})
		r.Get("/companies", h.HandleListCompanies) // Public: Available companies for signup select

		// Protected user routes
		r.Group(func(r chi.Router) {
			r.Use(h.service.Middleware)
			r.Get("/me", h.HandleMe)
		})

		r.Group(func(r chi.Router) {
			r.Use(h.service.Middleware)
			r.Use(h.service.AdminMiddleware)
			r.Get("/users", h.HandleListUsers)
		})

		// Protected company management routes (company_admin or platform admin)
		r.Group(func(r chi.Router) {
			r.Use(h.service.Middleware)
			r.Use(h.service.CompanyAdminMiddleware)
			r.Get("/company/employees", h.HandleListCompanyEmployees)
			r.Post("/company/approve-user", h.HandleApproveUser)
			r.Get("/company/stats", h.HandleGetCompanyStats)
		})

		// Protected platform admin-only routes
		r.Group(func(r chi.Router) {
			r.Use(h.service.Middleware)
			r.Use(h.service.AdminMiddleware)
			r.Post("/admin/register", h.HandleAdminRegister)
			r.Post("/companies", h.HandleCreateCompany)
			r.Post("/admin/create-user", h.HandleAdminCreateCompanyUser)
		})
	})
}

func (h *Handler) HandleSendOTP(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit
	var req SendOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if err := h.service.SendOTP(req.Email); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to send OTP"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "OTP verification code sent to " + req.Email,
	})
}

func (h *Handler) HandleVerifyOTP(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit
	var req VerifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if err := h.service.VerifyOTP(req.Email, req.OTP); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Email successfully verified",
	})
}

func (h *Handler) HandleRegister(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	resp, err := h.service.Register(req)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrUserAlreadyExists {
			status = http.StatusConflict
		}
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1MB limit
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	resp, err := h.service.Login(req)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) HandleMe(w http.ResponseWriter, r *http.Request) {
	userID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	user, err := h.service.GetUserByID(userID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}

	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) HandleListUsers(w http.ResponseWriter, r *http.Request) {
	users := h.service.repo.ListAll()
	var responses []UserResponse
	for _, u := range users {
		responses = append(responses, u.ToResponse())
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"users": responses,
	})
}

func (h *Handler) HandleAdminRegister(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req AdminRegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	resp, err := h.service.RegisterAdmin(req)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrUserAlreadyExists {
			status = http.StatusConflict
		} else if strings.Contains(err.Error(), "admin secret") {
			status = http.StatusForbidden
		}
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) HandleListCompanies(w http.ResponseWriter, r *http.Request) {
	companies, err := h.service.ListCompanies()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to list companies"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"total":     len(companies),
		"companies": companies,
	})
}

func (h *Handler) HandleCreateCompany(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req CreateCompanyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "company name cannot be empty"})
		return
	}

	adminUserID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	company, err := h.service.CreateCompany(adminUserID, req.Name)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Company created successfully",
		"company": company,
	})
}

func (h *Handler) HandleAdminCreateCompanyUser(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req AdminCreateCompanyUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	adminUserID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	resp, err := h.service.AdminCreateCompanyAndUser(adminUserID, req)
	if err != nil {
		status := http.StatusBadRequest
		if err == ErrUserAlreadyExists {
			status = http.StatusConflict
		}
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) HandleApproveUser(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	var req ApproveUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.UserID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_id is required"})
		return
	}

	callerID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	status := req.Status
	if status == "" {
		status = "approved"
	}

	userResp, err := h.service.ApproveCompanyUser(callerID, req.UserID, status)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "User status updated to " + status,
		"user":    userResp,
	})
}

func (h *Handler) HandleListCompanyEmployees(w http.ResponseWriter, r *http.Request) {
	callerID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	statusFilter := r.URL.Query().Get("status") // e.g. "pending", "approved", or "" for all
	employees, err := h.service.ListCompanyEmployees(callerID, statusFilter)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"total":     len(employees),
		"employees": employees,
	})
}

func (h *Handler) HandleGetCompanyStats(w http.ResponseWriter, r *http.Request) {
	callerID, ok := GetUserIDFromContext(r.Context())
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}

	targetCompany := r.URL.Query().Get("company")
	stats, err := h.service.GetCompanyStats(callerID, targetCompany)
	if err != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, stats)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

