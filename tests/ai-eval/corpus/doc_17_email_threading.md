# Inbound Email Threading and Header Parsing

SupportPilot reliably matches incoming customer emails to existing conversations.

## Threading Rules

1. **Message-ID and References**: Inbound emails containing `In-Reply-To` or `References` headers matching an existing message are appended directly to the corresponding ticket thread.
2. **Subject Line Token**: In the absence of email headers, the subject line token (e.g. `[Ticket #SP-83921]`) is parsed using regular expression matching.
3. **HTML Sanitization**: All inbound email bodies undergo DOMPurify sanitization. Embedded script tags, external tracking pixels, and malicious iframes are stripped before rendering in the agent console.
