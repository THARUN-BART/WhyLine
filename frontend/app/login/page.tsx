'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WhylineLogo } from '@/components/WhylineLogo';
import { useUser } from '@/components/UserContext';
import { useTheme } from '@/components/ThemeContext';

export default function LoginPage() {
  const router = useRouter();
  const { loginUser } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginUser(email.trim(), password);
      if (user?.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Top right theme toggle */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/30 transition-colors shadow-sm flex items-center gap-1.5 text-xs font-semibold"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <span className="material-symbols-outlined text-[18px]">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
          <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </div>

      {/* Background ambient glowing spheres */}
      <div className="absolute -left-20 -top-20 w-96 h-96 bg-primary-fixed/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-secondary-fixed/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Header Logo */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 flex flex-col items-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-2">
          <WhylineLogo className="h-9 w-auto" />
        </Link>
        <span className="font-label-edge text-label-edge text-primary uppercase font-bold bg-primary-fixed px-2 py-0.5 rounded tracking-widest mt-1">
          DECISION MEMORY PLATFORM
        </span>
        <h2 className="mt-4 font-headline-xl text-2xl font-bold text-on-surface tracking-tight">
          Sign in to your organization
        </h2>
        <p className="mt-1 text-xs text-on-surface-variant max-w-sm">
          Trace architectural decisions, verify cryptographic provenance, and inspect system blast radius.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-surface-container-lowest py-8 px-6 shadow-xl rounded-2xl border border-outline-variant/40 sm:px-10">
          {error && (
            <div className="mb-5 p-3 rounded-lg bg-error-container/40 border border-error/30 text-xs text-error flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                Work Email Address
              </label>
              <div className="mt-1.5 relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@company.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                  Password
                </label>
              </div>
              <div className="mt-1.5 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-sm">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded accent-primary w-3.5 h-3.5" />
                <span className="text-on-surface-variant">Remember session</span>
              </label>
              <span className="font-label-edge text-[10px] text-secondary font-bold uppercase">
                JWT Auth • FalkorDB
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-primary text-on-primary font-headline-sm text-xs font-bold hover:bg-primary-container transition-colors shadow-md flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">lock_open</span>
                  <span>Authenticate &amp; Enter Platform</span>
                </>
              )}
            </button>
          </form>

          {/* Link to Signup */}
          <div className="mt-6 pt-5 border-t border-outline-variant/30 text-center text-xs text-on-surface-variant">
            <span>Don&apos;t have an account yet? </span>
            <Link href="/signup" className="text-primary font-bold hover:underline">
              Create an account with Company &amp; OTP →
            </Link>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="mt-6 text-center text-xs text-outline flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-sm text-secondary">verified</span>
          <span>Zero Hallucinations • Cryptographic Causal Invariants</span>
        </div>
      </div>
    </div>
  );
}
