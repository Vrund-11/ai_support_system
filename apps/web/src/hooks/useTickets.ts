import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type TicketFilterParams,
  type CreateTicketPayload,
  type UpdateTicketPayload,
} from '../lib/api';
import type { TicketDto } from '@supportpilot/shared-types';
import { useOptimisticMutation } from '../lib/optimistic';

export function useTickets(filters: TicketFilterParams = {}) {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => api.tickets.list(filters),
    staleTime: 15_000,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTicketPayload) => api.tickets.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useUpdateTicket(ticketId: string) {
  return useOptimisticMutation({
    queryKey: ['ticket', ticketId],
    mutationFn: (payload: UpdateTicketPayload) => api.tickets.update(ticketId, payload),
    applyOptimistic: (
      old: { ticket: TicketDto; timeline: unknown[]; messages: unknown[] } | undefined,
      payload: UpdateTicketPayload,
    ) => {
      if (!old) return old;
      return {
        ...old,
        ticket: {
          ...old.ticket,
          ...payload,
          updatedAt: new Date().toISOString(),
        },
      };
    },
    conflictMessage: 'This ticket was updated by someone else. Reloading...',
    errorMessage: 'Failed to update ticket. Reverted changes.',
  });
}

export function useAddMessage(ticketId: string) {
  return useOptimisticMutation({
    queryKey: ['ticket', ticketId],
    mutationFn: ({
      body,
      isInternal,
      clientId,
    }: {
      body: string;
      isInternal: boolean;
      clientId?: string;
    }) => api.tickets.addMessage(ticketId, body, isInternal, clientId),
    applyOptimistic: (
      old: { ticket: TicketDto; timeline: unknown[]; messages: any[] } | undefined,
      vars: { body: string; isInternal: boolean; clientId?: string },
    ) => {
      if (!old) return old;
      const optimisticMsg = {
        id: vars.clientId || `pending_${Date.now()}`,
        clientId: vars.clientId,
        ticketId,
        seq: (old.messages?.length || 0) + 1,
        senderType: 'AGENT',
        body: vars.body,
        isInternal: vars.isInternal,
        pending: true,
        createdAt: new Date().toISOString(),
      };
      return {
        ...old,
        messages: [...(old.messages || []), optimisticMsg],
      };
    },
    errorMessage: "Couldn't send message. Reverted.",
  });
}

export function useTicketDetail(ticketId: string | null) {
  return useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => {
      if (!ticketId) throw new Error('Ticket ID is required');
      return api.tickets.get(ticketId);
    },
    enabled: Boolean(ticketId),
    staleTime: 0,
  });
}
