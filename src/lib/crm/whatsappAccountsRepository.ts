import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';
import { resolveOrganizationSession } from '@/lib/organizationSession';

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
  provider: 'zapi' | 'meta_cloud';
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
  updatedAt: string;
}

interface AccountsResponse {
  accounts: WhatsappAccount[];
  canManage: boolean;
}

async function invoke<T extends Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('whatsapp-accounts', { body });
  if (error || !data?.ok) {
    const code = typeof data?.erro === 'string' ? data.erro : await detalheDoErroDeFuncao(error);
    throw new Error(code || 'whatsapp_account_operation_failed');
  }
  return data as T;
}

export function loadWhatsappAccounts(): Promise<AccountsResponse> {
  return invoke<AccountsResponse & Record<string, unknown>>({ action: 'list' });
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
