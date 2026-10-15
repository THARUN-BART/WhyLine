'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function TicketsListPage() {
  const [tickets, setTickets] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.queryGraph(
          `MATCH (t:Ticket)
           OPTIONAL MATCH (d:Decision)-[:APPROVED_IN]->(t)
           RETURN t.id AS id, t.title AS title, t.url AS url, d.id AS decision_id, d.title AS decision_title`
        );
        if (res && res.records) {
          setTickets(res.records);
        }
      } catch {
        // fallback
      }
    }
    load();
  }, []);

  return (
    <main className="w-full bg-surface min-h-screen">
      <div className="max-w-[1600px] mx-auto p-space-xl flex flex-col gap-space-xl">
        <div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface">Engineering Tickets &amp; Provenance</h1>
          <p className="font-body-md text-on-surface-variant">
            Cross-referenced Jira tasks tied to architectural decisions and war room discussions
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-label-code-sm border-b border-outline-variant/20">
              <tr>
                <th className="p-4">Ticket ID</th>
                <th className="p-4">Title</th>
                <th className="p-4">Linked Decision ADR</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="p-4 font-label-code-sm text-primary font-bold">{t.id}</td>
                  <td className="p-4 font-headline-sm text-on-surface font-semibold">{t.title}</td>
                  <td className="p-4">
                    {t.decision_id ? (
                      <Link
                        href={`/decisions/${t.decision_id}`}
                        className="font-label-code-sm text-primary hover:underline"
                      >
                        {t.decision_id} ({t.decision_title?.slice(0, 30)}...)
                      </Link>
                    ) : (
                      <span className="text-outline font-label-code-sm">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded font-label-edge bg-secondary-fixed text-on-secondary-fixed uppercase font-bold text-[10px]">
                      RESOLVED
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      href={`/tickets/${t.id}`}
                      className="text-primary hover:underline font-semibold"
                    >
                      View Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
