import { Router, type Request, type Response } from 'express';
import { requireMinRole, executeRules } from '@supportpilot/shared-lib';
import { requireAuth } from '../middleware/auth.middleware.js';
import { RuleRepository } from '../repositories/rule.repository.js';
import type { RuleDto, TicketDto } from '@supportpilot/shared-types';

export const ruleRouter: Router = Router();

// Enforce authentication on all rule endpoints
ruleRouter.use(requireAuth);

// GET /api/v1/rules — list rules for tenant
ruleRouter.get('/', requireMinRole('AGENT'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const repo = new RuleRepository(tenantId);
    const rules = await repo.listAllRules();
    res.json({ rules });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/v1/rules — create rule (LEAD+)
ruleRouter.post('/', requireMinRole('LEAD'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const repo = new RuleRepository(tenantId);

    const { name, description, event, conditions, conditionLogic, actions, enabled, order } =
      req.body;

    if (!name) {
      res.status(400).json({ error: 'Rule name is required' });
      return;
    }

    const created = await repo.create({
      name,
      description,
      event: event || 'TICKET_CREATED',
      conditions: conditions || [],
      conditionLogic: conditionLogic || 'AND',
      actions: actions || [],
      enabled: enabled !== undefined ? enabled : true,
      order: order !== undefined ? order : 10,
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/v1/rules/:id
ruleRouter.get('/:id', requireMinRole('AGENT'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const repo = new RuleRepository(tenantId);
    const rule = await repo.findById(req.params.id as string);

    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    res.json(rule);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// PATCH /api/v1/rules/:id (LEAD+)
ruleRouter.patch('/:id', requireMinRole('LEAD'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const repo = new RuleRepository(tenantId);

    const updated = await repo.updateById(req.params.id as string, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /api/v1/rules/:id (LEAD+)
ruleRouter.delete('/:id', requireMinRole('LEAD'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const repo = new RuleRepository(tenantId);

    const deleted = await repo.deleteById(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /api/v1/rules/test-evaluate — dry-run evaluation
ruleRouter.post('/test-evaluate', requireMinRole('AGENT'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const repo = new RuleRepository(tenantId);
    const rules = await repo.findActiveRules('TICKET_CREATED');

    const ticket = req.body.ticket as TicketDto;
    if (!ticket) {
      res.status(400).json({ error: 'ticket object required for evaluation' });
      return;
    }

    const rulesDto = rules.map((r) => (typeof r.toJSON === 'function' ? r.toJSON() : r) as RuleDto);
    const result = executeRules(rulesDto, { ticket, message: req.body.message });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
