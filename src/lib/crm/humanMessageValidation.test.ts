import { describe, expect, it } from 'vitest';
import { validateHumanMessage } from './humanMessageValidation';

describe('validateHumanMessage', () => {
  const valid = { text: 'Olá', isInternalNote: false, hasLead: true, channel: 'whatsapp' as const, recipient: '5511999999999' };

  it('blocks a blank message before a provider request exists', () => {
    expect(validateHumanMessage({ ...valid, text: '   ' })).toEqual(expect.objectContaining({ ok: false, message: 'Digite uma mensagem antes de enviar.' }));
  });

  it('requires an operational WhatsApp recipient for an external message', () => {
    expect(validateHumanMessage({ ...valid, recipient: '' })).toEqual(expect.objectContaining({ ok: false }));
  });

  it('allows an internal note without a recipient', () => {
    expect(validateHumanMessage({ ...valid, isInternalNote: true, recipient: '' })).toEqual({ ok: true });
  });
});
