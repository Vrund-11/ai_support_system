# Web Dashboard: Screen Specifications

Template per screen: route, roles, purpose, layout, components, data (source and cache key), states, actions, latency tactics, tests. Data flow rules live in `15-frontend-data-flow-and-latency.md`; design tokens in `14-design-system.md`.

## Global shell

- Layout: left sidebar (Inbox, Chats, Customers, Knowledge, Automation, Analytics, Team, Settings), top bar (global search, notifications bell, presence toggle, user menu), main content, optional right panel.
- Persistent socket connection started once after login; connection status pill (Connected, Reconnecting, Offline).
- Route code-splitting per page; prefetch next likely route on link hover.
- Keyboard: `g i` inbox, `g c` chats, `/` search, `?` shortcuts help, `Esc` closes panels.

## S01 Login and Register

- Routes: `/login`, `/register`, `/forgot`, `/reset/:token`. Roles: public.
- Components: form, password strength hint, error summary, link toggle.
- Data: POST auth endpoints. Store access token in memory, refresh handled by interceptor.
- States: idle, submitting, field errors, throttled (show retry time), success redirect.
- Latency: no blocking spinners over 300 ms without skeleton; prefetch `me` and inbox query right after token arrives.
- Tests: Cypress login, throttle message, redirect to requested page.

## S02 Onboarding wizard (first run, OWNER)

- Route: `/onboarding`. Steps: Brand, Business hours, Invite team, Upload first document, Copy widget snippet.
- Data: PUT settings, POST invites, presign + document registration; progress saved per step.
- States: step validation, skip, resume later. Test: complete wizard creates widget key and first KB doc.

## S03 Overview

- Route: `/`. Roles: LEAD+, AGENT sees personal cards only.
- Components: metric cards (open, new today, median first response, median resolution, AI deflection, SLA compliance), volume line chart, priority donut, agent workload bar, recent activity list.
- Data: GraphQL `analyticsOverview(rangeDays)`; cache key `['analytics', range]`, stale 60 s, background refetch; live counters updated by `ticket:updated` events.
- States: skeleton cards, empty (no data yet), error with retry.
- Latency: server aggregates cached 60 s in Redis; charts lazy-loaded; range switch uses `keepPreviousData`.

## S04 Inbox

- Route: `/inbox?status=&priority=&assignee=&tag=&q=`. Roles: AGENT+.
- Layout: filter bar + saved views, virtualised list (title, customer, priority chip, status, assignee avatar, last activity, SLA timer), bulk-action bar, optional split view with ticket preview.
- Data: GraphQL `tickets(filter, cursor)`; cache key `['tickets', filter]`; cursor infinite query; 25 rows per page.
- Realtime: `ticket:updated` patches cached rows or invalidates the key when the ticket now matches or leaves the filter.
- Actions: select, bulk assign/tag/status (optimistic), change sort, save view, open ticket.
- States: loading skeleton rows, empty ("No tickets match"), error, offline banner.
- Latency: list virtualisation (render about 20 rows), debounce search 250 ms, URL-driven filters so back/forward is instant from cache, prefetch ticket detail on row hover.
- Tests: filter combinations, bulk action rollback on failure, realtime row insertion.

## S05 Ticket detail

- Route: `/tickets/:id`. Roles: AGENT+.
- Layout: header (number, subject, status select, priority select, assignee select, SLA timer), thread (customer, AI, agent, internal notes with distinct styling, attachments, citations chips), composer (reply or internal note toggle, canned replies picker `/`, AI suggestion button, attachment upload), right panel (customer card, related tickets, tags, custom fields, activity timeline, AI summary).
- Data: GraphQL `ticket(id)` with `messages(limit, cursor)`; subscription `messageAdded`; mutations `updateTicket` (needs `version`), `addMessage`, `suggestReply`.
- Optimistic: new message appears instantly with pending state, replaced by server message using `clientId`; status changes apply instantly and roll back on 409 with a "Updated by someone else, refresh?" toast.
- Streaming: AI suggestion streams token by token into the composer preview.
- States: loading skeleton, not found, forbidden, conflict, upload progress, send failed with retry.
- Tests: reply optimistic path, 409 handling, internal note never visible to customer, citation click opens source.

## S06 Live chats (conversation queue)

- Route: `/chats`. Roles: AGENT+.
- Layout: three columns: queue (Waiting, Mine, All), active conversation, customer and AI context panel (transcript summary, AI answers with citations, suggested replies).
- Data: socket `conversation:state` and `message:new`; initial list via REST `/conversations?state=`; join room only for opened conversation (others receive lightweight `conversation:preview` events).
- Actions: take over, transfer, close, convert to ticket, send message, typing indicator.
- Latency: unread counters from events (no polling), message list virtualised, optimistic send with `clientId`.
- Tests: take-over race (two agents) resolved by server with one winner.

## S07 Customers

- Routes: `/customers`, `/customers/:id`. List with search and pagination; detail shows profile, conversation and ticket history, notes. Cache keys `['customers', q]`, `['customer', id]`.

## S08 Knowledge base

- Routes: `/knowledge`, `/knowledge/:docId`, `/knowledge/new`, `/knowledge/test`.
- List: table of documents (title, source, status chip PENDING/PROCESSING/READY/FAILED, chunks count, updated), upload dropzone (multi-file, progress), paste article button.
- Detail: metadata, extracted text preview, chunk viewer (chunk index, text, section), reprocess and delete.
- Test console: question box -> answer preview with citations, confidence bar, retrieved chunks with scores, "Would escalate?" indicator. Streams tokens.
- Data: REST kb endpoints; presigned upload direct to storage (browser to S3 or MinIO, never through gateway); status updates via `kb:ingestion` event.
- States: processing progress, failed with error text and retry, empty KB onboarding card.
- Tests: upload happy path, spoofed file rejection message, status transitions shown live.

## S09 Automation

- Routes: `/automation/sla`, `/automation/rules`, `/automation/canned`.
- SLA: matrix of priority vs first response and resolve targets, business-hours editor. Rules: builder (if conditions, then actions), enable toggle, dry-run preview ("would have matched N tickets"). Canned replies: list, editor with variables, search.

## S10 Analytics

- Route: `/analytics`. Tabs: Volume, Response times, AI performance (deflection, escalation, confidence histogram, cost), SLA, Agents. Date range presets and compare to previous period. CSV export (P2).
- Data: GraphQL analytics queries; server-side aggregation; charts lazy loaded; cache stale 5 min.

## S11 Team and roles

- Route: `/team`. Table of users with role select, status, last login; invite modal (email, role); deactivate; permission matrix reference.

## S12 Settings

- Routes: `/settings/general`, `/settings/widget`, `/settings/ai`, `/settings/notifications`, `/settings/security`.
- General: name, timezone, business hours. Widget: colours, logo, greeting, allowed domains, embed snippet with copy button and live preview. AI: enable, confidence threshold slider with explanation, blocklist topics, tone. Security: sessions list with revoke, change password.

## S13 Integrations (P2)

- Route: `/integrations`. API keys (create shows secret once, scopes), webhooks (URL, events, secret, test delivery button, delivery log with status and retry).

## S14 Audit log (P2) and S15 Platform admin (P2)

- Audit: filterable table (actor, action, entity, time). Platform admin: tenant list, usage, suspend, feature flags; only PLATFORM_ADMIN.

## S16 System screens

- 403, 404, 500, maintenance, session expired modal (re-auth without losing draft replies; drafts stored in memory and sessionStorage per ticket).
- Notification center: dropdown list from `notification:new` with unread count, mark all read, deep links.

## Cross-screen UX rules

Every list has loading, empty and error states. Every mutation shows pending state within 100 ms. Destructive actions confirm with undo toast where possible. Dates show relative time with absolute on hover in tenant timezone. All forms validate with the shared Zod schemas.
