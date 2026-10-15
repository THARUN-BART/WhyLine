// ============================================================================
// Queries: Company User Approval & Institutional Isolation
// Executed by: internal/auth/falkor_repository.go
// ============================================================================

// 1. Seed Platform Root Administrator & Default Users (Idempotent Merge)
MERGE (u:User {email: $email})
ON CREATE SET 
    u.id = $id,
    u.created_at = $created_at
SET u.username = $username,
    u.password_hash = $password_hash,
    u.role = $role,
    u.approval_status = $approval_status,
    u.is_verified = $is_verified,
    u.company = $company
WITH u
MERGE (c:Company {name: $company})
MERGE (u)-[:BELONGS_TO]->(c);

// 2. Employee Registration with Pending Status
CREATE (u:User {
    id: $id,
    email: $email,
    username: $username,
    company: $company,
    password_hash: $password_hash,
    role: "user",
    approval_status: "pending",
    is_verified: $is_verified,
    created_at: $created_at
})
WITH u
MERGE (c:Company {name: $company})
MERGE (u)-[:BELONGS_TO]->(c);

// 3. Update User Approval Status (Approve/Reject by Company Admin or Platform Admin)
// Used by POST /api/auth/company/approve-user
MATCH (u:User {id: $id})
SET u.approval_status = $status
RETURN u.id AS id;

// 4. List Company Employees with Status Filter
// Used by GET /api/auth/company/employees?status=pending
MATCH (u:User)
WHERE toLower(u.company) = $company AND toLower(u.approval_status) = $status
RETURN u;

// 5. Get Company User Count and Statistics (Company Isolation)
// Used by GET /api/auth/company/stats
MATCH (u:User)
WHERE toLower(u.company) = $company
RETURN u;
