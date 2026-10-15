package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/THARUN-BART/whyline/backend/internal/agent"
	"github.com/THARUN-BART/whyline/backend/internal/auth"
	"github.com/THARUN-BART/whyline/backend/internal/config"
	"github.com/THARUN-BART/whyline/backend/internal/graph"
	"github.com/THARUN-BART/whyline/backend/internal/memory"
	"github.com/THARUN-BART/whyline/backend/internal/rag"
	"github.com/THARUN-BART/whyline/backend/internal/seed"
	"github.com/THARUN-BART/whyline/backend/internal/tools"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	cfg := config.Load()

	log.Printf("[INFO] Initializing Whyline Backend on port %s...", cfg.Port)

	// 1. FalkorDB Graph Client initialization
	var authRepo auth.Repository
	graphClient, err := graph.NewClient(cfg.FalkorHost, cfg.FalkorPort, cfg.FalkorPass)
	if err != nil {
		log.Printf("[WARN] Could not connect to FalkorDB (%v). Falling back to in-memory user repository.", err)
		authRepo = auth.NewMemoryRepository()
	} else {
		log.Println("[INFO] FalkorDB connected. Using FalkorDB for user storage and graph memory.")
		authRepo = auth.NewFalkorRepository(graphClient, "company")
	}

	// 2. Auth dependencies
	otpManager := auth.NewOTPManager(cfg.OTPExpiry, cfg.AppEmail, cfg.AppPassword, cfg.SMTPHost, cfg.SMTPPort)
	authService := auth.NewService(authRepo, cfg.JWTSecret, cfg.JWTExpiry, otpManager)
	authHandler := auth.NewHandler(authService)

	// 3. Router setup
	r := chi.NewRouter()

	// Global middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSAllowed,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check endpoint
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		status := "ok"
		graphStatus := "connected"
		if graphClient == nil {
			graphStatus = "disconnected"
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprintf(w, `{"status":"%s","service":"whyline-backend","graph":"%s"}`, status, graphStatus)
	})

	// Mount Auth routes
	authHandler.RegisterRoutes(r)

	// Mount Graph and Seed routes (if connected)
	if graphClient != nil {
		graphHandler := graph.NewHandler(graphClient, "company")
		graphHandler.RegisterRoutes(r)

		seeder := seed.NewSeeder(graphClient, "company")
		_ = seeder.CheckAndAutoSeed(context.Background())
		seedHandler := seed.NewHandler(seeder)
		seedHandler.RegisterRoutes(r)

		toolsEngine := tools.NewEngine(graphClient, "company")
		toolsHandler := tools.NewHandler(toolsEngine)
		toolsHandler.RegisterRoutes(r)

		memoryService := memory.NewService(graphClient, "company", toolsEngine)
		memoryHandler := memory.NewHandler(memoryService)
		memoryHandler.RegisterRoutes(r)

		validator := agent.NewIDValidator(graphClient, "company")
		geminiAgent := agent.NewGeminiAgent(cfg.GeminiKey, cfg.GeminiModel, toolsEngine, memoryService, validator)
		agentHandler := agent.NewHandler(geminiAgent)
		agentHandler.RegisterRoutes(r)

		// Module 7: Vs-RAG baseline comparison
		vectorizer := rag.NewVectorizer(cfg.GeminiKey)
		ragService := rag.NewService(vectorizer, toolsEngine, cfg.GeminiKey, cfg.GeminiModel)
		ragHandler := rag.NewHandler(ragService)
		ragHandler.RegisterRoutes(r)
	}

	// Protected test endpoint to verify JWT middleware
	r.Group(func(r chi.Router) {
		r.Use(authService.Middleware)
		r.Get("/api/protected-ping", func(w http.ResponseWriter, r *http.Request) {
			userID, _ := auth.GetUserIDFromContext(r.Context())
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = fmt.Fprintf(w, `{"message":"pong","authenticated_user_id":"%s"}`, userID)
		})
	})

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Server run context for graceful shutdown
	serverCtx, serverStopCtx := context.WithCancel(context.Background())

	// Listen for syscall signals
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGHUP, syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT)
	go func() {
		<-sig

		shutdownCtx, cancel := context.WithTimeout(serverCtx, 10*time.Second)
		defer cancel()

		go func() {
			<-shutdownCtx.Done()
			if shutdownCtx.Err() == context.DeadlineExceeded {
				log.Fatal("[ERROR] Graceful shutdown timed out.. forcing exit.")
			}
		}()

		log.Println("[INFO] Shutting down Whyline backend server...")
		if graphClient != nil {
			_ = graphClient.Close()
		}
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Fatalf("[ERROR] Server shutdown failed: %v", err)
		}
		serverStopCtx()
	}()

	log.Printf("[INFO] Whyline Backend HTTP server running at http://localhost:%s", cfg.Port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("[FATAL] ListenAndServe failed: %v", err)
	}

	<-serverCtx.Done()
	log.Println("[INFO] Server stopped gracefully.")
}