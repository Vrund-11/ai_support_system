import type {
  TicketDto,
  MessageDto,
  TicketEventDto,
  TicketStatus,
  TicketPriority,
  UserDto,
  ApiResponse,
} from '@supportpilot/shared-types';
import { useAuthStore } from '../store/auth.store';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public title: string,
    public detail?: string,
    public data?: unknown,
  ) {
    super(detail || title);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 204) {
    return {} as T;
  }

  let body: unknown = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    body = await res.json();
  }

  if (!res.ok) {
    const errorBody = body as { title?: string; detail?: string } | null;
    const title = errorBody?.title || res.statusText || 'Request failed';
    const detail = errorBody?.detail;
    throw new ApiError(res.status, title, detail, body);
  }

  return body as T;
}

export interface TicketFilterParams {
  status?: TicketStatus | '';
  priority?: TicketPriority | '';
  assigneeId?: string;
  tag?: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface TicketDetailResponse {
  ticket: TicketDto;
  timeline: TicketEventDto[];
  messages: MessageDto[];
}

export interface CreateTicketPayload {
  subject: string;
  description: string;
  priority?: TicketPriority;
  customerId?: string;
  customerEmail?: string;
  tags?: string[];
}

export interface UpdateTicketPayload {
  version: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string;
  tags?: string[];
}

export interface SuggestReplyPayload {
  tenantId: string;
  ticketId?: string;
  conversationId?: string;
  messages: Array<{
    role: 'customer' | 'agent' | 'system';
    content: string;
  }>;
}

export interface SuggestReplyResult {
  suggestion: string;
  confidence: number;
  citations: Array<{
    chunkId: string;
    docId: string;
    title: string;
  }>;
  latencyMs: number;
}

export interface SummarizePayload {
  tenantId: string;
  ticketId?: string;
  conversationId?: string;
  messages: Array<{
    role: 'customer' | 'agent' | 'system';
    content: string;
  }>;
}

export interface SummarizeResult {
  summary: string;
  keyPoints: string[];
  sentiment: 'URGENT' | 'FRUSTRATED' | 'POSITIVE' | 'NEUTRAL';
  recommendedAction: string;
  latencyMs: number;
}

export interface AnalyticsOverview {
  open: number;
  newToday: number;
  medianFirstResponseMin: number;
  medianResolutionMin: number;
  slaCompliance: number;
  deflectionRate: number;
}

export interface VolumeAnalytics {
  rangeDays: number;
  totalTickets: number;
  byCategory: Array<{ category: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  timeline: Array<{ date: string; created: number; resolved: number }>;
}

export interface SlaAnalytics {
  rangeDays: number;
  totalEvaluated: number;
  breachedCount: number;
  complianceRate: number;
  firstResponseTimeMin: { p50: number; p90: number; p99: number };
  resolutionTimeMin: { p50: number; p90: number; p99: number };
}

export interface AgentPerformance {
  rangeDays: number;
  agents: Array<{
    agentId: string;
    name: string;
    email: string;
    assignedCount: number;
    resolvedCount: number;
    avgResolutionTimeMin: number;
    slaComplianceRate: number;
  }>;
}

export interface DeflectionAnalytics {
  rangeDays: number;
  totalInquiries: number;
  botResolvedCount: number;
  humanEscalatedCount: number;
  deflectionRate: number;
}

export const api = {
  auth: {
    async login(email: string, password: string): Promise<{ user: UserDto; accessToken: string }> {
      const res = await request<ApiResponse<{ user: UserDto; accessToken: string }>>(
        '/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
      );
      return res.data;
    },
    async register(data: {
      email: string;
      password: string;
      name: string;
      tenantName: string;
    }): Promise<{ user: UserDto; accessToken: string }> {
      const res = await request<ApiResponse<{ user: UserDto; accessToken: string }>>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
      return res.data;
    },
    async logout(): Promise<void> {
      try {
        await request<void>('/auth/logout', { method: 'POST' });
      } finally {
        useAuthStore.getState().clearAuth();
      }
    },
  },

  tickets: {
    async list(
      params: TicketFilterParams = {},
    ): Promise<{ data: TicketDto[]; meta?: { cursor?: string; hasMore?: boolean } }> {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      if (params.priority) query.set('priority', params.priority);
      if (params.assigneeId) query.set('assigneeId', params.assigneeId);
      if (params.tag) query.set('tag', params.tag);
      if (params.q) query.set('q', params.q);
      if (params.cursor) query.set('cursor', params.cursor);
      if (params.limit) query.set('limit', String(params.limit));

      const qs = query.toString();
      return request<{ data: TicketDto[]; meta?: { cursor?: string; hasMore?: boolean } }>(
        `/tickets${qs ? `?${qs}` : ''}`,
      );
    },

    async get(id: string): Promise<TicketDetailResponse> {
      const res = await request<ApiResponse<TicketDetailResponse>>(`/tickets/${id}`);
      return res.data;
    },

    async create(payload: CreateTicketPayload): Promise<TicketDto> {
      const res = await request<ApiResponse<TicketDto>>('/tickets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },

    async update(id: string, payload: UpdateTicketPayload): Promise<TicketDto> {
      const res = await request<ApiResponse<TicketDto>>(`/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return res.data;
    },

    async addMessage(ticketId: string, body: string, isInternal = false): Promise<MessageDto> {
      const res = await request<ApiResponse<MessageDto>>(`/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body, isInternal }),
      });
      return res.data;
    },
  },

  kb: {
    async list(): Promise<
      Array<{
        id: string;
        title: string;
        source: string;
        status: string;
        chunksCount: number;
        updatedAt: string;
      }>
    > {
      const res = await request<{
        data: Array<{
          id: string;
          title: string;
          source: string;
          status: string;
          chunksCount: number;
          updatedAt: string;
        }>;
      }>('/kb/documents');
      return res.data || [];
    },

    async get(id: string): Promise<{
      id: string;
      title: string;
      source: string;
      status: string;
      chunksCount: number;
      updatedAt: string;
    }> {
      const res = await request<{
        data: {
          id: string;
          title: string;
          source: string;
          status: string;
          chunksCount: number;
          updatedAt: string;
        };
      }>(`/kb/documents/${id}`);
      return res.data;
    },

    async presign(
      filename: string,
      contentType: string,
      sizeBytes: number,
    ): Promise<{
      uploadUrl: string;
      key: string;
      expiresAt: string;
    }> {
      return request<{ uploadUrl: string; key: string; expiresAt: string }>('/kb/uploads/presign', {
        method: 'POST',
        body: JSON.stringify({ filename, contentType, sizeBytes }),
      });
    },

    async register(payload: {
      title: string;
      source: string;
      key?: string;
      contentType?: string;
    }): Promise<{
      documentId: string;
      title: string;
      status: string;
      chunksCount: number;
    }> {
      return request<{ documentId: string; title: string; status: string; chunksCount: number }>(
        '/kb/documents',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );
    },
  },

  ai: {
    async suggestReply(payload: SuggestReplyPayload): Promise<SuggestReplyResult> {
      return request<SuggestReplyResult>('/ai/assist/suggest-reply', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async summarize(payload: SummarizePayload): Promise<SummarizeResult> {
      return request<SummarizeResult>('/ai/assist/summarize', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  },

  analytics: {
    async getOverview(rangeDays: number = 7): Promise<AnalyticsOverview> {
      const res = await request<{ data: AnalyticsOverview }>(
        `/analytics/overview?rangeDays=${rangeDays}`,
      );
      return res.data;
    },

    async getVolume(rangeDays: number = 7): Promise<VolumeAnalytics> {
      const res = await request<{ data: VolumeAnalytics }>(
        `/analytics/volume?rangeDays=${rangeDays}`,
      );
      return res.data;
    },

    async getSla(rangeDays: number = 30): Promise<SlaAnalytics> {
      const res = await request<{ data: SlaAnalytics }>(`/analytics/sla?rangeDays=${rangeDays}`);
      return res.data;
    },

    async getAgents(rangeDays: number = 30): Promise<AgentPerformance> {
      const res = await request<{ data: AgentPerformance }>(
        `/analytics/agents?rangeDays=${rangeDays}`,
      );
      return res.data;
    },

    async getDeflection(rangeDays: number = 30): Promise<DeflectionAnalytics> {
      const res = await request<{ data: DeflectionAnalytics }>(
        `/analytics/deflection?rangeDays=${rangeDays}`,
      );
      return res.data;
    },
  },
};
