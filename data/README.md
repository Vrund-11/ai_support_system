# SupportPilot Ticket Classifier Dataset (AI-4)

## Overview

This dataset contains **600 labeled tickets** designed to train and evaluate the ticket priority and category classifier models as specified in PRD Section 9.3 and `docs/08-ai-ml-plan.md`.

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
