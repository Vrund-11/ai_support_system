import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { CustomersView } from '../components/customers/CustomersView';
import { api } from '../lib/api';
import { renderWithQueryClient } from './test-utils';
import { mockCustomer } from './mocks';

describe('CustomersView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders customer list and table', async () => {
    vi.spyOn(api.customers, 'list').mockResolvedValueOnce([mockCustomer]);

    renderWithQueryClient(<CustomersView />);

    await waitFor(() => {
      expect(screen.getByTestId('customers-table')).toBeInTheDocument();
    });

    expect(screen.getByText('Alice Customer')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('filters customers on search input change', async () => {
    const listSpy = vi.spyOn(api.customers, 'list').mockResolvedValue([mockCustomer]);

    renderWithQueryClient(<CustomersView />);

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith({ q: undefined });
    });

    const searchInput = screen.getByTestId('customer-search-input');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledWith({ q: 'Alice' });
    });
  });

  it('opens and closes customer details modal', async () => {
    vi.spyOn(api.customers, 'list').mockResolvedValueOnce([mockCustomer]);

    renderWithQueryClient(<CustomersView />);

    await waitFor(() => {
      expect(screen.getByTestId(`view-customer-${mockCustomer.id}`)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(`view-customer-${mockCustomer.id}`));

    expect(screen.getByTestId('customer-details-modal')).toBeInTheDocument();
    expect(screen.getByText(`ID: ${mockCustomer.id}`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('close-details-btn'));
    expect(screen.queryByTestId('customer-details-modal')).not.toBeInTheDocument();
  });

  it('opens add customer modal and creates customer', async () => {
    vi.spyOn(api.customers, 'list').mockResolvedValueOnce([mockCustomer]);
    const createSpy = vi.spyOn(api.customers, 'create').mockResolvedValueOnce({
      ...mockCustomer,
      id: 'cust_new',
      name: 'Bob Builder',
      email: 'bob@builder.com',
    });

    renderWithQueryClient(<CustomersView />);

    await waitFor(() => {
      expect(screen.getByTestId('add-customer-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('add-customer-btn'));
    expect(screen.getByTestId('add-customer-modal')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('customer-name-input'), {
      target: { value: 'Bob Builder' },
    });
    fireEvent.change(screen.getByTestId('customer-email-input'), {
      target: { value: 'bob@builder.com' },
    });

    fireEvent.click(screen.getByTestId('save-customer-btn'));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Bob Builder',
          email: 'bob@builder.com',
        }),
      );
    });
  });
});
