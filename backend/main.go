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

	"github.com/THARUN-BART/whyline/backend/internal/auth"
	"github.com/THARUN-BART/whyline/backend/internal/config"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	cfg := config.Load()

	log.Printf("[INFO] Initializing Whyline Backend on port %s...", cfg.Port)

	// Auth dependencies
	authRepo := auth.NewMemoryRepository()
	authService := auth.NewService(authRepo, cfg.JWTSecret, cfg.JWTExpiry)
	authHandler := auth.NewHandler(authService)

	// Router setup
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
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","service":"whyline-backend"}`))
	})

	// Mount Auth routes
	authHandler.RegisterRoutes(r)

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

		// Shutdown signal with grace period of 10s
		shutdownCtx, cancel := context.WithTimeout(serverCtx, 10*time.Second)
		defer cancel()

		go func() {
			<-shutdownCtx.Done()
			if shutdownCtx.Err() == context.DeadlineExceeded {
				log.Fatal("[ERROR] Graceful shutdown timed out.. forcing exit.")
			}
		}()

		log.Println("[INFO] Shutting down Whyline backend server...")
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