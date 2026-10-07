import { createBackendStore } from '@/lib/backendStore';
import type { ConfiguracaoRuntime } from '@/lib/tipos';
import { automacaoConfig } from '@/mocks/automacaoData';
import { horariosAtendimento } from '@/mocks/horariosData';
import { regrasComerciais } from '@/mocks/comercialData';

const STORAGE_KEY = 'leadai_config_runtime_v1';

const configInicial: ConfiguracaoRuntime = {
  killSwitchGlobal: automacaoConfig.killSwitchGlobal,
  killSwitchUltimoMotivo: automacaoConfig.killSwitchUltimoMotivo,
  primeiroFollowup: { ...automacaoConfig.primeiroFollowup },
  segundoFollowup: { ...automacaoConfig.segundoFollowup },
  timeout: { ...automacaoConfig.timeout },
  motivoPerdaTimeout: automacaoConfig.motivoPerdaTimeout,
  pausarAoResponder: automacaoConfig.pausarAoResponder,
  cancelarEtapaFinal: automacaoConfig.cancelarEtapaFinal,
  slaPrimeiroContato: { ...automacaoConfig.slaPrimeiroContato },
  notificarResponsavel: automacaoConfig.notificarResponsavel,
  notificarGestor: automacaoConfig.notificarGestor,
  escalarAposSla: automacaoConfig.escalarAposSla,
  handoffGatilhos: automacaoConfig.handoffGatilhos.map((g) => ({ ...g })),
  limiteConfianca: automacaoConfig.limiteConfianca,
  scoreMinimoHandoff: automacaoConfig.scoreMinimoHandoff,
  pausarAnaHandoff: automacaoConfig.pausarAnaHandoff,
  criarTarefaHandoff: automacaoConfig.criarTarefaHandoff,
  limiteDiarioPorContato: automacaoConfig.limiteDiarioPorContato,
  limiteDiarioTotal: automacaoConfig.limiteDiarioTotal,
  aguardarResposta: automacaoConfig.aguardarResposta,
  horarioComercial: automacaoConfig.horarioComercial,
  diasSemana: horariosAtendimento.diasSemana.map((d) => ({ ...d })),
  feriados: horariosAtendimento.feriados.map((f) => ({ ...f })),
  descontoMaximoPadrao: regrasComerciais.descontoMaximoPadrao,
  descontoExigeAprovacaoAcima: regrasComerciais.descontoExigeAprovacaoAcima,
  anaPodeAplicarDesconto: regrasComerciais.anaPodeAplicarDesconto,
  anaDescontoMaximo: regrasComerciais.anaDescontoMaximo,
  modoExecucao: 'DEMO',
  estadosModulos: {
    whatsapp: { estado: 'DESLIGADO', temCredenciais: false },
    email: { estado: 'DESLIGADO', temCredenciais: false },
    agendamento: { estado: 'DESLIGADO', temCredenciais: false },
    ia: { estado: 'DESLIGADO', temCredenciais: false },
  },
  contatosTeste: [],
  provedorWhatsapp: 'zapi',
  alertaRiscoBloqueio: 70,
};

const store = createBackendStore<ConfiguracaoRuntime>('configuracao_runtime',STORAGE_KEY, configInicial);

// Defaults are merged on read. Importing this module never writes operational data.

export function useConfiguracaoStore(): {
  config: ConfiguracaoRuntime;
  atualizar: (patch: Partial<ConfiguracaoRuntime>) => void;
} {
  const config = store.useStore();
  const setStore = store.bindSet();

  const atualizar = (patch: Partial<ConfiguracaoRuntime>) => {
    setStore((prev) => ({ ...prev, ...patch }));
  };

  return { config, atualizar };
}

export function getConfigSnapshot(): ConfiguracaoRuntime {
  return store.get();
}
