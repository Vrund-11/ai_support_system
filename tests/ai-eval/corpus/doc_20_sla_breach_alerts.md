# SLA Escalation Automation and Warning Triggers

Proactive notifications prevent tickets from breaching SLA thresholds.

## Alert Phases

- **Warning Threshold (75% elapsed)**: Ticket badge turns amber in the queue. Notification is sent to the assigned agent.
- **Critical Threshold (90% elapsed)**: Ticket badge turns red. Alert is posted to the team's Slack/Teams triage channel.
- **Breached (100% elapsed)**: Ticket is automatically reassigned to the on-duty Team Lead, tagged with `sla-breached`, and logged in the monthly compliance report.
