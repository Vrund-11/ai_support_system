# Real-Time Chat WebSocket Protocol

The live chat widget communicates with SupportPilot over a persistent bidirectional WebSocket connection.

## Connection Protocol

- Transport: WebSocket with Socket.IO protocol fallback to HTTP long-polling.
- Handshake: Includes tenant ID and visitor session token.
- Keepalive: Heartbeat ping/pong frames transmitted every 25 seconds.
- Reconnection: Automatic exponential backoff reconnection with offline queueing if network disconnects.
