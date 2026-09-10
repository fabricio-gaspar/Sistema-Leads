import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

export interface HumanMessageResult {
  queued: boolean;
  detail: string;
  delivery: 'sent' | 'queued';
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
      operational_mode_protected: 'O Ambiente Real ainda está em preparação. Salve e valide a Z-API antes de enviar mensagens.',
      whatsapp_integration_not_ready: 'O WhatsApp não está validado para saída. Nenhuma mensagem foi enviada.',
      lead_opted_out: 'Este contato está bloqueado por opt-out. Nenhuma mensagem foi enviada.',
      whatsapp_paused_by_risk_policy: 'O WhatsApp foi pausado por uma política de risco. Nenhuma mensagem foi enviada.',
    };
    throw new Error(messages[detail] || `A mensagem não foi enfileirada: ${detail || 'falha de validação'}.`);
  }
  const jobId = typeof data.id === 'string' ? data.id : '';
  if (!jobId) return { queued: true, delivery: 'queued', detail: data.detalhe || 'Mensagem registrada. O worker seguro fará o envio.' };

  // A mensagem humana tenta ser despachada imediatamente. Se houver uma falha
  // transitória, o job permanece disponível ao worker server-side; assim o
  // operador não depende de esperar o próximo ciclo para saber se a Z-API
  // aceitou a mensagem.
  const immediate = await supabase.functions.invoke('automation-worker', {
    body: { run: 'outreach', job_id: jobId },
  });
  const outcome = Array.isArray(immediate.data?.job_results)
    ? immediate.data.job_results.find((item: { id?: unknown }) => item.id === jobId) as { status?: unknown; error?: unknown } | undefined
    : undefined;
  if (outcome?.status === 'sent') {
    return { queued: true, delivery: 'sent', detail: 'Mensagem aceita pela Z-API e registrada no histórico do lead.' };
  }
  if (outcome?.status === 'failed') {
    const code = typeof outcome.error === 'string' ? outcome.error : 'dispatch_failed';
    const messages: Record<string, string> = {
      recipient_invalid: 'O WhatsApp deste lead é inválido. Corrija o número antes de tentar novamente.',
      recipient_mismatch: 'O número salvo no lead não corresponde ao destinatário da conversa.',
      channel_not_ready: 'A Z-API não está pronta para envio. Valide o canal em Configurações.',
      provider_http_400: 'A Z-API recusou a mensagem. Confira o número do lead e tente novamente.',
      contact_suppressed: 'Este contato está protegido por opt-out. Nenhuma mensagem foi enviada.',
    };
    throw new Error(messages[code] || `A mensagem foi registrada, mas a Z-API não a aceitou: ${code}.`);
  }
  return { queued: true, delivery: 'queued', detail: 'Mensagem registrada na fila segura. O worker server-side continuará o envio automaticamente.' };
}
