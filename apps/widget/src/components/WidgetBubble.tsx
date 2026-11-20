import { MessageSquare, X } from 'lucide-react';

interface WidgetBubbleProps {
  isOpen: boolean;
  onToggle: () => void;
  primaryColor?: string;
  unreadCount?: number;
}

export function WidgetBubble({
  isOpen,
  onToggle,
  primaryColor = '#4f46e5',
  unreadCount = 0,
}: WidgetBubbleProps) {
  return (
    <button
      onClick={onToggle}
      style={{ backgroundColor: primaryColor }}
      aria-label={isOpen ? 'Close support chat' : 'Open support chat'}
      className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white cursor-pointer hover:opacity-95 transition-all transform active:scale-95 z-50 focus:outline-none focus:ring-4 focus:ring-indigo-300"
      data-testid="widget-bubble-button"
    >
      {isOpen ? (
        <X className="w-6 h-6" />
      ) : (
        <>
          <MessageSquare className="w-6 h-6" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white"
              data-testid="unread-badge"
            >
              {unreadCount}
            </span>
          )}
        </>
      )}
    </button>
  );
}
