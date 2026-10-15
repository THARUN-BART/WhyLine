'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WhylineLogo } from '@/components/WhylineLogo';
import { api } from '@/lib/api';
import { useUser } from '@/components/UserContext';
import { useTheme } from '@/components/ThemeContext';

export default function SignupPage() {
  const router = useRouter();
  const { registerUser, companies } = useUser();
  const { theme, toggleTheme } = useTheme();

  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [company, setCompany] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!company && companies.length > 0) {
      setCompany(companies[0].name);
    }
  }, [companies, company]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !username.trim() || !company.trim() || !password.trim()) {
      setError('Please fill in all required fields including your company name.');
      return;
    }
    if (password.trim().length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.sendOtp(email.trim());
      setInfoMessage(res?.message || `Verification code sent to ${email}`);
      setStep('otp');
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otp.trim()) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }

    setIsLoading(true);
    try {
      await registerUser({
        email: email.trim(),
        username: username.trim(),
        company: company.trim(),
        password,
        otp: otp.trim(),
      });
      router.push('/');
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please check your verification code.');
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
        <span className="font-label-edge text-label-edge text-secondary uppercase font-bold bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded tracking-widest mt-1">
          JOIN THE REASONING GRAPH
        </span>
        <h2 className="mt-4 font-headline-xl text-2xl font-bold text-on-surface tracking-tight">
          Create institutional account
        </h2>
        <p className="mt-1 text-xs text-on-surface-variant max-w-sm">
          Register with email verification to capture and traverse architecture decisions.
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

          {infoMessage && (
            <div className="mb-5 p-3 rounded-lg bg-secondary-fixed/30 border border-secondary/40 text-xs text-on-secondary-fixed flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-secondary">mark_email_read</span>
              <span>{infoMessage}</span>
            </div>
          )}

          {step === 'details' ? (
            <form className="space-y-4" onSubmit={handleSendOtp}>
              <div>
                <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                  Work Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@company.com"
                  className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. janedoe"
                  className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                  Company / Organization *
                </label>
                <div className="mt-1.5 relative">
                  <select
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all cursor-pointer appearance-none pr-10"
                  >
                    <option value="" disabled>Select your company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.name} className="bg-surface-container-lowest text-on-surface">
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant absolute right-3 top-2.5 pointer-events-none">
                    expand_more
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-on-surface-variant">
                  Organizations are managed and verified by your platform administrator.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 12 characters"
                  className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-xs font-label-code-md outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-lg bg-primary text-on-primary font-headline-sm text-xs font-bold hover:bg-primary-container transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      <span>Sending OTP Verification Code...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">outgoing_mail</span>
                      <span>Continue &amp; Send Verification Code</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleCompleteRegistration}>
              <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/20 text-xs">
                <span className="font-semibold text-on-surface">Target Account:</span>
                <p className="font-label-code-sm text-primary font-bold">{email}</p>
                <p className="text-[11px] text-on-surface-variant">
                  User: {username} • Company: <strong>{company}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface uppercase font-label-edge">
                  Enter 6-Digit Email OTP *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="mt-1.5 w-full px-3.5 py-2.5 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface text-center tracking-widest text-lg font-label-code-md font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-outline"
                />
                <span className="block text-[11px] text-outline mt-1 text-center">
                  Check your email inbox for the 6-digit code.
                </span>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="py-2.5 px-3 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-secondary text-on-secondary font-headline-sm text-xs font-bold hover:bg-secondary/90 transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      <span>Verifying &amp; Registering...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">verified_user</span>
                      <span>Complete Registration</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Link to Login */}
          <div className="mt-6 pt-5 border-t border-outline-variant/30 text-center text-xs text-on-surface-variant">
            <span>Already registered? </span>
            <Link href="/login" className="text-primary font-bold hover:underline">
              Sign in with existing credentials →
            </Link>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="mt-6 text-center text-xs text-outline flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-sm text-secondary">verified</span>
          <span>Stored directly as (:User) nodes in FalkorDB with Company isolation</span>
        </div>
      </div>
    </div>
  );
}
