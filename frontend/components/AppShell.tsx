'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { UserProvider } from './UserContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  return (
    <UserProvider>
      {isAuthPage ? (
        <div className="min-h-screen bg-surface text-on-surface flex flex-col">
          {children}
        </div>
      ) : (
        <div className="min-h-screen flex bg-surface">
          <Sidebar />
          <div className="flex-1 ml-64 flex flex-col min-h-screen">
            <Header />
            <div className="pt-16 flex-1 flex flex-col">
              {children}
            </div>
          </div>
        </div>
      )}
    </UserProvider>
  );
}
