'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, EntitySearchResult } from '@/lib/api';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntitySearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await api.findEntity(query);
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const handleSelect = (item: EntitySearchResult) => {
    onClose();
    if (item.label === 'Decision') {
      router.push(`/decisions/${item.id}`);
    } else if (item.label === 'System') {
      router.push(`/impact-analysis?system=${encodeURIComponent(item.name)}`);
    } else if (item.label === 'Ticket') {
      router.push(`/tickets/${item.id}`);
    } else {
      router.push(`/ask-whyline?q=${encodeURIComponent(item.name || item.id)}`);
    }
  };

  const handleAskAi = () => {
    onClose();
    router.push(`/ask-whyline?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-24 px-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-surface-container-lowest rounded-xl shadow-2xl border border-outline-variant overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-outline-variant gap-3 bg-surface-container-low">
          <span className="material-symbols-outlined text-primary text-xl">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && query.trim() && results.length === 0) handleAskAi();
            }}
            placeholder="Search decisions, systems, tickets, or ask 'Why did we...' (ESC to exit)"
            className="w-full bg-transparent border-none outline-none text-on-surface font-body-md text-sm placeholder:text-outline"
          />
          {isLoading ? (
            <span className="material-symbols-outlined text-outline animate-spin text-sm">progress_activity</span>
          ) : (
            <kbd className="font-label-code-sm text-xs bg-surface-container-highest text-on-surface px-1.5 py-0.5 rounded">
              ESC
            </kbd>
          )}
        </div>

        {/* Results list */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-outline-variant/30">
          {query.trim().length > 0 && (
            <div
              onClick={handleAskAi}
              className="p-3 rounded-lg hover:bg-primary-fixed/20 cursor-pointer flex items-center justify-between text-primary font-medium text-sm transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">psychology</span>
                <span>Ask AI: &ldquo;{query}&rdquo;</span>
              </div>
              <span className="text-xs bg-primary-container text-on-primary px-2 py-0.5 rounded font-label-edge uppercase">
                AI Investigation
              </span>
            </div>
          )}

          {results.length > 0 ? (
            results.map((res) => (
              <div
                key={res.id}
                onClick={() => handleSelect(res)}
                className="p-3 rounded-lg hover:bg-surface-container-low cursor-pointer flex items-center justify-between transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="p-1.5 rounded bg-surface-container text-primary material-symbols-outlined text-base">
                    {res.label === 'Decision'
                      ? 'alt_route'
                      : res.label === 'System'
                      ? 'dns'
                      : res.label === 'Ticket'
                      ? 'confirmation_number'
                      : 'description'}
                  </span>
                  <div>
                    <p className="font-headline-sm text-sm text-on-surface group-hover:text-primary transition-colors">
                      {res.name}
                    </p>
                    <p className="font-label-code-sm text-xs text-on-surface-variant">{res.id}</p>
                  </div>
                </div>
                <span className="font-label-edge text-xs bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded uppercase">
                  {res.label}
                </span>
              </div>
            ))
          ) : query.trim() ? (
            !isLoading && (
              <div className="p-6 text-center text-sm text-outline">
                No direct entity match. Press Enter to investigate with AI.
              </div>
            )
          ) : (
            <div className="p-4 text-xs text-outline space-y-2">
              <p className="font-semibold text-on-surface-variant">Quick Shortcuts:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    onClose();
                    router.push('/decisions/dec_billing_v2');
                  }}
                  className="text-left p-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface"
                >
                  <span className="font-medium">Move billing to billing-api</span>
                  <span className="block text-[11px] text-primary">dec_billing_v2</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    router.push('/impact-analysis?system=billing-api');
                  }}
                  className="text-left p-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface"
                >
                  <span className="font-medium">billing-api Blast Radius</span>
                  <span className="block text-[11px] text-secondary">sys_billing</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    router.push('/ownership-bus-factor');
                  }}
                  className="text-left p-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface"
                >
                  <span className="font-medium">ledger-service Bus Factor</span>
                  <span className="block text-[11px] text-error font-semibold">Orphaned System (100)</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    router.push('/rag-comparison');
                  }}
                  className="text-left p-2 rounded bg-surface-container hover:bg-surface-container-high text-on-surface"
                >
                  <span className="font-medium">Vs-RAG Comparison</span>
                  <span className="block text-[11px] text-tertiary">4 Benchmarks</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
