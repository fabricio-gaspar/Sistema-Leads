import { supabase } from '@/lib/supabase';

export interface OperationalAutomationResult {
  timeout_runs: number;
  sent_jobs: number;
  failed_jobs: number;
  failed_count: number;
  pause_recommended: boolean;
}

export async function runOperationalAutomations(): Promise<OperationalAutomationResult> {
  const { data, error } = await supabase.functions.invoke('automation-worker', { body: { run: 'all' } });
  if (error) throw new Error('automation_worker_unavailable');
  return data as OperationalAutomationResult;
}
