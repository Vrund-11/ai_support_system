import { Router, type Request, type Response } from 'express';

export const docsRouter: Router = Router();

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SupportPilot API',
    version: '1.0.0',
    description:
      'Multi-tenant AI-augmented customer support platform API. All endpoints are tenant-isolated.',
  },
  servers: [{ url: '/api/v1', description: 'API v1 root' }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
    },
    schemas: {
      ProblemDetails: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'integer' },
          detail: { type: 'string' },
          instance: { type: 'string' },
        },
        required: ['type', 'title', 'status'],
      },
      Ticket: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tenantId: { type: 'string' },
          number: { type: 'integer' },
          subject: { type: 'string' },
          description: { type: 'string' },
          status: {
            type: 'string',
            enum: ['NEW', 'OPEN', 'PENDING_CUSTOMER', 'ON_HOLD', 'RESOLVED', 'CLOSED'],
          },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          },
          assigneeId: { type: 'string', nullable: true },
          customerId: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          customFields: { type: 'object' },
          linkedTicketIds: { type: 'array', items: { type: 'string' } },
          version: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tenantId: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
          externalId: { type: 'string' },
          visitorIds: { type: 'array', items: { type: 'string' } },
          lastSeenAt: { type: 'string', format: 'date-time' },
        },
      },
      TeamMember: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['OWNER', 'LEAD', 'AGENT', 'VIEWER'] },
          status: { type: 'string', enum: ['ACTIVE', 'INVITED', 'SUSPENDED'] },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        summary: 'User login',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Authentication successful' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/tickets': {
      get: {
        summary: 'List tickets with filters and pagination',
        tags: ['Tickets'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' } },
          { name: 'assigneeId', in: 'query', schema: { type: 'string' } },
          { name: 'tag', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
        ],
        responses: {
          200: { description: 'Tickets list' },
        },
      },
      post: {
        summary: 'Create ticket',
        tags: ['Tickets'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  subject: { type: 'string' },
                  description: { type: 'string' },
                  customerId: { type: 'string' },
                  priority: { type: 'string' },
                  assigneeId: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                  customFields: { type: 'object' },
                  linkedTicketIds: { type: 'array', items: { type: 'string' } },
                },
                required: ['subject', 'description', 'customerId'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Ticket created' },
        },
      },
    },
    '/tickets/bulk': {
      post: {
        summary: 'Perform bulk actions on tickets (TKT-8)',
        tags: ['Tickets'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  ticketIds: { type: 'array', items: { type: 'string' } },
                  action: { type: 'string', enum: ['ASSIGN', 'TAG', 'STATUS'] },
                  value: { description: 'New assignee ID, tag string, or status string' },
                },
                required: ['ticketIds', 'action', 'value'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Bulk action performed' },
        },
      },
    },
    '/tickets/{id}/link': {
      post: {
        summary: 'Link another ticket bidirectionally (TKT-6)',
        tags: ['Tickets'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  targetTicketId: { type: 'string' },
                },
                required: ['targetTicketId'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Tickets linked' },
        },
      },
    },
    '/customers': {
      get: {
        summary: 'List customers',
        tags: ['Customers'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Customers list' },
        },
      },
      post: {
        summary: 'Create or update customer',
        tags: ['Customers'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  name: { type: 'string' },
                  externalId: { type: 'string' },
                },
                required: ['email', 'name'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Customer created or updated' },
        },
      },
    },
    '/team': {
      get: {
        summary: 'List tenant team members',
        tags: ['Team'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Team list' },
        },
      },
    },
    '/team/invite': {
      post: {
        summary: 'Invite team member (LEAD+ required)',
        tags: ['Team'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string', enum: ['OWNER', 'LEAD', 'AGENT', 'VIEWER'] },
                },
                required: ['email', 'name'],
              },
            },
          },
        },
        responses: {
          201: { description: 'User invited' },
        },
      },
    },
    '/users/me/preferences': {
      get: {
        summary: 'Get current user notification preferences (NOTIF-4)',
        tags: ['Users'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'Notification preferences' },
        },
      },
      patch: {
        summary: 'Update notification preferences (NOTIF-4)',
        tags: ['Users'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'boolean' },
                  push: { type: 'boolean' },
                  inApp: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Preferences updated' },
        },
      },
    },
  },
};

// GET /api/v1/docs/openapi.json
docsRouter.get('/openapi.json', (_req: Request, res: Response) => {
  res.status(200).json(openApiSpec);
});

// GET /api/v1/docs
docsRouter.get('/', (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SupportPilot API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; font-family: sans-serif; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/v1/docs/openapi.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        deepLinking: true
      });
    };
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
});
