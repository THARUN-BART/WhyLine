package auth

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
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
	UpdateApprovalStatus(userID string, status string) error
	ListUsersByCompany(companyName string, approvalStatus string) ([]*User, error)

	// Company operations (Admin managed)
	CreateCompany(name string) (*Company, error)
	ListCompanies() ([]*Company, error)
	CompanyExists(name string) (bool, error)
	GetCompanyStats(companyName string) (*CompanyStats, error)
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
	// Seed default organizations (users and admins are created dynamically or in FalkorDB)

	// Seed default organizations
	r.companies["whyline"] = &Company{
		ID:        "comp_whyline",
		Name:      "Whyline",
		CreatedAt: time.Now().UTC(),
	}
	r.companies["whyline corp"] = &Company{
		ID:        "comp_whyline_corp",
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
		normComp := strings.ToLower(strings.TrimSpace(c.Name))
		cnt := 0
		for _, u := range r.users {
			if strings.ToLower(strings.TrimSpace(u.Company)) == normComp {
				cnt++
			}
		}
		cCopy := *c
		cCopy.UserCount = cnt
		list = append(list, &cCopy)
	}
	return list, nil
}

func (r *MemoryRepository) GetCompanyStats(companyName string) (*CompanyStats, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	normComp := strings.ToLower(strings.TrimSpace(companyName))
	stats := &CompanyStats{
		Company: companyName,
	}

	for _, u := range r.users {
		if strings.ToLower(strings.TrimSpace(u.Company)) == normComp {
			stats.UserCount++
			switch strings.ToLower(strings.TrimSpace(u.ApprovalStatus)) {
			case "approved":
				stats.ApprovedCount++
			case "pending":
				stats.PendingCount++
			case "rejected":
				stats.RejectedCount++
			}
		}
	}
	return stats, nil
}

func (r *MemoryRepository) CompanyExists(name string) (bool, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	norm := strings.ToLower(strings.TrimSpace(name))
	_, exists := r.companies[norm]
	return exists, nil
}

func (r *MemoryRepository) UpdateApprovalStatus(userID string, status string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	user, exists := r.users[userID]
	if !exists {
		return ErrUserNotFound
	}
	user.ApprovalStatus = status
	return nil
}

func (r *MemoryRepository) ListUsersByCompany(companyName string, approvalStatus string) ([]*User, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var result []*User
	normCompany := strings.ToLower(strings.TrimSpace(companyName))
	for _, u := range r.users {
		if strings.ToLower(strings.TrimSpace(u.Company)) == normCompany {
			if approvalStatus == "" || strings.EqualFold(u.ApprovalStatus, approvalStatus) {
				result = append(result, u)
			}
		}
	}
	return result, nil
}
