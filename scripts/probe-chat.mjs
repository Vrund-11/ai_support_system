import { io } from '../apps/widget/node_modules/socket.io-client/build/esm/index.js';

console.log('Connecting to http://localhost:4000...');
const socket = io('http://localhost:4000', {
  auth: { token: 'visitor:tenant_demo_123:vis_probe_verify' },
  transports: ['websocket'],
  timeout: 5000,
});

socket.on('connect', () => {
  console.log('✓ Connected to Gateway on :4000 (socket id:', socket.id, ')');
  const convId = 'conv_verify_' + Date.now();
  socket.emit('conversation:join', { conversationId: convId, lastSeq: 0 }, (res) => {
    console.log('✓ Joined conversation:', convId, 'status:', res?.status);
    console.log('Sending question: "How do I setup SAML SSO?"');
    socket.emit('message:send', {
      conversationId: convId,
      clientId: 'cmsg_' + Date.now(),
      body: 'How do I setup SAML SSO?',
    }, (ack) => {
      console.log('✓ Message send acknowledged by gateway (seq:', ack?.seq, ')');
    });
  });
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
  process.exit(1);
});

socket.on('message:new', (msg) => {
  console.log(`[Message Received] From: ${msg.senderType} | Seq: ${msg.seq} | Body: "${msg.body}"`);
  if (msg.senderType === 'AI' || msg.senderType === 'SYSTEM') {
    console.log(' SUCCESS: AI / System reply received!');
    if (msg.citations && msg.citations.length > 0) {
      console.log(' Citations attached:', msg.citations);
    }
    socket.disconnect();
    process.exit(0);
  }
});

setTimeout(() => {
  console.error('✗ Timeout: Did not receive AI reply within 8 seconds.');
  socket.disconnect();
  process.exit(1);
}, 8000);
