import { supabase } from '@/lib/supabase';
import { sessionContext } from '@/lib/sessionContext';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

export type OperationalMode = 'setup' | 'real';

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
  telemetry: {
    creditsRemaining: number | null;
    expiresAt: string | null;
    available: boolean;
  };
}

export interface OperationalSource {
  key: string;
  label: string;
  enabled: boolean;
  mode: string | null;
  connectionStatus: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  health: 'online' | 'offline' | 'stale';
}

export interface WhatsappMonitoring {
  updatedAt: string;
  state: 'stable' | 'attention' | 'paused' | 'unavailable';
  detail: string;
  sentLastHour: number;
  sentLast24Hours: number;
  inboundLastHour: number;
  inboundLast24Hours: number;
  deliveredLast24Hours: number;
  failedLast24Hours: number;
  openRiskEvents: number;
}

export interface OperationalWebhookDiagnostic {
  state: 'not_configured' | 'credentials_changed' | 'waiting_callback' | 'lead_not_matched' | 'unsupported_callback' | 'processing_failed' | 'homologated';
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
  sources: OperationalSource[];
  whatsappMonitoring: WhatsappMonitoring;
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
  run_at?: string | null;
  scheduled_for?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  replied_at?: string | null;
  failed_at?: string | null;
  channel?: string;
  attempt?: number;
  lead_id?: string;
}

export interface OperationalDiagnostics {
  status: OperationalStatus;
  summary: { queuedJobs: number; failedJobs: number; reconciliationJobs: number; openRiskEvents: number };
  audit: OperationalEvent[];
  runs: OperationalEvent[];
  inbound: OperationalEvent[];
  jobs: OperationalEvent[];
  outreach: OperationalEvent[];
  risks: Array<{ id: string; channel: string; risk_level: string; action: string; reason: string; created_at: string }>;
}

type OperationalAction = 'status' | 'set_kill_switch' | 'activate_real' | 'events' | 'configure_whatsapp_webhook' | 'activate_scheduler';

const READ_ACTION_TIMEOUT_MS = 8_000;
const readRequests = new Map<OperationalAction, Promise<unknown>>();
sessionContext.subscribe(() => readRequests.clear());

export interface OperationalSetupResult {
  message: string;
  status: OperationalStatus;
}

export interface OperationalActivationResult extends OperationalSetupResult {
  activated: boolean;
  actions: string[];
  remaining: OperationalCheck[];
}

function withDeadline<T>(request: Promise<T>, timeoutMs: number, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(code)), timeoutMs);
    request.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (error) => { clearTimeout(timeout); reject(error); },
    );
  });
}

async function execute<T>(action: OperationalAction, payload: Record<string, unknown>): Promise<T> {
  const context = sessionContext.requireReady();
  const { data, error } = await supabase.functions.invoke('operational-diagnostics', { body: { action, ...payload } });
  sessionContext.assertCurrent(context);
  if (error || !data?.ok) throw new Error(data?.erro ?? await detalheDoErroDeFuncao(error));
  return data as T;
}

function invoke<T>(action: OperationalAction, payload: Record<string, unknown> = {}): Promise<T> {
  const isRead = action === 'status' || action === 'events';
  if (!isRead) return execute<T>(action, payload);

  const inFlight = readRequests.get(action) as Promise<T> | undefined;
  if (inFlight) return inFlight;

  const request = withDeadline(execute<T>(action, payload), READ_ACTION_TIMEOUT_MS, 'operational_request_timeout');
  readRequests.set(action, request);
  const clear = () => {
    if (readRequests.get(action) === request) readRequests.delete(action);
  };
  request.then(clear, clear);
  return request;
}

export async function loadOperationalStatus(): Promise<OperationalStatus> {
  return (await invoke<{ status: OperationalStatus }>('status')).status;
}

export async function setOperationalKillSwitch(enabled: boolean): Promise<OperationalStatus> {
  return (await invoke<{ status: OperationalStatus }>('set_kill_switch', { enabled })).status;
}

export async function activateRealEnvironment(): Promise<OperationalActivationResult> {
  return invoke<OperationalActivationResult>('activate_real');
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
