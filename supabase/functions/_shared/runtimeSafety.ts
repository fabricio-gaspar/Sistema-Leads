export interface CompanySafety {
  active?: boolean | null;
  sandbox_mode?: boolean | null;
  can_use_ia?: boolean | null;
  ai_actions_enabled?: boolean | null;
}
export interface IntegrationSafety { connected?: boolean | null; enabled?: boolean | null; paused?: boolean | null }
export interface LeadSafety { owner_id?: string | null; modo_atendimento?: string | null; ai_paused?: boolean | null; opt_out?: boolean | null }

export function automationBlockReason(input: {
  company: CompanySafety | null;
  ai: IntegrationSafety | null;
  runtime: { killSwitchGlobal?: unknown } | null;
  lead?: LeadSafety | null;
  dryRun?: boolean;
}): string | null {
  if (!input.company || input.company.active !== true) return 'company_inactive';
  if (input.company.sandbox_mode !== false && !input.dryRun) return 'sandbox_mode';
  if (input.company.can_use_ia !== true || input.company.ai_actions_enabled !== true) return 'company_ai_disabled';
  if (!input.runtime || input.runtime.killSwitchGlobal !== false) return 'kill_switch_or_config_missing';
  if (!input.ai || input.ai.enabled !== true || input.ai.connected !== true || input.ai.paused !== false) return 'ai_integration_not_ready';
  if (input.lead !== undefined) {
    if (!input.lead?.owner_id) return 'lead_owner_required';
    if (input.lead.modo_atendimento !== 'ia') return 'human_mode';
    if (input.lead.ai_paused !== false) return 'lead_paused';
    if (input.lead.opt_out !== false) return 'lead_opt_out';
  }
  return null;
}

export function anaEventKey(event: string, leadId: string, messageId: string, requestId: string): string {
  if (event === 'message.received') {
    if (!messageId) throw new Error('inbound_message_id_required');
    return `${event}:${leadId}:message:${messageId}`;
  }
  if (event === 'timeout.48h') throw new Error('timeout_owned_by_server_scheduler');
  return `${event}:${leadId}:request:${requestId}`;
}

export function anaResponseSucceeded(status: number, body: unknown): boolean {
  return status >= 200 && status < 300 && typeof body === 'object' && body !== null
    && 'ok' in body && (body as { ok?: unknown }).ok === true;
}

export function zapiBaseUrl(value: unknown): string {
  const url = new URL(typeof value === 'string' && value ? value : 'https://api.z-api.io');
  if (url.origin !== 'https://api.z-api.io' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('provider_url_not_allowed');
  }
  return url.origin;
}
