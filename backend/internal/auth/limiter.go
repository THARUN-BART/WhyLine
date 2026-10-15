package auth

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

// IPRateLimiter provides sliding-window rate limiting per IP address without external dependencies (Fix #9).
type IPRateLimiter struct {
	mu     sync.Mutex
	limits map[string][]time.Time
	rate   int
	window time.Duration
}

// NewIPRateLimiter creates a new rate limiter allowing `rate` requests per `window`.
func NewIPRateLimiter(rate int, window time.Duration) *IPRateLimiter {
	l := &IPRateLimiter{
		limits: make(map[string][]time.Time),
		rate:   rate,
		window: window,
	}

	// Periodically evict expired IP tracking entries
	go func() {
		ticker := time.NewTicker(window)
		for range ticker.C {
			l.mu.Lock()
			now := time.Now()
			for ip, timestamps := range l.limits {
				var valid []time.Time
				for _, t := range timestamps {
					if now.Sub(t) < window {
						valid = append(valid, t)
					}
				}
				if len(valid) == 0 {
					delete(l.limits, ip)
				} else {
					l.limits[ip] = valid
				}
			}
			l.mu.Unlock()
		}
	}()

	return l
}

// Middleware returns an HTTP middleware that enforces the rate limit.
func (l *IPRateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			parts := strings.Split(xff, ",")
			ip = strings.TrimSpace(parts[0])
		} else if realIP := r.Header.Get("X-Real-IP"); realIP != "" {
			ip = realIP
		}

		l.mu.Lock()
		now := time.Now()
		var valid []time.Time
		for _, t := range l.limits[ip] {
			if now.Sub(t) < l.window {
				valid = append(valid, t)
			}
		}

		if len(valid) >= l.rate {
			l.mu.Unlock()
			w.Header().Set("Retry-After", "60")
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":"too many requests, please try again later"}`))
			return
		}

		l.limits[ip] = append(valid, now)
		l.mu.Unlock()

		next.ServeHTTP(w, r)
	})
}
