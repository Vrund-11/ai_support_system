import { Router, type Request, type Response, type NextFunction } from 'express';
import { AppError } from '@supportpilot/shared-lib';
import { requireAuth } from '../middleware/auth.middleware.js';
import { Tenant } from '../models/tenant.model.js';
import { PLAN_QUOTAS, TenantQuotaTracker } from '../middleware/quota.middleware.js';
import { isDbConnected } from '../lib/mongoose.js';

export const billingRouter: Router = Router();

// GET /api/v1/billing/subscription - returns current tenant plan, limits, and usage
billingRouter.get(
  '/subscription',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      let plan: 'FREE' | 'PRO' = 'FREE';

      if (isDbConnected() || 'mock' in Tenant.findById) {
        const tenant = await Tenant.findById(tenantId).lean();
        if (tenant?.plan) {
          plan = tenant.plan as 'FREE' | 'PRO';
        }
      }

      const limits = PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.FREE;
      const [messages, ai, kb] = await Promise.all([
        TenantQuotaTracker.getUsage(tenantId, 'messages'),
        TenantQuotaTracker.getUsage(tenantId, 'ai'),
        TenantQuotaTracker.getUsage(tenantId, 'kb'),
      ]);

      const usage = { messages, ai, kb };

      res.status(200).json({
        data: {
          plan,
          limits,
          usage,
        },
        plan,
        limits,
        usage,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/billing/checkout - generates checkout session (Stripe or mock)
billingRouter.post(
  '/checkout',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const plan = req.body?.plan || 'PRO';

      if (!['FREE', 'PRO'].includes(plan)) {
        res.status(400).json({ title: 'Validation error', detail: 'Invalid plan' });
        return;
      }

      const stripeKey = process.env['STRIPE_SECRET_KEY'];
      if (stripeKey) {
        const successUrl =
          process.env['STRIPE_SUCCESS_URL'] ||
          'http://localhost:3000/settings?session_id={CHECKOUT_SESSION_ID}';
        const cancelUrl = process.env['STRIPE_CANCEL_URL'] || 'http://localhost:3000/settings';

        const params = new URLSearchParams({
          success_url: successUrl,
          cancel_url: cancelUrl,
          mode: 'subscription',
          client_reference_id: tenantId,
          'metadata[tenantId]': tenantId,
          'metadata[plan]': plan,
          'line_items[0][price_data][currency]': 'usd',
          'line_items[0][price_data][product_data][name]': `SupportPilot ${plan} Plan`,
          'line_items[0][price_data][unit_amount]': '4900',
          'line_items[0][price_data][recurring][interval]': 'month',
          'line_items[0][quantity]': '1',
        });

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        const stripeData = (await stripeRes.json()) as any;
        if (!stripeRes.ok) {
          throw new AppError(
            stripeRes.status,
            stripeData.error?.message || 'Stripe checkout creation failed',
            '/errors/stripe-error',
          );
        }

        res.status(200).json({
          sessionId: stripeData.id,
          checkoutUrl: stripeData.url,
          status: 'open',
          data: {
            sessionId: stripeData.id,
            checkoutUrl: stripeData.url,
            status: 'open',
          },
        });
        return;
      }

      // Mock mode
      const random = Math.random().toString(36).substring(2, 10);
      const sessionId = `cs_mock_${random}`;
      const checkoutUrl = 'http://localhost:3000/settings?session_id=mock';

      res.status(200).json({
        sessionId,
        checkoutUrl,
        status: 'simulated',
        data: {
          sessionId,
          checkoutUrl,
          status: 'simulated',
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/billing/webhook - webhook handler for Stripe or mock events
billingRouter.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body || {};
    const eventType = body.event || body.type;

    if (!eventType) {
      res.status(400).json({ title: 'Validation error', detail: 'Missing event type' });
      return;
    }

    if (eventType === 'checkout.session.completed') {
      let tenantId: string | undefined = body.data?.tenantId;
      let plan: 'FREE' | 'PRO' = body.data?.plan === 'FREE' ? 'FREE' : 'PRO';

      // Standard Stripe webhook payload support
      if (!tenantId && body.data?.object) {
        const obj = body.data.object;
        tenantId = obj.client_reference_id || obj.metadata?.tenantId;
        if (obj.metadata?.plan === 'FREE' || obj.metadata?.plan === 'PRO') {
          plan = obj.metadata.plan;
        }
      }

      if (!tenantId) {
        res
          .status(400)
          .json({ title: 'Validation error', detail: 'Missing tenantId in event data' });
        return;
      }

      if (isDbConnected() || 'mock' in Tenant.findByIdAndUpdate) {
        const updated = await Tenant.findByIdAndUpdate(
          tenantId,
          { $set: { plan, updatedAt: new Date() } },
          { new: true },
        );

        if (!updated) {
          res.status(404).json({ title: 'Not found', detail: 'Tenant not found' });
          return;
        }

        res.status(200).json({
          received: true,
          tenantId,
          plan: updated.plan,
        });
        return;
      }

      res.status(200).json({
        received: true,
        tenantId,
        plan,
      });
      return;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});
