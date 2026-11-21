import { useState, useTransition, useEffect } from 'react';
import { api, type CustomerItem } from '../../lib/api';
import { toast } from '../../store/toast.store';

export function CustomersView() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [, startTransition] = useTransition();

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', company: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCustomers = async (query = '') => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.customers.list({ q: query.trim() || undefined });
      setCustomers(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(debouncedSearch);
  }, [debouncedSearch]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    startTransition(() => {
      setDebouncedSearch(val);
    });
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email) return;

    try {
      setIsSubmitting(true);
      await api.customers.create({
        name: addForm.name.trim(),
        email: addForm.email.trim(),
        phone: addForm.phone.trim() || undefined,
        company: addForm.company.trim() || undefined,
      });
      setIsAddModalOpen(false);
      setAddForm({ name: '', email: '', phone: '', company: '' });
      await fetchCustomers(debouncedSearch);
      toast.success('Customer profile created successfully.');
    } catch (err) {
      toast.error((err as Error).message || 'Error creating customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalTickets = customers.reduce((acc, c) => acc + (c.ticketCount || 0), 0);

  return (
    <div className="space-y-space-lg" data-testid="customers-view">
      {/* Header & Command Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface p-space-md rounded-xl border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-space-xs font-body-sm text-body-sm text-text-secondary">
            <span>Customers</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-text-primary font-medium">Directory</span>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <h1 className="font-headline-lg text-headline-lg font-bold text-text-primary tracking-tight">
              Customers
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full font-body-sm text-body-sm font-semibold bg-primary-fixed text-primary border border-primary/20">
              {customers.length} Accounts
            </span>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-body-sm text-body-sm font-medium bg-ticket-open-bg text-ticket-open-text border border-ticket-open-text/20">
              <span className="w-1.5 h-1.5 rounded-full bg-ticket-open-text animate-pulse" />
              <span>Live Sync Active</span>
            </div>
          </div>
          <p className="font-body-md text-body-md text-text-secondary">
            View customer profiles, contact information, SLA status, and unified support history.
          </p>
        </div>

        <div className="flex items-center gap-space-sm flex-wrap shrink-0">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border text-text-primary font-headline-sm text-headline-sm hover:bg-surface-subtle transition-all shadow-xs"
          >
            <span
              className="material-symbols-outlined text-[18px] text-text-secondary"
              aria-hidden="true"
            >
              download
            </span>
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm shadow-xs transition-all cursor-pointer"
            data-testid="add-customer-btn"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              person_add
            </span>
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Top Metric Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        {/* Card 1: Total Customers */}
        <div className="p-space-lg rounded-xl bg-surface border border-border shadow-xs flex flex-col justify-between gap-space-md hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="font-body-sm text-body-sm text-text-secondary font-medium">
                Total Customers
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg font-bold text-text-primary">
                  {customers.length}
                </span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-body-sm text-body-sm font-semibold bg-ticket-open-bg text-ticket-open-text">
                  <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                  +8.4%
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">group</span>
            </div>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between font-body-sm text-body-sm text-text-secondary">
            <span>Enterprise &amp; Growth accounts</span>
            <span className="text-ticket-open-text font-medium">Synced today</span>
          </div>
        </div>

        {/* Card 2: Active Tickets */}
        <div className="p-space-lg rounded-xl bg-surface border border-border shadow-xs flex flex-col justify-between gap-space-md hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="font-body-sm text-body-sm text-text-secondary font-medium">
                Active Tickets
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg font-bold text-text-primary">
                  {totalTickets}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full font-body-sm text-body-sm font-medium bg-ticket-pending-bg text-ticket-pending-text">
                  In queue
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface-container-low text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">confirmation_number</span>
            </div>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between font-body-sm text-body-sm text-text-secondary">
            <span>Avg resolution time: 2.4h</span>
            <span className="text-ticket-open-text font-medium">99.2% SLA Met</span>
          </div>
        </div>

        {/* Card 3: AI Deflection */}
        <div className="p-space-lg rounded-xl bg-surface border border-border shadow-xs flex flex-col justify-between gap-space-md hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="font-body-sm text-body-sm text-text-secondary font-medium">
                Support Deflection
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-lg text-headline-lg font-bold text-text-primary">
                  44.6%
                </span>
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-body-sm text-body-sm font-semibold bg-ticket-open-bg text-ticket-open-text">
                  <span className="material-symbols-outlined text-[14px]">trending_up</span>
                  +4.2%
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-ticket-open-bg text-ticket-open-text flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">shield_with_heart</span>
            </div>
          </div>
          <div className="pt-2 border-t border-border flex items-center justify-between font-body-sm text-body-sm text-text-secondary">
            <span>AI Deflected Inquiries</span>
            <span className="text-ticket-open-text font-medium">High satisfaction</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-surface p-space-md rounded-xl border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-text-secondary text-[20px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, email, or company..."
            className="w-full pl-10 pr-14 py-2 bg-surface-subtle border border-border rounded-xl font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
            data-testid="customer-search-input"
          />
          <span className="absolute right-2.5 top-2.5 px-1.5 py-0.5 font-code-mono text-[10px] text-text-secondary bg-surface rounded border border-border shadow-xs">
            ⌘K
          </span>
        </div>
        <div className="flex items-center gap-3 font-body-sm text-body-sm text-text-secondary">
          <span className="px-2.5 py-1 rounded-md bg-surface-subtle font-medium text-text-primary">
            Total: <span className="font-semibold text-primary">{customers.length}</span>
          </span>
          <span className="hidden sm:inline text-border">•</span>
          <span className="hidden sm:inline">Showing all registered accounts</span>
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-surface rounded-xl border border-border shadow-xs overflow-hidden">
        {loading ? (
          <div
            className="p-8 text-center text-text-secondary font-body-sm"
            data-testid="customers-loading"
          >
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-surface-subtle rounded-lg w-full" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-error">
            <p className="font-body-md text-body-md font-semibold">{error}</p>
            <button
              onClick={() => fetchCustomers(debouncedSearch)}
              className="mt-3 px-3 py-1 bg-error-container text-on-error-container font-body-sm text-body-sm rounded-lg border border-error/20 hover:bg-error-container/80 font-medium"
            >
              Retry
            </button>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-text-secondary" data-testid="customers-empty">
            <div className="w-12 h-12 mx-auto rounded-full bg-surface-subtle flex items-center justify-center text-text-secondary mb-3">
              <span className="material-symbols-outlined text-[24px]">group</span>
            </div>
            <p className="font-headline-sm text-headline-sm font-semibold text-text-primary">
              No customers found
            </p>
            <p className="font-body-sm text-body-sm text-text-secondary mt-1">
              Add a customer or try adjusting your search terms
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-left font-body-md text-body-md"
              data-testid="customers-table"
            >
              <thead className="bg-surface-subtle border-b border-border text-[11px] font-code-mono uppercase tracking-wider text-text-secondary">
                <tr>
                  <th className="px-space-md py-3 font-medium">Customer</th>
                  <th className="px-space-md py-3 font-medium">Company</th>
                  <th className="px-space-md py-3 font-medium">Phone</th>
                  <th className="px-space-md py-3 font-medium">Tickets</th>
                  <th className="px-space-md py-3 font-medium">Joined</th>
                  <th className="px-space-md py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-surface-subtle/70 transition-colors group"
                    data-testid={`customer-row-${c.id}`}
                  >
                    <td className="px-space-md py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold font-code-mono text-xs uppercase shadow-xs">
                          {c.name.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                            {c.name}
                          </div>
                          <div className="font-code-mono text-code-mono text-text-secondary">
                            {c.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-space-md py-3.5 text-text-primary font-medium">
                      {c.company ? (
                        <div className="flex items-center gap-1.5 font-body-sm text-body-sm">
                          <span className="material-symbols-outlined text-[16px] text-text-secondary">
                            domain
                          </span>
                          <span>{c.company}</span>
                        </div>
                      ) : (
                        <span className="font-body-sm text-body-sm text-text-secondary">—</span>
                      )}
                    </td>
                    <td className="px-space-md py-3.5 font-code-mono text-code-mono text-text-secondary">
                      {c.phone ? <span>{c.phone}</span> : <span>—</span>}
                    </td>
                    <td className="px-space-md py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-body-sm text-body-sm font-medium bg-surface-subtle text-text-primary border border-border">
                        <span className="material-symbols-outlined text-[14px] text-text-secondary">
                          confirmation_number
                        </span>
                        <span>{c.ticketCount}</span>
                      </span>
                    </td>
                    <td className="px-space-md py-3.5 font-code-mono text-code-mono text-text-secondary">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-space-md py-3.5 text-right">
                      <button
                        onClick={() => setSelectedCustomer(c)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg font-body-sm text-body-sm font-medium text-primary bg-primary-fixed hover:bg-primary hover:text-on-primary transition-all cursor-pointer"
                        data-testid={`view-customer-${c.id}`}
                      >
                        <span>Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Customer Details Drawer / Modal */}
      {selectedCustomer && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          data-testid="customer-details-modal"
        >
          <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full p-space-lg space-y-space-md border border-border animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-space-xs border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold font-code-mono text-lg uppercase shadow-xs">
                  {selectedCustomer.name.slice(0, 2)}
                </div>
                <div>
                  <h3 className="font-headline-md text-headline-md font-bold text-text-primary">
                    {selectedCustomer.name}
                  </h3>
                  <p className="font-code-mono text-code-mono text-text-secondary">
                    ID: {selectedCustomer.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-surface-subtle transition-colors cursor-pointer"
                data-testid="close-details-btn"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <div className="pt-space-xs space-y-3 font-body-md text-body-md">
              <div className="flex items-center gap-3 text-text-primary">
                <span className="material-symbols-outlined text-[18px] text-text-secondary">
                  mail
                </span>
                <span className="font-code-mono text-code-mono">{selectedCustomer.email}</span>
              </div>
              <div className="flex items-center gap-3 text-text-primary">
                <span className="material-symbols-outlined text-[18px] text-text-secondary">
                  phone
                </span>
                <span>{selectedCustomer.phone || 'No phone number provided'}</span>
              </div>
              <div className="flex items-center gap-3 text-text-primary">
                <span className="material-symbols-outlined text-[18px] text-text-secondary">
                  domain
                </span>
                <span>{selectedCustomer.company || 'No company listed'}</span>
              </div>
              <div className="flex items-center gap-3 text-text-primary">
                <span className="material-symbols-outlined text-[18px] text-text-secondary">
                  confirmation_number
                </span>
                <span>{selectedCustomer.ticketCount} total tickets filed</span>
              </div>
              <div className="flex items-center gap-3 text-text-primary">
                <span className="material-symbols-outlined text-[18px] text-text-secondary">
                  calendar_today
                </span>
                <span>
                  Member since {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="pt-space-xs border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 font-body-sm text-body-sm font-medium bg-surface-subtle text-text-primary hover:bg-surface-container rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          data-testid="add-customer-modal"
        >
          <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full p-space-lg space-y-space-md border border-border animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-space-xs border-b border-border">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  person_add
                </span>
                <h3 className="font-headline-md text-headline-md font-bold text-text-primary">
                  Add New Customer
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-text-secondary hover:text-text-primary p-1 rounded-lg hover:bg-surface-subtle transition-colors cursor-pointer"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  close
                </span>
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-space-md">
              <div>
                <label className="block font-body-sm text-body-sm font-semibold text-text-primary mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-3 py-2 bg-surface-subtle border border-border rounded-xl font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  data-testid="customer-name-input"
                />
              </div>

              <div>
                <label className="block font-body-sm text-body-sm font-semibold text-text-primary mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="e.g. jane@acme.corp"
                  className="w-full px-3 py-2 bg-surface-subtle border border-border rounded-xl font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  data-testid="customer-email-input"
                />
              </div>

              <div>
                <label className="block font-body-sm text-body-sm font-semibold text-text-primary mb-1">
                  Company
                </label>
                <input
                  type="text"
                  value={addForm.company}
                  onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 py-2 bg-surface-subtle border border-border rounded-xl font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="block font-body-sm text-body-sm font-semibold text-text-primary mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="e.g. +1 (555) 019-2834"
                  className="w-full px-3 py-2 bg-surface-subtle border border-border rounded-xl font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
              </div>

              <div className="pt-space-xs flex items-center justify-end gap-space-sm border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 font-body-sm text-body-sm font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm font-semibold rounded-xl shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                  data-testid="save-customer-btn"
                >
                  {isSubmitting ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
