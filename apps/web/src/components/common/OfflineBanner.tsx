import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      className="bg-amber-500 text-white text-xs font-medium py-1.5 px-4 flex items-center justify-center space-x-2 shadow-sm z-50 sticky top-0"
      data-testid="offline-banner"
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span>
        You are currently offline. Changes will automatically sync once your connection is restored.
      </span>
    </div>
  );
}
