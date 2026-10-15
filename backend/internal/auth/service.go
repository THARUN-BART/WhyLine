package auth

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid email/username or password")
	ErrInvalidToken       = errors.New("invalid or expired authentication token")
	ErrEmptyFields        = errors.New("email, username, and password are required")
	ErrPasswordTooShort   = errors.New("password must be at least 12 characters")
	ErrEmailNotVerified   = errors.New("email not verified: please verify your email with OTP first")
)

type JWTClaims struct {
	UserID         string `json:"user_id"`
	Email          string `json:"email"`
	Username       string `json:"username"`
	Company        string `json:"company"`
	Role           string `json:"role"`
	ApprovalStatus string `json:"approval_status"`
	jwt.RegisteredClaims
}

type Service struct {
	repo        Repository
	jwtSecret   []byte
	jwtExpiry   time.Duration
	otpManager  *OTPManager
	adminSecret string
}

func NewService(repo Repository, jwtSecret string, jwtExpiry time.Duration, otpManager *OTPManager, adminSecret string) *Service {
	return &Service{
		repo:        repo,
		jwtSecret:   []byte(jwtSecret),
		jwtExpiry:   jwtExpiry,
		otpManager:  otpManager,
		adminSecret: adminSecret,
	}
}

// SendOTP generates an OTP and emails it to the user.
func (s *Service) SendOTP(email string) error {
	email = strings.TrimSpace(email)
	if email == "" || !strings.Contains(email, "@") {
		return errors.New("a valid email address is required")
	}

	code, err := s.otpManager.GenerateAndStore(email)
	if err != nil {
		return err
	}

	return s.otpManager.SendEmail(email, code)
}

// VerifyOTP validates the OTP code.
func (s *Service) VerifyOTP(email, code string) error {
	email = strings.TrimSpace(email)
	code = strings.TrimSpace(code)
	if email == "" || code == "" {
		return errors.New("email and OTP code are required")
	}

	return s.otpManager.Verify(email, code)
}

func (s *Service) Register(req RegisterRequest) (*AuthResponse, error) {
	email := strings.TrimSpace(req.Email)
	username := strings.TrimSpace(req.Username)
	password := strings.TrimSpace(req.Password)
	company := strings.TrimSpace(req.Company)

	if email == "" || username == "" || password == "" {
		return nil, ErrEmptyFields
	}
	if len(email) > 254 || len(username) > 50 || len(company) > 100 {
		return nil, errors.New("input too long: email max 254, username max 50, company max 100 characters")
	}
	if len(password) < 12 {
		return nil, ErrPasswordTooShort
	}

	if company == "" {
		return nil, errors.New("company is required: please select from available registered companies")
	}

	// Validate that the company is registered by an admin
	exists, err := s.repo.CompanyExists(company)
	if err != nil || !exists {
		return nil, fmt.Errorf("company '%s' is not registered. Please select an available company created by an admin", company)
	}

	isVerified := false
	// Check if OTP was passed in registration payload
	if req.OTP != "" {
		if err := s.otpManager.Verify(email, req.OTP); err != nil {
			return nil, err
		}
		isVerified = true
		s.otpManager.ConsumeVerification(email)
	} else if s.otpManager.IsVerified(email) {
		isVerified = true
		s.otpManager.ConsumeVerification(email)
	} else {
		// Employees register and start in pending state awaiting company admin approval
		isVerified = false
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	userID := uuid.New().String()
	user := &User{
		ID:             userID,
		Email:          email,
		Username:       username,
		Company:        company,
		PasswordHash:   string(hashedPassword),
		Role:           "user",
		ApprovalStatus: "pending", // Employees start as pending until company main user approves!
		IsVerified:     isVerified,
		CreatedAt:      time.Now().UTC(),
	}

	if err := s.repo.Create(user); err != nil {
		return nil, err
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &AuthResponse{
		Token: token,
		User:  user.ToResponse(),
	}, nil
}

// RegisterAdmin creates a new administrator using username, password, email, and admin secret key.
func (s *Service) RegisterAdmin(req AdminRegisterRequest) (*AuthResponse, error) {
	email := strings.TrimSpace(req.Email)
	username := strings.TrimSpace(req.Username)
	password := strings.TrimSpace(req.Password)
	secret := strings.TrimSpace(req.AdminSecret)

	if email == "" || username == "" || password == "" {
		return nil, ErrEmptyFields
	}
	if len(password) < 12 {
		return nil, ErrPasswordTooShort
	}
	if secret == "" || secret != s.adminSecret {
		return nil, errors.New("invalid or unauthorized admin secret key")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	userID := "adm_" + uuid.New().String()[:8]
	user := &User{
		ID:             userID,
		Email:          email,
		Username:       username,
		Company:        "Whyline Platform",
		PasswordHash:   string(hashedPassword),
		Role:           "admin",
		ApprovalStatus: "approved",
		IsVerified:     true,
		CreatedAt:      time.Now().UTC(),
	}

	if err := s.repo.Create(user); err != nil {
		return nil, err
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &AuthResponse{
		Token: token,
		User:  user.ToResponse(),
	}, nil
}

// AdminCreateCompanyAndUser creates a company and its main user (company_admin) directly.
func (s *Service) AdminCreateCompanyAndUser(callerAdminID string, req AdminCreateCompanyUserRequest) (*AuthResponse, error) {
	admin, err := s.repo.FindByID(callerAdminID)
	if err != nil || admin.Role != "admin" {
		return nil, errors.New("admin privileges required: only platform administrators can create company accounts")
	}

	companyName := strings.TrimSpace(req.CompanyName)
	email := strings.TrimSpace(req.Email)
	username := strings.TrimSpace(req.Username)
	password := strings.TrimSpace(req.Password)

	if companyName == "" || email == "" || username == "" || password == "" {
		return nil, ErrEmptyFields
	}
	if len(password) < 12 {
		return nil, ErrPasswordTooShort
	}

	// 1. Ensure company exists or create it
	if _, err := s.repo.CreateCompany(companyName); err != nil {
		return nil, fmt.Errorf("failed to create company: %w", err)
	}

	// 2. Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	role := strings.TrimSpace(req.Role)
	if role == "" {
		role = "company_admin"
	}

	userID := "usr_" + uuid.New().String()[:8]
	user := &User{
		ID:             userID,
		Email:          email,
		Username:       username,
		Company:        companyName,
		PasswordHash:   string(hashedPassword),
		Role:           role,
		ApprovalStatus: "approved", // Main company user created by admin is automatically approved
		IsVerified:     true,
		CreatedAt:      time.Now().UTC(),
	}

	if err := s.repo.Create(user); err != nil {
		return nil, err
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &AuthResponse{
		Token: token,
		User:  user.ToResponse(),
	}, nil
}

// ApproveCompanyUser allows the company main user (company_admin) or platform admin to approve or reject employee registrations.
func (s *Service) ApproveCompanyUser(callerUserID string, targetUserID string, status string) (*UserResponse, error) {
	caller, err := s.repo.FindByID(callerUserID)
	if err != nil {
		return nil, errors.New("caller user not found")
	}

	target, err := s.repo.FindByID(targetUserID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	// Check permissions: platform admin can approve any user; company_admin can approve users of their company
	if caller.Role != "admin" {
		if caller.Role != "company_admin" {
			return nil, errors.New("forbidden: only company main users or platform admins can approve employee accounts")
		}
		if !strings.EqualFold(caller.Company, target.Company) {
			return nil, errors.New("forbidden: you can only approve employees belonging to your own company")
		}
	}

	cleanStatus := strings.ToLower(strings.TrimSpace(status))
	if cleanStatus != "approved" && cleanStatus != "rejected" && cleanStatus != "pending" {
		return nil, errors.New("invalid status: must be 'approved', 'rejected', or 'pending'")
	}

	if err := s.repo.UpdateApprovalStatus(targetUserID, cleanStatus); err != nil {
		return nil, err
	}

	target.ApprovalStatus = cleanStatus
	resp := target.ToResponse()
	return &resp, nil
}

// ListCompanyEmployees returns users belonging to the caller's company.
func (s *Service) ListCompanyEmployees(callerUserID string, statusFilter string) ([]UserResponse, error) {
	caller, err := s.repo.FindByID(callerUserID)
	if err != nil {
		return nil, errors.New("caller user not found")
	}

	var users []*User
	if caller.Role == "admin" {
		// Platform admin can view all users
		users = s.repo.ListAll()
	} else {
		// Company user/admin views their company's users
		users, err = s.repo.ListUsersByCompany(caller.Company, statusFilter)
		if err != nil {
			return nil, err
		}
	}

	var responses []UserResponse
	for _, u := range users {
		if statusFilter == "" || strings.EqualFold(u.ApprovalStatus, statusFilter) {
			responses = append(responses, u.ToResponse())
		}
	}
	return responses, nil
}

// CreateCompany creates a new company in the knowledge graph (admin-only).
func (s *Service) CreateCompany(adminUserID, name string) (*Company, error) {
	admin, err := s.repo.FindByID(adminUserID)
	if err != nil || admin.Role != "admin" {
		return nil, errors.New("admin privileges required: only administrators can add companies")
	}
	return s.repo.CreateCompany(name)
}

// ListCompanies returns all companies available for user signup.
func (s *Service) ListCompanies() ([]*Company, error) {
	return s.repo.ListCompanies()
}

// GetCompanyStats returns the user count and metrics for a company alone.
// Company admins are strictly restricted to viewing only their own company's stats.
func (s *Service) GetCompanyStats(callerUserID, requestedCompany string) (*CompanyStats, error) {
	caller, err := s.repo.FindByID(callerUserID)
	if err != nil {
		return nil, errors.New("caller user not found")
	}

	targetCompany := strings.TrimSpace(requestedCompany)

	// Company admins can only see their own company alone
	if caller.Role == "company_admin" {
		if targetCompany != "" && !strings.EqualFold(targetCompany, caller.Company) {
			return nil, errors.New("forbidden: you can only view statistics for your own company")
		}
		targetCompany = caller.Company
	} else if caller.Role == "admin" {
		if targetCompany == "" {
			targetCompany = caller.Company
		}
	} else {
		// Normal users
		targetCompany = caller.Company
	}

	if targetCompany == "" {
		targetCompany = "Whyline"
	}

	return s.repo.GetCompanyStats(targetCompany)
}

func (s *Service) Login(req LoginRequest) (*AuthResponse, error) {
	identifier := strings.TrimSpace(req.Email)
	password := req.Password

	if identifier == "" || password == "" {
		return nil, ErrInvalidCredentials
	}

	var user *User
	var err error

	if strings.Contains(identifier, "@") {
		user, err = s.repo.FindByEmail(identifier)
		if err != nil {
			user, err = s.repo.FindByUsername(identifier)
		}
	} else {
		user, err = s.repo.FindByUsername(identifier)
		if err != nil {
			user, err = s.repo.FindByEmail(identifier)
		}
	}

	if err != nil {
		return nil, ErrInvalidCredentials
	}

	// Verify password using bcrypt only — plaintext comparison is never allowed
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	return &AuthResponse{
		Token: token,
		User:  user.ToResponse(),
	}, nil
}

func (s *Service) ValidateToken(tokenStr string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(
		tokenStr,
		&JWTClaims{},
		func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf(
					"unexpected signing method: %v",
					token.Header["alg"],
				)
			}

			return s.jwtSecret, nil
		},
	)

	if err != nil {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}
func (s *Service) GetUserByID(id string) (*UserResponse, error) {
	user, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	resp := user.ToResponse()
	return &resp, nil
}

func (s *Service) generateToken(user *User) (string, error) {
	now := time.Now().UTC()
	approval := user.ApprovalStatus
	if approval == "" {
		approval = "approved"
	}
	claims := JWTClaims{
		UserID:         user.ID,
		Email:          user.Email,
		Username:       user.Username,
		Company:        user.Company,
		Role:           user.Role,
		ApprovalStatus: approval,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.jwtExpiry)),
			Issuer:    "whyline-api",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}
