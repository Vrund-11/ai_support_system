import { ApolloServer, HeaderMap } from '@apollo/server';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import type { Express, Request, RequestHandler } from 'express';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers/index.js';
import { createDepthLimitRule } from './rules/depth-limit.js';
import { createComplexityLimitRule } from './rules/complexity-limit.js';
import { createGraphQLContext, type GraphQLContext } from './context.js';

export interface GraphQLServerOptions {
  ticketServiceUrl: string;
  serviceToken: string;
  maxDepth?: number;
  maxComplexity?: number;
}

/**
 * Creates Apollo Server instance with depth limit (8), complexity limit (100),
 * and playground / sandbox enabled in development/test (INT-3).
 */
export function createApolloServer(
  options?: Partial<GraphQLServerOptions>,
): ApolloServer<GraphQLContext> {
  const isProd = process.env['NODE_ENV'] === 'production';
  const maxDepth = options?.maxDepth ?? 8;
  const maxComplexity = options?.maxComplexity ?? 100;

  return new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    introspection: !isProd,
    plugins: [
      !isProd
        ? ApolloServerPluginLandingPageLocalDefault({ embed: true })
        : {
            async serverWillStart() {
              return {};
            },
          },
    ],
    validationRules: [createDepthLimitRule(maxDepth), createComplexityLimitRule(maxComplexity)],
  });
}

/**
 * Zero-dependency native Express middleware for ApolloServer v5 (INT-3).
 */
export function createExpressMiddleware(
  server: ApolloServer<GraphQLContext>,
  contextFn: (req: Request) => Promise<GraphQLContext>,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const headers = new HeaderMap();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
      }

      const search = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      const httpGraphQLRequest = {
        method: req.method,
        headers,
        search,
        body: req.body,
      };

      const contextValue = await contextFn(req);
      const httpResponse = await server.executeHTTPGraphQLRequest({
        httpGraphQLRequest,
        context: async () => contextValue,
      });

      for (const [headerKey, headerVal] of httpResponse.headers) {
        res.setHeader(headerKey, headerVal);
      }
      res.status(httpResponse.status ?? 200);

      if (httpResponse.body.kind === 'complete') {
        res.send(httpResponse.body.string);
        return;
      }

      for await (const chunk of httpResponse.body.asyncIterator) {
        res.write(chunk);
      }
      res.end();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Mounts Apollo Server onto an Express application at `/graphql`.
 * Keeps Express app initialization non-blocking.
 */
export function setupGraphQL(
  app: Express,
  options: GraphQLServerOptions,
): {
  server: ApolloServer<GraphQLContext>;
  ready: Promise<void>;
} {
  const server = createApolloServer(options);

  let middleware: RequestHandler | null = null;
  const ready = server.start().then(() => {
    middleware = createExpressMiddleware(server, async (req) =>
      createGraphQLContext({
        req,
        ticketServiceUrl: options.ticketServiceUrl,
        serviceToken: options.serviceToken,
      }),
    );
  });

  app.use('/graphql', async (req, res, next) => {
    if (!middleware) {
      await ready;
    }
    return middleware!(req, res, next);
  });

  return { server, ready };
}
