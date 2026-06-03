import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email, password);
      if (error) setError(error);
      else setSuccess('Account created! You can now sign in.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: '#f5f8fa' }}>

      {/* Brand accent blobs — per brand guide: irregular circles at 35% transparency */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '-100px',
          right: '-100px',
          width: '420px',
          height: '420px',
          borderRadius: '60% 40% 55% 45% / 45% 55% 45% 55%',
          background: '#6dccc2',
          opacity: 0.35,
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-80px',
          left: '-80px',
          width: '340px',
          height: '360px',
          borderRadius: '45% 55% 40% 60% / 55% 40% 60% 45%',
          background: '#df76b6',
          opacity: 0.28,
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-60px',
          right: '80px',
          width: '320px',
          height: '340px',
          borderRadius: '50% 50% 45% 55% / 40% 60% 40% 60%',
          background: '#efd35c',
          opacity: 0.32,
        }}
      />

      {/* Top header bar — matches the reference screenshot style */}
      <header
        className="relative z-10 flex items-center px-6 py-3 flex-shrink-0"
        style={{ background: '#2a3f55' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
          >
            <img
              src="/files_4755529-2026-06-01T19-48-56-147Z-MOJA+Behavioral_(1).png"
              alt="Moja"
              className="w-9 h-9 object-contain"
            />
          </div>
          <div className="leading-tight">
            <p className="font-bold text-[15px] text-white leading-none">Moja Behavioral Services</p>
            <p className="text-[12px] font-semibold mt-0.5" style={{ color: '#6dccc2' }}>
              Scheduler Admin Portal
            </p>
          </div>
        </div>
      </header>

      {/* Main centered content */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-[420px]">

          {/* Welcome text */}
          <div className="text-center mb-8">
            <p
              className="text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: '#e66d38', letterSpacing: '0.18em' }}
            >
              Admin Portal
            </p>
            <h1
              className="font-bold leading-tight mb-3"
              style={{ fontSize: '32px', color: '#2a3f55' }}
            >
              Welcome back
            </h1>
            <p className="text-sm" style={{ color: '#7a90a4' }}>
              Sign in to manage schedules, staff, and clients.
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: '#ffffff',
              boxShadow: '0 4px 32px rgba(42,63,85,0.10), 0 1px 4px rgba(42,63,85,0.06)',
              border: '1px solid rgba(42,63,85,0.08)',
            }}
          >
            {/* Tab switcher */}
            <div
              className="flex rounded-xl p-1 mb-7"
              style={{ background: '#f0f4f8' }}
            >
              {(['login', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all duration-200"
                  style={
                    mode === m
                      ? {
                          background: '#ffffff',
                          color: '#2a3f55',
                          boxShadow: '0 1px 4px rgba(42,63,85,0.12)',
                        }
                      : { color: '#7a90a4' }
                  }
                >
                  {m === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label
                  className="block text-[12px] font-bold uppercase mb-2"
                  style={{ color: '#7a90a4', letterSpacing: '0.08em' }}
                >
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@mojaaba.com"
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 outline-none"
                  style={{
                    background: '#f5f8fa',
                    border: '1.5px solid #dde4eb',
                    color: '#2a3f55',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.border = '1.5px solid #6dccc2';
                    e.currentTarget.style.background = '#f0faf9';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(109,204,194,0.15)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.border = '1.5px solid #dde4eb';
                    e.currentTarget.style.background = '#f5f8fa';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  className="block text-[12px] font-bold uppercase mb-2"
                  style={{ color: '#7a90a4', letterSpacing: '0.08em' }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pr-11 rounded-xl text-sm font-medium transition-all duration-150 outline-none"
                    style={{
                      background: '#f5f8fa',
                      border: '1.5px solid #dde4eb',
                      color: '#2a3f55',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.border = '1.5px solid #6dccc2';
                      e.currentTarget.style.background = '#f0faf9';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(109,204,194,0.15)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.border = '1.5px solid #dde4eb';
                      e.currentTarget.style.background = '#f5f8fa';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#aab8c4' }}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Feedback */}
              {error && (
                <div
                  className="px-4 py-3 rounded-xl text-sm font-medium"
                  style={{
                    background: 'rgba(239,68,68,0.06)',
                    border: '1px solid rgba(239,68,68,0.18)',
                    color: '#dc2626',
                  }}
                >
                  {error}
                </div>
              )}
              {success && (
                <div
                  className="px-4 py-3 rounded-xl text-sm font-medium"
                  style={{
                    background: 'rgba(109,204,194,0.08)',
                    border: '1px solid rgba(109,204,194,0.25)',
                    color: '#278580',
                  }}
                >
                  {success}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60"
                style={{
                  background: '#2a3f55',
                  color: '#ffffff',
                  boxShadow: '0 4px 16px rgba(42,63,85,0.25)',
                }}
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Sign In' : 'Create Account'}
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center mt-5 text-[11px]" style={{ color: '#aab8c4' }}>
            Moja Behavioral Services &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
