import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('../migrations/20261012130000_wa_akg_contact_name_resolution.sql', import.meta.url);

describe('WA-AKG contact name resolution migration', () => {
  it('matches directory and lead identities through the canonical phone normalizer', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('public.normalize_phone_identity(d.phone)');
    expect(sql).toContain('public.normalize_phone_identity(coalesce(l.whatsapp_identity, l.phone_identity, l.whatsapp, l.phone))');
    expect(sql).toContain('apply_whatsapp_directory_names');
  });

  it('backfills placeholder contacts and protects the inbound path from regressing', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain("coalesce(l.contact, '') in ('', 'Contato não identificado')");
    expect(sql).toContain('whatsapp_contact_directory_name_resolution');
    expect(sql).toContain('create trigger leads_wa_akg_contact_name_resolution');
  });
});
