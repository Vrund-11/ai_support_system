export interface EmailTemplateRenderResult {
  subject: string;
  html: string;
  text: string;
}

export function renderEmailTemplate(
  template: string,
  variables: Record<string, unknown> = {},
): EmailTemplateRenderResult {
  const name = String(variables['name'] || 'there');
  const appName = 'SupportPilot';

  switch (template) {
    case 'verify_email': {
      const verifyUrl = String(variables['verifyUrl'] || variables['url'] || '#');
      const subject = `Verify your email address - ${appName}`;
      const text = `Hello ${name},\n\nPlease verify your email address by clicking the link below:\n${verifyUrl}\n\nThis link will expire in 24 hours.\n\nBest,\nThe ${appName} Team`;
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
          <h2 style="color: #4f46e5; margin-bottom: 16px;">Verify your email address</h2>
          <p>Hello ${name},</p>
          <p>Thanks for creating an account with ${appName}. Please click the button below to verify your email address:</p>
          <div style="margin: 24px 0;">
            <a href="${verifyUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email</a>
          </div>
          <p style="font-size: 13px; color: #64748b;">Or copy and paste this link in your browser:<br/><a href="${verifyUrl}" style="color: #4f46e5;">${verifyUrl}</a></p>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">This link will expire in 24 hours.</p>
        </div>
      `.trim();
      return { subject, html, text };
    }

    case 'password_reset': {
      const resetUrl = String(variables['resetUrl'] || variables['url'] || '#');
      const subject = `Reset your password - ${appName}`;
      const text = `Hello ${name},\n\nYou requested a password reset for your ${appName} account.\n\nClick the link below to set a new password:\n${resetUrl}\n\nThis link will expire in 1 hour. If you did not request this, please ignore this email.\n\nBest,\nThe ${appName} Team`;
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
          <h2 style="color: #4f46e5; margin-bottom: 16px;">Reset your password</h2>
          <p>Hello ${name},</p>
          <p>We received a request to reset your password for your ${appName} account. Click the button below to choose a new password:</p>
          <div style="margin: 24px 0;">
            <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p style="font-size: 13px; color: #64748b;">Or copy and paste this link in your browser:<br/><a href="${resetUrl}" style="color: #4f46e5;">${resetUrl}</a></p>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      `.trim();
      return { subject, html, text };
    }

    case 'ticket_update': {
      const ticketNumber = variables['ticketNumber'] || 'Ticket';
      const ticketSubject = variables['ticketSubject'] || 'Support Request';
      const messageSnippet = variables['messageSnippet'] || '';
      const subject = `[#${ticketNumber}] ${ticketSubject}`;
      const text = `Hello ${name},\n\nYour ticket #${ticketNumber} has a new update:\n\n${messageSnippet}\n\nBest,\nThe ${appName} Team`;
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
          <h2 style="color: #4f46e5; margin-bottom: 16px;">Ticket Update: #${ticketNumber}</h2>
          <p>Hello ${name},</p>
          <p>Your support ticket <strong>${ticketSubject}</strong> has a new message:</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 12px 16px; margin: 16px 0; border-radius: 4px; font-style: italic;">
            ${messageSnippet}
          </div>
        </div>
      `.trim();
      return { subject, html, text };
    }

    case 'sla_alert': {
      const ticketNumber = variables['ticketNumber'] || 'Ticket';
      const stage = variables['stage'] || 'BREACH';
      const subject = `[SLA Alert - ${stage}] Ticket #${ticketNumber}`;
      const text = `Warning: Ticket #${ticketNumber} has reached SLA milestone ${stage}.\nImmediate action required.`;
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
          <h2 style="color: #dc2626; margin-bottom: 16px;">SLA Alert: ${stage}</h2>
          <p>Ticket <strong>#${ticketNumber}</strong> has reached the SLA milestone <strong>${stage}</strong>.</p>
          <p>Please review and assign immediately.</p>
        </div>
      `.trim();
      return { subject, html, text };
    }

    default: {
      const defaultSubject = String(variables['subject'] || `Notification from ${appName}`);
      const body = String(variables['body'] || '');
      return {
        subject: defaultSubject,
        html: `<p>${body}</p>`,
        text: body,
      };
    }
  }
}
