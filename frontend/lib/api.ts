export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface User {
  id: string;
  email: string;
  username?: string;
  name?: string;
  company?: string;
  role: string;
  is_verified?: boolean;
  created_at?: string;
  active?: boolean;
}

export interface Company {
  id: string;
  name: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface GraphStats {
  graph: string;
  status: string;
  total_nodes: number;
  total_edges: number;
  labels?: string[];
}

export interface EntitySearchResult {
  id: string;
  label: string;
  name: string;
  description?: string;
}

export interface DecisionTrace {
  decision_id: string;
  title: string;
  summary?: string;
  date: string;
  status: string;
  decider_name: string;
  decider_role: string;
  ticket_title: string;
  ticket_url?: string;
  thread_channel: string;
  thread_excerpt: string;
  document_title: string;
  document_url?: string;
  affected_system: string;
  gap_level: string; // 'NONE' | 'DOC_MISSING'
  missing_link: string;
}

export interface ImpactedSystem {
  system_id: string;
  system_name: string;
  criticality: number;
  hop_distance: number;
  severity_score: number;
}

export interface ImpactAnalysisResult {
  decision_id: string;
  changed_system: string;
  impacted_systems: ImpactedSystem[];
}

export interface Contributor {
  person_id: string;
  name: string;
  role: string;
  is_active: boolean;
  contributions: number;
}

export interface WhoKnowsResult {
  system_name: string;
  contributors: Contributor[];
}

export interface SystemBusFactor {
  system_id: string;
  system_name: string;
  criticality: number;
  active_owners: number;
  departed_owners: number;
  transitive_dependents: number;
  risk_score: number;
  status: string; // 'ORPHANED' | 'HIGH_RISK_SINGLE_OWNER' | 'HEALTHY' | 'UNOWNED_NO_DEPENDENTS'
}

export interface BusFactorReport {
  total_systems: number;
  orphaned_systems: SystemBusFactor[];
  all_systems: SystemBusFactor[];
}

export interface RagPreset {
  id: string;
  title: string;
  question: string;
  category: string;
  expected_winner: string;
  description: string;
}

export interface RagCompareResult {
  question: string;
  category: string;
  verdict: string;
  why_graph_wins: string;
  rag: {
    retrieved_chunks?: any[];
    answer: string;
    blindspots?: string[];
  };
  graph: {
    answer: string;
    entities_identified?: string[];
    key_metrics?: {
      affected_systems_count?: number;
      highest_criticality?: number;
      max_hop_depth?: number;
    };
  };
}

export interface AgentChatResponse {
  answer: string;
  steps?: Array<{
    type: string;
    name?: string;
    input?: any;
    output?: any;
    content?: string;
  }>;
  cited_node_ids?: string[];
  invalid_ids?: string[] | null;
}

class ApiClient {
  private getHeaders(userId?: string, token?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (userId) {
      headers['X-User-ID'] = userId;
    }
    const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('whyline_token') : null);
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
  }

  async login(payload: { email: string; password: string }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Invalid email or password' }));
      throw new Error(err.error || 'Authentication failed');
    }
    const data = await res.json();
    if (typeof window !== 'undefined' && data.token) {
      localStorage.setItem('whyline_token', data.token);
      localStorage.setItem('whyline_user', JSON.stringify(data.user));
    }
    return data;
  }

  async sendOtp(email: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to send OTP' }));
      throw new Error(err.error || 'Failed to send OTP');
    }
    return res.json();
  }

  async verifyOtp(email: string, otp: string): Promise<{ message: string }> {
    const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Invalid or expired OTP code' }));
      throw new Error(err.error || 'Verification failed');
    }
    return res.json();
  }

  async register(payload: { email: string; username: string; company: string; password: string; otp?: string }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || 'Registration failed');
    }
    const data = await res.json();
    if (typeof window !== 'undefined' && data.token) {
      localStorage.setItem('whyline_token', data.token);
      localStorage.setItem('whyline_user', JSON.stringify(data.user));
    }
    return data;
  }

  async getMe(token?: string): Promise<User> {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: this.getHeaders(undefined, token),
    });
    if (!res.ok) {
      throw new Error('Unauthorized');
    }
    return res.json();
  }

  logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('whyline_token');
      localStorage.removeItem('whyline_user');
    }
  }

  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  }

  async getCompanies(): Promise<{ total: number; companies: Company[] }> {
    const res = await fetch(`${API_BASE}/api/auth/companies`);
    if (!res.ok) {
      return { total: 0, companies: [] };
    }
    return res.json();
  }

  async createCompany(name: string): Promise<{ message: string; company: Company }> {
    const res = await fetch(`${API_BASE}/api/auth/companies`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create company' }));
      throw new Error(err.error || 'Failed to create company');
    }
    return res.json();
  }

  async getUsers(): Promise<{ users: User[] }> {
    const res = await fetch(`${API_BASE}/api/auth/users`);
    return res.json();
  }

  async getGraphStats(): Promise<GraphStats> {
    const res = await fetch(`${API_BASE}/api/graph/stats`);
    return res.json();
  }

  async queryGraph(query: string): Promise<{ columns: string[]; records: any[] }> {
    const res = await fetch(`${API_BASE}/api/graph/query`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ query }),
    });
    return res.json();
  }

  async findEntity(q: string): Promise<EntitySearchResult[]> {
    const res = await fetch(`${API_BASE}/api/tools/find-entity?q=${encodeURIComponent(q)}`);
    return res.json();
  }

  async traceDecision(id: string): Promise<DecisionTrace> {
    const res = await fetch(`${API_BASE}/api/tools/trace-decision?id=${encodeURIComponent(id)}`);
    return res.json();
  }

  async impactOf(id: string): Promise<ImpactAnalysisResult> {
    const res = await fetch(`${API_BASE}/tools/impact-of?id=${encodeURIComponent(id)}`).catch(() => null)
      || await fetch(`${API_BASE}/api/tools/impact-of?id=${encodeURIComponent(id)}`);
    return res.json();
  }

  async whoKnows(system: string): Promise<WhoKnowsResult> {
    const res = await fetch(`${API_BASE}/api/tools/who-knows?system=${encodeURIComponent(system)}`);
    return res.json();
  }

  async getBusFactor(): Promise<BusFactorReport> {
    const res = await fetch(`${API_BASE}/api/tools/bus-factor`);
    return res.json();
  }

  async getMemory(userId: string) {
    const res = await fetch(`${API_BASE}/api/memory`, {
      headers: this.getHeaders(userId),
    });
    return res.json();
  }

  async simulateMemory(userId: string, body: { system_id: string; action: string; new_dependency_id?: string }) {
    const res = await fetch(`${API_BASE}/api/memory/simulate`, {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async getRagPresets(): Promise<{ presets: RagPreset[] }> {
    const res = await fetch(`${API_BASE}/api/rag/presets`);
    return res.json();
  }

  async compareRag(preset_id?: string, question?: string): Promise<RagCompareResult> {
    const res = await fetch(`${API_BASE}/api/rag/compare`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(preset_id ? { preset_id } : { question }),
    });
    return res.json();
  }

  async chatAgent(prompt: string, userId: string): Promise<AgentChatResponse> {
    const res = await fetch(`${API_BASE}/api/agent/chat`, {
      method: 'POST',
      headers: this.getHeaders(userId),
      body: JSON.stringify({ prompt, user_id: userId }),
    });
    return res.json();
  }
}

export const api = new ApiClient();
