import { useAuthStore } from '../../store/auth.store';
import { api } from '../../lib/api';
import { LogOut, Inbox, PlusCircle, ShieldCheck } from 'lucide-react';

interface ShellProps {
  children: React.ReactNode;
  onOpenCreateModal: () => void;
  onNavigateInbox: () => void;
}

export function Shell({ children, onOpenCreateModal, onNavigateInbox }: ShellProps) {
  const user = useAuthStore((s) => s.user);

  const handleLogout = async () => {
    await api.auth.logout();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button
              onClick={onNavigateInbox}
              className="flex items-center space-x-2 text-indigo-600 font-bold text-lg hover:text-indigo-700"
            >
              <ShieldCheck className="w-6 h-6" />
              <span>SupportPilot</span>
            </button>
            <nav className="flex items-center space-x-2">
              <button
                onClick={onNavigateInbox}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <Inbox className="w-4 h-4" />
                <span>Inbox</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={onOpenCreateModal}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-md shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New Ticket</span>
            </button>

            {user && (
              <div className="flex items-center space-x-3 border-l border-slate-200 pl-4">
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-800">{user.name}</div>
                  <div className="text-xs text-slate-500 flex items-center justify-end space-x-1">
                    <span className="inline-block bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-600 uppercase">
                      {user.role}
                    </span>
                    <span className="text-[11px] truncate max-w-[120px]">{user.email}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
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
