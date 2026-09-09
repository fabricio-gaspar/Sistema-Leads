import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

export interface HumanMessageResult {
  queued: boolean;
  detail: string;
}

/**
 * Único caminho visual para uma mensagem manual sair da Central. O backend
 * registra o texto, aplica opt-out, modo protegido e saúde do canal, e só
 * então o coloca na fila. Esta função nunca envia diretamente do navegador.
 */
export async function queueHumanMessage(input: { leadId: string; channel: 'whatsapp' | 'email' | 'instagram'; recipient: string; text: string }): Promise<HumanMessageResult> {
  if (input.channel !== 'whatsapp') {
    throw new Error('Este canal ainda não possui uma fila de saída homologada. A mensagem não foi registrada como enviada.');
  }
  const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
    body: { leadId: input.leadId, para: input.recipient, texto: input.text, modo: 'humano', provedor: 'central_atendimento' },
  });
  if (error || !data?.ok) {
    const detail = data?.erro || await detalheDoErroDeFuncao(error);
    const messages: Record<string, string> = {
      operational_mode_protected: 'O sistema está em modo protegido. Nenhuma mensagem foi enviada ou enfileirada.',
      whatsapp_integration_not_ready: 'O WhatsApp não está validado para saída. Nenhuma mensagem foi enviada.',
      lead_opted_out: 'Este contato está bloqueado por opt-out. Nenhuma mensagem foi enviada.',
      whatsapp_paused_by_risk_policy: 'O WhatsApp foi pausado por uma política de risco. Nenhuma mensagem foi enviada.',
    };
    throw new Error(messages[detail] || `A mensagem não foi enfileirada: ${detail || 'falha de validação'}.`);
  }
  return { queued: true, detail: data.detalhe || 'Mensagem registrada e colocada na fila segura.' };
}
