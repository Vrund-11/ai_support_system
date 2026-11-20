import { Router, type Request, type Response, type NextFunction } from 'express';
import { Types } from 'mongoose';
import { createCustomerSchema, customerFilterSchema } from '@supportpilot/validators';
import { AppError } from '@supportpilot/shared-lib';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireMinRole } from '../middleware/rbac.middleware.js';
import { CustomerRepository } from '../repositories/customer.repository.js';

export const customerRouter: Router = Router();

customerRouter.use(requireAuth, requireMinRole('AGENT'));

// GET /api/v1/customers — list customers with pagination and search
customerRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = customerFilterSchema.safeParse(req.query);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    const tenantId = req.user!.tenantId;
    const customerRepo = new CustomerRepository(tenantId);
    const result = await customerRepo.listCustomers(parseResult.data);

    res.status(200).json({
      data: result.items,
      meta: {
        cursor: result.nextCursor,
        hasMore: Boolean(result.nextCursor),
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/customers — create or upsert customer
customerRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = createCustomerSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const message = issue ? `${issue.path.join('.')}: ${issue.message}` : 'Validation error';
      throw new AppError(400, message, '/errors/validation');
    }

    const tenantId = req.user!.tenantId;
    const customerRepo = new CustomerRepository(tenantId);
    const customer = await customerRepo.createOrUpdate(parseResult.data);

    res.status(201).json({ data: customer });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/:id — get customer details
customerRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = Array.isArray(req.params['id']) ? req.params['id'][0]! : req.params['id']!;
    if (!Types.ObjectId.isValid(customerId)) {
      throw new AppError(404, 'Customer not found', '/errors/not-found');
    }

    const tenantId = req.user!.tenantId;
    const customerRepo = new CustomerRepository(tenantId);
    const customer = await customerRepo.findById(customerId);

    if (!customer) {
      throw new AppError(404, 'Customer not found', '/errors/not-found');
    }

    res.status(200).json({ data: customer });
  } catch (err) {
    next(err);
  }
});
