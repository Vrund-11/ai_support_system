# Mobile Offline Outbox and Synchronization

Agents can compose replies and update ticket status even without network connectivity.

## Outbox Mechanism

- Replies written offline are stored in a local SQLite outbox queue with status `QUEUED`.
- When internet connectivity is restored, the outbox flushes items in strict chronological order.
- If a ticket was modified on the server while the agent was offline, a conflict modal allows the agent to merge changes or overwrite.
