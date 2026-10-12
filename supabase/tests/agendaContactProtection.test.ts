import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('../migrations/20261012120000_wa_akg_agenda_contact_protection.sql', import.meta.url);
const linkMigrationPath = new URL('../migrations/20261012123000_wa_akg_directory_lead_link.sql', import.meta.url);

describe('WA-AKG agenda contact protection migration', () => {
  it('defines durable classification and evidence states with a safe default', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('classification_state');
    expect(sql).toContain("default 'unclassified'");
    expect(sql).toContain('evidence_state');
    expect(sql).toContain("default 'unverified'");
    expect(sql).toContain("'agenda_protected'");
    expect(sql).toContain("'lead_authorized'");
  });

  it('exposes an explicit decision and protects automatic dispatch', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('public.decide_wa_akg_contact');
    expect(sql).toContain('private.resolve_wa_akg_contact_policy');
    expect(sql).toContain('contact_protection_required');
    expect(sql).toContain('Manter como contato');
    expect(sql).toContain('Tornar lead');
    expect(sql).toContain('outreach_jobs_wa_akg_contact_protection');
  });

  it('keeps synchronized rows linked to an existing lead', () => {
    const sql = readFileSync(linkMigrationPath, 'utf8');

    expect(sql).toContain('private.link_wa_akg_directory_lead');
    expect(sql).toContain('whatsapp_contact_directory_lead_link');
    expect(sql).toContain('update public.whatsapp_contact_directory');
  });
});
