import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KnowledgeBaseView } from '../components/knowledge/KnowledgeBaseView';
import { renderWithQueryClient } from './test-utils';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    kb: {
      list: vi.fn(),
      get: vi.fn(),
      register: vi.fn(),
      presign: vi.fn(),
    },
  },
}));

describe('KnowledgeBaseView Component (S2-T14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when knowledge base has no documents', async () => {
    vi.mocked(api.kb.list).mockResolvedValue([]);

    renderWithQueryClient(<KnowledgeBaseView />);

    await waitFor(() => {
      expect(screen.getByText('No documents in Knowledge Base')).toBeInTheDocument();
    });
    expect(screen.getByText('Upload First Article')).toBeInTheDocument();
  });

  it('renders list of knowledge base documents with status chips and chunk counts', async () => {
    vi.mocked(api.kb.list).mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Authentication and Account Security',
        source: 'upload',
        status: 'READY',
        chunksCount: 6,
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'doc-2',
        title: 'Billing and Invoices Policy',
        source: 'manual',
        status: 'PROCESSING',
        chunksCount: 4,
        updatedAt: new Date().toISOString(),
      },
    ]);

    renderWithQueryClient(<KnowledgeBaseView />);

    await waitFor(() => {
      expect(screen.getByText('Authentication and Account Security')).toBeInTheDocument();
    });
    expect(screen.getByText('Billing and Invoices Policy')).toBeInTheDocument();
    expect(screen.getByText('6 chunks')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByText('PROCESSING')).toBeInTheDocument();
  });

  it('switches to test console and executes test retrieval query', async () => {
    const user = userEvent.setup();
    vi.mocked(api.kb.list).mockResolvedValue([]);

    renderWithQueryClient(<KnowledgeBaseView />);

    // Switch to Test Console tab
    const testTabButton = screen.getByRole('button', { name: /test console/i });
    await user.click(testTabButton);

    expect(screen.getByText('Ask Knowledge Base')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/How do I configure SAML SSO/i);
    await user.type(textarea, 'How do I configure SAML SSO in SupportPilot?');

    const submitBtn = screen.getByRole('button', { name: /Run Retrieval & Synthesis/i });
    await user.click(submitBtn);

    await waitFor(
      () => {
        expect(screen.getByText(/Calibrated Confidence/i)).toBeInTheDocument();
      },
      { timeout: 1500 },
    );

    expect(screen.getByText('94%')).toBeInTheDocument();
    expect(screen.getByText(/Verified Citations/i)).toBeInTheDocument();
    expect(screen.getByText(/GROUNDED & DEFLECTED/i)).toBeInTheDocument();
  });

  it('opens upload modal and registers new document', async () => {
    const user = userEvent.setup();
    vi.mocked(api.kb.list).mockResolvedValue([]);
    vi.mocked(api.kb.register).mockResolvedValue({
      documentId: 'doc-new-123',
      title: 'REST API Guide',
      status: 'READY',
      chunksCount: 5,
    });

    renderWithQueryClient(<KnowledgeBaseView />);

    const addDocBtn = screen.getByRole('button', { name: /Add Document/i });
    await user.click(addDocBtn);

    expect(screen.getByText('Add Article to Knowledge Base')).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText(/e\.g\. Account Security/i);
    await user.type(titleInput, 'REST API Guide');

    const ingestBtn = screen.getByRole('button', { name: /Ingest Document/i });
    await user.click(ingestBtn);

    await waitFor(() => {
      expect(api.kb.register).toHaveBeenCalledWith({
        title: 'REST API Guide',
        source: 'manual',
      });
    });
  });
});
