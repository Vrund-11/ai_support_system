# Mobile Push Notification Setup

Push notifications alert agents to urgent customer inquiries and SLA warnings.

## Notification Infrastructure

- Android: Delivered via Firebase Cloud Messaging (FCM).
- iOS: Delivered via Apple Push Notification service (APNs).
- Notification payloads include ticket ID, sender name, priority, and message preview.
- Tapping a notification routes directly into the ticket conversation view.
