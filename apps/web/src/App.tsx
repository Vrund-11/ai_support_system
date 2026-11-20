import { useState } from 'react';
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
import { KnowledgeBaseView } from './components/knowledge/KnowledgeBaseView';
import { LiveChatView } from './components/chat/LiveChatView';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { SettingsView } from './components/settings/SettingsView';
import { HelpCenterView } from './components/help/HelpCenterView';
import { CustomersView } from './components/customers/CustomersView';
import { TeamView } from './components/team/TeamView';
import { AutomationView } from './components/automation/AutomationView';

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
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [currentTab, setCurrentTab] = useState<NavTab>('inbox');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  if (!isAuthenticated) {
    if (authView === 'register') {
      return <RegisterForm onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <LoginForm onSwitchToRegister={() => setAuthView('register')} />;
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
      {currentTab === 'kb' && <KnowledgeBaseView />}

      {currentTab === 'chats' && <LiveChatView />}

      {currentTab === 'customers' && <CustomersView />}

      {currentTab === 'team' && <TeamView />}

      {currentTab === 'automation' && <AutomationView />}

      {currentTab === 'analytics' && <AnalyticsDashboard />}

      {currentTab === 'settings' && <SettingsView />}

      {currentTab === 'help' && <HelpCenterView />}

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
        <AppContent />
      </QueryClientProvider>
    </ApolloProvider>
  );
}

export default App;
