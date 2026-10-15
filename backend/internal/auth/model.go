package auth

import (
	"time"
)

// User represents a system user in Whyline.
type User struct {
	ID             string    `json:"id"`
	Email          string    `json:"email"`
	Username       string    `json:"username"`
	Company        string    `json:"company"`
	PasswordHash   string    `json:"-"`
	Role           string    `json:"role"`            // "admin", "company_admin", "user"
	ApprovalStatus string    `json:"approval_status"` // "approved", "pending", "rejected"
	IsVerified     bool      `json:"is_verified"`
	CreatedAt      time.Time `json:"created_at"`
}

// UserResponse is the safe projection of User without sensitive fields.
type UserResponse struct {
	ID             string    `json:"id"`
	Email          string    `json:"email"`
	Username       string    `json:"username"`
	Company        string    `json:"company"`
	Role           string    `json:"role"`
	ApprovalStatus string    `json:"approval_status"`
	IsVerified     bool      `json:"is_verified"`
	CreatedAt      time.Time `json:"created_at"`
}

func (u *User) ToResponse() UserResponse {
	company := u.Company
	if company == "" {
		company = "Whyline Corp"
	}
	approval := u.ApprovalStatus
	if approval == "" {
		approval = "approved"
	}
	return UserResponse{
		ID:             u.ID,
		Email:          u.Email,
		Username:       u.Username,
		Company:        company,
		Role:           u.Role,
		ApprovalStatus: approval,
		IsVerified:     u.IsVerified,
		CreatedAt:      u.CreatedAt,
	}
}

// SendOTPRequest holds the email to receive an OTP.
type SendOTPRequest struct {
	Email string `json:"email"`
}

// VerifyOTPRequest holds email and code for verification.
type VerifyOTPRequest struct {
	Email string `json:"email"`
	OTP   string `json:"otp"`
}

// RegisterRequest holds the registration payload.
type RegisterRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Company  string `json:"company"`
	Password string `json:"password"`
	OTP      string `json:"otp,omitempty"` // optional or required depending on verification flow
}

// LoginRequest holds the login credentials.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// AuthResponse returns the JWT and user metadata upon successful auth.
type AuthResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}

// Company represents an organization registered in Whyline by an admin.
type Company struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	UserCount int       `json:"user_count,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// CompanyStats holds user count metrics for a single company alone.
type CompanyStats struct {
	Company       string `json:"company"`
	UserCount     int    `json:"user_count"`
	ApprovedCount int    `json:"approved_count"`
	PendingCount  int    `json:"pending_count"`
	RejectedCount int    `json:"rejected_count"`
}

// CreateCompanyRequest holds the payload for creating a company by an admin.
type CreateCompanyRequest struct {
	Name string `json:"name"`
}

// AdminRegisterRequest holds payload for registering a new administrator.
type AdminRegisterRequest struct {
	Email       string `json:"email"`
	Username    string `json:"username"`
	Password    string `json:"password"`
	AdminSecret string `json:"admin_secret"`
}

// AdminCreateCompanyUserRequest allows a platform admin to create a company and its main user directly.
type AdminCreateCompanyUserRequest struct {
	CompanyName string `json:"company_name"`
	Email       string `json:"email"`
	Username    string `json:"username"`
	Password    string `json:"password"`
	Role        string `json:"role,omitempty"` // "company_admin" by default
}

// ApproveUserRequest holds payload to approve or reject an employee registration.
type ApproveUserRequest struct {
	UserID string `json:"user_id"`
	Status string `json:"status"` // "approved" or "rejected"
}
