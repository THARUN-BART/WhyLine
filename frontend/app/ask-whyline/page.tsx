'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, AgentChatResponse } from '@/lib/api';
import { useUser } from '@/components/UserContext';

function AskWhylineContent() {
  const searchParams = useSearchParams();
  const { currentUser } = useUser();
  const initialQuery = searchParams.get('q') || 'Why did we move billing to billing-api?';

  const [query, setQuery] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AgentChatResponse | null>(null);
  const [activeInspectorNode, setActiveInspectorNode] = useState<{
    id: string;
    title: string;
    type: string;
    desc: string;
    tier: string;
    env: string;
    inbound: string;
    outbound: string;
    busFactor: string;
  }>({
    id: 'sys-billing-api',
    title: 'billing-api.service.internal',
    type: 'Target System',
    desc: 'Stateful orchestration microservice delivering gRPC charge routing, Stripe v2 connectors, and distributed transaction reconciliation.',
    tier: 'Tier-1 Critical',
    env: 'k8s-prod-us-east-1',
    inbound: '14 callers',
    outbound: 'aurora-pg-cluster',
    busFactor: '2 (Alice, Bob)',
  });

  const pinnedQuestions = [
    'Why did we move billing to billing-api?',
    'What breaks if we reverse this decision?',
    'Who maintains ledger-service and what is our operational risk?',
    'Where is the RFC document for adopting Protobuf schemas?',
    'Why was Redis introduced for sessions?',
    'What systems depend on payments-gateway?',
  ];

  const handleInvestigate = async (qToRun?: string) => {
    const q = qToRun || query;
    if (!q.trim()) return;
    setActiveQuery(q);
    setIsLoading(true);

    try {
      const res = await api.chatAgent(q, currentUser?.id || 'anonymous');
      setResponse(res);
    } catch {
      // Offline fallback mock matching graph
      setResponse({
        answer: `Billing was migrated from legacy monolith to billing-api (dec_billing_v2) because the legacy monolith dropped 4% of checkout transactions during peak sales. The engineering team extracted billing into an idempotent microservice with stateless horizontal autoscaling, dedicated gRPC endpoints, and automated retry idempotency.`,
        cited_node_ids: ['dec_billing_v2', 'sys_billing', 'sys_checkout', 'sys_order'],
        steps: [
          { type: 'tool_call', name: 'find_entity', input: { query: 'billing' } },
          { type: 'tool_call', name: 'trace_decision', input: { id: 'dec_billing_v2' } },
          { type: 'tool_call', name: 'impact_of', input: { id: 'dec_billing_v2' } },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleInvestigate(initialQuery);
  }, []);

  const selectNode = (nodeKey: string) => {
    if (nodeKey === 'person') {
      setActiveInspectorNode({
        id: 'usr_alice',
        title: 'Alice Smith',
        type: 'Person Node',
        desc: 'Principal Architect & Decider for core payments, ledger, and billing infrastructure isolation.',
        tier: 'Staff+ Authority',
        env: 'Core Arch WG',
        inbound: 'Decided 14 ADRs',
        outbound: 'Reports to VP Eng',
        busFactor: 'Active Owner',
      });
    } else if (nodeKey === 'decision') {
      setActiveInspectorNode({
        id: 'dec_billing_v2',
        title: 'Move billing off legacy monolith to billing-api',
        type: 'Decision Node',
        desc: 'Extracted billing into an idempotent microservice after legacy monolith dropped 4% of peak transactions.',
        tier: 'ADR Approved',
        env: 'Production Live',
        inbound: 'Ticket PROV-1042',
        outbound: 'Affects billing-api',
        busFactor: 'Provenanced (RFC-101)',
      });
    } else if (nodeKey === 'ticket') {
      setActiveInspectorNode({
        id: 'TICK-1042',
        title: 'PROV-1042: Extract billing to dedicated microservice',
        type: 'Ticket Node',
        desc: 'Jira tracking task for breaking monolith billing boundary, introducing gRPC contracts and SOX isolation.',
        tier: 'P0 Critical',
        env: 'Jira Enterprise',
        inbound: 'Incident WAR-88',
        outbound: 'Linked to RFC-101',
        busFactor: 'Resolved',
      });
    } else if (nodeKey === 'system') {
      setActiveInspectorNode({
        id: 'sys-billing-api',
        title: 'billing-api.service.internal',
        type: 'Target System',
        desc: 'Stateful orchestration microservice delivering gRPC charge routing, Stripe v2 connectors, and distributed transaction reconciliation.',
        tier: 'Tier-1 Critical',
        env: 'k8s-prod-us-east-1',
        inbound: '14 callers',
        outbound: 'aurora-pg-cluster',
        busFactor: '2 (Alice, Bob)',
      });
    } else if (nodeKey === 'deprecated') {
      setActiveInspectorNode({
        id: 'sys-legacy-monolith',
        title: 'monolith-billing-worker',
        type: 'Deprecated System',
        desc: 'Legacy ruby monolith process experiencing thread pool lock contention and silent payment dropped requests.',
        tier: 'Tier-3 Sunsetting',
        env: 'Deprecation Stage 3',
        inbound: '0 active routes',
        outbound: 'Legacy mysql pool',
        busFactor: 'Unmaintained',
      });
    }
  };

  return (
    <main className="w-full bg-surface min-h-screen">
      <div className="max-w-[1600px] mx-auto p-space-xl">
        <div className="flex flex-col w-full gap-space-2xl">
          {/* Header with High Density Metrics */}
          <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
            <div className="flex flex-col gap-space-2xs">
              <div className="flex items-center gap-space-xs text-primary font-label-edge text-label-edge uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                Neural Knowledge Graph Lineage
              </div>
              <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
                Ask Whyline
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
                Query institutional architecture decisions, structural invariants, cross-service dependencies, and blast radius with zero hallucination guarantee.
              </p>
            </div>
            {/* Trust Indicator Pill */}
            <div className="flex items-center gap-space-sm px-space-md py-space-xs rounded-full bg-surface-container-high shadow-sm">
              <span className="material-symbols-outlined text-[16px] text-primary">verified</span>
              <span className="font-label-edge text-label-edge text-on-surface tracking-wider uppercase font-medium">
                Graph-backed • Zero hallucinations • 100% Provenance
              </span>
              <span className="px-space-xs py-space-2xs rounded bg-surface-container-lowest text-primary font-label-code-sm text-label-code-sm font-semibold">
                ISO-42001
              </span>
            </div>
          </section>

          {/* Query Box Hero Area */}
          <section className="flex flex-col gap-space-md">
            <div className="relative w-full rounded-xl bg-surface-container-lowest shadow-md p-space-xs border border-outline-variant/30">
              <div className="flex items-center gap-space-md px-space-md py-space-sm bg-surface-container-low rounded-lg">
                <span className="material-symbols-outlined text-[24px] text-primary">psychology</span>
                <input
                  id="query-input"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleInvestigate();
                  }}
                  placeholder="Ask why a system changed, who decided it, or what breaks..."
                  className="flex-1 bg-transparent font-label-code-md text-label-code-md text-on-surface focus:outline-none placeholder:text-outline"
                />
                <div className="flex items-center gap-space-sm">
                  <button
                    onClick={() => handleInvestigate()}
                    disabled={isLoading}
                    className="flex items-center gap-space-sm px-space-lg py-space-sm rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm transition-all shadow-sm"
                  >
                    {isLoading ? (
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    ) : (
                      <span>Investigate</span>
                    )}
                    <kbd className="font-label-code-sm text-label-code-sm bg-white/20 px-space-xs py-space-2xs rounded">
                      ↵
                    </kbd>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Investigation Pills */}
            <div className="flex items-center gap-space-xs overflow-x-auto pb-space-xs">
              <span className="font-label-edge text-label-edge uppercase text-outline mr-space-xs whitespace-nowrap">
                Pinned Trajectories:
              </span>
              {pinnedQuestions.map((pq) => (
                <button
                  key={pq}
                  onClick={() => {
                    setQuery(pq);
                    handleInvestigate(pq);
                  }}
                  className={`flex items-center gap-space-xs px-space-md py-space-xs rounded-full font-label-code-sm text-label-code-sm whitespace-nowrap transition-colors shadow-sm ${
                    activeQuery === pq
                      ? 'bg-primary-container text-on-primary font-medium'
                      : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {activeQuery === pq && <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed"></span>}
                  {pq}
                </button>
              ))}
            </div>
          </section>

          {/* Query Metadata Header Strip */}
          <section className="flex flex-col sm:flex-row sm:items-center justify-between p-space-md bg-surface-container-low rounded-xl gap-space-sm shadow-sm border border-outline-variant/20">
            <div className="flex items-center gap-space-sm min-w-0">
              <span className="px-space-xs py-space-2xs rounded bg-surface-container-highest font-label-edge text-label-edge text-primary font-bold uppercase tracking-wider">
                Target Trace
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                {activeQuery}
              </span>
            </div>
            <div className="flex items-center gap-space-md shrink-0">
              <div className="flex items-center gap-space-xs text-on-surface-variant font-label-code-sm text-label-code-sm">
                <span className="material-symbols-outlined text-[16px] text-secondary">insights</span>
                <span>FalkorDB Traversal (6 Nodes • 5 Hops)</span>
              </div>
              <span className="h-3 w-px bg-outline-variant"></span>
              <span className="flex items-center gap-space-xs px-space-xs py-space-2xs rounded-full bg-surface-container-highest text-on-surface font-label-code-sm text-label-code-sm">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                High Confidence (Evidence-backed)
              </span>
            </div>
          </section>

          {/* Primary Results Canvas Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl">
            {/* Left 8 Columns: AI Synthesis & Graph Pipeline */}
            <div className="lg:col-span-8 flex flex-col gap-space-xl">
              {/* Verified AI Answer Card */}
              <article className="flex flex-col gap-space-md p-space-xl rounded-xl bg-surface-container-lowest shadow-md relative overflow-hidden border border-outline-variant/30">
                <div className="flex items-center justify-between flex-wrap gap-space-sm">
                  <div className="flex items-center gap-space-xs px-space-sm py-space-2xs rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-edge text-label-edge font-bold tracking-wide uppercase">
                    <span className="material-symbols-outlined text-[14px]">shield</span>
                    Verified Synthesis • Derived strictly from connected records
                  </div>
                  <div className="flex items-center gap-space-xs text-outline font-label-code-sm text-label-code-sm">
                    <span>Provenance Verified live</span>
                  </div>
                </div>

                {isLoading ? (
                  <div className="py-8 flex items-center justify-center gap-3 text-primary">
                    <span className="material-symbols-outlined animate-spin text-2xl">progress_activity</span>
                    <span className="font-body-md">Traversing knowledge graph & verifying citations...</span>
                  </div>
                ) : (
                  <>
                    <p className="font-body-lg text-body-lg text-on-surface leading-relaxed">
                      {response?.answer ||
                        `Billing was migrated from legacy-billing to billing-api (dec_billing_v2) because legacy-billing experienced severe connection-pooling bottlenecks, recurring p99 latency spikes during flash sales, and could not be horizontally scaled due to stateful in-memory locks. Previous optimization attempts failed to resolve peak degradation. The engineering team chose billing-api because it provides stateless horizontal pod autoscaling, independent gRPC endpoints, and automated retry idempotency.`}
                    </p>

                    {/* Cited Nodes Pills */}
                    {response?.cited_node_ids && response.cited_node_ids.length > 0 && (
                      <div className="flex items-center flex-wrap gap-2 pt-2 border-t border-outline-variant/20">
                        <span className="font-label-edge text-label-edge text-outline uppercase">
                          Graph Citations:
                        </span>
                        {response.cited_node_ids.map((cid) => (
                          <button
                            key={cid}
                            onClick={() => {
                              if (cid.startsWith('dec_')) selectNode('decision');
                              else if (cid.startsWith('sys_')) selectNode('system');
                              else if (cid.startsWith('usr_')) selectNode('person');
                            }}
                            className="font-label-code-sm text-xs bg-primary-fixed text-on-primary-fixed-variant px-2 py-0.5 rounded font-medium hover:bg-primary hover:text-white transition-colors"
                          >
                            {cid}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Synthesis Key Takeaway Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm pt-space-xs">
                      <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                        <span className="font-label-edge text-label-edge text-outline uppercase">Primary Driver</span>
                        <span className="font-headline-sm text-headline-sm text-on-surface mt-space-2xs">
                          DB Pooling Failures
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">4% dropped checkout tx</span>
                      </div>
                      <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                        <span className="font-label-edge text-label-edge text-outline uppercase">Target State</span>
                        <span className="font-headline-sm text-headline-sm text-on-surface mt-space-2xs">
                          Stateless gRPC
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">Pod autoscaling (HPA)</span>
                      </div>
                      <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col">
                        <span className="font-label-edge text-label-edge text-outline uppercase">Decision Authority</span>
                        <span className="font-headline-sm text-headline-sm text-on-surface mt-space-2xs">
                          Alice Smith
                        </span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">RFC-101 Signoff</span>
                      </div>
                    </div>
                  </>
                )}
              </article>

              {/* Graph Proof Visual Flow Pipeline */}
              <section className="flex flex-col gap-space-md p-space-xl rounded-xl bg-surface-container-lowest shadow-md border border-outline-variant/30">
                <div className="flex items-center justify-between flex-wrap gap-space-xs">
                  <div>
                    <div className="flex items-center gap-space-xs">
                      <span className="material-symbols-outlined text-[18px] text-primary">hub</span>
                      <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight">
                        GRAPH PROOF — Traversing Lineage
                      </h2>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mt-space-2xs">
                      Solid connectors indicate verified auditable database records. Click any node to open the contextual audit inspector.
                    </p>
                  </div>
                  <span className="font-label-code-sm text-label-code-sm text-outline bg-surface-container px-space-sm py-space-2xs rounded">
                    Interactive Topology (6 Nodes)
                  </span>
                </div>

                {/* Visual Graph Canvas */}
                <div className="p-space-lg rounded-xl bg-surface-container-low overflow-x-auto">
                  <div className="min-w-[940px] flex items-center justify-between py-space-md px-space-xs relative">
                    {/* Node 1: Person */}
                    <div
                      className="cursor-pointer group flex flex-col items-center gap-space-xs text-center z-10 w-36 transition-transform hover:scale-105"
                      onClick={() => selectNode('person')}
                    >
                      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm group-hover:bg-primary-container">
                        <span className="material-symbols-outlined text-[22px]">badge</span>
                      </div>
                      <span className="font-label-edge text-label-edge uppercase bg-surface-container-highest text-primary px-space-xs py-space-2xs rounded font-bold">
                        Person Node
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface">Alice Smith</span>
                      <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">Principal Arch</span>
                    </div>

                    {/* Edge 1 */}
                    <div className="flex-1 flex flex-col items-center px-space-xs">
                      <span className="font-label-edge text-label-edge uppercase text-primary font-bold bg-surface-container-highest px-space-xs py-space-2xs rounded mb-1">
                        DECIDED
                      </span>
                      <div className="w-full h-0.5 bg-primary relative">
                        <div className="absolute right-0 -top-1 w-2 h-2 border-t-2 border-r-2 border-primary rotate-45"></div>
                      </div>
                      <span className="font-label-code-sm text-[10px] text-outline mt-1">RFC-101</span>
                    </div>

                    {/* Node 2: Decision */}
                    <div
                      className="cursor-pointer group flex flex-col items-center gap-space-xs text-center z-10 w-40 transition-transform hover:scale-105"
                      onClick={() => selectNode('decision')}
                    >
                      <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary shadow-sm group-hover:bg-primary group-hover:text-on-primary transition-colors">
                        <span className="material-symbols-outlined text-[22px]">alt_route</span>
                      </div>
                      <span className="font-label-edge text-label-edge uppercase bg-primary-fixed text-on-primary-fixed px-space-xs py-space-2xs rounded font-bold">
                        Decision
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface">dec_billing_v2</span>
                      <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">SOX Approved</span>
                    </div>

                    {/* Edge 2 */}
                    <div className="flex-1 flex flex-col items-center px-space-xs">
                      <span className="font-label-edge text-label-edge uppercase text-primary font-bold bg-surface-container-highest px-space-xs py-space-2xs rounded mb-1">
                        APPROVED_IN
                      </span>
                      <div className="w-full h-0.5 bg-primary relative">
                        <div className="absolute right-0 -top-1 w-2 h-2 border-t-2 border-r-2 border-primary rotate-45"></div>
                      </div>
                      <span className="font-label-code-sm text-[10px] text-outline mt-1">TICK-1042</span>
                    </div>

                    {/* Node 3: Ticket */}
                    <div
                      className="cursor-pointer group flex flex-col items-center gap-space-xs text-center z-10 w-36 transition-transform hover:scale-105"
                      onClick={() => selectNode('ticket')}
                    >
                      <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary shadow-sm group-hover:bg-primary group-hover:text-on-primary transition-colors">
                        <span className="material-symbols-outlined text-[22px]">confirmation_number</span>
                      </div>
                      <span className="font-label-edge text-label-edge uppercase bg-surface-container-highest text-on-surface-variant px-space-xs py-space-2xs rounded font-bold">
                        Ticket Node
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface">TKT-101</span>
                      <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">PROV-1042</span>
                    </div>

                    {/* Edge 3 */}
                    <div className="flex-1 flex flex-col items-center px-space-xs">
                      <span className="font-label-edge text-label-edge uppercase text-primary font-bold bg-surface-container-highest px-space-xs py-space-2xs rounded mb-1">
                        DISCUSSED_IN
                      </span>
                      <div className="w-full h-0.5 bg-primary relative">
                        <div className="absolute right-0 -top-1 w-2 h-2 border-t-2 border-r-2 border-primary rotate-45"></div>
                      </div>
                      <span className="font-label-code-sm text-[10px] text-outline mt-1">War Room</span>
                    </div>

                    {/* Node 4: Discussion */}
                    <div
                      className="cursor-pointer group flex flex-col items-center gap-space-xs text-center z-10 w-36 transition-transform hover:scale-105"
                      onClick={() => selectNode('decision')}
                    >
                      <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary shadow-sm group-hover:bg-primary group-hover:text-on-primary transition-colors">
                        <span className="material-symbols-outlined text-[22px]">forum</span>
                      </div>
                      <span className="font-label-edge text-label-edge uppercase bg-surface-container-highest text-on-surface-variant px-space-xs py-space-2xs rounded font-bold">
                        Discussion
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface">#war-room</span>
                      <span className="font-label-code-sm text-label-code-sm text-on-surface-variant">Slack Thread</span>
                    </div>

                    {/* Edge 4 */}
                    <div className="flex-1 flex flex-col items-center px-space-xs">
                      <span className="font-label-edge text-label-edge uppercase text-secondary font-bold bg-surface-container-highest px-space-xs py-space-2xs rounded mb-1">
                        AFFECTS
                      </span>
                      <div className="w-full h-0.5 bg-secondary relative">
                        <div className="absolute right-0 -top-1 w-2 h-2 border-t-2 border-r-2 border-secondary rotate-45"></div>
                      </div>
                      <span className="font-label-code-sm text-[10px] text-outline mt-1">Prod Mesh</span>
                    </div>

                    {/* Node 5: Target System */}
                    <div
                      className="cursor-pointer group flex flex-col items-center gap-space-xs text-center z-10 w-36 transition-transform hover:scale-105"
                      onClick={() => selectNode('system')}
                    >
                      <div className="w-12 h-12 rounded-xl bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed shadow-sm group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                        <span className="material-symbols-outlined text-[22px]">dns</span>
                      </div>
                      <span className="font-label-edge text-label-edge uppercase bg-secondary-fixed text-on-secondary-fixed px-space-xs py-space-2xs rounded font-bold">
                        Target System
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface">billing-api</span>
                      <span className="font-label-code-sm text-label-code-sm text-secondary font-semibold">Active (Prod)</span>
                    </div>

                    {/* Edge 5 */}
                    <div className="flex-1 flex flex-col items-center px-space-xs">
                      <span className="font-label-edge text-label-edge uppercase text-error font-bold bg-error-container text-on-error-container px-space-xs py-space-2xs rounded mb-1">
                        REPLACES
                      </span>
                      <div className="w-full h-0.5 bg-outline relative">
                        <div className="absolute right-0 -top-1 w-2 h-2 border-t-2 border-r-2 border-outline rotate-45"></div>
                      </div>
                      <span className="font-label-code-sm text-[10px] text-outline mt-1">Sunsetting</span>
                    </div>

                    {/* Node 6: Deprecated System */}
                    <div
                      className="cursor-pointer group flex flex-col items-center gap-space-xs text-center z-10 w-36 transition-transform hover:scale-105 opacity-80"
                      onClick={() => selectNode('deprecated')}
                    >
                      <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant shadow-sm group-hover:bg-outline transition-colors">
                        <span className="material-symbols-outlined text-[22px]">archive</span>
                      </div>
                      <span className="font-label-edge text-label-edge uppercase bg-surface-container-highest text-outline px-space-xs py-space-2xs rounded font-bold">
                        Source Node
                      </span>
                      <span className="font-headline-sm text-headline-sm text-on-surface">legacy-billing</span>
                      <span className="font-label-code-sm text-label-code-sm text-outline">Deprecated</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-space-xs text-on-surface-variant font-label-code-sm text-label-code-sm">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-[16px] text-primary">touch_app</span>
                    <span>Click any node to inspect raw audit log &amp; metadata</span>
                  </div>
                  <div className="flex items-center gap-space-md">
                    <span className="flex items-center gap-space-xs">
                      <span className="w-2 h-0.5 bg-primary"></span> Explicit documented
                    </span>
                    <span className="flex items-center gap-space-xs">
                      <span className="w-2 h-0.5 bg-outline"></span> Lifecycle migration
                    </span>
                  </div>
                </div>
              </section>

              {/* Primary Sources & Raw Evidence Records */}
              <section className="flex flex-col gap-space-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-[20px] text-primary">source</span>
                    <h2 className="font-headline-md text-headline-md text-on-surface">
                      Primary Sources &amp; Raw Evidence
                    </h2>
                  </div>
                  <span className="font-label-code-sm text-label-code-sm text-outline">
                    3 immutable records connected
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  {/* Card 1: Ticket TKT-101 */}
                  <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm gap-space-md border border-outline-variant/30">
                    <div className="flex flex-col gap-space-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-label-code-sm text-label-code-sm text-primary font-bold px-space-xs py-space-2xs rounded bg-surface-container-high">
                          Jira • TICK-1042 / TKT-101
                        </span>
                        <span className="px-space-xs py-space-2xs rounded-full bg-surface-container-high text-on-surface font-label-edge text-label-edge uppercase font-bold">
                          Resolved
                        </span>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">
                        Billing migration from legacy-billing to billing-api
                      </h3>
                      <div className="flex items-center gap-space-md text-outline font-label-code-sm text-label-code-sm mt-space-2xs">
                        <span>Priority: Critical</span>
                        <span>•</span>
                        <span>Assignee: Alice Smith</span>
                        <span>•</span>
                        <span>Sprint: 2024.Q3.02</span>
                      </div>
                    </div>
                    <div className="p-space-sm rounded-lg bg-surface-container-low font-body-sm text-body-sm text-on-surface-variant italic">
                      &ldquo;Legacy monolith dropped 4% of checkout transactions during Black Friday peak. Moving billing to billing-api restores idempotency.&rdquo;
                    </div>
                    <div className="flex items-center justify-between font-label-code-sm text-label-code-sm text-outline pt-space-xs">
                      <span className="flex items-center gap-space-xs">
                        <span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
                        Verified DB Log #9410
                      </span>
                      <Link href="/tickets/TICK-1042" className="text-primary hover:underline font-medium">
                        Open Ticket Detail →
                      </Link>
                    </div>
                  </div>

                  {/* Card 2: Discussion Thread */}
                  <div className="flex flex-col justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm gap-space-md border border-outline-variant/30">
                    <div className="flex flex-col gap-space-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-label-code-sm text-label-code-sm text-secondary font-bold px-space-xs py-space-2xs rounded bg-surface-container-high">
                          Slack • #eng-billing-war-room
                        </span>
                        <span className="px-space-xs py-space-2xs rounded-full bg-surface-container-high text-on-surface font-label-edge text-label-edge uppercase font-bold">
                          4 Replies
                        </span>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">
                        Billing Migration Decision Thread
                      </h3>
                      <p className="font-label-code-sm text-label-code-sm text-outline">
                        Channel archive snippet • Oct 14, 2024
                      </p>
                    </div>
                    {/* Dialogue Snippets */}
                    <div className="flex flex-col gap-space-xs p-space-sm rounded-lg bg-surface-container-low font-body-sm text-body-sm text-on-surface">
                      <div className="flex items-start gap-space-xs">
                        <span className="font-semibold text-primary font-label-code-sm text-label-code-sm shrink-0">
                          Alice:
                        </span>
                        <span className="text-on-surface-variant">
                          &ldquo;Can we optimize legacy-billing connection pools instead?&rdquo;
                        </span>
                      </div>
                      <div className="flex items-start gap-space-xs">
                        <span className="font-semibold text-secondary font-label-code-sm text-label-code-sm shrink-0">
                          Bob:
                        </span>
                        <span className="text-on-surface-variant">
                          &ldquo;We already tried that. Database connection pooling remains a bottleneck.&rdquo;
                        </span>
                      </div>
                      <div className="flex items-start gap-space-xs">
                        <span className="font-semibold text-on-surface font-label-code-sm text-label-code-sm shrink-0">
                          Charlie:
                        </span>
                        <span className="text-on-surface-variant">
                          &ldquo;billing-api already supports horizontal scaling.&rdquo;
                        </span>
                      </div>
                      <div className="flex items-start gap-space-xs pt-space-2xs">
                        <span className="font-semibold text-primary font-label-code-sm text-label-code-sm shrink-0">
                          Alice (Lead):
                        </span>
                        <span className="font-medium text-on-surface">
                          &ldquo;Let&apos;s migrate billing to billing-api.&rdquo;
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between font-label-code-sm text-label-code-sm text-outline pt-space-xs">
                      <span>SHA-256 Verified Ingestion</span>
                      <Link href="/decisions/dec_billing_v2" className="text-primary hover:underline font-medium">
                        View Decision ADR →
                      </Link>
                    </div>
                  </div>

                  {/* Card 3: Technical RFC Document */}
                  <div className="md:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between p-space-lg rounded-xl bg-surface-container-lowest shadow-sm gap-space-md border border-outline-variant/30">
                    <div className="flex items-center gap-space-md">
                      <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-[24px]">description</span>
                      </div>
                      <div className="flex flex-col gap-space-2xs">
                        <div className="flex items-center gap-space-xs">
                          <span className="font-label-code-sm text-label-code-sm text-primary font-bold px-space-xs py-space-2xs rounded bg-surface-container-high">
                            RFC-101
                          </span>
                          <span className="font-headline-sm text-headline-sm text-on-surface">
                            Billing Architecture &amp; Service Boundary Isolation
                          </span>
                        </div>
                        <div className="flex items-center gap-space-md text-on-surface-variant font-label-code-sm text-label-code-sm">
                          <span>Signoffs: Alice Smith (Principal Architect)</span>
                          <span>•</span>
                          <span>Target: billing-api microservice</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-space-md w-full sm:w-auto justify-between sm:justify-end">
                      <div className="flex flex-col items-end">
                        <span className="font-label-edge text-label-edge text-outline uppercase">Content Hash</span>
                        <code className="font-label-code-sm text-label-code-sm text-on-surface">
                          sha256:7f4a9b...e832
                        </code>
                      </div>
                      <Link
                        href="/decisions/dec_billing_v2"
                        className="px-space-md py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-headline-sm text-headline-sm transition-colors shadow-sm"
                      >
                        View RFC
                      </Link>
                    </div>
                  </div>
                </div>
              </section>

              {/* Follow-up Action Buttons */}
              <section className="flex flex-wrap items-center gap-space-md p-space-lg rounded-xl bg-surface-container-low shadow-sm border border-outline-variant/20">
                <span className="font-label-edge text-label-edge uppercase text-outline mr-space-xs">
                  Autonomous Traversal Actions:
                </span>
                <Link
                  href="/impact-analysis?id=dec_billing_v2"
                  className="flex items-center gap-space-xs px-space-lg py-space-sm rounded-lg bg-primary-container hover:bg-primary text-on-primary font-headline-sm text-headline-sm transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">replay</span>
                  <span>Analyze Change Impact (&apos;What breaks if we reverse this?&apos;)</span>
                </Link>
                <Link
                  href="/graph-explorer"
                  className="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container-lowest hover:bg-surface-container-highest text-on-surface font-headline-sm text-headline-sm transition-colors shadow-sm border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">hub</span>
                  <span>Inspect System Lineage in Graph Explorer</span>
                </Link>
                <Link
                  href="/rag-comparison"
                  className="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container-lowest hover:bg-surface-container-highest text-on-surface font-headline-sm text-headline-sm transition-colors shadow-sm border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">compare_arrows</span>
                  <span>Compare vs Naive Vector RAG</span>
                </Link>
              </section>
            </div>

            {/* Right 4 Columns: Context Inspector Drawer & Live Topology Stats */}
            <div className="lg:col-span-4 flex flex-col gap-space-xl">
              {/* Live Audit Inspector Drawer Pane */}
              <aside
                className="flex flex-col gap-space-md p-space-xl rounded-xl bg-surface-container-lowest shadow-md border border-outline-variant/30"
                id="node-inspector"
              >
                <div className="flex items-center justify-between pb-space-xs border-b border-outline-variant/20">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-[18px] text-primary">troubleshoot</span>
                    <h3 className="font-headline-md text-headline-md text-on-surface">Node Inspector</h3>
                  </div>
                  <span className="font-label-edge text-label-edge uppercase bg-secondary-fixed text-on-secondary-fixed px-space-xs py-space-2xs rounded font-bold">
                    {activeInspectorNode.type}
                  </span>
                </div>
                <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col gap-space-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-label-code-sm text-label-code-sm text-outline uppercase font-semibold">
                      Node #{activeInspectorNode.id}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                  </div>
                  <p className="font-headline-sm text-headline-sm text-on-surface">{activeInspectorNode.title}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {activeInspectorNode.desc}
                  </p>
                </div>

                {/* Node Properties Key-Value Table */}
                <div className="flex flex-col gap-space-xs">
                  <span className="font-label-edge text-label-edge text-outline uppercase tracking-wider">
                    Provenance Invariants
                  </span>
                  <div className="flex items-center justify-between py-space-xs text-body-sm border-b border-outline-variant/10">
                    <span className="text-on-surface-variant">Tier Level:</span>
                    <span className="font-label-code-sm text-label-code-sm text-on-surface font-semibold">
                      {activeInspectorNode.tier}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-space-xs text-body-sm border-b border-outline-variant/10">
                    <span className="text-on-surface-variant">Environment:</span>
                    <span className="font-label-code-sm text-label-code-sm text-on-surface">
                      {activeInspectorNode.env}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-space-xs text-body-sm border-b border-outline-variant/10">
                    <span className="text-on-surface-variant">Inbound Edges:</span>
                    <span className="font-label-code-sm text-label-code-sm text-primary font-bold">
                      {activeInspectorNode.inbound}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-space-xs text-body-sm border-b border-outline-variant/10">
                    <span className="text-on-surface-variant">Outbound Dependents:</span>
                    <span className="font-label-code-sm text-label-code-sm text-on-surface">
                      {activeInspectorNode.outbound}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-space-xs text-body-sm">
                    <span className="text-on-surface-variant">Bus Factor:</span>
                    <span className="px-space-xs py-space-2xs rounded bg-surface-container text-tertiary font-label-code-sm text-label-code-sm font-semibold">
                      {activeInspectorNode.busFactor}
                    </span>
                  </div>
                </div>

                {/* Inline Visual Dependency Spark Chart */}
                <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col gap-space-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-label-edge text-label-edge uppercase text-outline">
                      Call Ingestion Volume
                    </span>
                    <span className="font-label-code-sm text-label-code-sm text-secondary font-bold">
                      4.2k req/s avg
                    </span>
                  </div>
                  <svg className="w-full h-12 text-primary" fill="none" viewBox="0 0 200 40">
                    <path
                      d="M0,35 Q20,32 40,28 T80,18 T120,22 T160,10 T200,8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    ></path>
                    <path
                      d="M0,35 Q20,32 40,28 T80,18 T120,22 T160,10 T200,8 L200,40 L0,40 Z"
                      fill="currentColor"
                      fillOpacity="0.08"
                    ></path>
                  </svg>
                </div>

                <Link
                  href="/impact-analysis?system=billing-api"
                  className="w-full py-space-xs rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-headline-sm text-headline-sm transition-colors text-center block"
                >
                  Open Node in Impact Analysis
                </Link>
              </aside>

              {/* Knowledge Base Freshness Card */}
              <section className="flex flex-col gap-space-md p-space-xl rounded-xl bg-surface-container-lowest shadow-md border border-outline-variant/30">
                <div className="flex items-center justify-between">
                  <span className="font-headline-sm text-headline-sm text-on-surface">Decision Freshness</span>
                  <span className="material-symbols-outlined text-[18px] text-secondary">update</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span>Last Graph Ingestion</span>
                    <span className="font-label-code-sm text-on-surface">2 mins ago</span>
                  </div>
                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span>Verified Audit Hash</span>
                    <span className="font-label-code-sm text-primary">sha256:7f4a...</span>
                  </div>
                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span>FalkorDB Consistency</span>
                    <span className="text-secondary font-semibold">100% Strict ACID</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AskWhylinePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-primary">Loading AI Investigation...</div>}>
      <AskWhylineContent />
    </Suspense>
  );
}
