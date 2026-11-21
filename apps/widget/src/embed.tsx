import React from 'react';
import ReactDOM from 'react-dom/client';
import { WidgetApp } from './WidgetApp';
import type { WidgetConfig, WidgetTheme } from './types';
import './index.css';

declare global {
  interface Window {
    SupportPilot?: {
      init: (config: WidgetConfig) => void;
      open: () => void;
      close: () => void;
      openWithTopic?: (topic: string) => void;
    };
  }
}

export function mountWidget(config: WidgetConfig): void {
  const containerId = 'supportpilot-widget-root';
  let container = document.getElementById(containerId);

  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }

  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <WidgetApp {...config} />
    </React.StrictMode>,
  );
}

// Auto-initialize when loaded via script tag: <script src="..." data-tenant-id="..." ...></script>
if (typeof document !== 'undefined') {
  const currentScript =
    (document.currentScript as HTMLScriptElement | null) ||
    document.querySelector<HTMLScriptElement>('script[data-tenant-id]');
  if (currentScript) {
    const tenantId = currentScript.getAttribute('data-tenant-id');
    const gatewayUrl = currentScript.getAttribute('data-gateway-url') || 'http://localhost:4000';
    const primaryColor = currentScript.getAttribute('data-primary-color');
    const title = currentScript.getAttribute('data-title');

    if (tenantId) {
      const theme: WidgetTheme = {};
      if (primaryColor) theme.primaryColor = primaryColor;
      if (title) theme.title = title;

      mountWidget({
        tenantId,
        gatewayUrl,
        theme,
      });
    }
  }

  // Global browser API
  window.SupportPilot = {
    init: mountWidget,
    open: () => {
      const chatWindow = document.querySelector('[data-testid="widget-chat-window"]');
      if (!chatWindow) {
        const bubble = document.querySelector<HTMLButtonElement>(
          '[data-testid="widget-bubble-button"]',
        );
        bubble?.click();
      }
    },
    close: () => {
      const closeBtn = document.querySelector<HTMLButtonElement>(
        '[data-testid="widget-close-button"]',
      );
      closeBtn?.click();
    },
    openWithTopic: (topic: string) => {
      window.SupportPilot?.open();
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(
          '[data-testid="widget-composer-input"]',
        );
        if (input) {
          input.value = topic;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.focus();
        }
      }, 100);
    },
  };
}

export { WidgetApp };
