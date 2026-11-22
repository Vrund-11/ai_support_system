# Typing Indicators and Read Receipts

Real-time feedback creates an engaging and transparent support experience.

## Typing Indicators

- Emits `typing_start` event when user or agent inputs keystrokes.
- Typing status automatically debounces and clears after 3 seconds of inactivity.

## Message Delivery and Read Receipts

- Single checkmark: Message successfully saved to SupportPilot servers.
- Double checkmarks: Message delivered to the recipient's active browser session.
- Blue checkmarks: Recipient has scrolled the message into active viewport.
