import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth.store';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { Shell } from './components/layout/Shell';
import { TicketInbox } from './components/tickets/TicketInbox';
import { TicketDetail } from './components/tickets/TicketDetail';
import { CreateTicketModal } from './components/tickets/CreateTicketModal';

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
      onOpenCreateModal={() => setIsCreateOpen(true)}
      onNavigateInbox={() => setSelectedTicketId(null)}
    >
      {selectedTicketId ? (
        <TicketDetail ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
      ) : (
        <TicketInbox
          onSelectTicket={(id) => setSelectedTicketId(id)}
          onOpenCreate={() => setIsCreateOpen(true)}
        />
      )}

      <CreateTicketModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(id) => {
          setSelectedTicketId(id);
        }}
      />
    </Shell>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
