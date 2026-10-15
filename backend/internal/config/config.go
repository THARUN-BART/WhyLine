package config

import (
	"log"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	JWTSecret    string
	JWTExpiry    time.Duration
	FalkorHost   string
	FalkorPort   string
	FalkorPass   string
	CORSAllowed  []string
	LLMProvider  string
	OpenAIKey    string
	GeminiKey    string
	LLMModel     string
}

func Load() *Config {
	// Load .env file if it exists, otherwise fall back to environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("[INFO] No .env file found or error loading, using system environment")
	}

	port := getEnv("PORT", "8080")
	jwtSecret := getEnv("JWT_SECRET", "whyline-dev-super-secret-jwt-token-key-2026")
	jwtExpiryStr := getEnv("JWT_EXPIRY", "24h")
	jwtExpiry, err := time.ParseDuration(jwtExpiryStr)
	if err != nil {
		jwtExpiry = 24 * time.Hour
	}

	falkorHost := getEnv("FALKORDB_HOST", "localhost")
	falkorPort := getEnv("FALKORDB_PORT", "6379")
	falkorPass := getEnv("FALKORDB_PASSWORD", "")

	corsStr := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001")
	corsAllowed := strings.Split(corsStr, ",")
	for i := range corsAllowed {
		corsAllowed[i] = strings.TrimSpace(corsAllowed[i])
	}

	return &Config{
		Port:        port,
		JWTSecret:   jwtSecret,
		JWTExpiry:   jwtExpiry,
		FalkorHost:  falkorHost,
		FalkorPort:  falkorPort,
		FalkorPass:  falkorPass,
		CORSAllowed: corsAllowed,
		LLMProvider: getEnv("LLM_PROVIDER", "openai"),
		OpenAIKey:   getEnv("OPENAI_API_KEY", ""),
		GeminiKey:   getEnv("GEMINI_API_KEY", ""),
		LLMModel:    getEnv("LLM_MODEL", "gpt-4o-mini"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
