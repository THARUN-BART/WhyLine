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
	ErrPasswordTooShort   = errors.New("password must be at least 6 characters")
	ErrEmailNotVerified   = errors.New("email not verified: please verify your email with OTP first")
)

type JWTClaims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

type Service struct {
	repo       Repository
	jwtSecret  []byte
	jwtExpiry  time.Duration
	otpManager *OTPManager
}

func NewService(repo Repository, jwtSecret string, jwtExpiry time.Duration, otpManager *OTPManager) *Service {
	return &Service{
		repo:       repo,
		jwtSecret:  []byte(jwtSecret),
		jwtExpiry:  jwtExpiry,
		otpManager: otpManager,
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

	if email == "" || username == "" || password == "" {
		return nil, ErrEmptyFields
	}
	if len(password) < 6 {
		return nil, ErrPasswordTooShort
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
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	userID := uuid.New().String()
	user := &User{
		ID:           userID,
		Email:        email,
		Username:     username,
		PasswordHash: string(hashedPassword),
		Role:         "user",
		IsVerified:   isVerified,
		CreatedAt:    time.Now().UTC(),
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
	} else {
		user, err = s.repo.FindByUsername(identifier)
	}

	if err != nil {
		return nil, ErrInvalidCredentials
	}

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
	claims := JWTClaims{
		UserID:   user.ID,
		Email:    user.Email,
		Username: user.Username,
		Role:     user.Role,
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
