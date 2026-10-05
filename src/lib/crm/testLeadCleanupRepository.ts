import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

export interface TestLeadCandidate {
  id: string;
  company: string;
  contact: string;
  phoneSuffix: string | null;
  reason: string;
  messageCount: number;
  jobCount: number;
  runCount: number;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('cleanup-test-leads', { body });
  if (error || !data?.ok) throw new Error(data?.erro ?? await detalheDoErroDeFuncao(error));
  return data as T;
}

export async function previewTestLeadCleanup(): Promise<TestLeadCandidate[]> {
  return (await invoke<{ candidates: TestLeadCandidate[] }>({ action: 'preview' })).candidates;
}

export async function purgeConfirmedTestLeads(leadIds: string[]): Promise<number> {
  return (await invoke<{ deletedCount: number }>({
    action: 'delete',
    leadIds,
    confirmation: 'LIMPAR TESTES',
  })).deletedCount;
}
