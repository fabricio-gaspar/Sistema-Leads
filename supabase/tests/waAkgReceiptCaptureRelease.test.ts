import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('../migrations/20261014133000_wa_akg_capture_and_receipt_reconciliation.sql', import.meta.url);
const identityMigrationPath = new URL('../migrations/20261014140000_wa_akg_contact_identity_resolution_v2.sql', import.meta.url);
const fenceMigrationPath = new URL('../migrations/20261014133500_wa_akg_capture_effect_fence.sql', import.meta.url);

function migration(): string {
  return readFileSync(migrationPath, 'utf8');
}

function identityMigration(): string {
  return readFileSync(identityMigrationPath, 'utf8');
}

function fenceMigration(): string {
  return readFileSync(fenceMigrationPath, 'utf8');
}

describe('WA-AKG capture and receipt release contract', () => {
  it('adds capture-only mode without changing existing inbound, send, or Ana controls', () => {
    const sql = migration();

    expect(sql).toMatch(/add column if not exists capture_only boolean not null default false/i);
    expect(sql).not.toMatch(/alter column inbound_enabled/i);
    expect(sql).not.toMatch(/alter column send_enabled/i);
    expect(sql).not.toMatch(/alter column automation_enabled/i);
  });

  it('adds only the account-scoped WA-AKG receipt reconciler with service-role execution', () => {
    const sql = migration();

    expect(sql).toContain('public.reconcile_whatsapp_receipt_for_account');
    expect(sql).toContain("a.provider = 'wa_akg'");
    expect(sql).toContain("job.provider = 'wa_akg'");
    expect(sql).toContain("grant execute on function public.reconcile_whatsapp_receipt_for_account");
    expect(sql).toMatch(/to service_role/i);
    expect(sql).toMatch(/revoke all on function public\.reconcile_whatsapp_receipt_for_account[\s\S]*from public, anon, authenticated/i);
    expect(sql).not.toMatch(/zapi|z-api|evolution_go|evolution-go/i);
  });

  it('preserves monotonic delivery progress and refuses an account or provider mismatch', () => {
    const sql = migration();

    expect(sql).toContain("'sent', 'delivered', 'read', 'failed'");
    expect(sql).toContain('p_whatsapp_account_id');
    expect(sql).toContain('p_organization_id');
    expect(sql).toContain('a.archived_at is null');
    expect(sql).toContain('provider_message_id');
  });

  it('rejects null, duplicate, unbounded, or count-mismatched receipt IDs before any update', () => {
    const sql = migration();

    expect(sql).toContain('p_status is null');
    expect(sql).toContain('v_normalized_ids');
    expect(sql).toMatch(/p_expected_message_count\s*<>\s*v_id_count/i);
    expect(sql).toMatch(/v_id_count\s*<\s*1\s+or\s+v_id_count\s*>\s*100/i);
    expect(sql).toContain('length(btrim(raw.value)) <= 300');
  });

  it('never reconciles a linked message whose account is absent or different', () => {
    const sql = migration();

    expect(sql).toContain('message_row.whatsapp_account_id = p_whatsapp_account_id');
    expect(sql).not.toMatch(/message_row\.whatsapp_account_id\s+is\s+null/i);
  });

  it('retires the unscoped receipt RPC instead of leaving a service-role bypass', () => {
    const sql = migration();

    expect(sql).toMatch(/revoke all on function public\.reconcile_whatsapp_receipt\(uuid, text\[\], integer, text, timestamptz\)[\s\S]*from public, anon, authenticated, service_role/i);
  });

  it('enforces capture-only at claim time and rechecks it before persistence or Ana dispatch', () => {
    const sql = migration();
    const identity = identityMigration();

    expect(sql).toMatch(/create or replace function public\.claim_whatsapp_webhook_event[\s\S]*control_row\.capture_only[\s\S]*return null/i);
    expect(identity).toMatch(/persist_whatsapp_inbound[\s\S]*wa_akg_capture_only[\s\S]*needs_review/i);
    expect(identity).toMatch(/begin_whatsapp_inbound_dispatch[\s\S]*wa_akg_capture_only[\s\S]*'dispatch', false/i);
  });

  it('makes capture and all WA-AKG effects share a linearizable dispatch fence', () => {
    const sql = fenceMigration();

    expect(sql).toMatch(/state in \('reserved', 'dispatching', 'sent', 'failed', 'reconciliation_required'\)/i);
    expect(sql).toContain('public.begin_wa_akg_send_dispatch');
    expect(sql).toContain('public.complete_wa_akg_send_dispatch');
    expect(sql).toContain("p_outcome text");
    expect(sql).toContain('p_succeeded boolean');
    expect(sql).toMatch(/p_outcome not in \('sent', 'failed', 'reconciliation_required'\)/i);
    expect(sql).toContain("'wa_akg_dispatch_in_flight'");
    expect(sql).toContain("hashtextextended('wa_akg_capture:' || p_organization_id::text, 0)");
  });

  it('preserves pre-effect reservations and reports capture distinctly so they can resume safely', () => {
    const sql = fenceMigration();

    expect(sql).toMatch(/if v_controls\.capture_only then[\s\S]*'wa_akg_capture_only'/i);
    expect(sql).not.toMatch(/set state = 'failed', dispatch_token = null[\s\S]*state = 'reserved'/i);
  });

  it('fences a WA-AKG Ana job at both enqueue and claim time', () => {
    const sql = fenceMigration();

    expect(sql).toMatch(/private\.fence_wa_akg_capture_ana_job[\s\S]*pg_advisory_xact_lock[\s\S]*wa_akg_capture/i);
    expect(sql).toMatch(/public\.claim_ana_job[\s\S]*pg_advisory_xact_lock[\s\S]*wa_akg_capture[\s\S]*update public\.ana_jobs/i);
    expect(sql).toContain("new.status := 'needs_review'");
  });
});
