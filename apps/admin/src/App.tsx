import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdminAuthStore } from './store/admin-auth.store';
import { AdminLoginForm } from './components/auth/AdminLoginForm';
import { AdminShell, type AdminTab } from './components/layout/AdminShell';
import { OverviewView } from './components/views/OverviewView';
import { RegistrationsView } from './components/views/RegistrationsView';
import { SubscriptionsView } from './components/views/SubscriptionsView';
import { TenantsView } from './components/views/TenantsView';
import { AuditLogsView } from './components/views/AuditLogsView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function AdminAppContent() {
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated);
  const initialize = useAdminAuthStore((s) => s.initialize);
  const [currentTab, setCurrentTab] = useState<AdminTab>('overview');

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!isAuthenticated) {
    return <AdminLoginForm />;
  }

  return (
    <AdminShell
      activeTab={currentTab}
      onNavigateTab={(tab) => setCurrentTab(tab)}
      badgeCounts={{
        registrations: 5,
        subscriptions: 4,
        tenants: 48,
      }}
    >
      {currentTab === 'overview' && <OverviewView />}
      {currentTab === 'registrations' && <RegistrationsView />}
      {currentTab === 'subscriptions' && <SubscriptionsView />}
      {currentTab === 'tenants' && <TenantsView />}
      {currentTab === 'audit' && <AuditLogsView />}
    </AdminShell>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminAppContent />
    </QueryClientProvider>
  );
}

export default App;
