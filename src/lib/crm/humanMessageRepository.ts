import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

export interface HumanMessageResult {
  queued: boolean;
  detail: string;
  delivery: 'accepted' | 'queued' | 'failed' | 'reconciliation';
  messageId?: string;
}

export interface HumanMessageKnowledgeContent {
  itemId: string;
  presentationFormat: 'quick' | 'commercial' | 'technical' | 'link' | 'document';
  sendImage: boolean;
}

/**
 * Único caminho visual para uma mensagem manual sair da Central. O backend
 * registra o texto, aplica opt-out, modo protegido e saúde do canal, e só
 * então o coloca na fila. Esta função nunca envia diretamente do navegador.
 */
export async function queueHumanMessage(input: {
  leadId: string;
  /** A proposal is attached only when the operator explicitly prepared it in the Central. */
  proposalId?: string | null;
  channel: 'whatsapp' | 'email' | 'instagram';
  recipient: string;
  text: string;
  requestId: string;
  provider?: 'zapi' | 'meta_cloud' | 'wa_akg' | null;
  knowledgeContent?: HumanMessageKnowledgeContent | null;
}): Promise<HumanMessageResult> {
  if (input.channel !== 'whatsapp') {
    throw new Error('Este canal ainda não possui uma fila de saída homologada. A mensagem não foi registrada como enviada.');
  }
  if (input.provider === 'meta_cloud') {
    if (input.knowledgeContent) {
      throw new Error('O conteúdo comercial ainda não foi sincronizado para esta conta Meta. Envie o texto ou use a conta Z-API homologada.');
    }
    const { data, error } = await supabase.functions.invoke('meta-whatsapp-messages', {
      body: {
        lead_id: input.leadId,
        recipient: input.recipient,
        text: input.text,
        request_id: input.requestId,
        message_kind: 'text',
      },
    });
    if (error || !data?.ok) {
      const detail = data?.erro || await detalheDoErroDeFuncao(error);
      const messages: Record<string, string> = {
        meta_coexistence_feature_disabled: 'A integração Meta está instalada, mas continua desligada até a homologação.',
        meta_send_disabled: 'O envio pela Meta ainda está bloqueado pelo gate de segurança.',
        meta_template_required_outside_service_window: 'A janela de atendimento de 24 horas encerrou. Selecione um template Meta aprovado.',
        meta_template_not_approved: 'O template informado não está aprovado ou sincronizado para este número.',
        meta_account_not_ready: 'A conta Meta ainda não está pronta para envio.',
        recipient_mismatch: 'O destinatário não corresponde ao WhatsApp registrado neste lead.',
      };
      throw new Error(messages[detail] || `A mensagem Meta não foi enfileirada: ${detail || 'falha de validação'}.`);
    }
    const immediateResults = Array.isArray(data.immediate?.results) ? data.immediate.results : [];
    const immediate = immediateResults.find((item: { id?: unknown }) => item.id === data.id) as { status?: unknown; error?: unknown } | undefined;
    if (immediate?.status === 'sent') {
      return { queued: true, delivery: 'accepted', detail: 'Mensagem aceita pela Meta. Entrega e leitura aguardam o webhook oficial.', messageId: data.message_id };
    }
    if (immediate?.status === 'dead_letter') {
      return { queued: false, delivery: 'failed', detail: `A Meta não aceitou a mensagem: ${String(immediate.error || 'dispatch_failed')}.`, messageId: data.message_id };
    }
    return { queued: true, delivery: 'queued', detail: 'Mensagem registrada na fila Meta segura.', messageId: data.message_id };
  }

  const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
    body: {
      leadId: input.leadId, para: input.recipient, texto: input.text, request_id: input.requestId, modo: 'humano', provedor: 'central_atendimento',
      ...(input.proposalId ? { proposal_id: input.proposalId } : {}),
      ...(input.knowledgeContent ? {
        content_item_id: input.knowledgeContent.itemId,
        content_presentation_format: input.knowledgeContent.presentationFormat,
        content_send_image: input.knowledgeContent.sendImage,
      } : {}),
    },
  });
  if (error || !data?.ok) {
    const detail = data?.erro || await detalheDoErroDeFuncao(error);
    const messages: Record<string, string> = {
      operational_mode_protected: 'O Ambiente Real ainda está em preparação. Salve e valide o canal antes de enviar mensagens.',
      whatsapp_integration_not_ready: 'O WhatsApp não está validado para saída. Nenhuma mensagem foi enviada.',
      lead_opted_out: 'Este contato está bloqueado por opt-out. Nenhuma mensagem foi enviada.',
      whatsapp_paused_by_risk_policy: 'O WhatsApp foi pausado por uma política de risco. Nenhuma mensagem foi enviada.',
      proposal_not_found_or_unlinked: 'A proposta não está vinculada a este lead. Nenhuma mensagem foi enfileirada.',
      proposal_not_ready_for_delivery: 'A proposta ainda não está liberada para envio. Revise a aprovação antes de tentar novamente.',
    };
    throw new Error(messages[detail] || `A mensagem não foi enfileirada: ${detail || 'falha de validação'}.`);
  }
  const jobId = typeof data.id === 'string' ? data.id : '';
  const existingStatus = typeof data.job_status === 'string' ? data.job_status : '';
  const messageId = typeof data.message_id === 'string' ? data.message_id : undefined;
  if (existingStatus === 'processed') {
    return { queued: true, delivery: 'accepted', detail: 'Esta mesma solicitação já foi aceita pelo provedor; nenhum reenvio foi feito.', messageId };
  }
  if (existingStatus === 'reconciliation_required') {
    return { queued: true, delivery: 'reconciliation', detail: 'A tentativa já chegou ao provedor, mas o resultado ainda precisa de reconciliação. Não repita o envio.', messageId };
  }
  if (['failed', 'cancelled'].includes(existingStatus)) {
    return { queued: false, delivery: 'failed', detail: 'Esta solicitação terminou sem envio confirmado. Revise o diagnóstico antes de iniciar uma nova tentativa.', messageId };
  }
  if (!jobId) return { queued: true, delivery: 'queued', detail: data.detalhe || 'Mensagem registrada. O worker seguro fará o envio.', messageId };

  // A mensagem humana tenta ser despachada imediatamente. Se houver uma falha
  // transitória, o job permanece disponível ao worker server-side; assim o
  // operador não depende de esperar o próximo ciclo para saber se o provedor
  // aceitou a mensagem.
  const immediate = await supabase.functions.invoke('automation-worker', {
    body: { run: 'outreach', job_id: jobId },
  });
  const outcome = Array.isArray(immediate.data?.job_results)
    ? immediate.data.job_results.find((item: { id?: unknown }) => item.id === jobId) as { status?: unknown; error?: unknown } | undefined
    : undefined;
  if (outcome?.status === 'sent') {
    return { queued: true, delivery: 'accepted', detail: 'Mensagem aceita pelo provedor e registrada no histórico do lead. Entrega e leitura aguardam o callback do canal.', messageId };
  }
  if (outcome?.status === 'failed') {
    const code = typeof outcome.error === 'string' ? outcome.error : 'dispatch_failed';
    if (code === 'provider_accepted_reconciliation_required' || code === 'delivery_unknown_reconciliation_required') {
      return { queued: true, delivery: 'reconciliation', detail: 'O provedor pode ter aceitado a mensagem, mas a confirmação local não terminou. Não reenvie; consulte o diagnóstico.', messageId };
    }
    const messages: Record<string, string> = {
      recipient_invalid: 'O WhatsApp deste lead é inválido. Corrija o número antes de tentar novamente.',
      recipient_mismatch: 'O número salvo no lead não corresponde ao destinatário da conversa.',
      channel_not_ready: 'O canal de WhatsApp não está pronto para envio. Valide-o em Configurações.',
      provider_http_400: 'O provedor recusou a mensagem. Confira o número do lead e tente novamente.',
      contact_suppressed: 'Este contato está protegido por opt-out. Nenhuma mensagem foi enviada.',
      catalog_media_not_available: 'A imagem deste conteúdo não está mais disponível. Revise o item antes de enviar novamente.',
      catalog_media_changed_before_dispatch: 'A imagem do conteúdo mudou antes do envio. Revise o item e prepare a mensagem novamente.',
      catalog_media_url_not_allowed: 'A imagem cadastrada não é uma URL pública segura. Corrija o conteúdo antes de enviar.',
    };
    return { queued: false, delivery: 'failed', detail: messages[code] || `A mensagem foi registrada e falhou antes de confirmação do provedor: ${code}.`, messageId };
  }
  return { queued: true, delivery: 'queued', detail: 'Mensagem registrada na fila segura. O worker server-side continuará o envio automaticamente.', messageId };
}
