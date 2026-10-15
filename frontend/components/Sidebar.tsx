'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WhylineLogo } from './WhylineLogo';
import { useUser } from './UserContext';

export function Sidebar() {
  const pathname = usePathname();
  const { currentUser, users, setCurrentUser, logoutUser, graphStats } = useUser();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const baseNavItems = [
    { label: 'Home', path: '/', icon: 'home' },
    { label: 'Ask Whyline', path: '/ask-whyline', icon: 'psychology', badge: 'AI' },
    { label: 'Tickets', path: '/tickets', icon: 'confirmation_number' },
    { label: 'Decisions', path: '/decisions', icon: 'alt_route' },
    { label: 'Impact Analysis', path: '/impact-analysis', icon: 'alt_route' },
    { label: 'Ownership & Bus Factor', path: '/ownership-bus-factor', icon: 'shield_with_heart' },
    { label: 'Vs-RAG Comparison', path: '/rag-comparison', icon: 'compare_arrows' },
    { label: 'Graph Explorer', path: '/graph-explorer', icon: 'hub' },
  ];

  const navItems = currentUser?.role === 'admin'
    ? [...baseNavItems, { label: 'Admin Console', path: '/admin', icon: 'admin_panel_settings', badge: 'ROOT' }]
    : baseNavItems;

  const totalNodes = graphStats?.total_nodes ?? 68;
  const totalEdges = graphStats?.total_edges ?? 58;

  const displayName = currentUser?.name || currentUser?.username || currentUser?.email || 'Guest';
  const displayRole = currentUser?.role || 'Member';
  const displayCompany = currentUser?.company || 'Whyline Org';
  const initial = displayName ? displayName[0].toUpperCase() : 'U';

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex flex-col justify-between select-none border-r border-outline-variant/30">
      <div className="flex flex-col min-h-0">
        {/* Header Logo */}
        <div className="px-space-lg pt-space-lg pb-space-md flex items-center justify-between">
          <Link href="/" className="flex items-center gap-space-sm">
            <WhylineLogo className="h-7 w-auto" />
          </Link>
          <span className="font-label-code-sm text-label-code-sm bg-surface-container px-space-xs py-space-2xs rounded text-primary font-medium tracking-wide">
            v2.4-prod
          </span>
        </div>

        {/* Organization Box */}
        <div className="px-space-md py-space-xs">
          <div className="w-full flex items-center justify-between px-space-md py-space-sm rounded-lg bg-surface-container-low border border-outline-variant/20 transition-colors">
            <div className="flex items-center gap-space-sm overflow-hidden">
              <span className="material-symbols-outlined text-[18px] text-secondary">business</span>
              <div className="truncate">
                <p className="font-headline-sm text-headline-sm text-on-surface truncate font-semibold">
                  {displayCompany}
                </p>
                <p className="font-label-code-sm text-[11px] text-on-surface-variant truncate">
                  {currentUser?.username ? `@${currentUser.username}` : 'org-workspace'}
                </p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[16px] text-outline">verified</span>
          </div>
        </div>

        {/* Section title */}
        <div className="px-space-md pt-space-xs pb-space-2xs">
          <span className="font-label-code-sm text-label-code-sm uppercase tracking-wider text-outline px-space-sm">
            Platform Memory
          </span>
        </div>

        {/* Navigation list */}
        <nav className="flex flex-col gap-space-2xs px-space-md overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? pathname === '/'
                : pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center justify-between px-space-md py-space-sm rounded-lg transition-colors font-body-md text-body-md group ${
                  isActive
                    ? 'bg-primary-container text-on-primary font-medium shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <div className="flex items-center gap-space-md">
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      isActive ? 'text-on-primary' : 'text-primary'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`font-label-edge text-label-edge px-space-xs py-space-2xs rounded uppercase tracking-wider ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-primary-fixed text-on-primary-fixed-variant'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / User switcher */}
      <div className="p-space-md flex flex-col gap-space-sm bg-surface-container-lowest border-t border-outline-variant/20 relative">
        {/* Sync Status Badge */}
        <div className="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-space-2xs">
          <div className="flex items-center gap-space-xs">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="font-label-code-sm text-label-code-sm text-on-surface-variant font-medium">
              FalkorDB live connected
            </span>
          </div>
          <span className="font-label-edge text-label-edge text-outline">
            {totalNodes} NODES • {totalEdges} EDGES
          </span>
        </div>

        {/* User Account / Session Controls */}
        {currentUser ? (
          <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/20">
            <div className="flex items-center gap-space-sm min-w-0">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
                  {initial}
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-secondary ring-2 ring-surface-container-low"></span>
              </div>
              <div className="min-w-0 truncate">
                <p className="font-headline-sm text-headline-sm text-on-surface truncate font-semibold">
                  {displayName}
                </p>
                <p className="font-label-code-sm text-[11px] text-on-surface-variant truncate">
                  {displayRole} • {displayCompany}
                </p>
              </div>
            </div>
            <button
              onClick={logoutUser}
              title="Sign Out"
              className="p-1.5 rounded-md hover:bg-surface-container-high text-on-surface-variant hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="flex-1 py-2 px-3 text-center rounded-lg bg-primary text-on-primary font-headline-sm text-xs font-bold hover:bg-primary-container transition-colors shadow-sm"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="py-2 px-3 text-center rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-colors border border-outline-variant/30"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
