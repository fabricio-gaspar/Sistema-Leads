import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve('supabase/migrations/20261018203000_secure_bulk_lead_file_import.sql'), 'utf8');

describe('contrato do importador de arquivo no banco', () => {
  it('separa o RPC de arquivo e exige criação e leitura global no servidor', () => {
    expect(migration).toContain('function public.import_prospecting_bulk_batch');
    expect(migration).toContain("has_org_permission(v_org, v_actor, 'leads.create')");
    expect(migration).toContain("has_org_permission(v_org, v_actor, 'leads.read_all')");
    expect(migration).toContain('grant execute on function public.import_prospecting_bulk_batch');
    expect(migration).toContain('p_import_group_id uuid');
  });

  it('reserva telefone, WhatsApp e e-mail juntos e rejeita identidade ambígua', () => {
    expect(migration).toContain('lead_import_private.reserve_prospecting_import_identities');
    expect(migration).toContain("'tel:' || v_phone_identity");
    expect(migration).toContain("'email:' || v_email_identity");
    expect(migration).toContain('prospecting_import_identity_ambiguous');
  });

  it('protege identidades de leads legados sem expor o valor bruto', () => {
    expect(migration).toContain('with candidate_keys as');
    expect(migration).toContain('public.normalize_phone_identity(lead.phone)');
    expect(migration).toContain("lower(btrim(lead.email))");
    expect(migration).toContain("md5(organization_id::text || ':' || identity_key)");
  });

  it('impõe revisão humana no servidor mesmo quando o cliente envia estado operacional diferente', () => {
    expect(migration).toContain("v_lead.ai_paused := true");
    expect(migration).toContain("v_lead.automation_status := 'pending_approval'");
    expect(migration).toContain("v_lead.contact_approval_status := 'pending'");
    expect(migration).toContain('v_lead.contact_approved_at := null');
    expect(migration).toContain('v_lead.active_channel := null');
    expect(migration).toContain('v_lead.whatsapp := null');
  });

  it('deduplica o mesmo lead entre todos os lotes do arquivo', () => {
    expect(migration).toContain('lead_import_private.prospecting_bulk_import_members');
    expect(migration).toContain('lead_import_private.reserve_prospecting_bulk_import_member');
    expect(migration).toContain('security definer');
    expect(migration).toContain('primary key (organization_id, created_by, import_group_id, lead_id)');
    expect(migration).toContain("'duplicateCount', v_duplicate_count");
    expect(migration).toContain('v_accepted_count + v_duplicate_count <> v_count');
  });

  it('mantém tabelas privadas sem acesso direto e valida o tenant antes da reserva', () => {
    expect(migration).toContain('create schema if not exists lead_import_private');
    expect(migration).toContain('revoke all on table lead_import_private.prospecting_bulk_import_members from public, anon, authenticated');
    expect(migration).toContain('lead.organization_id <> p_organization_id');
    expect(migration).toContain('private.can_access_lead(p_organization_id, lead.id, v_actor)');
  });

  it('deriva a identidade de empresa no servidor quando não há contato forte', () => {
    expect(migration).toContain("translate(lower(v_lead.company)");
    expect(migration).toContain("v_identity_keys := array['company:' || v_company_identity]");
  });
});
