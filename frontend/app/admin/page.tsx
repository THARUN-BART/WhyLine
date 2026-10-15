'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/components/UserContext';

export default function AdminPage() {
  const { currentUser, isAdmin, companies, createCompany, users } = useUser();
  const [newCompanyName, setNewCompanyName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const created = await createCompany(newCompanyName.trim());
      setMessage(`Organization "${created.name}" created successfully and added to user signup options.`);
      setNewCompanyName('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create organization. Ensure admin permissions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <main className="flex-1 max-w-4xl mx-auto p-8 flex flex-col items-center justify-center text-center">
        <span className="material-symbols-outlined text-5xl text-outline mb-4">lock</span>
        <h1 className="text-xl font-bold text-on-surface">Authentication Required</h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-md">
          Please sign in with your administrator account to access platform governance and organization management.
        </p>
        <Link
          href="/login"
          className="mt-6 px-6 py-2.5 rounded-lg bg-primary text-on-primary font-bold text-sm shadow hover:bg-primary-container transition-colors"
        >
          Sign In to Whyline
        </Link>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex-1 max-w-4xl mx-auto p-8 flex flex-col items-center justify-center text-center">
        <span className="material-symbols-outlined text-5xl text-error mb-4">gpp_maybe</span>
        <h1 className="text-xl font-bold text-on-surface">Restricted Administrator Area</h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-md">
          Your account (<strong>{currentUser.email}</strong>, role: <code>{currentUser.role}</code>) does not have administrator privileges. Only accounts with <code>role: admin</code> can manage institutional organizations and platform governance.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/"
            className="px-5 py-2 rounded-lg bg-surface-container text-on-surface font-semibold text-xs border border-outline-variant hover:bg-surface-container-high transition-colors"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/login"
            className="px-5 py-2 rounded-lg bg-primary text-on-primary font-semibold text-xs shadow hover:bg-primary-container transition-colors"
          >
            Switch to Admin User
          </Link>
        </div>
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
                GOVERNANCE &amp; TENANCY
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">
                Admin Console
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              Platform Administration
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Manage verified institutional organizations, inspect registered identities, and configure tenant access.
            </p>
          </div>

          <div className="flex items-center gap-space-sm z-10">
            <div className="px-space-md py-space-xs rounded-lg bg-secondary-fixed/40 border border-secondary/30 flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[18px] text-secondary">verified_user</span>
              <span className="text-xs font-semibold text-on-secondary-fixed">
                Authenticated Admin: {currentUser.username || currentUser.email}
              </span>
            </div>
          </div>
        </div>

        {/* Status Alerts */}
        {message && (
          <div className="p-space-md rounded-xl bg-secondary-fixed/30 border border-secondary/40 text-xs text-on-secondary-fixed flex items-center gap-space-sm">
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

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-xl">
          {/* Column 1: Add New Company */}
          <div className="lg:col-span-1 bg-surface-container-lowest p-space-xl rounded-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-space-xs mb-space-sm">
                <span className="material-symbols-outlined text-[20px] text-primary">add_business</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Add Organization
                </h2>
              </div>
              <p className="text-xs text-on-surface-variant mb-space-lg leading-relaxed">
                Add an institution to FalkorDB. Once added, new engineers will be able to select it from the dropdown during registration.
              </p>

              <form onSubmit={handleAddCompany} className="space-y-space-md">
                <div>
                  <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="e.g. Google Cloud, Stripe, Netflix"
                    className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !newCompanyName.trim()}
                  className="w-full py-2.5 px-4 rounded-lg bg-primary text-on-primary font-headline-sm text-xs font-bold hover:bg-primary-container transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">domain_add</span>
                      <span>Create Organization Node</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            <div className="mt-space-lg p-space-md rounded-lg bg-surface-container-low border border-outline-variant/20 text-[11px] text-on-surface-variant">
              <span className="font-semibold text-on-surface block mb-1">Restricted Admin Action</span>
              This communicates directly with <code>POST /api/auth/companies</code> protected by Bearer JWT middleware.
            </div>
          </div>

          {/* Column 2: Available Companies & Users Table */}
          <div className="lg:col-span-2 flex flex-col gap-space-lg">
            {/* Companies List */}
            <div className="bg-surface-container-lowest p-space-xl rounded-xl border border-outline-variant/30 shadow-sm">
              <div className="flex items-center justify-between mb-space-md">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-[20px] text-secondary">business</span>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Verified Organizations ({companies.length})
                  </h2>
                </div>
                <span className="text-[10px] font-label-code-sm bg-surface-container px-2 py-0.5 rounded text-on-surface-variant">
                  Signup Dropdown Source
                </span>
              </div>

              <div className="divide-y divide-outline-variant/20 border border-outline-variant/20 rounded-lg overflow-hidden">
                {companies.map((c) => (
                  <div key={c.id} className="p-3 flex items-center justify-between bg-surface-container-low/40 hover:bg-surface-container-low transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-secondary-fixed/40 flex items-center justify-center text-secondary font-bold text-xs">
                        {c.name[0]}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-on-surface">{c.name}</p>
                        <p className="text-[10px] text-on-surface-variant font-mono">{c.id}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-label-edge bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded font-bold uppercase">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Users Registered */}
            <div className="bg-surface-container-lowest p-space-xl rounded-xl border border-outline-variant/30 shadow-sm">
              <div className="flex items-center justify-between mb-space-md">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-[20px] text-primary">group</span>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    System Users &amp; Permissions ({users.length})
                  </h2>
                </div>
                <span className="text-[10px] font-label-code-sm bg-surface-container px-2 py-0.5 rounded text-on-surface-variant">
                  FalkorDB :User Nodes
                </span>
              </div>

              <div className="divide-y divide-outline-variant/20 border border-outline-variant/20 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                {users.map((u) => (
                  <div key={u.id} className="p-3 flex items-center justify-between bg-surface-container-low/40 hover:bg-surface-container-low transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
                        {u.name ? u.name[0] : u.username ? u.username[0].toUpperCase() : 'U'}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-on-surface">
                          {u.name || u.username} <span className="text-on-surface-variant font-normal">({u.email})</span>
                        </p>
                        <p className="text-[10px] text-on-surface-variant">
                          Company: {u.company || 'Whyline Corp'}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-label-edge px-2 py-0.5 rounded font-bold uppercase ${
                      u.role === 'admin'
                        ? 'bg-primary-fixed text-primary'
                        : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
