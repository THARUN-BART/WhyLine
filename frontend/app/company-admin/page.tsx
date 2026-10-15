'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, User, CompanyStats } from '@/lib/api';
import { useUser } from '@/components/UserContext';

export default function CompanyAdminPage() {
  const { currentUser, isCompanyAdmin, isAdmin } = useUser();
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [pendingEmployees, setPendingEmployees] = useState<User[]>([]);
  const [approvedEmployees, setApprovedEmployees] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, pendingRes, approvedRes] = await Promise.all([
        api.getCompanyStats().catch(() => null),
        api.getCompanyEmployees('pending').catch(() => ({ total: 0, employees: [] })),
        api.getCompanyEmployees('approved').catch(() => ({ total: 0, employees: [] })),
      ]);
      if (statsRes) setStats(statsRes);
      if (pendingRes?.employees) setPendingEmployees(pendingRes.employees);
      if (approvedRes?.employees) setApprovedEmployees(approvedRes.employees);
    } catch (err: any) {
      setError(err?.message || 'Failed to load company employee data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const handleApprove = async (userId: string, username: string) => {
    setActionLoadingId(userId);
    setError(null);
    setMessage(null);
    try {
      await api.approveUser(userId, 'approved');
      setMessage(`Employee @${username} has been approved! They now have full dashboard access.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || `Failed to approve @${username}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to reject registration for @${username}?`)) {
      return;
    }
    setActionLoadingId(userId);
    setError(null);
    setMessage(null);
    try {
      await api.approveUser(userId, 'rejected');
      setMessage(`Employee @${username} registration was rejected.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || `Failed to reject @${username}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!currentUser) {
    return (
      <main className="flex-1 max-w-4xl mx-auto p-8 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <span className="material-symbols-outlined text-5xl text-outline mb-4">lock</span>
        <h1 className="text-xl font-bold text-on-surface">Authentication Required</h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-md">
          Please sign in with your company administrator account to manage employee registrations.
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

  if (!isCompanyAdmin && !isAdmin) {
    return (
      <main className="flex-1 max-w-4xl mx-auto p-8 flex flex-col items-center justify-center text-center min-h-[60vh]">
        <span className="material-symbols-outlined text-5xl text-error mb-4">gpp_maybe</span>
        <h1 className="text-xl font-bold text-on-surface">Company Administrator Access Required</h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-md">
          Only accounts with <code>company_admin</code> privileges can review and approve employee registrations for{' '}
          <strong>{currentUser.company}</strong>.
        </p>
        <Link
          href="/"
          className="mt-6 px-6 py-2.5 rounded-lg bg-surface-container text-on-surface font-semibold text-xs border border-outline-variant hover:bg-surface-container-high transition-colors"
        >
          Back to Dashboard
        </Link>
      </main>
    );
  }

  const companyName = currentUser.company || stats?.company || 'Organization';

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto p-space-xl">
      <div className="flex flex-col gap-space-xl">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md p-space-xl bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm relative overflow-hidden">
          <div className="flex flex-col gap-space-2xs z-10">
            <div className="flex items-center gap-space-xs">
              <span className="font-label-edge text-label-edge text-primary uppercase font-bold bg-primary-fixed px-space-xs py-space-2xs rounded tracking-widest">
                TENANT ADMINISTRATION
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">
                {companyName} Workspace
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              Employee Approvals &amp; Access Control
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Review and approve incoming employee signups for <strong>{companyName}</strong>. Approved users gain access to the architectural reasoning graph and engineering dashboard.
            </p>
          </div>

          <div className="flex items-center gap-space-sm z-10">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-space-md py-space-xs rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-headline-sm text-xs flex items-center gap-1.5 border border-outline-variant/30"
            >
              <span className={`material-symbols-outlined text-sm ${isLoading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
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

        {/* Metric Cards (Stats for this company alone) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <div className="p-space-lg bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <span className="font-label-code-sm text-xs text-on-surface-variant uppercase font-medium">
              Company Name
            </span>
            <div className="font-headline-xl text-xl text-on-surface font-bold mt-2 truncate">
              {companyName}
            </div>
            <span className="text-[10px] text-outline mt-1 font-label-code-sm">Tenant Domain Boundary</span>
          </div>

          <div className="p-space-lg bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <span className="font-label-code-sm text-xs text-on-surface-variant uppercase font-medium">
              Total Employees
            </span>
            <div className="font-headline-xl text-3xl text-on-surface font-bold mt-2">
              {stats?.user_count ?? (pendingEmployees.length + approvedEmployees.length)}
            </div>
            <span className="text-[10px] text-outline mt-1 font-label-code-sm">Registered under {companyName}</span>
          </div>

          <div className="p-space-lg bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <span className="font-label-code-sm text-xs text-on-surface-variant uppercase font-medium">
              Pending Approvals
            </span>
            <div className="font-headline-xl text-3xl text-secondary font-bold mt-2">
              {pendingEmployees.length}
            </div>
            <span className="text-[10px] text-secondary mt-1 font-label-code-sm">Awaiting your approval</span>
          </div>

          <div className="p-space-lg bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm flex flex-col justify-between">
            <span className="font-label-code-sm text-xs text-on-surface-variant uppercase font-medium">
              Approved Active
            </span>
            <div className="font-headline-xl text-3xl text-primary font-bold mt-2">
              {approvedEmployees.length}
            </div>
            <span className="text-[10px] text-primary mt-1 font-label-code-sm">Dashboard access granted</span>
          </div>
        </div>

        {/* Section 1: Pending Approvals Table */}
        <div className="bg-surface-container-lowest p-space-xl rounded-xl border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between mb-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[20px] text-secondary">pending_actions</span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Pending Employee Registrations ({pendingEmployees.length})
              </h2>
            </div>
            <span className="text-[10px] font-label-code-sm bg-secondary-fixed/50 text-on-secondary-fixed px-2 py-0.5 rounded font-bold uppercase">
              Action Required
            </span>
          </div>

          {pendingEmployees.length === 0 ? (
            <div className="p-8 text-center bg-surface-container-low/30 rounded-lg border border-outline-variant/20 flex flex-col items-center">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">task_alt</span>
              <p className="text-xs font-semibold text-on-surface">No pending employee signups</p>
              <p className="text-[11px] text-on-surface-variant mt-1">
                All employee registrations for {companyName} have been reviewed.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-outline-variant/20 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low text-on-surface-variant uppercase font-label-code-sm border-b border-outline-variant/20">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Email Address</th>
                    <th className="p-3">Registered At</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {pendingEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-surface-container-low/40 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-secondary-fixed/60 text-secondary font-bold text-xs flex items-center justify-center">
                            {emp.username ? emp.username[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-on-surface">@{emp.username}</p>
                            <p className="text-[10px] text-on-surface-variant font-mono">{emp.id.slice(0, 12)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-on-surface-variant">
                        {emp.email}
                      </td>
                      <td className="p-3 text-[11px] text-on-surface-variant font-mono">
                        {emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'Recent'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded font-label-edge text-[10px] bg-secondary-fixed text-on-secondary-fixed uppercase font-bold">
                          Pending Approval
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(emp.id, emp.username || emp.email)}
                            disabled={actionLoadingId === emp.id}
                            className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-[11px] shadow-sm hover:bg-surface-tint transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">check</span>
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleReject(emp.id, emp.username || emp.email)}
                            disabled={actionLoadingId === emp.id}
                            className="px-3 py-1.5 rounded-lg bg-error-container text-error font-semibold text-[11px] hover:bg-error hover:text-white transition-all flex items-center gap-1 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">close</span>
                            <span>Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 2: Approved Active Employees */}
        <div className="bg-surface-container-lowest p-space-xl rounded-xl border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between mb-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[20px] text-primary">verified</span>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Approved Company Members ({approvedEmployees.length})
              </h2>
            </div>
            <span className="text-[10px] font-label-code-sm bg-surface-container px-2 py-0.5 rounded text-on-surface-variant">
              Active Graph Traversal
            </span>
          </div>

          <div className="divide-y divide-outline-variant/20 border border-outline-variant/20 rounded-lg overflow-hidden">
            {approvedEmployees.length === 0 ? (
              <div className="p-6 text-center text-xs text-on-surface-variant">
                No approved employees found yet.
              </div>
            ) : (
              approvedEmployees.map((u) => (
                <div key={u.id} className="p-3 flex items-center justify-between bg-surface-container-low/30 hover:bg-surface-container-low transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
                      {u.username ? u.username[0].toUpperCase() : 'U'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-on-surface">
                        @{u.username} <span className="text-on-surface-variant font-normal">({u.email})</span>
                      </p>
                      <p className="text-[10px] text-on-surface-variant font-mono">
                        Role: {u.role} • Joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-label-edge bg-primary-fixed text-primary px-2 py-0.5 rounded font-bold uppercase">
                    Approved
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
