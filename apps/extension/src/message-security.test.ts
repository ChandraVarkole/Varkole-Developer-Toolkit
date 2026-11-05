import { describe, expect, it } from 'vitest';
import { isTrustedExtensionPageSender } from './message-security';

describe('isTrustedExtensionPageSender', () => {
  it('accepts only extension-owned pages', () => {
    expect(
      isTrustedExtensionPageSender(
        'extension-id',
        'extension-id',
        'chrome-extension://extension-id/workspace.html',
      ),
    ).toBe(true);
  });

  it('rejects content scripts and other extensions', () => {
    expect(
      isTrustedExtensionPageSender(
        'extension-id',
        'extension-id',
        'https://example.my.salesforce.com/lightning/page/home',
      ),
    ).toBe(false);
    expect(
      isTrustedExtensionPageSender(
        'extension-id',
        'another-extension',
        'chrome-extension://another-extension/workspace.html',
      ),
    ).toBe(false);
  });
});
