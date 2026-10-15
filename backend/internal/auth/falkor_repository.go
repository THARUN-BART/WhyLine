package auth

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/THARUN-BART/whyline/backend/internal/graph"
	"golang.org/x/crypto/bcrypt"
)

type FalkorRepository struct {
	client    *graph.Client
	graphName string
}

func NewFalkorRepository(client *graph.Client, graphName string) *FalkorRepository {
	repo := &FalkorRepository{
		client:    client,
		graphName: graphName,
	}
	repo.seedDefaults()
	return repo
}

func (r *FalkorRepository) seedDefaults() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)

	defaultUsers := []*User{
		{
			ID:           "usr_demo",
			Email:        "demo@whyline.dev",
			Username:     "demo",
			Company:      "Whyline Corp",
			PasswordHash: string(hashedPassword),
			Role:         "admin",
			IsVerified:   true,
			CreatedAt:    time.Now().UTC(),
		},
		{
			ID:           "usr_alice",
			Email:        "alice@whyline.dev",
			Username:     "alice",
			Company:      "Acme Technologies",
			PasswordHash: string(hashedPassword),
			Role:         "engineer",
			IsVerified:   true,
			CreatedAt:    time.Now().UTC(),
		},
		{
			ID:           "usr_bob",
			Email:        "bob@whyline.dev",
			Username:     "bob",
			Company:      "Acme Technologies",
			PasswordHash: string(hashedPassword),
			Role:         "product_manager",
			IsVerified:   true,
			CreatedAt:    time.Now().UTC(),
		},
	}

	for _, u := range defaultUsers {
		// Use MERGE so it's idempotent and doesn't duplicate on restart
		cypher := `
MERGE (u:User {email: $email})
ON CREATE SET 
	u.id = $id,
	u.username = $username,
	u.password_hash = $password_hash,
	u.role = $role,
	u.is_verified = $is_verified,
	u.created_at = $created_at
SET u.company = $company
WITH u
MERGE (c:Company {name: $company})
MERGE (u)-[:BELONGS_TO]->(c)
`
		params := map[string]interface{}{
			"id":            u.ID,
			"email":         strings.ToLower(u.Email),
			"username":      strings.ToLower(u.Username),
			"company":       u.Company,
			"password_hash": u.PasswordHash,
			"role":          u.Role,
			"is_verified":   u.IsVerified,
			"created_at":    u.CreatedAt.Format(time.RFC3339),
		}
		_, err := r.client.Query(ctx, r.graphName, cypher, params)
		if err != nil {
			log.Printf("[WARN] Failed to seed default user %s into FalkorDB: %v", u.Email, err)
		}
	}
}

func (r *FalkorRepository) Create(user *User) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	normEmail := strings.ToLower(strings.TrimSpace(user.Email))
	normUsername := strings.ToLower(strings.TrimSpace(user.Username))

	// Check if user already exists
	checkCypher := "MATCH (u:User) WHERE u.email = $email OR u.username = $username RETURN u.id LIMIT 1"
	checkRes, err := r.client.ROQuery(ctx, r.graphName, checkCypher, map[string]interface{}{
		"email":    normEmail,
		"username": normUsername,
	})
	if err == nil && len(checkRes.Records) > 0 {
		return ErrUserAlreadyExists
	}

	createCypher := `
CREATE (u:User {
	id: $id,
	email: $email,
	username: $username,
	company: $company,
	password_hash: $password_hash,
	role: $role,
	is_verified: $is_verified,
	created_at: $created_at
})
WITH u
MERGE (c:Company {name: $company})
MERGE (u)-[:BELONGS_TO]->(c)
`
	params := map[string]interface{}{
		"id":            user.ID,
		"email":         normEmail,
		"username":      normUsername,
		"company":       user.Company,
		"password_hash": user.PasswordHash,
		"role":          user.Role,
		"is_verified":   user.IsVerified,
		"created_at":    user.CreatedAt.Format(time.RFC3339),
	}

	_, err = r.client.Query(ctx, r.graphName, createCypher, params)
	if err != nil {
		return fmt.Errorf("failed to create user node in FalkorDB: %w", err)
	}

	return nil
}

func (r *FalkorRepository) FindByEmail(email string) (*User, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	normEmail := strings.ToLower(strings.TrimSpace(email))
	cypher := "MATCH (u:User {email: $email}) RETURN u"
	res, err := r.client.ROQuery(ctx, r.graphName, cypher, map[string]interface{}{
		"email": normEmail,
	})
	if err != nil || len(res.Nodes) == 0 {
		return nil, ErrUserNotFound
	}

	return nodeToUser(res.Nodes[0])
}

func (r *FalkorRepository) FindByID(id string) (*User, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cypher := "MATCH (u:User {id: $id}) RETURN u"
	res, err := r.client.ROQuery(ctx, r.graphName, cypher, map[string]interface{}{
		"id": id,
	})
	if err != nil || len(res.Nodes) == 0 {
		return nil, ErrUserNotFound
	}

	return nodeToUser(res.Nodes[0])
}

func (r *FalkorRepository) FindByUsername(username string) (*User, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	norm := strings.ToLower(strings.TrimSpace(username))
	cypher := "MATCH (u:User {username: $username}) RETURN u"
	res, err := r.client.ROQuery(ctx, r.graphName, cypher, map[string]interface{}{
		"username": norm,
	})
	if err != nil || len(res.Nodes) == 0 {
		return nil, ErrUserNotFound
	}

	return nodeToUser(res.Nodes[0])
}

func (r *FalkorRepository) ListAll() []*User {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cypher := "MATCH (u:User) RETURN u"
	res, err := r.client.ROQuery(ctx, r.graphName, cypher, nil)
	if err != nil {
		return nil
	}

	var users []*User
	for _, n := range res.Nodes {
		if u, err := nodeToUser(n); err == nil {
			users = append(users, u)
		}
	}
	return users
}

func nodeToUser(node graph.Node) (*User, error) {
	props := node.Properties
	id, _ := props["id"].(string)
	email, _ := props["email"].(string)
	username, _ := props["username"].(string)
	company, _ := props["company"].(string)
	if company == "" {
		company = "Whyline Corp"
	}
	pwdHash, _ := props["password_hash"].(string)
	role, _ := props["role"].(string)

	isVerified := false
	if v, ok := props["is_verified"].(bool); ok {
		isVerified = v
	}

	createdAt := time.Now().UTC()
	if cStr, ok := props["created_at"].(string); ok {
		if t, err := time.Parse(time.RFC3339, cStr); err == nil {
			createdAt = t
		}
	}

	if id == "" || email == "" {
		return nil, ErrUserNotFound
	}

	return &User{
		ID:           id,
		Email:        email,
		Username:     username,
		Company:      company,
		PasswordHash: pwdHash,
		Role:         role,
		IsVerified:   isVerified,
		CreatedAt:    createdAt,
	}, nil
}

func (r *FalkorRepository) CreateCompany(name string) (*Company, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cleanName := strings.TrimSpace(name)
	if cleanName == "" {
		return nil, errors.New("company name cannot be empty")
	}

	compID := fmt.Sprintf("comp_%x", time.Now().UnixNano())
	nowStr := time.Now().UTC().Format(time.RFC3339)

	cypher := `
MERGE (c:Company {name: $name})
ON CREATE SET c.id = $id, c.created_at = $created_at
RETURN c.id AS id, c.name AS name, c.created_at AS created_at
`
	res, err := r.client.Query(ctx, r.graphName, cypher, map[string]interface{}{
		"name":       cleanName,
		"id":         compID,
		"created_at": nowStr,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create company in FalkorDB: %w", err)
	}

	createdAt := time.Now().UTC()
	if len(res.Records) > 0 {
		if idVal, ok := res.Records[0]["id"].(string); ok && idVal != "" {
			compID = idVal
		}
		if dtStr, ok := res.Records[0]["created_at"].(string); ok {
			if parsed, pErr := time.Parse(time.RFC3339, dtStr); pErr == nil {
				createdAt = parsed
			}
		}
	}

	return &Company{
		ID:        compID,
		Name:      cleanName,
		CreatedAt: createdAt,
	}, nil
}

func (r *FalkorRepository) ListCompanies() ([]*Company, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cypher := `
MATCH (c:Company)
RETURN c.id AS id, c.name AS name, c.created_at AS created_at
`
	res, err := r.client.ROQuery(ctx, r.graphName, cypher, nil)
	if err != nil {
		return nil, err
	}

	var companies []*Company
	for _, rec := range res.Records {
		name, _ := rec["name"].(string)
		if name == "" {
			continue
		}
		id, _ := rec["id"].(string)
		if id == "" {
			id = "comp_" + strings.ToLower(strings.ReplaceAll(name, " ", "_"))
		}
		createdAt := time.Now().UTC()
		if dtStr, ok := rec["created_at"].(string); ok {
			if parsed, pErr := time.Parse(time.RFC3339, dtStr); pErr == nil {
				createdAt = parsed
			}
		}
		companies = append(companies, &Company{
			ID:        id,
			Name:      name,
			CreatedAt: createdAt,
		})
	}
	return companies, nil
}

func (r *FalkorRepository) CompanyExists(name string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	norm := strings.ToLower(strings.TrimSpace(name))
	cypher := `
MATCH (c:Company)
WHERE toLower(c.name) = $name
RETURN c.name AS name
LIMIT 1
`
	res, err := r.client.ROQuery(ctx, r.graphName, cypher, map[string]interface{}{
		"name": norm,
	})
	if err != nil {
		return false, err
	}
	return len(res.Records) > 0, nil
}
