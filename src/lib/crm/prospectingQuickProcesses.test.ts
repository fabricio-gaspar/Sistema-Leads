import { describe, expect, it } from 'vitest';
import {
  PROSPECTING_QUICK_PROCESSES,
  getProspectingQuickProcess,
} from './prospectingQuickProcesses';

describe('processos rápidos de prospecção', () => {
  it('oferece um processo inicial para cada família de materiais e aplicações Wayflex', () => {
    expect(PROSPECTING_QUICK_PROCESSES.map((process) => process.id)).toEqual(expect.arrayContaining([
      'rubber-products',
      'silicone-components',
      'polyurethane-components',
      'industrial-sealing',
      'industrial-maintenance',
      'automotive-applications',
      'food-and-beverage-applications',
      'mining-applications',
    ]));
  });

  it('applies a single provider term and permissive contact qualification by default', () => {
    const process = getProspectingQuickProcess('rubber-products');

    expect(process).toMatchObject({
      terms: ['artefatos de borracha'],
      volume: 10,
      requireSite: true,
      requireWhatsApp: false,
      requireEmail: false,
    });
  });

  it('keeps quick-process identifiers unique and rejects unknown processes', () => {
    expect(new Set(PROSPECTING_QUICK_PROCESSES.map((process) => process.id)).size)
      .toBe(PROSPECTING_QUICK_PROCESSES.length);
    expect(getProspectingQuickProcess('not-a-process')).toBeNull();
  });
});
