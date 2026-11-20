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

export function setup() {
  const res = http.get(`${AI_SERVICE_URL}/health`);
  check(res, { 'ai-service healthy': (r) => r.status === 200 });
}

export default function () {
  const headers = { 'Content-Type': 'application/json' };

  // 1. Classify ticket request
  const classifyPayload = JSON.stringify({
    tenant_id: 'tenant-perf-123',
    subject: 'Cannot login to my account after password reset',
    description: 'Received error 500 when attempting to authenticate on the dashboard.',
  });

  const classifyRes = http.post(`${AI_SERVICE_URL}/v1/classify`, classifyPayload, {
    headers,
    tags: { endpoint: 'ai_classify' },
  });

  check(classifyRes, {
    'classify status 200': (r) => r.status === 200,
    'classify has priority': (r) => {
      try {
        return JSON.parse(r.body).priority !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  sleep(0.2);

  // 2. Chat generate answer request (RAG + Mock LLM)
  const chatPayload = JSON.stringify({
    tenant_id: 'tenant-perf-123',
    query: 'How do I configure custom webhook endpoints?',
    conversation_history: [],
  });

  const chatRes = http.post(`${AI_SERVICE_URL}/v1/chat/generate`, chatPayload, {
    headers,
    tags: { endpoint: 'ai_chat' },
  });

  check(chatRes, {
    'chat status 200': (r) => r.status === 200,
    'chat has answer': (r) => {
      try {
        return JSON.parse(r.body).answer !== undefined;
      } catch (e) {
        return false;
      }
    },
  });

  sleep(0.5);
}
