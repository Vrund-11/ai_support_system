import type { Redis } from 'ioredis';
import type { StoredMessage } from './sequence.js';

export type ConversationState = 'BOT' | 'WAITING_AGENT' | 'AGENT_ACTIVE' | 'CLOSED';

export interface HandoffTrigger {
  triggered: boolean;
  type?: 'HUMAN_REQUEST' | 'BLOCKLIST' | 'LOW_CONFIDENCE';
  reason?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface TicketCreatePayload {
  tenantId: string;
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreatedTicketResult {
  id: string;
  number: number;
}

export interface AiAnswerResult {
  answer: string;
  citations: Array<{ chunk_id: string; doc_id: string; title: string }>;
  confidence: number;
  should_escalate: boolean;
  reason?: string;
}

export interface HandoffServiceOptions {
  ticketServiceUrl?: string;
  serviceToken?: string;
  aiServiceUrl?: string;
  ticketCreator?: (payload: TicketCreatePayload) => Promise<CreatedTicketResult>;
  aiAnswerProvider?: (req: {
    tenantId: string;
    conversationId: string;
    question: string;
    history: Array<{ role: string; content: string }>;
  }) => Promise<AiAnswerResult>;
  redisClient?: Redis;
}

export const HUMAN_REQUEST_PATTERNS = [
  /\b(talk|speak|chat)\s+to\s+(an?\s+)?(human|person|agent|representative|rep|specialist)\b/i,
  /\bhuman\s+agent\b/i,
  /\breal\s+person\b/i,
  /\boperator\b/i,
  /\btransfer\s+me\b/i,
  /\bagent\s+please\b/i,
  /\bescalate\b/i,
];

export const DEFAULT_BLOCKLIST = [
  'legal',
  'lawyer',
  'attorney',
  'lawsuit',
  'subpoena',
  'fraud',
  'scam',
  'vulnerability',
  'exploit',
  'security breach',
  'data leak',
];

export function checkHumanRequest(text: string): boolean {
  return HUMAN_REQUEST_PATTERNS.some((pattern) => pattern.test(text));
}

export function checkBlocklist(
  text: string,
  blocklist: string[] = DEFAULT_BLOCKLIST,
): { isBlocked: boolean; matchedTerm?: string } {
  const lower = text.toLowerCase();
  for (const term of blocklist) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(lower)) {
      return { isBlocked: true, matchedTerm: term };
    }
  }
  return { isBlocked: false };
}

export function formatTranscript(
  conversationId: string,
  messages: StoredMessage[],
  reason?: string,
): string {
  const header = `--- Live Chat Transcript: Conversation ${conversationId} ---\n`;
  const body = messages
    .map(
      (m) =>
        `[${m.createdAt}] ${m.senderType} (${m.senderId}): ${m.body}` +
        (Array.isArray(m.attachments) && m.attachments.length > 0
          ? ` [Attachments: ${m.attachments.length}]`
          : ''),
    )
    .join('\n');
  const footer = `\n--- End of Transcript ---` + (reason ? `\nEscalation Reason: ${reason}` : '');
  return header + body + footer;
}

export class HandoffService {
  private redis?: Redis;
  private memoryStates: Map<string, ConversationState> = new Map();
  private memoryTickets: Map<string, CreatedTicketResult> = new Map();
  private ticketServiceUrl: string;
  private serviceToken: string;
  private aiServiceUrl: string;
  private ticketCreator?: (payload: TicketCreatePayload) => Promise<CreatedTicketResult>;
  private aiAnswerProvider?: (req: {
    tenantId: string;
    conversationId: string;
    question: string;
    history: Array<{ role: string; content: string }>;
  }) => Promise<AiAnswerResult>;

  constructor(options: HandoffServiceOptions = {}) {
    this.redis = options.redisClient;
    this.ticketServiceUrl =
      options.ticketServiceUrl || process.env['TICKET_SERVICE_URL'] || 'http://localhost:4001';
    this.serviceToken =
      options.serviceToken || process.env['SERVICE_TOKEN'] || 'default-service-token';
    this.aiServiceUrl =
      options.aiServiceUrl || process.env['AI_SERVICE_URL'] || 'http://localhost:8000';
    this.ticketCreator = options.ticketCreator;
    this.aiAnswerProvider = options.aiAnswerProvider;
  }

  async getConversationState(conversationId: string): Promise<ConversationState> {
    if (this.redis) {
      const state = await this.redis.get(`conv:${conversationId}:state`);
      if (state) return state as ConversationState;
    }
    return this.memoryStates.get(conversationId) || 'BOT';
  }

  async setConversationState(
    conversationId: string,
    state: ConversationState,
    ttlSeconds = 86400,
  ): Promise<void> {
    this.memoryStates.set(conversationId, state);
    if (this.redis) {
      await this.redis.set(`conv:${conversationId}:state`, state, 'EX', ttlSeconds);
    }
  }

  async getCreatedTicket(conversationId: string): Promise<CreatedTicketResult | null> {
    if (this.redis) {
      const raw = await this.redis.get(`conv:${conversationId}:ticket`);
      if (raw) return JSON.parse(raw) as CreatedTicketResult;
    }
    return this.memoryTickets.get(conversationId) || null;
  }

  async recordCreatedTicket(
    conversationId: string,
    ticket: CreatedTicketResult,
    ttlSeconds = 86400,
  ): Promise<void> {
    this.memoryTickets.set(conversationId, ticket);
    if (this.redis) {
      await this.redis.set(
        `conv:${conversationId}:ticket`,
        JSON.stringify(ticket),
        'EX',
        ttlSeconds,
      );
    }
  }

  evaluateImmediateTriggers(text: string): HandoffTrigger {
    // 1. Human agent request
    if (checkHumanRequest(text)) {
      return {
        triggered: true,
        type: 'HUMAN_REQUEST',
        reason: 'Customer requested human agent assistance',
        priority: 'MEDIUM',
      };
    }

    // 2. Blocklist topic
    const blockCheck = checkBlocklist(text);
    if (blockCheck.isBlocked) {
      return {
        triggered: true,
        type: 'BLOCKLIST',
        reason: `Topic matched sensitive blocklist: '${blockCheck.matchedTerm}'`,
        priority: 'HIGH',
      };
    }

    return { triggered: false };
  }

  async requestAiAnswer(
    tenantId: string,
    conversationId: string,
    question: string,
    history: StoredMessage[],
  ): Promise<AiAnswerResult> {
    const formattedHistory = history.map((m) => ({
      role: m.senderType === 'CUSTOMER' ? 'customer' : 'agent',
      content: m.body,
    }));

    if (this.aiAnswerProvider) {
      return this.aiAnswerProvider({
        tenantId,
        conversationId,
        question,
        history: formattedHistory,
      });
    }

    try {
      const response = await fetch(`${this.aiServiceUrl}/v1/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          conversation_id: conversationId,
          question,
          history: formattedHistory,
        }),
      });

      if (!response.ok) {
        return {
          answer: 'Connecting you with a support representative...',
          citations: [],
          confidence: 0.0,
          should_escalate: true,
          reason: `AI service returned HTTP ${response.status}`,
        };
      }

      return (await response.json()) as AiAnswerResult;
    } catch (err) {
      return {
        answer: 'Connecting you with a support representative...',
        citations: [],
        confidence: 0.0,
        should_escalate: true,
        reason: err instanceof Error ? err.message : 'AI service unavailable',
      };
    }
  }

  async createEscalationTicket(
    tenantId: string,
    conversationId: string,
    messages: StoredMessage[],
    reason: string,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = 'MEDIUM',
  ): Promise<CreatedTicketResult> {
    // Check if ticket already created for this conversation
    const existing = await this.getCreatedTicket(conversationId);
    if (existing) {
      return existing;
    }

    const transcript = formatTranscript(conversationId, messages, reason);
    const subject = `Live Chat Handoff (${conversationId.slice(0, 8)}) - ${reason.slice(0, 40)}`;

    const payload: TicketCreatePayload = {
      tenantId,
      subject,
      description: transcript,
      priority,
      tags: ['live-chat', 'escalated'],
      metadata: {
        conversationId,
        escalationReason: reason,
      },
    };

    let result: CreatedTicketResult;
    if (this.ticketCreator) {
      result = await this.ticketCreator(payload);
    } else {
      try {
        const res = await fetch(`${this.ticketServiceUrl}/api/v1/tickets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-token': this.serviceToken,
            'x-tenant-id': tenantId,
          },
          body: JSON.stringify({
            subject: payload.subject,
            description: payload.description,
            priority: payload.priority,
            tags: payload.tags,
          }),
        });

        if (!res.ok) {
          throw new Error(
            `Failed to create escalation ticket in ticket-service: HTTP ${res.status}`,
          );
        }

        const body = (await res.json()) as { ticket?: { id: string; number: number } };
        result = {
          id: body.ticket?.id || `tkt_${Date.now()}`,
          number: body.ticket?.number || Math.floor(Math.random() * 1000) + 1,
        };
      } catch {
        result = {
          id: `tkt_offline_${Date.now()}`,
          number: Math.floor(Math.random() * 1000) + 1,
        };
      }
    }

    await this.recordCreatedTicket(conversationId, result);
    return result;
  }
}
