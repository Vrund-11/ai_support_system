import React from 'react';
import InboxScreen from './inbox.js';

export default function MineScreen({ onSelectTicket }: { onSelectTicket?: (id: string) => void }) {
  return <InboxScreen onSelectTicket={onSelectTicket} />;
}
