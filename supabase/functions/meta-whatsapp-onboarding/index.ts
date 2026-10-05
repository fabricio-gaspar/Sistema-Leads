import {
  createAdminClient,
  requireOrganizationPermission,
  requireUser,
} from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';
import { sha256Hex } from '../_shared/messaging/metaSignature.ts';

type Admin = ReturnType<typeof createAdminClient>;
type Row = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function digits(value: unknown): string {
  const candidate = asText(value, 80).replace(/\D/g, '');
  return /^\d{5,40}$/.test(candidate) ? candidate : '';
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function organizationContext(admin: Admin, userId: string) {
  const { data: profile, error } = await admin.from('profiles')
    .select('active_organization_id,name').eq('id', userId).maybeSingle();
  if (error || !profile?.active_organization_id) throw new Error('organization_context_required');
  const organizationId = profile.active_organization_id as string;
  await requireOrganizationPermission(admin, organizationId, userId, 'channels.manage_all');
  return { organizationId, actorName: asText(profile.name, 160) || 'Administrador' };
}

async function requireFeature(admin: Admin, organizationId: string): Promise<void> {
  const { data, error } = await admin.from('organization_feature_flags').select('enabled')
    .eq('organization_id', organizationId).eq('flag_key', 'meta_coexistence').maybeSingle();
  if (error || data?.enabled !== true) throw new Error('meta_coexistence_feature_disabled');
}

async function exchangeCode(code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: requiredEnv('META_APP_ID'),
    client_secret: requiredEnv('META_APP_SECRET'),
    redirect_uri: requiredEnv('META_REDIRECT_URI'),
    code,
  });
  const response = await fetch('https://graph.facebook.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20_000),
    redirect: 'error',
  });
  const payload = asObject(await response.json().catch(() => null));
  const token = asText(payload.access_token, 8_000);
  if (!response.ok || !token) throw new Error('meta_oauth_exchange_failed');
  return token;
}

async function readPhone(accessToken: string, phoneNumberId: string, version: string) {
  const response = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
      redirect: 'error',
    },
  );
  const payload = asObject(await response.json().catch(() => null));
  if (!response.ok || asText(payload.id, 80) !== phoneNumberId) throw new Error('meta_phone_verification_failed');
  return payload;
}

async function subscribeBusinessAccount(accessToken: string, businessAccountId: string, version: string) {
  const response = await fetch(
    `https://graph.facebook.com/${version}/${businessAccountId}/subscribed_apps`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(20_000),
      redirect: 'error',
    },
  );
  const payload = asObject(await response.json().catch(() => null));
  if (!response.ok || payload.success !== true) throw new Error('meta_webhook_subscription_failed');
}

async function memberExists(admin: Admin, organizationId: string, userId: string): Promise<boolean> {
  const { data, error } = await admin.from('organization_members').select('user_id,status')
    .eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
  if (error) throw new Error('meta_owner_validation_failed');
  return data?.status === 'active';
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, erro: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, erro: 'method_not_allowed' }, 405, headers);
  try {
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { organizationId, actorName } = await organizationContext(admin, user.id);
    await requireFeature(admin, organizationId);
    const body = await request.json().catch(() => ({})) as Row;
    const action = asText(body.action, 40);

    if (action === 'bootstrap') {
      const appId = requiredEnv('META_APP_ID');
      const configurationId = requiredEnv('META_EMBEDDED_SIGNUP_CONFIG_ID');
      const redirectUri = requiredEnv('META_REDIRECT_URI');
      const graphApiVersion = requiredEnv('META_GRAPH_API_VERSION');
      if (!/^v\d{1,3}\.\d{1,2}$/.test(graphApiVersion)) throw new Error('meta_graph_version_invalid');
      requiredEnv('META_APP_SECRET');
      const ownerUserId = asUuid(body.owner_user_id) || null;
      if (ownerUserId && !(await memberExists(admin, organizationId, ownerUserId))) throw new Error('meta_owner_invalid');
      const state = randomState();
      const { data: session, error } = await admin.from('meta_onboarding_sessions').insert({
        organization_id: organizationId,
        requested_by: user.id,
        owner_user_id: ownerUserId,
        state_hash: await sha256Hex(state),
        status: 'pending',
        expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
      }).select('id,expires_at').single();
      if (error || !session?.id) throw new Error('meta_onboarding_session_create_failed');
      return json({
        ok: true,
        sessionId: session.id,
        state,
        expiresAt: session.expires_at,
        appId,
        configurationId,
        redirectUri,
        graphApiVersion,
      }, 200, headers);
    }

    if (action === 'complete') {
      const sessionId = asUuid(body.session_id);
      const state = asText(body.state, 300);
      const code = asText(body.code, 4_000);
      const businessAccountId = digits(body.business_account_id);
      const phoneNumberId = digits(body.phone_number_id);
      const label = asText(body.label, 120) || 'WhatsApp Meta';
      if (!sessionId || !state || !code || !businessAccountId || !phoneNumberId) throw new Error('meta_onboarding_input_required');
      const { data: session, error: sessionError } = await admin.from('meta_onboarding_sessions')
        .select('id,requested_by,owner_user_id,state_hash,status,expires_at')
        .eq('id', sessionId).eq('organization_id', organizationId).maybeSingle();
      if (sessionError || !session || session.requested_by !== user.id) throw new Error('meta_onboarding_session_invalid');
      if (session.status !== 'pending' || new Date(session.expires_at).getTime() <= Date.now()) throw new Error('meta_onboarding_session_expired');
      if (session.state_hash !== await sha256Hex(state)) throw new Error('meta_onboarding_state_invalid');
      const graphApiVersion = requiredEnv('META_GRAPH_API_VERSION');
      const accessToken = await exchangeCode(code);
      const phone = await readPhone(accessToken, phoneNumberId, graphApiVersion);
      await subscribeBusinessAccount(accessToken, businessAccountId, graphApiVersion);

      const integrationId = crypto.randomUUID();
      const accountId = crypto.randomUUID();
      const ownerUserId = asUuid(session.owner_user_id) || null;
      const { error: integrationError } = await admin.from('integrations').insert({
        id: integrationId,
        organization_id: organizationId,
        key: `whatsapp_meta:${phoneNumberId}`,
        label,
        provider: 'Meta Cloud API',
        category: 'communication',
        connected: true,
        enabled: false,
        paused: true,
        mode: 'real',
        status_detail: 'Conta Meta conectada; envio e automação aguardam homologação por gate.',
        configuration: { configured: true, coexistence: true, graph_api_version: graphApiVersion },
        last_tested_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
      });
      if (integrationError) throw new Error(integrationError.code === '23505' ? 'meta_phone_already_connected' : 'meta_integration_create_failed');
      const { error: secretError } = await admin.rpc('store_integration_secret', {
        p_integration: integrationId,
        p_secret: {
          access_token: accessToken,
          business_account_id: businessAccountId,
          phone_number_id: phoneNumberId,
          graph_api_version: graphApiVersion,
        },
      });
      if (secretError) {
        await admin.from('integrations').delete().eq('id', integrationId).eq('organization_id', organizationId);
        throw new Error('meta_credentials_save_failed');
      }
      const phoneDigits = asText(phone.display_phone_number, 80).replace(/\D/g, '');
      const { error: accountError } = await admin.from('whatsapp_accounts').insert({
        id: accountId,
        organization_id: organizationId,
        integration_id: integrationId,
        owner_user_id: ownerUserId,
        label,
        provider: 'meta_cloud',
        account_type: ownerUserId ? 'seller' : 'corporate',
        is_default: false,
        enabled: false,
        connection_status: 'connected',
        connected_phone_suffix: phoneDigits.length >= 4 ? phoneDigits.slice(-4) : null,
        connected_at: new Date().toISOString(),
        status_checked_at: new Date().toISOString(),
        webhook_registered_at: new Date().toISOString(),
        business_account_id: businessAccountId,
        phone_number_id: phoneNumberId,
        display_phone_number: asText(phone.display_phone_number, 80) || null,
        verified_name: asText(phone.verified_name, 160) || null,
        quality_rating: asText(phone.quality_rating, 40) || null,
        onboarding_status: 'connected',
        sync_status: 'pending',
        messaging_mode: 'suggestion',
        provider_metadata: { graph_api_version: graphApiVersion, coexistence: true },
        created_by: user.id,
      });
      if (accountError) {
        await admin.from('integrations').delete().eq('id', integrationId).eq('organization_id', organizationId);
        throw new Error(accountError.code === '23505' ? 'meta_owner_or_phone_already_connected' : 'meta_account_create_failed');
      }
      await admin.from('meta_onboarding_sessions').update({
        status: 'completed',
        business_account_id: businessAccountId,
        phone_number_id: phoneNumberId,
        completed_at: new Date().toISOString(),
      }).eq('id', sessionId).eq('organization_id', organizationId);
      await admin.from('whatsapp_sync_state').upsert({
        whatsapp_account_id: accountId,
        organization_id: organizationId,
        sync_kind: 'coexistence',
        status: 'pending',
      }, { onConflict: 'whatsapp_account_id' });
      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        actor_id: user.id,
        actor_name: actorName,
        actor_type: 'user',
        action: 'whatsapp.meta_connected',
        detail: 'Conta Meta Cloud API conectada sem liberar envios ou automação.',
        entity_table: 'whatsapp_accounts',
        entity_id: accountId,
        event_data: { owner_user_id: ownerUserId, phone_suffix: phoneDigits.slice(-4), coexistence: true, rollout_gate: 1 },
      });
      return json({ ok: true, accountId, connected: true, sendEnabled: false, automationEnabled: false }, 200, headers);
    }

    if (action === 'status') {
      const { data, error } = await admin.from('whatsapp_accounts')
        .select('id,owner_user_id,label,connection_status,onboarding_status,sync_status,connected_phone_suffix,quality_rating,status_checked_at')
        .eq('organization_id', organizationId).eq('provider', 'meta_cloud').is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) throw new Error('meta_accounts_read_failed');
      return json({ ok: true, accounts: data ?? [] }, 200, headers);
    }

    throw new Error('unsupported_action');
  } catch (error) {
    return json({ ok: false, erro: safeError(error) }, 400, headers);
  }
});

