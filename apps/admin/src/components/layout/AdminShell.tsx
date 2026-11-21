import React from 'react';
import {
  LayoutDashboard,
  UserPlus,
  CreditCard,
  Building2,
  ShieldAlert,
  LogOut,
  Moon,
  Sun,
  Radio,
} from 'lucide-react';
import { useAdminAuthStore } from '../../store/admin-auth.store';

export type AdminTab = 'overview' | 'registrations' | 'subscriptions' | 'tenants' | 'audit';

interface AdminShellProps {
  children: React.ReactNode;
  activeTab: AdminTab;
  onNavigateTab: (tab: AdminTab) => void;
  badgeCounts?: {
    registrations?: number;
    subscriptions?: number;
    tenants?: number;
  };
}

export function AdminShell({
  children,
  activeTab,
  onNavigateTab,
  badgeCounts = {},
}: AdminShellProps) {
  const user = useAdminAuthStore((s) => s.user);
  const logout = useAdminAuthStore((s) => s.logout);
  const [isDark, setIsDark] = React.useState(true);

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const navItems = [
    {
      tab: 'overview' as AdminTab,
      label: 'Platform Overview',
      icon: LayoutDashboard,
      testId: 'tab-overview',
    },
    {
      tab: 'registrations' as AdminTab,
      label: 'New Registrations',
      icon: UserPlus,
      badge: badgeCounts.registrations,
      testId: 'tab-registrations',
    },
    {
      tab: 'subscriptions' as AdminTab,
      label: 'Paid Subscriptions & MRR',
      icon: CreditCard,
      badge: badgeCounts.subscriptions,
      testId: 'tab-subscriptions',
    },
    {
      tab: 'tenants' as AdminTab,
      label: 'Tenant Fleet',
      icon: Building2,
      badge: badgeCounts.tenants,
      testId: 'tab-tenants',
    },
    {
      tab: 'audit' as AdminTab,
      label: 'Security Audit Trail',
      icon: ShieldAlert,
      testId: 'tab-audit',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top NOC Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Badges */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">
                  SupportPilot <span className="text-indigo-400 font-mono text-sm">SuperAdmin</span>
                </span>
                <span
                  data-testid="port-indicator"
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700"
                >
                  PORT: 3001
                </span>
                <div
                  data-testid="root-access-badge"
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-mono font-bold"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                  ROOT ACCESS
                </div>
              </div>
            </div>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-mono bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/50">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>CLUSTER: US-EAST-1 &bull; OK</span>
            </div>

            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-slate-200">
                {user?.email || 'admin@supportpilot.io'}
              </div>
              <div className="text-[10px] font-mono text-indigo-400">ROLE: SUPERADMIN</div>
            </div>

            {/* Dark mode toggle */}
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg bg-slate-800/70 border border-slate-700/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              data-testid="admin-dark-toggle"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Logout button */}
            <button
              type="button"
              onClick={logout}
              data-testid="admin-logout-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="border-t border-slate-800/80 bg-slate-900/60">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-2 overflow-x-auto py-1 scrollbar-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.tab}
                  data-testid={item.testId}
                  onClick={() => onNavigateTab(item.tab)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                        isActive ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-indigo-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
}
