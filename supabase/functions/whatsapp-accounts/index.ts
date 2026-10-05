import {
  createAdminClient,
  hasOrganizationPermission,
  requireOrganizationPermission,
  requireUser,
} from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { zapiBaseUrl } from '../_shared/runtimeSafety.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WEBHOOK_ENDPOINTS = [
  'update-webhook-received',
  'update-webhook-delivery',
  'update-webhook-message-status',
] as const;
const WHATSAPP_AUDIT_ACTIONS = [
  'whatsapp_account.configured',
  'whatsapp_account.connected',
  'whatsapp_account.connection_pending',
  'whatsapp_account.enabled',
  'whatsapp_account.disabled',
  'whatsapp_provider.enabled',
  'whatsapp_provider.disabled',
  'whatsapp.meta_connected',
  'outreach.whatsapp_direct_test_reserved',
  'outreach.whatsapp_direct_test_provider_accepted',
  'webhook.processed',
  'webhook.failed',
  'webhook.ambiguous',
  'webhook.unmatched',
] as const;

function asObject(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

function asText(value: unknown, maximum = 1_000): string {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function asUuid(value: unknown): string {
  const candidate = asText(value, 80);
  return UUID.test(candidate) ? candidate : '';
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
  // Incoming WhatsApp events are stored and then displayed in the Central. This
  // is the actual destination of the existing webhook path, not a browser-only
  // routing setting.
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
      key: 'account', label: 'Conta comercial e conexão',
      state: accountSynchronized ? 'ready' : 'pending',
      detail: accountSynchronized ? 'A sessão e a conta do canal foram confirmadas.' : 'A conta ainda não concluiu a sincronização necessária.',
      checkedAt: asText(input.account.status_checked_at, 80) || null,
      action: accountSynchronized ? 'none' : 'validate',
    },
    {
      key: 'number', label: 'Número corporativo',
      state: numberIdentified ? 'ready' : 'attention',
      detail: numberIdentified ? 'O identificador do número foi confirmado sem expor credenciais.' : 'O provedor ainda não retornou um identificador de número utilizável.',
      checkedAt: asText(input.account.status_checked_at, 80) || null,
      action: numberIdentified ? 'none' : 'connect',
    },
    {
      key: 'events', label: 'Assinatura de eventos',
      state: eventsReady ? 'ready' : 'attention',
      detail: eventsReady ? 'Os callbacks exigidos foram registrados; o recebimento continua verificado separadamente.' : 'Os callbacks necessários ainda não foram confirmados.',
      checkedAt: asText(input.account.webhook_registered_at, 80) || null,
      action: eventsReady ? 'none' : 'validate',
    },
    {
      key: 'routing', label: 'Destino das conversas',
      state: routing.active ? 'ready' : 'attention',
      detail: routing.detail,
      checkedAt: asText(input.account.updated_at, 80) || null,
      action: routing.active ? 'none' : 'diagnostic',
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

function providerCode(status: number): string {
  if (status === 400) return 'zapi_credentials_rejected';
  if (status === 401 || status === 403) return 'zapi_client_token_rejected';
  if (status === 404) return 'zapi_instance_not_found';
  if (status === 429) return 'zapi_rate_limited';
  return `zapi_http_${status}`;
}

async function organizationContext(admin: Admin, userId: string) {
  const { data: profile, error } = await admin.from('profiles')
    .select('active_organization_id,name').eq('id', userId).maybeSingle();
  if (error || !profile?.active_organization_id) throw new Error('organization_context_required');
  const organizationId = profile.active_organization_id as string;
  const { data: membership, error: membershipError } = await admin.from('organization_members')
    .select('role,status').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
  if (membershipError || !membership || membership.status !== 'active') throw new Error('organization_access_denied');
  return { organizationId, actorName: asText(profile.name, 160) || 'Usuário', role: asText(membership.role, 40) };
}

async function canManageAccounts(admin: Admin, organizationId: string, userId: string): Promise<boolean> {
  return await hasOrganizationPermission(admin, organizationId, userId, 'channels.manage_all')
    || await hasOrganizationPermission(admin, organizationId, userId, 'configuration.manage');
}

async function accountForAction(
  admin: Admin,
  organizationId: string,
  userId: string,
  accountId: string,
  manage: boolean,
) {
  if (!accountId) throw new Error('whatsapp_account_required');
  const { data: account, error } = await admin.from('whatsapp_accounts')
    .select('id,organization_id,integration_id,owner_user_id,label,provider,account_type,is_default,enabled,connection_status,archived_at')
    .eq('id', accountId).eq('organization_id', organizationId).maybeSingle();
  if (error || !account || account.archived_at) throw new Error('whatsapp_account_not_found');
  if (!manage) {
    if (account.owner_user_id !== userId) throw new Error('whatsapp_account_access_denied');
    await requireOrganizationPermission(admin, organizationId, userId, 'channels.connect_own');
  }
  return account;
}

async function accountSecret(admin: Admin, integrationId: string) {
  const { data, error } = await admin.rpc('read_integration_secret', { p_integration: integrationId });
  if (error) throw new Error('whatsapp_credentials_read_failed');
  return asObject(data);
}

async function providerStatus(credentials: Row) {
  const instanceId = asText(credentials.instancia_id, 300);
  const instanceToken = asText(credentials.token, 500);
  const clientToken = asText(credentials.client_token, 500);
  if (!instanceId || !instanceToken || !clientToken) throw new Error('zapi_credentials_incomplete');
  const response = await fetch(
    `${zapiBaseUrl(credentials.url_base)}/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(instanceToken)}/status`,
    {
      headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
      signal: AbortSignal.timeout(20_000),
      redirect: 'error',
    },
  );
  const payload = await response.json().catch(() => null) as Row | null;
  if (!response.ok) throw new Error(providerCode(response.status));
  if (!payload) throw new Error('zapi_invalid_response');
  return payload;
}

async function registerWebhooks(integrationId: string, credentials: Row): Promise<void> {
  const instanceId = asText(credentials.instancia_id, 300);
  const instanceToken = asText(credentials.token, 500);
  const clientToken = asText(credentials.client_token, 500);
  const webhookToken = asText(credentials.webhook_token, 1_000);
  if (!instanceId || !instanceToken || !clientToken || !webhookToken) throw new Error('zapi_webhook_credentials_incomplete');
  const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhook-whatsapp?integration_id=${encodeURIComponent(integrationId)}&token=${encodeURIComponent(webhookToken)}`;
  for (const endpoint of WEBHOOK_ENDPOINTS) {
    const response = await fetch(
      `${zapiBaseUrl(credentials.url_base)}/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(instanceToken)}/${endpoint}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({ value: callbackUrl }),
        signal: AbortSignal.timeout(20_000),
        redirect: 'error',
      },
    );
    const payload = await response.json().catch(() => null) as Row | null;
    if (!response.ok || payload?.value === false) throw new Error(`zapi_webhook_setup_${endpoint}_${response.status}`);
  }
}

async function listAccounts(admin: Admin, organizationId: string, userId: string, manage: boolean) {
  let query = admin.from('whatsapp_accounts')
    .select('id,integration_id,owner_user_id,label,provider,account_type,is_default,enabled,connection_status,connected_phone_suffix,connected_at,status_checked_at,webhook_registered_at,expires_at,last_error_code,onboarding_status,sync_status,messaging_mode,daily_message_goal,verified_name,quality_rating,display_phone_number,phone_number_id,created_at,updated_at')
    .eq('organization_id', organizationId).is('archived_at', null).order('is_default', { ascending: false }).order('label');
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
      .eq('organization_id', organizationId).in('provider', ['zapi', 'meta_cloud', 'evolution_go', 'wa_akg']),
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
      id: account.id,
      ownerUserId: account.owner_user_id,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      label: account.label,
      provider: account.provider,
      accountType: account.account_type,
      isDefault: account.is_default,
      enabled: account.enabled,
      connectionStatus: account.connection_status,
      connectedPhoneSuffix: account.connected_phone_suffix,
      connectedAt: account.connected_at,
      statusCheckedAt: account.status_checked_at,
      webhookRegisteredAt: account.webhook_registered_at,
      expiresAt: account.expires_at,
      lastErrorCode: account.last_error_code,
      configured: account.provider === 'meta_cloud'
        ? account.onboarding_status === 'connected'
        : asObject(integration?.configuration).configured === true,
      connected: account.provider === 'meta_cloud'
        ? account.connection_status === 'connected'
        : integration?.connected === true,
      paused: integration?.paused === true,
      onboardingStatus: account.onboarding_status,
      syncStatus: account.sync_status,
      messagingMode: account.messaging_mode,
      dailyMessageGoal: account.daily_message_goal,
      verifiedName: account.verified_name,
      qualityRating: account.quality_rating,
      displayPhoneNumber: account.display_phone_number,
      phoneNumberId: account.phone_number_id,
      updatedAt: account.updated_at,
    };
  });
  const savedControls = new Map((controlsRead.data ?? []).map((control) => [control.provider, control]));
  const providerControls = (['zapi', 'meta_cloud', 'evolution_go', 'wa_akg'] as const).map((provider) => {
    const control = savedControls.get(provider);
    const fallbackActive = presentedAccounts.some((account) => account.provider === provider && account.enabled && account.connected);
    const inboundEnabled = control?.inbound_enabled === true || (!control && fallbackActive);
    const sendEnabled = control?.send_enabled === true || (!control && fallbackActive);
    const automationEnabled = control?.automation_enabled === true || (!control && fallbackActive);
    const killSwitch = control?.kill_switch === true || (!control && !fallbackActive);
    return {
      provider,
      inboundEnabled,
      sendEnabled,
      automationEnabled,
      killSwitch,
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
    id: String(event.id),
    action: asText(event.action, 120),
    detail: asText(event.detail, 320) || 'Evento de canal registrado.',
    actorName: asText(event.actor_name, 160) || null,
    occurredAt: asText(event.occurred_at, 80) || asText(event.created_at, 80) || null,
    result: auditResult(asText(event.action, 120)),
  }));
  const channelOverviews = Object.fromEntries((accounts ?? []).map((account) => {
    const integration = asObject(integrationById.get(account.integration_id));
    const provider = asText(account.provider, 40);
    const control = asObject(savedControls.get(provider));
    const accepted = relevantAudit.find((event) => event.action === 'outreach.whatsapp_direct_test_provider_accepted'
      && String(event.entity_id ?? '') === String(account.integration_id));
    // An inbound event proves that the provider reached our channel. Its later
    // processing status must not be confused with delivery/read confirmation.
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
    const { organizationId, actorName } = await organizationContext(admin, user.id);
    const manage = await canManageAccounts(admin, organizationId, user.id);

    if (action === 'list') {
      if (!manage) await requireOrganizationPermission(admin, organizationId, user.id, 'channels.view_own');
      return json({ ok: true, ...(await listAccounts(admin, organizationId, user.id, manage)), canManage: manage }, 200, headers);
    }

    if (action === 'configure') {
      if (!manage) throw new Error('permission_denied');
      const accountIdInput = asUuid(body.account_id);
      const ownerUserId = asUuid(body.owner_user_id);
      const label = asText(body.label, 120);
      if (!ownerUserId) throw new Error('whatsapp_account_owner_required');
      if (!label) throw new Error('whatsapp_account_label_required');
      const { data: member, error: memberError } = await admin.from('organization_members')
        .select('status').eq('organization_id', organizationId).eq('user_id', ownerUserId).maybeSingle();
      if (memberError || !member || member.status !== 'active') throw new Error('whatsapp_account_owner_inactive');

      let accountId = accountIdInput;
      let integrationId = '';
      let previousSecret: Row = {};
      if (accountId) {
        const { data: existing, error } = await admin.from('whatsapp_accounts')
          .select('id,integration_id,provider,account_type').eq('id', accountId).eq('organization_id', organizationId).is('archived_at', null).maybeSingle();
        if (error || !existing || existing.account_type !== 'seller' || existing.provider !== 'zapi') throw new Error('whatsapp_account_not_found');
        integrationId = existing.integration_id;
        previousSecret = await accountSecret(admin, integrationId);
      } else {
        accountId = crypto.randomUUID();
        const { data: integration, error: integrationError } = await admin.from('integrations').insert({
          organization_id: organizationId,
          key: `whatsapp_account:${accountId}`,
          label,
          provider: 'Z-API',
          category: 'communication',
          connected: false,
          enabled: false,
          paused: false,
          mode: 'real',
          status_detail: 'Conta do usuário criada; aguardando credenciais e conexão.',
          configuration: {},
        }).select('id').single();
        if (integrationError || !integration) throw new Error('whatsapp_account_integration_create_failed');
        integrationId = integration.id;
        const { error: accountError } = await admin.from('whatsapp_accounts').insert({
          id: accountId,
          organization_id: organizationId,
          integration_id: integrationId,
          owner_user_id: ownerUserId,
          label,
          account_type: 'seller',
          is_default: false,
          enabled: false,
          connection_status: 'unconfigured',
          created_by: user.id,
        });
        if (accountError) {
          await admin.from('integrations').delete().eq('id', integrationId).eq('organization_id', organizationId);
          if (accountError.code === '23505') throw new Error('whatsapp_account_owner_already_assigned');
          throw new Error('whatsapp_account_create_failed');
        }
      }

      const instanceId = asText(body.instance_id, 300) || asText(previousSecret.instancia_id, 300);
      const instanceToken = asText(body.instance_token, 500) || asText(previousSecret.token, 500);
      const clientToken = asText(body.client_token, 500) || asText(previousSecret.client_token, 500);
      if (!instanceId || !instanceToken || !clientToken) throw new Error('zapi_credentials_required');
      const credentials = {
        instancia_id: instanceId,
        token: instanceToken,
        client_token: clientToken,
        url_base: zapiBaseUrl(body.url_base || previousSecret.url_base),
        webhook_token: asText(previousSecret.webhook_token, 1_000) || crypto.randomUUID().replace(/-/g, ''),
      };
      const { error: secretError } = await admin.rpc('store_integration_secret', {
        p_integration: integrationId,
        p_secret: credentials,
      });
      if (secretError) throw new Error('whatsapp_credentials_save_failed');
      const now = new Date().toISOString();
      const { error: accountUpdateError } = await admin.from('whatsapp_accounts').update({
        owner_user_id: ownerUserId,
        label,
        enabled: false,
        connection_status: 'configured',
        status_checked_at: null,
        webhook_registered_at: null,
        last_error_code: null,
        updated_at: now,
      }).eq('id', accountId).eq('organization_id', organizationId);
      const { error: integrationUpdateError } = await admin.from('integrations').update({
        label,
        connected: false,
        enabled: false,
        paused: false,
        last_error: null,
        last_error_at: null,
        status_detail: 'Credenciais guardadas no cofre; aguardando conexão por QR Code ou telefone.',
        updated_at: now,
      }).eq('id', integrationId).eq('organization_id', organizationId);
      if (accountUpdateError || integrationUpdateError) throw new Error('whatsapp_account_state_save_failed');
      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        actor_id: user.id,
        actor_name: actorName,
        actor_type: 'user',
        action: 'whatsapp_account.configured',
        detail: 'Conta operacional de WhatsApp configurada para um usuário; credenciais mantidas no cofre.',
        entity_table: 'whatsapp_accounts',
        entity_id: accountId,
        event_data: { owner_user_id: ownerUserId, provider: 'Z-API' },
      });
      return json({ ok: true, accountId }, 200, headers);
    }

    if (action === 'connector_token') {
      const account = await accountForAction(admin, organizationId, user.id, asUuid(body.account_id), manage);
      if (account.provider !== 'zapi') throw new Error('zapi_action_not_available_for_provider');
      const credentials = await accountSecret(admin, account.integration_id);
      const instanceId = asText(credentials.instancia_id, 300);
      const instanceToken = asText(credentials.token, 500);
      const clientToken = asText(credentials.client_token, 500);
      if (!instanceId || !instanceToken || !clientToken) throw new Error('zapi_credentials_incomplete');
      const response = await fetch(
        `${zapiBaseUrl(credentials.url_base)}/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(instanceToken)}/sdk-connector-token`,
        {
          headers: { 'Client-Token': clientToken },
          signal: AbortSignal.timeout(20_000),
          redirect: 'error',
        },
      );
      const payload = await response.json().catch(() => null) as Row | null;
      if (!response.ok) throw new Error(providerCode(response.status));
      const token = asText(payload?.token, 8_000);
      if (!token) throw new Error('zapi_connector_token_missing');
      await admin.from('whatsapp_accounts').update({
        connection_status: 'qr', status_checked_at: new Date().toISOString(), last_error_code: null,
      }).eq('id', account.id).eq('organization_id', organizationId);
      return json({ ok: true, token }, 200, headers);
    }

    if (action === 'refresh_status') {
      const account = await accountForAction(admin, organizationId, user.id, asUuid(body.account_id), manage);
      if (account.provider !== 'zapi') throw new Error('zapi_action_not_available_for_provider');
      const credentials = await accountSecret(admin, account.integration_id);
      let status: Row;
      try {
        status = await providerStatus(credentials);
      } catch (error) {
        const code = safeError(error).slice(0, 160);
        await admin.from('whatsapp_accounts').update({
          connection_status: 'error', status_checked_at: new Date().toISOString(), last_error_code: code,
        }).eq('id', account.id).eq('organization_id', organizationId);
        await admin.from('integrations').update({
          connected: false, enabled: true, paused: false, last_error: code,
          last_error_at: new Date().toISOString(), status_detail: 'Não foi possível validar a conta Z-API.',
        }).eq('id', account.integration_id).eq('organization_id', organizationId);
        throw error;
      }
      const connected = status.connected === true && status.smartphoneConnected === true;
      const now = new Date().toISOString();
      const { data: providerControl, error: providerControlError } = await admin.from('messaging_provider_controls')
        .select('inbound_enabled,send_enabled,automation_enabled,kill_switch')
        .eq('organization_id', organizationId).eq('provider', 'zapi').maybeSingle();
      if (providerControlError) throw new Error('provider_control_read_failed');
      const providerEnabled = !providerControl || (providerControl.inbound_enabled === true
        && providerControl.send_enabled === true
        && providerControl.automation_enabled === true
        && providerControl.kill_switch !== true);
      let webhookRegisteredAt: string | null = null;
      if (connected && providerEnabled) {
        await registerWebhooks(account.integration_id, credentials);
        webhookRegisteredAt = now;
      }
      const connectionStatus = connected
        ? 'connected'
        : status.connected === true
          ? 'disconnected'
          : asText(status.status, 40).toLowerCase() === 'expired'
            ? 'expired'
            : 'disconnected';
      const suffix = phoneSuffix(status.phone ?? status.phoneNumber ?? status.connectedPhone ?? status.wid);
      const routingEnabled = providerEnabled && (connected || account.enabled === true);
      const { error: integrationError } = await admin.from('integrations').update({
        connected,
        enabled: routingEnabled,
        paused: !providerEnabled,
        last_tested_at: now,
        last_success_at: connected ? now : null,
        last_error: connected ? null : 'zapi_instance_not_connected',
        last_error_at: connected ? null : now,
        status_detail: !providerEnabled
          ? 'A instância continua válida, mas a Z-API está desativada no WayFlex.'
          : connected
          ? 'Conta Z-API conectada e callbacks registrados.'
          : 'Credenciais válidas; aguardando conexão do WhatsApp.',
        updated_at: now,
      }).eq('id', account.integration_id).eq('organization_id', organizationId);
      const { error: accountError } = await admin.from('whatsapp_accounts').update({
        enabled: routingEnabled,
        connection_status: connectionStatus,
        connected_phone_suffix: suffix,
        connected_at: connected ? now : null,
        status_checked_at: now,
        webhook_registered_at: webhookRegisteredAt,
        last_error_code: connected ? null : 'zapi_instance_not_connected',
        updated_at: now,
      }).eq('id', account.id).eq('organization_id', organizationId);
      if (integrationError || accountError) throw new Error('whatsapp_account_status_save_failed');
      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        actor_id: user.id,
        actor_name: actorName,
        actor_type: 'user',
        action: connected ? 'whatsapp_account.connected' : 'whatsapp_account.connection_pending',
        detail: !providerEnabled
          ? 'Status consultado sem reativar a Z-API no WayFlex.'
          : connected
          ? 'Conta operacional conectada e preparada para entrada e saída.'
          : 'Conta operacional validada, mas ainda sem sessão WhatsApp conectada.',
        entity_table: 'whatsapp_accounts',
        entity_id: account.id,
        event_data: { owner_user_id: account.owner_user_id, phone_suffix: suffix, webhooks_registered: connected },
      });
      return json({ ok: true, connected, connectionStatus, connectedPhoneSuffix: suffix }, 200, headers);
    }

    if (action === 'set_provider_enabled') {
      if (!manage) throw new Error('provider_activation_permission_denied');
      const provider = asText(body.provider, 40);
      if (provider !== 'zapi' && provider !== 'meta_cloud') throw new Error('provider_not_supported');
      const enabled = body.enabled === true;
      const now = new Date().toISOString();
      const requestedAccountId = asUuid(body.account_id);
      let accountQuery = admin.from('whatsapp_accounts')
        .select('id,integration_id,provider,account_type,connection_status,is_default')
        .eq('organization_id', organizationId).eq('provider', provider).is('archived_at', null);
      if (requestedAccountId) accountQuery = accountQuery.eq('id', requestedAccountId);
      else accountQuery = accountQuery.eq('account_type', 'corporate').order('is_default', { ascending: false }).limit(1);
      const { data: targetAccount, error: targetAccountError } = await accountQuery.maybeSingle();
      if (targetAccountError || !targetAccount) throw new Error('provider_account_not_found');

      const { data: targetIntegration, error: targetIntegrationError } = await admin.from('integrations')
        .select('id,connected,enabled,paused').eq('id', targetAccount.integration_id).eq('organization_id', organizationId).maybeSingle();
      if (targetIntegrationError || !targetIntegration) throw new Error('provider_account_not_ready');
      if (enabled && (targetAccount.connection_status !== 'connected' || targetIntegration.connected !== true)) {
        throw new Error('provider_account_not_ready');
      }

      const { data: providerAccounts, error: providerAccountsError } = await admin.from('whatsapp_accounts')
        .select('id,integration_id').eq('organization_id', organizationId).eq('provider', provider).is('archived_at', null);
      if (providerAccountsError) throw new Error('provider_account_read_failed');
      const accountIds = (providerAccounts ?? []).map((account) => account.id);
      const integrationIds = (providerAccounts ?? []).map((account) => account.integration_id).filter(Boolean);
      const otherProvider = provider === 'zapi' ? 'meta_cloud' : 'zapi';
      const { data: otherProviderAccounts, error: otherProviderAccountsError } = await admin.from('whatsapp_accounts')
        .select('id,integration_id').eq('organization_id', organizationId).eq('provider', otherProvider).is('archived_at', null);
      if (otherProviderAccountsError) throw new Error('provider_account_read_failed');
      const otherAccountIds = (otherProviderAccounts ?? []).map((account) => account.id);
      const otherIntegrationIds = (otherProviderAccounts ?? []).map((account) => account.integration_id).filter(Boolean);

      if (enabled) {
        const { error: otherControlError } = await admin.from('messaging_provider_controls').upsert({
          organization_id: organizationId,
          provider: otherProvider,
          inbound_enabled: false,
          send_enabled: false,
          automation_enabled: false,
          kill_switch: true,
          reason: `Desativado ao ativar ${provider === 'zapi' ? 'Z-API' : 'Meta WhatsApp Cloud API'}.`,
          changed_by: user.id,
          updated_at: now,
        }, { onConflict: 'organization_id,provider' });
        if (otherControlError) throw new Error('provider_control_save_failed');
        const { error: otherAccountDisableError } = otherAccountIds.length
          ? await admin.from('whatsapp_accounts').update({ enabled: false, is_default: false, updated_at: now })
            .in('id', otherAccountIds).eq('organization_id', organizationId)
          : { error: null };
        const { error: otherIntegrationDisableError } = otherIntegrationIds.length
          ? await admin.from('integrations').update({
            enabled: false,
            paused: true,
            status_detail: `Canal ${otherProvider === 'zapi' ? 'Z-API' : 'Meta WhatsApp Cloud API'} desativado ao ativar o outro provedor corporativo.`,
            updated_at: now,
          }).in('id', otherIntegrationIds).eq('organization_id', organizationId)
          : { error: null };
        const { error: otherWebhookDisableError } = otherProvider === 'zapi'
          ? await admin.from('integrations').update({
            enabled: false,
            paused: true,
            status_detail: 'Entrada Z-API desativada ao ativar Meta WhatsApp Cloud API.',
            updated_at: now,
          }).eq('organization_id', organizationId).eq('provider', 'zapi').eq('key', 'zapi_webhook')
          : { error: null };
        if (otherAccountDisableError || otherIntegrationDisableError || otherWebhookDisableError) {
          throw new Error('other_provider_deactivation_save_failed');
        }
        const { error: defaultsError } = await admin.from('whatsapp_accounts').update({ is_default: false, updated_at: now })
          .eq('organization_id', organizationId).is('archived_at', null).eq('account_type', 'corporate');
        if (defaultsError) throw new Error('provider_default_save_failed');
        const { error: accountEnableError } = await admin.from('whatsapp_accounts').update({ enabled: true, is_default: true, updated_at: now })
          .eq('id', targetAccount.id).eq('organization_id', organizationId);
        const { error: integrationEnableError } = await admin.from('integrations').update({
          enabled: true,
          paused: false,
          status_detail: `Canal ${provider === 'zapi' ? 'Z-API' : 'Meta WhatsApp Cloud API'} habilitado pelo administrador.`,
          updated_at: now,
        }).eq('id', targetAccount.integration_id).eq('organization_id', organizationId);
        const { error: zapiWebhookEnableError } = provider === 'zapi'
          ? await admin.from('integrations').update({
            enabled: true,
            paused: false,
            status_detail: 'Entrada Z-API retomada pelo administrador; confirme um callback real antes de considerá-la homologada.',
            updated_at: now,
          }).eq('organization_id', organizationId).eq('provider', 'zapi').eq('key', 'zapi_webhook')
          : { error: null };
        if (accountEnableError || integrationEnableError || zapiWebhookEnableError) throw new Error('provider_activation_save_failed');
      } else {
        const { error: accountDisableError } = accountIds.length
          ? await admin.from('whatsapp_accounts').update({ enabled: false, updated_at: now }).in('id', accountIds).eq('organization_id', organizationId)
          : { error: null };
        const { error: integrationDisableError } = integrationIds.length
          ? await admin.from('integrations').update({
            enabled: false,
            paused: true,
            status_detail: `Canal ${provider === 'zapi' ? 'Z-API' : 'Meta WhatsApp Cloud API'} desativado pelo administrador no WayFlex.`,
            updated_at: now,
          }).in('id', integrationIds).eq('organization_id', organizationId)
          : { error: null };
        if (accountDisableError || integrationDisableError) throw new Error('provider_deactivation_save_failed');
      }

      const { error: controlError } = await admin.from('messaging_provider_controls').upsert({
        organization_id: organizationId,
        provider,
        inbound_enabled: enabled,
        send_enabled: enabled,
        automation_enabled: enabled,
        kill_switch: !enabled,
        reason: enabled
          ? `Ativado pelo administrador para entrada, saída e automações da Ana.`
          : `Desativado pelo administrador. A configuração e o histórico foram preservados.`,
        changed_by: user.id,
        updated_at: now,
      }, { onConflict: 'organization_id,provider' });
      if (controlError) throw new Error('provider_control_save_failed');
      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        actor_id: user.id,
        actor_name: actorName,
        actor_type: 'user',
        action: enabled ? 'whatsapp_provider.enabled' : 'whatsapp_provider.disabled',
        detail: enabled
          ? `${provider === 'zapi' ? 'Z-API' : 'Meta WhatsApp Cloud API'} ativada como canal corporativo.`
          : `${provider === 'zapi' ? 'Z-API' : 'Meta WhatsApp Cloud API'} desativada no WayFlex sem remover sessão nem histórico.`,
        entity_table: 'whatsapp_accounts',
        entity_id: targetAccount.id,
        event_data: { provider, enabled, account_id: targetAccount.id },
      });
      return json({ ok: true, provider, enabled }, 200, headers);
    }

    if (action === 'set_enabled') {
      const account = await accountForAction(admin, organizationId, user.id, asUuid(body.account_id), manage);
      if (account.provider !== 'zapi') throw new Error('meta_account_requires_rollout_gate');
      const enabled = body.enabled === true;
      if (account.is_default && !enabled) throw new Error('corporate_whatsapp_account_protected');
      const now = new Date().toISOString();
      const { error: integrationError } = await admin.from('integrations').update({
        enabled,
        status_detail: enabled ? 'Conta operacional habilitada.' : 'Conta operacional desativada pelo usuário.',
        updated_at: now,
      }).eq('id', account.integration_id).eq('organization_id', organizationId);
      const { error: accountError } = await admin.from('whatsapp_accounts').update({ enabled, updated_at: now })
        .eq('id', account.id).eq('organization_id', organizationId);
      if (integrationError || accountError) throw new Error('whatsapp_account_toggle_failed');
      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        actor_id: user.id,
        actor_name: actorName,
        actor_type: 'user',
        action: enabled ? 'whatsapp_account.enabled' : 'whatsapp_account.disabled',
        detail: enabled ? 'Conta operacional habilitada.' : 'Conta operacional desativada sem remover o histórico.',
        entity_table: 'whatsapp_accounts',
        entity_id: account.id,
        event_data: { owner_user_id: account.owner_user_id },
      });
      return json({ ok: true, enabled }, 200, headers);
    }

    throw new Error('unsupported_action');
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});
