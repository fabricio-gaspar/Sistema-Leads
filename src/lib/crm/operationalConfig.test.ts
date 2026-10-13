import { describe, expect, it } from 'vitest';
import { normalizeOperationalConfig } from './operationalConfig';
import type { ConfiguracaoRuntime } from '@/lib/tipos';

const baseConfig = (provider: ConfiguracaoRuntime['provedorWhatsapp']): ConfiguracaoRuntime => ({
  killSwitchGlobal: false,
  killSwitchUltimoMotivo: null,
  primeiroFollowup: { ativo: false, horas: 24 },
  segundoFollowup: { ativo: false, horas: 48 },
  timeout: { ativo: false, horas: 72 },
  motivoPerdaTimeout: 'Sem resposta',
  pausarAoResponder: true,
  cancelarEtapaFinal: true,
  slaPrimeiroContato: { ativo: false, horas: 2 },
  notificarResponsavel: true,
  notificarGestor: false,
  escalarAposSla: false,
  handoffGatilhos: [],
  limiteConfianca: 0.7,
  scoreMinimoHandoff: 50,
  pausarAnaHandoff: true,
  criarTarefaHandoff: true,
  limiteDiarioPorContato: 3,
  limiteDiarioTotal: 50,
  aguardarResposta: true,
  horarioComercial: false,
  diasSemana: [],
  feriados: [],
  descontoMaximoPadrao: 0,
  descontoExigeAprovacaoAcima: 0,
  anaPodeAplicarDesconto: false,
  anaDescontoMaximo: 0,
  modoExecucao: 'DEMO',
  estadosModulos: {
    whatsapp: { estado: 'DESLIGADO', temCredenciais: false },
    email: { estado: 'DESLIGADO', temCredenciais: false },
    agendamento: { estado: 'DESLIGADO', temCredenciais: false },
    ia: { estado: 'DESLIGADO', temCredenciais: false },
  },
  contatosTeste: [],
  provedorWhatsapp: provider,
  alertaRiscoBloqueio: 70,
});

describe('normalizeOperationalConfig', () => {
  it('preserva WA-AKG como transporte canônico', () => {
    const config = baseConfig('wa_akg');
    expect(normalizeOperationalConfig(config)).toBe(config);
  });

  it('converte valores legados sem apagar as demais regras', () => {
    const config = baseConfig('meta');
    const normalized = normalizeOperationalConfig(config);
    expect(normalized.provedorWhatsapp).toBe('wa_akg');
    expect(normalized.limiteDiarioTotal).toBe(config.limiteDiarioTotal);
  });
});
