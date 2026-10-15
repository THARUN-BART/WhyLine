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
	"github.com/THARUN-BART/whyline/backend/internal/ticket"
	"github.com/THARUN-BART/whyline/backend/internal/tools"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	cfg := config.Load()

	log.Printf("[INFO] Initializing Whyline Backend on port %s...", cfg.Port)

	// 1. FalkorDB Graph Client initialization
	graphName := cfg.FalkorGraph
	if graphName == "" {
		graphName = "company"
	}

	var authRepo auth.Repository
	graphClient, err := graph.NewClientWithAuth(cfg.FalkorHost, cfg.FalkorPort, cfg.FalkorUser, cfg.FalkorPass, cfg.FalkorTLS)
	if err != nil {
		log.Printf("[WARN] Could not connect to FalkorDB (%v). Falling back to in-memory user repository.", err)
		authRepo = auth.NewMemoryRepository()
	} else {
		log.Printf("[INFO] FalkorDB connected. Using FalkorDB graph '%s' for user storage and institutional memory.", graphName)
		authRepo = auth.NewFalkorRepository(graphClient, graphName)
	}

	// 2. Auth dependencies
	otpManager := auth.NewOTPManager(cfg.OTPExpiry, cfg.AppEmail, cfg.AppPassword, cfg.SMTPHost, cfg.SMTPPort)
	authService := auth.NewService(authRepo, cfg.JWTSecret, cfg.JWTExpiry, otpManager, cfg.AdminSecret)
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
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-User-ID", "X-Company-ID"},
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

	// Mount Graph, Tool, Ticket, and Memory routes (if connected)
	ticketService := ticket.NewService(graphClient, graphName)
	ticketHandler := ticket.NewHandler(ticketService)
	ticketHandler.RegisterRoutes(r, authService.Middleware, authService.ApprovedUserMiddleware)

	if graphClient != nil {
		// Group routes that serve dashboard/data with OptionalApprovedUserMiddleware
		// Guests without token can inspect demo, but pending employees with token are strictly blocked (403)!
		r.Group(func(sub chi.Router) {
			sub.Use(authService.OptionalApprovedUserMiddleware)

			graphHandler := graph.NewHandler(graphClient, graphName)
			graphHandler.RegisterRoutes(sub)

			toolsEngine := tools.NewEngine(graphClient, graphName)
			toolsHandler := tools.NewHandler(toolsEngine)
			toolsHandler.RegisterRoutes(sub)

			memoryService := memory.NewService(graphClient, graphName, toolsEngine)
			memoryHandler := memory.NewHandler(memoryService)
			memoryHandler.RegisterRoutes(sub)

			validator := agent.NewIDValidator(graphClient, graphName)
			geminiAgent := agent.NewGeminiAgent(cfg.GeminiKey, cfg.GeminiModel, toolsEngine, memoryService, validator)
			agentHandler := agent.NewHandler(geminiAgent)
			agentHandler.RegisterRoutes(sub)

			// Module 7: Vs-RAG baseline comparison
			vectorizer := rag.NewVectorizer(cfg.GeminiKey)
			ragService := rag.NewService(vectorizer, toolsEngine, cfg.GeminiKey, cfg.GeminiModel)
			ragHandler := rag.NewHandler(ragService)
			ragHandler.RegisterRoutes(sub)
		})
	}

	// Strictly protected endpoints requiring authentication + company approval
	r.Group(func(r chi.Router) {
		r.Use(authService.Middleware)
		r.Use(authService.ApprovedUserMiddleware)

		r.Get("/api/protected-ping", func(w http.ResponseWriter, r *http.Request) {
			userID, _ := auth.GetUserIDFromContext(r.Context())
			claims, _ := auth.GetClaimsFromContext(r.Context())
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = fmt.Fprintf(w, `{"message":"pong","authenticated_user_id":"%s","company":"%s","approval_status":"%s"}`, userID, claims.Company, claims.ApprovalStatus)
		})

		r.Get("/api/dashboard/status", func(w http.ResponseWriter, r *http.Request) {
			claims, _ := auth.GetClaimsFromContext(r.Context())
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = fmt.Fprintf(w, `{"status":"approved","message":"Dashboard access granted","company":"%s"}`, claims.Company)
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