import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { ForgotPasswordModal } from './ForgotPasswordModal';

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onSwitchToTrack?: () => void;
}

export function LoginForm({ onSwitchToRegister, onSwitchToTrack }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [ssoToast, setSsoToast] = useState<string | null>(null);

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

  const handleSSO = (provider: string) => {
    setSsoToast(`Redirecting to secure ${provider} SSO provider...`);
    setTimeout(() => setSsoToast(null), 3000);
  };

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex flex-col justify-between selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Top Header */}
      <header className="w-full py-space-lg px-margin flex items-center justify-between">
        <div className="flex items-center gap-space-sm">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
            <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
          </div>
          <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface font-semibold">
            SupportPilot
          </span>
        </div>
        <div className="flex items-center gap-space-xs px-space-sm py-space-xs rounded-full bg-ticket-open-bg">
          <div className="w-2 h-2 rounded-full bg-ticket-open-text animate-pulse"></div>
          <span className="font-body-sm text-body-sm text-ticket-open-text font-medium">
            Systems Operational
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full flex-1 flex flex-col items-center justify-center px-margin py-space-xl">
        <div className="flex flex-col w-full items-center justify-center relative">
          {/* Subtle Ambient Glow in Background */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[540px] h-64 bg-gradient-to-b from-primary-fixed to-transparent opacity-40 blur-3xl pointer-events-none rounded-full"></div>

          {/* Main Authentication Card */}
          <div className="relative w-full max-w-[460px] mx-auto z-10">
            <div className="bg-surface rounded-xl shadow-xl shadow-neutral/5 p-space-xl flex flex-col gap-space-lg border border-border">
              {/* Brand & Header Region */}
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center text-primary shadow-sm mb-space-md">
                  <span className="material-symbols-outlined text-[26px]">shield</span>
                </div>
                <div className="flex items-center gap-space-xs text-text-secondary font-code-mono text-code-mono uppercase tracking-wider mb-space-xs">
                  <span>Agent Gateway</span>
                  <span className="text-outline-variant">•</span>
                  <span>v2.4</span>
                </div>
                <h1 className="font-headline-lg text-headline-lg text-text-primary tracking-tight font-semibold">
                  Sign in to workspace
                </h1>
                <p className="font-body-md text-body-md text-text-secondary mt-space-xs max-w-sm">
                  Welcome back. Enter your credentials to access your support queue and operational
                  telemetry.
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <div
                  className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-2 text-error text-sm font-medium"
                  data-testid="login-error"
                >
                  <span className="material-symbols-outlined text-[18px] text-error shrink-0">
                    error
                  </span>
                  <span>{error}</span>
                </div>
              )}

              {/* Sign In Form */}
              <form className="flex flex-col gap-space-md" onSubmit={handleSubmit}>
                {/* Work Email Field */}
                <div className="flex flex-col gap-space-xs">
                  <label
                    className="font-headline-sm text-body-sm text-text-primary font-medium"
                    htmlFor="work-email"
                  >
                    Work Email
                  </label>
                  <div className="relative flex items-center bg-surface-subtle border border-border rounded-lg focus-within:bg-surface focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <span className="material-symbols-outlined absolute left-space-md text-[18px] text-text-secondary select-none pointer-events-none">
                      mail
                    </span>
                    <input
                      className="w-full bg-transparent py-2.5 pl-11 pr-space-md font-body-md text-body-md text-on-surface placeholder:text-text-secondary/60 focus:outline-none"
                      id="work-email"
                      name="email"
                      type="email"
                      required
                      placeholder="alex.vance@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="login-email-input"
                    />
                  </div>
                </div>

                {/* Password Field with inline forgot link */}
                <div className="flex flex-col gap-space-xs">
                  <div className="flex items-center justify-between">
                    <label
                      className="font-headline-sm text-body-sm text-text-primary font-medium"
                      htmlFor="account-password"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsForgotOpen(true)}
                      className="font-body-sm text-body-sm text-primary hover:text-on-primary-fixed-variant transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative flex items-center bg-surface-subtle border border-border rounded-lg focus-within:bg-surface focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                    <span className="material-symbols-outlined absolute left-space-md text-[18px] text-text-secondary select-none pointer-events-none">
                      lock
                    </span>
                    <input
                      className="w-full bg-transparent py-2.5 pl-11 pr-11 font-body-md text-body-md text-on-surface placeholder:text-text-secondary/60 focus:outline-none"
                      id="account-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      data-testid="login-password-input"
                    />
                    <button
                      type="button"
                      aria-label="Toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-space-sm p-1.5 rounded-lg text-text-secondary hover:text-on-surface hover:bg-surface-variant transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Primary Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-space-lg rounded-lg bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-body-md shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-space-sm mt-space-xs group cursor-pointer disabled:opacity-50"
                  data-testid="login-submit-button"
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-on-primary border-t-transparent animate-spin mr-2" />
                  ) : null}
                  <span>Sign In to Pilot</span>
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </button>
              </form>

              {/* Enterprise SSO Separator */}
              <div className="relative flex items-center justify-center my-space-xs">
                <div className="w-full h-px bg-border"></div>
                <span className="absolute bg-surface px-space-md font-body-sm text-body-sm text-text-secondary">
                  Or continue with enterprise SSO
                </span>
              </div>

              {/* SSO Actions Grid */}
              <div className="grid grid-cols-2 gap-space-sm">
                <button
                  type="button"
                  onClick={() => handleSSO('Okta SAML')}
                  className="flex items-center justify-center gap-space-sm py-2.5 px-space-md rounded-lg bg-surface-subtle hover:bg-surface-container text-on-surface font-body-md text-body-md transition-all border border-border cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">
                    domain_verification
                  </span>
                  <span className="font-medium">Okta SAML</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSSO('Google Workspace')}
                  className="flex items-center justify-center gap-space-sm py-2.5 px-space-md rounded-lg bg-surface-subtle hover:bg-surface-container text-on-surface font-body-md text-body-md transition-all border border-border cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-ticket-new-text">
                    hub
                  </span>
                  <span className="font-medium">Workspace</span>
                </button>
              </div>

              {/* Card Footer / Registration & Track */}
              <div className="pt-space-sm text-center flex flex-col gap-2">
                <p className="font-body-sm text-body-sm text-text-secondary">
                  Don't have an agent identity?{' '}
                  <button
                    type="button"
                    onClick={onSwitchToRegister}
                    className="font-medium text-primary hover:text-on-primary-fixed-variant transition-colors ml-1 cursor-pointer"
                  >
                    Request workspace access
                  </button>
                </p>
                {onSwitchToTrack && (
                  <button
                    type="button"
                    onClick={onSwitchToTrack}
                    className="text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                  >
                    Customer tracking ticket? Click here
                  </button>
                )}
              </div>
            </div>

            {/* Security & Operational Badges */}
            <div className="mt-space-lg flex flex-col sm:flex-row items-center justify-between gap-space-sm px-space-xs text-text-secondary font-body-sm text-body-sm">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[16px] text-ticket-open-text">
                  verified
                </span>
                <span>SOC-2 Type II Certified</span>
              </div>
              <div className="flex items-center gap-space-xs text-text-secondary">
                <span>Latency:</span>
                <span className="font-code-mono text-code-mono text-on-surface font-medium">
                  18ms
                </span>
                <span className="text-outline-variant">•</span>
                <span>US-East Fleet</span>
              </div>
            </div>
          </div>
        </div>

        {/* SSO Toast message */}
        {ssoToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-space-md py-space-sm rounded-lg bg-neutral text-surface shadow-xl font-body-sm text-body-sm flex items-center gap-space-sm z-50 animate-bounce">
            <span className="material-symbols-outlined text-[18px] text-ticket-open-bg">info</span>
            <span>{ssoToast}</span>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-space-lg px-margin border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-space-md text-on-surface-variant font-body-sm text-body-sm">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-[16px] text-text-secondary">
              verified_user
            </span>
            <span>256-Bit TLS End-to-End Encrypted</span>
          </div>
          <div className="flex items-center gap-space-lg">
            <a className="hover:text-on-surface transition-colors" href="#">
              Privacy Notice
            </a>
            <a className="hover:text-on-surface transition-colors" href="#">
              Terms of Service
            </a>
            <span className="text-outline-variant">•</span>
            <span className="text-text-secondary">© 2025 SupportPilot Technologies, Inc.</span>
          </div>
        </div>
      </footer>

      {isForgotOpen && (
        <ForgotPasswordModal isOpen={isForgotOpen} onClose={() => setIsForgotOpen(false)} />
      )}
    </div>
  );
}
