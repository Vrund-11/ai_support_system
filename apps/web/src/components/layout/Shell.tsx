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
    if (tab === 'inbox') {
      onNavigateInbox();
    }
    if (onNavigateTab) {
      onNavigateTab(tab);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button
              onClick={() => handleNav('inbox')}
              className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold text-lg hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              <ShieldCheck className="w-6 h-6" />
              <span>SupportPilot</span>
            </button>
            <nav className="hidden lg:flex items-center space-x-1">
              <button
                onClick={() => handleNav('inbox')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'inbox'
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                data-testid="nav-inbox"
              >
                <Inbox className="w-4 h-4" />
                <span>Inbox</span>
              </button>
              <button
                onClick={() => handleNav('chats')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'chats'
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                data-testid="nav-chats"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Live Chats</span>
              </button>
              <button
                onClick={() => handleNav('kb')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'kb'
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                data-testid="nav-kb"
              >
                <BookOpen className="w-4 h-4" />
                <span>Knowledge</span>
              </button>
              <button
                onClick={() => handleNav('customers')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'customers'
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                data-testid="nav-customers"
              >
                <Users className="w-4 h-4" />
                <span>Customers</span>
              </button>
              <button
                onClick={() => handleNav('team')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'team'
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                data-testid="nav-team"
              >
                <UserCheck className="w-4 h-4" />
                <span>Team</span>
              </button>
              <button
                onClick={() => handleNav('automation')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'automation'
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                data-testid="nav-automation"
              >
                <Zap className="w-4 h-4" />
                <span>Automation</span>
              </button>
              <button
                onClick={() => handleNav('analytics')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'analytics'
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                data-testid="nav-analytics"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Analytics</span>
              </button>
              <button
                onClick={() => handleNav('settings')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'settings'
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                data-testid="nav-settings"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </button>
              <button
                onClick={() => handleNav('help')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'help'
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                data-testid="nav-help"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Help</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center space-x-3">
            {/* New Ticket */}
            <button
              onClick={onOpenCreateModal}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-md shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">New Ticket</span>
            </button>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDark((prev) => !prev)}
              className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              data-testid="dark-mode-toggle"
            >
              {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* User Profile */}
            {user && (
              <div className="flex items-center space-x-3 border-l border-slate-200 dark:border-slate-800 pl-3">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {user.name}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center justify-end space-x-1">
                    <span className="inline-block bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-600 dark:text-slate-400 uppercase">
                      {user.role}
                    </span>
                    <span className="text-[11px] truncate max-w-[100px]">{user.email}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                  data-testid="logout-button"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
}
