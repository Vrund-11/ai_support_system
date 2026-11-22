import { useState, useRef, useEffect, useCallback } from 'react';
import type { Citation } from '@supportpilot/shared-types';
import { useAuthStore } from '../store/auth.store';

export interface StreamingDraftState {
  draftText: string;
  isThinking: boolean;
  isStreaming: boolean;
  citations: Citation[];
  confidence: number | null;
  shouldEscalate: boolean;
  error: string | null;
}

export function useStreamingDraft() {
  const [state, setState] = useState<StreamingDraftState>({
    draftText: '',
    isThinking: false,
    isStreaming: false,
    citations: [],
    confidence: null,
    shouldEscalate: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isThinking: false,
      isStreaming: false,
    }));
  }, []);

  const startStream = useCallback(
    async (params: {
      ticketId: string;
      customerQuery: string;
      contextChunks?: string[];
      tenantId?: string;
    }) => {
      abortStream();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState({
        draftText: '',
        isThinking: true, // Thinking indicator active within 150ms
        isStreaming: true,
        citations: [],
        confidence: null,
        shouldEscalate: false,
        error: null,
      });

      try {
        const authTenantId = useAuthStore.getState().user?.tenantId;
        const tenantId = params.tenantId || authTenantId;
        if (!tenantId) {
          throw new Error('Tenant ID is required for AI draft stream');
        }

        const token =
          useAuthStore.getState().accessToken ||
          localStorage.getItem('supportpilot_token') ||
          localStorage.getItem('token') ||
          sessionStorage.getItem('token') ||
          '';

        const res = await fetch('/api/v1/ai/draft/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ticket_id: params.ticketId,
            customer_query: params.customerQuery,
            context_chunks: params.contextChunks || [],
            tenant_id: tenantId,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`AI Streaming failed with HTTP ${res.status}`);
        }

        if (!res.body) {
          throw new Error('ReadableStream not supported by response body');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.type === 'token' && typeof data.content === 'string') {
                setState((prev) => ({
                  ...prev,
                  isThinking: false,
                  draftText: prev.draftText + data.content,
                }));
              } else if (data.type === 'done') {
                setState((prev) => ({
                  ...prev,
                  isThinking: false,
                  isStreaming: false,
                  citations: data.citations || [],
                  confidence: typeof data.confidence === 'number' ? data.confidence : null,
                  shouldEscalate: Boolean(data.shouldEscalate),
                }));
              }
            } catch {
              // Ignore partial JSON parse errors
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        setState((prev) => ({
          ...prev,
          isThinking: false,
          isStreaming: false,
          error: err.message || 'Stream encounter error',
        }));
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setState((prev) => ({
          ...prev,
          isThinking: false,
          isStreaming: false,
        }));
      }
    },
    [abortStream],
  );

  useEffect(() => {
    return () => {
      abortStream();
    };
  }, [abortStream]);

  return {
    ...state,
    startStream,
    abortStream,
  };
}
