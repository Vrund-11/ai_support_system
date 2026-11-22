# Internal Notes and Agent Collision Detection

Collaboration tools prevent duplicate agent responses and streamline complex ticket investigations.

## Private Internal Notes

Agents can toggle between **Public Reply** and **Internal Note** in the message composer. Internal notes are highlighted in yellow, are strictly excluded from customer notifications, and are visible only to logged-in team members.

## Collision Detection

SupportPilot uses WebSockets to monitor active ticket viewers:

- When another agent opens a ticket, a notification banner appears: _"Agent Sarah is currently viewing this ticket"_.
- If an agent begins typing, a live typing indicator warns other team members to prevent conflicting responses.
- If two agents submit responses simultaneously, optimistic locking detects the version conflict and prompts for confirmation.
