export interface WidgetTheme {
  primaryColor?: string;
  logoUrl?: string;
  title?: string;
  greeting?: string;
}

export interface WidgetCitation {
  chunkId: string;
  docId: string;
  title: string;
}

export interface WidgetMessage {
  id: string;
  seq: number;
  clientId?: string;
  body: string;
  senderType: 'CUSTOMER' | 'AI' | 'AGENT' | 'SYSTEM';
  createdAt: string;
  pending?: boolean;
  citations?: WidgetCitation[];
  attachments?: { key: string; name: string; size: number; mime: string }[];
}

export interface WidgetConfig {
  tenantId: string;
  gatewayUrl?: string;
  theme?: WidgetTheme;
  isOffline?: boolean;
}
