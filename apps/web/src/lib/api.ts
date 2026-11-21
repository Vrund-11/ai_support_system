import type {
  TicketDto,
  MessageDto,
  TicketEventDto,
  TicketStatus,
  TicketPriority,
  UserDto,
  ApiResponse,
  RuleDto,
  SlaPolicy,
  Role,
} from '@supportpilot/shared-types';
export type { RuleTriggerEvent, RuleCondition, RuleAction } from '@supportpilot/shared-types';
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
    async forgotPassword(email: string): Promise<{ message: string }> {
      const res = await request<{ data: { message: string } }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return res.data;
    },
    async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
      const res = await request<{ data: { message: string } }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      return res.data;
    },
    async verifyEmail(token: string): Promise<{ message: string }> {
      const res = await request<{ data: { message: string } }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      return res.data;
    },
  },

  publicTickets: {
    async track(
      ticketNumber: number | string,
      email: string,
    ): Promise<{
      ticket: {
        id: string;
        number: number;
        subject: string;
        description: string;
        status: TicketStatus;
        priority: TicketPriority;
        createdAt: string;
        updatedAt: string;
      };
      timeline: TicketEventDto[];
      messages: MessageDto[];
    }> {
      const res = await request<
        ApiResponse<{
          ticket: {
            id: string;
            number: number;
            subject: string;
            description: string;
            status: TicketStatus;
            priority: TicketPriority;
            createdAt: string;
            updatedAt: string;
          };
          timeline: TicketEventDto[];
          messages: MessageDto[];
        }>
      >(
        `/tickets/public/track?ticketNumber=${encodeURIComponent(ticketNumber)}&email=${encodeURIComponent(email)}`,
      );
      return res.data;
    },
    async submitOffline(payload: {
      tenantId: string;
      name: string;
      email: string;
      subject: string;
      description: string;
      priority?: TicketPriority;
    }): Promise<{ id: string; number: number; subject: string; status: TicketStatus }> {
      const res = await request<
        ApiResponse<{ id: string; number: number; subject: string; status: TicketStatus }>
      >('/tickets/public', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
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

    async bulk(payload: {
      ticketIds: string[];
      action: 'ASSIGN' | 'TAG' | 'STATUS';
      value: string;
    }): Promise<{ updatedCount: number }> {
      const res = await request<ApiResponse<{ updatedCount: number }>>('/tickets/bulk', {
        method: 'POST',
        body: JSON.stringify(payload),
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

  apiKeys: {
    async list(): Promise<ApiKeyItem[]> {
      const res = await request<{ data: ApiKeyItem[] }>('/api-keys');
      return res.data;
    },
    async create(name: string, scopes?: string[]): Promise<CreatedApiKey> {
      const res = await request<{ data: CreatedApiKey }>('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name, scopes }),
      });
      return res.data;
    },
    async revoke(id: string): Promise<void> {
      await request<void>(`/api-keys/${id}`, { method: 'DELETE' });
    },
  },

  webhooks: {
    async list(): Promise<WebhookItem[]> {
      const res = await request<{ data: WebhookItem[] }>('/webhooks');
      return res.data;
    },
    async create(url: string, events?: string[], description?: string): Promise<WebhookItem> {
      const res = await request<{ data: WebhookItem }>('/webhooks', {
        method: 'POST',
        body: JSON.stringify({ url, events, description }),
      });
      return res.data;
    },
    async delete(id: string): Promise<void> {
      await request<void>(`/webhooks/${id}`, { method: 'DELETE' });
    },
    async test(id: string): Promise<{ delivered: boolean; signature: string }> {
      const res = await request<{ data: { delivered: boolean; signature: string } }>(
        `/webhooks/${id}/test`,
        { method: 'POST' },
      );
      return res.data;
    },
  },

  auditLogs: {
    async list(limit: number = 50, action?: string): Promise<AuditLogItem[]> {
      const q = new URLSearchParams();
      q.set('limit', limit.toString());
      if (action) q.set('action', action);
      const res = await request<{ data: AuditLogItem[] }>(`/audit-logs?${q.toString()}`);
      return res.data;
    },
  },

  featureFlags: {
    async list(): Promise<FeatureFlagItem[]> {
      const res = await request<{ data: FeatureFlagItem[] }>('/feature-flags');
      return res.data;
    },
    async toggle(key: string, enabled: boolean): Promise<FeatureFlagItem> {
      const res = await request<{ data: FeatureFlagItem }>(`/feature-flags/${key}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      return res.data;
    },
  },

  admin: {
    async listTenants(): Promise<PlatformTenantItem[]> {
      const res = await request<{ data: PlatformTenantItem[] }>('/admin/tenants');
      return res.data;
    },
    async updateTenantStatus(id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
      await request<void>(`/admin/tenants/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    async getHealth(): Promise<{ status: string; database: string; uptimeSeconds: number }> {
      const res = await request<{
        data: { status: string; database: string; uptimeSeconds: number };
      }>('/admin/health');
      return res.data;
    },
  },

  customers: {
    async list(params?: { q?: string; limit?: number }): Promise<CustomerItem[]> {
      const q = new URLSearchParams();
      if (params?.q) q.set('q', params.q);
      if (params?.limit) q.set('limit', params.limit.toString());
      const res = await request<{ data: CustomerItem[] }>(
        `/customers${q.toString() ? `?${q.toString()}` : ''}`,
      );
      return res.data || [];
    },
    async get(id: string): Promise<CustomerItem> {
      const res = await request<{ data: CustomerItem }>(`/customers/${id}`);
      return res.data;
    },
    async create(payload: {
      name: string;
      email: string;
      phone?: string;
      company?: string;
    }): Promise<CustomerItem> {
      const res = await request<{ data: CustomerItem }>('/customers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },
  },

  team: {
    async list(): Promise<TeamMemberItem[]> {
      const res = await request<{ data: TeamMemberItem[] }>('/team');
      return res.data || [];
    },
    async invite(payload: { email: string; name: string; role: Role }): Promise<TeamMemberItem> {
      const res = await request<{ data: TeamMemberItem }>('/team/invite', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },
  },

  automation: {
    async listRules(): Promise<RuleDto[]> {
      const res = await request<{ data?: RuleDto[]; rules?: RuleDto[] }>('/rules');
      return res.data || res.rules || [];
    },
    async createRule(payload: Partial<RuleDto>): Promise<RuleDto> {
      const res = await request<{ data?: RuleDto } & RuleDto>('/rules', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data || (res as RuleDto);
    },
    async toggleRule(id: string, enabled: boolean): Promise<RuleDto> {
      const res = await request<{ data?: RuleDto } & RuleDto>(`/rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      return res.data || (res as RuleDto);
    },
    async deleteRule(id: string): Promise<void> {
      await request<void>(`/rules/${id}`, { method: 'DELETE' });
    },
    async getSlaPolicies(): Promise<Record<TicketPriority, SlaPolicy>> {
      const res = await request<{ data: Record<TicketPriority, SlaPolicy> }>('/rules/sla');
      return res.data;
    },
    async updateSlaPolicies(
      policies: Record<TicketPriority, SlaPolicy>,
    ): Promise<Record<TicketPriority, SlaPolicy>> {
      const res = await request<{ data: Record<TicketPriority, SlaPolicy> }>('/rules/sla', {
        method: 'PUT',
        body: JSON.stringify(policies),
      });
      return res.data;
    },
  },

  notifications: {
    async list(): Promise<NotificationItem[]> {
      const res = await request<{ data: NotificationItem[] }>('/notifications');
      return res.data || [];
    },
    async markAsRead(id: string): Promise<void> {
      await request<void>(`/notifications/${id}/read`, { method: 'POST' });
    },
    async markAllAsRead(): Promise<void> {
      await request<void>('/notifications/read-all', { method: 'POST' });
    },
  },
};

export interface CustomerItem {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  ticketCount: number;
  createdAt: string;
}

export interface TeamMemberItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'TICKET_ASSIGNED' | 'SLA_WARNING' | 'CUSTOMER_REPLY' | 'SYSTEM';
  read: boolean;
  ticketId?: string;
  createdAt: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt?: string;
  createdAt: string;
}

export interface CreatedApiKey extends ApiKeyItem {
  rawKey: string;
}

export interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  description?: string;
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface FeatureFlagItem {
  key: string;
  name: string;
  enabled: boolean;
  description?: string;
  updatedAt: string;
}

export interface PlatformTenantItem {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: 'ACTIVE' | 'SUSPENDED';
  userCount: number;
  ticketCount: number;
  createdAt: string;
}
