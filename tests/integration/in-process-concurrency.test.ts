import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http, {
  type Server as HttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';

function computePercentiles(values: number[]): {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  mean: number;
} {
  if (values.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0, mean: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const getP = (p: number) => {
    const idx = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
    return sorted[idx]!;
  };
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    p50: Math.round(getP(50) * 100) / 100,
    p90: Math.round(getP(90) * 100) / 100,
    p95: Math.round(getP(95) * 100) / 100,
    p99: Math.round(getP(99) * 100) / 100,
    mean: Math.round((sum / sorted.length) * 100) / 100,
  };
}

describe('In-Process Concurrency & Fan-out Integration Test (Vitest Smoke)', () => {
  let server: HttpServer;
  let port: number;
  const tenantId = 'tenant-perf-org';

  // Pre-seed 250 in-memory ticket records
  const sampleTickets = Array.from({ length: 250 }, (_, i) => ({
    id: `ticket_${i + 1}`,
    tenantId,
    ticketNumber: i + 1,
    title: `Performance load ticket ${i + 1}`,
    description: `Detailed description for load testing query performance on ticket ${i + 1}`,
    status: i % 2 === 0 ? 'OPEN' : 'RESOLVED',
    priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'][i % 4],
    category: ['BILLING', 'TECHNICAL', 'ACCOUNT', 'GENERAL'][i % 4],
    createdAt: new Date(Date.now() - i * 60000).toISOString(),
    updatedAt: new Date(Date.now() - i * 30000).toISOString(),
  }));

  beforeAll(async () => {
    server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'ticket-service' }));
        return;
      }

      if (url.pathname === '/api/v1/tickets') {
        const auth = req.headers['authorization'];
        const reqTenant = req.headers['x-tenant-id'];

        if (!auth || !reqTenant || reqTenant !== tenantId) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        const status = url.searchParams.get('status') || 'OPEN';
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const limit = parseInt(url.searchParams.get('limit') || '25', 10);

        // Filter and paginate
        const filtered = sampleTickets.filter(
          (t) => t.status === status && t.tenantId === reqTenant,
        );
        const start = (page - 1) * limit;
        const pageTickets = filtered.slice(start, start + limit);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            tickets: pageTickets,
            pagination: {
              page,
              limit,
              total: filtered.length,
              totalPages: Math.ceil(filtered.length / limit),
            },
          }),
        );
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as any).port;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('measures ticket list latency under 200 concurrent virtual requests (M04)', async () => {
    const totalRequests = 400;
    const concurrency = 200;
    const latencies: number[] = [];
    let errors = 0;

    let reqIdx = 0;
    async function worker() {
      while (reqIdx < totalRequests) {
        reqIdx++;
        const start = performance.now();
        try {
          const res = await fetch(
            `http://localhost:${port}/api/v1/tickets?status=OPEN&page=1&limit=25`,
            {
              headers: {
                Authorization: 'Bearer test-perf-jwt-token',
                'x-tenant-id': tenantId,
              },
            },
          );
          const duration = performance.now() - start;
          if (res.status === 200) {
            latencies.push(duration);
          } else {
            errors++;
          }
        } catch {
          errors++;
        }
      }
    }

    const t0 = performance.now();
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    const totalSec = (performance.now() - t0) / 1000;

    const percentiles = computePercentiles(latencies);
    const rps = Math.round((latencies.length / totalSec) * 100) / 100;
    const errorRate = errors / totalRequests;

    console.log(
      `[IN-PROCESS CONCURRENCY] Tickets list RPS: ${rps}, p50: ${percentiles.p50}ms, p95: ${percentiles.p95}ms, p99: ${percentiles.p99}ms, Error Rate: ${errorRate}`,
    );
    expect(errorRate).toBeLessThan(0.01);
    expect(percentiles.p95).toBeLessThan(400);
  });

  it('measures WebSocket chat message broadcast fan-out latency (M05)', async () => {
    const wsServer = http.createServer();
    const io = new SocketIOServer(wsServer, {
      cors: { origin: '*' },
      transports: ['websocket'],
    });

    io.on('connection', (socket) => {
      socket.on('join_room', (room: string) => {
        socket.join(room);
        socket.emit('joined', room);
      });
      socket.on('chat:message', (data: any) => {
        io.to(data.roomId).emit('chat:broadcast', data);
      });
    });

    await new Promise<void>((resolve) => wsServer.listen(0, resolve));
    const wsPort = (wsServer.address() as any).port;

    const room = 'ticket:perf-room-1';
    const numClients = 30;
    const clients: ClientSocket[] = [];

    for (let i = 0; i < numClients; i++) {
      const client = ioClient(`http://localhost:${wsPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve) => {
        client.on('connect', () => client.emit('join_room', room));
        client.on('joined', () => resolve());
      });
      clients.push(client);
    }

    const latencies: number[] = [];
    const messageCount = 10;

    for (let m = 0; m < messageCount; m++) {
      const sendTime = performance.now();
      const receivePromises = clients.map(
        (client) =>
          new Promise<void>((resolve) => {
            client.once('chat:broadcast', (data: any) => {
              const latency = performance.now() - data.timestamp;
              latencies.push(latency);
              resolve();
            });
          }),
      );

      clients[0]!.emit('chat:message', {
        roomId: room,
        timestamp: sendTime,
        text: `Benchmark broadcast message ${m}`,
      });

      await Promise.all(receivePromises);
    }

    for (const c of clients) {
      c.disconnect();
    }
    await new Promise<void>((resolve) => wsServer.close(() => resolve()));

    const percentiles = computePercentiles(latencies);

    console.log(
      `[IN-PROCESS CONCURRENCY] Chat WS Fanout: Sockets: ${numClients}, Messages: ${latencies.length}, p50: ${percentiles.p50}ms, p95: ${percentiles.p95}ms, p99: ${percentiles.p99}ms`,
    );
    expect(percentiles.p95).toBeLessThan(300);
  });
});
