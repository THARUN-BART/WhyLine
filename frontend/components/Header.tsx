'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from './UserContext';
import { CommandPalette } from './CommandPalette';

export function Header() {
  const pathname = usePathname();
  const { currentUser } = useUser();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getPageTitle = () => {
    if (pathname === '/') return 'Acme Architecture Lineage';
    if (pathname.startsWith('/ask-whyline')) return 'AI Investigation';
    if (pathname.startsWith('/decisions')) return 'Decisions & Provenance';
    if (pathname.startsWith('/impact-analysis')) return 'Change Impact Analysis';
    if (pathname.startsWith('/ownership-bus-factor')) return 'Ownership & Bus Factor';
    if (pathname.startsWith('/tickets')) return 'Tickets & Traces';
    if (pathname.startsWith('/rag-comparison')) return 'Vs-RAG Architecture Comparison';
    if (pathname.startsWith('/graph-explorer')) return 'Graph Explorer';
    return 'Lineage';
  };

  return (
    <>
      <header className="fixed top-0 left-64 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-outline-variant/30 z-40 flex items-center justify-between px-space-xl">
        {/* Breadcrumb title */}
        <div className="flex items-center gap-space-sm">
          <div className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
            <Link href="/" className="hover:text-on-surface transition-colors cursor-pointer font-medium">
              {currentUser?.company || 'Whyline'}
            </Link>
            <span>/</span>
            <span className="font-headline-sm text-headline-sm text-on-surface">
              {getPageTitle()}
            </span>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="flex items-center justify-center flex-1 max-w-xl mx-space-xl">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-between px-space-md py-space-xs rounded-lg bg-surface-container-low text-on-surface-variant hover:bg-surface-container transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-center gap-space-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">search</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Search decisions, systems, tickets, or ask &apos;Why...&apos;
              </span>
            </div>
            <kbd className="font-label-code-sm text-label-code-sm bg-surface-container-highest text-on-surface px-space-xs py-space-2xs rounded shadow-sm">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Action Controls & Badges */}
        <div className="flex items-center gap-space-md">
          {/* Provenance Badge */}
          <div className="hidden lg:flex items-center gap-space-xs px-space-sm py-space-xs rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-edge text-label-edge tracking-wider uppercase font-bold">
            <span className="material-symbols-outlined text-[14px]">verified</span>
            <span>Graph-backed • 100% Provenance</span>
          </div>

          {/* Notifications Button */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-space-xs text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-1 right-1 w-4 h-4 bg-error text-on-error rounded-full font-label-edge text-label-edge flex items-center justify-center leading-none">
                3
              </span>
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl p-3 z-50 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30">
                  <span className="font-headline-sm text-xs text-on-surface font-semibold">Active Risk Alerts</span>
                  <span className="text-[10px] bg-error-container text-on-error-container px-1.5 py-0.5 rounded font-label-edge">
                    3 High
                  </span>
                </div>
                <div className="py-2 space-y-2 text-xs">
                  <div className="p-2 rounded bg-error-container/40 border border-error/20">
                    <p className="font-semibold text-error">ledger-service ORPHANED</p>
                    <p className="text-on-surface-variant text-[11px]">Former owner Dave Miller departed. 5 transitive dependents.</p>
                  </div>
                  <div className="p-2 rounded bg-surface-container">
                    <p className="font-semibold text-on-surface">payments-gateway Single Owner</p>
                    <p className="text-on-surface-variant text-[11px]">Bus factor 1 with 5 dependent services.</p>
                  </div>
                  <div className="p-2 rounded bg-surface-container">
                    <p className="font-semibold text-on-surface">Protobuf RFC Document Missing</p>
                    <p className="text-on-surface-variant text-[11px]">Provenanced gap detected on dec_gap_no_doc.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Ask AI / New Investigation Link */}
          <Link
            href="/ask-whyline"
            className="flex items-center gap-space-xs px-space-md py-space-xs bg-primary-container text-on-primary rounded-lg font-headline-sm text-headline-sm hover:bg-primary transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">psychology</span>
            <span>Ask Whyline</span>
          </Link>

          {/* User Avatar */}
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs shadow-sm">
            {currentUser?.name ? currentUser.name[0].toUpperCase() : currentUser?.username ? currentUser.username[0].toUpperCase() : 'U'}
          </div>
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
