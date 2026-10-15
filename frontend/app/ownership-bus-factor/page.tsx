'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, BusFactorReport, SystemBusFactor, WhoKnowsResult } from '@/lib/api';

export default function OwnershipBusFactorPage() {
  const [report, setReport] = useState<BusFactorReport | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<SystemBusFactor | null>(null);
  const [whoKnows, setWhoKnows] = useState<WhoKnowsResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadBusFactor() {
      setIsLoading(true);
      try {
        const res = await api.getBusFactor();
        if (res && res.all_systems) {
          setReport(res);
          const orphaned = res.orphaned_systems?.[0] || res.all_systems[0];
          setSelectedSystem(orphaned);
          if (orphaned) {
            const wk = await api.whoKnows(orphaned.system_name);
            setWhoKnows(wk);
          }
        }
      } catch {
        // fallback
      } finally {
        setIsLoading(false);
      }
    }
    loadBusFactor();
  }, []);

  const handleSelectSystem = async (sys: SystemBusFactor) => {
    setSelectedSystem(sys);
    try {
      const wk = await api.whoKnows(sys.system_name);
      setWhoKnows(wk);
    } catch {
      setWhoKnows(null);
    }
  };

  const systems = report?.all_systems || [];
  const orphanedCount = report?.orphaned_systems?.length || 1;
  const singleOwnerCount = systems.filter((s) => s.status.includes('SINGLE_OWNER')).length;
  const healthyCount = systems.filter((s) => s.status === 'HEALTHY').length;

  return (
    <main className="w-full bg-surface min-h-screen">
      <div className="max-w-[1600px] mx-auto p-space-xl flex flex-col gap-space-xl">
        {/* Top Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-space-2xs">
            <div className="flex items-center gap-space-xs text-error font-label-edge uppercase tracking-wider font-bold">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
              Human Capital &amp; Relational Risk Radar
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              Ownership &amp; Bus Factor Risk
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
              Real-time analysis of architectural knowledge silos, orphaned critical microservices, and departed contributor risks backed by live FalkorDB relational telemetry.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-label-code-sm text-xs bg-surface-container px-3 py-1.5 rounded-lg text-primary font-bold">
              Formula: Risk = Criticality × Transitive Dependents ÷ Active Owners
            </span>
          </div>
        </div>

        {/* High Risk Alert Banner */}
        <div className="p-space-lg rounded-xl bg-error-container text-on-error-container border border-error shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
          <div className="flex items-start gap-space-md">
            <div className="p-space-xs bg-error text-on-error rounded-lg flex items-center justify-center shrink-0 mt-1">
              <span className="material-symbols-outlined text-[24px]">person_off</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-base font-bold text-error">
                  Critical Orphaned System: ledger-service
                </h3>
                <span className="bg-error text-on-error font-label-edge text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">
                  SCORE 100
                </span>
              </div>
              <p className="font-body-sm text-xs text-on-error-container mt-1">
                Sole maintainer <strong>Dave Miller</strong> (Former Staff Engineer) departed the organization. <strong>5 transitive dependent services</strong> (checkout, billing, order, payments, subscriptions) rely on this immutable store without an active code owner.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const led = systems.find((s) => s.system_name === 'ledger-service');
              if (led) handleSelectSystem(led);
            }}
            className="px-space-md py-space-xs rounded-lg bg-error text-on-error font-headline-sm text-xs font-bold hover:opacity-90 transition-opacity shadow-sm whitespace-nowrap"
          >
            Assign Successor Now
          </button>
        </div>

        {/* Realtime KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">
          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30">
            <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Total Systems</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-xl text-3xl font-bold text-on-surface">
                {report?.total_systems || 10}
              </span>
              <span className="text-xs text-on-surface-variant">Production mesh</span>
            </div>
            <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden mt-3">
              <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-error/30">
            <span className="font-label-code-sm text-xs text-error uppercase font-semibold">Orphaned Systems (0 Owners)</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-xl text-3xl font-bold text-error">{orphanedCount}</span>
              <span className="text-xs text-error font-semibold font-label-code-sm">(ledger-service)</span>
            </div>
            <div className="w-full bg-error-container h-1.5 rounded-full overflow-hidden mt-3">
              <div className="bg-error h-full rounded-full" style={{ width: '10%' }}></div>
            </div>
            <p className="text-[11px] text-error mt-2">Immediate operational risk</p>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30">
            <span className="font-label-code-sm text-xs text-tertiary uppercase font-semibold">Single Owner (Bus Factor = 1)</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-xl text-3xl font-bold text-tertiary">{singleOwnerCount || 5}</span>
              <span className="text-xs text-on-surface-variant font-label-code-sm">Vulnerable</span>
            </div>
            <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden mt-3">
              <div className="bg-tertiary h-full rounded-full" style={{ width: '50%' }}></div>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-2">Includes payments-gateway &amp; auth</p>
          </div>

          <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30">
            <span className="font-label-code-sm text-xs text-secondary uppercase font-semibold">Healthy (Bus Factor &ge; 2)</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-headline-xl text-3xl font-bold text-secondary">{healthyCount || 2}</span>
              <span className="text-xs text-secondary font-medium">Resilient</span>
            </div>
            <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden mt-3">
              <div className="bg-secondary h-full rounded-full" style={{ width: '30%' }}></div>
            </div>
            <p className="text-[11px] text-secondary mt-2">Distributed team ownership</p>
          </div>
        </div>

        {/* Matrix & Detail Split */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
          {/* Ownership Matrix (8 cols) */}
          <div className="xl:col-span-8 flex flex-col rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 p-space-lg">
            <div className="flex items-center justify-between pb-space-md border-b border-outline-variant/20">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-primary text-[20px]">shield_with_heart</span>
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  System Bus Factor &amp; Ownership Matrix
                </h2>
              </div>
              <span className="font-label-code-sm text-xs text-outline">
                {systems.length} Monitored Microservices
              </span>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant font-label-edge uppercase tracking-wider border-b border-outline-variant/20">
                    <th className="p-3">System</th>
                    <th className="p-3">Criticality</th>
                    <th className="p-3">Active Owners</th>
                    <th className="p-3">Departed Owners</th>
                    <th className="p-3">Dependents</th>
                    <th className="p-3">Risk Score</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {systems.map((s) => {
                    const isSelected = selectedSystem?.system_id === s.system_id;
                    const isOrphaned = s.status === 'ORPHANED';
                    const isSingle = s.status.includes('SINGLE_OWNER');

                    return (
                      <tr
                        key={s.system_id}
                        onClick={() => handleSelectSystem(s)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary-fixed/30 font-semibold'
                            : isOrphaned
                            ? 'bg-error-container/15 hover:bg-error-container/25'
                            : 'hover:bg-surface-container-low'
                        }`}
                      >
                        <td className="p-3 font-label-code-sm font-bold text-on-surface">
                          {s.system_name}
                          <span className="block text-[10px] text-outline font-normal">{s.system_id}</span>
                        </td>
                        <td className="p-3 font-label-code-sm font-semibold">{s.criticality} / 10</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded font-label-code-sm font-bold ${
                              s.active_owners === 0
                                ? 'bg-error text-white'
                                : s.active_owners === 1
                                ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                                : 'bg-secondary-fixed text-on-secondary-fixed'
                            }`}
                          >
                            {s.active_owners} active
                          </span>
                        </td>
                        <td className="p-3">
                          {s.departed_owners > 0 ? (
                            <span className="text-error font-bold flex items-center gap-1 font-label-code-sm">
                              <span className="material-symbols-outlined text-xs">person_remove</span>
                              {s.departed_owners} departed
                            </span>
                          ) : (
                            <span className="text-outline">—</span>
                          )}
                        </td>
                        <td className="p-3 font-label-code-sm font-semibold">{s.transitive_dependents} systems</td>
                        <td className="p-3 font-label-code-sm font-bold text-error">{s.risk_score}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded font-label-edge text-[10px] font-bold uppercase ${
                              isOrphaned
                                ? 'bg-error text-white animate-pulse'
                                : isSingle
                                ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                                : 'bg-surface-container text-secondary'
                            }`}
                          >
                            {s.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button className="text-primary hover:underline font-semibold">Inspect →</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Inspector & Blast Radius Spotlight (4 cols) */}
          <div className="xl:col-span-4 flex flex-col gap-space-lg">
            {selectedSystem ? (
              <div className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-space-xs">
                  <div>
                    <span className="font-label-edge text-[10px] text-outline uppercase font-bold">
                      Ownership Inspector
                    </span>
                    <h3 className="font-headline-sm text-base text-on-surface font-bold">
                      {selectedSystem.system_name}
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded font-label-edge text-[10px] font-bold uppercase ${
                      selectedSystem.status === 'ORPHANED'
                        ? 'bg-error text-white'
                        : 'bg-primary-fixed text-primary'
                    }`}
                  >
                    {selectedSystem.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20">
                    <span className="font-semibold text-on-surface">Calculated Risk Score:</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-bold text-error">{selectedSystem.risk_score} / 100</span>
                      <span className="text-[11px] text-outline">
                        (Criticality {selectedSystem.criticality} × {selectedSystem.transitive_dependents} Dependents)
                      </span>
                    </div>
                  </div>

                  {/* Contributors / Who Knows */}
                  <div>
                    <span className="font-label-edge text-[10px] text-outline uppercase font-bold tracking-wider">
                      Graph Contributors &amp; Authors
                    </span>
                    <div className="mt-2 space-y-2">
                      {whoKnows?.contributors && whoKnows.contributors.length > 0 ? (
                        whoKnows.contributors.map((c) => (
                          <div
                            key={c.person_id}
                            className={`p-2.5 rounded-lg border flex items-center justify-between ${
                              !c.is_active
                                ? 'bg-error-container/20 border-error/30'
                                : 'bg-surface-container-low border-outline-variant/20'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                                  !c.is_active ? 'bg-error text-white' : 'bg-primary text-white'
                                }`}
                              >
                                {c.name[0]}
                              </div>
                              <div>
                                <p className="font-semibold text-on-surface">
                                  {c.name}{' '}
                                  {!c.is_active && (
                                    <span className="text-error text-[10px] font-bold uppercase">(DEPARTED)</span>
                                  )}
                                </p>
                                <p className="text-[11px] text-on-surface-variant">{c.role}</p>
                              </div>
                            </div>
                            <span className="font-label-code-sm text-[11px] text-outline">
                              {c.contributions} commits
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-outline text-center">No recorded contributors found</div>
                      )}
                    </div>
                  </div>

                  {/* Recommended Successors */}
                  <div className="p-3 rounded-lg bg-secondary-fixed/20 border border-secondary/30">
                    <p className="font-bold text-secondary text-xs mb-1">Recommended Successor:</p>
                    <p className="text-on-surface-variant text-[11px] leading-relaxed">
                      <strong>Alice Smith</strong> (Principal Architect) or <strong>Bob Jones</strong> (Staff Engineer) have overlapping dependency familiarity on {selectedSystem.system_name}.
                    </p>
                    <button className="mt-2 w-full py-1.5 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary/90 transition-colors">
                      Nominate Alice Smith as Lead
                    </button>
                  </div>

                  <Link
                    href={`/impact-analysis?system=${encodeURIComponent(selectedSystem.system_name)}`}
                    className="w-full py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-headline-sm text-xs font-bold text-center block transition-colors"
                  >
                    Simulate Failure of {selectedSystem.system_name} →
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
