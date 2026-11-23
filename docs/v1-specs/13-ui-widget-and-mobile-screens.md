# Widget and Mobile Screen Specifications

## Widget (customer-facing, iframe, under 80 KB gzipped target)

Embed: `<script src="https://cdn.example/widget.js" data-key="WIDGET_KEY" async></script>`. Loader (about 2 KB) renders only the bubble; the chat bundle loads on first open (or on idle) to keep host pages fast.

| Screen           | When                                | Content                                                                                                  | Data                                                                     |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| W1 Bubble        | always                              | brand icon, unread badge, greeting tooltip once per session                                              | tenant theme from `POST /widget/session` (cached in localStorage 10 min) |
| W2 Home          | first open                          | greeting, "Ask a question" input, top 3 help articles (P2)                                               | session + KB popular list                                                |
| W3 AI chat       | state AI                            | message list, typing dots, streamed answer, citation links, "Talk to a person" button, attachment button | socket `message:send`, `message:stream`, `message:new`                   |
| W4 Waiting       | state WAITING_AGENT                 | "An agent will join shortly", queue note, ability to keep typing                                         | `conversation:state`                                                     |
| W5 With agent    | state WITH_AGENT                    | agent name and avatar, typing indicator, read receipts                                                   | socket events                                                            |
| W6 Offline form  | outside business hours or no agents | name, email, message, attachments                                                                        | `POST /widget/offline`                                                   |
| W7 CSAT          | on close                            | 1-5 stars or thumbs, comment                                                                             | `POST /widget/csat`                                                      |
| W8 Error/offline | socket down                         | banner, auto-retry with backoff, messages queued locally                                                 | outbox                                                                   |

Behaviours: session persisted by visitor token (localStorage) so refresh keeps the conversation; HTTP fallback if WebSocket blocked; strict CSP and iframe sandbox; respects `prefers-reduced-motion`; keyboard accessible; theming through CSS variables from tenant settings; RTL ready.
Latency: show the customer's message instantly (optimistic), show "AI is thinking" within 150 ms, stream first tokens as soon as available.

## Mobile agent app (Expo)

Navigation: stack with tabs. Safe-area aware, supports light and dark.

| Screen            | Purpose       | Key elements                                                                                                                                               | Data                                                           |
| ----------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| M1 Login          | sign in       | email, password, biometric prompt on return                                                                                                                | auth endpoints, secure store                                   |
| M2 Inbox          | triage        | segmented tabs (Mine, Waiting, All), filter sheet, pull to refresh, infinite scroll, SLA badge                                                             | `['tickets', filter]` infinite query, `ticket:updated` patches |
| M3 Ticket/Chat    | work a ticket | thread with bubbles, internal note toggle, composer, attachment (camera, gallery), quick action sheet (assign to me, status, priority), AI suggestion chip | ticket query, socket room join                                 |
| M4 Notifications  | history       | grouped list, tap to deep link                                                                                                                             | `notification:new`, stored list                                |
| M5 Settings       | preferences   | presence toggle, notification toggles, sign out, app version                                                                                               | settings endpoints                                             |
| M6 Filters sheet  | filtering     | status, priority, assignee, tags                                                                                                                           | local state, URL-like params                                   |
| M7 Offline outbox | resilience    | queued messages with retry/cancel                                                                                                                          | local storage                                                  |

Behaviours: foreground socket, background push via FCM; deep link `supportpilot://ticket/:id`; optimistic send with `clientId`; haptic feedback on send and error; list items memoised and `FlashList`-style virtualisation; images resized before upload; lazy screen loading.
Offline: cached last inbox page (stale-while-revalidate), outbox flush on reconnect, clear offline banner.

## Empty and error copy (keep consistent)

- Empty inbox: "You're all caught up."
- Network error: "Can't reach the server. Retrying..." with manual retry.
- Conflict: "Someone else updated this ticket. Reload to see changes."
- AI uncertain (customer view): "I'm not sure about that. Let me connect you with a person."
