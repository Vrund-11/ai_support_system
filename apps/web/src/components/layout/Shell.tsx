import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { api } from '../../lib/api';
import { NotificationBell } from '../notifications/NotificationBell';
import {
  LogOut,
  Inbox,
  PlusCircle,
  ShieldCheck,
  MessageSquare,
  BookOpen,
  BarChart3,
  Settings,
  HelpCircle,
  Users,
  UserCheck,
  Zap,
  Sun,
  Moon,
  Search,
  Menu,
  X,
} from 'lucide-react';

export type NavTab =
  | 'inbox'
  | 'chats'
  | 'kb'
  | 'customers'
  | 'team'
  | 'automation'
  | 'analytics'
  | 'settings'
  | 'help';

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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const handleLogout = async () => {
    await api.auth.logout();
  };

  const handleNav = (tab: NavTab) => {
    setIsMobileMenuOpen(false);
    if (tab === 'inbox') {
      onNavigateInbox();
    }
    if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  const navItems: Array<{ tab: NavTab; label: string; icon: React.ReactNode; testId: string }> = [
    { tab: 'inbox', label: 'Inbox', icon: <Inbox className="w-3.5 h-3.5" />, testId: 'nav-inbox' },
    {
      tab: 'chats',
      label: 'Live Chats',
      icon: <MessageSquare className="w-3.5 h-3.5" />,
      testId: 'nav-chats',
    },
    { tab: 'kb', label: 'Knowledge', icon: <BookOpen className="w-3.5 h-3.5" />, testId: 'nav-kb' },
    {
      tab: 'customers',
      label: 'Customers',
      icon: <Users className="w-3.5 h-3.5" />,
      testId: 'nav-customers',
    },
    { tab: 'team', label: 'Team', icon: <UserCheck className="w-3.5 h-3.5" />, testId: 'nav-team' },
    {
      tab: 'automation',
      label: 'Automation',
      icon: <Zap className="w-3.5 h-3.5" />,
      testId: 'nav-automation',
    },
    {
      tab: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      testId: 'nav-analytics',
    },
    {
      tab: 'settings',
      label: 'Settings',
      icon: <Settings className="w-3.5 h-3.5" />,
      testId: 'nav-settings',
    },
    {
      tab: 'help',
      label: 'Help',
      icon: <HelpCircle className="w-3.5 h-3.5" />,
      testId: 'nav-help',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased transition-colors">
      {/* Frosted Glass Sticky Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-white/80 dark:bg-zinc-950/80 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand & Navigation */}
          <div className="flex items-center space-x-6 min-w-0">
            {/* Brand Logo with subtle gradient badge and status ping */}
            <button
              onClick={() => handleNav('inbox')}
              className="flex items-center space-x-2.5 group focus:outline-none"
              title="SupportPilot Home"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/25 ring-1 ring-white/20 transition-transform group-hover:scale-105">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <span className="font-semibold text-base tracking-tight text-zinc-900 dark:text-zinc-100 hidden sm:inline">
                Support<span className="text-indigo-600 dark:text-indigo-400">Pilot</span>
              </span>
              <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Live
              </span>
            </button>

            {/* Modern Navigation Pills */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navItems.map((item) => {
                const isActive = activeTab === item.tab;
                return (
                  <button
                    key={item.tab}
                    onClick={() => handleNav(item.tab)}
                    className={`flex items-center space-x-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all duration-150 ${
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 shadow-xs border border-indigo-200/50 dark:border-indigo-800/40 font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50 border border-transparent font-medium'
                    }`}
                    data-testid={item.testId}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Right: Actions, Keyboard Shortcut, Notifications, User */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0">
            {/* Keyboard shortcut indicator (⌘K pill) */}
            <div className="hidden xl:flex items-center space-x-2 text-xs text-zinc-400 dark:text-zinc-500 bg-zinc-100/70 dark:bg-zinc-900/70 px-2.5 py-1.5 rounded-lg border border-zinc-200/70 dark:border-zinc-800/70 shadow-2xs">
              <Search className="w-3.5 h-3.5 text-zinc-400" />
              <span>Quick search...</span>
              <kbd className="text-[10px] font-mono bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded shadow-2xs">
                ⌘K
              </kbd>
            </div>

            {/* New Ticket CTA */}
            <button
              onClick={onOpenCreateModal}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg shadow-sm shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-150 active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">New Ticket</span>
            </button>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDark((prev) => !prev)}
              className="p-2 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              data-testid="dark-mode-toggle"
            >
              {isDark ? (
                <Sun className="w-4.5 h-4.5 text-amber-400 transition-transform" />
              ) : (
                <Moon className="w-4.5 h-4.5 transition-transform" />
              )}
            </button>

            {/* Mobile Hamburger Toggle (<lg) */}
            <button
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-lg transition-colors"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              data-testid="mobile-menu-toggle"
            >
              {isMobileMenuOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
            </button>

            {/* Modern User Pill */}
            {user && (
              <div className="flex items-center space-x-2.5 pl-2 sm:pl-3 border-l border-zinc-200/80 dark:border-zinc-800/80">
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-semibold text-xs flex items-center justify-center ring-2 ring-white dark:ring-zinc-900 shadow-xs">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-zinc-950" />
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                    {user.name}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-end space-x-1.5 mt-0.5">
                    <span className="inline-block bg-zinc-100 dark:bg-zinc-800/90 border border-zinc-200/60 dark:border-zinc-700/60 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                      {user.role}
                    </span>
                    <span className="text-[11px] truncate max-w-[100px] text-zinc-400 dark:text-zinc-500">
                      {user.email}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-1.5 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                  data-testid="logout-button"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <nav
          className="lg:hidden border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md px-4 py-3 space-y-1 shadow-md z-20"
          data-testid="mobile-nav-drawer"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={`mobile-${item.tab}`}
                onClick={() => handleNav(item.tab)}
                className={`w-full flex items-center space-x-2.5 px-3 py-2 text-xs rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/40 font-semibold border border-indigo-200/50 dark:border-indigo-800/40'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50 font-medium'
                }`}
                data-testid={`mobile-${item.testId}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
}
