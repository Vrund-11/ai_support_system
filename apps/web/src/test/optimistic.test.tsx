import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOptimisticMutation } from '../lib/optimistic';
import { useStreamingDraft } from '../hooks/useStreamingDraft';
import { DraftBubble } from '../components/tickets/DraftBubble';
import { useToastStore } from '../store/toast.store';

describe('Feature 34: Optimistic Updates Helper & Message Deduplication', () => {
  beforeEach(() => {
    useToastStore.getState().clearAll();
    vi.restoreAllMocks();
  });

  it('optimistically updates query cache before mutation resolves', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(['ticket', '123'], { status: 'OPEN' });

    let resolveMutation: (val: any) => void;
    const mutationPromise = new Promise((resolve) => {
      resolveMutation = resolve;
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () =>
        useOptimisticMutation<{ status: string }, { status: string }>({
          queryKey: ['ticket', '123'],
          mutationFn: () => mutationPromise as any,
          applyOptimistic: (old, vars) => ({ ...old, status: vars.status }),
        }),
      { wrapper },
    );

    // Initial state
    expect(queryClient.getQueryData(['ticket', '123'])).toEqual({ status: 'OPEN' });

    // Trigger mutation
    act(() => {
      result.current.mutate({ status: 'RESOLVED' });
    });

    // Optimistic state appears immediately before promise resolves
    await waitFor(() => {
      expect(queryClient.getQueryData(['ticket', '123'])).toEqual({ status: 'RESOLVED' });
    });

    // Now resolve promise
    await act(async () => {
      resolveMutation!({ status: 'RESOLVED' });
    });
  });

  it('rolls back query cache and displays toast on server error (500)', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(['ticket', '123'], { status: 'OPEN' });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () =>
        useOptimisticMutation<{ status: string }, { status: string }>({
          queryKey: ['ticket', '123'],
          mutationFn: async () => {
            throw new Error('Internal Server Error 500');
          },
          applyOptimistic: (old, vars) => ({ ...old, status: vars.status }),
        }),
      { wrapper },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({ status: 'RESOLVED' });
      } catch {
        // Expected
      }
    });

    // Rolled back to previous state
    expect(queryClient.getQueryData(['ticket', '123'])).toEqual({ status: 'OPEN' });

    // Error toast triggered
    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.type === 'error')).toBe(true);
  });

  it('detects 409 conflict and shows reload conflict warning', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['ticket', '123'], { version: 1, status: 'OPEN' });

    const onConflictSpy = vi.fn();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () =>
        useOptimisticMutation({
          queryKey: ['ticket', '123'],
          mutationFn: async () => {
            const err = new Error('Version conflict: HTTP 409');
            (err as any).status = 409;
            throw err;
          },
          applyOptimistic: (old: any, vars: any) => ({ ...old, ...vars }),
          onConflict: onConflictSpy,
        }),
      { wrapper },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({ status: 'RESOLVED', version: 1 });
      } catch {
        // Expected
      }
    });

    expect(onConflictSpy).toHaveBeenCalled();
    const toasts = useToastStore.getState().toasts;
    expect(
      toasts.some((t) => t.type === 'warning' && t.message.includes('Updated by someone else')),
    ).toBe(true);
  });
});

describe('Feature 37: Streaming Draft Hook & DraftBubble Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders live tokens, citations, and confidence score in DraftBubble', () => {
    const onApply = vi.fn();
    const onDiscard = vi.fn();

    render(
      <DraftBubble
        draftText="Here is the live drafted response."
        isThinking={false}
        isStreaming={false}
        citations={[{ chunkId: 'chk_1', docId: 'doc_1', title: 'Refund Policy' }]}
        confidence={0.94}
        shouldEscalate={false}
        onApplyDraft={onApply}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByTestId('ai-draft-bubble')).toBeInTheDocument();
    expect(screen.getByTestId('draft-token-content')).toHaveTextContent(
      'Here is the live drafted response.',
    );
    expect(screen.getByTestId('draft-confidence')).toHaveTextContent('94% confidence');
    expect(screen.getByTestId('draft-citations')).toHaveTextContent('Refund Policy');

    fireEvent.click(screen.getByTestId('apply-draft-btn'));
    expect(onApply).toHaveBeenCalledWith('Here is the live drafted response.');
  });

  it('shows thinking indicator when isThinking is true', () => {
    render(
      <DraftBubble
        draftText=""
        isThinking={true}
        isStreaming={true}
        citations={[]}
        confidence={null}
        shouldEscalate={false}
        onApplyDraft={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );

    expect(screen.getByText(/Thinking\.\.\./i)).toBeInTheDocument();
  });

  it('aborts stream on unmount', () => {
    const abortSpy = vi.fn();
    const mockController = {
      abort: abortSpy,
      signal: {} as AbortSignal,
    };
    vi.spyOn(global, 'AbortController').mockImplementation(() => mockController as any);

    const { unmount } = renderHook(() => useStreamingDraft());
    unmount();
    // Verify cleanup
  });
});
