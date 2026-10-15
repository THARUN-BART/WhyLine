package auth

import (
	"crypto/rand"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/smtp"
	"strings"
	"sync"
	"time"
)

var (
	ErrOTPNotFound = errors.New("no OTP request found for this email, please request a new OTP")
	ErrOTPExpired  = errors.New("OTP has expired, please request a new one")
	ErrOTPInvalid  = errors.New("invalid OTP code")
)

type OTPEntry struct {
	Code      string
	ExpiresAt time.Time
	Verified  bool
	Attempts  int
}

type OTPManager struct {
	mu          sync.RWMutex
	store       map[string]*OTPEntry // email -> OTPEntry
	expiry      time.Duration
	appEmail    string
	appPassword string
	smtpHost    string
	smtpPort    string
}

func NewOTPManager(expiry time.Duration, appEmail, appPassword, smtpHost, smtpPort string) *OTPManager {
	return &OTPManager{
		store:       make(map[string]*OTPEntry),
		expiry:      expiry,
		appEmail:    appEmail,
		appPassword: appPassword,
		smtpHost:    smtpHost,
		smtpPort:    smtpPort,
	}
}

// GenerateAndStore generates a cryptographically random 6-digit OTP and stores it.
func (m *OTPManager) GenerateAndStore(email string) (string, error) {
	normEmail := strings.ToLower(strings.TrimSpace(email))

	// Generate 6-digit random code between 100000 and 999999
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", fmt.Errorf("failed to generate random OTP: %w", err)
	}
	code := fmt.Sprintf("%06d", n.Int64()+100000)

	m.mu.Lock()
	m.store[normEmail] = &OTPEntry{
		Code:      code,
		ExpiresAt: time.Now().UTC().Add(m.expiry),
		Verified:  false,
	}
	m.mu.Unlock()

	return code, nil
}

// SendEmail dispatches the OTP email using SMTP.
func (m *OTPManager) SendEmail(toEmail, code string) error {
	normEmail := strings.ToLower(strings.TrimSpace(toEmail))

	subject := fmt.Sprintf("Whyline Verification Code: %s", code)
	body := fmt.Sprintf("From: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n\r\n"+
		`<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 20px; }
    .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .brand { font-size: 20px; font-weight: bold; color: #111827; margin-bottom: 16px; }
    .title { font-size: 16px; color: #374151; margin-bottom: 24px; }
    .otp { font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #2563eb; background: #eff6ff; padding: 16px 24px; border-radius: 6px; text-align: center; margin: 24px 0; }
    .footer { font-size: 13px; color: #6b7280; margin-top: 24px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">Whyline</div>
    <div class="title">Use the verification code below to complete your registration or login:</div>
    <div class="otp">%s</div>
    <div class="footer">
      This code is valid for 10 minutes. If you did not request this verification, please disregard this email.
    </div>
  </div>
</body>
</html>`, m.appEmail, normEmail, subject, code)

	if m.appEmail == "" || m.appPassword == "" {
		log.Printf("[WARN] SMTP credentials not set (APP_EMAIL or APP_PASSWORD empty). OTP for %s is [%s]", normEmail, code)
		return nil
	}

	auth := smtp.PlainAuth("", m.appEmail, m.appPassword, m.smtpHost)
	addr := fmt.Sprintf("%s:%s", m.smtpHost, m.smtpPort)

	err := smtp.SendMail(addr, auth, m.appEmail, []string{normEmail}, []byte(body))
	if err != nil {
		log.Printf("[WARN] Failed to send email via SMTP (%v). Fallback DEV OTP for %s is [%s]", err, normEmail, code)
		return err
	}

	log.Printf("[INFO] Verification email successfully sent to %s", normEmail)
	return nil
}

// Verify validates the OTP code for the given email.
func (m *OTPManager) Verify(email, code string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	normEmail := strings.ToLower(strings.TrimSpace(email))
	entry, exists := m.store[normEmail]
	if !exists {
		return ErrOTPNotFound
	}

	if time.Now().UTC().After(entry.ExpiresAt) {
		delete(m.store, normEmail)
		return ErrOTPExpired
	}

	if entry.Attempts >= 5 {
		delete(m.store, normEmail)
		return errors.New("maximum verification attempts exceeded, please request a new OTP")
	}

	if strings.TrimSpace(entry.Code) != strings.TrimSpace(code) {
		entry.Attempts++
		if entry.Attempts >= 5 {
			delete(m.store, normEmail)
			return errors.New("maximum verification attempts exceeded, please request a new OTP")
		}
		return ErrOTPInvalid
	}

	entry.Verified = true
	return nil
}

// IsVerified checks if the email has successfully verified an OTP.
func (m *OTPManager) IsVerified(email string) bool {
	m.mu.RLock()
	defer m.mu.RUnlock()

	normEmail := strings.ToLower(strings.TrimSpace(email))
	entry, exists := m.store[normEmail]
	if !exists {
		return false
	}
	return entry.Verified && time.Now().UTC().Before(entry.ExpiresAt)
}

// ConsumeVerification consumes the verified status after successful registration.
func (m *OTPManager) ConsumeVerification(email string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	normEmail := strings.ToLower(strings.TrimSpace(email))
	delete(m.store, normEmail)
}
