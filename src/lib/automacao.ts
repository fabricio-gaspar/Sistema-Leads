import type { ConfiguracaoRuntime, PodeEnviarResultado } from '@/lib/tipos';
import type { Lead } from '@/mocks/leadsData';

// Nomes dos dias da semana no mesmo índice do Date.getDay() (0 = Domingo).
// Compartilhado entre o cálculo de horário comercial e a geração de slots livres.
export const NOMES_DIA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Regras de transição do Kanban (usando os nomes reais de etapasCRM).
export const transicoesPermitidas: Record<string, string[]> = {
  Novo: ['Apresentado'],
  Apresentado: ['Qualificando'],
  Qualificando: ['Reunião'],
  'Reunião': ['Orçamento'],
  'Orçamento': ['Ganho', 'Perdido'],
  Ganho: [],
  Perdido: [],
};

export function podeTransicionar(de: string, para: string): { ok: boolean; motivo?: string } {
  if (de === para) return { ok: true };
  const permitidas = transicoesPermitidas[de];
  if (!permitidas) return { ok: false, motivo: `Etapa "${de}" não possui transições configuradas.` };
  if (!permitidas.includes(para)) {
    return { ok: false, motivo: `Transição de "${de}" para "${para}" não é permitida.` };
  }
  return { ok: true };
}

export function dentroHorarioComercial(config: ConfiguracaoRuntime): boolean {
  const agora = new Date();
  const hoje = NOMES_DIA[agora.getDay()];
  const cfgDia = config.diasSemana.find((d) => d.dia === hoje);
  if (!cfgDia || !cfgDia.ativo) return false;

  const dataHoje = agora.toISOString().slice(0, 10);
  if (config.feriados.some((f) => f.data === dataHoje)) return false;

  const hhmm = agora.getHours() * 60 + agora.getMinutes();
  const [hi, mi] = cfgDia.inicio.split(':').map(Number);
  const [hf, mf] = cfgDia.fim.split(':').map(Number);
  const inicio = hi * 60 + mi;
  const fim = hf * 60 + mf;
  return hhmm >= inicio && hhmm <= fim;
}

export function podeEnviarMensagem(
  lead: Lead,
  canal: string,
  config: ConfiguracaoRuntime
): PodeEnviarResultado {
  if (config.killSwitchGlobal) return { ok: false, motivo: 'Kill switch global está ativo.' };
  if (lead.bloqueado) return { ok: false, motivo: 'Lead bloqueado (opt-out/supressão).' };
  if (lead.contatoPermitido === false) return { ok: false, motivo: 'Lead sem consentimento de contato.' };
  if (canal === 'E-mail' && lead.consentimentoEmail === false) return { ok: false, motivo: 'Sem consentimento para e-mail.' };
  if (canal !== 'E-mail' && lead.consentimentoWhatsApp === false) return { ok: false, motivo: 'Sem consentimento para WhatsApp.' };
  if (!canal) return { ok: false, motivo: 'Nenhum canal de contato disponível.' };
  if ((lead.modoAtendimento ?? 'IA') === 'HUMANO') {
    return { ok: false, motivo: 'Lead em modo humano — a Ana não envia mensagens automáticas.' };
  }
  if ((lead.automacaoStatus ?? 'ATIVA') !== 'ATIVA') {
    return { ok: false, motivo: 'Automação não está ativa para este lead.' };
  }
  if (config.horarioComercial && !dentroHorarioComercial(config)) {
    return { ok: false, motivo: 'Fora do horário comercial configurado.' };
  }
  return { ok: true };
}

export interface Cadencia {
  fu1Horas: number;
  fu2Horas: number;
  timeoutHoras: number;
  maxFollowUps: number;
}

export function calcularCadencia(config: ConfiguracaoRuntime): Cadencia {
  const fu1Horas = config.primeiroFollowup.ativo ? config.primeiroFollowup.horas : 0;
  const fu2Horas = config.segundoFollowup.ativo ? config.segundoFollowup.horas : 0;
  const timeoutHoras = config.timeout.ativo ? config.timeout.horas : 0;
  const maxFollowUps = (config.primeiroFollowup.ativo ? 1 : 0) + (config.segundoFollowup.ativo ? 1 : 0);
  return { fu1Horas, fu2Horas, timeoutHoras, maxFollowUps };
}

export function adicionarHoras(base: string | null, horas: number): string | null {
  if (!base) return null;
  const d = new Date(base);
  if (isNaN(d.getTime())) return null;
  d.setHours(d.getHours() + horas);
  return d.toISOString();
}

export const motivosPerda = [
  'Preço acima do esperado',
  'Prazo incompatível',
  'Escolheu a concorrência',
  'Sem verba/orçamento no momento',
  'Não é prioridade agora',
  'Sem retorno do contato',
  'Sem resposta (timeout)',
  'Opt-out solicitado',
  'Outro motivo',
];
