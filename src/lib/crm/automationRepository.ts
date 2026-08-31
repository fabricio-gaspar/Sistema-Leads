import { supabase } from '@/lib/supabase';

export async function runOperationalAutomations(): Promise<{ timeout_runs: number }> {
  const { data, error } = await supabase.functions.invoke('automation-worker', { body: { run: 'timeouts' } });
  if (error) throw new Error('automation_worker_unavailable');
  return data as { timeout_runs: number };
}
