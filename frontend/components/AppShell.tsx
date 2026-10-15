'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { UserProvider, useUser } from './UserContext';
import { ThemeProvider } from './ThemeContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

function AppShellContent({
  isAuthPage,
  pathname,
  children,
}: {
  isAuthPage: boolean;
  pathname: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAdmin, isPending, isAuthenticated, authInitialized } = useUser();

  useEffect(() => {
    if (!authInitialized) return;

    // 1. If not authenticated, redirect to /login
    if (!isAuthenticated && !isAuthPage) {
      router.replace('/login');
      return;
    }

    // 2. If platform admin, redirect to /admin if on any other page
    if (isAuthenticated && isAdmin && pathname !== '/admin' && !isAuthPage) {
      router.replace('/admin');
      return;
    }

    // 3. If employee registration is pending approval, redirect to / (where approval gate is shown)
    if (isAuthenticated && isPending && pathname !== '/' && !isAuthPage) {
      router.replace('/');
      return;
    }
  }, [authInitialized, isAuthenticated, isAdmin, isPending, pathname, isAuthPage, router]);

  // Loading state while verifying auth from local storage
  if (!authInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in and not on login/signup: block rendering and redirect to login
  if (!isAuthenticated && !isAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-on-surface-variant font-label-code-sm">
            Redirecting to Sign In...
          </p>
        </div>
      </div>
    );
  }

  // If platform admin and not on /admin, block rendering other screens
  if (isAuthenticated && isAdmin && pathname !== '/admin' && !isAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-on-surface-variant font-label-code-sm">
            Redirecting to Admin Console...
          </p>
        </div>
      </div>
    );
  }

  // If pending approval and not on /, block rendering other screens
  if (isAuthenticated && isPending && pathname !== '/' && !isAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-on-surface-variant font-label-code-sm">
            Redirecting to Approval Status...
          </p>
        </div>
      </div>
    );
  }

  return isAuthPage ? (
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
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  return (
    <ThemeProvider>
      <UserProvider>
        <AppShellContent isAuthPage={isAuthPage} pathname={pathname}>
          {children}
        </AppShellContent>
      </UserProvider>
    </ThemeProvider>
  );
}
