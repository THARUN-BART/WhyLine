'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ImpactAnalysisResult, ImpactedSystem } from '@/lib/api';
import { useUser } from '@/components/UserContext';

function ImpactAnalysisContent() {
  const searchParams = useSearchParams();
  const { currentUser } = useUser();
  const decisionId = searchParams.get('id') || 'dec_billing_v2';
  const systemParam = searchParams.get('system') || 'billing-api';

  const [selectedTarget, setSelectedTarget] = useState(decisionId);
  const [impactData, setImpactData] = useState<ImpactAnalysisResult | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<ImpactedSystem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [simulationDiff, setSimulationDiff] = useState<{ diff_added?: string[]; diff_removed?: string[] } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    async function loadImpact() {
      setIsLoading(true);
      try {
        const res = await api.impactOf(selectedTarget);
        if (res && res.impacted_systems) {
          setImpactData(res);
          setSelectedSystem(res.impacted_systems[0] || null);
        } else {
          // fallback
          const mock: ImpactAnalysisResult = {
            decision_id: 'dec_billing_v2',
            changed_system: 'billing-api',
            impacted_systems: [
              {
                system_id: 'sys_checkout',
                system_name: 'checkout-service',
                criticality: 8,
                hop_distance: 1,
                severity_score: 8,
              },
              {
                system_id: 'sys_order',
                system_name: 'order-service',
                criticality: 7,
                hop_distance: 1,
                severity_score: 7,
              },
              {
                system_id: 'sys_inventory',
                system_name: 'inventory-service',
                criticality: 7,
                hop_distance: 2,
                severity_score: 3.5,
              },
              {
                system_id: 'sys_analytics',
                system_name: 'analytics-pipeline',
                criticality: 5,
                hop_distance: 2,
                severity_score: 2.5,
              },
            ],
          };
          setImpactData(mock);
          setSelectedSystem(mock.impacted_systems[0]);
        }
      } catch {
        // fallback
      } finally {
        setIsLoading(false);
      }
    }
    loadImpact();
  }, [selectedTarget]);

  const handleSimulateReversal = async () => {
    setIsSimulating(true);
    try {
      const res = await api.simulateMemory(currentUser?.id || 'anonymous', {
        system_id: 'sys_billing',
        action: 'sever_dependency',
        new_dependency_id: 'sys_auth',
      });
      setSimulationDiff(res || { diff_added: [], diff_removed: ['DEPENDS_ON: billing-api -> ledger-service'] });
    } catch {
      setSimulationDiff({
        diff_added: ['PROPOSED: fallback-charge-circuit'],
        diff_removed: ['HARD_BREAK: checkout-service -> billing-api'],
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const impactedList = impactData?.impacted_systems || [];
  const maxCriticality = Math.max(...impactedList.map((s) => s.criticality), 8);
  const directBreaksCount = impactedList.filter((s) => s.hop_distance === 1).length;

  return (
    <main className="w-full bg-surface min-h-screen">
      <div className="max-w-[1600px] mx-auto p-space-xl flex flex-col gap-space-xl">
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-space-2xs">
            <div className="flex items-center gap-space-xs text-error font-label-edge uppercase tracking-wider font-bold">
              <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
              Blast Radius Simulation Engine
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              Change Impact Analysis
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Simulating the cascading architectural blast radius of reverting decisions or severing system dependencies across variable-length incoming <code className="font-label-code-sm bg-surface-container px-1 py-0.5 rounded text-primary">[:DEPENDS_ON*1..4]</code> edges.
            </p>
          </div>

          {/* Target Selector */}
          <div className="flex items-center gap-space-sm bg-surface-container-low p-space-xs rounded-xl border border-outline-variant/30">
            <span className="font-label-edge text-xs text-outline uppercase pl-2 font-bold">Target:</span>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="bg-surface-container-lowest text-xs font-label-code-sm font-semibold px-3 py-2 rounded-lg border border-outline-variant text-on-surface outline-none"
            >
              <option value="dec_billing_v2">dec_billing_v2 (Move billing off monolith)</option>
              <option value="dec_payments_gateway_split">dec_payments_gateway_split (Payments failover)</option>
              <option value="dec_jwt_auth_migration">dec_jwt_auth_migration (JWT Auth tokens)</option>
              <option value="dec_ledger_isolation">dec_ledger_isolation (Immutable Ledger)</option>
            </select>
            <button
              onClick={handleSimulateReversal}
              disabled={isSimulating}
              className="px-space-md py-2 rounded-lg bg-error text-on-error font-headline-sm text-xs font-bold hover:bg-error/90 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">reorder</span>
              <span>{isSimulating ? 'Simulating...' : 'Simulate Reversal'}</span>
            </button>
          </div>
        </div>

        {/* Realtime KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30">
            <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Impacted Services</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-xl text-3xl font-bold text-error">{impactedList.length} Services</span>
              <span className="text-xs font-label-edge text-error bg-error-container px-1.5 py-0.5 rounded uppercase font-bold">
                Cascading
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">{directBreaksCount} direct callers, {impactedList.length - directBreaksCount} transitive</p>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30">
            <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Max Severity Score</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-xl text-3xl font-bold text-error">{maxCriticality}.0 / 10</span>
              <span className="text-xs font-label-edge bg-error text-white px-1.5 py-0.5 rounded font-bold uppercase">
                Tier-0 P0
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">Weighted by (criticality / hop_distance)</p>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30">
            <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Max Hop Depth</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-xl text-3xl font-bold text-primary">2 Hops</span>
              <span className="text-xs font-label-edge bg-primary-fixed text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                Transitive
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">Propagates to order &amp; analytics pipelines</p>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30">
            <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Rollback Feasibility</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-xl text-3xl font-bold text-tertiary">High Risk</span>
              <span className="text-xs font-label-edge bg-tertiary-fixed text-on-tertiary-fixed px-1.5 py-0.5 rounded font-bold uppercase">
                Schema Drift
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">Requires dual-write proxy migration</p>
          </div>
        </div>

        {/* Delta Diff Box if Simulated */}
        {simulationDiff && (
          <div className="p-space-md rounded-xl bg-secondary-fixed/30 border border-secondary text-xs flex flex-col gap-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="font-bold text-secondary uppercase font-label-edge">
                Hypothetical Sandbox Topology Diff (Simulated in Memory)
              </span>
              <button
                onClick={() => setSimulationDiff(null)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                ✕ Clear
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-semibold text-error">Severed Edges (Diff Removed):</p>
                <ul className="list-disc pl-4 text-on-surface-variant">
                  {simulationDiff.diff_removed?.map((r, i) => (
                    <li key={i} className="font-label-code-sm">{r}</li>
                  )) || <li>No dependencies removed</li>}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-secondary">Added Dependencies (Diff Added):</p>
                <ul className="list-disc pl-4 text-on-surface-variant">
                  {simulationDiff.diff_added?.map((a, i) => (
                    <li key={i} className="font-label-code-sm">{a}</li>
                  )) || <li>None</li>}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Visual Graph & Inspector Split */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
          {/* Visual Topology Canvas (8 cols) */}
          <div className="xl:col-span-8 flex flex-col rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 overflow-hidden">
            <div className="p-space-md bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-primary text-[18px]">account_tree</span>
                <span className="font-headline-sm text-sm text-on-surface font-semibold">
                  Blast Radius Topology &amp; Dependency Cascade
                </span>
                <span className="px-space-xs py-0.5 rounded bg-error-container text-on-error-container font-label-edge text-[10px] font-bold uppercase">
                  Inbound Impact View
                </span>
              </div>
              <span className="font-label-code-sm text-xs text-outline">
                Click any service node to inspect contract breakage
              </span>
            </div>

            {/* Visual Canvas Area */}
            <div className="relative w-full h-[440px] bg-surface flex items-center justify-center p-space-md select-none overflow-hidden">
              <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <marker id="arrow-critical" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="8" refY="5" viewBox="0 0 10 10">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#ba1a1a" />
                  </marker>
                  <marker id="arrow-high" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="8" refY="5" viewBox="0 0 10 10">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#885500" />
                  </marker>
                </defs>

                {/* Connectors */}
                <path d="M 175 125 C 250 125, 270 215, 345 215" fill="none" markerEnd="url(#arrow-critical)" stroke="#ba1a1a" strokeDasharray="4 2" strokeWidth="2.5" />
                <path d="M 470 220 C 530 220, 560 220, 620 220" fill="none" markerEnd="url(#arrow-critical)" stroke="#ba1a1a" strokeWidth="3.5" />
                <path d="M 470 330 C 540 330, 560 235, 620 225" fill="none" markerEnd="url(#arrow-high)" stroke="#885500" strokeDasharray="3 3" strokeWidth="2" />
                <path d="M 680 90 L 680 185" fill="none" stroke="#3525cd" strokeDasharray="2 2" strokeWidth="2" />
              </svg>

              {/* Hop 2: checkout-service */}
              <div
                onClick={() =>
                  setSelectedSystem(
                    impactedList.find((s) => s.system_name === 'checkout-service') || {
                      system_id: 'sys_checkout',
                      system_name: 'checkout-service',
                      criticality: 8,
                      hop_distance: 1,
                      severity_score: 8,
                    }
                  )
                }
                className="absolute left-6 top-20 w-44 p-space-sm rounded-lg bg-surface-container-lowest shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5 cursor-pointer z-10 border border-outline-variant/30"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-edge text-[10px] px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-bold">
                    1 HOP DIRECT
                  </span>
                  <span className="font-label-code-sm text-[10px] text-outline">Tier 0</span>
                </div>
                <p className="font-headline-sm text-xs text-on-surface font-bold truncate">checkout-service</p>
                <div className="flex items-center justify-between mt-1 text-on-surface-variant font-label-code-sm text-[10px]">
                  <span>web-app</span>
                  <span className="text-error font-medium">Critical</span>
                </div>
              </div>

              {/* Direct: order-service */}
              <div
                onClick={() =>
                  setSelectedSystem(
                    impactedList.find((s) => s.system_name === 'order-service') || {
                      system_id: 'sys_order',
                      system_name: 'order-service',
                      criticality: 7,
                      hop_distance: 1,
                      severity_score: 7,
                    }
                  )
                }
                className="absolute left-72 top-40 w-48 p-space-sm rounded-lg bg-surface-container-lowest shadow-xl ring-2 ring-error hover:scale-105 transition-all cursor-pointer z-20 border border-outline-variant/30"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-edge text-[10px] px-1.5 py-0.5 rounded bg-error text-on-error font-bold uppercase tracking-wider">
                    1 HOP • DIRECT
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping"></span>
                </div>
                <p className="font-headline-sm text-xs text-on-surface font-bold truncate">order-service</p>
                <div className="flex items-center justify-between mt-1 text-on-surface-variant font-label-code-sm text-[10px]">
                  <span className="text-primary font-mono">gRPC Call</span>
                  <span className="px-1 rounded bg-error-container text-on-error-container font-bold">Hard Break</span>
                </div>
              </div>

              {/* Hop 2: inventory-service */}
              <div
                onClick={() =>
                  setSelectedSystem(
                    impactedList.find((s) => s.system_name === 'inventory-service') || {
                      system_id: 'sys_inventory',
                      system_name: 'inventory-service',
                      criticality: 7,
                      hop_distance: 2,
                      severity_score: 3.5,
                    }
                  )
                }
                className="absolute left-72 bottom-12 w-48 p-space-sm rounded-lg bg-surface-container-lowest shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5 cursor-pointer z-10 border border-outline-variant/30"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-edge text-[10px] px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant font-bold">
                    2 HOPS
                  </span>
                  <span className="font-label-code-sm text-[10px] text-outline">Tier 2</span>
                </div>
                <p className="font-headline-sm text-xs text-on-surface font-bold truncate">inventory-service</p>
                <div className="flex items-center justify-between mt-1 text-on-surface-variant font-label-code-sm text-[10px]">
                  <span>Kafka Consumer</span>
                  <span className="text-tertiary font-medium">Degrades</span>
                </div>
              </div>

              {/* Target Reversal Epicenter */}
              <div className="absolute right-72 top-4 w-60 p-space-sm rounded-lg bg-primary-container text-on-primary shadow-lg z-20 text-center">
                <span className="font-label-edge text-[9px] px-1.5 py-0.5 rounded bg-surface-container-lowest text-primary font-bold uppercase">
                  Reversal Epicenter
                </span>
                <p className="font-headline-sm text-xs text-on-primary mt-1 font-bold">
                  {selectedTarget}
                </p>
                <span className="font-label-code-sm text-[10px] text-on-primary-container">
                  Reversing triggers 4 breaking service contracts
                </span>
              </div>

              {/* Origin System: billing-api */}
              <div className="absolute right-64 top-40 w-48 p-space-sm rounded-lg bg-surface-container-highest shadow-md z-10 border border-outline-variant/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-edge text-[10px] px-1.5 py-0.5 rounded bg-primary text-on-primary font-bold">
                    ORIGIN NODE
                  </span>
                  <span className="material-symbols-outlined text-[16px] text-primary">change_circle</span>
                </div>
                <p className="font-headline-sm text-xs text-on-surface font-bold truncate">billing-api</p>
                <div className="flex items-center justify-between mt-1 text-on-surface-variant font-label-code-sm text-[10px]">
                  <span>v2.12.0</span>
                  <span className="text-error font-medium">Target Rollback</span>
                </div>
              </div>

              {/* Upstream: ledger-service */}
              <div className="absolute right-4 top-40 w-40 p-space-sm rounded-lg bg-surface-container-lowest opacity-70 shadow-sm cursor-pointer z-10 border border-outline-variant/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-label-edge text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-outline font-bold">
                    UPSTREAM
                  </span>
                  <span className="material-symbols-outlined text-[14px] text-secondary">check</span>
                </div>
                <p className="font-headline-sm text-xs text-on-surface truncate">ledger-service</p>
                <div className="flex items-center justify-between mt-1 text-on-surface-variant font-label-code-sm text-[10px]">
                  <span>Append Store</span>
                </div>
              </div>
            </div>
          </div>

          {/* Inspector Panel (4 cols) */}
          <div className="xl:col-span-4 flex flex-col gap-space-lg">
            <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-space-xs">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-error text-[18px]">emergency_home</span>
                  <h3 className="font-headline-md text-sm text-on-surface font-bold">Impact Inspector</h3>
                </div>
                <span className="font-label-edge text-[10px] uppercase bg-error text-white px-2 py-0.5 rounded font-bold">
                  {selectedSystem?.hop_distance === 1 ? 'Hard Break (Direct)' : 'Degradation (Transitive)'}
                </span>
              </div>

              {selectedSystem ? (
                <div className="flex flex-col gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20">
                    <p className="font-headline-sm text-sm text-on-surface font-bold">
                      {selectedSystem.system_name}
                    </p>
                    <p className="font-label-code-sm text-[11px] text-outline">{selectedSystem.system_id}</p>
                    <p className="text-on-surface-variant mt-2 leading-relaxed">
                      Direct upstream synchronous consumer. If {impactData?.changed_system || 'billing-api'} is reverted to legacy monolith, this service experiences complete request drop.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-1 border-b border-outline-variant/10">
                      <span className="text-on-surface-variant">System Criticality:</span>
                      <span className="font-label-code-sm font-bold text-error">{selectedSystem.criticality} / 10</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-outline-variant/10">
                      <span className="text-on-surface-variant">Hop Distance:</span>
                      <span className="font-label-code-sm font-bold text-primary">{selectedSystem.hop_distance} hop(s)</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-outline-variant/10">
                      <span className="text-on-surface-variant">Severity Score:</span>
                      <span className="font-label-code-sm font-bold text-error">{selectedSystem.severity_score}</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-on-surface-variant">Failure Mode:</span>
                      <span className="font-semibold text-error">gRPC Deadlock / Timeout</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-error-container/20 border border-error/30">
                    <p className="font-bold text-error text-xs mb-1">Recommended Mitigation:</p>
                    <p className="text-on-surface-variant text-[11px] leading-relaxed">
                      Deploy backwards-compatible shim adapter or activate shadow canary routing prior to executing any rollback operation.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-outline">Select a node to inspect</div>
              )}
            </div>
          </div>
        </div>

        {/* Ranked Affected Systems Breakdown Table */}
        <section className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-space-xs">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Ranked Affected Systems Breakdown
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Ordered by calculated severity score = (criticality / hop_distance)
              </p>
            </div>
            <span className="font-label-code-sm text-xs bg-surface-container px-2 py-1 rounded text-primary font-bold">
              FalkorDB Traversal Result
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low text-on-surface-variant uppercase font-label-code-sm border-b border-outline-variant/20">
                <tr>
                  <th className="p-3">Rank</th>
                  <th className="p-3">System Name</th>
                  <th className="p-3">Hop Distance</th>
                  <th className="p-3">Criticality</th>
                  <th className="p-3">Severity Score</th>
                  <th className="p-3">Risk Level</th>
                  <th className="p-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {impactedList.map((sys, idx) => (
                  <tr
                    key={sys.system_id}
                    onClick={() => setSelectedSystem(sys)}
                    className="hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    <td className="p-3 font-label-code-sm font-bold text-outline">#{idx + 1}</td>
                    <td className="p-3 font-headline-sm text-on-surface font-semibold">
                      {sys.system_name}
                      <span className="block text-[10px] text-outline font-label-code-sm">{sys.system_id}</span>
                    </td>
                    <td className="p-3 font-label-code-sm">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          sys.hop_distance === 1
                            ? 'bg-error-container text-on-error-container'
                            : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {sys.hop_distance} HOP {sys.hop_distance === 1 ? '(DIRECT)' : '(TRANSITIVE)'}
                      </span>
                    </td>
                    <td className="p-3 font-label-code-sm font-bold text-on-surface">{sys.criticality} / 10</td>
                    <td className="p-3 font-label-code-sm font-bold text-error">{sys.severity_score}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded font-label-edge font-bold uppercase text-[10px] ${
                          sys.severity_score >= 7
                            ? 'bg-error text-white'
                            : sys.severity_score >= 4
                            ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                            : 'bg-surface-container text-outline'
                        }`}
                      >
                        {sys.severity_score >= 7 ? 'CRITICAL RISK' : sys.severity_score >= 4 ? 'MODERATE RISK' : 'LOW RISK'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button className="text-primary hover:underline font-semibold">Inspect →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ImpactAnalysisPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-primary">Loading Impact Analysis...</div>}>
      <ImpactAnalysisContent />
    </Suspense>
  );
}
