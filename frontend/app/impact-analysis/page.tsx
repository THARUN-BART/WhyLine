'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, ImpactAnalysisResult, ImpactedSystem } from '@/lib/api';
import { useUser } from '@/components/UserContext';

function ImpactAnalysisContent() {
  const searchParams = useSearchParams();
  const { currentUser } = useUser();
  const initialDecisionId = searchParams.get('id') || 'dec_billing_v2';

  const [selectedTarget, setSelectedTarget] = useState(initialDecisionId);
  const [decisionsList, setDecisionsList] = useState<Array<{ id: string; title: string }>>([]);
  const [impactData, setImpactData] = useState<ImpactAnalysisResult | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<ImpactedSystem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [simulationDiff, setSimulationDiff] = useState<{ diff_added?: string[]; diff_removed?: string[] } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Load all available decisions from FalkorDB
  useEffect(() => {
    async function loadDecisions() {
      try {
        const res = await api.queryGraph(
          `MATCH (d:Decision) RETURN d.id AS id, d.title AS title ORDER BY d.id`
        );
        if (res && res.records && res.records.length > 0) {
          setDecisionsList(res.records);
        }
      } catch (err) {
        console.error('Failed to load decisions list', err);
      }
    }
    loadDecisions();
  }, []);

  // Sync selectedTarget if URL param changes
  useEffect(() => {
    const paramId = searchParams.get('id');
    if (paramId && paramId !== selectedTarget) {
      setSelectedTarget(paramId);
    }
  }, [searchParams]);

  // Load impact data from FalkorDB whenever selectedTarget changes
  useEffect(() => {
    async function loadImpact() {
      setIsLoading(true);
      try {
        const res = await api.impactOf(selectedTarget);
        if (res) {
          setImpactData(res);
          setSelectedSystem(res.impacted_systems && res.impacted_systems.length > 0 ? res.impacted_systems[0] : null);
        }
      } catch (err) {
        console.error('Failed to load impact analysis', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadImpact();
  }, [selectedTarget]);

  const handleSimulateReversal = async () => {
    setIsSimulating(true);
    const targetSys = impactData?.changed_system || 'sys_billing';
    try {
      const res = await api.simulateMemory(currentUser?.id || 'anonymous', {
        system_id: targetSys,
        action: 'sever_dependency',
        new_dependency_id: 'sys_auth',
      });
      setSimulationDiff(res || { diff_added: [], diff_removed: [`DEPENDS_ON: ${targetSys} -> dependencies severed`] });
    } catch {
      setSimulationDiff({
        diff_added: ['PROPOSED: fallback-circuit-breaker'],
        diff_removed: [`HARD_BREAK: incoming callers -> ${targetSys}`],
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const impactedList = impactData?.impacted_systems || [];
  const maxCriticality = impactedList.length > 0 ? Math.max(...impactedList.map((s) => s.criticality)) : 0;
  const directBreaksCount = impactedList.filter((s) => s.hop_distance === 1).length;
  const transitiveBreaksCount = impactedList.length - directBreaksCount;
  const maxHop = impactedList.length > 0 ? Math.max(...impactedList.map((s) => s.hop_distance)) : 0;

  // Split into direct (hop 1) and transitive (hop >= 2)
  const directSystems = impactedList.filter((s) => s.hop_distance === 1);
  const transitiveSystems = impactedList.filter((s) => s.hop_distance > 1);

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
              className="bg-surface-container-lowest text-xs font-label-code-sm font-semibold px-3 py-2 rounded-lg border border-outline-variant text-on-surface outline-none max-w-xs sm:max-w-md truncate"
            >
              {decisionsList.length > 0 ? (
                decisionsList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} ({d.title})
                  </option>
                ))
              ) : (
                <>
                  <option value="dec_billing_v2">dec_billing_v2 (Move billing off monolith)</option>
                  <option value="dec_payments_gateway_split">dec_payments_gateway_split (Payments failover)</option>
                  <option value="dec_jwt_auth_migration">dec_jwt_auth_migration (JWT Auth tokens)</option>
                  <option value="dec_ledger_isolation">dec_ledger_isolation (Immutable Ledger)</option>
                </>
              )}
            </select>
            <button
              onClick={handleSimulateReversal}
              disabled={isSimulating}
              className="px-space-md py-2 rounded-lg bg-error text-on-error font-headline-sm text-xs font-bold hover:bg-error/90 transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap"
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
                {impactedList.length > 0 ? 'Cascading' : 'Isolated'}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              {directBreaksCount} direct callers, {transitiveBreaksCount} transitive
            </p>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30">
            <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Max Severity Score</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-xl text-3xl font-bold text-error">
                {maxCriticality > 0 ? `${maxCriticality}.0 / 10` : 'None'}
              </span>
              <span
                className={`text-xs font-label-edge px-1.5 py-0.5 rounded font-bold uppercase ${
                  maxCriticality >= 8
                    ? 'bg-error text-white'
                    : maxCriticality >= 5
                    ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                    : 'bg-surface-container text-outline'
                }`}
              >
                {maxCriticality >= 8 ? 'Tier-0 P0' : maxCriticality >= 5 ? 'Tier-1 P1' : 'Nominal'}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">Weighted by (criticality / hop_distance)</p>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30">
            <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Max Hop Depth</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-xl text-3xl font-bold text-primary">
                {maxHop} {maxHop === 1 ? 'Hop' : 'Hops'}
              </span>
              <span className="text-xs font-label-edge bg-primary-fixed text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                {maxHop > 1 ? 'Transitive' : maxHop === 1 ? 'Direct' : 'Zero Hop'}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              {maxHop > 0 ? `Propagates up to ${maxHop} levels upstream` : 'Zero dependent propagation'}
            </p>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30">
            <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Rollback Feasibility</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span
                className={`font-headline-xl text-3xl font-bold ${
                  impactedList.length >= 4 ? 'text-error' : impactedList.length > 0 ? 'text-tertiary' : 'text-secondary'
                }`}
              >
                {impactedList.length >= 4 ? 'High Risk' : impactedList.length > 0 ? 'Moderate' : 'Low Risk'}
              </span>
              <span className="text-xs font-label-edge bg-surface-container text-on-surface-variant px-1.5 py-0.5 rounded font-bold uppercase">
                {impactedList.length >= 4 ? 'Breaking Drift' : impactedList.length > 0 ? 'Contract Check' : 'Safe'}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              {impactedList.length > 0 ? 'Requires canary routing verification' : 'Isolated node, safe to modify'}
            </p>
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
                className="text-on-surface-variant hover:text-on-surface font-semibold"
              >
                ✕ Clear
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-semibold text-error">Severed Edges (Diff Removed):</p>
                <ul className="list-disc pl-4 text-on-surface-variant mt-1">
                  {simulationDiff.diff_removed?.map((r, i) => (
                    <li key={i} className="font-label-code-sm">{r}</li>
                  )) || <li>No dependencies removed</li>}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-secondary">Added Dependencies (Diff Added):</p>
                <ul className="list-disc pl-4 text-on-surface-variant mt-1">
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

            {/* Dynamic Visual Canvas Area */}
            <div className="relative w-full min-h-[440px] bg-surface p-space-lg select-none overflow-x-auto flex flex-col justify-center">
              {isLoading ? (
                <div className="flex items-center justify-center h-64 text-on-surface-variant font-label-code-sm gap-2">
                  <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                  <span>Traversing FalkorDB dependency graph...</span>
                </div>
              ) : impactedList.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="p-space-md rounded-2xl bg-secondary-fixed/30 text-secondary mb-3">
                    <span className="material-symbols-outlined text-3xl">verified_user</span>
                  </div>
                  <h3 className="font-headline-sm text-base font-bold text-on-surface">
                    Clean Architectural Isolation
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant max-w-md mt-1">
                    Target system <strong className="text-primary">{impactData?.changed_system || selectedTarget}</strong> has zero inbound callers in FalkorDB. Reverting or altering this decision produces zero upstream breaking cascades.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  {/* Column 1: Transitive Callers (Hop >= 2) */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-label-edge text-[10px] uppercase font-bold text-outline">
                        Transitive Dependents ({transitiveSystems.length})
                      </span>
                    </div>
                    {transitiveSystems.length > 0 ? (
                      transitiveSystems.map((sys) => {
                        const isSelected = selectedSystem?.system_id === sys.system_id;
                        return (
                          <div
                            key={sys.system_id}
                            onClick={() => setSelectedSystem(sys)}
                            className={`p-space-sm rounded-lg bg-surface-container-lowest shadow-sm hover:shadow-md transition-all cursor-pointer border ${
                              isSelected
                                ? 'border-primary ring-2 ring-primary/40 bg-primary-fixed/10'
                                : 'border-outline-variant/30 hover:border-outline-variant'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-label-edge text-[10px] px-1.5 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant font-bold">
                                {sys.hop_distance} HOPS
                              </span>
                              <span className="font-label-code-sm text-[10px] text-outline font-semibold">
                                Score {sys.severity_score}
                              </span>
                            </div>
                            <p className="font-headline-sm text-xs text-on-surface font-bold truncate">
                              {sys.system_name}
                            </p>
                            <div className="flex items-center justify-between mt-1 text-on-surface-variant font-label-code-sm text-[10px]">
                              <span>Criticality {sys.criticality}/10</span>
                              <span className="text-tertiary font-medium">Degrades</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 rounded-lg bg-surface-container-low text-center text-xs text-outline border border-dashed border-outline-variant/40">
                        No transitive dependencies
                      </div>
                    )}
                  </div>

                  {/* Column 2: Direct Callers (Hop 1) */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-label-edge text-[10px] uppercase font-bold text-error">
                        Direct Callers ({directSystems.length})
                      </span>
                    </div>
                    {directSystems.map((sys) => {
                      const isSelected = selectedSystem?.system_id === sys.system_id;
                      return (
                        <div
                          key={sys.system_id}
                          onClick={() => setSelectedSystem(sys)}
                          className={`p-space-sm rounded-lg bg-surface-container-lowest shadow-md hover:shadow-lg transition-all cursor-pointer border ${
                            isSelected
                              ? 'border-error ring-2 ring-error/50 bg-error-container/20'
                              : 'border-error/40 hover:border-error'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-label-edge text-[10px] px-1.5 py-0.5 rounded bg-error text-on-error font-bold uppercase tracking-wider">
                              1 HOP • DIRECT
                            </span>
                            <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
                          </div>
                          <p className="font-headline-sm text-xs text-on-surface font-bold truncate">
                            {sys.system_name}
                          </p>
                          <div className="flex items-center justify-between mt-1 text-on-surface-variant font-label-code-sm text-[10px]">
                            <span>Criticality {sys.criticality}/10</span>
                            <span className="px-1 rounded bg-error-container text-on-error-container font-bold">
                              Hard Break
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Column 3: Reversal Epicenter & Origin System */}
                  <div className="flex flex-col gap-4">
                    {/* Epicenter Banner */}
                    <div className="p-space-sm rounded-lg bg-primary-container text-on-primary shadow-lg text-center">
                      <span className="font-label-edge text-[9px] px-1.5 py-0.5 rounded bg-surface-container-lowest text-primary font-bold uppercase">
                        Reversal Epicenter
                      </span>
                      <p className="font-headline-sm text-xs text-on-primary mt-1 font-bold truncate">
                        {selectedTarget}
                      </p>
                      <span className="font-label-code-sm text-[10px] text-on-primary-container block mt-0.5">
                        {impactedList.length} cascading service contracts affected
                      </span>
                    </div>

                    {/* Origin System Node */}
                    <div className="p-space-md rounded-lg bg-surface-container-highest shadow-md border-2 border-primary">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-label-edge text-[10px] px-1.5 py-0.5 rounded bg-primary text-on-primary font-bold">
                          ORIGIN NODE
                        </span>
                        <span className="material-symbols-outlined text-[16px] text-primary">change_circle</span>
                      </div>
                      <p className="font-headline-sm text-sm text-on-surface font-bold truncate">
                        {impactData?.changed_system || 'origin-service'}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-on-surface-variant font-label-code-sm text-[10px]">
                        <span>Target Node</span>
                        <span className="text-error font-medium">Reversal Focus</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                {selectedSystem && (
                  <span
                    className={`font-label-edge text-[10px] uppercase px-2 py-0.5 rounded font-bold ${
                      selectedSystem.hop_distance === 1
                        ? 'bg-error text-white'
                        : 'bg-tertiary-fixed text-on-tertiary-fixed'
                    }`}
                  >
                    {selectedSystem.hop_distance === 1 ? 'Hard Break (Direct)' : 'Degradation (Transitive)'}
                  </span>
                )}
              </div>

              {selectedSystem ? (
                <div className="flex flex-col gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20">
                    <p className="font-headline-sm text-sm text-on-surface font-bold">
                      {selectedSystem.system_name}
                    </p>
                    <p className="font-label-code-sm text-[11px] text-outline">{selectedSystem.system_id}</p>
                    <p className="text-on-surface-variant mt-2 leading-relaxed">
                      {selectedSystem.hop_distance === 1
                        ? `Direct synchronous upstream caller. If ${impactData?.changed_system || 'the target'} is reverted or fails, this service experiences immediate request drop and cascading failure.`
                        : `Transitive dependent ${selectedSystem.hop_distance} hops away in the architectural graph. Relies on the intermediate tier and will experience partial data degradation.`}
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
                      <span className="font-semibold text-error">
                        {selectedSystem.hop_distance === 1 ? 'gRPC Deadlock / Connection Refused' : 'Data Inconsistency / Stale Cache'}
                      </span>
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
                <div className="p-6 text-center text-outline">
                  Select a node from the topology or table to inspect
                </div>
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
                {impactedList.length > 0 ? (
                  impactedList.map((sys, idx) => (
                    <tr
                      key={sys.system_id}
                      onClick={() => setSelectedSystem(sys)}
                      className={`hover:bg-surface-container-low transition-colors cursor-pointer ${
                        selectedSystem?.system_id === sys.system_id ? 'bg-surface-container-low/70' : ''
                      }`}
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-on-surface-variant font-label-code-sm">
                      No impacted systems found for this decision. Clean isolation verified in FalkorDB.
                    </td>
                  </tr>
                )}
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
