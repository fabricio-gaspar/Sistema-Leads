import { useLeadsStore, getLeadsSnapshot } from '@/hooks/useLeadsStore';
import { useConfiguracaoStore, getConfigSnapshot } from '@/hooks/useConfiguracaoStore';
import { useTarefasStore } from '@/hooks/useTarefasStore';
import { useNotificacoesStore } from '@/hooks/useNotificacoesStore';
import { useAuditoriaStore, registrarAuditoria } from '@/hooks/useAuditoriaStore';
import { useConversasStore } from '@/hooks/useConversasStore';
import { analisarMensagemLead, deveTransferir } from '@/lib/analise';
import { podeEnviarMensagem, calcularCadencia, adicionarHoras, NOMES_DIA } from '@/lib/automacao';
import type { AnaliseMensagem, SlotHorario } from '@/lib/tipos';
import type { Lead, FluxoProgramado, PassoFluxoProgramado } from '@/mocks/leadsData';
import { templatesMensagem } from '@/mocks/templatesData';
import { useCompromissosStore, getCompromissosSnapshot } from '@/hooks/useCompromissosStore';
import { resolverTransportador, contatoPermitidoNoSandbox, enviarViaApi } from '@/lib/transportador';
import { registrarEnvio, atualizarResultadoEnvio } from '@/hooks/useEnvioLogStore';
import { analisarComIA, redigirTexto } from '@/lib/anaIA';
import { getFluxosSnapshot } from '@/hooks/useFluxosAutomatizacaoStore';
import { getEmpresaSettingsSnapshot } from '@/hooks/useEmpresaSettingsStore';
import { getVariaveisGlobaisSnapshot } from '@/hooks/useVariaveisGlobaisStore';
import { montarValoresVariaveis, resolverVariaveis } from '@/lib/variaveis';

function agoraHora(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function preencherTemplate(texto: string, lead: Lead): string {
  return texto
    .replace(/\{nome\}/g, lead.nome)
    .replace(/\{empresa\}/g, lead.empresa)
    .replace(/\{segmento\}/g, lead.segmento)
    .replace(/\{servico\}/g, 'nossas soluções de marketing digital')
    .replace(/\{oferta\}/g, 'nossa proposta sob medida')
    .replace(/\{link\}/g, 'https://www.wayflex.ind.br');
}

function formatarDataISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

function formatarDataExibicao(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Ordem linear das etapas ativas do funil, usada para saber quando a Ana
// atingiu o limite de atendimento configurado pelo usuário (handoff por etapa).
const ORDEM_ETAPAS = [
  'Novo',
  'Em Contato',
  'Aguardando Resposta',
  'Em Qualificação',
  'Reunião Agendada',
  'Proposta em Preparação',
  'Orçamento Enviado',
  'Negociação',
];

function etapaAtingiuHandoff(lead: Lead): boolean {
  if (!lead.etapaHandoff) return false;
  const atual = ORDEM_ETAPAS.indexOf(lead.etapa);
  const limite = ORDEM_ETAPAS.indexOf(lead.etapaHandoff);
  if (limite === -1) return false;
  return atual !== -1 && atual >= limite;
}

// Resolve as variáveis de uma mensagem de fluxo pronto ({nome}, {empresa_nome},
// {assinatura}, {oferta}, {validade}...) com dados reais do lead, da empresa e
// das variáveis globais.
function resolverMensagemFluxo(mensagem: string, lead: Lead): string {
  const org = getEmpresaSettingsSnapshot();
  const variaveis = getVariaveisGlobaisSnapshot();
  const valores = montarValoresVariaveis({
    lead: {
      nome: lead.nome,
      empresa: lead.empresa,
      oferta: 'nossas soluções',
      segmento: lead.segmento,
    },
    organizacao: org.organizacao,
    customVars: variaveis,
  });
  if (!valores.validade) valores.validade = '30/09/2026';
  return resolverVariaveis(mensagem, valores);
}

function calcularHoraFim(inicio: string): string {
  const [h, m] = inicio.split(':').map(Number);
  const d = new Date();
  d.setHours(h + 1, m, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Gera os horários candidatos dentro da janela [inicio, fim] de um dia de atendimento.
function gerarCandidatosDentroDe(inicio: string, fim: string, intervaloMin = 60): string[] {
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);
  const inicioMin = hi * 60 + mi;
  const fimMin = hf * 60 + mf;
  const candidatos: string[] = [];
  for (let t = inicioMin; t + 60 <= fimMin; t += intervaloMin) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    candidatos.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return candidatos;
}

// Gera slots livres (dia útil futuro, dentro do horário comercial e fora de feriados)
// evitando conflitos com compromissos já agendados.
function gerarSlotsLivres(quantidade: number): SlotHorario[] {
  const cfg = getConfigSnapshot();
  const ocupados = new Set(
    getCompromissosSnapshot()
      .filter((c) => c.status === 'agendado' || c.status === 'no_show')
      .map((c) => `${c.data}|${c.horaInicio}`)
  );

  const slots: SlotHorario[] = [];
  const dia = new Date();
  dia.setDate(dia.getDate() + 1); // começa amanhã
  let diasPercorridos = 0;

  while (slots.length < quantidade && diasPercorridos < 30) {
    const d = new Date(dia);
    const nomeDia = NOMES_DIA[d.getDay()];
    const cfgDia = cfg.diasSemana.find((dd) => dd.dia === nomeDia);
    const dataStr = formatarDataISO(d);
    const ehFeriado = cfg.feriados.some((f) => f.data === dataStr);

    if (cfgDia && cfgDia.ativo && !ehFeriado) {
      for (const hora of gerarCandidatosDentroDe(cfgDia.inicio, cfgDia.fim)) {
        if (slots.length >= quantidade) break;
        if (ocupados.has(`${dataStr}|${hora}`)) continue;
        slots.push({
          data: dataStr,
          horaInicio: hora,
          horaFim: calcularHoraFim(hora),
          indice: slots.length + 1,
        });
      }
    }

    dia.setDate(dia.getDate() + 1);
    diasPercorridos += 1;
  }

  return slots;
}

const ordinaisPorIndice: Record<number, string[]> = {
  1: ['primeira', 'primeiro'],
  2: ['segunda', 'segundo'],
  3: ['terceira', 'terceiro'],
};

// Detecta qual slot o lead escolheu a partir da resposta ("1", "opção 2", "segunda", etc.).
function detectarEscolhaSlot(mensagem: string, slots: SlotHorario[]): SlotHorario | null {
  const m = normalizar(mensagem);
  if (!m) return null;
  for (const slot of slots) {
    if (new RegExp(`\\b${slot.indice}\\b`).test(m)) return slot;
    const ordinais = ordinaisPorIndice[slot.indice] || [];
    if (ordinais.some((o) => m.includes(o))) return slot;
  }
  // "amanhã" cai no primeiro slot (os slots começam amanhã).
  if (m.includes('amanha') && slots[0]) return slots[0];
  return null;
}

export interface ResultadoAnalise {
  analise: AnaliseMensagem;
  transferiu: boolean;
  respondeu?: boolean;
}

// Orquestrador do fluxo comercial. Compõe os stores vivos e aplica as regras
// de negócio de ponta a ponta (primeiro contato, follow-up, timeout, handoff).
export function useFluxoComercial() {
  const [, setLeads] = useLeadsStore();
  const { config } = useConfiguracaoStore();
  const tarefas = useTarefasStore();
  const notif = useNotificacoesStore();
  const audit = useAuditoriaStore();
  const conversas = useConversasStore();
  const compromissos = useCompromissosStore();

  const addHistorico = (leadId: string, tipo: string, descricao: string, ator: string) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              historico: [
                { id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, tipo, descricao, ator, data: new Date().toISOString() },
                ...(l.historico || []),
              ],
            }
          : l
      )
    );
  };

  const acharConversa = (lead: Lead) => {
    const existente = conversas.conversas.find((c) => c.leadId === lead.id);
    return existente || conversas.criarConversa(lead);
  };

  // Ponto único de saída da Ana. Escreve a mensagem na conversa e decide, via
  // transportador, se o envio é real (API) ou simulado, registrando no log de envios.
  const enviarParaLead = (
    lead: Lead,
    canal: string,
    texto: string,
    tipo: string,
    extra?: { opcoesHorario?: SlotHorario[] }
  ): void => {
    const conv = acharConversa(lead);
    const cfg = getConfigSnapshot();
    const resolucao = resolverTransportador(cfg, canal);
    const destino = canal === 'E-mail' ? lead.email : lead.whatsapp;
    const bloqueadoSandbox = cfg.modoExecucao === 'SANDBOX' && !contatoPermitidoNoSandbox(cfg, destino);

    conversas.adicionarMensagem(conv.id, {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      autor: 'ana',
      nome: 'Ana',
      texto,
      hora: agoraHora(),
      ...(extra?.opcoesHorario && extra.opcoesHorario.length > 0 ? { opcoesHorario: extra.opcoesHorario } : {}),
    });

    const registroId = registrarEnvio({
      modo: resolucao.modo,
      canal,
      leadId: lead.id,
      contato: lead.nome,
      tipo,
      texto,
      simulado: !resolucao.usarApi,
      bloqueadoSandbox,
      destino,
    });

    if (resolucao.usarApi && !bloqueadoSandbox) {
      enviarViaApi(canal, {
        para: destino,
        texto,
        assunto: tipo === 'LEMBRETE_REUNIAO' ? `Lembrete de reunião — ${lead.nome}` : undefined,
      }).then((res) => {
        if (res.enviado) {
          atualizarResultadoEnvio(registroId, 'ok', `Enviado — ${res.provedor ?? 'provedor'} · ID: ${res.id ?? '—'}`);
        } else {
          atualizarResultadoEnvio(registroId, 'erro', res.detalhe || res.erro || 'Falha no envio.');
        }
      });
    }
  };

  // Agenda os fluxos prontos (WS8) ativos para um gatilho num lead. Os passos com
  // diasApos === 0 são enviados imediatamente; os demais ficam programados para
  // serem disparados pelo motor quando a data chegar. Idempotente por fluxoId.
  const dispararFluxosPorGatilho = (leadId: string, gatilho: string): number => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    if (!lead) return 0;
    const fluxosAtivos = getFluxosSnapshot().filter((f) => f.ativo && f.gatilho === gatilho);
    if (fluxosAtivos.length === 0) return 0;
    const jaProgramados = new Set((lead.fluxosProgramados || []).map((fp) => fp.fluxoId));
    const novos = fluxosAtivos.filter((f) => !jaProgramados.has(f.id));
    if (novos.length === 0) return 0;

    const agora = Date.now();
    let enviados = 0;
    const programados: FluxoProgramado[] = [];

    novos.forEach((fluxo) => {
      const passos: PassoFluxoProgramado[] = fluxo.passos.map((p) => {
        if (p.diasApos === 0) {
          const texto = resolverMensagemFluxo(p.mensagem, lead);
          enviarParaLead(lead, p.canal, texto, 'FLUXO_AUTOMATICO');
          enviados += 1;
          return { passoId: p.id, enviarEm: new Date(agora).toISOString(), enviado: true };
        }
        return { passoId: p.id, enviarEm: new Date(agora + p.diasApos * 86400000).toISOString(), enviado: false };
      });
      programados.push({ fluxoId: fluxo.id, gatilho: fluxo.gatilho, passos });
    });

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, fluxosProgramados: [...(l.fluxosProgramados || []), ...programados] } : l
      )
    );
    addHistorico(leadId, 'FLUXO_AGENDADO', `${programados.length} fluxo(s) automático(s) agendado(s)`, 'Sistema');
    return enviados;
  };

  // Envia os passos de fluxos prontos que chegaram à data (executado pelo motor).
  const processarFluxosPendentes = (): number => {
    const agora = Date.now();
    const cfg = getConfigSnapshot();
    const fluxos = getFluxosSnapshot();
    let enviados = 0;

    for (const lead of getLeadsSnapshot()) {
      if ((lead.modoAtendimento ?? 'IA') !== 'IA') continue;
      if (lead.automacaoStatus !== 'ATIVA') continue;
      if (lead.bloqueado) continue;
      if (cfg.killSwitchGlobal) continue;
      if (['Fechado — Ganho', 'Fechado — Perdido', 'Pausado'].includes(lead.etapa)) continue;
      const programados = lead.fluxosProgramados || [];
      if (programados.length === 0) continue;

      let mudou = false;
      const atualizados: FluxoProgramado[] = programados.map((fp) => {
        const fluxo = fluxos.find((f) => f.id === fp.fluxoId);
        const passos = fp.passos.map((p) => {
          if (p.enviado || new Date(p.enviarEm).getTime() > agora) return p;
          const passoDef = fluxo && fluxo.ativo ? fluxo.passos.find((pp) => pp.id === p.passoId) : undefined;
          if (passoDef) {
            const texto = resolverMensagemFluxo(passoDef.mensagem, lead);
            enviarParaLead(lead, passoDef.canal, texto, 'FLUXO_AUTOMATICO');
            enviados += 1;
          }
          mudou = true;
          return { ...p, enviado: true };
        });
        return { ...fp, passos };
      });

      if (mudou) {
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, fluxosProgramados: atualizados } : l)));
      }
    }

    return enviados;
  };

  const processarPrimeiroContato = (leadId: string): void => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    if (!lead) return;
    if (lead.primeiroContatoEnviadoEm) return;
    if ((lead.automationEvents || []).includes('PRIMEIRO_CONTATO')) return;
    if ((lead.modoAtendimento ?? 'IA') !== 'IA') return;

    const cfg = getConfigSnapshot();
    const canal = lead.canalPreferencial || 'WhatsApp';
    const pode = podeEnviarMensagem(lead, canal, cfg);

    if (!pode.ok) {
      addHistorico(leadId, 'BLOQUEIO_ENVIO', `Primeiro contato bloqueado: ${pode.motivo}`, 'Sistema');
      registrarAuditoria({ evento: 'AUTOMATION_FAILED', ator: 'Sistema', alvo: lead.nome, detalhes: `Primeiro contato bloqueado: ${pode.motivo}` });
      return;
    }

    const template = templatesMensagem.find((t) => t.id === lead.templateId) || templatesMensagem[0];
    const texto = preencherTemplate(template.conteudo, lead);
    enviarParaLead(lead, canal, texto, 'PRIMEIRO_CONTATO');

    const cad = calcularCadencia(cfg);
    const agoraIso = new Date().toISOString();
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              etapa: 'Em Contato',
              primeiroContatoEnviadoEm: agoraIso,
              nextFollowUpAt: adicionarHoras(agoraIso, cad.fu1Horas),
              timeoutAt: adicionarHoras(agoraIso, cad.timeoutHoras),
              followUpCount: 0,
              maxFollowUps: cad.maxFollowUps,
              automationEvents: [...(l.automationEvents || []), 'PRIMEIRO_CONTATO'],
              historico: [{ id: `h-${Date.now()}`, tipo: 'PRIMEIRO_CONTATO', descricao: 'Primeiro contato enviado pela Ana', ator: 'Ana (IA)', data: agoraIso }, ...(l.historico || [])],
            }
          : l
      )
    );
    registrarAuditoria({ evento: 'MESSAGE_SENT', ator: 'Ana (IA)', alvo: lead.nome, detalhes: 'Primeiro contato enviado automaticamente' });

    // Gatilho "novo_lead": agenda os fluxos prontos de boas-vindas ativos.
    dispararFluxosPorGatilho(leadId, 'novo_lead');
  };

  const criarTarefaHumano = (lead: Lead): void => {
    tarefas.criar({
      titulo: 'Realizar primeiro contato',
      responsavel: lead.responsavel || '—',
      responsavelId: lead.responsavelId || '',
      leadId: lead.id,
      leadNome: lead.nome,
      prioridade: 'MEDIA',
      dataLimite: adicionarHoras(new Date().toISOString(), config.slaPrimeiroContato.horas) || undefined,
      descricao: `Primeiro contato com ${lead.nome} (${lead.empresa}) via ${lead.canalPreferencial || 'WhatsApp'}.`,
    });
    if (config.notificarResponsavel) {
      notif.criar({
        titulo: 'Tarefa de primeiro contato',
        descricao: `Você foi atribuído ao lead ${lead.nome} (${lead.empresa}).`,
        tipo: 'TAREFA',
        responsavelId: lead.responsavelId || '',
      });
    }
    registrarAuditoria({ evento: 'TASK_CREATED', ator: 'Sistema', alvo: lead.nome, detalhes: 'Tarefa de primeiro contato criada (modo humano)' });
  };

  const executarFollowUp = async (leadId: string): Promise<void> => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    if (!lead) return;
    if ((lead.automationEvents || []).includes(`FOLLOW_UP_${(lead.followUpCount || 0) + 1}`)) return;
    if ((lead.modoAtendimento ?? 'IA') !== 'IA') return;
    if (lead.automacaoStatus !== 'ATIVA') return;
    if (lead.bloqueado) return;

    const cfg = getConfigSnapshot();
    const canal = lead.canalPreferencial || 'WhatsApp';
    if (!podeEnviarMensagem(lead, canal, cfg).ok) return;

    const cad = calcularCadencia(cfg);
    const num = (lead.followUpCount || 0) + 1;
    const textoFonte = num === 1 ? templatesMensagem.find((t) => t.id === 'tm-2') : templatesMensagem.find((t) => t.id === 'tm-3');
    const textoBase = preencherTemplate((textoFonte || templatesMensagem[0]).conteudo, lead);
    const textoIA = await redigirTexto('followup', { nome: lead.nome, empresa: lead.empresa });
    const texto = textoIA || textoBase;

    enviarParaLead(lead, canal, texto, 'FOLLOW_UP');

    const agoraIso = new Date().toISOString();
    const proximo = num === 1 ? cad.fu2Horas : 0;
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              etapa: 'Aguardando Resposta',
              followUpCount: num,
              nextFollowUpAt: proximo > 0 ? adicionarHoras(agoraIso, proximo) : null,
              automationEvents: [...(l.automationEvents || []), `FOLLOW_UP_${num}`],
              historico: [{ id: `h-${Date.now()}`, tipo: 'FOLLOW_UP', descricao: `Follow-up ${num} enviado pela Ana`, ator: 'Ana (IA)', data: agoraIso }, ...(l.historico || [])],
            }
          : l
      )
    );
    registrarAuditoria({ evento: 'MESSAGE_SENT', ator: 'Ana (IA)', alvo: lead.nome, detalhes: `Follow-up ${num} enviado` });
  };

  const executarTimeout = (leadId: string): void => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    if (!lead) return;
    const cfg = getConfigSnapshot();
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              etapa: 'Fechado — Perdido',
              motivoPerda: cfg.motivoPerdaTimeout,
              automacaoStatus: 'CONCLUIDA',
              nextFollowUpAt: null,
              timeoutAt: null,
              historico: [{ id: `h-${Date.now()}`, tipo: 'TIMEOUT', descricao: 'Timeout sem resposta — lead movido para perdido', ator: 'Sistema', data: new Date().toISOString() }, ...(l.historico || [])],
            }
          : l
      )
    );
    registrarAuditoria({ evento: 'STAGE_CHANGED', ator: 'Sistema', alvo: lead.nome, detalhes: `Timeout — movido para Fechado — Perdido (${cfg.motivoPerdaTimeout})` });
  };

  const cancelarAutomacoesPendentes = (leadId: string): void => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, nextFollowUpAt: null, timeoutAt: null } : l
      )
    );
  };

  // Detecta reuniões da Ana que ficaram no passado sem serem realizadas
  // (no-show) e dispara a remarcação automática, oferecendo novos horários.
  const processarNoShows = (): number => {
    const agora = new Date();
    let noShows = 0;

    getCompromissosSnapshot().forEach((comp) => {
      if (comp.status !== 'agendado') return;
      if (comp.tipo !== 'reuniao') return;
      if (!(comp.origem === 'ana' || comp.responsavel === 'Ana (IA)')) return;

      const dataHora = new Date(`${comp.data}T${comp.horaInicio}:00`);
      if (isNaN(dataHora.getTime()) || dataHora.getTime() >= agora.getTime()) return;

      compromissos.atualizar(comp.id, { status: 'no_show' });
      noShows += 1;

      const lead = getLeadsSnapshot().find((l) => l.id === comp.leadId);
      if (!lead) return;

      const novosNoShows = (lead.noShows || 0) + 1;

      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                noShows: novosNoShows,
                tags: novosNoShows >= 2 && !l.tags.includes('Risco de no-show') ? [...l.tags, 'Risco de no-show'] : l.tags,
                historico: [{ id: `h-${Date.now()}`, tipo: 'NO_SHOW', descricao: `No-show detectado — ${comp.data} às ${comp.horaInicio}. Ana iniciou remarcação.`, ator: 'Ana (IA)', data: new Date().toISOString() }, ...(l.historico || [])],
              }
            : l
        )
      );

      oferecerHorarios(lead.id, true);
      registrarAuditoria({ evento: 'MEETING_NO_SHOW', ator: 'Ana (IA)', alvo: lead.nome, detalhes: 'No-show detectado e remarcação automática iniciada' });
    });

    return noShows;
  };

  // Envia lembretes automáticos da Ana antes da reunião (24h e 1h antes),
  // via WhatsApp/e-mail, com idempotência via `lembretesEnviados` no compromisso.
  const processarLembretesReuniao = (): number => {
    const agora = Date.now();
    const H24 = 24 * 3600 * 1000;
    const H1 = 3600 * 1000;
    let enviados = 0;

    getCompromissosSnapshot().forEach((comp) => {
      if (comp.status !== 'agendado') return;
      if (comp.tipo !== 'reuniao') return;
      if (!comp.leadId) return;

      const dataHora = new Date(`${comp.data}T${comp.horaInicio}:00`).getTime();
      if (isNaN(dataHora) || dataHora <= agora) return; // reunião passada — o no-show cuida disso

      const jaEnviados = comp.lembretesEnviados || [];
      const lead = getLeadsSnapshot().find((l) => l.id === comp.leadId);
      if (!lead) return;

      const canal = lead.canalPreferencial || 'WhatsApp';
      // Checagem leve de consentimento/bloqueio (lembretes são transacionais e
      // não devem ser barrados pelo horário comercial).
      if (lead.bloqueado) return;
      if (lead.contatoPermitido === false) return;
      if ((lead.modoAtendimento ?? 'IA') === 'HUMANO') return;
      if (canal === 'E-mail' && lead.consentimentoEmail === false) return;
      if (canal !== 'E-mail' && lead.consentimentoWhatsApp === false) return;

      const diff = dataHora - agora;
      const alvos: { chave: '24h' | '1h'; texto: string }[] = [];

      if (diff <= H24 && diff > H1 && !jaEnviados.includes('24h')) {
        alvos.push({
          chave: '24h',
          texto: `Oi ${lead.nome}! Só para lembrar: nossa reunião está confirmada para amanhã às ${comp.horaInicio}. Fica combinado assim? Até lá!`,
        });
      }
      if (diff <= H1 && diff > 0 && !jaEnviados.includes('1h')) {
        alvos.push({
          chave: '1h',
          texto: `Oi ${lead.nome}! Daqui a pouco temos nossa reunião — começa às ${comp.horaInicio}. Já te deixei o link por aqui. Até já!`,
        });
      }

      if (alvos.length === 0) return;

      alvos.forEach((a) => {
        enviarParaLead(lead, canal, a.texto, 'LEMBRETE_REUNIAO');
      });

      compromissos.atualizar(comp.id, {
        lembretesEnviados: [...jaEnviados, ...alvos.map((a) => a.chave)],
      });
      enviados += alvos.length;

      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                historico: [
                  ...alvos.map((a) => ({
                    id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                    tipo: 'LEMBRETE_REUNIAO',
                    descricao: `Lembrete (${a.chave}) enviado pela Ana antes da reunião de ${comp.data} às ${comp.horaInicio}`,
                    ator: 'Ana (IA)',
                    data: new Date().toISOString(),
                  })),
                  ...(l.historico || []),
                ],
              }
            : l
        )
      );

      registrarAuditoria({
        evento: 'MEETING_REMINDER',
        ator: 'Ana (IA)',
        alvo: lead.nome,
        detalhes: `Lembretes (${alvos.map((a) => a.chave).join(', ')}) enviados antes da reunião de ${comp.data} às ${comp.horaInicio}`,
      });
    });

    return enviados;
  };

  const processarAutomacoesPendentes = async (): Promise<{ followUps: number; timeouts: number; noShows: number; lembretes: number; fluxos: number }> => {
    const cfg = getConfigSnapshot();
    let followUps = 0;
    let timeouts = 0;
    const agora = Date.now();

    for (const lead of getLeadsSnapshot()) {
      if ((lead.modoAtendimento ?? 'IA') !== 'IA') continue;
      if (lead.automacaoStatus !== 'ATIVA') continue;
      if (lead.bloqueado) continue;
      if (cfg.killSwitchGlobal) continue;
      if (['Fechado — Ganho', 'Fechado — Perdido', 'Pausado'].includes(lead.etapa)) continue;

      if (lead.timeoutAt && new Date(lead.timeoutAt).getTime() <= agora) {
        executarTimeout(lead.id);
        timeouts += 1;
        continue;
      }
      if (lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() <= agora) {
        await executarFollowUp(lead.id);
        followUps += 1;
      }
    }

    const noShows = processarNoShows();
    const lembretes = processarLembretesReuniao();

    // Gatilhos de fluxo prontos (lead inativo e aniversário de parceria).
    for (const lead of getLeadsSnapshot()) {
      if ((lead.modoAtendimento ?? 'IA') !== 'IA') continue;
      if (lead.automacaoStatus !== 'ATIVA') continue;
      if (lead.bloqueado) continue;
      if (['Fechado — Ganho', 'Fechado — Perdido', 'Pausado'].includes(lead.etapa)) continue;

      const followUpsEsgotados = (lead.followUpCount || 0) >= (lead.maxFollowUps || 2);
      if (followUpsEsgotados && ['Aguardando Resposta', 'Em Contato'].includes(lead.etapa)) {
        dispararFluxosPorGatilho(lead.id, 'lead_inativo');
      }

      const criadoEm = lead.criadoEm;
      if (criadoEm && /^\d{4}-\d{2}-\d{2}$/.test(criadoEm)) {
        const [, m, d] = criadoEm.split('-').map(Number);
        const hoje = new Date();
        if (m === hoje.getMonth() + 1 && d === hoje.getDate()) {
          dispararFluxosPorGatilho(lead.id, 'aniversario');
        }
      }
    }

    const fluxos = processarFluxosPendentes();
    return { followUps, timeouts, noShows, lembretes, fluxos };
  };

  const transferirParaHumano = (leadId: string, motivo: string, prioridade: 'ALTA' | 'MEDIA' | 'BAIXA' = 'MEDIA'): void => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    if (!lead) return;

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              automacaoStatus: 'AGUARDANDO_HUMANO',
              motivoTransferencia: motivo,
              nextFollowUpAt: null,
              timeoutAt: null,
              historico: [{ id: `h-${Date.now()}`, tipo: 'HANDOFF', descricao: `Transferido para humano — ${motivo}`, ator: 'Ana (IA)', data: new Date().toISOString() }, ...(l.historico || [])],
            }
          : l
      )
    );

    if (config.criarTarefaHandoff) {
      tarefas.criar({
        titulo: 'Assumir atendimento transferido pela Ana',
        responsavel: lead.responsavel === 'Ana (IA)' ? 'Marina Sales' : lead.responsavel,
        responsavelId: lead.responsavelId || '',
        leadId: lead.id,
        leadNome: lead.nome,
        prioridade,
        descricao: `Resumo: ${motivo}. Intenção: ${lead.intencao || 'não analisada'}. Score: ${lead.score}. Próxima ação: ${lead.proximaAcao || 'definir'}.`,
      });
    }
    if (config.notificarResponsavel) {
      notif.criar({
        titulo: 'Handoff da Ana',
        descricao: `${lead.nome} foi transferido pela Ana (${motivo}). Atendimento aguardando humano.`,
        tipo: 'HANDOFF',
        responsavelId: lead.responsavelId || '',
      });
    }
    const conv = acharConversa(lead);
    conversas.adicionarMensagem(conv.id, { id: `msg-${Date.now()}`, autor: 'sistema', nome: 'Sistema', texto: `Atendimento transferido para humano. Motivo: ${motivo}.`, hora: agoraHora(), notaInterna: true });
    registrarAuditoria({ evento: 'HANDOFF', ator: 'Ana (IA)', alvo: lead.nome, detalhes: `Transferência para humano — ${motivo}` });
  };

  // Handoff por etapa: se a Ana atingiu o limite de atendimento configurado
  // no lead, ela avisa o lead e transfere pro vendedor humano (uma única vez).
  const verificarHandoffPorEtapa = (leadId: string): void => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    if (!lead) return;
    if ((lead.modoAtendimento ?? 'IA') !== 'IA') return;
    if (lead.automacaoStatus !== 'ATIVA') return;
    if (!etapaAtingiuHandoff(lead)) return;

    enviarParaLead(
      lead,
      lead.canalPreferencial || 'WhatsApp',
      `Ótimo, ${lead.nome}! Vou te conectar agora com um especialista do nosso time, que vai continuar seu atendimento daqui pra frente.`,
      'HANDOFF_ETAPA'
    );
    transferirParaHumano(leadId, `Lead atingiu a etapa limite de atendimento da Ana (${lead.etapaHandoff})`, 'MEDIA');
  };

  const assumirAtendimento = (leadId: string): void => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    if (!lead) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, automacaoStatus: 'PAUSADA' } : l)));
    addHistorico(leadId, 'ASSUMIDO_HUMANO', 'Atendimento assumido por humano', 'Humano');
    registrarAuditoria({ evento: 'HANDOFF', ator: 'Humano', alvo: lead.nome, detalhes: 'Atendimento assumido por humano' });
  };

  const devolverParaAna = (leadId: string): void => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    if (!lead) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, automacaoStatus: 'ATIVA' } : l)));
    addHistorico(leadId, 'DEVOLVIDO_ANA', 'Atendimento devolvido para a Ana', 'Humano');
    registrarAuditoria({ evento: 'HANDOFF', ator: 'Humano', alvo: lead.nome, detalhes: 'Atendimento devolvido para a Ana' });
  };

  const pausarAna = (leadId: string): void => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, automacaoStatus: 'PAUSADA' } : l)));
    addHistorico(leadId, 'PAUSAR_ANA', 'Ana pausada neste lead', 'Humano');
  };

  const retomarAna = (leadId: string): void => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, automacaoStatus: 'ATIVA' } : l)));
    addHistorico(leadId, 'RETOMAR_ANA', 'Ana retomada neste lead', 'Humano');
  };

  // Ajusta o limite de atendimento da Ana (handoff por etapa) num lead que já
  // está no funil, direto do card do Kanban. Vale só para leads em modo IA.
  const atualizarEtapaHandoff = (leadId: string, etapaHandoff: string): void => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    if (!lead) return;
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId ? { ...l, etapaHandoff: etapaHandoff || undefined } : l
      )
    );
    addHistorico(
      leadId,
      'HANDOFF_ETAPA_ALTERADO',
      etapaHandoff
        ? `Limite de atendimento da Ana alterado para "${etapaHandoff}"`
        : 'Limite removido — Ana conduz até o fim do funil',
      'Usuário'
    );
    registrarAuditoria({
      evento: 'HANDOFF_ETAPA_ALTERADO',
      ator: 'Usuário',
      alvo: lead.nome,
      detalhes: etapaHandoff ? `Limite da Ana alterado para "${etapaHandoff}"` : 'Limite de atendimento removido',
    });
  };

  // Oferece 2–3 horários livres ao lead (primeira vez ou remarcação após no-show).
  const oferecerHorarios = (leadId: string, remarcacao = false): void => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    if (!lead) return;

    const slots = gerarSlotsLivres(3);
    const canal = lead.canalPreferencial || 'WhatsApp';

    if (slots.length === 0) {
      enviarParaLead(lead, canal, 'Vou verificar minha agenda e já retorno com horários livres para a nossa reunião.', 'OFERTA_HORARIOS');
      return;
    }

    const texto = remarcacao
      ? 'Percebi que você não pôde participar da nossa reunião. Sem problemas! Vamos remarcar? Escolha um dos horários abaixo:'
      : 'Ótimo! Tenho estes horários livres para a nossa reunião. Toque no que for melhor para você:';

    enviarParaLead(lead, canal, texto, 'OFERTA_HORARIOS', { opcoesHorario: slots });

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              aguardandoEscolhaHorario: true,
              slotsOfertados: slots,
              proximaAcao: 'AGENDAR',
              historico: [{ id: `h-${Date.now()}`, tipo: 'HORARIOS_OFERECIDOS', descricao: 'Ana ofereceu horários livres para reunião', ator: 'Ana (IA)', data: new Date().toISOString() }, ...(l.historico || [])],
            }
          : l
      )
    );

    registrarAuditoria({ evento: 'MEETING_SLOTS_OFFERED', ator: 'Ana (IA)', alvo: lead.nome, detalhes: `Ana ofereceu ${slots.length} horários livres` });
  };

  // Confirma o slot escolhido pelo lead, agenda a reunião e move para "Reunião Agendada".
  const confirmarHorario = (leadId: string, slot: SlotHorario): void => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    if (!lead) return;

    compromissos.criar({
      titulo: 'Reunião de apresentação',
      lead: lead.nome,
      leadId: lead.id,
      empresa: lead.empresa,
      data: slot.data,
      horaInicio: slot.horaInicio,
      horaFim: slot.horaFim,
      tipo: 'reuniao',
      canal: 'video',
      status: 'agendado',
      responsavel: 'Ana (IA)',
      observacoes: 'Reunião agendada automaticamente pela Ana após o lead escolher o horário.',
      origem: 'ana',
    });

    enviarParaLead(lead, lead.canalPreferencial || 'WhatsApp', `Combinado! Reunião confirmada para ${formatarDataExibicao(slot.data)} às ${slot.horaInicio}. Vou te enviar o link da videochamada por aqui. Até lá!`, 'CONFIRMACAO_REUNIAO');

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              etapa: 'Reunião Agendada',
              proximaAcao: 'AGENDAR',
              aguardandoEscolhaHorario: false,
              slotsOfertados: [],
              nextFollowUpAt: null,
              timeoutAt: null,
              automationEvents: [...(l.automationEvents || []), 'REUNIAO_AGENDADA'],
              historico: [{ id: `h-${Date.now()}`, tipo: 'REUNIAO_AGENDADA', descricao: `Reunião confirmada pela Ana para ${slot.data} às ${slot.horaInicio}`, ator: 'Ana (IA)', data: new Date().toISOString() }, ...(l.historico || [])],
            }
          : l
      )
    );

    registrarAuditoria({ evento: 'MEETING_SCHEDULED', ator: 'Ana (IA)', alvo: lead.nome, detalhes: `Reunião confirmada para ${slot.data} às ${slot.horaInicio}` });

    verificarHandoffPorEtapa(leadId);
  };

  // Orçamento: a Ana não gera valores. Ela pergunta quais produtos/serviços o
  // lead quer orçar e, quando ele responde, avisa que o orçamento será enviado
  // assim que ficar pronto (a preparação da proposta fica com o humano).
  const solicitarProdutosOrcamento = (leadId: string): void => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    if (!lead) return;

    enviarParaLead(
      lead,
      lead.canalPreferencial || 'WhatsApp',
      'Claro! Para eu preparar o seu orçamento, me conta: quais produtos ou serviços você gostaria de incluir?',
      'PEDIR_PRODUTOS_ORCAMENTO'
    );

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              aguardandoProdutosOrcamento: true,
              etapa: 'Proposta em Preparação',
              proximaAcao: 'CRIAR_ORCAMENTO',
              historico: [{ id: `h-${Date.now()}`, tipo: 'ORCAMENTO_SOLICITADO', descricao: 'Ana perguntou quais produtos/serviços o lead quer orçar', ator: 'Ana (IA)', data: new Date().toISOString() }, ...(l.historico || [])],
            }
          : l
      )
    );
  };

  const receberProdutosOrcamento = (leadId: string, mensagem: string): void => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    if (!lead) return;

    enviarParaLead(
      lead,
      lead.canalPreferencial || 'WhatsApp',
      'Perfeito, recebi os produtos que você quer orçar! Assim que o orçamento ficar pronto, te envio por aqui.',
      'CONFIRMAR_PRODUTOS_ORCAMENTO'
    );

    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? {
              ...l,
              aguardandoProdutosOrcamento: false,
              etapa: 'Proposta em Preparação',
              historico: [{ id: `h-${Date.now()}`, tipo: 'PRODUTOS_ORCAMENTO_RECEBIDOS', descricao: `Lead enviou os produtos para orçamento: "${mensagem.slice(0, 120)}"`, ator: lead.nome, data: new Date().toISOString() }, ...(l.historico || [])],
            }
          : l
      )
    );

    transferirParaHumano(
      leadId,
      `Lead pediu orçamento e enviou os produtos: "${mensagem.slice(0, 200)}". Preparar e enviar a proposta.`,
      'ALTA'
    );
  };

  const analisarEResponder = async (leadId: string, mensagem: string): Promise<ResultadoAnalise> => {
    const lead = getLeadsSnapshot().find((l) => l.id === leadId);
    const analiseIA = await analisarComIA(mensagem);
    const ehFallback = !analiseIA;
    const analise = analiseIA ?? analisarMensagemLead(mensagem);

    if (lead) {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? {
                ...l,
                score: Math.min(100, Math.max(0, l.score + (analise.scoreInteresse - 50) / 2)),
                intencao: analise.intencao,
                sentimento: analise.sentimento,
                confianca: analise.confianca,
                proximaAcao: analise.proximaAcao,
                motivoTransferencia: analise.motivoTransferencia || l.motivoTransferencia,
                nextFollowUpAt: config.pausarAoResponder ? null : l.nextFollowUpAt,
                timeoutAt: config.pausarAoResponder ? null : l.timeoutAt,
                historico: [{ id: `h-${Date.now()}`, tipo: 'ANALISE', descricao: `Análise: ${analise.intencao} · score ${analise.scoreInteresse} · confiança ${analise.confianca}%`, ator: 'Ana (IA)', data: new Date().toISOString() }, ...(l.historico || [])],
              }
            : l
        )
      );
    }

    let transferiu = false;

    if (analise.intencao === 'OPT_OUT' && lead) {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? { ...l, bloqueado: true, etapa: 'Fechado — Perdido', motivoPerda: 'Opt-out solicitado', automacaoStatus: 'CONCLUIDA' }
            : l
        )
      );
      registrarAuditoria({ evento: 'OPT_OUT', ator: 'Sistema', alvo: lead.nome, detalhes: 'Opt-out detectado e lead bloqueado' });
      return { analise, transferiu: false };
    }

    // Lead está aguardando a escolha de um horário → detecta a escolha do slot.
    if (lead && lead.aguardandoEscolhaHorario && (lead.slotsOfertados || []).length > 0) {
      const escolha = detectarEscolhaSlot(mensagem, lead.slotsOfertados as SlotHorario[]);
      if (escolha) {
        confirmarHorario(leadId, escolha);
        return { analise, transferiu: false, respondeu: true };
      }
      // Respondeu mas não escolheu um slot válido → reenvia as opções.
      oferecerHorarios(leadId, true);
      return { analise, transferiu: false, respondeu: true };
    }

    // Agendamento: a Ana oferece horários livres e o lead escolhe dentro da conversa.
    if (lead && analise.intencao === 'AGENDAMENTO' && analise.proximaAcao === 'AGENDAR') {
      oferecerHorarios(leadId);
      return { analise, transferiu: false, respondeu: true };
    }

    // Lead já informou os produtos do orçamento → confirma e transfere pro humano.
    if (lead && lead.aguardandoProdutosOrcamento) {
      receberProdutosOrcamento(leadId, mensagem);
      return { analise, transferiu: false, respondeu: true };
    }

    // Orçamento: a Ana pergunta quais produtos o lead quer orçar (não gera valores).
    if (lead && analise.intencao === 'ORCAMENTO' && analise.proximaAcao === 'CRIAR_ORCAMENTO') {
      solicitarProdutosOrcamento(leadId);
      return { analise, transferiu: false, respondeu: true };
    }

    const cfg = getConfigSnapshot();
    if (deveTransferir(analise, cfg.limiteConfianca, cfg.scoreMinimoHandoff, ehFallback)) {
      const prioridade = analise.scoreInteresse >= 80 || analise.intencao === 'AGENDAMENTO' || analise.intencao === 'NEGATIVO' ? 'ALTA' : 'MEDIA';
      transferirParaHumano(leadId, analise.motivoTransferencia || 'Análise da Ana indicou transferência', prioridade);
      transferiu = true;
    } else if (lead && analise.etapaSugerida && analise.etapaSugerida !== lead.etapa) {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId && l.etapa !== 'Fechado — Ganho' && l.etapa !== 'Fechado — Perdido'
            ? { ...l, etapa: analise.etapaSugerida as string }
            : l
        )
      );
    }

    // Handoff por etapa: se a Ana atingiu o limite configurado, transfere.
    if (lead) verificarHandoffPorEtapa(leadId);

    return { analise, transferiu };
  };

  const ativarParaKanban = (
    leadIds: string[],
    modo: 'IA' | 'HUMANO' = 'IA',
    etapaHandoff?: string
  ): { disparados: number; tarefas: number } => {
    let disparados = 0;
    let tarefas = 0;
    leadIds.forEach((id) => {
      const lead = getLeadsSnapshot().find((l) => l.id === id);
      if (!lead) return;
      // Sai do estado "aguardando aprovação" e entra no funil ativo do Kanban,
      // aplicando o modo de atendimento escolhido pelo usuário (Ana ou humano).
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                aguardandoAtivacao: false,
                modoAtendimento: modo,
                automacaoStatus: modo === 'IA' ? 'ATIVA' : 'PAUSADA',
                etapaHandoff: modo === 'IA' ? etapaHandoff : undefined,
                responsavel:
                  modo === 'IA'
                    ? 'Ana (IA)'
                    : l.responsavel === 'Ana (IA)' || !l.responsavel
                      ? 'Marina Sales'
                      : l.responsavel,
              }
            : l
        )
      );
      if (modo === 'IA') {
        processarPrimeiroContato(id);
        disparados += 1;
      } else {
        criarTarefaHumano({ ...lead, modoAtendimento: 'HUMANO' });
        tarefas += 1;
      }
    });
    return { disparados, tarefas };
  };

  return {
    ativarParaKanban,
    processarPrimeiroContato,
    processarAutomacoesPendentes,
    executarFollowUp,
    executarTimeout,
    cancelarAutomacoesPendentes,
    transferirParaHumano,
    assumirAtendimento,
    devolverParaAna,
    pausarAna,
    retomarAna,
    analisarEResponder,
    confirmarHorario,
    atualizarEtapaHandoff,
    criarTarefaHumano,
    registrarAuditoria: audit.registrar,
  };
}