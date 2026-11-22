import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
} from '@tanstack/react-query';
import { toast } from '../store/toast.store';

export interface OptimisticMutationOptions<TData, TVariables, TContext = { prev?: unknown }> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  queryKey: QueryKey;
  applyOptimistic: (oldData: any, variables: TVariables) => any;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
    context: TContext | undefined,
  ) => void;
  onConflict?: (error: Error, variables: TVariables) => void;
  errorMessage?: string;
  conflictMessage?: string;
}

export function useOptimisticMutation<TData, TVariables>(
  options: OptimisticMutationOptions<TData, TVariables>,
): UseMutationResult<TData, Error, TVariables, { prev?: unknown }> {
  const qc = useQueryClient();

  return useMutation<TData, Error, TVariables, { prev?: unknown }>({
    mutationFn: options.mutationFn,
    onMutate: async (vars: TVariables) => {
      await qc.cancelQueries({ queryKey: options.queryKey });
      const prev = qc.getQueryData(options.queryKey);
      qc.setQueryData(options.queryKey, (old: any) => options.applyOptimistic(old, vars));
      return { prev };
    },
    onError: (err: any, vars: TVariables, ctx?: { prev?: unknown }) => {
      if (ctx && ctx.prev !== undefined) {
        qc.setQueryData(options.queryKey, ctx.prev);
      }

      const isConflict =
        err?.status === 409 ||
        err?.message?.includes('409') ||
        err?.message?.toLowerCase().includes('conflict');

      if (isConflict) {
        const msg = options.conflictMessage ?? 'Updated by someone else. Please reload.';
        toast.warning(msg, 'Conflict');
        if (options.onConflict) {
          options.onConflict(err, vars);
        }
      } else {
        const msg = options.errorMessage ?? (err?.message || "Couldn't save. Reverted.");
        toast.error(msg, 'Error');
      }

      if (options.onError) {
        options.onError(err, vars, ctx);
      }
    },
    onSuccess: (data: TData, vars: TVariables, ctx?: { prev?: unknown }) => {
      if (options.onSuccess) {
        options.onSuccess(data, vars, ctx);
      }
    },
    onSettled: (
      data: TData | undefined,
      error: Error | null,
      vars: TVariables,
      ctx?: { prev?: unknown },
    ) => {
      qc.invalidateQueries({ queryKey: options.queryKey });
      if (options.onSettled) {
        options.onSettled(data, error, vars, ctx);
      }
    },
  });
}
