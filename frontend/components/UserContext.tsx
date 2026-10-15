import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Company, api } from '@/lib/api';

interface UserContextType {
  currentUser: User | null;
  users: User[];
  companies: Company[];
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCompanyAdmin: boolean;
  isPending: boolean;
  authInitialized: boolean;
  setCurrentUser: (user: User | null) => void;
  loginUser: (email: string, password: string) => Promise<User>;
  registerUser: (payload: { email: string; username: string; company: string; password: string; otp?: string }) => Promise<void>;
  createCompany: (name: string) => Promise<Company>;
  refreshCompanies: () => Promise<void>;
  refreshCurrentUser: () => Promise<User | null>;
  logoutUser: () => void;
  graphStats: { total_nodes: number; total_edges: number } | null;
  refreshStats: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  currentUser: null,
  users: [],
  companies: [],
  token: null,
  isAuthenticated: false,
  isAdmin: false,
  isCompanyAdmin: false,
  isPending: false,
  authInitialized: false,
  setCurrentUser: () => {},
  loginUser: async () => ({ id: '', email: '', role: '' }),
  registerUser: async () => {},
  createCompany: async () => ({ id: '', name: '', created_at: '' }),
  refreshCompanies: async () => {},
  refreshCurrentUser: async () => null,
  logoutUser: () => {},
  graphStats: null,
  refreshStats: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('whyline_user');
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('whyline_token');
    }
    return null;
  });

  const [authInitialized] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [graphStats, setGraphStats] = useState<{ total_nodes: number; total_edges: number } | null>(null);

  const refreshStats = async () => {
    try {
      const stats = await api.getGraphStats();
      if (stats && typeof stats.total_nodes === 'number') {
        setGraphStats({ total_nodes: stats.total_nodes, total_edges: stats.total_edges ?? 0 });
      }
    } catch {
      // ignore
    }
  };

  const refreshCompanies = async () => {
    try {
      const res = await api.getCompanies();
      if (res && res.companies) {
        setCompanies(res.companies);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const savedToken = token;
    const savedUser = currentUser;

    async function loadData() {
      // Always refresh companies and live graph stats on boot
      refreshCompanies();
      refreshStats();

      // Only fetch users list if an authenticated admin session exists
      if (savedToken && savedUser?.role === 'admin') {
        try {
          const res = await api.getUsers();
          if (res && res.users && res.users.length > 0) {
            setUsers(res.users);
          }
        } catch {
          // ignore
        }
      }
    }
    loadData();
  }, []);

  const loginUser = async (email: string, password: string): Promise<User> => {
    const res = await api.login({ email, password });
    setToken(res.token);
    setCurrentUser(res.user);
    if (typeof window !== 'undefined') {
      localStorage.setItem('whyline_token', res.token);
      localStorage.setItem('whyline_user', JSON.stringify(res.user));
    }
    // Refresh user list if admin
    if (res.user?.role === 'admin') {
      try {
        const usersRes = await api.getUsers();
        if (usersRes?.users) setUsers(usersRes.users);
      } catch {
        // ignore
      }
    }
    refreshCompanies();
    refreshStats();
    return res.user;
  };

  const registerUser = async (payload: { email: string; username: string; company: string; password: string; otp?: string }) => {
    const res = await api.register(payload);
    setToken(res.token);
    setCurrentUser(res.user);
    if (res.user?.role === 'admin') {
      try {
        const usersRes = await api.getUsers();
        if (usersRes?.users) setUsers(usersRes.users);
      } catch {
        // ignore
      }
    }
    refreshCompanies();
  };

  const createCompany = async (name: string): Promise<Company> => {
    const res = await api.createCompany(name);
    await refreshCompanies();
    return res.company;
  };

  const refreshCurrentUser = async (): Promise<User | null> => {
    try {
      const user = await api.getMe(token || undefined);
      if (user) {
        setCurrentUser(user);
        if (typeof window !== 'undefined') {
          localStorage.setItem('whyline_user', JSON.stringify(user));
        }
        return user;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const logoutUser = () => {
    api.logout();
    setToken(null);
    setCurrentUser(null);
  };

  const isAdmin = currentUser?.role === 'admin';
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const isPending = currentUser?.approval_status === 'pending';

  return (
    <UserContext.Provider
      value={{
        currentUser,
        users,
        companies,
        token,
        isAuthenticated: !!token,
        isAdmin,
        isCompanyAdmin,
        isPending,
        authInitialized,
        setCurrentUser,
        loginUser,
        registerUser,
        createCompany,
        refreshCompanies,
        refreshCurrentUser,
        logoutUser,
        graphStats,
        refreshStats,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
