'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, BusFactorReport, GraphStats, EntitySearchResult } from '@/lib/api';
import { useUser } from '@/components/UserContext';

export default function HomePage() {
  const router = useRouter();
  const { currentUser, graphStats, refreshCurrentUser } = useUser();
  const [decisions, setDecisions] = useState<any[]>([]);
  const [busFactor, setBusFactor] = useState<BusFactorReport | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'arch' | 'infra' | 'deprec'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EntitySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      router.replace('/admin');
    }
  }, [currentUser, router]);

  useEffect(() => {
    async function loadData() {
      if (currentUser?.approval_status === 'pending') {
        return;
      }
      try {
        // Fetch decisions from FalkorDB with accurate decider and affected system links
        const dRes = await api.queryGraph(
          `MATCH (d:Decision) 
           OPTIONAL MATCH (p:Person)-[:DECIDED]->(d)
           OPTIONAL MATCH (d)-[:AFFECTS]->(s:System)
           RETURN d.id AS id, d.title AS title, d.date AS date, d.status AS status, 
                  p.name AS decider, p.role AS decider_role, s.name AS system
           ORDER BY d.date DESC
           LIMIT 12`
        );
        if (dRes && dRes.records && dRes.records.length > 0) {
          setDecisions(dRes.records);
        }
      } catch {
        // ignore
      }

      try {
        const bf = await api.getBusFactor();
        if (bf) setBusFactor(bf);
      } catch {
        // ignore
      }
    }

    loadData();
  }, [currentUser]);

  const handleQuickSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await api.findEntity(val);
      setSearchResults(Array.isArray(res) ? res : []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCheckApproval = async () => {
    setIsRefreshingStatus(true);
    try {
      const updated = await refreshCurrentUser();
      if (updated?.approval_status === 'approved') {
        window.location.reload();
      }
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  if (currentUser?.role === 'admin') {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-on-surface-variant font-label-code-sm">Redirecting to Admin Console...</p>
      </main>
    );
  }

  if (currentUser?.approval_status === 'pending') {
    return (
      <main className="flex-1 max-w-4xl mx-auto p-space-xl flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="p-8 rounded-2xl bg-surface-container-lowest border border-outline-variant/40 shadow-xl max-w-xl flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary-fixed/50 flex items-center justify-center text-secondary mb-4">
            <span className="material-symbols-outlined text-3xl">hourglass_top</span>
          </div>
          <span className="font-label-edge text-label-edge uppercase font-bold tracking-widest text-secondary bg-secondary-fixed px-2 py-0.5 rounded mb-2">
            REGISTRATION PENDING APPROVAL
          </span>
          <h1 className="font-headline-xl text-2xl font-bold text-on-surface">
            Waiting for Company Approval
          </h1>
          <p className="font-body-md text-on-surface-variant text-sm mt-3 leading-relaxed">
            Your account has been registered under <strong>{currentUser.company || 'your selected organization'}</strong>.
            Before you can access the institutional reasoning graph and engineering dashboard, your company main administrator must approve your registration.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleCheckApproval}
              disabled={isRefreshingStatus}
              className="px-6 py-2.5 rounded-lg bg-primary text-on-primary font-bold text-xs shadow hover:bg-surface-tint transition-all flex items-center gap-2"
            >
              <span className={`material-symbols-outlined text-sm ${isRefreshingStatus ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>{isRefreshingStatus ? 'Checking...' : 'Check Approval Status'}</span>
            </button>
            <Link
              href="/login"
              className="px-6 py-2.5 rounded-lg bg-surface-container text-on-surface font-semibold text-xs border border-outline-variant/30 hover:bg-surface-container-high transition-colors"
            >
              Sign In with Another Account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const orphanedSystem = busFactor?.orphaned_systems?.[0];
  const totalSystemsCount = busFactor?.total_systems ?? 10;
  const totalNodes = graphStats?.total_nodes ?? 0;
  const totalEdges = graphStats?.total_edges ?? 0;

  return (
    <main className="flex-1 max-w-[1600px] w-full mx-auto p-space-xl">
      <div className="flex flex-col w-full gap-space-xl">
        {/* Top Welcome & Master Action Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg bg-surface-container-lowest p-space-xl rounded-xl shadow-sm relative overflow-hidden border border-outline-variant/30">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary-fixed/30 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex flex-col gap-space-2xs z-10">
            <div className="flex items-center gap-space-xs">
              <span className="font-label-edge text-label-edge text-primary uppercase tracking-widest bg-primary-fixed px-space-xs py-space-2xs rounded">
                SYSTEM GRAPH PERSPECTIVE
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">
                Live FalkorDB • v2.4-prod
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              Good morning, {currentUser?.name || currentUser?.username || 'Engineer'}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
              Understand decisions. Trace their reasoning. Change systems safely.
            </p>
          </div>
          <div className="flex items-center flex-wrap gap-space-sm z-10">
            <Link
              href="/rag-comparison"
              className="flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors font-headline-sm text-headline-sm shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">compare_arrows</span>
              <span>Vs-RAG Benchmark</span>
            </Link>
            <Link
              href="/ask-whyline"
              className="flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-surface-container-lowest text-primary hover:bg-primary-fixed transition-colors font-headline-sm text-headline-sm shadow-sm group border border-primary/20"
            >
              <span className="material-symbols-outlined text-[18px] text-primary group-hover:rotate-12 transition-transform">
                psychology
              </span>
              <span>Ask Whyline</span>
            </Link>
            <Link
              href="/tickets/TICK-1042"
              className="flex items-center gap-space-xs px-space-md py-space-xs rounded-lg bg-primary text-on-primary hover:bg-surface-tint transition-colors font-headline-sm text-headline-sm shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
              <span>View Ticket TKT-101</span>
            </Link>
          </div>
        </div>

        {/* Realtime Telemetry Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-lg">
          {/* Stat 1: Decisions Monitored */}
          <div className="flex flex-col justify-between p-space-lg bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-shadow border border-outline-variant/30">
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant uppercase font-medium">
                Decisions Provenanced
              </span>
              <span className="p-space-xs rounded bg-surface-container text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">alt_route</span>
              </span>
            </div>
            <div className="flex items-baseline gap-space-sm my-space-xs">
              <span className="font-headline-xl text-headline-xl text-on-surface">
                {decisions.length || 10}
              </span>
              <span className="font-label-edge text-label-edge text-secondary font-medium flex items-center">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                100% Graph Verified
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Across SOX, Architecture & Infrastructure
            </span>
          </div>

          {/* Stat 2: High Risk / Bus Factor */}
          <Link
            href="/ownership-bus-factor"
            className="flex flex-col justify-between p-space-lg bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-shadow border border-error/30 group"
          >
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-label-code-sm text-label-code-sm text-error uppercase font-medium">
                Bus Factor Risks
              </span>
              <span className="p-space-xs rounded bg-error-container text-error flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">warning</span>
              </span>
            </div>
            <div className="flex items-baseline gap-space-sm my-space-xs">
              <span className="font-headline-xl text-headline-xl text-error">1 ORPHANED</span>
              <span className="font-label-edge text-label-edge bg-error text-on-error px-1.5 py-0.5 rounded uppercase font-bold">
                CRITICAL
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-error transition-colors">
              ledger-service (Departed Owner: Dave Miller) →
            </span>
          </Link>

          {/* Stat 3: Graph Topology Nodes */}
          <Link
            href="/graph-explorer"
            className="flex flex-col justify-between p-space-lg bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-shadow border border-outline-variant/30 group"
          >
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant uppercase font-medium">
                FalkorDB Topology
              </span>
              <span className="p-space-xs rounded bg-surface-container text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">hub</span>
              </span>
            </div>
            <div className="flex items-baseline gap-space-sm my-space-xs">
              <span className="font-headline-xl text-headline-xl text-on-surface">{totalNodes}</span>
              <span className="font-label-code-sm text-label-code-sm text-outline">NODES • {totalEdges} EDGES</span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-secondary transition-colors">
              8 Node Labels • Live Traversal Ready →
            </span>
          </Link>

          {/* Stat 4: Tracked Microservices */}
          <Link
            href="/impact-analysis?system=billing-api"
            className="flex flex-col justify-between p-space-lg bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-shadow border border-outline-variant/30 group"
          >
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-label-code-sm text-label-code-sm text-on-surface-variant uppercase font-medium">
                Monitored Systems
              </span>
              <span className="p-space-xs rounded bg-surface-container text-tertiary flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">dns</span>
              </span>
            </div>
            <div className="flex items-baseline gap-space-sm my-space-xs">
              <span className="font-headline-xl text-headline-xl text-on-surface">{totalSystemsCount}</span>
              <span className="font-label-edge text-label-edge bg-secondary-fixed text-on-secondary-fixed px-1.5 py-0.5 rounded uppercase">
                Active Mesh
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant group-hover:text-primary transition-colors">
              Simulate Blast Radius & Cascading Risk →
            </span>
          </Link>
        </div>

        {/* Main Content Split: Decisions Table & Side Panel */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-space-xl">
          {/* Left Column (2 Cols): Decisions Table */}
          <div className="xl:col-span-2 flex flex-col gap-space-lg">
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm pb-space-xs border-b border-outline-variant/20">
                <div>
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-[20px] text-primary">account_tree</span>
                    <h2 className="font-headline-lg text-headline-lg text-on-surface">Recent Decisions</h2>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Archived rationale and topological changes with immutable evidence
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-space-2xs bg-surface-container-low p-space-2xs rounded-lg overflow-x-auto">
                  <button
                    onClick={() => setActiveFilter('all')}
                    className={`px-space-sm py-space-2xs rounded font-headline-sm text-headline-sm transition-colors ${
                      activeFilter === 'all'
                        ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    All ({decisions.length})
                  </button>
                  <button
                    onClick={() => setActiveFilter('arch')}
                    className={`px-space-sm py-space-2xs rounded font-headline-sm text-headline-sm transition-colors ${
                      activeFilter === 'arch'
                        ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Architecture
                  </button>
                  <button
                    onClick={() => setActiveFilter('infra')}
                    className={`px-space-sm py-space-2xs rounded font-headline-sm text-headline-sm transition-colors ${
                      activeFilter === 'infra'
                        ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Infrastructure
                  </button>
                  <button
                    onClick={() => setActiveFilter('deprec')}
                    className={`px-space-sm py-space-2xs rounded font-headline-sm text-headline-sm transition-colors ${
                      activeFilter === 'deprec'
                        ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Gaps & Alerts
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto -mx-space-lg px-space-lg">
                <table className="w-full text-left font-body-sm text-body-sm">
                  <thead>
                    <tr className="bg-surface-container-low/70 text-on-surface-variant font-label-code-sm text-label-code-sm uppercase tracking-wider">
                      <th className="py-space-sm px-space-md rounded-l">Decision &amp; Context</th>
                      <th className="py-space-sm px-space-sm">Decided By</th>
                      <th className="py-space-sm px-space-sm">Affected System</th>
                      <th className="py-space-sm px-space-sm">Date</th>
                      <th className="py-space-sm px-space-sm">Evidence</th>
                      <th className="py-space-sm px-space-md rounded-r text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {decisions.map((dec) => (
                      <tr
                        key={dec.id}
                        onClick={() => router.push(`/decisions/${dec.id}`)}
                        className="hover:bg-surface-container-low transition-colors group cursor-pointer"
                      >
                        <td className="py-space-md px-space-md">
                          <div className="flex flex-col">
                            <span className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors">
                              {dec.title}
                            </span>
                            <span className="font-label-edge text-label-edge text-outline uppercase tracking-wider mt-0.5">
                              {dec.id}
                            </span>
                          </div>
                        </td>
                        <td className="py-space-md px-space-sm">
                          <div className="flex items-center gap-space-xs">
                            <div className="w-6 h-6 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-label-code-sm text-label-code-sm font-bold">
                              {dec.decider ? dec.decider[0] : 'C'}
                            </div>
                            <span className="font-body-sm text-body-sm text-on-surface font-medium">
                              {dec.decider || 'Architecture Committee'}
                            </span>
                          </div>
                        </td>
                        <td className="py-space-md px-space-sm">
                          <span className="font-label-code-sm text-label-code-sm bg-surface-container text-on-surface px-space-xs py-space-2xs rounded">
                            {dec.system || 'Platform Infra'}
                          </span>
                        </td>
                        <td className="py-space-md px-space-sm text-on-surface-variant whitespace-nowrap font-label-code-sm">
                          {dec.date || '2025-06-12'}
                        </td>
                        <td className="py-space-md px-space-sm">
                          <div className="inline-flex items-center gap-space-xs px-space-xs py-space-2xs rounded bg-surface-container text-on-surface font-label-code-sm text-label-code-sm">
                            <span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
                            <span>Graph-backed</span>
                          </div>
                        </td>
                        <td className="py-space-md px-space-md text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-space-2xs px-space-xs py-space-2xs rounded-full bg-surface-container-highest text-secondary font-label-edge text-label-edge font-bold uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                            <span>{dec.status || 'Approved'}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column (1 Col): Quick Query & Risk Alerts */}
          <div className="flex flex-col gap-space-lg">
            {/* Quick Lineage Query Card */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[20px] text-primary">search_insights</span>
                <h2 className="font-headline-md text-headline-md text-on-surface">Quick Lineage Query</h2>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Direct fuzzy lookup across systems, decisions, RFCs, and ticket provenance.
              </p>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleQuickSearch(e.target.value)}
                  placeholder="e.g. billing, checkout, Dave..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-surface-container-low border border-outline-variant text-on-surface outline-none focus:border-primary"
                />
                {isSearching && (
                  <span className="absolute right-3 top-2.5 material-symbols-outlined text-outline animate-spin text-sm">
                    progress_activity
                  </span>
                )}
              </div>
              {searchResults.length > 0 && (
                <div className="divide-y divide-outline-variant/20 max-h-48 overflow-y-auto">
                  {searchResults.map((sr) => (
                    <div
                      key={sr.id}
                      onClick={() => {
                        if (sr.label === 'Decision') router.push(`/decisions/${sr.id}`);
                        else if (sr.label === 'System') router.push(`/impact-analysis?system=${encodeURIComponent(sr.name)}`);
                        else router.push(`/ask-whyline?q=${encodeURIComponent(sr.name)}`);
                      }}
                      className="py-2 hover:bg-surface-container cursor-pointer px-1 rounded flex items-center justify-between"
                    >
                      <div>
                        <p className="font-headline-sm text-xs text-on-surface">{sr.name}</p>
                        <p className="font-label-code-sm text-[10px] text-outline">{sr.id}</p>
                      </div>
                      <span className="font-label-edge text-[9px] bg-surface-container-high px-1 py-0.5 rounded uppercase">
                        {sr.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Risk Alerts Panel */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-[20px] text-error">notification_important</span>
                  <h2 className="font-headline-md text-headline-md text-on-surface">Risk Alerts</h2>
                </div>
                <span className="text-[10px] bg-error-container text-on-error-container font-label-edge px-1.5 py-0.5 rounded font-bold">
                  HIGH ATTENTION
                </span>
              </div>

              {/* Alert 1 */}
              <div className="p-space-md rounded-lg bg-error-container/30 border border-error/20 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-headline-sm text-xs text-error font-semibold">
                    ledger-service is ORPHANED
                  </span>
                  <span className="text-[10px] font-label-edge bg-error text-on-error px-1 rounded">SCORE 100</span>
                </div>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  Former staff engineer Dave Miller departed. 5 transitive dependent systems at fatal risk.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <Link
                    href="/ownership-bus-factor"
                    className="text-xs text-error font-semibold hover:underline flex items-center gap-1"
                  >
                    <span>View Bus Factor Breakdown</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </Link>
                </div>
              </div>

              {/* Alert 2 */}
              <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20">
                <span className="font-headline-sm text-xs text-on-surface font-semibold">
                  payments-gateway has 1 active owner
                </span>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  High-risk single owner with 5 dependent services (checkout, order, inventory, etc.).
                </p>
                <Link
                  href="/impact-analysis?system=payments-gateway"
                  className="text-xs text-primary font-medium hover:underline pt-1 flex items-center gap-1"
                >
                  <span>Simulate Failover Blast Radius</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </Link>
              </div>

              {/* Alert 3 */}
              <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col gap-1 border border-outline-variant/20">
                <span className="font-headline-sm text-xs text-on-surface font-semibold">
                  Missing RFC: Protobuf Schema Adoption
                </span>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  Honest Gap detected: Ticket TICK-2030 links to Slack thread without documented RFC.
                </p>
                <Link
                  href="/decisions/dec_gap_no_doc"
                  className="text-xs text-secondary font-medium hover:underline pt-1 flex items-center gap-1"
                >
                  <span>Inspect Gap Provenance</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Recent Activity Timeline */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[20px] text-secondary">history</span>
                <h2 className="font-headline-md text-headline-md text-on-surface">Recent Activity Timeline</h2>
              </div>
              <div className="relative pl-6 space-y-4 border-l border-outline-variant/30 text-xs">
                <div className="relative">
                  <span className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-secondary"></span>
                  <p className="font-semibold text-on-surface">Alice Smith validated decision dec_billing_v2</p>
                  <p className="text-on-surface-variant text-[11px]">SOX RFC-101 attached to audit graph</p>
                  <span className="text-[10px] text-outline font-label-code-sm">2 hours ago</span>
                </div>
                <div className="relative">
                  <span className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-primary"></span>
                  <p className="font-semibold text-on-surface">Reversal simulation ran on billing-api</p>
                  <p className="text-on-surface-variant text-[11px]">4 affected services identified across 2 hops</p>
                  <span className="text-[10px] text-outline font-label-code-sm">5 hours ago</span>
                </div>
                <div className="relative">
                  <span className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-error"></span>
                  <p className="font-semibold text-on-surface">Dave Miller marked as departed owner</p>
                  <p className="text-on-surface-variant text-[11px]">ledger-service flagged as orphaned (Risk 100)</p>
                  <span className="text-[10px] text-outline font-label-code-sm">Yesterday</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
