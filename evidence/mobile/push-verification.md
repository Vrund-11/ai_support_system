# Push Notification Architecture & Verification Evidence (Feature 42 & Feature 44)

## Architecture Overview

SupportPilot implements a pluggable push notification subsystem in `apps/notification-service/src/push/`:

- **`PushProvider` Interface** (`types.ts`):

  ```typescript
  export interface PushMessagePayload {
    to: string;
    title: string;
    body: string;
    data?: {
      type: string;
      ticketId?: string;
      tenantId?: string;
      url?: string;
      [key: string]: unknown;
    };
    sound?: 'default' | null;
    badge?: number;
  }

  export interface PushReceiptResult {
    id: string;
    status: 'ok' | 'error';
    message?: string;
    details?: {
      error?:
        | 'DeviceNotRegistered'
        | 'MessageTooBig'
        | 'MessageRateExceeded'
        | 'InvalidCredentials'
        | string;
      [key: string]: unknown;
    };
  }

  export interface PushProvider {
    send(messages: PushMessagePayload[]): Promise<PushReceiptResult[]>;
  }
  ```

- **Implementations**:
  1. `ExpoPushProvider`: Real HTTP client sending batched notifications to `https://exp.host/--/api/v2/push/send` with gzip compression and authorization headers.
  2. `TestPushProvider`: In-memory provider for unit tests, E2E tests, and local emulation without external API credentials. Supports programmable receipt simulation (e.g. simulating `DeviceNotRegistered`).

## Deep Link Routing Schema

Inbound push payloads include navigation metadata:

```json
{
  "type": "ticket_reply",
  "ticketId": "tkt_10928",
  "tenantId": "507f1f77bcf86cd799439011",
  "url": "supportpilot://ticket/tkt_10928"
}
```

The mobile client parses the link via `NotificationService.parseDeepLink()`:

- `supportpilot://ticket/:id` -> `{ screen: "ticket", params: { id } }`
- `supportpilot://inbox` -> `{ screen: "inbox" }`
- `supportpilot://notifications` -> `{ screen: "notifications" }`
- Fallback: If `url` is omitted, `handleNotificationResponse` falls back to `ticketId` routing.

## Invalid Token Eviction & Lifecycle

When push delivery fails with `DeviceNotRegistered` (Expo) or `messaging/registration-token-not-registered` (FCM):

1. The push worker in `apps/notification-service/src/workers.ts` catches the error code from `PushReceiptResult.details.error`.
2. The invalid device token is logged and passed to the token eviction callback:
   ```typescript
   if (
     receipt.status === 'error' &&
     (receipt.details?.error === 'DeviceNotRegistered' ||
       receipt.details?.error === 'messaging/registration-token-not-registered' ||
       receipt.message?.includes('DeviceNotRegistered'))
   ) {
     logger.warn({ token: msg.to }, 'Evicting unregistered mobile push token');
     invalidTokens.push(msg.to);
   }
   ```
3. Tokens are purged from user device registrations in MongoDB (`DeviceTokenRepository.deleteMany({ token: { $in: invalidTokens } })`).

## Automated Test Verification

Verified via automated test suites:

1. `apps/notification-service/tests/push-provider.test.ts`:
   - `TestPushProvider sends push notifications and records delivered messages`: PASS
   - `ExpoPushProvider formats payload with supportpilot deep links`: PASS
   - `Worker handles DeviceNotRegistered error and detects invalid token for cleanup`: PASS
   - `Worker processPush delivers notifications using configured push provider`: PASS
2. `apps/mobile/tests/notifications.test.ts`:
   - `parses custom scheme deep links for tickets and navigation`: PASS
   - `registers FCM device token and persists in secure storage`: PASS
   - `routes notification response with url payload to ticket screen`: PASS
   - `routes notification response fallback with ticketId when url is omitted`: PASS
   - `handles token refresh idempotently without re-registering identical token`: PASS
