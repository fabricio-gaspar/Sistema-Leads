import { describe, expect, it } from 'vitest';
import { countRequiredIntegrationAttention, hasOptionalIntegrationAttention } from './integrationAttention';

describe('operational integration attention', () => {
  it('does not block the core flow because an optional provider is unconfigured', () => {
    const integrations = [
      { remoteKey: 'ai', status: 'validated' },
      { remoteKey: 'apify', status: 'validated' },
      { remoteKey: 'linkedin', status: 'not_configured' },
    ];
    expect(countRequiredIntegrationAttention(integrations)).toBe(0);
    expect(hasOptionalIntegrationAttention(integrations)).toBe(true);
  });

  it('keeps required provider failures visible', () => {
    expect(countRequiredIntegrationAttention([{ remoteKey: 'ai', status: 'validation_due' }])).toBe(1);
  });
});
