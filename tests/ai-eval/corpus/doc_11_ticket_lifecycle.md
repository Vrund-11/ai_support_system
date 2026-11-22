# Ticket Status Transitions and Lifecycle

Tickets in SupportPilot progress through a well-defined state machine.

## Allowed States

- **New**: Freshly created ticket received via email, web form, API, or chat. Not yet assigned or responded to.
- **Open**: Assigned to an agent or queue and awaiting initial or follow-up agent action.
- **Pending**: Waiting on additional information or confirmation from the customer. SLA timers pause during Pending.
- **Solved**: Agent provided resolution. The customer has a 48-hour grace window to reply and reopen the ticket.
- **Closed**: Permanently archived after remaining in Solved status for 48 hours without customer reply. Cannot be reopened.
