import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(resolve('supabase/migrations/20260917175303_fix_pending_manual_lead_phone_identity.sql'), 'utf8');

describe('manual lead phone normalization migration', () => {
  it('does not derive WhatsApp from a generic phone number', () => {
    expect(migration).toContain("when nullif(btrim(new.whatsapp), '') is null then null");
    expect(migration).not.toContain('coalesce(new.whatsapp, new.phone)');
  });

  it('limits the cleanup to the affected manual pending records', () => {
    expect(migration).toContain("contact_approval_status = 'pending'");
    expect(migration).toContain("contact_approval_reason = 'Lead manual criado; aguardando comprovação de canal e autorização para primeiro contato.'");
  });
});
