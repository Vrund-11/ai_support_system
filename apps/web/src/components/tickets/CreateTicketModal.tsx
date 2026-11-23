import { useState } from 'react';
import { useCreateTicket } from '../../hooks/useTickets';
import type { TicketPriority } from '@supportpilot/shared-types';

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (ticketId: string) => void;
}

export function CreateTicketModal({ isOpen, onClose, onSuccess }: CreateTicketModalProps) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [customerEmail, setCustomerEmail] = useState('');
  const [tags, setTags] = useState<string[]>(['billing', 'enterprise']);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createTicket = useCreateTicket();

  if (!isOpen) return null;

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const ticket = await createTicket.mutateAsync({
        subject,
        description,
        priority,
        customerEmail: customerEmail || undefined,
        tags: tags.length ? tags : undefined,
      });
      // Reset form and close
      setSubject('');
      setDescription('');
      setPriority('MEDIUM');
      setCustomerEmail('');
      setTags(['billing', 'enterprise']);
      onClose();
      onSuccess((ticket as any)?.id || (ticket as any)?._id);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to create ticket. Please verify inputs.';
      setError(errorMsg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-neutral/50 backdrop-blur-sm flex items-center justify-center p-space-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="w-full max-w-2xl bg-surface rounded-xl shadow-xl overflow-hidden flex flex-col my-auto border border-border animate-in fade-in zoom-in-95 duration-150"
        id="create-ticket-modal"
      >
        {/* Modal Header */}
        <div className="px-space-lg py-space-md bg-surface flex items-center justify-between border-b border-border shadow-xs">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[18px]">confirmation_number</span>
            </div>
            <h2
              className="font-headline-md text-headline-md text-text-primary font-bold"
              id="modal-title"
            >
              Create New Ticket
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {error && (
          <div className="mx-space-lg mt-space-md p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center gap-2 text-error text-sm font-medium">
            <span className="material-symbols-outlined text-[18px] text-error shrink-0">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Modal Form Body */}
        <form
          onSubmit={handleSubmit}
          className="p-space-lg flex flex-col gap-space-md bg-surface"
          id="create-ticket-form"
        >
          {/* 1. Subject */}
          <div className="flex flex-col gap-space-xs">
            <label
              className="font-body-sm text-body-sm font-medium text-text-primary"
              htmlFor="ticket-subject"
            >
              Subject <span className="text-priority-urgent">*</span>
            </label>
            <input
              id="ticket-subject"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of the issue..."
              className="w-full h-10 px-space-md bg-surface-subtle border border-border rounded-lg font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:bg-surface focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          {/* 2. Customer Email & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-space-md">
            {/* Customer Email */}
            <div className="md:col-span-7 flex flex-col gap-space-xs">
              <label
                className="font-body-sm text-body-sm font-medium text-text-primary"
                htmlFor="customer-email"
              >
                Customer Email <span className="text-priority-urgent">*</span>
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-space-md text-text-secondary text-[18px] pointer-events-none">
                  person_search
                </span>
                <input
                  id="customer-email"
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="e.g., marcus.chen@acme.io"
                  className="w-full h-10 pl-10 pr-space-md bg-surface-subtle border border-border rounded-lg font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none focus:bg-surface focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
            </div>

            {/* Priority Selector */}
            <div className="md:col-span-5 flex flex-col gap-space-xs">
              <label
                className="font-body-sm text-body-sm font-medium text-text-primary"
                htmlFor="priority-select"
              >
                Priority
              </label>
              <select
                id="priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full h-10 px-space-md bg-surface-subtle border border-border rounded-lg font-body-md text-body-md text-text-primary focus:outline-none focus:bg-surface focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
              >
                <option value="LOW">LOW — General</option>
                <option value="MEDIUM">MEDIUM — Standard</option>
                <option value="HIGH">HIGH — 4h SLA</option>
                <option value="URGENT">URGENT — 1h SLA</option>
              </select>
            </div>
          </div>

          {/* 3. Description */}
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center justify-between">
              <label
                className="font-body-sm text-body-sm font-medium text-text-primary"
                htmlFor="ticket-description"
              >
                Description
              </label>
              <span className="font-code-mono text-code-mono text-text-secondary">
                Markdown supported
              </span>
            </div>
            <div className="rounded-lg bg-surface-subtle border border-border overflow-hidden flex flex-col">
              <div className="px-space-sm py-space-xs bg-surface-container-low border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-[18px] text-text-secondary p-1">
                    format_bold
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-text-secondary p-1">
                    format_italic
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-text-secondary p-1">
                    code
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-text-secondary p-1">
                    format_list_bulleted
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-text-secondary p-1">
                    link
                  </span>
                </div>
                <span className="px-space-xs py-0.5 rounded bg-surface font-code-mono text-code-mono text-text-secondary text-xs">
                  MD
                </span>
              </div>
              <textarea
                id="ticket-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue, steps to reproduce, or expected behavior..."
                className="w-full p-space-md bg-transparent font-body-md text-body-md text-text-primary placeholder:text-text-secondary focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* 4. Tags */}
          <div className="flex flex-col gap-space-xs">
            <label
              className="font-body-sm text-body-sm font-medium text-text-primary"
              htmlFor="tag-input"
            >
              Tags (press Enter to add)
            </label>
            <div className="w-full min-h-[42px] px-space-sm py-space-xs bg-surface-subtle border border-border rounded-lg flex flex-wrap items-center gap-space-xs">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-space-sm py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-body-sm text-body-sm font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove ${tag} tag`}
                    className="hover:text-primary transition-colors flex items-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </span>
              ))}
              <input
                id="tag-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Add tag..."
                className="flex-1 min-w-[100px] bg-transparent px-space-xs py-0.5 font-body-sm text-body-sm text-text-primary placeholder:text-text-secondary focus:outline-none"
              />
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-space-lg py-space-md bg-surface-subtle border-t border-border flex items-center justify-end gap-space-sm">
          <button
            onClick={onClose}
            type="button"
            className="px-space-md py-space-sm rounded-lg bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-variant font-body-md text-body-md font-medium transition-colors border border-border shadow-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            form="create-ticket-form"
            type="submit"
            disabled={createTicket.isPending}
            className="px-space-lg py-space-sm rounded-lg bg-primary-container hover:bg-primary text-on-primary font-body-md text-body-md font-medium inline-flex items-center gap-space-xs transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            {createTicket.isPending ? (
              <span className="inline-block w-4 h-4 rounded-full border-2 border-on-primary border-t-transparent animate-spin mr-1" />
            ) : null}
            <span>Create Ticket</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
