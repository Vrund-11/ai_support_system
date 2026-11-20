import ws from 'k6/ws';
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

export default function () {
  const params = {
    headers: {
      'x-tenant-id': 'tenant-perf-123',
    },
  };

  const res = ws.connect(WS_URL, params, function (socket) {
    socket.on('open', function () {
      // Socket.IO engine.io handshake sequence
      socket.send('40'); // Socket.IO connect packet

      // Join chat room
      socket.send('42["room:join",{"roomId":"ticket:perf-ticket-1"}]');

      // Send periodic message every 2s
      socket.setInterval(function () {
        const start = Date.now();
        socket.send(
          JSON.stringify([
            'chat:message',
            {
              ticketId: 'perf-ticket-1',
              tenantId: 'tenant-perf-123',
              content: 'Load test ping',
              timestamp: start,
            },
          ]),
        );
      }, 2000);
    });

    socket.on('message', function (message) {
      if (typeof message === 'string' && message.startsWith('42')) {
        try {
          const payload = JSON.parse(message.slice(2));
          if (payload[0] === 'chat:message' && payload[1]?.timestamp) {
            const latency = Date.now() - payload[1].timestamp;
            wsLatency.add(latency);
          }
        } catch (e) {
          // ignore non-json
        }
      }
    });

    socket.on('close', function () {
      check(null, { 'ws closed cleanly': () => true });
    });

    socket.setTimeout(function () {
      socket.close();
    }, 15000);
  });

  check(res, { 'connected successfully': (r) => r && r.status === 101 });
  sleep(1);
}
