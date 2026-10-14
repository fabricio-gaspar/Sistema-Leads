import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const diagnostics = readFileSync(new URL('../functions/operational-diagnostics/index.ts', import.meta.url), 'utf8');
const accounts = readFileSync(new URL('../functions/whatsapp-accounts/index.ts', import.meta.url), 'utf8');
const routingFence = readFileSync(new URL('../migrations/20261014134500_wa_akg_only_outbound_routing.sql', import.meta.url), 'utf8');
const retiredEntrypoints = [
  '../functions/evolution-go/index.ts',
  '../functions/webhook-evolution-go/index.ts',
  '../functions/evolution-go-worker/index.ts',
  '../functions/evolution-go-recovery/index.ts',
  '../functions/team-member-evolution-removal/index.ts',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

describe('Z-API retirement boundary', () => {
  it('keeps operational diagnostics on WA-AKG and Meta without a Z-API registration path', () => {
    expect(diagnostics).toContain('resolveWaAkgOperational');
    expect(diagnostics).toContain("'meta_cloud'");
    expect(diagnostics).not.toContain('configureWhatsAppWebhook');
    expect(diagnostics).not.toContain('zapiBaseUrl');
    expect(diagnostics).not.toContain('update-webhook-received');
  });

  it('keeps historical actions rejected without carrying Z-API network code', () => {
    expect(accounts).toContain("ACTIVE_WHATSAPP_PROVIDER = 'wa_akg'");
    expect(accounts).toContain('LEGACY_PROVIDER_ACTIONS.has(action)');
    expect(accounts).toContain("'legacy_whatsapp_provider_retired'");
    expect(accounts).not.toContain('zapiBaseUrl');
    expect(accounts).not.toContain('sdk-connector-token');
    expect(accounts).not.toContain('async function providerStatus');
    expect(accounts).not.toContain('async function registerWebhooks');
  });

  it('keeps the separately gated Meta provider-acceptance event visible in channel history', () => {
    expect(accounts).toContain("'outreach.meta_provider_accepted'");
    expect(accounts).toContain("event.action === 'outreach.meta_provider_accepted'");
    expect(accounts).toContain('eventData.whatsapp_account_id');
  });

  it('replaces every previously published Evolution endpoint with a no-side-effect retirement response', () => {
    for (const source of retiredEntrypoints) {
      expect(source).toContain("error: 'legacy_provider_retired'");
      expect(source).toContain('status: 410');
      expect(source).not.toMatch(/fetch\(|createAdminClient|read_integration_secret|Deno\.env/i);
    }
  });

  it('keeps retired-provider history disabled while making every future route WA-AKG-only', () => {
    expect(routingFence).toMatch(/where provider in \('zapi', 'evolution_go'\)/i);
    expect(routingFence).toContain("account.provider = 'wa_akg'");
    expect(routingFence).toContain("candidate.provider = 'wa_akg'");
    expect(routingFence).toContain("v_provider in ('zapi', 'evolution_go')");
    expect(routingFence).toContain("'legacy_whatsapp_provider_not_routable'");
    expect(routingFence).toContain('leads_wa_akg_route_guard');
  });

  it('does not replace a historical binding unless a healthy WA-AKG route is present', () => {
    expect(routingFence).toContain("account.connection_status = 'connected'");
    expect(routingFence).toContain('and integration.enabled');
    expect(routingFence).toContain('and integration.connected');
    expect(routingFence).toContain('and not integration.paused');
    expect(routingFence).toContain('and control.send_enabled');
    expect(routingFence).toContain('and not control.kill_switch');
    expect(routingFence).toContain('and not control.capture_only');
    expect(routingFence).toContain('v_legacy_bound := true');
    expect(routingFence).toContain("case when v_legacy_bound then 'wa_akg_migration_reroute'");
    const replacementFound = routingFence.indexOf("if not found then raise exception 'whatsapp_account_not_configured'; end if;");
    const legacyUnbound = routingFence.indexOf('update public.lead_whatsapp_account_bindings as binding');
    expect(replacementFound).toBeGreaterThan(-1);
    expect(legacyUnbound).toBeGreaterThan(replacementFound);
  });

  it('selects a healthy WA-AKG seller directly for human handoff instead of failing on a newer legacy or Meta account', () => {
    const handoffStart = routingFence.indexOf('create or replace function public.assign_human_handoff(');
    expect(handoffStart).toBeGreaterThan(-1);
    const handoff = routingFence.slice(handoffStart);
    expect(handoff).toContain("account.provider = 'wa_akg'");
    expect(handoff).toContain('and integration.enabled');
    expect(handoff).toContain('and integration.connected');
    expect(handoff).toContain('and not integration.paused');
    expect(handoff).toContain('and control.send_enabled');
    expect(handoff).toContain('and not control.kill_switch');
    expect(handoff).toContain('and not control.capture_only');
  });

  it('uses a database-locked automatic resolver so a paused Ana cannot rebind a legacy route', () => {
    expect(routingFence).toContain('create or replace function public.resolve_lead_automatic_whatsapp_account(');
    expect(routingFence).toContain('for update;');
    expect(routingFence).toContain('v_control.automation_enabled is not true');
    expect(routingFence).toContain('wa_akg_automation_not_ready');
    expect(routingFence).toContain('from public.resolve_lead_whatsapp_account(');
  });

  it('blocks only retired providers at the lead-binding trigger so the separately gated Meta inbound path remains intact', () => {
    expect(routingFence).toContain("if v_provider in ('zapi', 'evolution_go') then");
    expect(routingFence).not.toContain("if v_provider is distinct from 'wa_akg' then");
  });
});
