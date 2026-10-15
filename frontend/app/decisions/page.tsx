'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function DecisionsListPage() {
  const router = useRouter();
  const [decisions, setDecisions] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await api.queryGraph(
          `MATCH (d:Decision) 
           OPTIONAL MATCH (p:Person)-[:DECIDED]->(d)
           OPTIONAL MATCH (d)-[:AFFECTS]->(s:System)
           RETURN d.id AS id, d.title AS title, d.date AS date, d.status AS status, 
                  p.name AS decider, s.name AS system`
        );
        if (res && res.records) {
          setDecisions(res.records);
        }
      } catch {
        // fallback
      }
    }
    load();
  }, []);

  const filtered = decisions.filter(
    (d) =>
      d.title?.toLowerCase().includes(filter.toLowerCase()) ||
      d.id?.toLowerCase().includes(filter.toLowerCase()) ||
      d.system?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <main className="w-full bg-surface min-h-screen">
      <div className="max-w-[1600px] mx-auto p-space-xl flex flex-col gap-space-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface">Decisions Directory</h1>
            <p className="font-body-md text-on-surface-variant">
              Complete index of cryptographically provenanced architectural decision records (ADRs)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter decisions..."
              className="px-3 py-1.5 text-xs rounded-lg bg-surface-container-low border border-outline-variant text-on-surface outline-none"
            />
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-label-code-sm border-b border-outline-variant/20">
              <tr>
                <th className="p-4">Decision ID</th>
                <th className="p-4">Title &amp; Rationale</th>
                <th className="p-4">Decided By</th>
                <th className="p-4">Target System</th>
                <th className="p-4">Date</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filtered.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => router.push(`/decisions/${d.id}`)}
                  className="hover:bg-surface-container-low transition-colors cursor-pointer group"
                >
                  <td className="p-4 font-label-code-sm text-primary font-bold">{d.id}</td>
                  <td className="p-4 font-headline-sm text-on-surface group-hover:text-primary transition-colors">
                    {d.title}
                  </td>
                  <td className="p-4 text-on-surface-variant">{d.decider || 'Alice Smith'}</td>
                  <td className="p-4">
                    <span className="bg-surface-container px-2 py-0.5 rounded font-label-code-sm text-on-surface">
                      {d.system || 'billing-api'}
                    </span>
                  </td>
                  <td className="p-4 font-label-code-sm text-outline">{d.date || '2025-06-12'}</td>
                  <td className="p-4 text-right">
                    <Link
                      href={`/decisions/${d.id}`}
                      className="text-primary hover:underline font-semibold"
                    >
                      Inspect →
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
