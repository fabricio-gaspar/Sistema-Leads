import {
  createAdminClient,
  hasOrganizationPermission,
  requireOrganizationPermission,
  requireUser,
} from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;

const WHATSAPP_AUDIT_ACTIONS = [
  'whatsapp_account.configured', 'whatsapp_account.connected', 'whatsapp_account.connection_pending',
  'whatsapp_account.enabled', 'whatsapp_account.disabled', 'whatsapp_provider.enabled',
  'whatsapp_provider.disabled', 'whatsapp.meta_connected', 'outreach.whatsapp_direct_test_reserved',
  'outreach.whatsapp_direct_test_provider_accepted', 'outreach.meta_provider_accepted',
  'webhook.processed', 'webhook.failed',
  'webhook.ambiguous', 'webhook.unmatched',
] as const;

// WA-AKG is the sole configurable transport. Meta records remain readable for
// operational continuity and audit, while legacy Z-API/Evolution records stay
// out of this surface and no action here can configure or contact any legacy
// provider.
const ACTIVE_WHATSAPP_PROVIDER = 'wa_akg';
const AUDITABLE_WHATSAPP_PROVIDERS = [ACTIVE_WHATSAPP_PROVIDER, 'meta_cloud'] as const;
const LEGACY_PROVIDER_ACTIONS = new Set([
  'configure', 'connector_token', 'refresh_status', 'set_provider_enabled', 'set_enabled',
]);

function asObject(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function asText(value: unknown, maximum = 1_000): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function phoneSuffix(value: unknown): string | null {
  const digits = asText(value, 120).replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

function auditResult(action: string): 'success' | 'pending' | 'attention' {
  if (action.endsWith('.failed') || action.endsWith('.ambiguous') || action.endsWith('.unmatched')) return 'attention';
  if (action.endsWith('.reserved') || action.endsWith('.connection_pending')) return 'pending';
  return 'success';
}

function presentationForAccount(input: {
  account: Row;
  integration: Row;
  providerControl: Row;
  directTestAcceptedAt: string | null;
  lastInboundAt: string | null;
}) {
  const provider = asText(input.account.provider, 40);
  const connectionStatus = asText(input.account.connection_status, 40);
  const isMeta = provider === 'meta_cloud';
  const configured = isMeta
    ? asText(input.account.onboarding_status, 40) === 'connected'
    : asObject(input.integration.configuration).configured === true;
  const authorization = isMeta
    ? asText(input.account.onboarding_status, 40) === 'connected' && input.integration.connected === true
    : configured && connectionStatus !== 'expired' && connectionStatus !== 'error';
  const accountSynchronized = isMeta
    ? asText(input.account.sync_status, 40) === 'complete'
    : input.integration.connected === true && connectionStatus === 'connected';
  const numberIdentified = isMeta
    ? Boolean(asText(input.account.display_phone_number, 80) || asText(input.account.phone_number_id, 80))
    : Boolean(phoneSuffix(input.account.connected_phone_suffix));
  const eventsReady = Boolean(input.account.webhook_registered_at);
  const providerActive = input.providerControl.inbound_enabled === true
    && input.providerControl.send_enabled === true
    && input.providerControl.automation_enabled === true
    && input.providerControl.kill_switch !== true;
  const routing = {
    active: true,
    destination: 'Central de Atendimento',
    detail: 'As conversas recebidas por este canal entram no histórico do lead e na Central de Atendimento.',
  };
  const deliveryTested = Boolean(input.directTestAcceptedAt);
  const receiptTested = Boolean(input.lastInboundAt);
  const checks = [
    {
      key: 'authorization', label: isMeta ? 'Autorização da Meta' : 'Autorização do provedor',
      state: authorization ? 'ready' : connectionStatus === 'expired' || asText(input.account.onboarding_status, 40) === 'revoked' ? 'attention' : 'pending',
      detail: authorization ? 'Credencial confirmada pelo backend.' : 'A autorização válida ainda não foi confirmada.',
      checkedAt: asText(input.account.status_checked_at, 80) || null,
      action: authorization ? 'none' : 'connect',
    },
    {
      key: 'account', label: 'Conta comercial e conexão', state: accountSynchronized ? 'ready' : 'pending',
      detail: accountSynchronized ? 'A sessão e a conta do canal foram confirmadas.' : 'A conta ainda não concluiu a sincronização necessária.',
      checkedAt: asText(input.account.status_checked_at, 80) || null, action: accountSynchronized ? 'none' : 'validate',
    },
    {
      key: 'number', label: 'Número corporativo', state: numberIdentified ? 'ready' : 'attention',
      detail: numberIdentified ? 'O identificador do número foi confirmado sem expor credenciais.' : 'O provedor ainda não retornou um identificador de número utilizável.',
      checkedAt: asText(input.account.status_checked_at, 80) || null, action: numberIdentified ? 'none' : 'connect',
    },
    {
      key: 'events', label: 'Assinatura de eventos', state: eventsReady ? 'ready' : 'attention',
      detail: eventsReady ? 'Os callbacks exigidos foram registrados; o recebimento continua verificado separadamente.' : 'Os callbacks necessários ainda não foram confirmados.',
      checkedAt: asText(input.account.webhook_registered_at, 80) || null, action: eventsReady ? 'none' : 'validate',
    },
    {
      key: 'routing', label: 'Destino das conversas', state: routing.active ? 'ready' : 'attention',
      detail: routing.detail, checkedAt: asText(input.account.updated_at, 80) || null, action: routing.active ? 'none' : 'diagnostic',
    },
    {
      key: 'send_receive', label: 'Envio e recebimento',
      state: deliveryTested && receiptTested ? 'ready' : deliveryTested || receiptTested ? 'pending' : 'attention',
      detail: deliveryTested && receiptTested
        ? 'Há evidência separada de aceite do teste e de evento recebido.'
        : deliveryTested
          ? 'O provedor aceitou um teste; entrega, leitura e evento de entrada não são presumidos.'
          : 'Ainda não há teste controlado aceito pelo provedor para este canal.',
      checkedAt: input.directTestAcceptedAt || input.lastInboundAt,
      action: deliveryTested && receiptTested ? 'none' : 'test',
    },
  ] as const;
  const hasAttention = checks.some((check) => check.state === 'attention');
  const allReady = checks.every((check) => check.state === 'ready') && providerActive;
  const revoked = asText(input.account.onboarding_status, 40) === 'revoked';
  const state = revoked
    ? 'authorization_revoked'
    : connectionStatus === 'error' || connectionStatus === 'expired' || input.integration.connected === false && configured
      ? 'requires_attention'
      : connectionStatus === 'qr'
        ? 'reconnecting'
        : !configured || connectionStatus === 'configured' || asText(input.account.onboarding_status, 40) === 'pending'
          ? 'connecting'
          : allReady
            ? 'operational'
            : hasAttention || !providerActive
              ? 'configuration_incomplete'
              : 'validating';
  const statusCopy: Record<string, { label: string; detail: string }> = {
    disconnected: { label: 'Desconectado', detail: 'O canal não possui uma sessão confirmada.' },
    connecting: { label: 'Conectando', detail: 'A conexão está em andamento e ainda não libera atendimento.' },
    configuration_incomplete: { label: 'Configuração incompleta', detail: 'Ainda existem requisitos operacionais pendentes.' },
    validating: { label: 'Validando', detail: 'O canal aguarda a confirmação dos requisitos restantes.' },
    operational: { label: 'Operacional', detail: 'Os requisitos técnicos foram confirmados pelo backend.' },
    requires_attention: { label: 'Requer atenção', detail: 'O provedor ou a autorização exige uma correção.' },
    reconnecting: { label: 'Reconectando', detail: 'A sessão está aguardando a conclusão da reconexão.' },
    authorization_revoked: { label: 'Autorização revogada', detail: 'A autorização anterior não pode mais ser usada.' },
  };
  return { state, ...statusCopy[state], routing, checks, lastInboundAt: input.lastInboundAt, directTestAcceptedAt: input.directTestAcceptedAt };
}

async function organizationContext(admin: Admin, userId: string) {
  const { data: profile, error } = await admin.from('profiles')
    .select('active_organization_id').eq('id', userId).maybeSingle();
  if (error || !profile?.active_organization_id) throw new Error('organization_context_required');
  const organizationId = profile.active_organization_id as string;
  const { data: membership, error: membershipError } = await admin.from('organization_members')
    .select('status').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
  if (membershipError || !membership || membership.status !== 'active') throw new Error('organization_access_denied');
  return { organizationId };
}

async function canManageAccounts(admin: Admin, organizationId: string, userId: string): Promise<boolean> {
  return await hasOrganizationPermission(admin, organizationId, userId, 'channels.manage_all')
    || await hasOrganizationPermission(admin, organizationId, userId, 'configuration.manage');
}

async function listAccounts(admin: Admin, organizationId: string, userId: string, manage: boolean) {
  let query = admin.from('whatsapp_accounts')
    .select('id,integration_id,owner_user_id,label,provider,account_type,is_default,enabled,connection_status,connected_phone_suffix,connected_at,status_checked_at,webhook_registered_at,expires_at,last_error_code,onboarding_status,sync_status,messaging_mode,daily_message_goal,verified_name,quality_rating,display_phone_number,phone_number_id,created_at,updated_at')
    .eq('organization_id', organizationId).in('provider', AUDITABLE_WHATSAPP_PROVIDERS).is('archived_at', null).order('is_default', { ascending: false }).order('label');
  if (!manage) query = query.eq('owner_user_id', userId);
  const { data: accounts, error } = await query;
  if (error) throw new Error('whatsapp_accounts_read_failed');
  const integrationIds = (accounts ?? []).map((account) => account.integration_id).filter(Boolean);
  const ownerIds = [...new Set((accounts ?? []).map((account) => account.owner_user_id).filter(Boolean))];
  const [integrationsRead, profilesRead, controlsRead, auditRead, inboundRead] = await Promise.all([
    integrationIds.length
      ? admin.from('integrations').select('id,connected,enabled,paused,configuration,last_tested_at,last_success_at').in('id', integrationIds)
      : Promise.resolve({ data: [], error: null }),
    ownerIds.length
      ? admin.from('profiles').select('id,name,email').in('id', ownerIds)
      : Promise.resolve({ data: [], error: null }),
    admin.from('messaging_provider_controls').select('provider,inbound_enabled,send_enabled,automation_enabled,kill_switch,reason,updated_at')
      .eq('organization_id', organizationId).in('provider', AUDITABLE_WHATSAPP_PROVIDERS),
    admin.from('audit_logs').select('id,action,detail,actor_name,occurred_at,created_at,entity_table,entity_id,event_data')
      .eq('organization_id', organizationId).in('action', WHATSAPP_AUDIT_ACTIONS).order('created_at', { ascending: false }).limit(100),
    integrationIds.length
      ? admin.from('channel_inbound_events').select('whatsapp_account_id,status,created_at')
        .eq('organization_id', organizationId).in('whatsapp_account_id', (accounts ?? []).map((account) => account.id)).order('created_at', { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (integrationsRead.error || profilesRead.error || controlsRead.error || auditRead.error || inboundRead.error) throw new Error('whatsapp_accounts_context_read_failed');
  const integrationById = new Map((integrationsRead.data ?? []).map((item) => [item.id, item]));
  const profileById = new Map((profilesRead.data ?? []).map((item) => [item.id, item]));
  const presentedAccounts = (accounts ?? []).map((account) => {
    const integration = integrationById.get(account.integration_id);
    const owner = account.owner_user_id ? profileById.get(account.owner_user_id) : null;
    return {
      id: account.id, ownerUserId: account.owner_user_id, ownerName: owner?.name ?? null, ownerEmail: owner?.email ?? null,
      label: account.label, provider: account.provider, accountType: account.account_type, isDefault: account.is_default,
      enabled: account.enabled, connectionStatus: account.connection_status, connectedPhoneSuffix: account.connected_phone_suffix,
      connectedAt: account.connected_at, statusCheckedAt: account.status_checked_at, webhookRegisteredAt: account.webhook_registered_at,
      expiresAt: account.expires_at, lastErrorCode: account.last_error_code,
      configured: account.provider === 'meta_cloud' ? account.onboarding_status === 'connected' : asObject(integration?.configuration).configured === true,
      connected: account.provider === 'meta_cloud' ? account.connection_status === 'connected' : integration?.connected === true,
      paused: integration?.paused === true, onboardingStatus: account.onboarding_status, syncStatus: account.sync_status,
      messagingMode: account.messaging_mode, dailyMessageGoal: account.daily_message_goal, verifiedName: account.verified_name,
      qualityRating: account.quality_rating, displayPhoneNumber: account.display_phone_number, phoneNumberId: account.phone_number_id,
      updatedAt: account.updated_at,
    };
  });
  const savedControls = new Map((controlsRead.data ?? []).map((control) => [control.provider, control]));
  const providerControls = AUDITABLE_WHATSAPP_PROVIDERS.map((provider) => {
    const control = savedControls.get(provider);
    const fallbackActive = presentedAccounts.some((account) => account.provider === provider && account.enabled && account.connected);
    const inboundEnabled = control?.inbound_enabled === true || (!control && fallbackActive);
    const sendEnabled = control?.send_enabled === true || (!control && fallbackActive);
    const automationEnabled = control?.automation_enabled === true || (!control && fallbackActive);
    const killSwitch = control?.kill_switch === true || (!control && !fallbackActive);
    return {
      provider, inboundEnabled, sendEnabled, automationEnabled, killSwitch,
      active: inboundEnabled && sendEnabled && automationEnabled && !killSwitch,
      reason: typeof control?.reason === 'string' ? control.reason : null,
      updatedAt: typeof control?.updated_at === 'string' ? control.updated_at : null,
    };
  });
  const accountIds = new Set((accounts ?? []).map((account) => String(account.id)));
  const integrationIdsSet = new Set(integrationIds.map(String));
  const relevantAudit = (auditRead.data ?? []).filter((event) => {
    const eventData = asObject(event.event_data);
    return accountIds.has(String(event.entity_id ?? ''))
      || integrationIdsSet.has(String(event.entity_id ?? ''))
      || accountIds.has(asText(eventData.whatsapp_account_id, 80));
  });
  const channelHistory = relevantAudit.slice(0, 50).map((event) => ({
    id: String(event.id), action: asText(event.action, 120), detail: asText(event.detail, 320) || 'Evento de canal registrado.',
    actorName: asText(event.actor_name, 160) || null,
    occurredAt: asText(event.occurred_at, 80) || asText(event.created_at, 80) || null,
    result: auditResult(asText(event.action, 120)),
  }));
  const channelOverviews = Object.fromEntries((accounts ?? []).map((account) => {
    const integration = asObject(integrationById.get(account.integration_id));
    const provider = asText(account.provider, 40);
    const control = asObject(savedControls.get(provider));
    const accepted = relevantAudit.find((event) => {
      const eventData = asObject(event.event_data);
      return (event.action === 'outreach.whatsapp_direct_test_provider_accepted'
        && String(event.entity_id ?? '') === String(account.integration_id))
        || (event.action === 'outreach.meta_provider_accepted'
          && asText(eventData.whatsapp_account_id, 80) === String(account.id));
    });
    const inbound = (inboundRead.data ?? []).find((event) => event.whatsapp_account_id === account.id);
    return [String(account.id), presentationForAccount({
      account: asObject(account), integration, providerControl: control,
      directTestAcceptedAt: accepted ? asText(accepted.occurred_at, 80) || asText(accepted.created_at, 80) || null : null,
      lastInboundAt: inbound ? asText(inbound.created_at, 80) || null : null,
    })];
  }));
  return { accounts: presentedAccounts, providerControls, channelOverviews, channelHistory };
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const body = await request.json().catch(() => ({})) as Row;
    const action = asText(body.action, 60);
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { organizationId } = await organizationContext(admin, user.id);
    const manage = await canManageAccounts(admin, organizationId, user.id);
    if (LEGACY_PROVIDER_ACTIONS.has(action)) throw new Error('legacy_whatsapp_provider_retired');
    if (action === 'list') {
      if (!manage) await requireOrganizationPermission(admin, organizationId, user.id, 'channels.view_own');
      return json({ ok: true, ...(await listAccounts(admin, organizationId, user.id, manage)), canManage: manage }, 200, headers);
    }
    throw new Error('unsupported_action');
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
