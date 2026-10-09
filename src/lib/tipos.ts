// Tipos compartilhados do fluxo comercial do CRM WayFlex.
// Fonte única de enums/contratos usados por stores, motor e telas.

export type ModoAtendimento = 'IA' | 'HUMANO';

export type AutomacaoStatus =
  | 'ATIVA'
  | 'PAUSADA'
  | 'AGUARDANDO_HUMANO'
  | 'CONCLUIDA'
  | 'ERRO';

export type Intencao =
  | 'INTERESSE'
  | 'DUVIDA'
  | 'OBJECAO'
  | 'PRECO'
  | 'ORCAMENTO'
  | 'AGENDAMENTO'
  | 'NEGATIVO'
  | 'OPT_OUT'
  | 'NEUTRO';

export type Sentimento = 'POSITIVO' | 'NEUTRO' | 'NEGATIVO';

export type ProximaAcao =
  | 'RESPONDER'
  | 'QUALIFICAR'
  | 'CRIAR_ORCAMENTO'
  | 'AGENDAR'
  | 'TRANSFERIR_HUMANO'
  | 'FOLLOW_UP'
  | 'ENCERRAR';

export interface AnaliseMensagem {
  intencao: Intencao;
  sentimento: Sentimento;
  scoreInteresse: number;
  confianca: number;
  proximaAcao: ProximaAcao;
  etapaSugerida?: string;
  motivoTransferencia?: string;
}

// Horário livre oferecido pela Ana durante o agendamento na conversa.
export interface SlotHorario {
  data: string;
  horaInicio: string;
  horaFim: string;
  indice: number;
}

// Modo de execução global do sistema: em que "mundo" ele está rodando.
// DEMO = tudo simulado no navegador; SANDBOX = APIs reais com credenciais de
// teste; PRODUCAO = efeitos reais de verdade.
export type ModoExecucao = 'DEMO' | 'SANDBOX' | 'PRODUCAO';

// Estágio individual de cada módulo/integração (WhatsApp, E-mail, Agendamento...).
export type EstadoModulo = 'DESLIGADO' | 'SANDBOX' | 'ATIVO';

export interface ModuloEstado {
  estado: EstadoModulo;
  temCredenciais: boolean;
}

// Provedor usado para a saída real de WhatsApp pela Ana.
// WA-AKG é o canal principal por vendedor; os demais permanecem apenas para
// migração e contingência controlada.
export type ProvedorWhatsapp = 'wa_akg' | 'zapi' | 'meta';

export interface EventoHistorico {
  id: string;
  tipo: string;
  descricao: string;
  ator: string;
  data: string;
}

export interface Tarefa {
  id: string;
  titulo: string;
  responsavel: string;
  responsavelId?: string;
  leadId?: string;
  leadNome?: string;
  prioridade: 'ALTA' | 'MEDIA' | 'BAIXA';
  concluida: boolean;
  dataLimite?: string;
  criadaEm: string;
  descricao?: string;
}

export interface Notificacao {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  lida: boolean;
  responsavelId?: string;
  data: string;
  link?: string;
  leadId?: string;
  prioridade?: 'low' | 'normal' | 'high' | 'urgent';
  acaoNecessaria?: boolean;
  acaoRecomendada?: string;
  status?: 'open' | 'acknowledged' | 'resolved';
}

export interface RegistroAuditoria {
  id: string;
  evento: string;
  ator: string;
  alvo: string;
  detalhes: string;
  data: string;
}

export interface PodeEnviarResultado {
  ok: boolean;
  motivo?: string;
}

// Registro de um envio (real ou simulado) feito pela Ana, usado pelo
// "Registro Sandbox" para auditoria do que sairia de verdade.
export interface RegistroEnvio {
  id: string;
  data: string;
  modo: ModoExecucao;
  canal: string;
  leadId: string;
  contato: string;
  tipo: string;
  texto: string;
  simulado: boolean;
  bloqueadoSandbox?: boolean;
  destino: string;
  // Resultado do envio real (quando simulado = false). Populado assincronamente
  // após a resposta da Edge Function, para permitir validação de ponta a ponta.
  resultado?: 'ok' | 'erro' | 'pendente';
  respostaApi?: string;
}

export interface DiaAtendimento {
  dia: string;
  ativo: boolean;
  inicio: string;
  fim: string;
}

export interface Feriado {
  data: string;
  nome: string;
}

export interface HandoffGatilho {
  id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
}

export interface ConfiguracaoRuntime {
  killSwitchGlobal: boolean;
  killSwitchUltimoMotivo: string;
  primeiroFollowup: { ativo: boolean; horas: number };
  segundoFollowup: { ativo: boolean; horas: number };
  timeout: { ativo: boolean; horas: number };
  motivoPerdaTimeout: string;
  pausarAoResponder: boolean;
  cancelarEtapaFinal: boolean;
  slaPrimeiroContato: { ativo: boolean; horas: number };
  notificarResponsavel: boolean;
  notificarGestor: boolean;
  escalarAposSla: boolean;
  handoffGatilhos: HandoffGatilho[];
  limiteConfianca: number;
  scoreMinimoHandoff: number;
  pausarAnaHandoff: boolean;
  criarTarefaHandoff: boolean;
  limiteDiarioPorContato: number;
  limiteDiarioTotal: number;
  aguardarResposta: boolean;
  horarioComercial: boolean;
  diasSemana: DiaAtendimento[];
  feriados: Feriado[];
  descontoMaximoPadrao: number;
  descontoExigeAprovacaoAcima: number;
  anaPodeAplicarDesconto: boolean;
  anaDescontoMaximo: number;
  modoExecucao: ModoExecucao;
  estadosModulos: Record<string, ModuloEstado>;
  contatosTeste: string[];
  provedorWhatsapp: ProvedorWhatsapp;
  // Limite (0-100) a partir do qual o medidor de risco de bloqueio alerta (default 70).
  alertaRiscoBloqueio: number;
}
