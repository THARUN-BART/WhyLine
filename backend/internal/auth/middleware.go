package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const (
	UserClaimsContextKey contextKey = "user_claims"
	UserIDContextKey     contextKey = "user_id"
)

// Middleware authenticates incoming HTTP requests using a Bearer JWT.
func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			http.Error(w, `{"error":"invalid authorization format, expected 'Bearer <token>'"}`, http.StatusUnauthorized)
			return
		}

		claims, err := s.ValidateToken(parts[1])
		if err != nil {
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserClaimsContextKey, claims)
		ctx = context.WithValue(ctx, UserIDContextKey, claims.UserID)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// OptionalMiddleware attaches user context if token is provided, but allows unauthenticated requests.
func (s *Service) OptionalMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
				if claims, err := s.ValidateToken(parts[1]); err == nil {
					ctx := context.WithValue(r.Context(), UserClaimsContextKey, claims)
					ctx = context.WithValue(ctx, UserIDContextKey, claims.UserID)
					r = r.WithContext(ctx)
				}
			}
		}
		next.ServeHTTP(w, r)
	})
}

// GetUserIDFromContext retrieves the authenticated user ID from context.
func GetUserIDFromContext(ctx context.Context) (string, bool) {
	val, ok := ctx.Value(UserIDContextKey).(string)
	return val, ok
}

// GetClaimsFromContext retrieves the full JWT claims from context.
func GetClaimsFromContext(ctx context.Context) (*JWTClaims, bool) {
	val, ok := ctx.Value(UserClaimsContextKey).(*JWTClaims)
	return val, ok
}

// AdminMiddleware ensures that the authenticated caller has the "admin" role.
func (s *Service) AdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := GetClaimsFromContext(r.Context())
		if !ok || claims == nil || claims.Role != "admin" {
			http.Error(w, `{"error":"forbidden: administrator access required"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}
