package auth

import (
	"time"
)

// User represents a system user in Whyline.
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Username     string    `json:"username"`
	Company      string    `json:"company"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	IsVerified   bool      `json:"is_verified"`
	CreatedAt    time.Time `json:"created_at"`
}

// UserResponse is the safe projection of User without sensitive fields.
type UserResponse struct {
	ID         string    `json:"id"`
	Email      string    `json:"email"`
	Username   string    `json:"username"`
	Company    string    `json:"company"`
	Role       string    `json:"role"`
	IsVerified bool      `json:"is_verified"`
	CreatedAt  time.Time `json:"created_at"`
}

func (u *User) ToResponse() UserResponse {
	company := u.Company
	if company == "" {
		company = "Whyline Corp"
	}
	return UserResponse{
		ID:         u.ID,
		Email:      u.Email,
		Username:   u.Username,
		Company:    company,
		Role:       u.Role,
		IsVerified: u.IsVerified,
		CreatedAt:  u.CreatedAt,
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
	CreatedAt time.Time `json:"created_at"`
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
