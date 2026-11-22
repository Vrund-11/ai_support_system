# Skill-Based Routing and Language Assignment

SupportPilot's automated routing engine directs incoming conversations to agents best qualified to resolve them.

## Defining Skills

Skills represent agent proficiencies such as:

- Languages: English, Spanish, German, Japanese.
- Technical domains: Billing, API/SDK, Infrastructure, Mobile App.
- Tier: Tier 1 General, Tier 2 Technical Specialist, Tier 3 Engineering Escalation.

## Matching Algorithm

When a ticket is created:

1. NLP classification extracts intent and language tags.
2. The router searches for online agents possessing matching skill tags.
3. If multiple agents match, tickets are distributed via round-robin with capacity weighting (max active tickets per agent).
4. If no skilled agent is available, the ticket enters the overflow queue with priority escalation.
