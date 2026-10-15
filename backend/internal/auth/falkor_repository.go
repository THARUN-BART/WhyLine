package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/THARUN-BART/whyline/backend/internal/graph"
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
	// No hardcoded users or credentials in the code.
	// Platform administrators and users are managed and inserted directly into FalkorDB.
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
	approval_status: $approval_status,
	is_verified: $is_verified,
	created_at: $created_at
})
WITH u
MERGE (c:Company {name: $company})
MERGE (u)-[:BELONGS_TO]->(c)
`
	approvalStatus := user.ApprovalStatus
	if approvalStatus == "" {
		approvalStatus = "approved"
	}

	params := map[string]interface{}{
		"id":              user.ID,
		"email":           normEmail,
		"username":        normUsername,
		"company":         user.Company,
		"password_hash":   user.PasswordHash,
		"role":            user.Role,
		"approval_status": approvalStatus,
		"is_verified":     user.IsVerified,
		"created_at":      user.CreatedAt.Format(time.RFC3339),
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
	cypher := "MATCH (u:User) WHERE toLower(u.email) = $email OR toLower(u.username) = $email RETURN u LIMIT 1"
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

	cypher := "MATCH (u:User) WHERE u.id = $id OR toLower(u.email) = toLower($id) OR toLower(u.username) = toLower($id) OR 'usr_' + replace(toLower(u.email), '@', '_') = toLower($id) RETURN u LIMIT 1"
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
	cypher := "MATCH (u:User) WHERE toLower(u.username) = $username OR toLower(u.email) = $username RETURN u LIMIT 1"
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
	email, _ := props["email"].(string)
	username, _ := props["username"].(string)

	if email == "" && username != "" {
		email = username
	}
	if username == "" && email != "" {
		username = email
	}

	if email == "" && username == "" {
		return nil, ErrUserNotFound
	}

	id, _ := props["id"].(string)
	if id == "" {
		id = "usr_" + strings.ToLower(strings.ReplaceAll(email, "@", "_"))
	}

	company, _ := props["company"].(string)
	if company == "" {
		company = "Whyline"
	}

	pwdHash, _ := props["password_hash"].(string)
	if pwdHash == "" {
		pwdHash, _ = props["password"].(string)
	}

	role, _ := props["role"].(string)
	if role == "" {
		if strings.Contains(strings.ToLower(username), "admin") || strings.Contains(strings.ToLower(email), "admin") {
			role = "admin"
		} else {
			role = "user"
		}
	}

	approvalStatus, _ := props["approval_status"].(string)
	if approvalStatus == "" {
		approvalStatus = "approved"
	}

	isVerified := true
	if v, ok := props["is_verified"].(bool); ok {
		isVerified = v
	}

	createdAt := time.Now().UTC()
	if cStr, ok := props["created_at"].(string); ok {
		if t, err := time.Parse(time.RFC3339, cStr); err == nil {
			createdAt = t
		}
	}

	return &User{
		ID:             id,
		Email:          email,
		Username:       username,
		Company:        company,
		PasswordHash:   pwdHash,
		Role:           role,
		ApprovalStatus: approvalStatus,
		IsVerified:     isVerified,
		CreatedAt:      createdAt,
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
OPTIONAL MATCH (u:User) WHERE toLower(u.company) = toLower(c.name)
RETURN c.id AS id, c.name AS name, c.created_at AS created_at, count(u) AS user_count
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

		userCount := 0
		if uc, ok := rec["user_count"].(float64); ok {
			userCount = int(uc)
		} else if uc, ok := rec["user_count"].(int64); ok {
			userCount = int(uc)
		} else if uc, ok := rec["user_count"].(int); ok {
			userCount = uc
		}

		companies = append(companies, &Company{
			ID:        id,
			Name:      name,
			UserCount: userCount,
			CreatedAt: createdAt,
		})
	}
	return companies, nil
}

func (r *FalkorRepository) GetCompanyStats(companyName string) (*CompanyStats, error) {
	users, err := r.ListUsersByCompany(companyName, "")
	if err != nil {
		return nil, err
	}
	stats := &CompanyStats{
		Company:   companyName,
		UserCount: len(users),
	}
	for _, u := range users {
		switch strings.ToLower(strings.TrimSpace(u.ApprovalStatus)) {
		case "approved":
			stats.ApprovedCount++
		case "pending":
			stats.PendingCount++
		case "rejected":
			stats.RejectedCount++
		}
	}
	return stats, nil
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

func (r *FalkorRepository) UpdateApprovalStatus(userID string, status string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cypher := `
MATCH (u:User {id: $id})
SET u.approval_status = $status
RETURN u.id AS id
`
	res, err := r.client.Query(ctx, r.graphName, cypher, map[string]interface{}{
		"id":     userID,
		"status": status,
	})
	if err != nil {
		return fmt.Errorf("failed to update user approval status: %w", err)
	}
	if len(res.Records) == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (r *FalkorRepository) ListUsersByCompany(companyName string, approvalStatus string) ([]*User, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	normCompany := strings.ToLower(strings.TrimSpace(companyName))
	var cypher string
	var params map[string]interface{}

	if approvalStatus != "" {
		cypher = `
MATCH (u:User)
WHERE toLower(u.company) = $company AND toLower(u.approval_status) = $status
RETURN u
`
		params = map[string]interface{}{
			"company": normCompany,
			"status":  strings.ToLower(approvalStatus),
		}
	} else {
		cypher = `
MATCH (u:User)
WHERE toLower(u.company) = $company
RETURN u
`
		params = map[string]interface{}{
			"company": normCompany,
		}
	}

	res, err := r.client.ROQuery(ctx, r.graphName, cypher, params)
	if err != nil {
		return nil, err
	}

	var users []*User
	for _, n := range res.Nodes {
		if u, err := nodeToUser(n); err == nil {
			users = append(users, u)
		}
	}
	return users, nil
}
