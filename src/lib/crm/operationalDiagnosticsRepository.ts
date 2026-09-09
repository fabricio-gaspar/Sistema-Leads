import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

export type OperationalMode = 'demo' | 'real';

export interface OperationalCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface OperationalIntegration {
  key: string;
  label: string;
  category: 'prospecting' | 'communication' | 'intelligence' | 'scheduling' | 'system' | null;
  provider: string | null;
  connected: boolean;
  enabled: boolean;
  paused: boolean;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  detail: string | null;
  health: 'online' | 'offline' | 'stale';
}

export interface OperationalWebhookDiagnostic {
  state: 'not_configured' | 'waiting_callback' | 'lead_not_matched' | 'unsupported_callback' | 'processing_failed' | 'homologated';
  registeredAt: string | null;
  lastEventAt: string | null;
  detail: string;
  testLead: { id: string; label: string; phoneSuffix: string } | null;
}

export interface OperationalStatus {
  mode: OperationalMode;
  modeLabel: string;
  updatedAt: string | null;
  runtimeUpdatedAt: string | null;
  killSwitch: boolean;
  productionReady: boolean;
  checks: OperationalCheck[];
  webhookDiagnostic: OperationalWebhookDiagnostic;
  integrations: OperationalIntegration[];
}

export interface OperationalEvent {
  id: string;
  actor_name?: string;
  actor_type?: string;
  action?: string;
  detail?: string | null;
  occurredAt?: string | null;
  event?: string;
  status?: string;
  error_code?: string | null;
  error_message?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  provider?: string;
  event_type?: string;
  error?: string | null;
  processed_at?: string | null;
}

export interface OperationalDiagnostics {
  status: OperationalStatus;
  summary: { queuedJobs: number; failedJobs: number; openRiskEvents: number };
  audit: OperationalEvent[];
  runs: OperationalEvent[];
  inbound: OperationalEvent[];
  risks: Array<{ id: string; channel: string; risk_level: string; action: string; reason: string; created_at: string }>;
}

type OperationalAction = 'status' | 'set_kill_switch' | 'set_mode' | 'events' | 'configure_whatsapp_webhook' | 'activate_scheduler';

export interface OperationalSetupResult {
  message: string;
  status: OperationalStatus;
}

async function invoke<T>(action: OperationalAction, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('operational-diagnostics', { body: { action, ...payload } });
  if (error || !data?.ok) throw new Error(data?.erro ?? await detalheDoErroDeFuncao(error));
  return data as T;
}

export async function loadOperationalStatus(): Promise<OperationalStatus> {
  return (await invoke<{ status: OperationalStatus }>('status')).status;
}

export async function setOperationalKillSwitch(enabled: boolean): Promise<OperationalStatus> {
  return (await invoke<{ status: OperationalStatus }>('set_kill_switch', { enabled })).status;
}

export async function setOperationalMode(mode: OperationalMode): Promise<OperationalStatus> {
  return (await invoke<{ status: OperationalStatus }>('set_mode', { mode })).status;
}

export async function loadOperationalDiagnostics(): Promise<OperationalDiagnostics> {
  return invoke<OperationalDiagnostics>('events');
}

export async function configureWhatsAppInbound(): Promise<OperationalSetupResult> {
  return invoke<OperationalSetupResult>('configure_whatsapp_webhook');
}

export async function activateServerScheduler(): Promise<OperationalSetupResult> {
  return invoke<OperationalSetupResult>('activate_scheduler');
}
