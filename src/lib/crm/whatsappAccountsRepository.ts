import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { assertChannelActionCompleted } from './channelLifecycle';
import { sessionContext } from '@/lib/sessionContext';

export type WhatsappConnectionStatus =
  | 'unconfigured'
  | 'configured'
  | 'qr'
  | 'connected'
  | 'disconnected'
  | 'expired'
  | 'error';

export interface WhatsappAccount {
  id: string;
  provider: 'zapi' | 'meta_cloud' | 'evolution_go' | 'wa_akg';
  ownerUserId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  label: string;
  accountType: 'corporate' | 'seller';
  isDefault: boolean;
  enabled: boolean;
  connectionStatus: WhatsappConnectionStatus;
  connectedPhoneSuffix: string | null;
  connectedAt: string | null;
  statusCheckedAt: string | null;
  webhookRegisteredAt: string | null;
  expiresAt: string | null;
  lastErrorCode: string | null;
  configured: boolean;
  connected: boolean;
  paused: boolean;
  onboardingStatus: 'not_started' | 'pending' | 'connected' | 'failed' | 'revoked';
  syncStatus: 'not_started' | 'pending' | 'running' | 'complete' | 'partial' | 'failed';
  messagingMode: 'suggestion' | 'assisted' | 'automatic';
  dailyMessageGoal: number;
  verifiedName: string | null;
  qualityRating: string | null;
  displayPhoneNumber: string | null;
  phoneNumberId: string | null;
  updatedAt: string;
}

export interface WhatsappProviderControl {
  provider: 'zapi' | 'meta_cloud' | 'evolution_go' | 'wa_akg';
  inboundEnabled: boolean;
  sendEnabled: boolean;
  automationEnabled: boolean;
  killSwitch: boolean;
  active: boolean;
  reason: string | null;
  updatedAt: string | null;
}

export type WhatsappChannelState =
  | 'disconnected'
  | 'connecting'
  | 'configuration_incomplete'
  | 'validating'
  | 'operational'
  | 'requires_attention'
  | 'reconnecting'
  | 'authorization_revoked';

export interface WhatsappChannelCheck {
  key: 'authorization' | 'account' | 'number' | 'events' | 'routing' | 'send_receive';
  label: string;
  state: 'ready' | 'pending' | 'attention';
  detail: string;
  checkedAt: string | null;
  action: 'none' | 'validate' | 'connect' | 'test' | 'diagnostic';
}

export interface WhatsappChannelHistoryEntry {
  id: string;
  action: string;
  detail: string;
  actorName: string | null;
  occurredAt: string | null;
  result: 'success' | 'pending' | 'attention';
}

export interface WhatsappChannelOverview {
  state: WhatsappChannelState;
  statusLabel: string;
  statusDetail: string;
  routing: {
    active: boolean;
    destination: string | null;
    detail: string;
  };
  checks: WhatsappChannelCheck[];
  lastInboundAt: string | null;
  directTestAcceptedAt: string | null;
}

export interface AccountsResponse {
  accounts: WhatsappAccount[];
  canManage: boolean;
  providerControls: WhatsappProviderControl[];
  channelOverviews?: Record<string, WhatsappChannelOverview>;
  channelHistory?: WhatsappChannelHistoryEntry[];
}

const ACCOUNTS_READ_TIMEOUT_MS = 8_000;
let accountsReadInFlight: Promise<AccountsResponse> | null = null;
sessionContext.subscribe(() => { accountsReadInFlight = null; });

function withDeadline<T>(request: Promise<T>, timeoutMs: number, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(code)), timeoutMs);
    request.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (error) => { clearTimeout(timeout); reject(error); },
    );
  });
}

async function invoke<T extends Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('whatsapp-accounts', { body });
  if (error || !data?.ok) {
    const code = typeof data?.erro === 'string' ? data.erro : await detalheDoErroDeFuncao(error);
    throw new Error(code || 'whatsapp_account_operation_failed');
  }
  return data as T;
}

export interface EvolutionGoChannelStatus {
  lifecycle?: import('./channelLifecycle').ChannelLifecycle | null;
  configured: boolean;
  canManage: boolean;
  canConnect: boolean;
  canViewQr: boolean;
  account: null | {
    id: string;
    label: string;
    accountType: 'corporate' | 'seller';
    ownerUserId: string | null;
    enabled: boolean;
    isDefault: boolean;
    connectionStatus: WhatsappConnectionStatus;
    phoneSuffix: string | null;
    connectedAt: string | null;
    checkedAt: string | null;
    webhookRegisteredAt: string | null;
    errorCode: string | null;
  };
  integration: null | {
    id: string;
    connected: boolean;
    enabled: boolean;
    paused: boolean;
    statusDetail: string | null;
    lastTestedAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    baseUrlConfigured: boolean;
    instanceName: string | null;
    version: string | null;
  };
  controls: null | {
    inboundEnabled: boolean;
    sendEnabled: boolean;
    automationEnabled: boolean;
    killSwitch: boolean;
    reason: string | null;
  };
}

export interface EvolutionGoConfigurationInput {
  label?: string;
  baseUrl?: string;
  globalApiKey?: string;
  instanceToken?: string;
  instanceName?: string;
  instanceId?: string;
  timeoutMs?: number;
  retryAttempts?: number;
}

export interface EvolutionGoAccountsResponse {
  accounts: EvolutionGoChannelStatus[];
  canManage: boolean;
}

export interface EvolutionGoAccountInput {
  accountType: 'corporate' | 'seller';
  ownerUserId?: string;
  label: string;
}

function evolutionGoConfigurationPayload(input: EvolutionGoConfigurationInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.label !== undefined) payload.label = input.label;
  if (input.baseUrl !== undefined) payload.base_url = input.baseUrl;
  if (input.globalApiKey !== undefined) payload.global_api_key = input.globalApiKey;
  if (input.instanceToken !== undefined) payload.instance_token = input.instanceToken;
  if (input.instanceName !== undefined) payload.instance_name = input.instanceName;
  if (input.instanceId !== undefined) payload.instance_id = input.instanceId;
  if (input.timeoutMs !== undefined) payload.timeout_ms = input.timeoutMs;
  if (input.retryAttempts !== undefined) payload.retry_attempts = input.retryAttempts;
  return payload;
}

async function channelInvocationError(data: unknown, error: unknown): Promise<string> {
  const payload = data as { error?: unknown } | null;
  if (typeof payload?.error === 'string') return payload.error;
  // FunctionsHttpError exposes non-2xx JSON through context, not data. Keep a
  // clone so the existing fallback can still inspect the response if needed.
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.clone === 'function') {
    try {
      const failure = await context.clone().json() as { error?: unknown };
      if (typeof failure?.error === 'string') return failure.error;
    } catch { /* Use the established transport fallback for non-JSON errors. */ }
  }
  return detalheDoErroDeFuncao(error);
}

async function invokeEvolutionGo<T extends Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('evolution-go', { body });
  if (error || !data?.ok) {
    const code = await channelInvocationError(data, error);
    throw new Error(code || 'evolution_go_operation_failed');
  }
  assertChannelActionCompleted(body.action, data.lifecycle);
  return data as T;
}

export function loadEvolutionGoAccounts(): Promise<EvolutionGoAccountsResponse> {
  return invokeEvolutionGo<EvolutionGoAccountsResponse & Record<string, unknown>>({ action: 'list' });
}

/**
 * Uses the authenticated server-side identity instead of accepting an account
 * id. This prevents the self-service screen from ever receiving corporate or
 * another seller's account metadata.
 */
export function loadMyEvolutionGoAccount(): Promise<EvolutionGoChannelStatus> {
  return invokeEvolutionGo<EvolutionGoChannelStatus & Record<string, unknown>>({ action: 'my_account' });
}

export function loadEvolutionGoStatus(accountId: string): Promise<EvolutionGoChannelStatus> {
  return invokeEvolutionGo<EvolutionGoChannelStatus & Record<string, unknown>>({ action: 'status', account_id: accountId });
}

export function createEvolutionGoAccount(input: EvolutionGoAccountInput): Promise<EvolutionGoChannelStatus> {
  return invokeEvolutionGo<EvolutionGoChannelStatus & Record<string, unknown>>({
    action: 'create_account',
    account_id: crypto.randomUUID(),
    account_type: input.accountType,
    owner_user_id: input.accountType === 'seller' ? input.ownerUserId : null,
    label: input.label,
  });
}

export function saveEvolutionGoConfiguration(accountId: string, input: EvolutionGoConfigurationInput): Promise<EvolutionGoChannelStatus> {
  return invokeEvolutionGo<EvolutionGoChannelStatus & Record<string, unknown>>({
    action: 'save', account_id: accountId, ...evolutionGoConfigurationPayload(input),
  });
}

export function createEvolutionGoInstance(accountId: string, input: EvolutionGoConfigurationInput = {}): Promise<EvolutionGoChannelStatus> {
  return invokeEvolutionGo<EvolutionGoChannelStatus & Record<string, unknown>>({
    action: 'create_instance', account_id: accountId, ...evolutionGoConfigurationPayload({
      label: input.label,
      baseUrl: input.baseUrl,
      globalApiKey: input.globalApiKey,
      instanceName: input.instanceName,
      timeoutMs: input.timeoutMs,
      retryAttempts: input.retryAttempts,
    }),
  });
}

export function runEvolutionGoAction(
  action: 'connect' | 'refresh_status' | 'reconnect' | 'disconnect' | 'logout' | 'activate' | 'deactivate',
  accountId: string,
): Promise<EvolutionGoChannelStatus> {
  return invokeEvolutionGo<EvolutionGoChannelStatus & Record<string, unknown>>({ action, account_id: accountId });
}

export function requestEvolutionGoQr(accountId: string): Promise<{ qr: { qrcode: string | null; code: string | null; expiresAt: string | null } }> {
  return invokeEvolutionGo({ action: 'qr', account_id: accountId });
}

export function requestEvolutionGoPairingCode(accountId: string, phone: string): Promise<{ pairingCode: string | null }> {
  return invokeEvolutionGo({ action: 'pair', account_id: accountId, phone });
}

export interface WaAkgChannelStatus {
  lifecycle?: import('./channelLifecycle').ChannelLifecycle | null;
  configured: boolean;
  canManage: boolean;
  canConnect: boolean;
  canViewQr: boolean;
  account: null | {
    id: string;
    label: string;
    accountType: 'corporate' | 'seller';
    ownerUserId: string | null;
    enabled: boolean;
    isDefault: boolean;
    connectionStatus: WhatsappConnectionStatus;
    phoneSuffix: string | null;
    connectedAt: string | null;
    checkedAt: string | null;
    webhookRegisteredAt: string | null;
    errorCode: string | null;
    messagingMode: 'suggestion' | 'assisted' | 'automatic';
  };
  integration: null | {
    id: string;
    connected: boolean;
    enabled: boolean;
    paused: boolean;
    statusDetail: string | null;
    lastTestedAt: string | null;
    lastSuccessAt: string | null;
    baseUrlConfigured: boolean;
    sessionName: string | null;
    version: string | null;
  };
  controls: null | {
    inboundEnabled: boolean;
    sendEnabled: boolean;
    automationEnabled: boolean;
    killSwitch: boolean;
    reason: string | null;
    minDelaySeconds: number;
    maxDelaySeconds: number;
    burstLimit: number;
    burstWindowSeconds: number;
    dailyLimit: number;
  };
}

async function invokeWaAkg<T extends Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('wa-akg', { body });
  if (error || !data?.ok) {
    const code = await channelInvocationError(data, error);
    throw new Error(code || 'wa_akg_operation_failed');
  }
  assertChannelActionCompleted(body.action, data.lifecycle);
  return data as T;
}

export function loadWaAkgAccounts(): Promise<{ accounts: WaAkgChannelStatus[]; canManage: boolean }> {
  return invokeWaAkg<{ accounts: WaAkgChannelStatus[]; canManage: boolean } & Record<string, unknown>>({ action: 'list' });
}

export function loadMyWaAkgAccount(): Promise<WaAkgChannelStatus> {
  return invokeWaAkg<WaAkgChannelStatus & Record<string, unknown>>({ action: 'my_account' });
}

export function configureWaAkgGateway(input: { label: string; baseUrl: string; apiKey: string }): Promise<WaAkgChannelStatus> {
  return invokeWaAkg<WaAkgChannelStatus & Record<string, unknown>>({ action: 'configure_gateway', label: input.label, base_url: input.baseUrl, api_key: input.apiKey });
}

export function createWaAkgSellerAccount(ownerUserId: string): Promise<WaAkgChannelStatus> {
  return invokeWaAkg<WaAkgChannelStatus & Record<string, unknown>>({ action: 'create_account', owner_user_id: ownerUserId });
}

export function provisionWaAkgAccount(accountId: string): Promise<WaAkgChannelStatus> {
  return invokeWaAkg<WaAkgChannelStatus & Record<string, unknown>>({ action: 'provision', account_id: accountId });
}

export function runWaAkgAction(
  action: 'connect' | 'refresh_status' | 'reconnect' | 'disconnect' | 'logout' | 'activate' | 'deactivate',
  accountId: string,
): Promise<WaAkgChannelStatus> {
  return invokeWaAkg<WaAkgChannelStatus & Record<string, unknown>>({ action, account_id: accountId });
}

export function requestWaAkgQr(accountId: string): Promise<{ qr: { qrcode: string | null; code: string | null; expiresAt: string | null } }> {
  return invokeWaAkg({ action: 'qr', account_id: accountId });
}

export function requestWaAkgPairingCode(accountId: string, phone: string): Promise<{ pairingCode: string | null }> {
  return invokeWaAkg({ action: 'pair', account_id: accountId, phone });
}

export interface ChannelRecoveryResult {
  lifecycle: import('./channelLifecycle').ChannelLifecycle;
  recovery: {
    eligible: boolean;
    reason: string;
    observedConnected: boolean | null;
    observedAt: string | null;
    requiresAdmin: true;
    retainsLocalCutoff: true;
    reconciled?: boolean;
  };
}

export async function reviewChannelLifecycle(
  provider: 'wa_akg' | 'evolution_go', accountId: string,
  reconciliation?: { expectedRevision: number; reason: string },
): Promise<ChannelRecoveryResult> {
  const context = sessionContext.requireReady();
  if (reconciliation && (!Number.isInteger(reconciliation.expectedRevision) || reconciliation.reason.trim().length < 8 || reconciliation.reason.trim().length > 500)) {
    throw new Error('lifecycle_recovery_reason_required');
  }
  const body = { action: reconciliation ? 'lifecycle_reconcile' : 'lifecycle_diagnose', account_id: accountId,
    ...(reconciliation ? { expected_revision: reconciliation.expectedRevision, reason: reconciliation.reason.trim() } : {}) };
  const { data, error } = await supabase.functions.invoke(provider === 'wa_akg' ? 'wa-akg' : 'evolution-go', { body });
  sessionContext.assertCurrent(context);
  if (error || !data?.ok) throw new Error(await channelInvocationError(data, error) || 'lifecycle_recovery_failed');
  if (!Number.isInteger(data.lifecycle?.revision) || data.recovery?.retainsLocalCutoff !== true || data.recovery?.requiresAdmin !== true
    || typeof data.recovery?.eligible !== 'boolean' || (reconciliation && data.recovery?.reconciled !== true)) {
    throw new Error('lifecycle_recovery_unconfirmed');
  }
  return data as ChannelRecoveryResult;
}

export function saveWaAkgControls(accountId: string, input: {
  minDelaySeconds: number; maxDelaySeconds: number; burstLimit: number; dailyLimit: number;
}): Promise<WaAkgChannelStatus> {
  return invokeWaAkg<WaAkgChannelStatus & Record<string, unknown>>({
    action: 'save_controls', account_id: accountId,
    min_delay_seconds: input.minDelaySeconds, max_delay_seconds: input.maxDelaySeconds,
    burst_limit: input.burstLimit, daily_limit: input.dailyLimit,
  });
}

export function loadWhatsappAccounts(): Promise<AccountsResponse> {
  const context = sessionContext.requireReady();
  if (accountsReadInFlight) return accountsReadInFlight;
  const request = withDeadline(
    invoke<AccountsResponse & Record<string, unknown>>({ action: 'list' }).then((result) => { sessionContext.assertCurrent(context); return result; }),
    ACCOUNTS_READ_TIMEOUT_MS,
    'whatsapp_accounts_request_timeout',
  );
  accountsReadInFlight = request;
  const clear = () => { if (accountsReadInFlight === request) accountsReadInFlight = null; };
  request.then(clear, clear);
  return request;
}

export async function configureSellerWhatsappAccount(input: {
  accountId?: string;
  ownerUserId: string;
  label: string;
  instanceId?: string;
  instanceToken?: string;
  clientToken?: string;
  urlBase?: string;
}): Promise<string> {
  const result = await invoke<{ accountId: string } & Record<string, unknown>>({
    action: 'configure',
    account_id: input.accountId,
    owner_user_id: input.ownerUserId,
    label: input.label,
    instance_id: input.instanceId,
    instance_token: input.instanceToken,
    client_token: input.clientToken,
    url_base: input.urlBase,
  });
  return result.accountId;
}

export async function requestWhatsappConnectorToken(accountId: string): Promise<string> {
  const result = await invoke<{ token: string } & Record<string, unknown>>({
    action: 'connector_token', account_id: accountId,
  });
  return result.token;
}

export function refreshWhatsappAccount(accountId: string): Promise<{
  connected: boolean;
  connectionStatus: WhatsappConnectionStatus;
  connectedPhoneSuffix: string | null;
}> {
  return invoke({ action: 'refresh_status', account_id: accountId });
}

export async function setWhatsappAccountEnabled(accountId: string, enabled: boolean): Promise<void> {
  await invoke({ action: 'set_enabled', account_id: accountId, enabled });
}

/**
 * Habilita um único provedor corporativo por vez. A operação é feita somente
 * no backend: não expõe credenciais e não remove a sessão remota do provedor.
 */
export async function setWhatsappProviderEnabled(
  provider: 'zapi' | 'meta_cloud',
  enabled: boolean,
  accountId?: string,
): Promise<void> {
  await invoke({
    action: 'set_provider_enabled',
    provider,
    enabled,
    account_id: accountId,
  });
}

export interface MetaSignupBootstrap {
  sessionId: string;
  state: string;
  expiresAt: string;
  appId: string;
  configurationId: string;
  redirectUri: string;
  graphApiVersion: string;
}

export async function metaCoexistenceFeatureEnabled(): Promise<boolean> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase.from('organization_feature_flags')
    .select('enabled').eq('organization_id', session.organizationId)
    .eq('flag_key', 'meta_coexistence').maybeSingle();
  if (error) throw error;
  return data?.enabled === true;
}

export function bootstrapMetaSignup(ownerUserId?: string): Promise<MetaSignupBootstrap> {
  return supabase.functions.invoke('meta-whatsapp-onboarding', {
    body: { action: 'bootstrap', owner_user_id: ownerUserId },
  }).then(async ({ data, error }) => {
    if (error || !data?.ok) throw new Error(data?.erro || await detalheDoErroDeFuncao(error));
    return data as MetaSignupBootstrap;
  });
}

export async function completeMetaSignup(input: {
  sessionId: string;
  state: string;
  code: string;
  businessAccountId: string;
  phoneNumberId: string;
  label: string;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke('meta-whatsapp-onboarding', {
    body: {
      action: 'complete',
      session_id: input.sessionId,
      state: input.state,
      code: input.code,
      business_account_id: input.businessAccountId,
      phone_number_id: input.phoneNumberId,
      label: input.label,
    },
  });
  if (error || !data?.ok) throw new Error(data?.erro || await detalheDoErroDeFuncao(error));
  return data.accountId as string;
}
