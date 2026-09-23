export type HumanMessageChannel = 'whatsapp' | 'email' | 'instagram';

export type HumanMessageValidationInput = {
  text: string;
  isInternalNote: boolean;
  hasLead: boolean;
  channel: HumanMessageChannel;
  recipient: string | null | undefined;
};

export type HumanMessageValidation =
  | { ok: true }
  | { ok: false; message: string };

export function validateHumanMessage(input: HumanMessageValidationInput): HumanMessageValidation {
  if (!input.text.trim()) return { ok: false, message: 'Digite uma mensagem antes de enviar.' };
  if (input.isInternalNote) return { ok: true };
  if (!input.hasLead) return { ok: false, message: 'Esta conversa não possui um lead operacional vinculado. A mensagem não foi enviada.' };
  if (input.channel !== 'whatsapp') return { ok: false, message: 'Este canal ainda não possui uma fila de saída homologada. Nenhuma mensagem foi enviada.' };

  const recipient = (input.recipient ?? '').replace(/\D/g, '');
  if (recipient.length < 10 || recipient.length > 15) {
    return { ok: false, message: 'O WhatsApp validado deste lead não está disponível. Corrija o contato antes de enviar.' };
  }
  return { ok: true };
}
