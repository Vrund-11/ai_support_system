import type { Request } from 'express';
import type { AuthUser } from '@supportpilot/shared-types';
import { createLoaders, type Loaders } from './loaders.js';

export interface GraphQLContext {
  user?: AuthUser;
  tenantId?: string;
  requestId: string;
  authToken?: string;
  loaders: Loaders;
  ticketServiceUrl: string;
  serviceToken: string;
}

export interface CreateContextOptions {
  req: Request;
  ticketServiceUrl: string;
  serviceToken: string;
}

export function createGraphQLContext(options: CreateContextOptions): GraphQLContext {
  const { req, ticketServiceUrl, serviceToken } = options;
  const user = req.user;
  const tenantId = user?.tenantId;
  const requestId = (req.headers['x-request-id'] as string) || 'req-graphql';
  const authToken = req.headers.authorization;

  const loaders = createLoaders({
    ticketServiceUrl,
    serviceToken,
    tenantId,
    authToken,
  });

  return {
    user,
    tenantId,
    requestId,
    authToken,
    loaders,
    ticketServiceUrl,
    serviceToken,
  };
}
