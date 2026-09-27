import { supabase } from '@/lib/supabase';

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
  const { data, error } = await supabase.functions.invoke('ana-operations', { body: { action, ...payload } });
  if (error || !data?.ok) throw new Error(data?.error || error?.message || 'ana_operation_request_failed');
  return data as T;
}

export const loadAnaOperation = () => invoke<AnaOperationSnapshot & { ok: true }>('get');
export const saveAnaOperation = (settings: AnaOperationSettings) => invoke<AnaOperationSnapshot & { ok: true }>('save', { settings });
export const setAnaAutomaticOperation = (enabled: boolean) => invoke<{ ok: true; state: AnaAutomaticToggleResult; readiness: AnaOperationReadiness }>('set_automatic', { enabled });
export const runAnaOperationNow = () => invoke<{ ok: true; run: AnaOperationRun }>('run_now');
export const simulateAnaOperation = () => invoke<{ ok: true; run: AnaOperationRun }>('simulate');
export const approveAnaOperationRun = (runId: string) => invoke<{ ok: true; run: AnaOperationRun }>('approve_run', { runId });
