import React from 'react';
import { Sparkles, X, Check, AlertCircle, FileText } from 'lucide-react';
import type { Citation } from '@supportpilot/shared-types';

export interface DraftBubbleProps {
  draftText: string;
  isThinking: boolean;
  isStreaming: boolean;
  citations: Citation[];
  confidence: number | null;
  shouldEscalate: boolean;
  error?: string | null;
  onApplyDraft: (text: string) => void;
  onDiscard: () => void;
}

export const DraftBubble: React.FC<DraftBubbleProps> = ({
  draftText,
  isThinking,
  isStreaming,
  citations,
  confidence,
  shouldEscalate,
  error,
  onApplyDraft,
  onDiscard,
}) => {
  if (!isThinking && !isStreaming && !draftText && !error) {
    return null;
  }

  return (
    <div
      data-testid="ai-draft-bubble"
      className="border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-lg p-3.5 mb-3 shadow-sm transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
          <Sparkles className={`w-3.5 h-3.5 ${isStreaming || isThinking ? 'animate-spin' : ''}`} />
          <span>AI Streaming Suggestion</span>
          {isThinking && (
            <span className="inline-flex items-center gap-1 text-[11px] font-normal text-indigo-600 dark:text-indigo-300 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
              Thinking...
            </span>
          )}
          {confidence !== null && (
            <span
              data-testid="draft-confidence"
              className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300"
            >
              {(confidence * 100).toFixed(0)}% confidence
            </span>
          )}
          {shouldEscalate && (
            <span
              data-testid="draft-escalate"
              className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 flex items-center gap-0.5"
            >
              <AlertCircle className="w-3 h-3" />
              Escalation suggested
            </span>
          )}
        </div>
        <button
          onClick={onDiscard}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 rounded"
          title="Discard suggestion"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {error ? (
        <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div
            data-testid="draft-token-content"
            className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto"
          >
            {draftText}
            {isStreaming && (
              <span className="inline-block w-1.5 h-3.5 bg-indigo-600 ml-0.5 animate-pulse align-middle" />
            )}
          </div>

          {citations.length > 0 && (
            <div
              data-testid="draft-citations"
              className="mt-2.5 pt-2 border-t border-indigo-100 dark:border-indigo-900/50 flex flex-wrap gap-1.5"
            >
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium self-center">
                Sources:
              </span>
              {citations.map((c, i) => (
                <span
                  key={c.chunkId || i}
                  className="inline-flex items-center gap-1 text-[11px] bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full text-indigo-700 dark:text-indigo-300"
                >
                  <FileText className="w-2.5 h-2.5 text-indigo-500" />
                  <span>{c.title}</span>
                </span>
              ))}
            </div>
          )}

          {!isStreaming && draftText && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onDiscard}
                className="text-xs px-2.5 py-1 text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800 rounded transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                data-testid="apply-draft-btn"
                onClick={() => onApplyDraft(draftText)}
                className="text-xs px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded shadow-sm flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" />
                Use Draft
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
