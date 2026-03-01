import { PayUClient } from './types';
import { MockPayUClient } from './mockClient';
import { LivePayUClient } from './liveClient';

export function createPayUClient(): PayUClient {
  const mode = (process.env.PAYU_MODE || 'mock') as 'mock' | 'live';
  return mode === 'live' ? new LivePayUClient() : new MockPayUClient();
}

export function getPayUMode(): 'mock' | 'live' {
  return (process.env.PAYU_MODE || 'mock') as 'mock' | 'live';
}
