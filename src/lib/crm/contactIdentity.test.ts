import { describe, expect, it } from 'vitest';
import { factualLeadCompany, factualLeadDisplayName, isPlaceholderContactName } from './contactIdentity';

describe('contact identity presentation', () => {
  it('uses the resolved name when the channel supplied one', () => {
    expect(factualLeadDisplayName({ nome: 'Vanessa', telefone: '11999999999', empresa: 'Wayflex' })).toBe('Vanessa');
    expect(factualLeadCompany({ nome: 'Vanessa', empresa: 'Wayflex' })).toBe('Wayflex');
  });

  it('uses a factual phone instead of a legacy anonymous placeholder', () => {
    const contact = { nome: 'Contato não identificado', whatsapp: '+55 11 99999-9999', empresa: 'Wayflex' };
    expect(factualLeadDisplayName(contact)).toBe('+55 11 99999-9999');
    expect(factualLeadCompany(contact, factualLeadDisplayName(contact))).toBe('Wayflex');
  });

  it('does not mistake a missing identity for a name', () => {
    expect(isPlaceholderContactName('Contato não informado')).toBe(true);
    expect(factualLeadDisplayName({ nome: 'Contato não informado' })).toBe('Contato sem nome');
  });
});
