import { useState, useEffect } from 'react';
import { api, type TeamMemberItem } from '../../lib/api';
import { toast } from '../../store/toast.store';
import { X, Loader2, ArrowRightLeft } from 'lucide-react';

export interface TransferTicketModalProps {
  isOpen: boolean;
  ticketId: string;
  ticketNumber: number;
  currentAssigneeId?: string;
  version?: number;
  onClose: () => void;
  onTransferred: () => void;
}

export function TransferTicketModal({
  isOpen,
  ticketId,
  ticketNumber,
  currentAssigneeId,
  version,
  onClose,
  onTransferred,
}: TransferTicketModalProps) {
  const [members, setMembers] = useState<TeamMemberItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState(currentAssigneeId || '');
  const [loading, setLoading] = useState(false);
  const [fetchingTeam, setFetchingTeam] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    async function loadMembers() {
      try {
        setFetchingTeam(true);
        const list = await api.team.list();
        setMembers(list);
      } catch (err) {
        toast.error((err as Error).message || 'Failed to fetch team list');
      } finally {
        setFetchingTeam(false);
      }
    }
    loadMembers();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTransfer = async () => {
    if (!selectedAgentId) return;
    try {
      setLoading(true);
      await api.tickets.update(ticketId, {
        version: version ?? 1,
        assigneeId: selectedAgentId,
      });
      toast.success(`Ticket #${ticketNumber} successfully reassigned.`);
      onTransferred();
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'Failed to reassign ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      data-testid="transfer-ticket-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-ticket-title"
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="transfer-ticket-title"
                className="font-semibold text-sm text-zinc-900 dark:text-zinc-100"
              >
                Transfer Ticket #{ticketNumber}
              </h3>
              <p className="text-[11px] text-zinc-500">Reassign ticket ownership to a colleague</p>
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

        {fetchingTeam ? (
          <div className="py-6 flex items-center justify-center space-x-2 text-xs text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading active agents...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Assignee Agent
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                      selectedAgentId === member.id
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40'
                        : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-xs font-bold">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {member.name}
                        </p>
                        <p className="text-[11px] text-zinc-500">{member.role}</p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="agent"
                      value={member.id}
                      checked={selectedAgentId === member.id}
                      onChange={() => setSelectedAgentId(member.id)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                ))}
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
                type="button"
                onClick={handleTransfer}
                disabled={loading || !selectedAgentId || selectedAgentId === currentAssigneeId}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center space-x-1.5 cursor-pointer"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Transfer</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
