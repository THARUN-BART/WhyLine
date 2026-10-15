// ============================================================================
// Queries Used Till Now: User Authentication & Multi-Company Management
// Executed by: internal/auth/falkor_repository.go
// ============================================================================

// 1. Seed Default Demo Users with Company Relationships (Idempotent Merge)
// Used when server starts up to ensure demo accounts and company nodes exist.
MERGE (u:User {email: $email})
ON CREATE SET 
    u.id = $id,
    u.username = $username,
    u.company = $company,
    u.password_hash = $password_hash,
    u.role = $role,
    u.is_verified = $is_verified,
    u.created_at = $created_at
WITH u
MERGE (c:Company {name: $company})
MERGE (u)-[:BELONGS_TO]->(c);

// 2. Check If User Exists (Registration Pre-check)
// Used during registration to verify email or username uniqueness.
MATCH (u:User) 
WHERE u.email = $email OR u.username = $username 
RETURN u.id 
LIMIT 1;

// 3. Create New User Node with Company Relationship (Registration)
// Used when a new user registers through POST /api/auth/register.
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
MERGE (u)-[:BELONGS_TO]->(c);

// 4. Find User by Email (Login)
// Used by POST /api/auth/login when user enters email.
MATCH (u:User {email: $email}) 
RETURN u;

// 5. Find User by Username (Login)
// Used by POST /api/auth/login when user enters username.
MATCH (u:User {username: $username}) 
RETURN u;

// 6. Find User by ID (Profile & JWT Token Verification)
// Used by GET /api/auth/me to fetch authenticated user profile.
MATCH (u:User {id: $id}) 
RETURN u;

// 7. List All Users with Company (User Picker)
// Used by GET /api/auth/users to display available demo accounts and company affiliations.
MATCH (u:User) 
RETURN u;

// 8. Find All Users Belonging to a Company
// Multi-tenancy lookup for organization-level provenance.
MATCH (u:User)-[:BELONGS_TO]->(c:Company {name: $company})
RETURN u.id AS user_id, u.username AS username, u.email AS email, c.name AS company;

// 9. Delete a User by Username or Email
// Used to remove test users or purge an account.
MATCH (u:User {username: $username}) 
DETACH DELETE u;
