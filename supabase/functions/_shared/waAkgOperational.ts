export type WaAkgOperationalRow = Record<string, unknown>;

export interface WaAkgOperationalSnapshot {
  present: boolean;
  key: string;
  label: string;
  provider: 'WA-AKG';
  category: 'communication';
  connected: boolean;
  enabled: boolean;
  paused: boolean;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  statusDetail: string;
  accountId: string | null;
  phoneSuffix: string | null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function bool(value: unknown): boolean {
  return value === true;
}

function accountScore(account: WaAkgOperationalRow, integration: WaAkgOperationalRow | null, controls: WaAkgOperationalRow | null): number {
  const policyReady = controls
    ? bool(controls.inbound_enabled) && bool(controls.send_enabled) && bool(controls.automation_enabled) && !bool(controls.kill_switch)
    : false;
  return Number(account.connection_status === 'connected') * 16
    + Number(bool(account.enabled)) * 8
    + Number(bool(integration?.connected)) * 4
    + Number(bool(integration?.enabled)) * 2
    + Number(!bool(integration?.paused))
    + Number(policyReady);
}

/**
 * Resolves the operational WhatsApp truth from WA-AKG account, integration and
 * administrative controls. Legacy providers must not override a configured
 * WA-AKG account.
 */
export function resolveWaAkgOperational(
  accounts: WaAkgOperationalRow[],
  integrations: WaAkgOperationalRow[],
  controls: WaAkgOperationalRow[],
): WaAkgOperationalSnapshot {
  const candidates = accounts
    .filter((account) => account.provider === 'wa_akg' && !account.archived_at)
    .map((account) => {
      const accountId = text(account.id);
      const integration = integrations.find((item) => item.id === account.integration_id)
        ?? integrations.find((item) => item.key === `whatsapp_wa_akg:${accountId}`)
        ?? null;
      const control = controls.find((item) => item.provider === 'wa_akg') ?? null;
      return { account, integration, control, score: accountScore(account, integration, control) };
    })
    .sort((left, right) => right.score - left.score || String(right.account.updated_at ?? '').localeCompare(String(left.account.updated_at ?? '')));

  const selected = candidates[0];
  if (!selected) {
    return {
      present: false,
      key: 'whatsapp_wa_akg',
      label: 'WhatsApp WA-AKG',
      provider: 'WA-AKG',
      category: 'communication',
      connected: false,
      enabled: false,
      paused: false,
      lastTestedAt: null,
      lastSuccessAt: null,
      lastError: null,
      statusDetail: 'Nenhuma conta WA-AKG conectada para esta organização.',
      accountId: null,
      phoneSuffix: null,
    };
  }

  const { account, integration, control } = selected;
  const connected = account.connection_status === 'connected'
    && bool(account.enabled)
    && bool(integration?.connected)
    && bool(integration?.enabled)
    && !bool(integration?.paused);
  const policyReady = Boolean(control)
    && bool(control?.inbound_enabled)
    && bool(control?.send_enabled)
    && bool(control?.automation_enabled)
    && !bool(control?.kill_switch);
  const enabled = connected && policyReady && !text(integration?.last_error);
  const lastError = text(integration?.last_error) || null;
  const phone = text(account.connected_phone_suffix).replace(/\D/g, '');
  const statusDetail = enabled
    ? `WA-AKG conectado e liberado para entrada, saída e automações da Ana.${text(control?.reason) ? ` ${text(control?.reason)}` : ''}`
    : connected && !policyReady
      ? 'WA-AKG conectado, mas a política administrativa ainda não liberou todas as operações.'
      : lastError || text(account.last_error_code)
        ? `WA-AKG conectado com pendência: ${lastError || text(account.last_error_code)}`
        : 'WA-AKG configurado, mas a sessão ou a integração ainda não foi confirmada.';

  return {
    present: true,
    key: `whatsapp_wa_akg:${text(account.id)}`,
    label: text(account.label) || 'WhatsApp WA-AKG',
    provider: 'WA-AKG',
    category: 'communication',
    connected,
    enabled,
    paused: bool(integration?.paused) || bool(control?.kill_switch),
    lastTestedAt: text(account.status_checked_at) || text(integration?.last_tested_at) || text(account.updated_at) || null,
    lastSuccessAt: text(integration?.last_success_at) || null,
    lastError,
    statusDetail,
    accountId: text(account.id) || null,
    phoneSuffix: phone || null,
  };
}
