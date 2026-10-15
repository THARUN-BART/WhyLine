'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, api } from '@/lib/api';

interface UserContextType {
  currentUser: User | null;
  users: User[];
  token: string | null;
  isAuthenticated: boolean;
  setCurrentUser: (user: User | null) => void;
  loginUser: (email: string, password: string) => Promise<void>;
  registerUser: (payload: { email: string; username: string; company: string; password: string; otp?: string }) => Promise<void>;
  logoutUser: () => void;
  graphStats: { total_nodes: number; total_edges: number } | null;
  refreshStats: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  currentUser: null,
  users: [],
  token: null,
  isAuthenticated: false,
  setCurrentUser: () => {},
  loginUser: async () => {},
  registerUser: async () => {},
  logoutUser: () => {},
  graphStats: null,
  refreshStats: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [graphStats, setGraphStats] = useState<{ total_nodes: number; total_edges: number } | null>(null);

  const refreshStats = async () => {
    try {
      const stats = await api.getGraphStats();
      if (stats && stats.total_nodes) {
        setGraphStats({ total_nodes: stats.total_nodes, total_edges: stats.total_edges });
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    let savedToken: string | null = null;
    let savedUser: User | null = null;

    if (typeof window !== 'undefined') {
      savedToken = localStorage.getItem('whyline_token');
      const userStr = localStorage.getItem('whyline_user');
      if (savedToken) setToken(savedToken);
      if (userStr) {
        try {
          savedUser = JSON.parse(userStr);
          setCurrentUser(savedUser);
        } catch {
          // ignore
        }
      }
    }

    async function loadData() {
      try {
        const res = await api.getUsers();
        if (res && res.users && res.users.length > 0) {
          setUsers(res.users);
          // If no user was saved in localStorage, pick the first active real user from DB
          if (!savedUser && !savedToken) {
            setCurrentUser(res.users[0]);
          }
        }
      } catch {
        // ignore
      }
      refreshStats();
    }
    loadData();
  }, []);

  const loginUser = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setToken(res.token);
    setCurrentUser(res.user);
    // Refresh user list from backend
    try {
      const usersRes = await api.getUsers();
      if (usersRes?.users) setUsers(usersRes.users);
    } catch {
      // ignore
    }
  };

  const registerUser = async (payload: { email: string; username: string; company: string; password: string; otp?: string }) => {
    const res = await api.register(payload);
    setToken(res.token);
    setCurrentUser(res.user);
    // Refresh user list from backend
    try {
      const usersRes = await api.getUsers();
      if (usersRes?.users) setUsers(usersRes.users);
    } catch {
      // ignore
    }
  };

  const logoutUser = () => {
    api.logout();
    setToken(null);
    setCurrentUser(null);
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        users,
        token,
        isAuthenticated: !!token,
        setCurrentUser,
        loginUser,
        registerUser,
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
