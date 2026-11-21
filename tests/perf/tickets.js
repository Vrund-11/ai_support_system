import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    ticket_list_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m', target: 200 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:tickets_list}': ['p(95)<400', 'p(99)<800'],
  },
};

const BASE_URL = __ENV.GATEWAY_URL || 'http://localhost:4000';
const TICKET_SERVICE_URL = __ENV.TICKET_SERVICE_URL || 'http://localhost:4001';
const TENANT_ID = __ENV.TENANT_ID || '507f1f77bcf86cd799439011';
const AUTH_EMAIL = __ENV.AUTH_EMAIL || 'agent1@acme.com';
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD || 'Password123!';
const FALLBACK_TOKEN = __ENV.AUTH_TOKEN || 'test-mock-jwt-token-for-k6-perf';

export function setup() {
  let token = FALLBACK_TOKEN;
  let tenantId = TENANT_ID;

  // 1. Healthcheck verification before load test
  try {
    const healthRes = http.get(`${TICKET_SERVICE_URL}/health`, { timeout: '5s' });
    check(healthRes, { 'ticket service healthy': (r) => r.status === 200 });
  } catch (err) {
    // Non-blocking in mock/offline test environments
  }

  // 2. Authenticate via /api/v1/auth/login
  const loginPayload = JSON.stringify({
    email: AUTH_EMAIL,
    password: AUTH_PASSWORD,
  });

  const loginHeaders = { 'Content-Type': 'application/json' };
  const authUrl = `${BASE_URL}/api/v1/auth/login`;

  try {
    const loginRes = http.post(authUrl, loginPayload, {
      headers: loginHeaders,
      timeout: '5s',
    });

    if (loginRes.status === 200) {
      const body = JSON.parse(loginRes.body);
      const acquiredToken =
        body?.data?.tokens?.accessToken ||
        body?.data?.accessToken ||
        body?.tokens?.accessToken ||
        body?.accessToken;
      if (acquiredToken) {
        token = acquiredToken;
      }
      if (body?.data?.user?.tenantId || body?.user?.tenantId) {
        tenantId = body?.data?.user?.tenantId || body?.user?.tenantId;
      }
    }
  } catch (err) {
    // Fall back to pre-configured or offline test token
  }

  return { token, tenantId };
}

export default function (data) {
  const token = data?.token || FALLBACK_TOKEN;
  const tenantId = data?.tenantId || TENANT_ID;

  const headers = {
    'Content-Type': 'application/json',
    'x-tenant-id': tenantId,
    'x-user-id': 'agent-perf-1',
    'x-user-role': 'AGENT',
    Authorization: `Bearer ${token}`,
  };

  // Load ticket list with filters and cursor pagination
  const url = `${TICKET_SERVICE_URL}/api/v1/tickets?status=OPEN&page=1&limit=25`;
  const res = http.get(url, {
    headers,
    tags: { endpoint: 'tickets_list' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response has tickets': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body?.data) || Array.isArray(body?.tickets);
      } catch (e) {
        return false;
      }
    },
  });

  sleep(0.5);
}
