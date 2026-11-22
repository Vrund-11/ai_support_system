# Automated Human Handoff Triggers

SupportPilot ensures customers are promptly escalated to human agents whenever appropriate.

## Handoff Triggers

- Explicit customer request: Keywords including _"talk to a human"_, _"agent"_, _"representative"_, _"supervisor"_.
- Negative sentiment spike detected across consecutive customer messages.
- Low RAG retrieval confidence ($< 0.55$) on customer inquiries.
- Two consecutive failed self-service resolution attempts.

When triggered, the conversation priority escalates to High and routes to the next available live agent.
