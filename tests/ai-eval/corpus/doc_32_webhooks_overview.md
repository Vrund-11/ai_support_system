# Outbound Webhooks and Event Types

Webhooks provide real-time HTTP event notifications to external web services whenever state changes occur in SupportPilot.

## Core Event Types

- `ticket.created`: Dispatched when a new ticket is received or created.
- `ticket.updated`: Triggered when status, priority, or tags change.
- `ticket.assigned`: Fired when a ticket is assigned to an agent or group.
- `message.created`: Dispatched when a new public reply or internal note is posted.
- `csat.submitted`: Triggered when a customer completes a satisfaction survey.

Webhook payloads are delivered via HTTP POST with `Content-Type: application/json`.
