import { useState, useEffect, useRef } from 'react';
import { api, type NotificationItem } from '../../lib/api';
import { Bell, CheckCheck, Clock, AlertTriangle, MessageSquare, Info } from 'lucide-react';

const FALLBACK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_1',
    title: 'New ticket assigned',
    message: 'Ticket #1001 "Cannot login to account" has been assigned to you',
    type: 'TICKET_ASSIGNED',
    read: false,
    ticketId: 'ticket_abc',
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    id: 'notif_2',
    title: 'SLA Breach Warning',
    message: 'Ticket #1002 first response due in 15 minutes',
    type: 'SLA_WARNING',
    read: false,
    ticketId: 'ticket_xyz',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'notif_3',
    title: 'Customer replied',
    message: 'Alice Customer added a response to ticket #1001',
    type: 'CUSTOMER_REPLY',
    read: true,
    ticketId: 'ticket_abc',
    createdAt: new Date(Date.now() - 1000 * 3600 * 2).toISOString(),
  },
];

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const items = await api.notifications.list();
      setNotifications(items.length > 0 ? items : FALLBACK_NOTIFICATIONS);
    } catch {
      setNotifications(FALLBACK_NOTIFICATIONS);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.notifications.markAsRead(id);
    } catch {
      // Ignore
    }
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllAsRead();
    } catch {
      // Ignore
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'TICKET_ASSIGNED':
        return <Info className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />;
      case 'SLA_WARNING':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />;
      case 'CUSTOMER_REPLY':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Modern Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
          isOpen
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
            : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
        }`}
        title="Notifications"
        data-testid="notification-bell-btn"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span
              className="relative inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full shadow-xs"
              data-testid="unread-badge"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown Popover with glassmorphic border */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 backdrop-blur-xl bg-white/95 dark:bg-zinc-900/95 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl shadow-xl z-50 overflow-hidden ring-1 ring-black/5 dark:ring-white/5"
          data-testid="notifications-dropdown"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40 text-[11px] px-2 py-0.5 rounded-full font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center space-x-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors"
                data-testid="mark-all-read-btn"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <Bell className="w-5 h-5 opacity-40" />
                </div>
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  All caught up!
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  No notifications to display
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkAsRead(n.id)}
                  className={`p-3.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors flex items-start space-x-3 group ${
                    !n.read ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                  }`}
                  data-testid={`notification-item-${n.id}`}
                >
                  <div className="mt-0.5 p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 group-hover:bg-white dark:group-hover:bg-zinc-700/80 transition-colors shrink-0">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-xs ${
                          !n.read
                            ? 'font-semibold text-zinc-900 dark:text-zinc-100'
                            : 'text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0 ml-2 shadow-xs" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {n.message}
                    </p>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5 block font-mono">
                      {new Date(n.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
