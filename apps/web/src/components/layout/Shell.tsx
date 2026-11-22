import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../lib/api';
import { NotificationBell } from '../notifications/NotificationBell';

export type NavTab =
  | 'inbox'
  | 'chats'
  | 'kb'
  | 'customers'
  | 'team'
  | 'automation'
  | 'analytics'
  | 'settings'
  | 'help'
  | 'admin';

interface ShellProps {
  children: React.ReactNode;
  activeTab?: NavTab;
  onOpenCreateModal: () => void;
  onNavigateInbox: () => void;
  onNavigateTab?: (tab: NavTab) => void;
}

export function Shell({
  children,
  activeTab = 'inbox',
  onOpenCreateModal,
  onNavigateInbox,
  onNavigateTab,
}: ShellProps) {
  const user = useAuthStore((s) => s.user);

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      localStorage.getItem('supportpilot_theme') === 'dark' ||
      document.documentElement.classList.contains('dark')
    );
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('supportpilot_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('supportpilot_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const handleLogout = async () => {
    await api.auth.logout();
  };

  const handleNav = (tab: NavTab) => {
    if (tab === 'inbox') {
      onNavigateInbox();
    }
    if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  const isOwner = user?.role === 'OWNER' || user?.role === 'PLATFORM_ADMIN';

  const prefetchChunk = (tab: NavTab) => {
    switch (tab) {
      case 'inbox':
        void import('../tickets/TicketInbox');
        break;
      case 'chats':
        void import('../chat/LiveChatView');
        break;
      case 'kb':
        void import('../knowledge/KnowledgeBaseView');
        break;
      case 'customers':
        void import('../customers/CustomersView');
        break;
      case 'team':
        void import('../team/TeamView');
        break;
      case 'automation':
        void import('../automation/AutomationView');
        break;
      case 'analytics':
        void import('../analytics/AnalyticsDashboard');
        break;
      case 'settings':
        void import('../settings/SettingsView');
        break;
      case 'help':
        void import('../help/HelpCenterView');
        break;
      case 'admin':
        void import('../admin/AdminCockpitView');
        break;
    }
  };

  const navItems: Array<{ tab: NavTab; label: string; icon: string; testId: string }> = [
    { tab: 'inbox', label: 'Tickets (Inbox)', icon: 'inbox', testId: 'nav-inbox' },
    { tab: 'chats', label: 'Live Chats', icon: 'chat', testId: 'nav-chats' },
    { tab: 'kb', label: 'Knowledge Base', icon: 'menu_book', testId: 'nav-kb' },
    { tab: 'customers', label: 'Customers', icon: 'group', testId: 'nav-customers' },
    { tab: 'team', label: 'Team', icon: 'badge', testId: 'nav-team' },
    { tab: 'automation', label: 'Automation & SLA', icon: 'bolt', testId: 'nav-automation' },
    { tab: 'analytics', label: 'Analytics', icon: 'monitoring', testId: 'nav-analytics' },
    { tab: 'settings', label: 'Settings', icon: 'settings', testId: 'nav-settings' },
    ...(isOwner
      ? [
          {
            tab: 'admin' as NavTab,
            label: 'Platform Cockpit',
            icon: 'admin_panel_settings',
            testId: 'nav-admin',
          },
        ]
      : []),
    { tab: 'help', label: 'Help', icon: 'help', testId: 'nav-help' },
  ];

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'SP';

  return (
    <div className="min-h-screen flex flex-col bg-background font-body-md text-body-md text-on-surface antialiased transition-colors">
      {/* Stitch Two-Tier Sticky Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-xl border-b border-border shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        {/* Tier 1: Brand Logo, Global Search & User Actions */}
        <div className="h-16 w-full px-margin flex items-center justify-between gap-gutter">
          {/* Brand Logo */}
          <div
            onClick={() => handleNav('inbox')}
            className="flex items-center gap-space-sm cursor-pointer select-none"
            title="SupportPilot Home"
          >
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
              <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
            </div>
            <span className="font-headline-sm text-headline-sm text-text-primary tracking-tight font-bold">
              SupportPilot
            </span>
          </div>

          {/* Central Search Omni-Input */}
          <div className="flex-1 max-w-xl mx-auto hidden md:block">
            <div className="relative flex items-center w-full">
              <span className="material-symbols-outlined absolute left-space-md text-text-secondary pointer-events-none text-[20px]">
                search
              </span>
              <input
                className="w-full h-10 pl-10 pr-20 bg-surface-subtle border border-border rounded-xl font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                placeholder="Search tickets, customers, or articles... (Press / to focus)"
                type="text"
              />
              <span className="absolute right-space-sm px-space-xs py-0.5 bg-surface border border-border rounded font-code-mono text-code-mono text-text-secondary shadow-sm">
                ⌘K
              </span>
            </div>
          </div>

          {/* Right Action Cluster */}
          <div className="flex items-center gap-space-sm sm:gap-space-md">
            {/* New Ticket Button */}
            <button
              onClick={onOpenCreateModal}
              className="h-9 px-3.5 rounded-xl bg-primary-container text-on-primary font-headline-sm text-body-sm inline-flex items-center gap-1.5 hover:bg-primary transition-all shadow-sm active:scale-95 font-medium cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span className="hidden sm:inline">New Ticket</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-space-sm rounded-lg hover:bg-surface-subtle text-text-secondary hover:text-on-surface transition-colors cursor-pointer"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              data-testid="dark-mode-toggle"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Notifications */}
            <NotificationBell />

            <div className="h-6 w-[1px] bg-border hidden sm:block"></div>

            {/* User Profile */}
            <div className="flex items-center gap-space-sm pl-space-xs">
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center ring-1 ring-border">
                  {userInitials}
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-ticket-open-text ring-2 ring-surface"></span>
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="font-headline-sm text-body-sm text-text-primary font-medium leading-none">
                  {user?.name || 'Agent'}
                </span>
                <span className="font-body-sm text-code-mono text-text-secondary mt-0.5">
                  {user?.role || 'AGENT'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-1.5 rounded-lg text-text-secondary hover:text-error hover:bg-surface-subtle transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tier 2: Horizontal Underline Navigation Strip */}
        <div className="h-12 w-full px-margin border-t border-border bg-surface flex items-center overflow-x-auto">
          <nav className="flex items-center gap-space-lg h-full">
            {navItems.map((item) => {
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={item.tab}
                  onClick={() => handleNav(item.tab)}
                  onMouseEnter={() => prefetchChunk(item.tab)}
                  onFocus={() => prefetchChunk(item.tab)}
                  className={`h-full inline-flex items-center gap-1.5 font-body-md text-body-md whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? 'text-primary font-semibold border-b-2 border-primary -mb-px'
                      : 'text-text-secondary hover:text-on-surface'
                  }`}
                  data-testid={item.testId}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full pt-28 flex-1 bg-background min-h-[calc(100vh-7rem)]">{children}</main>
    </div>
  );
}
