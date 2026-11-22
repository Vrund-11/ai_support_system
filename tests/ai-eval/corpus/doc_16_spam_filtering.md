# Inbound Email Spam Heuristics

Automated filtering keeps unwanted solicitations and automated auto-responders out of the support queue.

## Filtering Mechanisms

- **SPF/DKIM/DMARC Verification**: Emails failing cryptographic domain authentication receive an elevated spam score.
- **Rate-Based Thresholds**: If an external email address sends more than 20 messages per minute, further emails are routed to the Spam folder.
- **Out-of-Office / Auto-Reply Suppression**: Headers such as `Auto-Submitted: auto-replied`, `X-Autoreply: yes`, and `Precedence: auto_reply` are recognized, preventing endless ticket generation loops.
- **Manual Spam Marking**: Marking a ticket as Spam trains the Bayesian filter and blocks future messages from that sender.
