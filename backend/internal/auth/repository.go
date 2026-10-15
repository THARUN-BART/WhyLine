package auth

import (
	"errors"
	"fmt"
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

	// Company operations (Admin managed)
	CreateCompany(name string) (*Company, error)
	ListCompanies() ([]*Company, error)
	CompanyExists(name string) (bool, error)
}

type MemoryRepository struct {
	mu        sync.RWMutex
	users     map[string]*User    // keyed by ID
	byEmail   map[string]string   // email -> ID
	byName    map[string]string   // username -> ID
	companies map[string]*Company // normalized name -> Company
}

func NewMemoryRepository() *MemoryRepository {
	repo := &MemoryRepository{
		users:     make(map[string]*User),
		byEmail:   make(map[string]string),
		byName:    make(map[string]string),
		companies: make(map[string]*Company),
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
			Company:      "Whyline Corp",
			PasswordHash: string(hashedPassword),
			Role:         "admin",
			CreatedAt:    time.Now().UTC(),
		},
		{
			ID:           "usr_alice",
			Email:        "alice@whyline.dev",
			Username:     "alice",
			Company:      "Acme Technologies",
			PasswordHash: string(hashedPassword),
			Role:         "engineer",
			CreatedAt:    time.Now().UTC(),
		},
		{
			ID:           "usr_bob",
			Email:        "bob@whyline.dev",
			Username:     "bob",
			Company:      "Acme Technologies",
			PasswordHash: string(hashedPassword),
			Role:         "product_manager",
			CreatedAt:    time.Now().UTC(),
		},
	}

	for _, u := range defaultUsers {
		_ = r.Create(u)
	}

	// Seed default organizations
	r.companies["whyline corp"] = &Company{
		ID:        "comp_whyline",
		Name:      "Whyline Corp",
		CreatedAt: time.Now().UTC(),
	}
	r.companies["acme technologies"] = &Company{
		ID:        "comp_acme",
		Name:      "Acme Technologies",
		CreatedAt: time.Now().UTC(),
	}
	r.companies["stripe"] = &Company{
		ID:        "comp_stripe",
		Name:      "Stripe",
		CreatedAt: time.Now().UTC(),
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

func (r *MemoryRepository) CreateCompany(name string) (*Company, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	cleanName := strings.TrimSpace(name)
	if cleanName == "" {
		return nil, errors.New("company name cannot be empty")
	}

	normName := strings.ToLower(cleanName)
	if comp, exists := r.companies[normName]; exists {
		return comp, nil
	}

	comp := &Company{
		ID:        fmt.Sprintf("comp_%d", time.Now().UnixNano()),
		Name:      cleanName,
		CreatedAt: time.Now().UTC(),
	}
	r.companies[normName] = comp
	return comp, nil
}

func (r *MemoryRepository) ListCompanies() ([]*Company, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var list []*Company
	for _, c := range r.companies {
		list = append(list, c)
	}
	return list, nil
}

func (r *MemoryRepository) CompanyExists(name string) (bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	norm := strings.ToLower(strings.TrimSpace(name))
	_, exists := r.companies[norm]
	return exists, nil
}
