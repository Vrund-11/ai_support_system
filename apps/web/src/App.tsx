import { useState, lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApolloProvider } from '@apollo/client/react';
import { apolloClient } from './lib/apollo';
import { useAuthStore } from './store/auth.store';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { Shell, type NavTab } from './components/layout/Shell';
import { TicketInbox } from './components/tickets/TicketInbox';
import { TicketDetail } from './components/tickets/TicketDetail';
import { CreateTicketModal } from './components/tickets/CreateTicketModal';
import { ToastContainer } from './components/common/ToastContainer';
import { OfflineBanner } from './components/common/OfflineBanner';
import { PublicTicketTracker } from './components/help/PublicTicketTracker';

// Lazy-loaded secondary tab modules for performance & code-splitting
const KnowledgeBaseView = lazy(() =>
  import('./components/knowledge/KnowledgeBaseView').then((m) => ({
    default: m.KnowledgeBaseView,
  })),
);
const LiveChatView = lazy(() =>
  import('./components/chat/LiveChatView').then((m) => ({ default: m.LiveChatView })),
);
const AnalyticsDashboard = lazy(() =>
  import('./components/analytics/AnalyticsDashboard').then((m) => ({
    default: m.AnalyticsDashboard,
  })),
);
const SettingsView = lazy(() =>
  import('./components/settings/SettingsView').then((m) => ({ default: m.SettingsView })),
);
const HelpCenterView = lazy(() =>
  import('./components/help/HelpCenterView').then((m) => ({ default: m.HelpCenterView })),
);
const CustomersView = lazy(() =>
  import('./components/customers/CustomersView').then((m) => ({ default: m.CustomersView })),
);
const TeamView = lazy(() =>
  import('./components/team/TeamView').then((m) => ({ default: m.TeamView })),
);
const AutomationView = lazy(() =>
  import('./components/automation/AutomationView').then((m) => ({ default: m.AutomationView })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppContent() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [authView, setAuthView] = useState<'login' | 'register' | 'track'>('login');
  const [currentTab, setCurrentTab] = useState<NavTab>('inbox');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  if (!isAuthenticated) {
    if (authView === 'register') {
      return <RegisterForm onSwitchToLogin={() => setAuthView('login')} />;
    }
    if (authView === 'track') {
      return (
        <div className="min-h-screen bg-slate-50/60 dark:bg-zinc-950 px-4 py-8 sm:py-12 flex flex-col items-center">
          <div className="w-full max-w-4xl space-y-4">
            <button
              type="button"
              onClick={() => setAuthView('login')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>← Back to Sign In</span>
            </button>
            <PublicTicketTracker onBack={() => setAuthView('login')} />
          </div>
        </div>
      );
    }
    return (
      <LoginForm
        onSwitchToRegister={() => setAuthView('register')}
        onSwitchToTrack={() => setAuthView('track')}
      />
    );
  }

  return (
    <Shell
      activeTab={currentTab}
      onOpenCreateModal={() => setIsCreateOpen(true)}
      onNavigateInbox={() => {
        setSelectedTicketId(null);
        setCurrentTab('inbox');
      }}
      onNavigateTab={(tab) => {
        setSelectedTicketId(null);
        setCurrentTab(tab);
      }}
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-16 text-xs text-slate-400 dark:text-zinc-500 font-mono">
            Loading view...
          </div>
        }
      >
        {currentTab === 'kb' && <KnowledgeBaseView />}

        {currentTab === 'chats' && <LiveChatView />}

        {currentTab === 'customers' && <CustomersView />}

        {currentTab === 'team' && <TeamView />}

        {currentTab === 'automation' && <AutomationView />}

        {currentTab === 'analytics' && <AnalyticsDashboard />}

        {currentTab === 'settings' && <SettingsView />}

        {currentTab === 'help' && <HelpCenterView />}
      </Suspense>

      {currentTab === 'inbox' &&
        (selectedTicketId ? (
          <TicketDetail ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
        ) : (
          <TicketInbox
            onSelectTicket={(id) => setSelectedTicketId(id)}
            onOpenCreate={() => setIsCreateOpen(true)}
          />
        ))}

      <CreateTicketModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(id) => {
          setCurrentTab('inbox');
          setSelectedTicketId(id);
        }}
      />
    </Shell>
  );
}

export function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <QueryClientProvider client={queryClient}>
        <OfflineBanner />
        <AppContent />
        <ToastContainer />
      </QueryClientProvider>
    </ApolloProvider>
  );
}

export default App;
