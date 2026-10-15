package auth

import (
	"context"
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
			PasswordHash: string(hashedPassword),
			Role:         "admin",
			IsVerified:   true,
			CreatedAt:    time.Now().UTC(),
		},
		{
			ID:           "usr_alice",
			Email:        "alice@whyline.dev",
			Username:     "alice",
			PasswordHash: string(hashedPassword),
			Role:         "engineer",
			IsVerified:   true,
			CreatedAt:    time.Now().UTC(),
		},
		{
			ID:           "usr_bob",
			Email:        "bob@whyline.dev",
			Username:     "bob",
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
`
		params := map[string]interface{}{
			"id":            u.ID,
			"email":         strings.ToLower(u.Email),
			"username":      strings.ToLower(u.Username),
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
	password_hash: $password_hash,
	role: $role,
	is_verified: $is_verified,
	created_at: $created_at
})
`
	params := map[string]interface{}{
		"id":            user.ID,
		"email":         normEmail,
		"username":      normUsername,
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
		PasswordHash: pwdHash,
		Role:         role,
		IsVerified:   isVerified,
		CreatedAt:    createdAt,
	}, nil
}
