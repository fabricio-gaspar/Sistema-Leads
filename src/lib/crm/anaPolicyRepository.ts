import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

export type AnaModuleKey = 'company' | 'offer' | 'conversation' | 'commercial' | 'cadence' | 'channels';
export interface AnaPolicyModule { enabled: boolean; reviewed: boolean }
export interface AnaPolicy {
  modules: Record<AnaModuleKey, AnaPolicyModule>;
  limits: { channels: string[]; perLead: number; humanApproval: boolean; stopOnOptOut: boolean };
  [key: string]: unknown;
}
export interface AnaPolicyState {
  agentId: string | null;
  masterEnabled: boolean;
  canUseIa: boolean;
  policy: AnaPolicy;
  published: { id: string; number: number; publishedAt: string | null; status: string } | null;
  draft: { id: string; number: number; createdAt: string } | null;
  audit: Array<{ id: string; action: string; detail: string | null; actor_name: string | null; created_at: string; event_data?: Record<string, unknown> }>;
}

async function invoke<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('ana-policy', { body: { action, ...payload } });
  if (error || !data?.ok) throw new Error(data?.error || await detalheDoErroDeFuncao(error));
  return data as T;
}

export async function loadAnaPolicy(): Promise<AnaPolicyState> {
  return (await invoke<{ state: AnaPolicyState }>('get')).state;
}

export async function saveAnaPolicyDraft(policy: AnaPolicy): Promise<AnaPolicyState> {
  return (await invoke<{ state: AnaPolicyState }>('save_draft', { policy })).state;
}

export async function publishAnaPolicy(policy: AnaPolicy): Promise<AnaPolicyState> {
  return (await invoke<{ state: AnaPolicyState }>('publish', { policy })).state;
}

export async function setAnaMasterEnabled(enabled: boolean): Promise<AnaPolicyState> {
  return (await invoke<{ state: AnaPolicyState }>('set_master', { enabled })).state;
}

export async function discardAnaPolicyDraft(): Promise<AnaPolicyState> {
  return (await invoke<{ state: AnaPolicyState }>('discard')).state;
}

export async function simulateAnaPolicy(question: string): Promise<{ simulation: { question: string; response: string; modules: string[]; sources: string[]; rules: string[]; decision: string }; state: AnaPolicyState }> {
  return invoke('simulate', { question });
}
