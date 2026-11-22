# Agent Seat Provisioning and Deprovisioning

Managing agent seats efficiently ensures cost control and immediate operational readiness.

## Inviting Agents

1. Navigate to **Team Settings > Members > Invite User**.
2. Enter the agent's corporate email address and select their assigned Role and Skill Groups.
3. An invitation link valid for 72 hours is sent. If unredeemed, admins can resend or revoke the invitation.

## Deprovisioning and Offboarding

When an agent leaves:

1. Select **Deactivate Agent** from the user menu.
2. Reassign all open tickets currently assigned to the agent to an unassigned queue or another active agent.
3. Active API keys and mobile app sessions for the user are immediately revoked via Redis token denylist.
4. The vacant seat remains available for reassignment during the current billing cycle.
