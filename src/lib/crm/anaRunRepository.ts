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
  skipped?: boolean;
  reason?: string;
  status_canal?: 'enfileirado' | 'rascunho_para_aprovacao' | 'pendente_canal' | 'canal_nao_permitido' | 'bloqueado';
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

export async function runAna(input: { event: AnaRunEvent; leadId: string; modo: 'IA' | 'HUMANO'; contexto?: Record<string, unknown>; requestId?: string }): Promise<AnaRunResult> {
  const requestId = input.requestId || (input.event === 'lead.created'
    ? `lead-created:${input.leadId}`
    : crypto.randomUUID());
  const { data, error } = await supabase.functions.invoke('ana-run', {
    body: { event: input.event, lead_id: input.leadId, modo: input.modo.toLowerCase(), contexto: input.contexto ?? {}, request_id: requestId },
  });
  if (error) {
    const response = (error as { context?: Response }).context;
    let detail = 'ana_run_unavailable';
    if (response) {
      try {
        const body = await response.clone().json() as { erro?: string; error?: string };
        detail = body.erro ?? body.error ?? detail;
      } catch { /* mantém o código de indisponibilidade somente se não houver resposta legível */ }
    }
    throw new Error(detail);
  }
  return data as AnaRunResult;
}

export async function loadAgentRuns(leadId: string): Promise<AgentRunTimelineItem[]> {
  const { data, error } = await supabase.from('agent_runs')
    .select('id,event,modo,status,result,error_message,created_at')
    .eq('lead_id', leadId).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []) as AgentRunTimelineItem[];
}
