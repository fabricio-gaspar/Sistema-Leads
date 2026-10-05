import { describe, expect, it } from 'vitest';
import { limitarBuscaManual } from './buscaManual';
import { leadsPreviewInicial } from '@/mocks/enriquecimentoData';
import { fontesApiProspeccao, fontesAtivas, normalizarMetricasPorFonte } from '@/hooks/useFontesStore';
import { fontesLeads } from '@/mocks/fontesData';

describe('limitarBuscaManual', () => {
  const filtrosBase = { fonte: 'Receita Federal', estado: '', cidade: '', cargo: '', exigeSite: null, exigeWhatsApp: null, exigeEmail: null };

  it('nunca retorna mais resultados que o volume máximo solicitado', () => {
    expect(limitarBuscaManual(leadsPreviewInicial, { ...filtrosBase, volumeMaximo: 1 })).toHaveLength(1);
  });

  it('usa a fonte selecionada e os filtros da busca', () => {
    const resultado = limitarBuscaManual(leadsPreviewInicial, { ...filtrosBase, estado: 'SP', cidade: 'São Paulo', cargo: 'Diretor', exigeSite: true, volumeMaximo: 10 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({ fonte: 'Receita Federal', cargo: 'Diretor' });
  });

  it('remove fontes inativas da seleção e mantém métricas individuais por fonte', () => {
    const fontes = normalizarMetricasPorFonte(fontesLeads.map((fonte) => ({ ...fonte, ultimaSincronizacao: '2026-08-17 14:15', leadsImportados: 856, erros: 3 })));
    expect(fontesAtivas(fontes).map((fonte) => fonte.id)).not.toContain('f-4');
    expect(fontes.find((fonte) => fonte.id === 'f-1')).toMatchObject({ leadsImportados: 1240, erros: 12 });
    expect(fontes.find((fonte) => fonte.id === 'f-3')).toMatchObject({ leadsImportados: 432, erros: 8 });
  });

  it('só disponibiliza uma API depois de ela estar validada e ativa no backend', () => {
    const fontes = fontesLeads.map((fonte) => ({ ...fonte, status: 'pendente', connectionStatus: 'configured' }));
    fontes[2] = { ...fontes[2], status: 'ativo', connectionStatus: 'connected' };

    expect(fontesAtivas(fontes).map((fonte) => fonte.sourceKey)).toEqual(['apify']);
  });

  it('expõe no seletor somente APIs de prospecção suportadas e ativas', () => {
    const fontes = fontesLeads.map((fonte) => ({ ...fonte, status: 'ativo', connectionStatus: 'connected' }));
    const disponiveis = fontesAtivas(fontesApiProspeccao(fontes));

    expect(disponiveis.map((fonte) => fonte.sourceKey)).toEqual(['google_places', 'apify']);
    expect(disponiveis.map((fonte) => fonte.sourceKey)).not.toContain('ai');
    expect(disponiveis.map((fonte) => fonte.sourceKey)).not.toContain('csv');
  });
});
