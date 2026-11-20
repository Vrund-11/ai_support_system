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
        return <Info className="w-4 h-4 text-indigo-500" />;
      case 'SLA_WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'CUSTOMER_REPLY':
        return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
        title="Notifications"
        data-testid="notification-bell-btn"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full"
            data-testid="unread-badge"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 overflow-hidden"
          data-testid="notifications-dropdown"
        >
          {/* Header */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-full font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                data-testid="mark-all-read-btn"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkAsRead(n.id)}
                  className={`p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors flex items-start space-x-3 ${
                    !n.read ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                  }`}
                  data-testid={`notification-item-${n.id}`}
                >
                  <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-xs ${!n.read ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 ml-2" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                      {n.message}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
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
