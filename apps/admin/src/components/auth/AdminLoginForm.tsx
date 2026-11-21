import React, { useState } from 'react';
import { ShieldCheck, Lock, Mail, AlertCircle, KeyRound, Sparkles } from 'lucide-react';
import { useAdminAuthStore } from '../../store/admin-auth.store';

export function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const login = useAdminAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const success = await login(email, password);
      if (!success) {
        setError('Invalid superadmin credentials. Verify your platform root secret.');
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please check platform logs.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDefaultCredentials = () => {
    setEmail('admin@supportpilot.io');
    setPassword('SuperAdminSecret2026!');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-indigo-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Top NOC Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-mono mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>NOC SECURE ZONE &bull; PORT 3001</span>
        </div>

        <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 mb-3">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Platform Administration</h2>
        <p className="mt-1 text-sm text-slate-400">
          SuperAdmin control plane &bull; Root operational access
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-4 shadow-2xl border border-slate-800 sm:rounded-2xl sm:px-10">
          {error && (
            <div
              data-testid="admin-login-error"
              className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form data-testid="admin-login-form" className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                SuperAdmin Email
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  data-testid="admin-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@supportpilot.io"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-sans transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                Root Secret Key
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  data-testid="admin-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono transition-all"
                />
              </div>
            </div>

            {/* Quick credentials hint badge */}
            <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs text-slate-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-mono text-[11px] text-slate-400">
                  admin@supportpilot.io &bull; SuperAdminSecret2026!
                </span>
              </div>
              <button
                type="button"
                onClick={fillDefaultCredentials}
                className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                Fill
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              data-testid="admin-login-submit"
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer font-sans"
            >
              {isLoading ? 'Authenticating Root Access...' : 'Sign In to SuperAdmin Console'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
