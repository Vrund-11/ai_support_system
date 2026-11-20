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
const TENANT_ID = __ENV.TENANT_ID || 'tenant-perf-123';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export function setup() {
  // Healthcheck verification before starting load
  const res = http.get(`${TICKET_SERVICE_URL}/health`);
  check(res, { 'service is healthy': (r) => r.status === 200 });
  return { tenantId: TENANT_ID };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'x-tenant-id': data.tenantId,
    'x-user-id': 'agent-perf-1',
    'x-user-role': 'AGENT',
  };

  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  }

  // Load ticket list with filters and pagination
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
        return Array.isArray(body.tickets) || Array.isArray(body.data);
      } catch (e) {
        return false;
      }
    },
  });

  sleep(0.5);
}
