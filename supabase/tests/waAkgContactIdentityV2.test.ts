import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('../migrations/20261014140000_wa_akg_contact_identity_resolution_v2.sql', import.meta.url);

function migration(): string {
  return readFileSync(migrationPath, 'utf8');
}

describe('WA-AKG contact identity v2 migration contract', () => {
  it('keeps contact classification private and available only through constrained RPCs', () => {
    const sql = migration();

    expect(sql).toContain('private.wa_akg_contact_policy');
    expect(sql).toMatch(/alter table private\.wa_akg_contact_policy enable row level security/i);
    expect(sql).toMatch(/revoke all on table private\.wa_akg_contact_policy from public, anon, authenticated/i);
    expect(sql).toMatch(/grant (select|insert|update|delete|all) on table private\.wa_akg_contact_policy to service_role/i);
    expect(sql).toContain('central_get_pending_wa_akg_contact_decision');
    expect(sql).toContain('central_dismiss_wa_akg_contact_decision_prompt');
    expect(sql).toContain('decide_wa_akg_contact_v2');
  });

  it('requires a durable decision revision, request id, owner, and explicit initial mode for promotion', () => {
    const sql = migration();

    expect(sql).toMatch(/p_owner_user_id\s+uuid/i);
    expect(sql).toMatch(/p_initial_mode\s+text/i);
    expect(sql).toMatch(/p_expected_revision\s+bigint/i);
    expect(sql).toMatch(/p_request_id\s+uuid/i);
    expect(sql).toContain('decision_revision');
    expect(sql).toMatch(/v_decision\s*=\s*'promote'/i);
  });

  it('has backend fences for protected contacts before inbound automation can run', () => {
    const sql = migration();

    expect(sql).toContain('agenda_protected');
    expect(sql).toContain('unclassified');
    expect(sql).toContain('lead_authorized');
    expect(sql).toContain('wa_akg_contact_only');
    expect(sql).toContain('resolve_or_create_whatsapp_inbound_lead');
    expect(sql).toContain('begin_whatsapp_inbound_dispatch');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain("('public.messaging_provider_controls', 'capture_only')");
    expect(sql).toContain("'public.messaging_provider_controls'");
  });

  it('keeps the agenda fence durable without demoting an already-approved commercial lead', () => {
    const sql = migration();

    expect(sql).toContain('contact_only boolean not null default false');
    expect(sql).toContain('inbound_lead_created boolean not null default false');
    expect(sql).toContain('wa_akg_preserve_existing_commercial_policy_v2');
    expect(sql).toContain("lead.contact_approval_status = 'approved'");
    expect(sql).toContain("classification_state = 'lead_authorized'");
    expect(sql).toContain('not v_policy.inbound_lead_created');
  });

  it('keeps unknown external inbound as a factual new contact and fails closed on duplicate events', () => {
    const sql = migration();

    expect(sql).toContain('An unknown external inbound is factual "Novo contato"');
    expect(sql).toContain('external_inbound_lead_created');
    expect(sql).toContain('inbound_lead_created = inbound_lead_created or not v_protection_required');
    expect(sql).toContain('message_lead_conflict');
    expect(sql).toContain('conversation_lead_conflict');
  });

  it('does not leave a legacy decision or private Kanban helper callable by regular users', () => {
    const sql = migration();

    expect(sql).toContain('wa_akg_contact_protected_for_kanban');
    expect(sql).toMatch(/revoke all on function private\.wa_akg_contact_requires_protection\([^)]*\) from public, anon, authenticated/i);
    expect(sql).toContain("revoke all on function public.decide_wa_akg_contact(uuid,text,text,uuid) from public, anon, authenticated, service_role");
  });

  it('keeps legacy directory classification out of browser write authority', () => {
    const sql = migration();

    expect(sql).toMatch(/alter table public\.whatsapp_contact_directory enable row level security/i);
    expect(sql).toMatch(/revoke all on table public\.whatsapp_contact_directory from public, anon, authenticated/i);
    expect(sql).toMatch(/grant select, insert, update, delete on table public\.whatsapp_contact_directory to service_role/i);
  });

  it('projects a completed v2 decision back through the read-only directory contract', () => {
    const sql = migration();
    const directoryRpc = sql.slice(sql.lastIndexOf('create or replace function public.central_list_wa_akg_contact_directory'));

    expect(directoryRpc).toContain('private.wa_akg_contact_policy policy');
    expect(directoryRpc).toContain('coalesce(policy.classification_state, directory.classification_state)');
    expect(directoryRpc).toContain('coalesce(policy.decision_revision, directory.decision_revision)');
    expect(directoryRpc).toContain("'[]'::jsonb");
  });
});
