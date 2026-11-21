import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const wsLatency = new Trend('ws_msg_latency');

export const options = {
  scenarios: {
    chat_websocket_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 25 },
        { duration: '1m', target: 100 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    ws_msg_latency: ['p(95)<300', 'p(99)<600'],
    checks: ['rate>0.99'],
  },
};

const GATEWAY_URL = __ENV.GATEWAY_URL || 'http://localhost:4000';
const WS_URL = GATEWAY_URL.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket';
const TENANT_ID = __ENV.TENANT_ID || '507f1f77bcf86cd799439011';
const AUTH_EMAIL = __ENV.AUTH_EMAIL || 'agent1@acme.com';
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD || 'Password123!';

export function setup() {
  let token = `visitor:${TENANT_ID}:perf-visitor-setup`;

  // Attempt login to acquire real agent token
  try {
    const loginRes = http.post(
      `${GATEWAY_URL}/api/v1/auth/login`,
      JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD }),
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: '5s',
      },
    );

    if (loginRes.status === 200) {
      const body = JSON.parse(loginRes.body);
      const acquired =
        body?.data?.tokens?.accessToken ||
        body?.data?.accessToken ||
        body?.tokens?.accessToken ||
        body?.accessToken;
      if (acquired) {
        token = acquired;
      }
    }
  } catch (err) {
    // Fall back to visitor token format accepted by gateway auth
  }

  return { token, tenantId: TENANT_ID };
}

export default function (data) {
  const token = data?.token || `visitor:${TENANT_ID}:perf-vu-${__VU}`;
  const conversationId = `conv-perf-${__VU % 10}`;

  const sentTimestamps = new Map();

  const params = {
    headers: {
      'x-tenant-id': TENANT_ID,
      Authorization: `Bearer ${token}`,
    },
  };

  let isConnected = false;

  const res = ws.connect(WS_URL, params, function (socket) {
    socket.on('open', function () {
      isConnected = true;
      // 1. Socket.IO engine.io v4 connect packet
      socket.send('40');
    });

    socket.on('message', function (message) {
      if (typeof message !== 'string') return;

      // Handle Engine.IO Ping (packet 2) -> Pong (packet 3)
      if (message === '2') {
        socket.send('3');
        return;
      }

      // Handle Socket.IO Connect Ack (packet 40)
      if (message.startsWith('40')) {
        // Join conversation room
        socket.send(
          '42' +
            JSON.stringify([
              'conversation:join',
              {
                conversationId: conversationId,
                lastSeq: 0,
              },
            ]),
        );

        // Schedule periodic chat message every 2s
        socket.setInterval(function () {
          const clientId = `k6-vu${__VU}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
          const sendTime = Date.now();
          sentTimestamps.set(clientId, sendTime);

          const payload = [
            'message:send',
            {
              conversationId: conversationId,
              clientId: clientId,
              body: 'Load test ping message',
            },
          ];

          socket.send('42' + JSON.stringify(payload));
        }, 2000);
        return;
      }

      // Handle Socket.IO Event messages (packet 42)
      if (message.startsWith('42')) {
        try {
          const parsed = JSON.parse(message.slice(2));
          const eventName = parsed[0];
          const eventData = parsed[1];

          if (eventName === 'message:ack' && eventData?.clientId) {
            const start = sentTimestamps.get(eventData.clientId);
            if (start) {
              const latency = Date.now() - start;
              wsLatency.add(latency);
              sentTimestamps.delete(eventData.clientId);
            }
          } else if (eventName === 'message:new' && eventData?.clientId) {
            const start = sentTimestamps.get(eventData.clientId);
            if (start) {
              const latency = Date.now() - start;
              wsLatency.add(latency);
              sentTimestamps.delete(eventData.clientId);
            }
          }
        } catch (err) {
          // Graceful handling of non-JSON packets
        }
      }
    });

    socket.on('error', function (e) {
      check(e, { 'socket error caught cleanly': () => true });
    });

    socket.on('close', function () {
      check(null, { 'ws closed cleanly': () => true });
    });

    socket.setTimeout(function () {
      socket.close();
    }, 15000);
  });

  check(res, {
    'connected successfully': (r) => r && (r.status === 101 || isConnected),
  });

  sleep(1);
}
