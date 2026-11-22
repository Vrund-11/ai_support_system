import type { PushProvider } from './types.js';
import { ExpoPushProvider } from './expo-provider.js';
import { testPushProvider } from './test-provider.js';

export * from './types.js';
export * from './expo-provider.js';
export * from './test-provider.js';

let pushProviderInstance: PushProvider | null = null;

export function getPushProvider(): PushProvider {
  if (pushProviderInstance) {
    return pushProviderInstance;
  }

  if (process.env['NODE_ENV'] === 'test' || !process.env['EXPO_ACCESS_TOKEN']) {
    pushProviderInstance = testPushProvider;
  } else {
    pushProviderInstance = new ExpoPushProvider();
  }

  return pushProviderInstance;
}

export function setPushProvider(provider: PushProvider | null): void {
  pushProviderInstance = provider;
}
