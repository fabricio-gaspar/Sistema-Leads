import { describe, expect, it } from 'vitest';
import { assertLeadUpdatePersisted } from './leadsRepository';

describe('assertLeadUpdatePersisted', () => {
  it('rejects an update that did not return the expected lead', () => {
    expect(() => assertLeadUpdatePersisted(null, 'lead-1')).toThrow('lead_update_not_persisted');
    expect(() => assertLeadUpdatePersisted({ id: 'another-lead' }, 'lead-1')).toThrow('lead_update_not_persisted');
  });

  it('accepts the persisted lead returned by Supabase', () => {
    expect(() => assertLeadUpdatePersisted({ id: 'lead-1' }, 'lead-1')).not.toThrow();
  });
});
