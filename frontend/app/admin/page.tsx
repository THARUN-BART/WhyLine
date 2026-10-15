'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, Company, User } from '@/lib/api';
import { useUser } from '@/components/UserContext';

export default function AdminPage() {
  const { currentUser, isAdmin, companies, refreshCompanies, graphStats } = useUser();

  // State: Create Company
  const [newCompanyName, setNewCompanyName] = useState('');
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  // State: Add User / Company Admin
  const [userCompany, setUserCompany] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<'company_admin' | 'user'>('company_admin');
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // State: Stats and list of users for statistics count
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // State: Feedback messages
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const [uRes] = await Promise.all([
        api.getUsers().catch(() => ({ users: [] })),
        refreshCompanies().catch(() => null),
      ]);
      if (uRes?.users) setAllUsers(uRes.users);
    } catch {
      // ignore
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (currentUser && isAdmin) {
      loadData();
    }
  }, [currentUser, isAdmin]);

  // Set default company in Add User dropdown when companies load
  useEffect(() => {
    if (!userCompany && companies.length > 0) {
      setUserCompany(companies[0].name);
    }
  }, [companies, userCompany]);

  // Handle 1: Creating Company Alone
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setError(null);
    setMessage(null);
    setIsCreatingCompany(true);
    try {
      const res = await api.createCompany(newCompanyName.trim());
      setMessage(`Organization "${res.company.name}" created successfully in FalkorDB.`);
      setNewCompanyName('');
      await refreshCompanies();
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create organization.');
    } finally {
      setIsCreatingCompany(false);
    }
  };

  // Handle 2: Adding User to Company Alone
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userCompany.trim() || !userEmail.trim() || !userUsername.trim() || !userPassword.trim()) {
      setError('Please fill in all user details.');
      return;
    }
    setError(null);
    setMessage(null);
    setIsCreatingUser(true);
    try {
      const res = await api.adminCreateUser({
        company_name: userCompany.trim(),
        email: userEmail.trim(),
        username: userUsername.trim(),
        password: userPassword.trim(),
        role: userRole,
      });
      setMessage(
        `User @${res.user.username} created successfully for "${userCompany}" with role "${userRole}" and immediate approved status.`
      );
      setUserEmail('');
      setUserUsername('');
      setUserPassword('');
      await refreshCompanies();
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create user.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  if (!currentUser) {
    return (
      <main className="flex-1 max-w-4xl mx-auto p-8 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <span className="material-symbols-outlined text-5xl text-outline mb-4">lock</span>
        <h1 className="text-xl font-bold text-on-surface">Authentication Required</h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-md">
          Please sign in with your root administrator account to access platform configuration.
        </p>
        <Link
          href="/login"
          className="mt-6 px-6 py-2.5 rounded-lg bg-primary text-on-primary font-bold text-sm shadow hover:bg-surface-tint transition-colors"
        >
          Sign In to Whyline
        </Link>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex-1 max-w-4xl mx-auto p-8 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <span className="material-symbols-outlined text-5xl text-error mb-4">gpp_maybe</span>
        <h1 className="text-xl font-bold text-on-surface">Restricted Administrator Area</h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-md">
          Only accounts with <code>role: admin</code> can access the Platform Admin Console.
        </p>
        <Link
          href="/"
          className="mt-6 px-5 py-2 rounded-lg bg-surface-container text-on-surface font-semibold text-xs border border-outline-variant hover:bg-surface-container-high transition-colors"
        >
          Back to Dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto p-space-xl">
      <div className="flex flex-col gap-space-xl">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md p-space-xl bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm relative overflow-hidden">
          <div className="flex flex-col gap-space-2xs z-10">
            <div className="flex items-center gap-space-xs">
              <span className="font-label-edge text-label-edge text-primary uppercase font-bold bg-primary-fixed px-space-xs py-space-2xs rounded tracking-widest">
                ROOT ADMINISTRATOR
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">
                Live FalkorDB • Multi-Tenant
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              Platform Admin Console
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Manage organizations, create company administrators and users, and inspect company user statistics.
            </p>
          </div>

          <div className="flex items-center gap-space-sm z-10">
            <div className="px-space-md py-space-xs rounded-lg bg-primary-fixed text-primary border border-primary/20 flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
              <span className="text-xs font-semibold">
                Admin: {currentUser.username || currentUser.email}
              </span>
            </div>
          </div>
        </div>

        {/* Feedback Notifications */}
        {message && (
          <div className="p-space-md rounded-xl bg-secondary-fixed/40 border border-secondary/40 text-xs text-on-secondary-fixed flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[18px] text-secondary">check_circle</span>
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="p-space-md rounded-xl bg-error-container/40 border border-error/30 text-xs text-error flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* 1. Statistics Cards (Stats Alone) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="p-space-lg bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-code-sm text-xs text-on-surface-variant uppercase font-medium">
                Total Companies
              </span>
              <span className="material-symbols-outlined text-secondary text-lg">domain</span>
            </div>
            <div className="font-headline-xl text-3xl text-on-surface font-bold mt-2">
              {companies.length}
            </div>
            <span className="text-[10px] text-outline mt-1 font-label-code-sm">Registered organizations</span>
          </div>

          <div className="p-space-lg bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-code-sm text-xs text-on-surface-variant uppercase font-medium">
                Total Users
              </span>
              <span className="material-symbols-outlined text-primary text-lg">group</span>
            </div>
            <div className="font-headline-xl text-3xl text-on-surface font-bold mt-2">
              {allUsers.length}
            </div>
            <span className="text-[10px] text-outline mt-1 font-label-code-sm">Across all companies</span>
          </div>

          <div className="p-space-lg bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-code-sm text-xs text-on-surface-variant uppercase font-medium">
                Graph Nodes
              </span>
              <span className="material-symbols-outlined text-outline text-lg">hub</span>
            </div>
            <div className="font-headline-xl text-3xl text-on-surface font-bold mt-2">
              {graphStats?.total_nodes ?? 68}
            </div>
            <span className="text-[10px] text-outline mt-1 font-label-code-sm">Knowledge graph entities</span>
          </div>

          <div className="p-space-lg bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-label-code-sm text-xs text-on-surface-variant uppercase font-medium">
                Graph Edges
              </span>
              <span className="material-symbols-outlined text-outline text-lg">share</span>
            </div>
            <div className="font-headline-xl text-3xl text-on-surface font-bold mt-2">
              {graphStats?.total_edges ?? 58}
            </div>
            <span className="text-[10px] text-outline mt-1 font-label-code-sm">Cross-domain relationships</span>
          </div>
        </div>

        {/* 2. Main Two Action Forms: Add User & Create Company */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-xl">
          {/* Action 1: Add User to Company */}
          <div className="bg-surface-container-lowest p-space-xl rounded-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-space-xs mb-space-xs">
                <span className="material-symbols-outlined text-[20px] text-primary">person_add</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Add User &amp; Assign Company
                </h2>
              </div>
              <p className="text-xs text-on-surface-variant mb-space-lg leading-relaxed">
                Create a new user or company administrator directly. User will be automatically approved and affiliated with their company.
              </p>

              <form onSubmit={handleAddUser} className="space-y-space-md">
                <div>
                  <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                    Company Name *
                  </label>
                  <div className="mt-1 flex gap-2">
                    <select
                      value={userCompany}
                      onChange={(e) => setUserCompany(e.target.value)}
                      className="w-1/2 px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary"
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Or type new company..."
                      value={userCompany}
                      onChange={(e) => setUserCompany(e.target.value)}
                      className="w-1/2 px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary placeholder:text-outline"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="lead@company.com"
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary placeholder:text-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                      Username *
                    </label>
                    <input
                      type="text"
                      required
                      value={userUsername}
                      onChange={(e) => setUserUsername(e.target.value)}
                      placeholder="lead_username"
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary placeholder:text-outline"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary placeholder:text-outline"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                      Account Role *
                    </label>
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value as any)}
                      className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary"
                    >
                      <option value="company_admin">Company Admin (Can approve employees)</option>
                      <option value="user">Standard User / Engineer</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isCreatingUser || !userEmail || !userUsername || !userPassword}
                  className="w-full mt-2 py-2.5 px-4 rounded-lg bg-primary text-on-primary font-headline-sm text-xs font-bold hover:bg-surface-tint transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isCreatingUser ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      <span>Creating User...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">person_add</span>
                      <span>Create &amp; Assign User</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Action 2: Create Company */}
          <div className="bg-surface-container-lowest p-space-xl rounded-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-space-xs mb-space-xs">
                <span className="material-symbols-outlined text-[20px] text-secondary">add_business</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Create Company
                </h2>
              </div>
              <p className="text-xs text-on-surface-variant mb-space-lg leading-relaxed">
                Register a new institutional organization node in FalkorDB so engineers can select it during registration.
              </p>

              <form onSubmit={handleCreateCompany} className="space-y-space-md">
                <div>
                  <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                    Company / Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="e.g. Acme Corp, Stripe, Datadog"
                    className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary placeholder:text-outline"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreatingCompany || !newCompanyName.trim()}
                  className="w-full py-2.5 px-4 rounded-lg bg-secondary text-on-secondary font-headline-sm text-xs font-bold hover:opacity-90 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isCreatingCompany ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      <span>Creating Company...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">domain_add</span>
                      <span>Create Company Node</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-space-lg p-space-md rounded-lg bg-surface-container-low border border-outline-variant/20 text-[11px] text-on-surface-variant">
              <span className="font-semibold text-on-surface block mb-1">Direct API Mapping</span>
              Calls <code>POST /api/auth/companies</code> guarded by root administrator token.
            </div>
          </div>
        </div>

        {/* 3. Company Stats Table (Showing Company & User Count Alone) */}
        <div className="bg-surface-container-lowest p-space-xl rounded-xl border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between mb-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[20px] text-primary">analytics</span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Company Statistics &amp; User Counts ({companies.length})
              </h2>
            </div>
            <button
              onClick={loadData}
              disabled={isLoadingData}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              <span className={`material-symbols-outlined text-sm ${isLoadingData ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>Refresh Stats</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-outline-variant/20 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low text-on-surface-variant uppercase font-label-code-sm border-b border-outline-variant/20">
                <tr>
                  <th className="p-3">Company Name</th>
                  <th className="p-3">Company ID</th>
                  <th className="p-3">Total Users in Company</th>
                  <th className="p-3">Created Date</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {companies.map((c) => {
                  const companyUserCount =
                    c.user_count ??
                    allUsers.filter((u) => u.company?.toLowerCase() === c.name.toLowerCase()).length;

                  return (
                    <tr key={c.id} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-primary-fixed text-primary font-bold text-xs flex items-center justify-center">
                            {c.name[0]}
                          </div>
                          <span className="font-semibold text-on-surface text-xs">{c.name}</span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-on-surface-variant">
                        {c.id}
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-md font-label-code-md text-xs bg-surface-container text-on-surface font-bold">
                          {companyUserCount} {companyUserCount === 1 ? 'user' : 'users'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-on-surface-variant">
                        {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="p-3 text-right">
                        <span className="px-2 py-0.5 rounded font-label-edge text-[10px] bg-secondary-fixed text-on-secondary-fixed uppercase font-bold">
                          Active
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
