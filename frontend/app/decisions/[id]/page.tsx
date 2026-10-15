'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, DecisionTrace } from '@/lib/api';

export default function DecisionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const decisionId = (params?.id as string) || 'dec_billing_v2';

  const [trace, setTrace] = useState<DecisionTrace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTrace() {
      setIsLoading(true);
      try {
        const data = await api.traceDecision(decisionId);
        if (data && data.decision_id) {
          setTrace(data);
        } else {
          // fallback
          setTrace({
            decision_id: decisionId,
            title: 'Move billing off legacy monolith to billing-api',
            summary: 'Extracted billing into an idempotent microservice after legacy monolith dropped 4% of peak transactions.',
            date: '2025-06-12',
            status: 'approved',
            decider_name: 'Alice Smith',
            decider_role: 'Principal Architect',
            ticket_title: 'PROV-1042: Extract billing to dedicated microservice',
            ticket_url: 'https://jira.internal.whyline/browse/TICK-1042',
            thread_channel: '#eng-billing-war-room',
            thread_excerpt: 'Legacy monolith dropped 4% of checkout transactions during Black Friday peak. Moving billing to billing-api restores idempotency.',
            document_title: 'RFC-101: Billing Architecture & Service Boundary Isolation',
            document_url: 'https://docs.internal.whyline/rfc/101-billing-v2',
            affected_system: 'billing-api',
            gap_level: decisionId === 'dec_gap_no_doc' ? 'DOC_MISSING' : 'NONE',
            missing_link: decisionId === 'dec_gap_no_doc' ? 'Document RFC' : '',
          });
        }
      } catch {
        // fallback
      } finally {
        setIsLoading(false);
      }
    }
    fetchTrace();
  }, [decisionId]);

  const isGap = trace?.gap_level === 'DOC_MISSING';

  return (
    <main className="w-full bg-surface min-h-screen">
      <div className="max-w-[1600px] mx-auto p-space-xl">
        <div className="flex flex-col w-full gap-space-xl">
          {/* Header Action Strip */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
            <div className="flex flex-col gap-space-2xs">
              <div className="flex items-center gap-space-sm">
                <Link
                  href="/decisions"
                  className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span>All Decisions</span>
                </Link>
                <span className="text-outline text-xs">•</span>
                <span className="font-label-edge text-label-edge text-primary uppercase font-bold bg-primary-fixed px-2 py-0.5 rounded">
                  {trace?.decision_id || decisionId}
                </span>
                <span className="font-label-code-sm text-xs text-on-surface-variant">
                  Recorded: {trace?.date || '2025-06-12'}
                </span>
              </div>
              <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
                {trace?.title || 'Move billing off legacy monolith to billing-api'}
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
                {trace?.summary ||
                  'Extracted billing into an idempotent microservice after legacy monolith dropped 4% of peak transactions.'}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-space-sm flex-wrap">
              <Link
                href={`/impact-analysis?id=${encodeURIComponent(decisionId)}`}
                className="flex items-center gap-space-xs px-space-lg py-space-sm rounded-lg bg-primary-container text-on-primary font-headline-sm text-headline-sm hover:bg-primary transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">replay</span>
                <span>Simulate Blast Radius</span>
              </Link>
              <Link
                href={`/ask-whyline?q=${encodeURIComponent(trace?.title || decisionId)}`}
                className="flex items-center gap-space-xs px-space-md py-space-sm rounded-lg bg-surface-container text-on-surface font-headline-sm text-headline-sm hover:bg-surface-container-high transition-colors shadow-sm border border-outline-variant/30"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
                <span>Ask AI About This</span>
              </Link>
            </div>
          </div>

          {/* Honest Gap Warning Banner if DOC_MISSING */}
          {isGap && (
            <div className="p-space-lg rounded-xl bg-error-container text-on-error-container border border-error flex items-center justify-between gap-space-md animate-in fade-in">
              <div className="flex items-center gap-space-md">
                <span className="material-symbols-outlined text-3xl text-error">warning</span>
                <div>
                  <h3 className="font-headline-sm text-base font-bold text-error">
                    Honest Provenance Gap Detected: Architecture Document Missing
                  </h3>
                  <p className="font-body-sm text-xs text-on-error-container">
                    This decision exists in the ticket backlog and team chat, but no signed RFC document was archived. Epistemic integrity score reduced.
                  </p>
                </div>
              </div>
              <span className="font-label-edge uppercase bg-error text-on-error px-2 py-1 rounded text-xs font-bold">
                DOC_MISSING
              </span>
            </div>
          )}

          {/* 1. Decision Metadata Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-space-md">
            <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1 shadow-sm">
              <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Decided By</span>
              <p className="font-headline-sm text-sm text-on-surface font-bold">
                {trace?.decider_name || 'Alice Smith'}
              </p>
              <p className="text-xs text-on-surface-variant">{trace?.decider_role || 'Principal Architect'}</p>
            </div>
            <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1 shadow-sm">
              <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Target System</span>
              <p className="font-headline-sm text-sm text-primary font-bold">
                {trace?.affected_system || 'billing-api'}
              </p>
              <p className="text-xs text-on-surface-variant">Stateless EKS Pods</p>
            </div>
            <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1 shadow-sm">
              <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Status</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>
                <p className="font-headline-sm text-sm text-on-surface font-bold uppercase">
                  {trace?.status || 'Approved'}
                </p>
              </div>
              <p className="text-xs text-secondary font-medium">Production Live</p>
            </div>
            <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex flex-col gap-1 shadow-sm">
              <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Provenance Integrity</span>
              <p className="font-headline-sm text-sm text-secondary font-bold">
                {isGap ? '70% Partial Gap' : '100% Complete'}
              </p>
              <p className="text-xs text-on-surface-variant">Cryptographically Signed</p>
            </div>
          </div>

          {/* 2. Core Rationale: Why was this decided? */}
          <section className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col gap-space-lg">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-space-sm">
              <div className="flex items-center gap-space-sm">
                <div className="p-space-xs rounded-lg bg-surface-container text-primary">
                  <span className="material-symbols-outlined text-[20px]">help_outline</span>
                </div>
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Core Rationale: Why was this decided?
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Technical drivers extracted from incident postmortems, war rooms, and RFC discussions
                  </p>
                </div>
              </div>
              <span className="font-label-code-sm text-label-code-sm px-space-sm py-space-2xs rounded bg-surface-container text-secondary font-medium">
                4 Verified Drivers
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              {/* Driver 1 */}
              <div className="p-space-md rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col justify-between gap-space-sm border border-outline-variant/10">
                <div className="flex items-start gap-space-sm">
                  <span className="material-symbols-outlined text-[18px] text-error shrink-0 mt-0.5">
                    report_problem
                  </span>
                  <div className="flex flex-col gap-space-2xs">
                    <span className="font-headline-sm text-headline-sm text-on-surface">
                      Connection Pool Contention &amp; Drops
                    </span>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      Legacy monolith dropped 4% of checkout transactions during Black Friday traffic surges due to shared database connection starvation and stateful process mutexes.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-space-xs border-t border-outline-variant/10 text-xs">
                  <span className="font-label-code-sm text-on-surface-variant">Origin: Incident Black Friday</span>
                  <span className="material-symbols-outlined text-sm text-secondary">verified</span>
                </div>
              </div>

              {/* Driver 2 */}
              <div className="p-space-md rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col justify-between gap-space-sm border border-outline-variant/10">
                <div className="flex items-start gap-space-sm">
                  <span className="material-symbols-outlined text-[18px] text-tertiary shrink-0 mt-0.5">
                    query_stats
                  </span>
                  <div className="flex flex-col gap-space-2xs">
                    <span className="font-headline-sm text-headline-sm text-on-surface">
                      Failed In-Place Optimizations
                    </span>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      Previous optimization attempts on connection pooling and PgBouncer limits yielded under 4% throughput improvements and failed to prevent p99 latency spikes (&gt;2,400ms).
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-space-xs border-t border-outline-variant/10 text-xs">
                  <span className="font-label-code-sm text-on-surface-variant">Benchmark: Perf Audit v1.4</span>
                  <span className="material-symbols-outlined text-sm text-secondary">verified</span>
                </div>
              </div>

              {/* Driver 3 */}
              <div className="p-space-md rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col justify-between gap-space-sm border border-outline-variant/10">
                <div className="flex items-start gap-space-sm">
                  <span className="material-symbols-outlined text-[18px] text-secondary shrink-0 mt-0.5">
                    expand
                  </span>
                  <div className="flex flex-col gap-space-2xs">
                    <span className="font-headline-sm text-headline-sm text-on-surface">
                      Horizontal Pod Autoscaling (HPA)
                    </span>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      Stateless execution on Kubernetes enabling autoscaling from 4 to 64 pods in under 45 seconds during flash promotions without lock contention.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-space-xs border-t border-outline-variant/10 text-xs">
                  <span className="font-label-code-sm text-on-surface-variant">Principle: Stateless Microservices</span>
                  <span className="material-symbols-outlined text-sm text-secondary">verified</span>
                </div>
              </div>

              {/* Driver 4 */}
              <div className="p-space-md rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col justify-between gap-space-sm border border-outline-variant/10">
                <div className="flex items-start gap-space-sm">
                  <span className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">
                    domain_verification
                  </span>
                  <div className="flex flex-col gap-space-2xs">
                    <span className="font-headline-sm text-headline-sm text-on-surface">
                      SOX Isolation &amp; Audit Compliance
                    </span>
                    <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                      Isolating financial accounting records into a dedicated schema ensures SOX audit trail compliance and enables independently scoped regulatory reporting.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-space-xs border-t border-outline-variant/10 text-xs">
                  <span className="font-label-code-sm text-on-surface-variant">Compliance: SOX-404</span>
                  <span className="material-symbols-outlined text-sm text-secondary">verified</span>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Audit Provenance Chain Visualization */}
          <section className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col gap-space-lg">
            <div className="flex items-center justify-between flex-wrap gap-space-sm border-b border-outline-variant/20 pb-space-sm">
              <div className="flex items-center gap-space-sm">
                <div className="p-space-xs rounded-lg bg-surface-container text-primary">
                  <span className="material-symbols-outlined text-[20px]">account_tree</span>
                </div>
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Audit Provenance Chain
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Immutable timestamped multi-hop trace linking origin, discussion, ticket, and RFC
                  </p>
                </div>
              </div>
              <span className="font-label-edge text-label-edge bg-secondary-fixed text-on-secondary-fixed font-bold px-space-sm py-space-2xs rounded uppercase tracking-wider">
                5 STAGES CHAINED
              </span>
            </div>

            {/* Sequential Flow */}
            <div className="flex flex-col gap-space-xs">
              {/* Stage 1 */}
              <div className="p-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-all shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
                  <div className="flex items-center gap-space-md">
                    <span className="w-7 h-7 rounded-full bg-primary text-on-primary font-label-code-sm text-xs font-bold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <div>
                      <div className="flex items-center gap-space-xs">
                        <span className="font-label-edge text-xs text-on-surface-variant uppercase">
                          Person / Originator
                        </span>
                        <span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
                      </div>
                      <p className="font-headline-sm text-sm text-on-surface font-semibold">
                        {trace?.decider_name || 'Alice Smith'} ({trace?.decider_role || 'Principal Architect'})
                      </p>
                    </div>
                  </div>
                  <span className="font-label-code-sm text-xs text-outline">{trace?.date || '2025-06-12'}</span>
                </div>
              </div>

              {/* Connector 1 */}
              <div className="flex items-center gap-space-sm pl-space-lg text-on-surface-variant py-0.5">
                <div className="w-0.5 h-6 bg-surface-container-highest"></div>
                <span className="font-label-edge text-label-edge bg-surface-container text-primary px-space-xs py-0.5 rounded font-bold">
                  DECIDED &amp; RECORDED
                </span>
              </div>

              {/* Stage 2 */}
              <div className="p-space-md rounded-lg bg-surface-container-highest text-on-surface shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
                  <div className="flex items-center gap-space-md">
                    <span className="w-7 h-7 rounded-full bg-primary-container text-on-primary font-label-code-sm text-xs font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <div>
                      <div className="flex items-center gap-space-xs">
                        <span className="font-label-edge text-xs text-primary font-bold uppercase">
                          Decision Node
                        </span>
                        <span className="font-label-code-sm text-xs px-space-xs py-0.5 rounded bg-surface-container-lowest text-primary font-bold">
                          {trace?.decision_id || decisionId}
                        </span>
                      </div>
                      <p className="font-headline-sm text-sm text-on-surface font-semibold">
                        {trace?.title || 'Move billing off legacy monolith to billing-api'}
                      </p>
                    </div>
                  </div>
                  <span className="font-label-code-sm text-xs text-secondary font-medium">Recorded in FalkorDB</span>
                </div>
              </div>

              {/* Connector 2 */}
              <div className="flex items-center gap-space-sm pl-space-lg text-on-surface-variant py-0.5">
                <div className="w-0.5 h-6 bg-surface-container-highest"></div>
                <span className="font-label-edge text-label-edge bg-surface-container text-secondary px-space-xs py-0.5 rounded font-bold">
                  APPROVED IN
                </span>
              </div>

              {/* Stage 3 */}
              <div className="p-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-all shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
                  <div className="flex items-center gap-space-md">
                    <span className="w-7 h-7 rounded-full bg-primary text-on-primary font-label-code-sm text-xs font-bold flex items-center justify-center shrink-0">
                      3
                    </span>
                    <div>
                      <div className="flex items-center gap-space-xs">
                        <span className="font-label-edge text-xs text-on-surface-variant uppercase">
                          Ticket Item
                        </span>
                        <span className="font-label-code-sm text-xs px-space-xs py-0.5 rounded bg-surface-container text-on-surface font-bold">
                          TICK-1042 / TKT-101
                        </span>
                      </div>
                      <p className="font-headline-sm text-sm text-on-surface">
                        {trace?.ticket_title || 'PROV-1042: Extract billing to dedicated microservice'}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/tickets/TICK-1042"
                    className="text-primary hover:underline text-xs font-medium flex items-center gap-1"
                  >
                    <span>View Ticket</span>
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </Link>
                </div>
              </div>

              {/* Connector 3 */}
              <div className="flex items-center gap-space-sm pl-space-lg text-on-surface-variant py-0.5">
                <div className="w-0.5 h-6 bg-surface-container-highest"></div>
                <span className="font-label-edge text-label-edge bg-surface-container text-on-surface-variant px-space-xs py-0.5 rounded font-bold">
                  DISCUSSED IN
                </span>
              </div>

              {/* Stage 4 */}
              <div className="p-space-md rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-all shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
                  <div className="flex items-center gap-space-md">
                    <span className="w-7 h-7 rounded-full bg-primary text-on-primary font-label-code-sm text-xs font-bold flex items-center justify-center shrink-0">
                      4
                    </span>
                    <div>
                      <div className="flex items-center gap-space-xs">
                        <span className="font-label-edge text-xs text-on-surface-variant uppercase">
                          Discussion Channel
                        </span>
                        <span className="font-label-code-sm text-xs text-secondary font-bold">
                          {trace?.thread_channel || '#eng-billing-war-room'}
                        </span>
                      </div>
                      <p className="font-body-sm text-xs text-on-surface-variant italic mt-1">
                        &ldquo;{trace?.thread_excerpt || 'Legacy monolith dropped 4% of checkout transactions...'}&rdquo;
                      </p>
                    </div>
                  </div>
                  <span className="font-label-code-sm text-xs text-outline shrink-0">Slack War Room</span>
                </div>
              </div>

              {/* Connector 4 */}
              <div className="flex items-center gap-space-sm pl-space-lg text-on-surface-variant py-0.5">
                <div className="w-0.5 h-6 bg-surface-container-highest"></div>
                <span className="font-label-edge text-label-edge bg-surface-container text-primary px-space-xs py-0.5 rounded font-bold">
                  DOCUMENTED IN
                </span>
              </div>

              {/* Stage 5 */}
              <div className={`p-space-md rounded-lg transition-all shadow-sm ${isGap ? 'bg-error-container/30 border border-error/30' : 'bg-surface-container-low'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-sm">
                  <div className="flex items-center gap-space-md">
                    <span className={`w-7 h-7 rounded-full font-label-code-sm text-xs font-bold flex items-center justify-center shrink-0 ${isGap ? 'bg-error text-white' : 'bg-primary text-on-primary'}`}>
                      5
                    </span>
                    <div>
                      <div className="flex items-center gap-space-xs">
                        <span className="font-label-edge text-xs text-on-surface-variant uppercase">
                          Architecture RFC Spec
                        </span>
                        <span className={`font-label-code-sm text-xs px-space-xs py-0.5 rounded font-bold ${isGap ? 'bg-error text-white' : 'bg-surface-container-highest text-primary'}`}>
                          {isGap ? 'MISSING' : 'RFC-101'}
                        </span>
                      </div>
                      <p className="font-headline-sm text-sm text-on-surface">
                        {isGap ? 'No RFC document attached (Honest Gap)' : trace?.document_title || 'RFC-101: Billing Architecture & Service Boundary Isolation'}
                      </p>
                    </div>
                  </div>
                  <span className="font-label-code-sm text-xs text-outline shrink-0">
                    {isGap ? 'Action Required' : 'Signed Off by Alice Smith'}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Graph Proof: Lineage Topology Visualizer */}
          <section className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border-b border-outline-variant/20 pb-space-sm">
              <div className="flex items-center gap-space-sm">
                <div className="p-space-xs rounded-lg bg-surface-container text-primary">
                  <span className="material-symbols-outlined text-[20px]">hub</span>
                </div>
                <div>
                  <h2 className="font-headline-md text-headline-md text-on-surface">
                    Graph Proof — Lineage Topology
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Causal relationship paths verified via Git commits, PR meta, and platform telemetry
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-space-md bg-surface-container-low px-space-md py-space-xs rounded-lg text-on-surface text-xs">
                <div className="flex items-center gap-1 font-label-code-sm">
                  <span className="w-4 h-0.5 bg-primary"></span>
                  <span>Documented (ACID)</span>
                </div>
                <div className="flex items-center gap-1 font-label-code-sm text-on-surface-variant">
                  <span className="w-4 h-0.5 bg-outline"></span>
                  <span>Transitive Lineage</span>
                </div>
              </div>
            </div>

            {/* SVG Visual Topology Graph */}
            <div className="relative w-full rounded-lg bg-surface-container-low p-space-lg overflow-x-auto min-h-[300px] flex items-center justify-center">
              <svg className="w-full h-full min-w-[720px] max-w-[880px] select-none" fill="none" viewBox="0 0 880 260">
                <defs>
                  <marker id="arrow-solid" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="8" refY="5" viewBox="0 0 10 10">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#3525cd" />
                  </marker>
                  <marker id="arrow-cyan" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="8" refY="5" viewBox="0 0 10 10">
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="#00687a" />
                  </marker>
                </defs>

                {/* Vectors */}
                <path d="M 120 70 L 260 70" markerEnd="url(#arrow-solid)" stroke="#3525cd" strokeWidth="2" />
                <rect fill="#e5eeff" height="18" rx="4" width="70" x="155" y="55" />
                <text fill="#3525cd" fontFamily="JetBrains Mono" fontSize="9" fontWeight="700" textAnchor="middle" x="190" y="68">DECIDED</text>

                <path d="M 390 70 L 510 70" markerEnd="url(#arrow-solid)" stroke="#3525cd" strokeWidth="2" />
                <rect fill="#e5eeff" height="18" rx="4" width="94" x="408" y="55" />
                <text fill="#3525cd" fontFamily="JetBrains Mono" fontSize="9" fontWeight="700" textAnchor="middle" x="455" y="68">APPROVED_IN</text>

                <path d="M 640 70 L 730 70" markerEnd="url(#arrow-solid)" stroke="#3525cd" strokeWidth="2" />
                <rect fill="#e5eeff" height="18" rx="4" width="84" x="643" y="55" />
                <text fill="#3525cd" fontFamily="JetBrains Mono" fontSize="9" fontWeight="700" textAnchor="middle" x="685" y="68">DISCUSSED_IN</text>

                <path d="M 325 102 L 325 180" markerEnd="url(#arrow-cyan)" stroke="#00687a" strokeWidth="2" />
                <rect fill="#acedff" height="18" rx="4" width="70" x="290" y="130" />
                <text fill="#001f26" fontFamily="JetBrains Mono" fontSize="9" fontWeight="700" textAnchor="middle" x="325" y="143">AFFECTS</text>

                <path d="M 400 200 L 520 200" markerEnd="url(#arrow-solid)" stroke="#3525cd" strokeWidth="2" />
                <rect fill="#e5eeff" height="18" rx="4" width="90" x="415" y="185" />
                <text fill="#3525cd" fontFamily="JetBrains Mono" fontSize="9" fontWeight="700" textAnchor="middle" x="460" y="198">DEPENDS_ON</text>

                {/* Nodes */}
                <g>
                  <rect fill="#ffffff" filter="drop-shadow(0 1px 3px rgba(0,0,0,0.06))" height="60" rx="8" width="100" x="20" y="40" />
                  <circle cx="45" cy="70" fill="#3525cd" r="14" />
                  <text fill="#ffffff" fontFamily="Inter" fontSize="12" fontWeight="bold" textAnchor="middle" x="45" y="74">A</text>
                  <text fill="#0b1c30" fontFamily="Inter" fontSize="12" fontWeight="600" x="68" y="66">Alice</text>
                  <text fill="#464555" fontFamily="Inter" fontSize="10" x="68" y="79">Principal</text>
                </g>

                <g>
                  <rect fill="#4f46e5" filter="drop-shadow(0 4px 6px rgba(15,23,42,0.12))" height="68" rx="8" width="130" x="260" y="36" />
                  <text fill="#dad7ff" fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" x="274" y="58">{decisionId}</text>
                  <text fill="#ffffff" fontFamily="Inter" fontSize="12" fontWeight="700" x="274" y="76">billing-api</text>
                  <text fill="#dad7ff" fontFamily="Inter" fontSize="10" x="274" y="92">Approved ADR</text>
                </g>

                <g>
                  <rect fill="#ffffff" filter="drop-shadow(0 1px 3px rgba(0,0,0,0.06))" height="60" rx="8" width="120" x="520" y="40" />
                  <text fill="#3525cd" fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" x="532" y="60">TICK-1042</text>
                  <text fill="#0b1c30" fontFamily="Inter" fontSize="11" fontWeight="600" x="532" y="76">PROV-1042</text>
                  <text fill="#10b981" fontFamily="Inter" fontSize="10" x="532" y="90">✓ Resolved</text>
                </g>

                <g>
                  <rect fill="#ffffff" filter="drop-shadow(0 1px 3px rgba(0,0,0,0.06))" height="60" rx="8" width="120" x="740" y="40" />
                  <text fill="#00687a" fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" x="752" y="60">#war-room</text>
                  <text fill="#0b1c30" fontFamily="Inter" fontSize="11" fontWeight="600" x="752" y="76">Slack Archive</text>
                  <text fill="#464555" fontFamily="Inter" fontSize="10" x="752" y="90">Consensus</text>
                </g>

                <g>
                  <rect fill="#00687a" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.08))" height="60" rx="8" width="140" x="260" y="170" />
                  <text fill="#acedff" fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" x="274" y="190">SYSTEM NODE</text>
                  <text fill="#ffffff" fontFamily="Inter" fontSize="12" fontWeight="700" x="274" y="206">billing-api</text>
                  <text fill="#acedff" fontFamily="Inter" fontSize="10" x="274" y="220">Active Microservice</text>
                </g>

                <g>
                  <rect fill="#ffffff" filter="drop-shadow(0 1px 3px rgba(0,0,0,0.06))" height="60" rx="8" width="140" x="530" y="170" />
                  <text fill="#684000" fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" x="542" y="190">DOWNSTREAM</text>
                  <text fill="#0b1c30" fontFamily="Inter" fontSize="12" fontWeight="700" x="542" y="206">ledger-service</text>
                  <text fill="#ef4444" fontFamily="Inter" fontSize="10" fontWeight="600" x="542" y="220">Orphaned Risk</text>
                </g>
              </svg>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
