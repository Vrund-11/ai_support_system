# SupportPilot UI Screens & Popups Catalog

Comprehensive catalog of every screen, popup, drawer, modal, and widget across Desktop and Mobile viewports for generation with Stitch MCP.

---

## Part 1: Core Web Dashboard Screens (Desktop & Mobile)

### 1. Authentication: Login Screen

- **Device Viewports**: `DESKTOP` (Centered card on slate gradient) / `MOBILE` (Full height form with sticky bottom button)
- **Components**:
  - Brand header with logo icon and SupportPilot typography
  - Input: Email address (`type="email"`, icon prefix `Mail`)
  - Input: Password (`type="password"`, icon prefix `Lock`, show/hide toggle)
  - "Remember me" checkbox + "Forgot password?" link
  - Submit CTA: "Sign in to SupportPilot" (Indigo button with focus ring)
  - Switch footer: "Don't have an account? Sign up"
  - Error alert banner (RFC 7807 problem details display)
- **Stitch Prompt**:
  > Modern SaaS login screen for SupportPilot customer support platform. Clean slate-50 background with subtle radial gradient. Centered white card with 12px rounded corners, crisp 1px slate-200 border, and soft shadow. Floating brand badge with violet-indigo shield icon. Input fields for email and password with soft gray icons and indigo focus rings. Dark indigo CTA button 'Sign In' with arrow icon. Clean, minimal typography using Inter.

---

### 2. Authentication: Register / Tenant Onboarding Screen

- **Device Viewports**: `DESKTOP` / `MOBILE`
- **Components**:
  - Company / Workspace name input
  - Owner full name input
  - Work email input
  - Strong password input with strength meter (length, symbol, number)
  - Terms of service & privacy agreement checkbox
  - Submit CTA: "Create Workspace"
  - Switch footer: "Already registered? Sign in"
- **Stitch Prompt**:
  > SaaS workspace registration and tenant onboarding screen for SupportPilot. Left hero branding panel explaining AI customer support features, right clean white onboarding card. Fields for Company Name, Full Name, Work Email, and Password with strength indicator bar. Polished indigo submit button.

---

### 3. Ticket Inbox Screen (Primary Agent Workspace)

- **Device Viewports**: `DESKTOP` (Full data grid with filter bar) / `MOBILE` (Card list with pull-to-refresh & floating filter button)
- **Components**:
  - Search bar with debounced query and keyboard shortcut hint (`⌘K`)
  - Quick Filter Pills: All, Unassigned, Mine, SLA Breached
  - Dropdown Selectors: Status (`NEW`, `OPEN`, `PENDING_CUSTOMER`, `ON_HOLD`, `RESOLVED`, `CLOSED`), Priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`)
  - Bulk Actions Bar (appears on multi-row checkbox select): Assign Agent, Add Tag, Change Status, Close Tickets
  - Ticket Row / Card Elements:
    - Checkbox selector
    - Customer Avatar with initials
    - Ticket Number (`#1042`) and Subject
    - Customer Name & Email
    - Status Badge & Priority Pill
    - Assignee Avatar or "Unassigned" dash
    - Relative time updated (`2m ago`, `1h ago`)
  - Pagination controls (Items per page, Page 1 of N, Previous/Next buttons)
  - Top action CTA: "+ New Ticket" button
- **Stitch Prompt**:
  > High-density modern SaaS ticket inbox dashboard for customer support agents. Top navigation bar with user profile, theme toggle, and notification bell. Filter toolbar with search input, status selector dropdowns, priority badges, and date range. Clean table view with rows displaying ticket #, customer avatar, bold subject, priority chip (red URGENT, amber HIGH, blue MEDIUM, gray LOW), status chip (green OPEN, blue NEW, yellow PENDING), assignee avatar, and relative timestamps. Responsive layout with hover row highlights.

---

### 4. Ticket Detail & Thread View Screen

- **Device Viewports**: `DESKTOP` (Split 2-column view: Thread on left, Customer & AI Copilot sidebar on right) / `MOBILE` (Tabbed thread view with bottom drawer for metadata)
- **Components**:
  - Header: Back to Inbox button, Ticket #ID, Editable Subject, Status dropdown, Priority dropdown, Assignee selector
  - Tags management bar (existing tag chips with remove `x`, add new tag input)
  - SLA countdown timer chip with warning progress indicator
  - Conversation Thread:
    - Customer message bubbles (left-aligned, light surface, timestamp, customer badge)
    - Agent public message bubbles (right-aligned, indigo tinted, agent avatar)
    - Internal private notes (full-width amber tinted container with lock icon, invisible to customer)
    - File attachment preview chips (PDF, PNG, logs with download button)
    - Activity audit trail pills (Status changed to OPEN by Agent, Priority updated)
  - Message Composer:
    - Mode toggle tabs: "Public Reply" vs "Internal Note"
    - Rich text formatting toolbar (Bold, Italic, Link, Code, Bullet list)
    - Canned response / Macro quick picker (`/canned`)
    - "Draft with AI" button (invokes RAG copilot recommendation)
    - File attachment uploader (drag & drop zone)
    - Submit button: "Send Reply (⌘Enter)"
  - Right Sidebar:
    - Customer profile card (Email, Phone, Company, Total tickets count, Recent tickets)
    - AI Thread Summary card (Sentiment badge: URGENT / FRUSTRATED, 3 bullet summary points, recommended action)
- **Stitch Prompt**:
  > Detailed customer support ticket thread view. Left 70% width conversation timeline with alternating customer chat bubbles, agent replies, and prominent amber-tinted 'Internal Note' boxes with lock icons. Bottom composer with tab toggle for 'Public Reply' and 'Internal Note', rich text controls, file upload chip, and 'Draft with AI' spark icon. Right 30% sidebar containing customer profile card and AI Copilot summarization panel with sentiment indicators and recommended next steps.

---

### 5. Live Chat & AI Copilot View Screen

- **Device Viewports**: `DESKTOP` (3-column live command center) / `MOBILE` (Swipeable queue tabs, full screen chat view)
- **Components**:
  - Left Column (Queue):
    - Tabs: "Waiting Agents (Escalated)", "My Active Chats", "All Chats"
    - Chat preview items with unread count badge, customer name, snippet, waiting timer
  - Center Column (Active Live Chat Stream):
    - Customer info header with live status dot (Green = Online, Gray = Offline)
    - Live message history (Visitor messages, AI bot answers with citation chips, escalation notice)
    - Real-time typing indicators ("Customer is typing...")
    - Agent takeover banner ("Take Over Chat" CTA when bot is handling)
    - Message input composer with instant delivery
  - Right Column (AI Copilot Assist Panel):
    - Grounded AI response suggestion card
    - Citations section showing cited knowledge base articles with confidence bar (e.g. 94% confidence)
    - 1-Click "Insert Suggestion into Reply" button
    - Conversation live sentiment indicator
- **Stitch Prompt**:
  > Real-time omnichannel live chat support console for SaaS agents. 3-column layout. Left column shows active customer chat queue with status dots and wait timers. Center column shows chat stream with message bubbles, bot citations, typing indicator, and responsive message composer. Right column is an AI Copilot panel displaying real-time suggested answers with RAG source citations, confidence score bar, and 'Insert into Reply' button.

---

### 6. Knowledge Base Management Screen

- **Device Viewports**: `DESKTOP` (Articles table + interactive test retrieval console) / `MOBILE` (Article list with test retrieval tab)
- **Components**:
  - Top action bar: Search articles input, "+ Upload Document / Markdown" button
  - Document Table:
    - Article title and category tag
    - Ingestion status chip (`READY` emerald, `PROCESSING` blue with spinner, `FAILED` red)
    - Chunks count badge (e.g., `14 chunks`, `384 dim`)
    - Updated date
    - Action buttons: "Inspect Chunks", "Re-index", "Delete"
  - Interactive RAG Test Retrieval Console:
    - Test query search bar ("Ask a test question to verify AI retrieval...")
    - "Run RAG Test" button
    - Results preview box: Synthesized AI answer, Calibrated confidence score bar, Cited document chunk cards with similarity ranking
- **Stitch Prompt**:
  > Modern Knowledge Base management dashboard with RAG vector search diagnostics. Top table displaying ingested documentation articles with chunk count badges, vector status indicators (READY, PROCESSING, FAILED), and action icons. Bottom section features an interactive vector retrieval test console with a search prompt, synthesized AI answer card, confidence meter, and expandable cited chunk snippets.

---

### 7. Customers Directory Screen

- **Device Viewports**: `DESKTOP` / `MOBILE`
- **Components**:
  - Summary KPI cards: Total Customers, Active Ticket Ratio, Top Accounts
  - Search input with filter by company or email
  - Customers Table:
    - Customer avatar with initials
    - Full Name & Email
    - Company name
    - Open tickets badge / Total tickets count
    - Joined date
    - Action buttons: "View Details", "New Ticket"
  - Top CTA: "+ Add Customer"
- **Stitch Prompt**:
  > SaaS customer directory screen. Top row with 3 clean metric stat cards (Total Customers, Active Tickets, Repeat Inquiries). Search bar and filter controls. Clean table listing customers with initials avatar, full name, contact email, company badge, ticket count pill, and action buttons.

---

### 8. Team & Workspace Members Screen

- **Device Viewports**: `DESKTOP` / `MOBILE`
- **Components**:
  - Summary stats: Total Seats, Active Agents, Leads, Workspace Owner
  - Team members table:
    - User avatar & online presence dot
    - Name & Email
    - Role badge (`OWNER` violet, `LEAD` blue, `AGENT` emerald, `VIEWER` gray)
    - Open assigned tickets count
    - Actions: Edit Role, Deactivate Member
  - Top CTA: "+ Invite Team Member"
- **Stitch Prompt**:
  > Workspace team management and RBAC settings screen. Table listing team members with avatars, online status pings, name, email, role badges (Owner, Lead, Agent, Viewer), ticket workload metrics, and role dropdown selector. Polished 'Invite Member' button in header.

---

### 9. Automation & SLA Rules Screen

- **Device Viewports**: `DESKTOP` / `MOBILE`
- **Components**:
  - Sub-navigation tabs: "Automation Rules", "SLA Policies"
  - SLA Policies Editor:
    - Priority table: First response target (mins) and Resolution target (hours) for LOW, MEDIUM, HIGH, URGENT
    - Business hours toggle: Monday–Friday 9AM–5PM, timezone selector
    - Save SLA configuration button
  - Automation Rules List:
    - Rule Card: Rule name, Enabled switch toggle, Trigger event badge (`TICKET_CREATED`, `TICKET_UPDATED`), Condition tree summary, Actions summary (Assign to Agent, Set Priority, Add Tag)
    - Test evaluate dry-run button
    - Top CTA: "+ Create Automation Rule"
- **Stitch Prompt**:
  > Automation rules and SLA policy management console for customer support software. Tabbed interface with SLA response/resolution matrices for each ticket priority level, business hours scheduler, and automation rule builder cards showing trigger events, IF/THEN condition chips, and assigned actions.

---

### 10. Analytics & Executive Dashboard Screen

- **Device Viewports**: `DESKTOP` (Grid of charts and metrics) / `MOBILE` (Scrollable single column stat cards and charts)
- **Components**:
  - Date Range picker: 7 Days, 14 Days, 30 Days, 90 Days
  - KPI Stat Cards:
    - Total Volume (with % delta vs last period)
    - Mean First Response Time (e.g. `18m`, down 12%)
    - Mean Resolution Time (e.g. `2.4h`)
    - SLA Compliance % (e.g. `98.2%`)
    - AI Deflection Rate % (e.g. `44.6%` resolved without human)
    - CSAT Score (e.g. `4.8 / 5.0`)
  - Chart Panels:
    - Ticket volume bar chart (Inflow vs Resolved by day)
    - Category & Priority breakdown donut chart
    - Agent workload and resolution leaderboard table
    - AI vs Human resolution deflection trend line
- **Stitch Prompt**:
  > Executive analytics dashboard for customer support SaaS. Top filter for date ranges. 6 prominent KPI stat cards with trend arrow badges (Total Tickets, First Response Time, Resolution Time, SLA Compliance Rate, AI Deflection %, CSAT Score). Polished bar charts for daily ticket volume, donut chart for category distribution, and agent performance ranking table.

---

### 11. Settings & Workspace Configuration Screen

- **Device Viewports**: `DESKTOP` (Left navigation sidebar with content panel) / `MOBILE` (Accordion sub-sections)
- **Components**:
  - Sub-tabs: "General & Branding", "API Keys", "Webhooks", "Audit Logs", "Feature Flags"
  - General: Workspace name, Logo upload dropzone, Brand hex color picker, AI Assistant toggle, AI confidence threshold slider (0.0 to 1.0)
  - API Keys: Active keys table (Name, Key prefix `sp_live_...`, scopes, created date, revoke button), "+ Generate New Key" CTA
  - Webhooks: Subscribed endpoints table (URL, events `ticket.created`, active toggle, test ping button), "+ Add Webhook" CTA
  - Audit Logs: Security event stream (Timestamp, Actor, Action, IP address, Resource ID)
- **Stitch Prompt**:
  > Comprehensive SaaS workspace settings screen. Left sub-tab navigation (Branding, API Keys, Webhooks, Audit Logs). Content view showing brand color picker, AI bot threshold slider, API keys table with masked keys and copy buttons, and webhook endpoint subscription cards.

---

### 12. Help Center & FAQ Screen

- **Device Viewports**: `DESKTOP` / `MOBILE`
- **Components**:
  - Large search hero banner: "How can we help you today?"
  - Category grid cards: Getting Started, Account & Billing, Ticketing Guide, AI Assistant & RAG, Integrations
  - Featured articles list with reading time and helpfulness rating
  - Floating "Contact Support" trigger
- **Stitch Prompt**:
  > Clean customer-facing help center portal. Hero search header with magnifying glass icon. Responsive 3-column category grid cards with soft pastel icons. List of popular FAQ articles with chevron indicators and a floating 'Chat with Support' widget button.

---

## Part 2: Modals, Drawers & Popups (Desktop & Mobile)

### 1. Create Ticket Modal (`CreateTicketModal.tsx`)

- **Device Viewports**: `DESKTOP` (Centered modal dialog, 512px wide) / `MOBILE` (Bottom slide-up sheet)
- **Components**:
  - Modal title: "Create New Ticket" + Close button `✕`
  - Input: Subject (Required)
  - Input: Customer Email (Autocomplete suggestions)
  - Dropdown: Priority selector (`LOW`, `MEDIUM`, `HIGH`, `URGENT`)
  - Textarea: Description / Issue details (Markdown supported)
  - Input: Tags (Comma separated with tag preview pills)
  - File upload dropzone for initial attachments
  - Action buttons: "Cancel" (Secondary) and "Create Ticket" (Primary CTA)
- **Stitch Prompt**:
  > Create Ticket modal dialog popup on a darkened backdrop. Centered white card with rounded corners. Form fields for Subject, Customer Email, Priority dropdown selector, Issue Description textarea, and Tags input with chip previews. Indigo 'Create Ticket' CTA button.

---

### 2. Chunk Vector Inspector Slide-over Drawer (`KnowledgeBaseView.tsx`)

- **Device Viewports**: `DESKTOP` (Right slide-over drawer, 580px wide) / `MOBILE` (Full-screen view)
- **Components**:
  - Header: Document Title, Total Chunks count (`14 chunks`), Embedding dimension (`384 dim`), Status chip, Close button
  - Chunks List:
    - Chunk card with ID badge (`#chunk-01`)
    - Token count pill (`~480 tokens`)
    - Section heading path (`Authentication > SAML Setup`)
    - Markdown content preview inside formatted dark code block
    - 1-Click "Copy Chunk Markdown" button
  - Footer: "Close Inspector" button
- **Stitch Prompt**:
  > Slide-over inspector drawer for inspecting vector database chunks. Clean dark/light code blocks displaying chunk text, token counts, section hierarchy breadcrumb, vector similarity score, and copy buttons.

---

### 3. Add / Upload Article Modal (`KnowledgeBaseView.tsx`)

- **Device Viewports**: `DESKTOP` / `MOBILE`
- **Components**:
  - Header: "Add Article to Knowledge Base"
  - Tabs: "Upload File (.md, .txt, .pdf)" vs "Paste Markdown"
  - Input: Article Title
  - File drag-and-drop zone with accepted formats and size limits
  - Raw markdown editor textarea
  - Actions: "Cancel" and "Ingest & Index Document" button with loading spinner
- **Stitch Prompt**:
  > Knowledge base article upload modal. Tab toggle for file upload drag-and-drop zone and raw markdown textarea editor. Document title input, chunking preview note, and 'Ingest & Index' primary button.

---

### 4. Create Automation Rule Modal (`AutomationView.tsx`)

- **Device Viewports**: `DESKTOP` / `MOBILE`
- **Components**:
  - Header: "Create Automation Rule"
  - Input: Rule Name (e.g. "Auto-assign Billing Issues to Finance")
  - Select: Trigger Event (`When Ticket is Created`, `When Ticket is Updated`, `When Message is Received`)
  - IF Condition Builder: Field dropdown (`Priority`, `Status`, `Tag`, `Subject`), Operator (`EQUALS`, `CONTAINS`, `MATCHES_REGEX`), Value input
  - THEN Action Builder: Action type (`ASSIGN`, `SET_PRIORITY`, `ADD_TAG`, `ESCALATE`), Target value selector
  - Actions: "Cancel" and "Save Rule"
- **Stitch Prompt**:
  > Automation rule creation modal with visual IF/THEN condition builder. Trigger event dropdown, condition row with field/operator/value inputs, and action execution dropdown. Clean slate accents and rounded buttons.

---

### 5. Add Customer Modal (`CustomersView.tsx`)

- **Device Viewports**: `DESKTOP` / `MOBILE`
- **Components**:
  - Header: "Add New Customer"
  - Inputs: Full Name, Email Address, Phone Number, Company / Organization
  - Actions: "Cancel" and "Save Customer"
- **Stitch Prompt**:
  > Clean modal popup for adding a new customer record. Input fields for Full Name, Email, Phone, and Company with input icons. Indigo submit button.

---

### 6. Customer Details Drawer / Modal (`CustomersView.tsx`)

- **Device Viewports**: `DESKTOP` (Slide-over or centered card) / `MOBILE` (Full height sheet)
- **Components**:
  - Header: Customer avatar with large initials, Customer Name, Customer ID
  - Contact Details List: Email, Phone, Company, Member Since date
  - Ticket History Summary: Total tickets filed, Resolved tickets, Open tickets count
  - Action buttons: "Create Ticket for Customer", "Close"
- **Stitch Prompt**:
  > Customer profile details drawer popup. Prominent avatar circle, contact information list with icons, ticket activity summary badges, and quick 'Create Ticket' action button.

---

### 7. Invite Team Member Modal (`TeamView.tsx`)

- **Device Viewports**: `DESKTOP` / `MOBILE`
- **Components**:
  - Header: "Invite Team Member"
  - Inputs: Full Name, Email Address
  - Dropdown: Workspace Role (`LEAD`, `AGENT`, `VIEWER`) with role permission description
  - Actions: "Cancel" and "Send Invitation"
- **Stitch Prompt**:
  > Team member invitation modal. Email and name inputs with workspace role selector radio/dropdown cards describing agent permissions. Primary 'Send Invitation' button.

---

### 8. Generate API Key Modal (`SettingsView.tsx`)

- **Device Viewports**: `DESKTOP` / `MOBILE`
- **Components**:
  - Step 1 (Creation Form):
    - Key Name / Identifier input
    - Scope checkboxes: `tickets:read`, `tickets:write`, `kb:read`, `kb:write`, `analytics:read`
    - "Generate Key" CTA
  - Step 2 (Key Reveal Screen):
    - Warning banner: "Copy this key now. You won't be able to see it again!"
    - Masked key field with 1-click "Copy Key" button
    - "Done" button
- **Stitch Prompt**:
  > API Key generation modal for developer settings. Name input, scope permission checkboxes, followed by an API key reveal view with warning banner and copy to clipboard button.

---

### 9. Add Webhook Modal (`SettingsView.tsx`)

- **Device Viewports**: `DESKTOP` / `MOBILE`
- **Components**:
  - Header: "Add Webhook Subscription"
  - Input: Webhook Target URL (`https://...`)
  - Input: Description
  - Event Subscription Checkboxes: `ticket.created`, `ticket.updated`, `chat.escalated`, `sla.warning`
  - Actions: "Cancel" and "Add Webhook"
- **Stitch Prompt**:
  > Webhook configuration modal. Target URL input, description field, event checkboxes, and save button.

---

### 10. Notification Dropdown Popover (`NotificationBell.tsx`)

- **Device Viewports**: `DESKTOP` (Anchored popover dropdown, 380px wide) / `MOBILE` (Bottom slide-up drawer)
- **Components**:
  - Header: "Notifications" + Unread count pill + "Mark all as read" button
  - Notifications list:
    - Item: Type icon (`TICKET_ASSIGNED` blue, `SLA_WARNING` amber, `CUSTOMER_REPLY` emerald)
    - Title & message preview
    - Relative timestamp (`10m ago`)
    - Unread blue indicator dot
  - Empty state when all caught up
  - Footer: "View all notifications" link
- **Stitch Prompt**:
  > Floating notification popover dropdown menu anchored to a bell icon. Unread count badge, list of notification items with colored alert icons, title, description, timestamp, and 'Mark all read' header action.

---

## Part 3: Embeddable Customer Chat Widget (Desktop & Mobile)

### 1. Widget Bubble Launcher (`WidgetBubble.tsx`)

- **Device Viewports**: Floating bottom-right corner (Desktop 24px inset, Mobile 16px inset)
- **Components**:
  - Circular floating launcher button (56px diameter, tenant primary color)
  - Animated icon transition (Chat icon when closed, `✕` close icon when open)
  - Unread notification counter badge (Red circle with white text)
- **Stitch Prompt**:
  > Floating customer support widget bubble button in the bottom right corner of a web page. Indigo circular button with clean chat message icon and red unread counter badge.

---

### 2. Widget Live Chat Window (`WidgetChat.tsx`)

- **Device Viewports**: `DESKTOP` (Floating window 380px × 600px) / `MOBILE` (Full-screen view)
- **Components**:
  - Header: Tenant logo, Company name, Online status indicator ("Typically replies in under 2 mins"), Minimize button, Close button
  - Chat Area:
    - Bot Greeting Message with quick suggestion buttons ("Billing Help", "Technical Issue", "Documentation")
    - User message bubbles (right-aligned, primary color)
    - AI Grounded Answer bubbles (left-aligned, cited article chips with clickable links)
    - Escalation Card: "Connecting you with a support specialist..." with spinner
    - Agent chat bubbles with agent avatar and name
  - Footer Composer:
    - Textarea with "Type your message..."
    - File attachment button
    - Send button (Arrow icon)
    - Powered by SupportPilot subtle badge
- **Stitch Prompt**:
  > Embeddable customer support chat widget window. Polished header with brand logo and agent presence dot. Chat conversation area with AI bot responses, interactive citation pills, and human agent takeover banner. Bottom composer with send button and attachment icon.

---

### 3. Widget Offline Fallback Form (`OfflineForm.tsx`)

- **Device Viewports**: `DESKTOP` / `MOBILE`
- **Components**:
  - Banner: "We are currently offline. Leave us a message and we'll reply via email!"
  - Inputs: Name, Email Address, Subject, Message Description
  - File upload input
  - CTA: "Submit Offline Message"
  - Success confirmation screen after submit
- **Stitch Prompt**:
  > Offline contact form inside a support chat widget. Friendly offline notice banner with clock icon, name, email, and message inputs, and a submit button.

---

## Part 4: Mobile Agent App Screens (`apps/mobile`)

### 1. Mobile Login Screen (`app/(auth)/login.tsx`)

- **Device Viewports**: `MOBILE` (375px × 812px)
- **Components**: Brand icon, Email, Password, FaceID / TouchID biometric login button, Sign In CTA.

### 2. Mobile Ticket Inbox Tab (`app/(tabs)/inbox.tsx`)

- **Device Viewports**: `MOBILE`
- **Components**: Top header with search, horizontal status filter pills, swipeable ticket cards showing ticket number, subject, priority pill, relative time, and pull-to-refresh.

### 3. Mobile My Tickets Tab (`app/(tabs)/mine.tsx`)

- **Device Viewports**: `MOBILE`
- **Components**: Focused list of tickets assigned to the logged-in agent with urgent tickets pinned to top.

### 4. Mobile Ticket Detail Screen (`app/ticket/[id].tsx`)

- **Device Viewports**: `MOBILE`
- **Components**: Sticky top bar with status/priority chips, chronological message feed, quick canned responses bar, and sticky bottom message composer with internal note toggle.

### 5. Mobile Notifications Tab (`app/(tabs)/notifications.tsx`)

- **Device Viewports**: `MOBILE`
- **Components**: Push notification log with deep-links to tickets on tap.

### 6. Mobile Settings Tab (`app/(tabs)/settings.tsx`)

- **Device Viewports**: `MOBILE`
- **Components**: Agent availability switch (Online / Busy / Away), push notifications toggle, biometric toggle, log out button.
