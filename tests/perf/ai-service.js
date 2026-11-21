import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    ai_service_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 20 },
        { duration: '40s', target: 50 },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{endpoint:ai_classify}': ['p(95)<300', 'p(99)<600'],
    'http_req_duration{endpoint:ai_chat}': ['p(95)<500', 'p(99)<1000'],
  },
};

const AI_SERVICE_URL = __ENV.AI_SERVICE_URL || 'http://localhost:8000';
const TENANT_ID = __ENV.TENANT_ID || 'tenant-perf-123';

export function setup() {
  try {
    const res = http.get(`${AI_SERVICE_URL}/health`, { timeout: '5s' });
    check(res, { 'ai-service healthy': (r) => r.status === 200 });
  } catch (err) {
    // Graceful offline fallback
  }
  return { tenantId: TENANT_ID };
}

export default function (data) {
  const tenantId = data?.tenantId || TENANT_ID;
  const headers = { 'Content-Type': 'application/json' };

  // 1. Classify ticket endpoint
  const classifyPayload = JSON.stringify({
    tenant_id: tenantId,
    subject: 'Cannot login to my account after password reset',
    description: 'Received error 500 when attempting to authenticate on the dashboard.',
  });

  try {
    const classifyRes = http.post(`${AI_SERVICE_URL}/v1/classify`, classifyPayload, {
      headers,
      tags: { endpoint: 'ai_classify' },
      timeout: '10s',
    });

    check(classifyRes, {
      'classify status 200': (r) => r.status === 200,
      'classify has priority': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body && body.priority !== undefined;
        } catch (e) {
          return false;
        }
      },
    });
  } catch (err) {
    check(null, { 'classify error caught': () => false });
  }

  sleep(0.2);

  // 2. RAG Answer Generation endpoint (/v1/answer or /v1/chat/generate fallback)
  const chatPayload = JSON.stringify({
    tenant_id: tenantId,
    question: 'How do I configure custom webhook endpoints?',
    query: 'How do I configure custom webhook endpoints?',
    history: [],
    conversation_history: [],
  });

  try {
    let chatRes = http.post(`${AI_SERVICE_URL}/v1/answer`, chatPayload, {
      headers,
      tags: { endpoint: 'ai_chat' },
      timeout: '15s',
    });

    // Fallback to /v1/chat/generate if 404
    if (chatRes.status === 404) {
      chatRes = http.post(`${AI_SERVICE_URL}/v1/chat/generate`, chatPayload, {
        headers,
        tags: { endpoint: 'ai_chat' },
        timeout: '15s',
      });
    }

    check(chatRes, {
      'chat status 200': (r) => r.status === 200,
      'chat has answer': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body && (body.answer !== undefined || body.response !== undefined);
        } catch (e) {
          return false;
        }
      },
    });
  } catch (err) {
    check(null, { 'chat error caught': () => false });
  }

  sleep(0.5);
}
