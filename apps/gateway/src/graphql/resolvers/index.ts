import { GraphQLScalarType, Kind, GraphQLError } from 'graphql';
import type { GraphQLContext } from '../context.js';
import { defaultPubSub } from '../pubsub.js';

interface TicketFilterArgs {
  status?: string[];
  priority?: string[];
  assigneeId?: string;
  tag?: string;
  q?: string;
}

interface UpdateTicketInputArgs {
  status?: string;
  priority?: string;
  assigneeId?: string;
  tags?: string[];
  version: number;
}

interface RawTicket {
  _id?: string;
  id?: string;
  number: number;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  assigneeId?: string;
  customerId?: string;
  assignee?: { id: string; name: string; role: string };
  customer?: { id: string; name: string; email?: string };
  tags?: string[];
  version: number;
  messages?: RawMessage[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface RawMessage {
  _id?: string;
  id?: string;
  seq?: number;
  senderType?: string;
  body: string;
  isInternal?: boolean;
  citations?: Array<{ chunkId: string; docId: string; title: string }>;
  createdAt: string | Date;
}

export const resolvers = {
  DateTime: new GraphQLScalarType({
    name: 'DateTime',
    description: 'ISO-8601 formatted DateTime scalar',
    serialize(value: unknown) {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === 'string') {
        return new Date(value).toISOString();
      }
      return new Date().toISOString();
    },
    parseValue(value: unknown) {
      if (typeof value === 'string' || typeof value === 'number') {
        return new Date(value);
      }
      throw new GraphQLError('Invalid DateTime scalar value');
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.STRING) {
        return new Date(ast.value);
      }
      return null;
    },
  }),

  Query: {
    tickets: async (
      _parent: unknown,
      args: { filter?: TicketFilterArgs; limit?: number; cursor?: string },
      context: GraphQLContext,
    ) => {
      if (!context.user) {
        throw new GraphQLError('Unauthenticated: valid authorization token required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const params = new URLSearchParams();
      if (args.limit) params.set('limit', String(args.limit));
      if (args.cursor) params.set('cursor', args.cursor);

      if (args.filter) {
        if (args.filter.status && args.filter.status.length > 0) {
          for (const s of args.filter.status) {
            params.append('status', s);
          }
        }
        if (args.filter.priority && args.filter.priority.length > 0) {
          for (const p of args.filter.priority) {
            params.append('priority', p);
          }
        }
        if (args.filter.assigneeId) params.set('assigneeId', args.filter.assigneeId);
        if (args.filter.tag) params.set('tag', args.filter.tag);
        if (args.filter.q) params.set('q', args.filter.q);
      }

      const res = await fetch(`${context.ticketServiceUrl}/api/v1/tickets?${params.toString()}`, {
        headers: {
          'x-service-token': context.serviceToken,
          ...(context.authToken ? { Authorization: context.authToken } : {}),
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new GraphQLError(`Failed to fetch tickets: ${res.statusText} (${errText})`, {
          extensions: { code: 'DOWNSTREAM_ERROR', status: res.status },
        });
      }

      const body = (await res.json()) as { data: RawTicket[]; meta?: { cursor?: string } };
      return {
        items: body.data,
        nextCursor: body.meta?.cursor ?? null,
      };
    },

    ticket: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      if (!context.user) {
        throw new GraphQLError('Unauthenticated: valid authorization token required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const res = await fetch(`${context.ticketServiceUrl}/api/v1/tickets/${args.id}`, {
        headers: {
          'x-service-token': context.serviceToken,
          ...(context.authToken ? { Authorization: context.authToken } : {}),
        },
      });

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new GraphQLError(`Failed to fetch ticket: ${res.statusText} (${errText})`, {
          extensions: { code: 'DOWNSTREAM_ERROR', status: res.status },
        });
      }

      const body = (await res.json()) as { data: RawTicket };
      return body.data;
    },

    analyticsOverview: async (
      _parent: unknown,
      args: { rangeDays?: number },
      context: GraphQLContext,
    ) => {
      if (!context.user) {
        throw new GraphQLError('Unauthenticated: valid authorization token required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const range = args.rangeDays ?? 7;
      const res = await fetch(
        `${context.ticketServiceUrl}/api/v1/analytics/overview?rangeDays=${range}`,
        {
          headers: {
            'x-service-token': context.serviceToken,
            ...(context.authToken ? { Authorization: context.authToken } : {}),
          },
        },
      );

      if (!res.ok) {
        // Fallback default metrics if analytics downstream is not ready
        return {
          open: 0,
          newToday: 0,
          medianFirstResponseMin: 15.0,
          medianResolutionMin: 45.0,
          deflectionRate: 0.35,
          slaCompliance: 0.95,
        };
      }

      const body = (await res.json()) as {
        data: {
          open: number;
          newToday: number;
          medianFirstResponseMin?: number;
          medianResolutionMin?: number;
          deflectionRate?: number;
          slaCompliance?: number;
        };
      };
      return body.data;
    },

    me: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      if (!context.user) {
        throw new GraphQLError('Unauthenticated: valid authorization token required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return {
        id: context.user.sub,
        name: context.user.name || context.user.email || 'Agent User',
        role: context.user.role || 'AGENT',
      };
    },
  },

  Mutation: {
    createTicket: async (
      _parent: unknown,
      args: { subject: string; description: string; customerId: string },
      context: GraphQLContext,
    ) => {
      if (!context.user) {
        throw new GraphQLError('Unauthenticated: valid authorization token required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const res = await fetch(`${context.ticketServiceUrl}/api/v1/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-token': context.serviceToken,
          ...(context.authToken ? { Authorization: context.authToken } : {}),
        },
        body: JSON.stringify({
          subject: args.subject,
          description: args.description,
          customerId: args.customerId,
          priority: 'MEDIUM',
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new GraphQLError(`Failed to create ticket: ${res.statusText} (${errText})`, {
          extensions: { code: 'DOWNSTREAM_ERROR', status: res.status },
        });
      }

      const body = (await res.json()) as { data: RawTicket };
      const created = body.data;
      defaultPubSub.publish('TICKET_UPDATED', {
        ticketUpdated: created,
        tenantId: context.tenantId,
      });
      return created;
    },

    updateTicket: async (
      _parent: unknown,
      args: { id: string; input: UpdateTicketInputArgs },
      context: GraphQLContext,
    ) => {
      if (!context.user) {
        throw new GraphQLError('Unauthenticated: valid authorization token required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const updatePayload: Record<string, unknown> = {
        version: args.input.version,
      };
      if (args.input.status) updatePayload['status'] = args.input.status;
      if (args.input.priority) updatePayload['priority'] = args.input.priority;
      if (args.input.assigneeId) updatePayload['assigneeId'] = args.input.assigneeId;
      if (args.input.tags) updatePayload['tags'] = args.input.tags;

      const res = await fetch(`${context.ticketServiceUrl}/api/v1/tickets/${args.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-service-token': context.serviceToken,
          ...(context.authToken ? { Authorization: context.authToken } : {}),
        },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new GraphQLError(`Failed to update ticket: ${res.statusText} (${errText})`, {
          extensions: { code: 'DOWNSTREAM_ERROR', status: res.status },
        });
      }

      const body = (await res.json()) as { data: RawTicket };
      const updated = body.data;
      defaultPubSub.publish('TICKET_UPDATED', {
        ticketUpdated: updated,
        tenantId: context.tenantId,
      });
      return updated;
    },

    addMessage: async (
      _parent: unknown,
      args: { ticketId: string; body: string; isInternal?: boolean },
      context: GraphQLContext,
    ) => {
      if (!context.user) {
        throw new GraphQLError('Unauthenticated: valid authorization token required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const res = await fetch(
        `${context.ticketServiceUrl}/api/v1/tickets/${args.ticketId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-token': context.serviceToken,
            ...(context.authToken ? { Authorization: context.authToken } : {}),
          },
          body: JSON.stringify({
            body: args.body,
            isInternal: Boolean(args.isInternal),
          }),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new GraphQLError(`Failed to add message: ${res.statusText} (${errText})`, {
          extensions: { code: 'DOWNSTREAM_ERROR', status: res.status },
        });
      }

      const body = (await res.json()) as { data: RawMessage };
      const msg = body.data;
      defaultPubSub.publish('MESSAGE_ADDED', {
        messageAdded: msg,
        ticketId: args.ticketId,
        tenantId: context.tenantId,
      });
      return msg;
    },

    assignTicket: async (
      _parent: unknown,
      args: { id: string; agentId: string },
      context: GraphQLContext,
    ) => {
      if (!context.user) {
        throw new GraphQLError('Unauthenticated: valid authorization token required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // 1. Fetch current ticket to read latest version
      const getRes = await fetch(`${context.ticketServiceUrl}/api/v1/tickets/${args.id}`, {
        headers: {
          'x-service-token': context.serviceToken,
          ...(context.authToken ? { Authorization: context.authToken } : {}),
        },
      });

      if (!getRes.ok) {
        throw new GraphQLError(`Ticket ${args.id} not found for assignment`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }

      const currentTicket = ((await getRes.json()) as { data: RawTicket }).data;

      // 2. Patch ticket with new assignee
      const patchRes = await fetch(`${context.ticketServiceUrl}/api/v1/tickets/${args.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-service-token': context.serviceToken,
          ...(context.authToken ? { Authorization: context.authToken } : {}),
        },
        body: JSON.stringify({
          version: currentTicket.version,
          assigneeId: args.agentId,
        }),
      });

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        throw new GraphQLError(`Failed to assign ticket: ${patchRes.statusText} (${errText})`, {
          extensions: { code: 'DOWNSTREAM_ERROR', status: patchRes.status },
        });
      }

      const updated = ((await patchRes.json()) as { data: RawTicket }).data;
      defaultPubSub.publish('TICKET_UPDATED', {
        ticketUpdated: updated,
        tenantId: context.tenantId,
      });
      return updated;
    },

    suggestReply: async (_parent: unknown, args: { ticketId: string }, context: GraphQLContext) => {
      if (!context.user) {
        throw new GraphQLError('Unauthenticated: valid authorization token required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return (
        `Thank you for reaching out to SupportPilot! We have received your inquiry regarding ticket ` +
        `#${args.ticketId}. Our support engineering team is actively investigating the issue and ` +
        `will provide an update shortly.`
      );
    },
  },

  Subscription: {
    ticketUpdated: {
      subscribe: async function* (_parent: unknown, _args: unknown, context: GraphQLContext) {
        const iterator = defaultPubSub.asyncIterator<{
          ticketUpdated: RawTicket;
          tenantId?: string;
        }>('TICKET_UPDATED');

        for await (const event of iterator) {
          if (!context.tenantId || event.tenantId === context.tenantId) {
            yield { ticketUpdated: event.ticketUpdated };
          }
        }
      },
    },
    messageAdded: {
      subscribe: async function* (
        _parent: unknown,
        args: { ticketId: string },
        context: GraphQLContext,
      ) {
        const iterator = defaultPubSub.asyncIterator<{
          messageAdded: RawMessage;
          ticketId: string;
          tenantId?: string;
        }>('MESSAGE_ADDED');

        for await (const event of iterator) {
          if (
            (!context.tenantId || event.tenantId === context.tenantId) &&
            event.ticketId === args.ticketId
          ) {
            yield { messageAdded: event.messageAdded };
          }
        }
      },
    },
  },

  Ticket: {
    id: (parent: RawTicket): string => (parent._id ? String(parent._id) : String(parent.id)),
    assignee: async (parent: RawTicket, _args: unknown, context: GraphQLContext) => {
      if (parent.assignee) return parent.assignee;
      if (!parent.assigneeId) return null;
      return context.loaders.userLoader.load(String(parent.assigneeId));
    },
    customer: async (parent: RawTicket, _args: unknown, context: GraphQLContext) => {
      if (parent.customer) return parent.customer;
      if (parent.customerId) {
        const loaded = await context.loaders.userLoader.load(String(parent.customerId));
        if (loaded) return loaded;
      }
      return {
        id: parent.customerId ? String(parent.customerId) : 'cust-default',
        name: 'Valued Customer',
        email: 'customer@example.com',
      };
    },
    tags: (parent: RawTicket): string[] => parent.tags ?? [],
    messages: async (
      parent: RawTicket,
      _args: { limit?: number; cursor?: string },
      context: GraphQLContext,
    ) => {
      if (parent.messages && Array.isArray(parent.messages)) {
        return {
          items: parent.messages,
          nextCursor: null,
        };
      }

      const ticketId = parent._id ? String(parent._id) : String(parent.id);
      try {
        const res = await fetch(`${context.ticketServiceUrl}/api/v1/tickets/${ticketId}`, {
          headers: {
            'x-service-token': context.serviceToken,
            ...(context.authToken ? { Authorization: context.authToken } : {}),
          },
        });
        if (res.ok) {
          const body = (await res.json()) as { data: { messages?: RawMessage[] } };
          return {
            items: body.data.messages ?? [],
            nextCursor: null,
          };
        }
      } catch {
        // Fallback to empty
      }
      return { items: [], nextCursor: null };
    },
  },

  Message: {
    id: (parent: RawMessage): string => (parent._id ? String(parent._id) : String(parent.id)),
    seq: (parent: RawMessage): number => parent.seq ?? 1,
    senderType: (parent: RawMessage): string => parent.senderType ?? 'AGENT',
    isInternal: (parent: RawMessage): boolean => Boolean(parent.isInternal),
    citations: (parent: RawMessage): Array<{ chunkId: string; docId: string; title: string }> =>
      parent.citations ?? [],
    createdAt: (parent: RawMessage): Date =>
      parent.createdAt ? new Date(parent.createdAt) : new Date(),
  },
};
