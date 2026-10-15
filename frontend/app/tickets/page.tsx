'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, Ticket } from '@/lib/api';
import { useUser } from '@/components/UserContext';

export default function TicketsListPage() {
  const { currentUser, isPending } = useUser();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [decisionsList, setDecisionsList] = useState<{ id: string; title: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const [ticketPriority, setTicketPriority] = useState('P2');
  const [ticketDecisionId, setTicketDecisionId] = useState('');
  const [ticketSystemId, setTicketSystemId] = useState('');
  const [ticketUrl, setTicketUrl] = useState('');

  const loadTickets = async () => {
    setIsLoading(true);
    try {
      // 1. Try fetching from the backend tickets API
      const res = await api.getTickets();
      if (res && res.tickets && res.tickets.length > 0) {
        setTickets(res.tickets);
      } else {
        // Fallback to Cypher graph query if tickets table is empty
        const gRes = await api.queryGraph(
          `MATCH (t:Ticket)
           OPTIONAL MATCH (d:Decision)-[:APPROVED_IN]->(t)
           RETURN t.id AS id, t.title AS title, t.url AS url, t.priority AS priority, t.status AS status,
                  d.id AS decision_id, d.title AS decision_title
           LIMIT 50`
        );
        if (gRes && gRes.records) {
          setTickets(gRes.records);
        }
      }
    } catch {
      // Fallback to graph
      try {
        const gRes = await api.queryGraph(
          `MATCH (t:Ticket)
           OPTIONAL MATCH (d:Decision)-[:APPROVED_IN]->(t)
           RETURN t.id AS id, t.title AS title, t.url AS url, t.priority AS priority, t.status AS status,
                  d.id AS decision_id, d.title AS decision_title
           LIMIT 50`
        );
        if (gRes && gRes.records) {
          setTickets(gRes.records);
        }
      } catch {
        // ignore
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();

    // Load available decisions for dropdown selection
    async function loadDecisions() {
      try {
        const res = await api.queryGraph(
          `MATCH (d:Decision) RETURN d.id AS id, d.title AS title ORDER BY d.date DESC LIMIT 20`
        );
        if (res && res.records) {
          setDecisionsList(res.records);
        }
      } catch {
        // ignore
      }
    }
    loadDecisions();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle.trim()) {
      setFeedback({ type: 'error', message: 'Ticket title is required' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const created = await api.createTicket({
        title: ticketTitle.trim(),
        description: ticketDescription.trim() || undefined,
        priority: ticketPriority,
        decision_id: ticketDecisionId.trim() || undefined,
        system_id: ticketSystemId.trim() || undefined,
        url: ticketUrl.trim() || undefined,
      });

      setFeedback({
        type: 'success',
        message: `Ticket ${created.id} ("${created.title}") created successfully!`,
      });

      // Reset form
      setTicketTitle('');
      setTicketDescription('');
      setTicketPriority('P2');
      setTicketDecisionId('');
      setTicketSystemId('');
      setTicketUrl('');
      setIsModalOpen(false);

      // Reload list
      await loadTickets();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to create engineering ticket',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityBadge = (priority?: string) => {
    const p = (priority || 'P2').toUpperCase();
    if (p.includes('P0') || p.includes('CRITICAL')) {
      return 'bg-error-container text-error border-error/30';
    }
    if (p.includes('P1') || p.includes('HIGH')) {
      return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    }
    if (p.includes('P2') || p.includes('MEDIUM')) {
      return 'bg-primary-fixed text-primary border-primary/20';
    }
    return 'bg-surface-container-high text-on-surface-variant border-outline-variant/30';
  };

  return (
    <main className="w-full bg-surface min-h-screen">
      <div className="max-w-[1600px] mx-auto p-space-xl flex flex-col gap-space-xl">
        {/* Header with Title and Create Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
          <div>
            <div className="flex items-center gap-space-xs mb-1">
              <span className="font-label-edge text-label-edge text-primary uppercase font-bold bg-primary-fixed px-space-xs py-space-2xs rounded tracking-widest">
                PROVENANCE TRACKER
              </span>
              <span className="text-xs text-on-surface-variant">Live Jira &amp; ADR Graph</span>
            </div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface">
              Engineering Tickets &amp; Provenance
            </h1>
            <p className="font-body-md text-on-surface-variant">
              Cross-referenced engineering tasks tied directly to architectural decisions, systems, and war room discussions.
            </p>
          </div>

          <div className="flex items-center gap-space-sm">
            <button
              onClick={() => {
                setFeedback(null);
                setIsModalOpen(true);
              }}
              disabled={isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-on-primary font-bold text-xs uppercase tracking-wider shadow hover:bg-surface-tint transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">add_task</span>
              Create Ticket
            </button>
          </div>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`p-space-md rounded-xl text-xs flex items-center justify-between border ${
              feedback.type === 'success'
                ? 'bg-secondary-fixed/40 border-secondary/40 text-on-secondary-fixed'
                : 'bg-error-container/40 border-error/30 text-error'
            }`}
          >
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-[18px]">
                {feedback.type === 'success' ? 'check_circle' : 'error'}
              </span>
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-on-surface-variant hover:text-on-surface"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tickets Table */}
        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
          <div className="p-space-md bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">confirmation_number</span>
              <span className="font-label-code-sm text-xs font-bold uppercase text-on-surface">
                Registered Engineering Tickets ({tickets.length})
              </span>
            </div>
            <button
              onClick={loadTickets}
              disabled={isLoading}
              className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
              title="Refresh tickets"
            >
              <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>
                refresh
              </span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-container-low text-on-surface-variant uppercase font-label-code-sm border-b border-outline-variant/20">
                <tr>
                  <th className="p-4">Ticket ID</th>
                  <th className="p-4">Title</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Linked Decision ADR</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {isLoading && tickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Loading tickets from FalkorDB...</span>
                      </div>
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                      No engineering tickets found. Click "Create Ticket" above to link a new issue to an architectural decision.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="p-4 font-label-code-sm text-primary font-bold">{t.id}</td>
                      <td className="p-4 font-headline-sm text-on-surface font-semibold max-w-md">
                        <div>{t.title}</div>
                        {t.description && (
                          <div className="text-[11px] text-on-surface-variant line-clamp-1 font-normal mt-0.5">
                            {t.description}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded font-label-edge border uppercase font-bold text-[10px] ${getPriorityBadge(
                            t.priority
                          )}`}
                        >
                          {t.priority || 'P2'}
                        </span>
                      </td>
                      <td className="p-4">
                        {t.decision_id ? (
                          <Link
                            href={`/decisions/${t.decision_id}`}
                            className="font-label-code-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">psychology</span>
                            <span>{t.decision_id}</span>
                            {t.decision_title && (
                              <span className="text-on-surface-variant font-normal">
                                ({t.decision_title.slice(0, 24)}...)
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span className="text-outline font-label-code-sm">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded font-label-edge bg-secondary-fixed text-on-secondary-fixed uppercase font-bold text-[10px]">
                          {t.status || 'OPEN'}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {t.url && (
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-on-surface-variant hover:text-primary font-semibold inline-flex items-center gap-0.5"
                            title="Open Jira issue"
                          >
                            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                          </a>
                        )}
                        <Link
                          href={`/tickets/${t.id}`}
                          className="text-primary hover:underline font-semibold"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Ticket Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-space-lg bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">add_task</span>
                  <h2 className="font-headline-sm font-bold text-on-surface">
                    Create Engineering Ticket
                  </h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-on-surface-variant hover:text-on-surface text-sm p-1 rounded hover:bg-surface-container"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="p-space-lg flex flex-col gap-space-md">
                {/* Title */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-code-sm text-xs font-semibold text-on-surface uppercase">
                    Ticket Title <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    placeholder="e.g. JIRA-402: Implement Redis Cluster Failover Hook"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-code-sm text-xs font-semibold text-on-surface uppercase">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={ticketDescription}
                    onChange={(e) => setTicketDescription(e.target.value)}
                    placeholder="Provide context on why this ticket is being implemented..."
                    className="w-full px-3 py-2 text-xs rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                {/* Priority & System Row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-code-sm text-xs font-semibold text-on-surface uppercase">
                      Priority
                    </label>
                    <select
                      value={ticketPriority}
                      onChange={(e) => setTicketPriority(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="P0">P0 - Blocker / Critical</option>
                      <option value="P1">P1 - High</option>
                      <option value="P2">P2 - Medium</option>
                      <option value="P3">P3 - Low</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-code-sm text-xs font-semibold text-on-surface uppercase">
                      System ID
                    </label>
                    <input
                      type="text"
                      value={ticketSystemId}
                      onChange={(e) => setTicketSystemId(e.target.value)}
                      placeholder="e.g. sys_billing"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Linked Decision ADR */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-code-sm text-xs font-semibold text-on-surface uppercase flex items-center justify-between">
                    <span>Linked Decision ADR</span>
                    <span className="text-[10px] text-on-surface-variant font-normal">Optional</span>
                  </label>
                  {decisionsList.length > 0 ? (
                    <select
                      value={ticketDecisionId}
                      onChange={(e) => setTicketDecisionId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">-- No Decision Linked --</option>
                      {decisionsList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.id} — {d.title.slice(0, 45)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={ticketDecisionId}
                      onChange={(e) => setTicketDecisionId(e.target.value)}
                      placeholder="e.g. dec_billing_v2"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  )}
                </div>

                {/* Jira / Issue URL */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-code-sm text-xs font-semibold text-on-surface uppercase flex items-center justify-between">
                    <span>Issue URL / Jira Link</span>
                    <span className="text-[10px] text-on-surface-variant font-normal">Optional</span>
                  </label>
                  <input
                    type="url"
                    value={ticketUrl}
                    onChange={(e) => setTicketUrl(e.target.value)}
                    placeholder="https://jira.company.com/browse/JIRA-402"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-surface-container-low border border-outline-variant text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-wider shadow hover:bg-surface-tint transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        <span>Create in FalkorDB</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
