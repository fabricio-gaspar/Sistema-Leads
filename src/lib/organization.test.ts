import { describe, expect, it } from 'vitest';
import { organizationSlug } from '@/lib/organizationSlug';

describe('organizationSlug', () => {
  it('creates a stable URL-safe slug with tenant entropy', () => {
    expect(organizationSlug('WayFlex — Soluções', 'c1a5b3d8-0000-4000-8000-000000000000'))
      .toBe('wayflex-solucoes-c1a5b3d8');
  });

  it('uses a safe fallback for names without URL characters', () => {
    expect(organizationSlug('***', '12345678-0000-4000-8000-000000000000'))
      .toBe('organizacao-12345678');
  });
});
