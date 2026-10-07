import { supabase } from '@/lib/supabase';
import { sessionContext } from '@/lib/sessionContext';

export type AnaOperationMode = 'simulation' | 'supervised' | 'automatic';
export type AnaInitialAssignmentMode = 'ana' | 'human' | 'team';
export type AnaHandoffStage = 'novo' | 'apresentado' | 'qualificando' | 'reuniao' | 'orcamento';

export interface AnaOperationSettings {
  enabled: boolean;
  mode: AnaOperationMode;
  name: string;
  timezone: string;
  weekdays: number[];
  runTime: string;
  dailyLeadLimit: number;
  dailyCap: number;
  monthlyCap: number;
  minimumFitScore: number;
  assignmentStrategy: 'owner' | 'round_robin' | 'existing_owner';
  initialAssignmentMode: AnaInitialAssignmentMode;
  initialAssigneeUserId: string | null;
  teamMemberIds: string[];
  handoffStage: AnaHandoffStage | null;
  handoffAssigneeUserId: string | null;
  handoffNotifyWhatsapp: boolean;
  city: string;
  regions: string[];
  segments: string[];
  keywords: string[];
  requireWebsite: boolean;
  requireWhatsapp: boolean;
  requireEmail: boolean;
  paidProspectingApproved: boolean;
  notifyImmediate: boolean;
  notifyProgress: boolean;
  digestEnabled: boolean;
  digestTime: string;
}

export interface AnaOperationRun {
  id: string;
  status: 'queued' | 'running' | 'awaiting_approval' | 'simulated' | 'completed' | 'failed' | 'cancelled';
  operation_mode: AnaOperationMode;
  created_at: string;
  candidate_count: number;
  approved_count: number;
  imported_count: number;
  error_code?: string | null;
  result?: Record<string, unknown>;
}

export interface AnaOperationReadiness {
  checks: Record<string, boolean>;
  automaticReady: boolean;
}

export interface AnaOperationSnapshot {
  company: { ana_operation_enabled?: boolean; ana_operation_mode?: AnaOperationMode } | null;
  schedule: Record<string, unknown> | null;
  runs: AnaOperationRun[];
  preference: Record<string, unknown> | null;
  readiness: AnaOperationReadiness;
}

export interface AnaAutomaticToggleResult {
  enabled: boolean;
  mode: 'automatic';
  schedule_id: string;
  next_run_at: string | null;
  cancelled_runs: number;
}

async function invoke<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const context = sessionContext.requireReady();
  const { data, error } = await supabase.functions.invoke('ana-operations', { body: { action, ...payload } });
  sessionContext.assertCurrent(context);
  if (error || !data?.ok) {
    let code = typeof data?.error === 'string' ? data.error : '';
    const response = (error as { context?: Response } | null)?.context;
    if (!code && response && typeof response.clone === 'function') {
      try { const body = await response.clone().json() as { error?: unknown }; if (typeof body.error === 'string') code = body.error; }
      catch { /* Keep transport uncertainty when no structured server result exists. */ }
    }
    throw new Error(code || error?.message || 'ana_operation_request_failed');
  }
  return data as T;
}

export const loadAnaOperation = () => invoke<AnaOperationSnapshot & { ok: true }>('get');
export const saveAnaOperation = (settings: AnaOperationSettings) => invoke<AnaOperationSnapshot & { ok: true }>('save', { settings });
export const setAnaAutomaticOperation = (enabled: boolean) => invoke<{ ok: true; state: AnaAutomaticToggleResult; readiness: AnaOperationReadiness }>('set_automatic', { enabled });
export const runAnaOperationNow = () => invoke<{ ok: true; run: AnaOperationRun }>('run_now');
export const simulateAnaOperation = () => invoke<{ ok: true; run: AnaOperationRun }>('simulate');
export const approveAnaOperationRun = (runId: string) => invoke<{ ok: true; run: AnaOperationRun }>('approve_run', { runId });
