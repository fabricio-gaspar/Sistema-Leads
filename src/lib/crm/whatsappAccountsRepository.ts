import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

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
