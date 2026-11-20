export interface EnqueueEmailOptions {
  tenantId: string;
  to: string;
  subject: string;
  template?: string;
  variables?: Record<string, unknown>;
  body?: string;
}

export interface DispatchedEmailRecord extends EnqueueEmailOptions {
  dispatchedAt: string;
}

const sentEmailsHistory: DispatchedEmailRecord[] = [];

export function getDispatchedEmails(): DispatchedEmailRecord[] {
  return [...sentEmailsHistory];
}

export function clearDispatchedEmails(): void {
  sentEmailsHistory.length = 0;
}

export async function enqueueEmail(options: EnqueueEmailOptions): Promise<void> {
  sentEmailsHistory.push({
    ...options,
    dispatchedAt: new Date().toISOString(),
  });

  const notifUrl = process.env['NOTIFICATION_SERVICE_URL'] || 'http://localhost:5001';
  const serviceToken = process.env['SERVICE_TOKEN'] || 'default-service-token';

  try {
    await fetch(`${notifUrl}/api/v1/notifications/enqueue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-token': serviceToken,
      },
      body: JSON.stringify({
        queue: 'email',
        data: {
          tenantId: options.tenantId,
          to: options.to,
          subject: options.subject,
          template: options.template,
          variables: options.variables,
          body: options.body || '',
        },
      }),
    });
  } catch {
    // Safe fallback if notification service is offline during local test runs
  }
}
