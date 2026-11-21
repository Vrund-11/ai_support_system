import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onSwitchToTrack?: () => void;
}

export function LoginForm({ onSwitchToRegister, onSwitchToTrack }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotOpen, setIsForgotOpen] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await api.auth.login(email, password);
      setAuth(result.accessToken, result.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || err.title);
      } else {
        setError('Login failed. Please check credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/60 dark:bg-zinc-950 px-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-sm border border-slate-200/80 dark:border-zinc-800 transition-all">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mb-3 ring-4 ring-indigo-50/50 dark:ring-indigo-950/20 shadow-xs">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
            Sign in to SupportPilot
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Multi-tenant AI customer support platform
          </p>
        </div>

        {error && (
          <div
            className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 rounded-xl flex items-start space-x-2 text-rose-700 dark:text-rose-400 text-sm"
            data-testid="login-error"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@company.com"
              className="w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
              data-testid="login-email-input"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                Password
              </label>
              <button
                type="button"
                onClick={() => setIsForgotOpen(true)}
                className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium transition-colors cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-50/50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
              data-testid="login-password-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer hover:shadow-indigo-500/20"
            data-testid="login-submit-button"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in to SupportPilot</span>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-zinc-800 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Don't have a workspace?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
            >
              Register your organization
            </button>
          </p>
          {onSwitchToTrack && (
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Have an existing ticket?{' '}
              <button
                type="button"
                onClick={onSwitchToTrack}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                data-testid="login-track-ticket-link"
              >
                Track ticket status
              </button>
            </p>
          )}
        </div>
      </div>

      <ForgotPasswordModal isOpen={isForgotOpen} onClose={() => setIsForgotOpen(false)} />
    </div>
  );
}
