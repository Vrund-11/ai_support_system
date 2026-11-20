import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  type TicketFilterParams,
  type CreateTicketPayload,
  type UpdateTicketPayload,
} from '../lib/api';
import type { TicketDto } from '@supportpilot/shared-types';

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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateTicketPayload) => api.tickets.update(ticketId, payload),
    onSuccess: (updatedTicket: TicketDto) => {
      // Update ticket detail cache
      queryClient.setQueryData(
        ['ticket', ticketId],
        (old: { ticket: TicketDto; timeline: unknown[]; messages: unknown[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            ticket: updatedTicket,
          };
        },
      );
      // Invalidate ticket list
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useAddMessage(ticketId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ body, isInternal }: { body: string; isInternal: boolean }) =>
      api.tickets.addMessage(ticketId, body, isInternal),
    onSuccess: () => {
      // Refresh ticket detail to get new message and event timeline
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
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
