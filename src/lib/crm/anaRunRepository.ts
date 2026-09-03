import { supabase } from '@/lib/supabase';

export type AnaRunEvent = 'lead.created' | 'message.received' | 'stage.changed' | 'meeting.done' | 'timeout.48h' | 'manual.run';

export interface AnaRunResult {
  ok: boolean;
  run_id?: string;
  lead_id?: string;
  estagio_atual?: string;
  proximo_estagio?: string;
  outcome?: 'ganho' | 'perdido' | null;
  score?: number;
  mensagem_sugerida?: string;
  motivo?: string;
  precisa_humano?: boolean;
  status_canal?: 'enfileirado' | 'rascunho_para_aprovacao' | 'pendente_canal';
  erro?: string;
}

export interface AgentRunTimelineItem {
  id: string;
  event: string;
  modo: string;
  status: string;
  result: AnaRunResult;
  error_message: string | null;
  created_at: string;
}

export async function runAna(input: { event: AnaRunEvent; leadId: string; modo: 'IA' | 'HUMANO'; contexto?: Record<string, unknown> }): Promise<AnaRunResult> {
  const { data, error } = await supabase.functions.invoke('ana-run', {
    body: { event: input.event, lead_id: input.leadId, modo: input.modo.toLowerCase(), contexto: input.contexto ?? {} },
  });
  if (error) throw new Error('ana_run_unavailable');
  return data as AnaRunResult;
}

export async function loadAgentRuns(leadId: string): Promise<AgentRunTimelineItem[]> {
  const { data, error } = await supabase.from('agent_runs')
    .select('id,event,modo,status,result,error_message,created_at')
    .eq('lead_id', leadId).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []) as AgentRunTimelineItem[];
}
