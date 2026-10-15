'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = (params?.id as string) || 'TICK-1042';

  const [ticketData, setTicketData] = useState<{
    id: string;
    title: string;
    url?: string;
    priority: string;
    status: string;
    assignee: string;
    decision_id: string;
    decision_title: string;
  }>({
    id: ticketId,
    title: 'PROV-1042: Extract billing to dedicated microservice',
    url: 'https://jira.internal.whyline/browse/TICK-1042',
    priority: 'Critical P0',
    status: 'Resolved',
    assignee: 'Alice Smith',
    decision_id: 'dec_billing_v2',
    decision_title: 'Move billing off legacy monolith to billing-api',
  });

  useEffect(() => {
    async function loadTicket() {
      try {
        const ticket = await api.getTicketById(ticketId);
        if (ticket) {
          setTicketData((prev) => ({
            ...prev,
            id: ticket.id || ticketId,
            title: ticket.title || prev.title,
            url: ticket.url || prev.url,
            priority: ticket.priority || prev.priority,
            status: ticket.status || prev.status,
            decision_id: ticket.decision_id || prev.decision_id,
            decision_title: ticket.decision_title || prev.decision_title,
          }));
          return;
        }
      } catch {
        // Fallback to Cypher graph query
      }

      try {
        const res = await api.queryGraph(
          `MATCH (t:Ticket {id: '${ticketId}'})
           OPTIONAL MATCH (d:Decision)-[:APPROVED_IN]->(t)
           RETURN t.id AS id, t.title AS title, t.url AS url, d.id AS decision_id, d.title AS decision_title`
        );
        if (res && res.records && res.records.length > 0) {
          const rec = res.records[0];
          setTicketData((prev) => ({
            ...prev,
            id: rec.id || ticketId,
            title: rec.title || prev.title,
            url: rec.url || prev.url,
            decision_id: rec.decision_id || prev.decision_id,
            decision_title: rec.decision_title || prev.decision_title,
          }));
        }
      } catch {
        // fallback
      }
    }
    loadTicket();
  }, [ticketId]);

  return (
    <main className="w-full bg-surface min-h-screen">
      <div className="max-w-[1600px] mx-auto p-space-xl flex flex-col gap-space-xl">
        {/* Header Breadcrumb & Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-col gap-space-2xs">
            <div className="flex items-center gap-space-sm">
              <Link href="/tickets" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>All Tickets</span>
              </Link>
              <span className="text-outline text-xs">•</span>
              <span className="font-label-edge text-label-edge bg-primary-fixed text-primary px-2 py-0.5 rounded font-bold uppercase">
                {ticketData.id}
              </span>
              <span className="font-label-edge text-xs bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded font-bold uppercase">
                {ticketData.status}
              </span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
              {ticketData.title}
            </h1>
            <p className="font-body-md text-on-surface-variant max-w-3xl">
              Engineering migration task establishing isolated billing service boundary and idempotent RPC endpoints.
            </p>
          </div>

          <div className="flex items-center gap-space-sm flex-wrap">
            <Link
              href={`/decisions/${ticketData.decision_id}`}
              className="px-space-md py-space-xs rounded-lg bg-primary-container text-on-primary font-headline-sm text-xs font-bold hover:bg-primary transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">alt_route</span>
              <span>Inspect Linked Decision ADR</span>
            </Link>
            <a
              href={ticketData.url || '#'}
              target="_blank"
              rel="noreferrer"
              className="px-space-md py-space-xs rounded-lg bg-surface-container text-on-surface font-headline-sm text-xs font-semibold hover:bg-surface-container-high transition-colors shadow-sm flex items-center gap-1.5 border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              <span>Open in Jira</span>
            </a>
          </div>
        </div>

        {/* Linked Decision Hero Card */}
        <div className="p-space-lg rounded-xl bg-surface-container-lowest border-2 border-primary/30 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
          <div className="flex items-start gap-space-md">
            <div className="p-space-xs rounded-lg bg-primary-fixed text-primary flex items-center justify-center shrink-0 mt-1">
              <span className="material-symbols-outlined text-[24px]">alt_route</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-label-edge text-xs bg-primary-container text-on-primary px-1.5 py-0.5 rounded font-bold uppercase">
                  Linked Decision Node
                </span>
                <span className="font-label-code-sm text-xs text-primary font-bold">{ticketData.decision_id}</span>
              </div>
              <h3 className="font-headline-sm text-base font-bold text-on-surface mt-1">
                {ticketData.decision_title}
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                Cryptographically signed architectural ADR in FalkorDB with 100% verified provenance.
              </p>
            </div>
          </div>
          <Link
            href={`/decisions/${ticketData.decision_id}`}
            className="px-space-md py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm whitespace-nowrap"
          >
            View Decision Provenance →
          </Link>
        </div>

        {/* Description Section with Diagnostic Latency Sparkline */}
        <section className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-[20px]">subject</span>
              <h3 className="font-headline-md text-headline-md text-on-surface">Description</h3>
            </div>
            <span className="font-label-code-sm text-xs text-outline">Markdown &amp; Metrics Enabled</span>
          </div>

          <p className="font-body-lg text-body-lg text-on-surface leading-relaxed">
            Legacy billing is causing high latency and occasional failures during peak traffic. Database connection pooling remains a bottleneck despite recent indexing and replica additions. We need to complete migration to the new{' '}
            <code className="font-label-code-sm bg-surface-container-high text-primary px-1.5 py-0.5 rounded font-bold">
              billing-api
            </code>{' '}
            microservice to restore idempotency and isolate financial accounting.
          </p>

          {/* Inline Latency Sparkline */}
          <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col md:flex-row items-center justify-between gap-space-md border border-outline-variant/10">
            <div className="flex items-center gap-space-md">
              <div className="p-space-sm rounded bg-surface-container-highest text-secondary">
                <span className="material-symbols-outlined text-[20px]">speed</span>
              </div>
              <div>
                <p className="font-headline-sm text-sm text-on-surface font-semibold">P99 Latency Differential</p>
                <p className="font-body-sm text-xs text-on-surface-variant">legacy-billing (480ms) vs. billing-api (32ms)</p>
              </div>
            </div>
            <div className="flex items-center gap-space-sm">
              <svg className="w-36 h-10 overflow-visible text-secondary" fill="none" viewBox="0 0 140 40">
                <path d="M 0 35 L 20 32 L 40 28 L 60 30 L 80 14 L 100 8 L 120 4 L 140 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                <circle cx="140" cy="2" fill="currentColor" r="3" />
              </svg>
              <div className="text-right">
                <span className="font-label-code-sm text-sm text-secondary font-bold">-93.3%</span>
                <span className="block font-label-edge text-[9px] text-outline uppercase font-bold">PRODUCTION BENCHMARK</span>
              </div>
            </div>
          </div>
        </section>

        {/* Acceptance Criteria Checklist */}
        <section className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-[20px]">task_alt</span>
              <h3 className="font-headline-md text-headline-md text-on-surface">Acceptance Criteria</h3>
            </div>
            <span className="font-label-edge text-[10px] bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded-full font-bold uppercase">
              4 of 4 Completed (100%)
            </span>
          </div>

          <div className="flex flex-col gap-space-sm text-xs">
            <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/10">
              <input checked readOnly className="mt-0.5 w-4 h-4 accent-primary" type="checkbox" />
              <div>
                <span className="font-semibold text-on-surface line-through">
                  billing-api handles 100% of non-recurring checkout transactions
                </span>
                <span className="block text-[11px] text-outline mt-0.5">Verified in canary deploy v2.14.0</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/10">
              <input checked readOnly className="mt-0.5 w-4 h-4 accent-primary" type="checkbox" />
              <div>
                <span className="font-semibold text-on-surface line-through">
                  Zero dropped webhook events during test traffic spikes
                </span>
                <span className="block text-[11px] text-outline mt-0.5">Verified by Chaos Mesh pipeline suite</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/10">
              <input checked readOnly className="mt-0.5 w-4 h-4 accent-primary" type="checkbox" />
              <div>
                <span className="font-semibold text-on-surface line-through">
                  Legacy billing endpoints deprecated and read-only
                </span>
                <span className="block text-[11px] text-outline mt-0.5">WAF rule #8091 enforced at edge</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/10">
              <input checked readOnly className="mt-0.5 w-4 h-4 accent-primary" type="checkbox" />
              <div>
                <span className="font-semibold text-on-surface line-through">
                  Reversal impact analysis verified with payments team
                </span>
                <span className="block text-[11px] text-outline mt-0.5">Signed off in #eng-billing-war-room</span>
              </div>
            </label>
          </div>
        </section>

        {/* Discussion War Room Transcript */}
        <section className="p-space-lg rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-[22px]">forum</span>
              <h3 className="font-headline-md text-headline-md text-on-surface">Discussion Transcript</h3>
              <span className="font-label-code-sm text-xs bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full">
                #eng-billing-war-room
              </span>
            </div>
            <span className="font-label-code-sm text-xs text-secondary flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-sm">sync</span>
              FalkorDB Synced
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-surface-container-low flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-primary">Alice Smith (Principal Architect):</span>
                <span className="text-outline text-[11px]">War Room Day 1</span>
              </div>
              <p className="text-on-surface">
                &ldquo;Legacy monolith dropped 4% of checkout transactions during Black Friday peak. We cannot patch this in-place with PgBouncer.&rdquo;
              </p>
            </div>

            <div className="p-3 rounded-lg bg-surface-container-low flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-secondary">Bob Jones (Staff Engineer):</span>
                <span className="text-outline text-[11px]">War Room Day 1</span>
              </div>
              <p className="text-on-surface">
                &ldquo;Agreed. We tested increasing pool size to 120 connections, but Postgres query lock serialization caused p99 latency to hit 2.8s.&rdquo;
              </p>
            </div>

            <div className="p-3 rounded-lg bg-surface-container-low flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-on-surface">Alice Smith:</span>
                <span className="text-outline text-[11px]">Resolution</span>
              </div>
              <p className="text-on-surface font-medium">
                &ldquo;Moving billing to billing-api restores idempotency. I have authored RFC-101 and signed off ticket PROV-1042.&rdquo;
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
