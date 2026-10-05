import { describe, expect, it } from 'vitest';
import { findPotentialLeadDuplicates, leadHasContact, leadMatchesPortfolioQuery, normalizePortfolioPhone } from './leadPortfolio';
import type { Lead } from '@/mocks/leadsData';

const lead = (patch: Partial<Lead> = {}): Lead => ({
  id: 'lead-1', nome: 'João da Silva', empresa: 'Soluções Vedações', cnpj: '', email: 'joao@vedacoes.com.br', telefone: '(11) 99999-0000', whatsapp: '', segmento: 'Indústria', cidade: 'São Paulo', estado: 'SP', porte: 'Médio', score: 81, temperatura: 'Quente', etapa: 'Novo', origem: 'Manual', responsavel: 'Ana (IA)', tags: [], ultimaInteracao: '—', criadoEm: '2026-09-28', ...patch,
});

describe('leadPortfolio', () => {
  it('normaliza telefone, acentos e e-mail na pesquisa da carteira', () => {
    const value = lead({ sourceUrl: 'https://www.vedacoes.com.br/catalogo' });
    expect(normalizePortfolioPhone('(11) 99999-0000')).toBe('11999990000');
    expect(leadMatchesPortfolioQuery(value, 'joao da silva')).toBe(true);
    expect(leadMatchesPortfolioQuery(value, '11999990000')).toBe(true);
    expect(leadMatchesPortfolioQuery(value, 'JOAO@VEDACOES.COM.BR')).toBe(true);
    expect(leadMatchesPortfolioQuery(value, 'vedacoes.com.br')).toBe(true);
  });

  it('não interpreta um telefone como contato de WhatsApp confirmado', () => {
    expect(leadHasContact(lead({ email: '', whatsapp: '', telefone: '(11) 3333-2222' }))).toBe(true);
    expect(lead({ email: '', whatsapp: '', telefone: '(11) 3333-2222' }).whatsapp).toBe('');
  });

  it('encontra possíveis duplicidades sem tomar uma decisão automática', () => {
    const original = lead();
    const candidate = lead({ id: 'lead-2', email: '', telefone: '', whatsapp: '', empresa: 'Solucoes Vedacoes', cidade: 'São Paulo', estado: 'SP' });
    const duplicates = findPotentialLeadDuplicates(candidate, [original]);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]?.reasons).toContain('company-location');
  });
});
