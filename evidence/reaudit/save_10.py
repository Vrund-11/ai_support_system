import subprocess
from pathlib import Path

lines = []
lines.append("=== ITEM 10: ADVANCED UI FEATURES & VERIFICATION ===")
lines.append("1. GREP AND FILE:LINE LOCATIONS:")
lines.append("- Optimistic Mutation Helper:")
lines.append("  apps/web/src/lib/optimistic.ts:26 -> export function useOptimisticMutation<TData, TVariables>")
lines.append("  apps/web/src/hooks/useTickets.ts:31 -> return useOptimisticMutation({ ... }) for updateTicket")
lines.append("  apps/web/src/hooks/useTickets.ts:54 -> return useOptimisticMutation({ ... }) for addMessage")
lines.append("")
lines.append("- @tanstack/react-virtual Usage:")
lines.append("  apps/web/src/components/tickets/TicketInbox.tsx:3 -> import { useVirtualizer } from '@tanstack/react-virtual';")
lines.append("  apps/web/src/components/tickets/TicketInbox.tsx:69 -> const rowVirtualizer = useVirtualizer({ count: tickets.length, ... })")
lines.append("  apps/web/src/components/tickets/TicketDetail.tsx:2 -> import { useVirtualizer } from '@tanstack/react-virtual';")
lines.append("  apps/web/src/components/tickets/TicketDetail.tsx:82 -> const messageVirtualizer = useVirtualizer({ count: messages.length, ... })")
lines.append("")
lines.append("- prefetchQuery:")
lines.append("  apps/web/src/components/tickets/TicketInbox.tsx:93 -> void queryClient.prefetchQuery({ queryKey: ['ticket', ticket.id], ... }) [on hover]")
lines.append("  apps/web/src/components/tickets/TicketInbox.tsx:116 -> void queryClient.prefetchQuery({ queryKey: ['tickets', 'keyset', ...], ... }) [next page]")
lines.append("")
lines.append("- Streaming Hook:")
lines.append("  apps/web/src/hooks/useStreamingDraft.ts:15 -> export function useStreamingDraft()")
lines.append("  apps/web/src/components/tickets/TicketDetail.tsx:4 -> import { useStreamingDraft } from '../../hooks/useStreamingDraft';")
lines.append("  apps/web/src/components/tickets/TicketDetail.tsx:47 -> const { draft, isStreaming, error, startDraftStream } = useStreamingDraft();")
lines.append("")
lines.append("- clientId Dedupe:")
lines.append("  apps/web/src/components/tickets/TicketDetail.tsx:68 -> (item) => (m.clientId && item.clientId === m.clientId) || (m.id && item.id === m.id)")
lines.append("  apps/web/src/components/tickets/TicketDetail.tsx:199 -> const clientId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ...")
lines.append("  apps/web/src/hooks/useTickets.ts:71 -> id: vars.clientId || `pending_${Date.now()}`")
lines.append("  apps/web/src/lib/api.ts:361 -> if (clientId) payload['clientId'] = clientId;")
lines.append("")
lines.append("2. TESTS RUN RESULTS (pnpm --filter @supportpilot/web exec vitest run src/test/optimistic.test.tsx src/test/ticket-inbox.test.tsx src/test/ticket-detail.test.tsx):")
try:
    p = subprocess.run(
        ["pnpm", "--filter", "@supportpilot/web", "exec", "vitest", "run", "src/test/optimistic.test.tsx", "src/test/ticket-inbox.test.tsx", "src/test/ticket-detail.test.tsx"],
        capture_output=True, text=True, shell=True
    )
    lines.append(p.stdout)
except Exception as e:
    lines.append(str(e))

Path("evidence/reaudit/10-ui-features.txt").write_text("\n".join(lines), encoding="utf-8")
print("Saved 10-ui-features.txt successfully")
