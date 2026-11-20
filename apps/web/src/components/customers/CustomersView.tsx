import { useState, useTransition, useEffect } from 'react';
import { api, type CustomerItem } from '../../lib/api';
import { Search, UserPlus, X, Mail, Phone, Building, Calendar, Ticket } from 'lucide-react';

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
    } catch (err) {
      alert((err as Error).message || 'Error creating customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="customers-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">
            View customer profiles, contact information, and support history.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3.5 py-2 rounded-lg shadow-sm transition-colors"
          data-testid="add-customer-btn"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, email, or company..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            data-testid="customer-search-input"
          />
        </div>
        <div className="text-xs text-slate-500">
          Total: <span className="font-semibold text-slate-700">{customers.length}</span>
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500" data-testid="customers-loading">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 bg-slate-200 rounded w-full"></div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600">
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={() => fetchCustomers(debouncedSearch)}
              className="mt-3 px-3 py-1 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200 hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center text-slate-500" data-testid="customers-empty">
            <p className="font-medium text-sm">No customers found</p>
            <p className="text-xs text-slate-400 mt-1">
              Add a customer or try adjusting your search terms
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="customers-table">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Tickets</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50 transition-colors"
                    data-testid={`customer-row-${c.id}`}
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
                          {c.name.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{c.name}</div>
                          <div className="text-xs text-slate-400">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {c.company ? (
                        <div className="flex items-center space-x-1.5 text-xs">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.company}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 text-xs">
                      {c.phone || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        <Ticket className="w-3 h-3 text-slate-500" />
                        <span>{c.ticketCount}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setSelectedCustomer(c)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                        data-testid={`view-customer-${c.id}`}
                      >
                        Details
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
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          data-testid="customer-details-modal"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg uppercase">
                  {selectedCustomer.name.slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedCustomer.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {selectedCustomer.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
                data-testid="close-details-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3 text-sm">
              <div className="flex items-center space-x-3 text-slate-600">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{selectedCustomer.email}</span>
              </div>
              <div className="flex items-center space-x-3 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{selectedCustomer.phone || 'No phone number provided'}</span>
              </div>
              <div className="flex items-center space-x-3 text-slate-600">
                <Building className="w-4 h-4 text-slate-400" />
                <span>{selectedCustomer.company || 'No company listed'}</span>
              </div>
              <div className="flex items-center space-x-3 text-slate-600">
                <Ticket className="w-4 h-4 text-slate-400" />
                <span>{selectedCustomer.ticketCount} total tickets filed</span>
              </div>
              <div className="flex items-center space-x-3 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>
                  Member since {new Date(selectedCustomer.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 text-sm bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
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
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          data-testid="add-customer-modal"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Add New Customer</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  data-testid="customer-name-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="e.g. jane@acme.corp"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  data-testid="customer-email-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
                <input
                  type="text"
                  value={addForm.company}
                  onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="e.g. +1 (555) 019-2834"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50"
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
