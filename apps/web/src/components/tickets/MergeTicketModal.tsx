import { useState } from 'react';
import { api } from '../../lib/api';
import { toast } from '../../store/toast.store';
import { GitMerge, X, Loader2, AlertTriangle } from 'lucide-react';

export interface MergeTicketModalProps {
  isOpen: boolean;
  ticketId: string;
  ticketNumber: number;
  version?: number;
  onClose: () => void;
  onMerged: () => void;
}

export function MergeTicketModal({
  isOpen,
  ticketId,
  ticketNumber,
  version,
  onClose,
  onMerged,
}: MergeTicketModalProps) {
  const [targetNumber, setTargetNumber] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetNumber.trim()) return;

    try {
      setLoading(true);
      // Link ticket and close as duplicate (TKT-6)
      await api.tickets.addMessage(
        ticketId,
        `[Duplicate Ticket Merged]: This conversation was merged into Ticket #${targetNumber.trim()}.`,
        true,
      );
      await api.tickets.update(ticketId, {
        version: version ?? 1,
        status: 'CLOSED',
      });
      toast.success(`Ticket #${ticketNumber} merged into #${targetNumber.trim()} and closed.`);
      onMerged();
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to merge ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      data-testid="merge-ticket-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-ticket-title"
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg">
              <GitMerge className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="merge-ticket-title"
                className="font-semibold text-sm text-zinc-900 dark:text-zinc-100"
              >
                Merge Ticket #{ticketNumber}
              </h3>
              <p className="text-[11px] text-zinc-500">
                Combine duplicate ticket thread into primary
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleMerge} className="space-y-4">
          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              Merging will append an internal note with thread context to Ticket #{ticketNumber} and
              mark it CLOSED as a duplicate.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Primary Ticket Number
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400 text-xs">
                #
              </span>
              <input
                type="number"
                required
                value={targetNumber}
                onChange={(e) => setTargetNumber(e.target.value)}
                placeholder="1001"
                className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !targetNumber.trim()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Merge & Close Duplicate</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
