# SupportPilot Defensible API Endpoints Catalogue

_Generated: 2026-11-22T12:25:46.867Z_
_Audited against source routers and decorators_

## Summary Statistics

- **Total Endpoints**: 126
- **Business Feature APIs**: 103
- **Infrastructure, Health & Metrics Probes**: 23

## Breakdown by Service

- `apps/gateway`: 5 endpoints (Express 5 Reverse Proxy & GraphQL)
- `apps/notification-service`: 8 endpoints (Express 5 BullMQ notifications)
- `apps/ticket-service`: 90 endpoints (Core business CRUD, RBAC, billing, rules, admin)
- `apps/ai-service`: 23 endpoints (FastAPI RAG, embeddings, classifier, quota)

## Complete Catalogue

| #   | Service        |    Method    | Route                                   | Category      | Source File                                                   | Line |
| --- | -------------- | :----------: | --------------------------------------- | ------------- | ------------------------------------------------------------- | :--: |
| 1   | `gateway`      |   **GET**    | `/metrics`                              | Infra         | `apps/gateway/src/app.ts`                                     |  53  |
| 2   | `gateway`      |   **GET**    | `/health`                               | Infra         | `apps/gateway/src/app.ts`                                     |  56  |
| 3   | `gateway`      |   **GET**    | `/ready`                                | Infra         | `apps/gateway/src/app.ts`                                     |  82  |
| 4   | `gateway`      |   **GET**    | `/health/readiness`                     | Infra         | `apps/gateway/src/app.ts`                                     |  83  |
| 5   | `gateway`      | **POST/GET** | `/graphql`                              | Business      | `apps/gateway/src/graphql/server.ts`                          | 119  |
| 6   | `notification` |   **GET**    | `/health`                               | Infra         | `apps/notification-service/src/app.ts`                        |  20  |
| 7   | `notification` |   **GET**    | `/ready`                                | Infra         | `apps/notification-service/src/app.ts`                        |  45  |
| 8   | `notification` |   **GET**    | `/health/readiness`                     | Infra         | `apps/notification-service/src/app.ts`                        |  46  |
| 9   | `notification` |   **GET**    | `/api/v1/notifications/dlq/`            | Business      | `apps/notification-service/src/routes/dlq.routes.ts`          |  23  |
| 10  | `notification` |   **POST**   | `/api/v1/notifications/dlq/:id/replay`  | Business      | `apps/notification-service/src/routes/dlq.routes.ts`          |  44  |
| 11  | `notification` |   **POST**   | `/api/v1/notifications/enqueue`         | Business      | `apps/notification-service/src/routes/notification.routes.ts` |  28  |
| 12  | `notification` |   **GET**    | `/api/v1/notifications/metrics`         | Infra         | `apps/notification-service/src/routes/notification.routes.ts` |  73  |
| 13  | `notification` |   **GET**    | `/api/v1/notifications/email/sent`      | Business/Test | `apps/notification-service/src/routes/notification.routes.ts` |  88  |
| 14  | `ticket`       |   **GET**    | `/metrics`                              | Infra         | `apps/ticket-service/src/app.ts`                              |  44  |
| 15  | `ticket`       |   **GET**    | `/health`                               | Infra         | `apps/ticket-service/src/app.ts`                              |  47  |
| 16  | `ticket`       |   **GET**    | `/ready`                                | Infra         | `apps/ticket-service/src/app.ts`                              |  77  |
| 17  | `ticket`       |   **GET**    | `/health/readiness`                     | Infra         | `apps/ticket-service/src/app.ts`                              |  78  |
| 18  | `ticket`       |   **POST**   | `/api/v1/auth/register`                 | Business      | `apps/ticket-service/src/routes/auth.routes.ts`               |  26  |
| 19  | `ticket`       |   **POST**   | `/api/v1/auth/login`                    | Business      | `apps/ticket-service/src/routes/auth.routes.ts`               |  42  |
| 20  | `ticket`       |   **POST**   | `/api/v1/auth/refresh`                  | Business      | `apps/ticket-service/src/routes/auth.routes.ts`               |  63  |
| 21  | `ticket`       |   **POST**   | `/api/v1/auth/logout`                   | Business      | `apps/ticket-service/src/routes/auth.routes.ts`               |  79  |
| 22  | `ticket`       |   **POST**   | `/api/v1/auth/forgot-password`          | Business      | `apps/ticket-service/src/routes/auth.routes.ts`               |  95  |
| 23  | `ticket`       |   **POST**   | `/api/v1/auth/reset-password`           | Business      | `apps/ticket-service/src/routes/auth.routes.ts`               | 112  |
| 24  | `ticket`       |   **POST**   | `/api/v1/auth/verify-email`             | Business      | `apps/ticket-service/src/routes/auth.routes.ts`               | 128  |
| 25  | `ticket`       |   **POST**   | `/api/v1/auth/resend-verification`      | Business      | `apps/ticket-service/src/routes/auth.routes.ts`               | 144  |
| 26  | `ticket`       |   **POST**   | `/api/v1/tickets/public`                | Business      | `apps/ticket-service/src/routes/ticket.routes.ts`             |  25  |
| 27  | `ticket`       |   **GET**    | `/api/v1/tickets/public/track`          | Business      | `apps/ticket-service/src/routes/ticket.routes.ts`             |  70  |
| 28  | `ticket`       |   **GET**    | `/api/v1/tickets`                       | Business      | `apps/ticket-service/src/routes/ticket.routes.ts`             | 153  |
| 29  | `ticket`       |   **POST**   | `/api/v1/tickets`                       | Business      | `apps/ticket-service/src/routes/ticket.routes.ts`             | 179  |
| 30  | `ticket`       |   **GET**    | `/api/v1/tickets/assignment/next-agent` | Business      | `apps/ticket-service/src/routes/ticket.routes.ts`             | 233  |
| 31  | `ticket`       |   **POST**   | `/api/v1/tickets/bulk`                  | Business      | `apps/ticket-service/src/routes/ticket.routes.ts`             | 248  |
| 32  | `ticket`       |   **POST**   | `/api/v1/tickets/:id/link`              | Business      | `apps/ticket-service/src/routes/ticket.routes.ts`             | 336  |
| 33  | `ticket`       |   **GET**    | `/api/v1/tickets/:id`                   | Business      | `apps/ticket-service/src/routes/ticket.routes.ts`             | 387  |
| 34  | `ticket`       |  **PATCH**   | `/api/v1/tickets/:id`                   | Business      | `apps/ticket-service/src/routes/ticket.routes.ts`             | 420  |
| 35  | `ticket`       |   **POST**   | `/api/v1/tickets/:id/messages`          | Business      | `apps/ticket-service/src/routes/ticket.routes.ts`             | 449  |
| 36  | `ticket`       |   **GET**    | `/api/v1/customers`                     | Business      | `apps/ticket-service/src/routes/customer.routes.ts`           |  14  |
| 37  | `ticket`       |   **POST**   | `/api/v1/customers`                     | Business      | `apps/ticket-service/src/routes/customer.routes.ts`           |  40  |
| 38  | `ticket`       |   **GET**    | `/api/v1/customers/:id`                 | Business      | `apps/ticket-service/src/routes/customer.routes.ts`           |  60  |
| 39  | `ticket`       |   **GET**    | `/api/v1/team`                          | Business      | `apps/ticket-service/src/routes/team.routes.ts`               |  16  |
| 40  | `ticket`       |   **POST**   | `/api/v1/team/invite`                   | Business      | `apps/ticket-service/src/routes/team.routes.ts`               |  44  |
| 41  | `ticket`       |   **GET**    | `/api/v1/users/me`                      | Business      | `apps/ticket-service/src/routes/user.routes.ts`               |  13  |
| 42  | `ticket`       |   **GET**    | `/api/v1/users/me/preferences`          | Business      | `apps/ticket-service/src/routes/user.routes.ts`               |  37  |
| 43  | `ticket`       |  **PATCH**   | `/api/v1/users/me/preferences`          | Business      | `apps/ticket-service/src/routes/user.routes.ts`               |  55  |
| 44  | `ticket`       |   **GET**    | `/api/v1/users/batch`                   | Business      | `apps/ticket-service/src/routes/user.routes.ts`               |  97  |
| 45  | `ticket`       |   **GET**    | `/api/v1/users/:id`                     | Business      | `apps/ticket-service/src/routes/user.routes.ts`               | 131  |
| 46  | `ticket`       |   **POST**   | `/api/v1/uploads/presign`               | Business      | `apps/ticket-service/src/routes/upload.routes.ts`             |  17  |
| 47  | `ticket`       |   **POST**   | `/api/v1/uploads/verify`                | Business      | `apps/ticket-service/src/routes/upload.routes.ts`             |  50  |
| 48  | `ticket`       |   **POST**   | `/api/v1/uploads/validate-direct`       | Business      | `apps/ticket-service/src/routes/upload.routes.ts`             |  91  |
| 49  | `ticket`       |   **GET**    | `/api/v1/kb/documents`                  | Business      | `apps/ticket-service/src/routes/kb.routes.ts`                 |  40  |
| 50  | `ticket`       |   **GET**    | `/api/v1/kb/documents/:id`              | Business      | `apps/ticket-service/src/routes/kb.routes.ts`                 |  60  |
| 51  | `ticket`       |   **POST**   | `/api/v1/kb/uploads/presign`            | Business      | `apps/ticket-service/src/routes/kb.routes.ts`                 |  83  |
| 52  | `ticket`       |   **POST**   | `/api/v1/kb/documents`                  | Business      | `apps/ticket-service/src/routes/kb.routes.ts`                 | 115  |
| 53  | `ticket`       |   **GET**    | `/api/v1/analytics/overview`            | Business      | `apps/ticket-service/src/routes/analytics.routes.ts`          |  12  |
| 54  | `ticket`       |   **GET**    | `/api/v1/analytics/volume`              | Business      | `apps/ticket-service/src/routes/analytics.routes.ts`          |  25  |
| 55  | `ticket`       |   **GET**    | `/api/v1/analytics/sla`                 | Business      | `apps/ticket-service/src/routes/analytics.routes.ts`          |  38  |
| 56  | `ticket`       |   **GET**    | `/api/v1/analytics/agents`              | Business      | `apps/ticket-service/src/routes/analytics.routes.ts`          |  51  |
| 57  | `ticket`       |   **GET**    | `/api/v1/analytics/deflection`          | Business      | `apps/ticket-service/src/routes/analytics.routes.ts`          |  64  |
| 58  | `ticket`       |   **GET**    | `/api/v1/rules`                         | Business      | `apps/ticket-service/src/routes/rule.routes.ts`               |  14  |
| 59  | `ticket`       |   **GET**    | `/api/v1/rules/sla`                     | Business      | `apps/ticket-service/src/routes/rule.routes.ts`               |  26  |
| 60  | `ticket`       |   **PUT**    | `/api/v1/rules/sla`                     | Business      | `apps/ticket-service/src/routes/rule.routes.ts`               |  38  |
| 61  | `ticket`       |   **POST**   | `/api/v1/rules`                         | Business      | `apps/ticket-service/src/routes/rule.routes.ts`               |  54  |
| 62  | `ticket`       |   **GET**    | `/api/v1/rules/:id`                     | Business      | `apps/ticket-service/src/routes/rule.routes.ts`               |  85  |
| 63  | `ticket`       |  **PATCH**   | `/api/v1/rules/:id`                     | Business      | `apps/ticket-service/src/routes/rule.routes.ts`               | 103  |
| 64  | `ticket`       |  **DELETE**  | `/api/v1/rules/:id`                     | Business      | `apps/ticket-service/src/routes/rule.routes.ts`               | 121  |
| 65  | `ticket`       |   **POST**   | `/api/v1/rules/test-evaluate`           | Business      | `apps/ticket-service/src/routes/rule.routes.ts`               | 139  |
| 66  | `ticket`       |   **GET**    | `/api/v1/notifications`                 | Business      | `apps/ticket-service/src/routes/notification.routes.ts`       |  12  |
| 67  | `ticket`       |   **POST**   | `/api/v1/notifications/:id/read`        | Business      | `apps/ticket-service/src/routes/notification.routes.ts`       |  58  |
| 68  | `ticket`       |   **POST**   | `/api/v1/notifications/read-all`        | Business      | `apps/ticket-service/src/routes/notification.routes.ts`       |  64  |
| 69  | `ticket`       |   **GET**    | `/api/v1/docs/openapi.json`             | Infra/Docs    | `apps/ticket-service/src/routes/docs.routes.ts`               | 326  |
| 70  | `ticket`       |   **GET**    | `/api/v1/docs`                          | Infra/Docs    | `apps/ticket-service/src/routes/docs.routes.ts`               | 331  |
| 71  | `ticket`       |   **GET**    | `/api/v1/billing/subscription`          | Business      | `apps/ticket-service/src/routes/billing.routes.ts`            |  11  |
| 72  | `ticket`       |   **POST**   | `/api/v1/billing/checkout`              | Business      | `apps/ticket-service/src/routes/billing.routes.ts`            |  52  |
| 73  | `ticket`       |   **POST**   | `/api/v1/billing/simulate-charge`       | Business      | `apps/ticket-service/src/routes/billing.routes.ts`            | 139  |
| 74  | `ticket`       |   **POST**   | `/api/v1/billing/webhook`               | Business      | `apps/ticket-service/src/routes/billing.routes.ts`            | 223  |
| 75  | `ticket`       |   **POST**   | `/api/v1/superadmin/auth/login`         | Business      | `apps/ticket-service/src/routes/superadmin.routes.ts`         |  87  |
| 76  | `ticket`       |   **GET**    | `/api/v1/superadmin/auth/me`            | Business      | `apps/ticket-service/src/routes/superadmin.routes.ts`         | 125  |
| 77  | `ticket`       |   **GET**    | `/api/v1/superadmin/metrics`            | Infra         | `apps/ticket-service/src/routes/superadmin.routes.ts`         | 140  |
| 78  | `ticket`       |   **GET**    | `/api/v1/superadmin/registrations`      | Business      | `apps/ticket-service/src/routes/superadmin.routes.ts`         | 209  |
| 79  | `ticket`       |   **GET**    | `/api/v1/superadmin/subscriptions`      | Business      | `apps/ticket-service/src/routes/superadmin.routes.ts`         | 261  |
| 80  | `ticket`       |   **GET**    | `/api/v1/superadmin/tenants`            | Business      | `apps/ticket-service/src/routes/superadmin.routes.ts`         | 316  |
| 81  | `ticket`       |  **PATCH**   | `/api/v1/superadmin/tenants/:id/status` | Business      | `apps/ticket-service/src/routes/superadmin.routes.ts`         | 370  |
| 82  | `ticket`       |  **PATCH**   | `/api/v1/superadmin/tenants/:id/plan`   | Business      | `apps/ticket-service/src/routes/superadmin.routes.ts`         | 426  |
| 83  | `ticket`       |  **PATCH**   | `/api/v1/superadmin/tenants/:id/quotas` | Business      | `apps/ticket-service/src/routes/superadmin.routes.ts`         | 484  |
| 84  | `ticket`       |   **GET**    | `/api/v1/superadmin/audit-logs`         | Business      | `apps/ticket-service/src/routes/superadmin.routes.ts`         | 570  |
| 85  | `ticket`       |   **GET**    | `/api/v1/admin/metrics`                 | Infra         | `apps/ticket-service/src/routes/admin.routes.ts`              |  21  |
| 86  | `ticket`       |   **GET**    | `/api/v1/admin/tenants`                 | Business      | `apps/ticket-service/src/routes/admin.routes.ts`              |  80  |
| 87  | `ticket`       |   **POST**   | `/api/v1/admin/tenants`                 | Business      | `apps/ticket-service/src/routes/admin.routes.ts`              | 112  |
| 88  | `ticket`       |   **GET**    | `/api/v1/admin/tenants/:id`             | Business      | `apps/ticket-service/src/routes/admin.routes.ts`              | 213  |
| 89  | `ticket`       |  **PATCH**   | `/api/v1/admin/tenants/:id/quotas`      | Business      | `apps/ticket-service/src/routes/admin.routes.ts`              | 298  |
| 90  | `ticket`       |  **PATCH**   | `/api/v1/admin/tenants/:id/status`      | Business      | `apps/ticket-service/src/routes/admin.routes.ts`              | 369  |
| 91  | `ticket`       |  **PATCH**   | `/api/v1/admin/tenants/:id/plan`        | Business      | `apps/ticket-service/src/routes/admin.routes.ts`              | 412  |
| 92  | `ticket`       |   **GET**    | `/api/v1/admin/tenants/:id/audit-logs`  | Business      | `apps/ticket-service/src/routes/admin.routes.ts`              | 451  |
| 93  | `ticket`       |   **GET**    | `/api/v1/admin/health`                  | Infra         | `apps/ticket-service/src/routes/admin.routes.ts`              | 487  |
| 94  | `ticket`       |   **GET**    | `/api/v1/api-keys`                      | Business      | `apps/ticket-service/src/routes/integration.routes.ts`        |  19  |
| 95  | `ticket`       |   **POST**   | `/api/v1/api-keys`                      | Business      | `apps/ticket-service/src/routes/integration.routes.ts`        |  43  |
| 96  | `ticket`       |  **DELETE**  | `/api/v1/api-keys/:id`                  | Business      | `apps/ticket-service/src/routes/integration.routes.ts`        |  98  |
| 97  | `ticket`       |   **GET**    | `/api/v1/webhooks`                      | Business      | `apps/ticket-service/src/routes/integration.routes.ts`        | 132  |
| 98  | `ticket`       |   **POST**   | `/api/v1/webhooks`                      | Business      | `apps/ticket-service/src/routes/integration.routes.ts`        | 157  |
| 99  | `ticket`       |  **DELETE**  | `/api/v1/webhooks/:id`                  | Business      | `apps/ticket-service/src/routes/integration.routes.ts`        | 214  |
| 100 | `ticket`       |   **POST**   | `/api/v1/webhooks/:id/test`             | Business      | `apps/ticket-service/src/routes/integration.routes.ts`        | 247  |
| 101 | `ticket`       |   **GET**    | `/api/v1/audit-logs`                    | Business      | `apps/ticket-service/src/routes/integration.routes.ts`        | 286  |
| 102 | `ticket`       |   **GET**    | `/api/v1/feature-flags`                 | Business      | `apps/ticket-service/src/routes/integration.routes.ts`        | 321  |
| 103 | `ticket`       |  **PATCH**   | `/api/v1/feature-flags/:key`            | Business      | `apps/ticket-service/src/routes/integration.routes.ts`        | 346  |
| 104 | `ai`           |   **GET**    | `/health`                               | Infra         | `apps/ai-service/src/main.py`                                 |  59  |
| 105 | `ai`           |   **GET**    | `/healthz`                              | Infra         | `apps/ai-service/src/main.py`                                 |  60  |
| 106 | `ai`           |   **GET**    | `/ready`                                | Infra         | `apps/ai-service/src/main.py`                                 |  66  |
| 107 | `ai`           |   **GET**    | `/readyz`                               | Infra         | `apps/ai-service/src/main.py`                                 |  67  |
| 108 | `ai`           |   **GET**    | `/health/readiness`                     | Infra         | `apps/ai-service/src/main.py`                                 |  68  |
| 109 | `ai`           |   **GET**    | `/metrics`                              | Infra         | `apps/ai-service/src/main.py`                                 | 111  |
| 110 | `ai`           |   **GET**    | `/v1/provider`                          | Business      | `apps/ai-service/src/main.py`                                 | 133  |
| 111 | `ai`           |   **POST**   | `/v1/test/generate`                     | Business/Test | `apps/ai-service/src/main.py`                                 | 155  |
| 112 | `ai`           |   **POST**   | `/v1/test/answer`                       | Business/Test | `apps/ai-service/src/main.py`                                 | 169  |
| 113 | `ai`           |   **POST**   | `/v1/test/embed`                        | Business/Test | `apps/ai-service/src/main.py`                                 | 184  |
| 114 | `ai`           |   **POST**   | `/v1/kb/ingest`                         | Business      | `apps/ai-service/src/main.py`                                 | 209  |
| 115 | `ai`           |   **GET**    | `/v1/kb/documents/{document_id}`        | Business      | `apps/ai-service/src/main.py`                                 | 231  |
| 116 | `ai`           |   **GET**    | `/v1/kb/documents/{document_id}/chunks` | Business      | `apps/ai-service/src/main.py`                                 | 249  |
| 117 | `ai`           |   **POST**   | `/v1/retrieval/search`                  | Business      | `apps/ai-service/src/main.py`                                 | 279  |
| 118 | `ai`           |   **POST**   | `/v1/answer`                            | Business      | `apps/ai-service/src/main.py`                                 | 315  |
| 119 | `ai`           |   **POST**   | `/v1/cache/invalidate`                  | Business      | `apps/ai-service/src/main.py`                                 | 326  |
| 120 | `ai`           |   **POST**   | `/v1/eval/run`                          | Business/Eval | `apps/ai-service/src/main.py`                                 | 340  |
| 121 | `ai`           |   **POST**   | `/v1/classify`                          | Business      | `apps/ai-service/src/main.py`                                 | 366  |
| 122 | `ai`           |   **POST**   | `/v1/classify/feedback`                 | Business      | `apps/ai-service/src/main.py`                                 | 377  |
| 123 | `ai`           |   **POST**   | `/v1/assist/suggest-reply`              | Business      | `apps/ai-service/src/main.py`                                 | 384  |
| 124 | `ai`           |   **POST**   | `/v1/assist/summarize`                  | Business      | `apps/ai-service/src/main.py`                                 | 390  |
| 125 | `ai`           |   **GET**    | `/v1/quota/{tenant_id}`                 | Business      | `apps/ai-service/src/main.py`                                 | 397  |
| 126 | `ai`           |   **POST**   | `/v1/quota/{tenant_id}/reset`           | Business      | `apps/ai-service/src/main.py`                                 | 412  |
