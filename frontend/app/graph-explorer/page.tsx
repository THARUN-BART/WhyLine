'use client';

import React, { useState, useEffect } from 'react';
import { api, GraphStats } from '@/lib/api';

export default function GraphExplorerPage() {
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [query, setQuery] = useState(
    'MATCH (s:System) RETURN s.id AS id, s.name AS name, s.criticality AS criticality LIMIT 10'
  );
  const [result, setResult] = useState<{ columns: string[]; records: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadStats() {
      try {
        const s = await api.getGraphStats();
        setStats(s);
        runCypher();
      } catch {
        // fallback
      }
    }
    loadStats();
  }, []);

  const runCypher = async (cypherOverride?: string) => {
    const q = cypherOverride || query;
    setIsLoading(true);
    try {
      const res = await api.queryGraph(q);
      setResult(res);
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  const sampleQueries = [
    {
      title: 'Monitored Systems & Criticality',
      cypher: 'MATCH (s:System) RETURN s.id AS id, s.name AS name, s.criticality AS criticality LIMIT 10',
    },
    {
      title: 'Decisions and Affected Services',
      cypher:
        'MATCH (d:Decision)-[:AFFECTS]->(s:System) RETURN d.id AS decision_id, d.title AS title, s.name AS affected_system LIMIT 10',
    },
    {
      title: 'Decider Authorship Hierarchy',
      cypher:
        'MATCH (p:Person)-[:DECIDED]->(d:Decision) RETURN p.name AS decider, p.role AS role, d.title AS decision LIMIT 10',
    },
    {
      title: 'System Dependencies Mesh',
      cypher:
        'MATCH (s1:System)-[:DEPENDS_ON]->(s2:System) RETURN s1.name AS caller, s2.name AS dependency LIMIT 10',
    },
  ];

  return (
    <main className="w-full bg-surface min-h-screen">
      <div className="max-w-[1600px] mx-auto p-space-xl flex flex-col gap-space-xl">
        <div className="flex flex-col gap-space-2xs">
          <div className="flex items-center gap-space-xs text-secondary font-label-edge uppercase tracking-wider font-bold">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            FalkorDB Graph Engine
          </div>
          <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight">
            Graph Explorer &amp; Cypher Console
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            Direct real-time query interface executing OpenCypher queries against FalkorDB.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between shadow-sm">
            <div>
              <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Total Nodes</span>
              <p className="font-headline-xl text-2xl font-bold text-primary mt-1">
                {stats ? stats.total_nodes : 0}
              </p>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary/40">hub</span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between shadow-sm">
            <div>
              <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Total Edges</span>
              <p className="font-headline-xl text-2xl font-bold text-secondary mt-1">
                {stats ? stats.total_edges : 0}
              </p>
            </div>
            <span className="material-symbols-outlined text-3xl text-secondary/40">alt_route</span>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 flex items-center justify-between shadow-sm">
            <div>
              <span className="font-label-code-sm text-xs text-outline uppercase font-semibold">Database Engine</span>
              <p className="font-headline-xl text-base font-bold text-on-surface mt-1">
                FalkorDB (RedisGraph)
              </p>
            </div>
            <span className="material-symbols-outlined text-3xl text-secondary">verified</span>
          </div>
        </div>

        {/* Sample Queries */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="font-label-edge text-xs text-outline uppercase whitespace-nowrap">Presets:</span>
          {sampleQueries.map((sq, i) => (
            <button
              key={i}
              onClick={() => {
                setQuery(sq.cypher);
                runCypher(sq.cypher);
              }}
              className="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface hover:bg-surface-container transition-colors whitespace-nowrap shadow-sm font-medium"
            >
              {sq.title}
            </button>
          ))}
        </div>

        {/* Cypher Console Input */}
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-label-code-sm text-xs text-outline uppercase font-bold">
              Cypher Query Editor
            </span>
            <button
              onClick={() => runCypher()}
              disabled={isLoading}
              className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">play_arrow</span>
              <span>{isLoading ? 'Executing...' : 'Run Query'}</span>
            </button>
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            className="w-full p-3 rounded-lg bg-surface-container-low font-label-code-md text-xs text-on-surface outline-none border border-outline-variant/20 focus:border-primary"
          />
        </div>

        {/* Results Table */}
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col gap-2 overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
            <span className="font-headline-sm text-xs font-bold text-on-surface">Query Result</span>
            <span className="font-label-code-sm text-xs text-outline">
              {result?.records?.length || 0} Records Returned
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-container-low text-on-surface-variant font-label-code-sm uppercase">
                <tr>
                  {result?.columns?.map((c) => (
                    <th key={c} className="p-2.5 font-bold">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 font-label-code-sm">
                {result?.records?.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-container-low">
                    {result.columns.map((col) => (
                      <td key={col} className="p-2.5 text-on-surface">
                        {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
