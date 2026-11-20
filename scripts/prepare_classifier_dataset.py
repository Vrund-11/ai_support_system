"""Deterministic dataset generator for SupportPilot Ticket Classifier (AI-4).

Generates 600 labeled tickets covering:
- Categories: billing, bug, how-to, account, feature request, other (100 each)
- Priorities: LOW, MEDIUM, HIGH, URGENT
Outputs data/tickets_dataset.jsonl and data/README.md.
"""

import json
from pathlib import Path

# Category & Priority Templates
TEMPLATES = [
    # ── BILLING (100) ──
    # URGENT Billing (Payment gateway down / duplicate charges loop)
    ("Payment processor loop charging customer every 5 minutes", "Our account was debited 14 times in the last hour. Stop all automated transactions immediately.", "billing", "URGENT"),
    ("All checkout transactions failing with 500 Stripe error", "None of our customers can purchase subscriptions today. Urgent revenue loss.", "billing", "URGENT"),
    ("Emergency: Unauthorized $12,000 corporate credit card debit", "We see a massive fraudulent transaction on our invoice ledger that was not authorized.", "billing", "URGENT"),
    ("Immediate audit freeze: PCI DSS card storage anomaly", "Audit flagged card tokenization storage irregularity. Need billing engineering immediately.", "billing", "URGENT"),
    ("Subscription renewal blocked for entire enterprise organization", "All 450 seats dropped to free tier simultaneously despite valid enterprise contract.", "billing", "URGENT"),
    # HIGH Billing
    ("Charged twice for annual Pro plan renewal", "My invoice shows two identical charges of $480 on November 15. Please refund the duplicate.", "billing", "HIGH"),
    ("Need immediate refund for accidental enterprise tier upgrade", "Junior admin upgraded our plan by mistake. We need a rollback and refund to credit card.", "billing", "HIGH"),
    ("Credit card declined but funds deducted from bank account", "Bank confirmed transaction was authorized, but our dashboard still says payment overdue.", "billing", "HIGH"),
    ("Invoice required before fiscal year-end tomorrow", "We need a consolidated VAT invoice with our corporate tax identifier by end of business.", "billing", "HIGH"),
    ("Disputed chargeback notice received from banking partner", "Need transaction logs and authorization receipts for customer dispute case #99281.", "billing", "HIGH"),
    # MEDIUM Billing
    ("Update billing contact email address for monthly receipts", "Our finance department email changed from ap@company.com to finance-invoices@company.com.", "billing", "MEDIUM"),
    ("Question regarding tax calculation on recent EU invoice", "Why does the latest invoice include 20% VAT when our reverse-charge VAT ID is on file?", "billing", "MEDIUM"),
    ("Proration question when switching from monthly to annual billing", "Can you explain how the credit from our remaining 12 days will apply to the annual rate?", "billing", "MEDIUM"),
    ("Add PO number to upcoming invoice for purchase requisition", "Our procurement team requires PO-2026-9912 on all invoice PDFs.", "billing", "MEDIUM"),
    ("Payment receipt for October subscription missing in dashboard", "I can only download receipts up to September. Please generate October statement.", "billing", "MEDIUM"),
    # LOW Billing
    ("Where can I find historical invoices older than 1 year?", "Looking for archive invoices from 2024 for tax records.", "billing", "LOW"),
    ("Inquiry about non-profit discount eligibility", "Do you offer discounted pricing for registered 501(c)(3) charities?", "billing", "LOW"),
    ("Currency support for payment in Japanese Yen", "Does the billing portal accept payments in JPY or only USD?", "billing", "LOW"),
    ("Accepted payment methods overview", "Do you accept bank wire transfer or ACH for team plans?", "billing", "LOW"),
    ("Update billing address postal code", "Our corporate office moved to a new suite. Need address updated on profile.", "billing", "LOW"),

    # ── BUG (100) ──
    # URGENT Bug
    ("Production database connection pool exhausted, site offline", "All API requests returning 503 Service Unavailable across all tenants.", "bug", "URGENT"),
    ("Critical security vulnerability: unauthenticated user access", "API endpoint exposes customer data without valid JWT bearer token.", "bug", "URGENT"),
    ("Data loss: Ticket updates silently failing to persist", "Agents update ticket statuses and notes, but on page refresh changes vanish completely.", "bug", "URGENT"),
    ("Memory leak crashing backend worker nodes every 20 minutes", "Out of memory OOM killer terminating pods during document embedding batches.", "bug", "URGENT"),
    ("WebSocket server crash disconnecting all active live chat sessions", "Redis adapter throwing uncaught exception on subscriber connection drop.", "bug", "URGENT"),
    # HIGH Bug
    ("Agent dashboard shows blank white screen on ticket view", "Console shows uncaught TypeError: Cannot read property of undefined in TicketDetail.tsx.", "bug", "HIGH"),
    ("CSV export generates 0 byte empty file for all queries", "When downloading report for customer tickets, browser downloads an empty file.", "bug", "HIGH"),
    ("Search index returns 500 error when searching special characters", "Searching for terms with quotes or ampersands crashes the search endpoint.", "bug", "HIGH"),
    ("File attachment upload fails with network error for PNG images", "Upload bar reaches 100% then throws upload failed alert for all team members.", "bug", "HIGH"),
    ("Notifications not delivering to agent email inboxes", "No emails sent when tickets are assigned or customer responds.", "bug", "HIGH"),
    # MEDIUM Bug
    ("Ticket filter by priority resets after navigating to next page", "Setting filter to HIGH then clicking page 2 resets the filter back to ALL.", "bug", "MEDIUM"),
    ("Dark mode toggle causes table headers to have low contrast", "Black text appears on dark grey header background making column names hard to read.", "bug", "MEDIUM"),
    ("Timestamp on chat messages displays UTC instead of user local timezone", "Messages show 12:00 UTC rather than user's configured browser timezone.", "bug", "MEDIUM"),
    ("Typing indicator sticks permanently if customer closes tab", "Agent chat view keeps showing 'Customer is typing...' indefinitely.", "bug", "MEDIUM"),
    ("Unread badge counter does not decrement immediately after reading", "Takes a manual hard refresh for notification badge to clear.", "bug", "MEDIUM"),
    # LOW Bug
    ("Minor visual misalignment in sidebar settings icon", "The gear icon in the navigation bar is offset by 2px relative to other icons.", "bug", "LOW"),
    ("Spelling error in knowledge base upload tooltip", "Tooltip says 'maximun file size' instead of 'maximum file size'.", "bug", "LOW"),
    ("Button hover state color slightly inconsistent in modal", "Confirm button uses dark-indigo on hover while cancel uses light-slate.", "bug", "LOW"),
    ("Breadcrumb trail omits ticket category on deep link", "Direct URL navigation does not render full breadcrumb hierarchy.", "bug", "LOW"),
    ("Favicon not updating on tab when switching tenant profiles", "Browser tab keeps default favicon instead of custom tenant icon.", "bug", "LOW"),

    # ── HOW-TO (100) ──
    # URGENT How-To (Go-live blocker)
    ("Emergency go-live in 1 hour: how to configure custom DNS CNAME?", "Our launch is scheduled for 2 PM and our vanity domain is not resolving.", "how-to", "URGENT"),
    ("Critical compliance checklist: how to export customer audit logs?", "Auditor needs full audit trail of ticket accesses within 3 hours.", "how-to", "URGENT"),
    ("Urgent: How to enable IP allowlisting before security audit?", "Need step-by-step instructions to restrict agent access to corporate VPN IP range.", "how-to", "URGENT"),
    ("Incident response: how to broadcast emergency notice banner on widget?", "Major service incident in progress; need to display banner on customer widget immediately.", "how-to", "URGENT"),
    ("How to instantly revoke API token compromised in public repo?", "Developer accidentally committed token; need immediate rotation procedure.", "how-to", "URGENT"),
    # HIGH How-To
    ("How to configure SAML SSO with Okta identity provider?", "Our IT department is migrating all users to Okta and needs metadata XML details.", "how-to", "HIGH"),
    ("How to route tickets to specific agent teams based on language?", "Need rule configuration to assign Spanish inquiries to Madrid support team.", "how-to", "HIGH"),
    ("How to set up webhook notifications for external CRM sync?", "Need documentation on webhook signature verification and payload schema.", "how-to", "HIGH"),
    ("How to import 10,000 legacy Zendesk tickets via API?", "Looking for bulk ingestion API documentation and rate limit parameters.", "how-to", "HIGH"),
    ("How to configure custom SLA policies for weekend coverage?", "Need instructions on configuring business hours excluding Saturdays and Sundays.", "how-to", "HIGH"),
    # MEDIUM How-To
    ("How to embed chat widget into a React Next.js application?", "What is the recommended approach for initializing window.SupportPilot in React?", "how-to", "MEDIUM"),
    ("How to create canned reply templates for frequent questions?", "Looking for guide on setting up reusable macros for agent responses.", "how-to", "MEDIUM"),
    ("How to customize widget primary color and greeting text?", "Where in dashboard settings can we upload our company logo and brand color?", "how-to", "MEDIUM"),
    ("How to export monthly ticket resolution time metrics?", "Need steps to generate average first response time charts for management report.", "how-to", "MEDIUM"),
    ("How to invite new agent and assign LEAD role permissions?", "Need walkthrough on user invitation link generation and role assignment.", "how-to", "MEDIUM"),
    # LOW How-To
    ("How to change avatar picture in agent profile settings?", "Where do I upload a profile photo for the chat widget avatar?", "how-to", "LOW"),
    ("How to switch notification sounds in dashboard?", "Can I disable sound chime when a new ticket is assigned?", "how-to", "LOW"),
    ("How to enable keyboard shortcuts for ticket navigation?", "Is there a shortcut cheat sheet for J/K navigation in the inbox?", "how-to", "LOW"),
    ("How to filter tickets by multiple tags simultaneously?", "Can I do an AND filter on tags in the search bar?", "how-to", "LOW"),
    ("How to view knowledge base document chunking preview?", "Where in KB view can I inspect how text was chunked?", "how-to", "LOW"),

    # ── ACCOUNT (100) ──
    # URGENT Account
    ("All company administrators locked out after SSO certificate expired", "No admin can log in to reconfigure the SAML certificate. Entire team blocked.", "account", "URGENT"),
    ("Account takeover suspected: unauthorized admin user added", "Suspicious email address was granted OWNER role without organization approval.", "account", "URGENT"),
    ("Emergency: Revoke access for terminated executive immediately", "Former VP credentials must be invalidated across all active sessions right now.", "account", "URGENT"),
    ("Organization owner account compromised: phishing attack detected", "Attacker triggered password reset on owner email; need immediate lock.", "account", "URGENT"),
    ("Cannot access root account to accept terms before contract termination", "Access blocked on master tenant account pending legal deadline today.", "account", "URGENT"),
    # HIGH Account
    ("Lead agent lost 2FA phone device and backup recovery codes", "Agent cannot access two-factor authenticator app. Need 2FA reset for work.", "account", "HIGH"),
    ("Password reset email never arrives in corporate inbox", "Triggered password reset 5 times, nothing in spam or quarantine. Cannot log in.", "account", "HIGH"),
    ("Account locked after 5 failed password attempts", "Locked out of account for 15 minutes but error persists after 2 hours.", "account", "HIGH"),
    ("Transfer organization ownership to new team lead", "Current owner is departing company this Friday; need ownership transfer.", "account", "HIGH"),
    ("Session keeps expiring every 2 minutes while working tickets", "Agent constantly kicked back to login screen while composing replies.", "account", "HIGH"),
    # MEDIUM Account
    ("Update display name and job title on agent account", "Need name changed from maiden name to married name across ticket signatures.", "account", "MEDIUM"),
    ("Change account primary login email address", "Migrating our corporate domain from oldcorp.com to newbrand.com.", "account", "MEDIUM"),
    ("View active login sessions and device IP history", "Where can I audit active browser sessions logged into my account?", "account", "MEDIUM"),
    ("Resend agent invitation email that expired after 7 days", "New team member was on leave and invitation link is no longer valid.", "account", "MEDIUM"),
    ("Delete obsolete inactive agent account from tenant", "Employee left 3 months ago; want to remove seat to free up license.", "account", "MEDIUM"),
    # LOW Account
    ("Set preferred language to French for dashboard UI", "Can I switch the agent interface language to French?", "account", "LOW"),
    ("Opt out of promotional product announcement emails", "Please unsubscribe my account from monthly marketing newsletters.", "account", "LOW"),
    ("Dark mode preference not syncing across multiple browsers", "Laptop stays in dark mode but desktop reverts to light mode.", "account", "LOW"),
    ("Question about password strength policy requirements", "Does password require special symbols or just minimum 12 characters?", "account", "LOW"),
    ("Request copy of personal data stored per GDPR", "Submitting standard data subject access request for my profile.", "account", "LOW"),

    # ── FEATURE REQUEST (100) ──
    # URGENT Feature Request (Enterprise deal contingent)
    ("Enterprise contract contingent: HIPAA compliant BAA and audit log", "Need enterprise compliance add-on enabled before signature deadline today.", "feature request", "URGENT"),
    ("Government RFP blocker: FedRAMP data residency option", "Required for federal procurement RFP response due in 24 hours.", "feature request", "URGENT"),
    ("Contractual mandate: European data sovereignty storage region", "GDPR compliance deadline requires storing customer data exclusively in Frankfurt.", "feature request", "URGENT"),
    ("Security requirement: Custom KMS encryption key management", "Corporate policy mandates BYOK customer-managed encryption keys for data at rest.", "feature request", "URGENT"),
    ("Critical requirement: SCIM automated user provisioning support", "5,000 seat rollout cannot proceed without automated Okta SCIM sync.", "feature request", "URGENT"),
    # HIGH Feature Request
    ("Add WhatsApp Business API channel for customer messaging", "Customers in Latin America exclusively reach out via WhatsApp; need integration.", "feature request", "HIGH"),
    ("Slack bi-directional integration for ticket creation from channels", "Engineering team wants tickets created automatically from #support-triage Slack channel.", "feature request", "HIGH"),
    ("Custom ticket status values beyond standard workflow", "We need custom status stages like 'WAITING_ON_VENDOR' and 'IN_QA'.", "feature request", "HIGH"),
    ("Automated CSAT customer satisfaction survey after ticket close", "Need 1-5 star survey email sent automatically 24 hours after resolution.", "feature request", "HIGH"),
    ("Role-based granular permissions for custom agent roles", "Need role that can view and reply to tickets but cannot delete or change tags.", "feature request", "HIGH"),
    # MEDIUM Feature Request
    ("Add dark mode support to customer chat widget", "The chat bubble is currently light only; would love matching site dark theme.", "feature request", "MEDIUM"),
    ("Allow audio and video file attachments in tickets", "Support currently accepts only PDF and images; need MP4 screen recordings.", "feature request", "MEDIUM"),
    ("Bulk ticket action bar for multi-ticket assignment", "Select all tickets in inbox and assign to agent in single click.", "feature request", "MEDIUM"),
    ("Markdown table rendering in ticket message composer", "Would love ability to format markdown tables inside internal notes.", "feature request", "MEDIUM"),
    ("Custom webhook payload formatting with Liquid templates", "Allow transforming JSON webhook payload before sending to external endpoints.", "feature request", "MEDIUM"),
    # LOW Feature Request
    ("Animated confetti celebration when ticket inbox reaches zero", "Fun reward animation for agents when all tickets are resolved.", "feature request", "LOW"),
    ("Custom notification sound upload for new messages", "Allow agents to upload MP3 sound effect for chat chimes.", "feature request", "LOW"),
    ("Collapsible sidebar for wide widescreen monitors", "Add toggle arrow to collapse left navigation panel for more ticket space.", "feature request", "LOW"),
    ("Emoji reaction picker on internal agent notes", "Allow team members to react with thumbs up to internal notes.", "feature request", "LOW"),
    ("Customizable avatar border color for agent tiers", "Color-coded ring around agent profile picture based on seniority.", "feature request", "LOW"),

    # ── OTHER (100) ──
    # URGENT Other
    ("Legal notice: Subpoena and litigation hold request", "Immediate preservation of all ticket records for entity #49281.", "other", "URGENT"),
    ("Critical press inquiry regarding security vulnerability disclosure", "Tech reporter requesting official comment within 2 hours on alleged breach.", "other", "URGENT"),
    ("Emergency contact: Data center power outage advisory", "Colocation provider alerting on facility generator transfer test.", "other", "URGENT"),
    ("Law enforcement inquiry regarding fraudulent customer activity", "Official request for contact logs associated with scam merchant account.", "other", "URGENT"),
    ("Trademark infringement cease and desist notice", "Legal counsel notifying on trademarked logo usage on public portal.", "other", "URGENT"),
    # HIGH Other
    ("Partnership inquiry from Tier 1 cloud consulting agency", "Agency represents 200 potential enterprise customers; request executive call.", "other", "HIGH"),
    ("Vendor risk assessment questionnaire for enterprise procurement", "Need 120-question cybersecurity questionnaire completed for vendor approval.", "other", "HIGH"),
    ("Request for SOC 2 Type II audit report for compliance review", "Prospective client requires copy of latest SOC 2 report under NDA.", "other", "HIGH"),
    ("Conference speaker invitation for AI customer support keynote", "Inviting CTO to deliver keynote on hybrid RAG architectures in San Francisco.", "other", "HIGH"),
    ("Executive briefing request from venture capital firm", "Investment team requesting 30-minute introductory call with founders.", "other", "HIGH"),
    # MEDIUM Other
    ("Inquiry about affiliate and referral partner program", "Do you offer commissions for software consultants who refer clients?", "other", "MEDIUM"),
    ("Feedback on recent webinar presentation slides", "Enjoyed the demo on BullMQ queues; will slide deck be shared via email?", "other", "MEDIUM"),
    ("Student research inquiry regarding LLM evaluation metrics", "University researcher requesting anonymized eval benchmark methodology.", "other", "MEDIUM"),
    ("Podcast interview invitation for engineering podcast", "Would your engineering team be interested in discussing multi-tenant architecture?", "other", "MEDIUM"),
    ("Office visit and meeting room availability inquiry", "Visiting company headquarters next month; wondering if team is on-site.", "other", "MEDIUM"),
    # LOW Other
    ("Company swag and sticker request for university hackathon", "Can you send laptop stickers and t-shirts for student developers?", "other", "LOW"),
    ("Congratulations on recent product launch announcement", "Just saw the Sprint 2 launch on Product Hunt, great work to the team!", "other", "LOW"),
    ("Documentation typo report on landing page footer", "Footer says 'All rights reseved' missing letter r.", "other", "LOW"),
    ("General feedback on brand color palette", "The new indigo shade looks great on high DPI monitors.", "other", "LOW"),
    ("Greeting from customer support community meetup", "Enjoyed chatting with your team at the local tech meetup yesterday.", "other", "LOW"),
]

def generate_dataset(target_total: int = 600) -> list[dict]:
    """Expands base template patterns deterministically up to target_total (100 per category)."""
    dataset: list[dict] = []
    
    # Organize templates by category
    by_category: dict[str, list[tuple[str, str, str, str]]] = {}
    for subj, desc, cat, prio in TEMPLATES:
        by_category.setdefault(cat, []).append((subj, desc, cat, prio))

    per_category = target_total // len(by_category)
    idx = 1000

    variants = [
        (" Urgent: ", " Please treat as urgent. ", "URGENT"),
        (" Escalation: ", " Customer requesting immediate escalation. ", "HIGH"),
        (" Update needed: ", " Looking for an update on this. ", "MEDIUM"),
        (" Question: ", " General inquiry when convenient. ", "LOW"),
        (" Follow-up on ", " Checking in on prior conversation. ", None),
    ]

    for cat, items in by_category.items():
        count = 0
        while count < per_category:
            for item in items:
                if count >= per_category:
                    break
                base_subj, base_desc, item_cat, item_prio = item
                
                if count < len(items):
                    # Exact base template
                    subj = base_subj
                    desc = base_desc
                    prio = item_prio
                else:
                    # Deterministic variation
                    var_prefix, var_suffix, force_prio = variants[count % len(variants)]
                    subj = f"{var_prefix}{base_subj}"
                    desc = f"{base_desc}{var_suffix}"
                    prio = force_prio if force_prio else item_prio

                idx += 1
                dataset.append({
                    "id": f"TKT-{idx}",
                    "subject": subj,
                    "description": desc,
                    "first_message": desc,
                    "category": item_cat,
                    "priority": prio,
                })
                count += 1

    return dataset

def main() -> None:
    data_dir = Path("data")
    data_dir.mkdir(parents=True, exist_ok=True)
    
    dataset = generate_dataset(target_total=600)
    dataset_file = data_dir / "tickets_dataset.jsonl"
    
    with dataset_file.open("w", encoding="utf-8") as f:
        for row in dataset:
            f.write(json.dumps(row) + "\n")
            
    readme_file = data_dir / "README.md"
    readme_content = f"""# SupportPilot Ticket Classifier Dataset (AI-4)

## Overview
This dataset contains **{len(dataset)} labeled tickets** designed to train and evaluate the ticket priority and category classifier models as specified in PRD Section 9.3 and `docs/08-ai-ml-plan.md`.

## Target Classes
### Category (6 classes, exactly 100 samples each):
1. `billing` — invoices, payments, credit cards, refunds, subscription plans
2. `bug` — crashes, errors, 500s, blank screens, memory leaks, broken features
3. `how-to` — setup instructions, documentation questions, API usage, guides
4. `account` — password resets, 2FA, SSO, access permissions, lockout
5. `feature request` — integrations, dark mode, custom fields, enhancements
6. `other` — partnership inquiries, press, legal, general feedback

### Priority (4 classes):
- `URGENT` — outages, critical security breaches, company-wide blockers
- `HIGH` — payment failures, account lockout, refund disputes, deadlined blockers
- `MEDIUM` — regular issues with workarounds, configuration questions
- `LOW` — cosmetic UI bugs, general questions, feedback

## Stratification & Splits
- **70% Train** (420 samples)
- **15% Validation** (90 samples)
- **15% Test** (90 samples)
- Seed: **42** for full determinism and reproducibility.
"""
    readme_file.write_text(readme_content, encoding="utf-8")
    print(f"Generated {len(dataset)} tickets in {dataset_file} and {readme_file}")

if __name__ == "__main__":
    main()
