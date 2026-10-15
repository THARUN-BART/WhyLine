package auth

import (
	"errors"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("user already exists with that email or username")
)

type Repository interface {
	Create(user *User) error
	FindByEmail(email string) (*User, error)
	FindByID(id string) (*User, error)
	FindByUsername(username string) (*User, error)
	ListAll() []*User
}

type MemoryRepository struct {
	mu     sync.RWMutex
	users  map[string]*User // keyed by ID
	byEmail map[string]string // email -> ID
	byName  map[string]string // username -> ID
}

func NewMemoryRepository() *MemoryRepository {
	repo := &MemoryRepository{
		users:   make(map[string]*User),
		byEmail: make(map[string]string),
		byName:  make(map[string]string),
	}
	repo.seedDefaults()
	return repo
}

func (r *MemoryRepository) seedDefaults() {
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)

	defaultUsers := []*User{
		{
			ID:           "usr_demo",
			Email:        "demo@whyline.dev",
			Username:     "demo",
			PasswordHash: string(hashedPassword),
			Role:         "admin",
			CreatedAt:    time.Now().UTC(),
		},
		{
			ID:           "usr_alice",
			Email:        "alice@whyline.dev",
			Username:     "alice",
			PasswordHash: string(hashedPassword),
			Role:         "engineer",
			CreatedAt:    time.Now().UTC(),
		},
		{
			ID:           "usr_bob",
			Email:        "bob@whyline.dev",
			Username:     "bob",
			PasswordHash: string(hashedPassword),
			Role:         "product_manager",
			CreatedAt:    time.Now().UTC(),
		},
	}

	for _, u := range defaultUsers {
		_ = r.Create(u)
	}
}

func (r *MemoryRepository) Create(user *User) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	normEmail := strings.ToLower(strings.TrimSpace(user.Email))
	normUsername := strings.ToLower(strings.TrimSpace(user.Username))

	if _, exists := r.byEmail[normEmail]; exists {
		return ErrUserAlreadyExists
	}
	if _, exists := r.byName[normUsername]; exists {
		return ErrUserAlreadyExists
	}

	r.users[user.ID] = user
	r.byEmail[normEmail] = user.ID
	r.byName[normUsername] = user.ID

	return nil
}

func (r *MemoryRepository) FindByEmail(email string) (*User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	normEmail := strings.ToLower(strings.TrimSpace(email))
	id, exists := r.byEmail[normEmail]
	if !exists {
		return nil, ErrUserNotFound
	}

	user, ok := r.users[id]
	if !ok {
		return nil, ErrUserNotFound
	}

	return user, nil
}

func (r *MemoryRepository) FindByID(id string) (*User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	user, exists := r.users[id]
	if !exists {
		return nil, ErrUserNotFound
	}
	return user, nil
}

func (r *MemoryRepository) FindByUsername(username string) (*User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	norm := strings.ToLower(strings.TrimSpace(username))
	id, exists := r.byName[norm]
	if !exists {
		return nil, ErrUserNotFound
	}
	return r.users[id], nil
}

func (r *MemoryRepository) ListAll() []*User {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*User
	for _, u := range r.users {
		list = append(list, u)
	}
	return list
}
