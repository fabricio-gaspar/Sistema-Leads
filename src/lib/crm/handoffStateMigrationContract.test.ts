import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../../supabase/migrations/20261011233000_fix_operator_takeover_state.sql', import.meta.url), 'utf8');

describe('operator takeover state migration', () => {
  it('accepts self-takeover before the central projections are refreshed', () => {
    expect(migration).toContain("if new.category = 'operator_takeover' and new.status = 'pending'");
    expect(migration).toContain("new.status := 'accepted'");
  });

  it('repairs only human-mode takeover rows, leaving transfers untouched', () => {
    expect(migration).toContain("handoff.category = 'operator_takeover'");
    expect(migration).toContain("pg_catalog.lower(coalesce(lead.modo_atendimento, 'ia')) = 'humano'");
    expect(migration).not.toContain("handoff.category = 'operator_transfer' and handoff.status = 'pending'");
  });
});
