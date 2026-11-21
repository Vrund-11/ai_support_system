import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [tenantName, setTenantName] = useState('Acme Corp');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [region, setRegion] = useState('us-east-1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setAuth = useAuthStore((s) => s.setAuth);

  const slug =
    tenantName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'workspace';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await api.auth.register({
        tenantName,
        name,
        email,
        password,
      });
      setAuth(result.accessToken, result.user);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail || err.title);
      } else {
        setError('Registration failed. Please check your inputs and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background font-body-md text-on-surface antialiased">
      {/* Left Hero / Showcase Panel */}
      <div className="relative w-full lg:w-[48%] xl:w-[46%] bg-neutral text-on-primary flex flex-col justify-between p-8 sm:p-12 lg:p-14 overflow-hidden shrink-0">
        <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-container/20 blur-3xl"></div>
        <div className="pointer-events-none absolute bottom-10 right-0 w-80 h-80 rounded-full bg-tertiary/15 blur-3xl"></div>
        <div className="pointer-events-none absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-secondary/15 blur-2xl"></div>

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-on-primary shadow-md">
                <span className="material-symbols-outlined text-[22px]">rocket_launch</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-md text-headline-md tracking-tight font-bold text-on-primary">
                  SupportPilot
                </span>
                <span className="font-code-mono text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full bg-surface-container-high/20 text-on-primary-container">
                  V2.5 ENTERPRISE
                </span>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-variant/20 text-on-primary-container font-code-mono text-code-mono">
              <span className="w-2 h-2 rounded-full bg-ticket-open-text animate-pulse"></span>
              SOC-2 TYPE II
            </span>
          </div>

          <div className="mt-4">
            <h1 className="font-display-hero text-display-hero text-on-primary tracking-tight max-w-xl">
              AI-Native Customer Support Engine for Hyper-Growth Teams
            </h1>
            <p className="font-body-lg text-body-lg text-surface-variant mt-4 max-w-lg leading-relaxed">
              Empower your tier-1 through tier-3 engineering and support workflows with autonomous
              copilot triage, instant RAG grounding, and enterprise SLA observability.
            </p>
          </div>

          {/* Capability Cards Stack */}
          <div className="mt-4 flex flex-col gap-3">
            <div className="rounded-xl bg-surface-container-high/10 p-4 transition-all duration-200">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-primary/25 text-primary-fixed flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[20px]">neurology</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline-sm text-headline-sm font-semibold text-on-primary">
                      Autonomous RAG Copilot
                    </h3>
                    <span className="font-code-mono text-[11px] text-surface-tint">
                      Real-time sync
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-surface-variant mt-1 leading-snug">
                    Zero-hallucination semantic context grounding across vector DBs, Jira issues,
                    internal Confluence docs, and code repos.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-surface-container-high/10 p-4 transition-all duration-200">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-secondary/25 text-secondary-fixed flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[20px]">bolt</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline-sm text-headline-sm font-semibold text-on-primary">
                      Sub-Second Triage & Routing
                    </h3>
                    <span className="font-code-mono text-[11px] text-ticket-open-text font-medium">
                      99.8% SLA
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-surface-variant mt-1 leading-snug">
                    Dynamic intent and urgency scoring models dispatch complex escalations directly
                    to the right engineering on-call rotation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Social Proof Quote */}
        <div className="relative z-10 mt-8 pt-6">
          <div className="rounded-xl bg-surface-container-high/15 p-4 sm:p-5">
            <div className="flex items-center gap-1 text-priority-high mb-2">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="material-symbols-outlined text-[16px]">
                  star
                </span>
              ))}
            </div>
            <p className="font-body-md text-body-md text-on-primary italic leading-relaxed">
              “SupportPilot cut our initial first-response time from 42 mins to 90 seconds while
              deflecting 44% of routine high-touch cloud tickets in week one.”
            </p>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-headline-sm text-[12px] font-bold">
                  AC
                </div>
                <div>
                  <p className="font-headline-sm text-[13px] font-semibold text-on-primary leading-none">
                    Marcus Vance
                  </p>
                  <p className="font-body-sm text-body-sm text-surface-variant mt-0.5">
                    Staff Reliability Architect • ApexCloud
                  </p>
                </div>
              </div>
              <span className="font-code-mono text-code-mono text-surface-tint">5,200+ Seats</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Onboarding Form Panel */}
      <div className="w-full lg:w-[52%] xl:w-[54%] flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 xl:p-16">
        <div className="w-full max-w-xl flex flex-col">
          {/* Stepper Progress Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2.5">
              <span className="font-code-mono text-code-mono font-medium text-primary tracking-wide uppercase">
                Step 1 of 2: Workspace Setup
              </span>
              <span className="font-code-mono text-code-mono text-text-secondary">
                Next: Invite Team & Integrations
              </span>
            </div>
            <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden flex gap-1">
              <div className="h-full w-1/2 bg-primary rounded-full transition-all duration-300"></div>
              <div className="h-full w-1/2 bg-surface-variant rounded-full"></div>
            </div>
          </div>

          {/* Form Card Container */}
          <div className="bg-surface rounded-xl p-6 sm:p-8 shadow-sm border border-border">
            <div className="mb-6">
              <h2 className="font-headline-lg text-headline-lg text-text-primary tracking-tight font-bold">
                Create your SupportPilot workspace
              </h2>
              <p className="font-body-md text-body-md text-text-secondary mt-1.5">
                Start your 14-day enterprise trial. No credit card required.
              </p>
            </div>

            {error && (
              <div
                className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-2 text-error text-sm font-medium"
                data-testid="register-error"
              >
                <span className="material-symbols-outlined text-[18px] text-error shrink-0">
                  error
                </span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Organization Name */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="font-headline-sm text-[13px] font-semibold text-text-primary flex items-center justify-between"
                  htmlFor="org-name"
                >
                  <span>Company or Organization</span>
                  <span className="font-code-mono text-[11px] text-text-secondary font-normal">
                    Primary Tenant Identifier
                  </span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-text-secondary pointer-events-none text-[20px]">
                    corporate_fare
                  </span>
                  <input
                    id="org-name"
                    type="text"
                    required
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="Acme Global Technologies"
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-subtle text-text-primary rounded-lg font-body-md text-body-md border border-border focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
                    data-testid="register-tenant-input"
                  />
                </div>
                {/* Live Slug Preview */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-text-secondary">
                  <span className="material-symbols-outlined text-[15px] text-primary">link</span>
                  <span className="font-body-sm text-[12px]">Tenant Endpoint:</span>
                  <span className="font-code-mono text-[12px] font-medium text-primary">
                    {slug}.supportpilot.com
                  </span>
                </div>
              </div>

              {/* Full Name & Work Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    className="font-headline-sm text-[13px] font-semibold text-text-primary"
                    htmlFor="full-name"
                  >
                    Full Name (Owner)
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-text-secondary pointer-events-none text-[20px]">
                      person
                    </span>
                    <input
                      id="full-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Sarah Jenkins"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-subtle text-text-primary rounded-lg font-body-md text-body-md border border-border focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
                      data-testid="register-name-input"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    className="font-headline-sm text-[13px] font-semibold text-text-primary"
                    htmlFor="work-email"
                  >
                    Work Email
                  </label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-text-secondary pointer-events-none text-[20px]">
                      mail
                    </span>
                    <input
                      id="work-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="sarah@acme.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-subtle text-text-primary rounded-lg font-body-md text-body-md border border-border focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
                      data-testid="register-email-input"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  className="font-headline-sm text-[13px] font-semibold text-text-primary flex items-center justify-between"
                  htmlFor="password-input"
                >
                  <span>Master Admin Password</span>
                  <span className="font-code-mono text-[11px] text-ticket-open-text font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-ticket-open-text"></span>
                    Strong Security Profile
                  </span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-text-secondary pointer-events-none text-[20px]">
                    lock
                  </span>
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-surface-subtle text-text-primary rounded-lg font-body-md text-body-md border border-border focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
                    data-testid="register-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-text-secondary hover:text-text-primary focus:outline-none p-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Data Residency Selector */}
              <div className="flex flex-col gap-1.5 mt-1">
                <label className="font-headline-sm text-[13px] font-semibold text-text-primary flex items-center justify-between">
                  <span>Workspace Data Residency</span>
                  <span className="font-code-mono text-[11px] text-text-secondary">
                    GDPR & ISO-27001 Compliant
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    onClick={() => setRegion('us-east-1')}
                    className={`cursor-pointer relative flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      region === 'us-east-1'
                        ? 'bg-surface border-primary ring-1 ring-primary'
                        : 'bg-surface-subtle border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="region"
                      value="us-east-1"
                      checked={region === 'us-east-1'}
                      onChange={() => setRegion('us-east-1')}
                      className="text-primary focus:ring-primary h-4 w-4"
                    />
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-[13px] font-semibold text-text-primary">
                        US-East (N. Virginia)
                      </span>
                      <span className="font-code-mono text-[11px] text-text-secondary">
                        Low latency Americas
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setRegion('eu-central-1')}
                    className={`cursor-pointer relative flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      region === 'eu-central-1'
                        ? 'bg-surface border-primary ring-1 ring-primary'
                        : 'bg-surface-subtle border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="region"
                      value="eu-central-1"
                      checked={region === 'eu-central-1'}
                      onChange={() => setRegion('eu-central-1')}
                      className="text-primary focus:ring-primary h-4 w-4"
                    />
                    <div className="flex flex-col">
                      <span className="font-headline-sm text-[13px] font-semibold text-text-primary">
                        EU-Central (Frankfurt)
                      </span>
                      <span className="font-code-mono text-[11px] text-text-secondary">
                        Strict EU Data Shield
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={loading}
                className="mt-3 w-full py-3.5 px-6 rounded-lg bg-primary text-on-primary font-headline-sm font-semibold flex items-center justify-center gap-2 shadow-md hover:bg-primary-container active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                data-testid="register-submit-button"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 rounded-full border-2 border-on-primary border-t-transparent animate-spin mr-2" />
                ) : null}
                <span>Create Workspace</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>

              {/* Back to Login */}
              <div className="mt-2 text-center">
                <span className="font-body-md text-[13px] text-text-secondary">
                  Already have an account?
                </span>
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="font-body-md text-[13px] text-primary font-semibold hover:underline ml-1 cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
