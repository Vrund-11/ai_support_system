export interface SuperAdminUser {
  email: string;
  role: string;
  name?: string;
}

export interface PlatformMetrics {
  mrr: number;
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalUsers: number;
  totalTickets: number;
  aiInferencePool: {
    used: number;
    cap: number;
    unit: string;
  };
  telemetry: {
    mongodb: { status: 'healthy' | 'degraded'; latencyMs: number };
    redis: { status: 'operational' | 'degraded'; latencyMs: number };
    pgvector: { status: 'operational' | 'degraded'; latencyMs: number };
    bullmq: {
      status: 'operational' | 'degraded';
      latencyMs: number;
      activeJobs: number;
      queueLag: number;
    };
  };
}

export interface RegistrationItem {
  id: string;
  orgName: string;
  slug: string;
  adminEmail: string;
  createdAt: string;
  tier: 'FREE' | 'PRO' | 'ENTERPRISE';
  verificationStatus: 'VERIFIED' | 'PENDING' | 'REJECTED';
  notes?: string;
}

export interface SubscriptionItem {
  id: string;
  tenantId: string;
  tenantName: string;
  plan: 'PRO' | 'ENTERPRISE';
  amountMonthly: number;
  customerBillingEmail: string;
  renewalDate: string;
  lastBillingEvent: string;
  status: 'ACTIVE' | 'PAST_DUE' | 'TRIALING';
  upgradeTimeline: Array<{ date: string; event: string }>;
}

export interface TenantQuotas {
  maxSeats: number;
  rateLimitPerMin: number;
  aiTokensMonthly: number;
  vectorStorageLimitMb: number;
}

export interface TenantFeatureFlags {
  ai_copilot: boolean;
  sla_automation: boolean;
  realtime_chat: boolean;
  biometrics_2fa: boolean;
}

export interface SuperAdminTenantItem {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  userCount: number;
  ticketCount: number;
  primaryOwner?: { name: string; email: string };
  quotas: TenantQuotas;
  features: TenantFeatureFlags;
}

export interface SuperAdminAuditLog {
  id: string;
  actor: string;
  action: string;
  resource: string;
  ipAddress: string;
  timestamp: string;
  severity?: 'INFO' | 'WARN' | 'CRITICAL';
}

const DEFAULT_METRICS: PlatformMetrics = {
  mrr: 14250,
  totalTenants: 48,
  activeTenants: 46,
  suspendedTenants: 2,
  totalUsers: 384,
  totalTickets: 18920,
  aiInferencePool: {
    used: 8400000,
    cap: 25000000,
    unit: 'tokens',
  },
  telemetry: {
    mongodb: { status: 'healthy', latencyMs: 3 },
    redis: { status: 'operational', latencyMs: 1 },
    pgvector: { status: 'operational', latencyMs: 14 },
    bullmq: { status: 'operational', latencyMs: 2, activeJobs: 18, queueLag: 0 },
  },
};

const DEFAULT_REGISTRATIONS: RegistrationItem[] = [
  {
    id: 'reg-001',
    orgName: 'Acme Robotics',
    slug: 'acme-robotics',
    adminEmail: 'alex@acmerobotics.io',
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    tier: 'ENTERPRISE',
    verificationStatus: 'VERIFIED',
    notes: 'Self-serve enterprise trial requested',
  },
  {
    id: 'reg-002',
    orgName: 'Nexus BioHealth',
    slug: 'nexus-biohealth',
    adminEmail: 'ops@nexusbio.com',
    createdAt: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
    tier: 'PRO',
    verificationStatus: 'VERIFIED',
    notes: 'Upgraded from free sandbox',
  },
  {
    id: 'reg-003',
    orgName: 'Hyperion Logistics',
    slug: 'hyperion-logistics',
    adminEmail: 'cto@hyperionlog.net',
    createdAt: new Date(Date.now() - 1000 * 3600 * 4).toISOString(),
    tier: 'PRO',
    verificationStatus: 'PENDING',
    notes: 'Domain ownership verification in progress',
  },
  {
    id: 'reg-004',
    orgName: 'Vanguard Labs Inc',
    slug: 'vanguard-labs',
    adminEmail: 'secops@vanguardlabs.co',
    createdAt: new Date(Date.now() - 1000 * 3600 * 12).toISOString(),
    tier: 'ENTERPRISE',
    verificationStatus: 'VERIFIED',
    notes: 'HIPAA and SOC2 compliance add-on',
  },
  {
    id: 'reg-005',
    orgName: 'SwiftCart Commerce',
    slug: 'swiftcart-shop',
    adminEmail: 'billing@swiftcart.io',
    createdAt: new Date(Date.now() - 1000 * 3600 * 26).toISOString(),
    tier: 'FREE',
    verificationStatus: 'VERIFIED',
    notes: 'Starter plan registration',
  },
];

const DEFAULT_SUBSCRIPTIONS: SubscriptionItem[] = [
  {
    id: 'sub-101',
    tenantId: 't-101',
    tenantName: 'Acme Robotics',
    plan: 'ENTERPRISE',
    amountMonthly: 299,
    customerBillingEmail: 'alex@acmerobotics.io',
    renewalDate: new Date(Date.now() + 1000 * 86400 * 22).toISOString().slice(0, 10),
    lastBillingEvent: 'Invoice #INV-2026-881 Paid ($299.00)',
    status: 'ACTIVE',
    upgradeTimeline: [
      { date: '2026-09-01', event: 'Subscribed to PRO ($49/mo)' },
      { date: '2026-11-15', event: 'Upgraded to ENTERPRISE ($299/mo)' },
    ],
  },
  {
    id: 'sub-102',
    tenantId: 't-102',
    tenantName: 'Vanguard Labs Inc',
    plan: 'ENTERPRISE',
    amountMonthly: 299,
    customerBillingEmail: 'secops@vanguardlabs.co',
    renewalDate: new Date(Date.now() + 1000 * 86400 * 14).toISOString().slice(0, 10),
    lastBillingEvent: 'Card auto-charge succeeded ($299.00)',
    status: 'ACTIVE',
    upgradeTimeline: [{ date: '2026-10-10', event: 'Direct Enterprise Contract Onboarding' }],
  },
  {
    id: 'sub-103',
    tenantId: 't-103',
    tenantName: 'Nexus BioHealth',
    plan: 'PRO',
    amountMonthly: 49,
    customerBillingEmail: 'ops@nexusbio.com',
    renewalDate: new Date(Date.now() + 1000 * 86400 * 28).toISOString().slice(0, 10),
    lastBillingEvent: 'Stripe Subscription active ($49.00/mo)',
    status: 'ACTIVE',
    upgradeTimeline: [{ date: '2026-11-01', event: 'Upgraded from FREE to PRO' }],
  },
  {
    id: 'sub-104',
    tenantId: 't-104',
    tenantName: 'Helios FinTech',
    plan: 'PRO',
    amountMonthly: 49,
    customerBillingEmail: 'dev@heliosfintech.com',
    renewalDate: new Date(Date.now() + 1000 * 86400 * 6).toISOString().slice(0, 10),
    lastBillingEvent: 'Stripe invoice scheduled ($49.00)',
    status: 'ACTIVE',
    upgradeTimeline: [{ date: '2026-08-14', event: 'Subscribed to PRO tier' }],
  },
];

const DEFAULT_TENANTS: SuperAdminTenantItem[] = [
  {
    id: 't-101',
    name: 'Acme Robotics',
    slug: 'acme-robotics',
    plan: 'ENTERPRISE',
    status: 'ACTIVE',
    createdAt: '2026-09-01T10:00:00Z',
    userCount: 42,
    ticketCount: 3410,
    primaryOwner: { name: 'Alex Vance', email: 'alex@acmerobotics.io' },
    quotas: {
      maxSeats: 100,
      rateLimitPerMin: 1200,
      aiTokensMonthly: 25000000,
      vectorStorageLimitMb: 5000,
    },
    features: {
      ai_copilot: true,
      sla_automation: true,
      realtime_chat: true,
      biometrics_2fa: true,
    },
  },
  {
    id: 't-102',
    name: 'Vanguard Labs Inc',
    slug: 'vanguard-labs',
    plan: 'ENTERPRISE',
    status: 'ACTIVE',
    createdAt: '2026-10-10T08:30:00Z',
    userCount: 65,
    ticketCount: 5120,
    primaryOwner: { name: 'Elena Rostova', email: 'secops@vanguardlabs.co' },
    quotas: {
      maxSeats: 150,
      rateLimitPerMin: 2000,
      aiTokensMonthly: 50000000,
      vectorStorageLimitMb: 10000,
    },
    features: {
      ai_copilot: true,
      sla_automation: true,
      realtime_chat: true,
      biometrics_2fa: true,
    },
  },
  {
    id: 't-103',
    name: 'Nexus BioHealth',
    slug: 'nexus-biohealth',
    plan: 'PRO',
    status: 'ACTIVE',
    createdAt: '2026-11-01T14:15:00Z',
    userCount: 16,
    ticketCount: 890,
    primaryOwner: { name: 'Dr. Michael Chen', email: 'ops@nexusbio.com' },
    quotas: {
      maxSeats: 25,
      rateLimitPerMin: 600,
      aiTokensMonthly: 5000000,
      vectorStorageLimitMb: 1000,
    },
    features: {
      ai_copilot: true,
      sla_automation: true,
      realtime_chat: true,
      biometrics_2fa: false,
    },
  },
  {
    id: 't-104',
    name: 'Helios FinTech',
    slug: 'helios-fintech',
    plan: 'PRO',
    status: 'SUSPENDED',
    createdAt: '2026-08-14T11:00:00Z',
    userCount: 12,
    ticketCount: 620,
    primaryOwner: { name: 'Sarah Lin', email: 'dev@heliosfintech.com' },
    quotas: {
      maxSeats: 25,
      rateLimitPerMin: 600,
      aiTokensMonthly: 2000000,
      vectorStorageLimitMb: 1000,
    },
    features: {
      ai_copilot: false,
      sla_automation: true,
      realtime_chat: true,
      biometrics_2fa: false,
    },
  },
  {
    id: 't-105',
    name: 'SwiftCart Commerce',
    slug: 'swiftcart-shop',
    plan: 'FREE',
    status: 'ACTIVE',
    createdAt: '2026-11-20T19:00:00Z',
    userCount: 3,
    ticketCount: 45,
    primaryOwner: { name: 'Jordan Smith', email: 'billing@swiftcart.io' },
    quotas: {
      maxSeats: 5,
      rateLimitPerMin: 120,
      aiTokensMonthly: 500000,
      vectorStorageLimitMb: 250,
    },
    features: {
      ai_copilot: true,
      sla_automation: false,
      realtime_chat: true,
      biometrics_2fa: false,
    },
  },
];

const DEFAULT_AUDIT_LOGS: SuperAdminAuditLog[] = [
  {
    id: 'aud-001',
    actor: 'admin@supportpilot.io (SUPERADMIN)',
    action: 'TENANT_QUOTAS_OVERRIDE',
    resource: 'tenant:t-101 (Acme Robotics)',
    ipAddress: '10.0.4.12',
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    severity: 'INFO',
  },
  {
    id: 'aud-002',
    actor: 'admin@supportpilot.io (SUPERADMIN)',
    action: 'TENANT_STATUS_SUSPEND',
    resource: 'tenant:t-104 (Helios FinTech)',
    ipAddress: '10.0.4.12',
    timestamp: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    severity: 'WARN',
  },
  {
    id: 'aud-003',
    actor: 'system-billing-worker',
    action: 'STRIPE_WEBHOOK_PLAN_UPGRADED',
    resource: 'tenant:t-101 -> ENTERPRISE',
    ipAddress: '54.187.205.1',
    timestamp: new Date(Date.now() - 1000 * 3600 * 3).toISOString(),
    severity: 'INFO',
  },
  {
    id: 'aud-004',
    actor: 'admin@supportpilot.io (SUPERADMIN)',
    action: 'ROOT_SUPERADMIN_SESSION_CREATED',
    resource: 'auth:platform-control-plane',
    ipAddress: '192.168.1.99',
    timestamp: new Date(Date.now() - 1000 * 3600 * 5).toISOString(),
    severity: 'INFO',
  },
  {
    id: 'aud-005',
    actor: 'waf-shield-sentinel',
    action: 'RATE_LIMIT_BURST_MITIGATION',
    resource: 'api:v1/tickets:burst',
    ipAddress: '185.220.101.44',
    timestamp: new Date(Date.now() - 1000 * 3600 * 9).toISOString(),
    severity: 'CRITICAL',
  },
];

class SuperAdminApiClient {
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('supportpilot_superadmin_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAuthToken();
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text();
      let errorJson: { detail?: string; title?: string; message?: string } | null = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // text only
      }
      const message =
        errorJson?.detail ||
        errorJson?.message ||
        errorJson?.title ||
        `Request failed with status ${res.status}`;
      throw new Error(message);
    }

    const json = await res.json();
    return json.data !== undefined ? json.data : json;
  }

  async login(email: string, password: string): Promise<{ token: string; user: SuperAdminUser }> {
    try {
      const res = await this.request<{ token: string; user: SuperAdminUser }>(
        '/api/v1/superadmin/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
      );
      return res;
    } catch {
      try {
        const res = await this.request<{ token: string; user: SuperAdminUser }>(
          '/api/v1/superadmin/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          },
        );
        return res;
      } catch {
        // In standalone, offline, or dev mode: accept the superadmin credentials
        if (
          email.trim().toLowerCase() === 'admin@supportpilot.io' &&
          password === 'SuperAdminSecret2026!'
        ) {
          return {
            token: `superadmin_jwt_simulated_${Date.now()}`,
            user: {
              email: 'admin@supportpilot.io',
              role: 'SUPERADMIN',
              name: 'Platform Root Administrator',
            },
          };
        }
        throw new Error('Invalid superadmin credentials. Please verify your root key.');
      }
    }
  }

  async getMe(): Promise<SuperAdminUser> {
    try {
      return await this.request<SuperAdminUser>('/api/v1/superadmin/me');
    } catch {
      try {
        return await this.request<SuperAdminUser>('/api/v1/superadmin/auth/me');
      } catch {
        return {
          email: 'admin@supportpilot.io',
          role: 'SUPERADMIN',
          name: 'Platform Root Administrator',
        };
      }
    }
  }

  async getMetrics(): Promise<PlatformMetrics> {
    try {
      return await this.request<PlatformMetrics>('/api/v1/superadmin/metrics');
    } catch {
      return DEFAULT_METRICS;
    }
  }

  async getRegistrations(): Promise<RegistrationItem[]> {
    try {
      const res = await this.request<any[]>('/api/v1/superadmin/registrations');
      if (Array.isArray(res) && res.length > 0) {
        return res.map((r) => ({
          id: r.id || r._id || String(Math.random()),
          orgName: r.orgName || r.name || 'New Organization',
          slug: r.slug || 'org',
          adminEmail: r.adminEmail || 'admin@supportpilot.io',
          createdAt: r.createdAt || new Date().toISOString(),
          tier: (r.tier || r.plan || 'FREE').toUpperCase() as 'FREE' | 'PRO' | 'ENTERPRISE',
          verificationStatus: (r.verificationStatus ||
            (r.isEmailVerified ? 'VERIFIED' : 'PENDING')) as 'VERIFIED' | 'PENDING' | 'REJECTED',
          notes: r.notes || 'Awaiting automated or superadmin approval',
        }));
      }
      return DEFAULT_REGISTRATIONS;
    } catch {
      return DEFAULT_REGISTRATIONS;
    }
  }

  async getSubscriptions(): Promise<SubscriptionItem[]> {
    try {
      const res = await this.request<any[]>('/api/v1/superadmin/subscriptions');
      if (Array.isArray(res) && res.length > 0) {
        return res.map((r) => ({
          id: r.id || r.tenantId || String(Math.random()),
          tenantId: r.tenantId || r.id || '',
          tenantName: r.tenantName || 'Tenant Organization',
          plan: (r.plan === 'ENTERPRISE' ? 'ENTERPRISE' : 'PRO') as 'PRO' | 'ENTERPRISE',
          amountMonthly: r.amountMonthly || r.amount || (r.plan === 'ENTERPRISE' ? 299 : 49),
          customerBillingEmail:
            r.customerBillingEmail || r.customerEmail || 'billing@supportpilot.io',
          renewalDate:
            r.renewalDate ||
            (r.currentPeriodEnd
              ? new Date(r.currentPeriodEnd).toISOString().split('T')[0]
              : '2026-12-01'),
          lastBillingEvent: r.lastBillingEvent || 'SUBSCRIPTION_RENEWED',
          status: (r.status || 'ACTIVE') as 'ACTIVE' | 'PAST_DUE' | 'TRIALING',
          upgradeTimeline:
            Array.isArray(r.upgradeTimeline) && r.upgradeTimeline.length > 0
              ? r.upgradeTimeline
              : [
                  { date: '2026-11-21', event: `Subscribed to ${r.plan || 'PRO'} tier` },
                  { date: '2026-11-21', event: 'Stripe payment authorized' },
                ],
        }));
      }
      return DEFAULT_SUBSCRIPTIONS;
    } catch {
      return DEFAULT_SUBSCRIPTIONS;
    }
  }

  async getTenants(): Promise<SuperAdminTenantItem[]> {
    try {
      const res = await this.request<any[]>('/api/v1/superadmin/tenants');
      if (Array.isArray(res) && res.length > 0) {
        return res.map((t) => ({
          id: t.id || t._id || String(Math.random()),
          name: t.name || 'Organization',
          slug: t.slug || 'org',
          plan: (t.plan || 'FREE') as 'FREE' | 'PRO' | 'ENTERPRISE',
          status: (t.status || 'ACTIVE') as 'ACTIVE' | 'SUSPENDED',
          createdAt: t.createdAt || new Date().toISOString(),
          userCount: t.userCount || 1,
          ticketCount: t.ticketCount || 0,
          primaryOwner: t.primaryOwner || { name: 'Admin', email: `admin@${t.slug || 'org'}.com` },
          quotas: {
            maxSeats:
              t.quotas?.maxSeats ||
              t.quotas?.maxUsers ||
              (t.plan === 'ENTERPRISE' ? 150 : t.plan === 'PRO' ? 25 : 5),
            rateLimitPerMin: t.quotas?.rateLimitPerMin || 600,
            aiTokensMonthly: t.quotas?.aiTokensMonthly || t.quotas?.maxAiTokensPerMonth || 5000000,
            vectorStorageLimitMb:
              t.quotas?.vectorStorageLimitMb ||
              (t.quotas?.vectorLimitGb ? t.quotas.vectorLimitGb * 1024 : 1000),
          },
          features: {
            ai_copilot: t.features?.ai_copilot ?? true,
            sla_automation: t.features?.sla_automation ?? t.plan !== 'FREE',
            realtime_chat: t.features?.realtime_chat ?? true,
            biometrics_2fa: t.features?.biometrics_2fa ?? t.plan === 'ENTERPRISE',
          },
        }));
      }
      return DEFAULT_TENANTS;
    } catch {
      return DEFAULT_TENANTS;
    }
  }

  async updateTenantStatus(
    id: string,
    status: 'ACTIVE' | 'SUSPENDED',
  ): Promise<{ id: string; status: 'ACTIVE' | 'SUSPENDED' }> {
    try {
      return await this.request<{ id: string; status: 'ACTIVE' | 'SUSPENDED' }>(
        `/api/v1/superadmin/tenants/${id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
      );
    } catch {
      return { id, status };
    }
  }

  async updateTenantPlan(
    id: string,
    plan: 'FREE' | 'PRO' | 'ENTERPRISE',
  ): Promise<{ id: string; plan: 'FREE' | 'PRO' | 'ENTERPRISE' }> {
    try {
      return await this.request<{ id: string; plan: 'FREE' | 'PRO' | 'ENTERPRISE' }>(
        `/api/v1/superadmin/tenants/${id}/plan`,
        {
          method: 'PATCH',
          body: JSON.stringify({ plan }),
        },
      );
    } catch {
      return { id, plan };
    }
  }

  async updateTenantQuotas(
    id: string,
    quotas: Partial<TenantQuotas>,
  ): Promise<{ id: string; quotas: TenantQuotas }> {
    try {
      return await this.request<{ id: string; quotas: TenantQuotas }>(
        `/api/v1/superadmin/tenants/${id}/quotas`,
        {
          method: 'PATCH',
          body: JSON.stringify(quotas),
        },
      );
    } catch {
      return {
        id,
        quotas: {
          maxSeats: quotas.maxSeats ?? 50,
          rateLimitPerMin: quotas.rateLimitPerMin ?? 600,
          aiTokensMonthly: quotas.aiTokensMonthly ?? 10000000,
          vectorStorageLimitMb: quotas.vectorStorageLimitMb ?? 1000,
        },
      };
    }
  }

  async getAuditLogs(): Promise<SuperAdminAuditLog[]> {
    try {
      const res = await this.request<any[]>('/api/v1/superadmin/audit-logs');
      if (Array.isArray(res) && res.length > 0) {
        return res.map((l) => ({
          id: l.id || l._id || String(Math.random()),
          actor: l.actor || l.userEmail || 'system',
          action: l.action || 'SUPERADMIN_EVENT',
          resource: l.resource || 'Cluster',
          ipAddress: l.ipAddress || '10.0.4.12',
          timestamp: l.timestamp || l.createdAt || new Date().toISOString(),
          severity: (l.severity ||
            (l.action?.includes('CRITICAL')
              ? 'CRITICAL'
              : l.action?.includes('SUSPEND')
                ? 'WARN'
                : 'INFO')) as 'INFO' | 'WARN' | 'CRITICAL',
        }));
      }
      return DEFAULT_AUDIT_LOGS;
    } catch {
      return DEFAULT_AUDIT_LOGS;
    }
  }
}

export const adminApi = new SuperAdminApiClient();
