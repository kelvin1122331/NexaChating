import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasTrustedOrigin } from '@/lib/server/api';

describe('API origin protection', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('accepts the same-origin host forwarded by the preview proxy', () => {
    const request = new Request('https://app.example.test/api/messages/send', {
      method: 'POST',
      headers: { origin: 'https://app.example.test', 'x-forwarded-host': 'app.example.test' },
    });
    expect(hasTrustedOrigin(request)).toBe(true);
  });

  it('accepts an explicitly configured app origin when the proxy host differs', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://nexa.example.com');
    const request = new Request('https://internal-host/api/messages/send', {
      method: 'POST',
      headers: { origin: 'https://nexa.example.com', host: 'internal-host' },
    });
    expect(hasTrustedOrigin(request)).toBe(true);
  });

  it('rejects cross-site, malformed, and missing origins', () => {
    const crossSite = new Request('https://app.example.test/api/messages/send', {
      method: 'POST',
      headers: { origin: 'https://attacker.example', host: 'app.example.test' },
    });
    const noOrigin = new Request('https://app.example.test/api/messages/send', { method: 'POST' });
    expect(hasTrustedOrigin(crossSite)).toBe(false);
    expect(hasTrustedOrigin(noOrigin)).toBe(false);
  });
});
