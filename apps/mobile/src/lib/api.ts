import { useAuthStore } from './auth.store.js';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export class MobileApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:4000') {
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const { accessToken, tenantId } = useAuthStore.getState();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    if (tenantId) {
      headers['x-tenant-id'] = tenantId;
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = `Request failed with status ${res.status}`;
      try {
        const errJson = await res.json();
        errorMsg = errJson.detail || errJson.title || errJson.error || errorMsg;
      } catch {
        // fallback to default
      }
      throw new Error(errorMsg);
    }

    return res.json();
  }

  // Auth Endpoints
  readonly auth = {
    login: async (credentials: { email: string; password: string }) => {
      return this.request<{ accessToken: string; refreshToken: string; user: any }>(
        '/api/v1/auth/login',
        {
          method: 'POST',
          body: JSON.stringify(credentials),
        },
      );
    },
    refreshToken: async (refreshToken: string) => {
      return this.request<{ accessToken: string; refreshToken: string }>('/api/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    },
  };

  // Ticket Endpoints (MOB-2, MOB-3)
  readonly tickets = {
    list: async (params: { status?: string; page?: number; limit?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.status) q.set('status', params.status);
      if (params.page) q.set('page', params.page.toString());
      if (params.limit) q.set('limit', params.limit.toString());
      return this.request<{ data: any[]; meta: any }>(`/api/v1/tickets?${q.toString()}`);
    },
    getById: async (ticketId: string) => {
      return this.request<{ data: any; events: any[]; messages: any[] }>(
        `/api/v1/tickets/${ticketId}`,
      );
    },
    update: async (ticketId: string, changes: Record<string, any>) => {
      return this.request<{ data: any }>(`/api/v1/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      });
    },
    reply: async (
      ticketId: string,
      payload: { body: string; isInternal?: boolean; attachments?: any[] },
    ) => {
      return this.request<{ data: any }>(`/api/v1/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
  };

  // AI Assistance Endpoints (MOB-5)
  readonly ai = {
    suggestReply: async (ticketId: string, customerQuery: string) => {
      return this.request<{ suggestion: string; citations: any[] }>(
        '/api/v1/ai/assist/suggest-reply',
        {
          method: 'POST',
          body: JSON.stringify({ ticketId, customerQuery }),
        },
      );
    },
    summarize: async (ticketId: string, messages: any[]) => {
      return this.request<{ summary: string; sentiment: string; keyPoints: string[] }>(
        '/api/v1/ai/assist/summarize',
        {
          method: 'POST',
          body: JSON.stringify({ ticketId, messages }),
        },
      );
    },
  };

  readonly notifications = {
    list: async () => {
      return this.request<{ data: any[] }>('/api/v1/notifications');
    },
  };
}

export const mobileApi = new MobileApiClient();
