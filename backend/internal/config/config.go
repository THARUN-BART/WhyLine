package config

import (
	"log"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// graphNameRegex enforces safe graph names: alphanumeric and underscores only.
var graphNameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]+$`)

type Config struct {
	Port        string
	JWTSecret   string
	JWTExpiry   time.Duration
	FalkorHost  string
	FalkorPort  string
	FalkorUser  string
	FalkorPass  string
	FalkorGraph string
	FalkorTLS   bool
	CORSAllowed []string
	GeminiKey   string
	GeminiModel string
	AppEmail    string
	AppPassword string
	SMTPHost    string
	SMTPPort    string
	OTPExpiry   time.Duration
	AdminSecret string
}

func Load() *Config {
	// Load .env file if it exists, otherwise fall back to environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("[INFO] No .env file found or error loading, using system environment")
	}

	// Fix #1: Require JWT_SECRET and ADMIN_SECRET — crash at startup if missing.
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("[FATAL] JWT_SECRET environment variable is required but not set")
	}

	adminSecret := os.Getenv("ADMIN_SECRET")
	if adminSecret == "" {
		log.Fatal("[FATAL] ADMIN_SECRET environment variable is required but not set")
	}

	port := getEnv("PORT", "8080")
	jwtExpiryStr := getEnv("JWT_EXPIRY", "24h")
	jwtExpiry, err := time.ParseDuration(jwtExpiryStr)
	if err != nil {
		jwtExpiry = 24 * time.Hour
	}

	falkorEndpoint := getEnv("FALKORDB_ENDPOINT", "")
	falkorHost := getEnv("FALKORDB_HOST", "localhost")
	falkorPort := getEnv("FALKORDB_PORT", "6379")

	if falkorEndpoint != "" {
		clean := falkorEndpoint
		if strings.HasPrefix(clean, "rediss://") {
			clean = strings.TrimPrefix(clean, "rediss://")
		} else if strings.HasPrefix(clean, "redis://") {
			clean = strings.TrimPrefix(clean, "redis://")
		}
		if idx := strings.Index(clean, "@"); idx != -1 {
			clean = clean[idx+1:]
		}
		parts := strings.Split(clean, ":")
		if len(parts) >= 1 && parts[0] != "" {
			falkorHost = parts[0]
		}
		if len(parts) >= 2 && parts[1] != "" {
			falkorPort = parts[1]
		}
	}

	falkorUser := getEnv("FALKORDB_USERNAME", getEnv("FALKORDB_USER", ""))
	falkorPass := getEnv("FALKORDB_PASSWORD", getEnv("FALKORDB_PASS", ""))
	falkorGraph := getEnv("FALKORDB_GRAPH", "company")
	falkorTLSStr := strings.ToLower(getEnv("FALKORDB_TLS", "false"))
	falkorTLS := falkorTLSStr == "true" || falkorTLSStr == "1" || strings.HasPrefix(falkorEndpoint, "rediss://") || falkorPort == "6380"

	// Fix #20: Validate graph name to prevent injection via environment variable.
	if !graphNameRegex.MatchString(falkorGraph) {
		log.Fatalf("[FATAL] FALKORDB_GRAPH value %q is invalid: only alphanumeric characters and underscores are allowed", falkorGraph)
	}

	corsStr := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001")
	corsAllowed := strings.Split(corsStr, ",")
	for i := range corsAllowed {
		corsAllowed[i] = strings.TrimSpace(corsAllowed[i])
	}

	otpExpiryStr := getEnv("OTP_EXPIRY", "10m")
	otpExpiry, err := time.ParseDuration(otpExpiryStr)
	if err != nil {
		otpExpiry = 10 * time.Minute
	}

	return &Config{
		Port:        port,
		JWTSecret:   jwtSecret,
		JWTExpiry:   jwtExpiry,
		FalkorHost:  falkorHost,
		FalkorPort:  falkorPort,
		FalkorUser:  falkorUser,
		FalkorPass:  falkorPass,
		FalkorGraph: falkorGraph,
		FalkorTLS:   falkorTLS,
		CORSAllowed: corsAllowed,
		GeminiKey:   getEnv("GEMINI_API_KEY", ""),
		GeminiModel: getEnv("GEMINI_MODEL", "gemini-3.8-flash"),
		AppEmail:    getEnv("APP_EMAIL", ""),
		AppPassword: getEnv("APP_PASSWORD", ""),
		SMTPHost:    getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:    getEnv("SMTP_PORT", "587"),
		OTPExpiry:   otpExpiry,
		AdminSecret: adminSecret,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

