import DataLoader from 'dataloader';

export interface LoadedUser {
  id: string;
  name: string;
  email?: string;
  role: string;
}

export interface Loaders {
  userLoader: DataLoader<string, LoadedUser | null>;
}

export interface LoaderOptions {
  ticketServiceUrl: string;
  serviceToken: string;
  tenantId?: string;
  authToken?: string;
}

/**
 * Creates per-request DataLoaders to eliminate N+1 queries when
 * resolving nested relationships (e.g. ticket.assignee, ticket.customer).
 * PRD requirement: DataLoader for assignee/customer.
 */
export function createLoaders(options: LoaderOptions): Loaders {
  const { ticketServiceUrl, serviceToken, tenantId, authToken } = options;

  const userLoader = new DataLoader<string, LoadedUser | null>(
    async (userIds: readonly string[]) => {
      if (!tenantId || userIds.length === 0) {
        return userIds.map(() => null);
      }

      try {
        const uniqueIds = Array.from(new Set(userIds)).join(',');
        const res = await fetch(`${ticketServiceUrl}/api/v1/users/batch?ids=${uniqueIds}`, {
          headers: {
            'x-service-token': serviceToken,
            ...(authToken ? { Authorization: authToken } : {}),
          },
        });

        if (!res.ok) {
          return userIds.map(() => null);
        }

        const body = (await res.json()) as { data: LoadedUser[] };
        const userMap = new Map<string, LoadedUser>();
        for (const u of body.data) {
          userMap.set(u.id, u);
        }

        return userIds.map((id) => userMap.get(id) ?? null);
      } catch {
        return userIds.map(() => null);
      }
    },
    { cache: true },
  );

  return { userLoader };
}
