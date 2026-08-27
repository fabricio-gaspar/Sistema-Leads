import type { Lead } from '@/mocks/leadsData';

export interface CrmLeadRow {
  id: string;
  organization_id: string;
  company: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  segment: string | null;
  score: number | null;
  temp: string | null;
  stage: string;
  origin: string | null;
  owner: string | null;
  assigned_to: string | null;
  opt_out: boolean | null;
  ai_paused: boolean | null;
  automation_status: string | null;
  active_channel: string | null;
  city: string | null;
  size: string | null;
  source_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function persistentLeadId(id: string): string {
  return isUuid(id) ? id : crypto.randomUUID();
}

const stageToLegacy: Record<string, string> = {
  'Prospecção': 'Em Contato',
  Qualificado: 'Em Qualificação',
  Proposta: 'Orçamento Enviado',
  Negociação: 'Negociação',
  Pedido: 'Negociação',
  Fechado: 'Fechado — Ganho',
  Perdido: 'Fechado — Perdido',
  'Contatos Perdidos': 'Pausado',
};

const legacyToStage: Record<string, string> = {
  Novo: 'Prospecção',
  'Em Contato': 'Prospecção',
  'Aguardando Resposta': 'Prospecção',
  'Em Qualificação': 'Qualificado',
  'Reunião Agendada': 'Qualificado',
  'Proposta em Preparação': 'Proposta',
  'Orçamento Enviado': 'Proposta',
  Negociação: 'Negociação',
  'Fechado — Ganho': 'Fechado',
  'Fechado — Perdido': 'Perdido',
  Pausado: 'Contatos Perdidos',
};

function temperature(value: string | null, score: number): Lead['temperatura'] {
  if (value === 'hot') return 'Quente';
  if (value === 'cold') return 'Frio';
  return score >= 80 ? 'Quente' : score >= 60 ? 'Morno' : 'Frio';
}

function databaseTemperature(value: Lead['temperatura']): string {
  return value === 'Quente' ? 'hot' : value === 'Frio' ? 'cold' : 'warm';
}

export function leadToCrmRow(lead: Lead, organizationId: string): Partial<CrmLeadRow> & { organization_id: string; company: string } {
  return {
    id: persistentLeadId(lead.id),
    organization_id: organizationId,
    company: lead.empresa.trim(),
    contact: lead.nome.trim() || null,
    email: lead.email.trim().toLowerCase() || null,
    phone: lead.telefone.trim() || null,
    whatsapp: lead.whatsapp.trim() || null,
    segment: lead.segmento.trim() || null,
    score: Math.max(0, Math.min(100, Math.round(lead.score))),
    temp: databaseTemperature(lead.temperatura),
    stage: legacyToStage[lead.etapa] ?? 'Prospecção',
    origin: lead.origem.trim() || null,
    owner: lead.responsavel || 'ia',
    assigned_to: lead.responsavelId && isUuid(lead.responsavelId) ? lead.responsavelId : null,
    opt_out: Boolean(lead.bloqueado || lead.contatoPermitido === false),
    ai_paused: (lead.modoAtendimento ?? 'IA') === 'HUMANO',
    automation_status: lead.automacaoStatus === 'AGUARDANDO_HUMANO' ? 'human' : lead.automacaoStatus === 'PAUSADA' ? 'paused' : 'running',
    active_channel: lead.canalPreferencial || null,
    city: lead.cidade || null,
    size: lead.porte || null,
    source_metadata: { cnpj: lead.cnpj, estado: lead.estado, tags: lead.tags, cargo: lead.cargo, campanha: lead.campanha },
  };
}

export function crmRowToLead(row: CrmLeadRow): Lead {
  const meta = row.source_metadata ?? {};
  const score = row.score ?? 0;
  const isHuman = row.ai_paused || row.automation_status === 'human';
  return {
    id: row.id, nome: row.contact ?? '', empresa: row.company,
    cnpj: typeof meta.cnpj === 'string' ? meta.cnpj : '—', email: row.email ?? '', telefone: row.phone ?? '', whatsapp: row.whatsapp ?? row.phone ?? '',
    segmento: row.segment ?? '', cidade: row.city ?? '', estado: typeof meta.estado === 'string' ? meta.estado : '', porte: row.size ?? '',
    score, temperatura: temperature(row.temp, score), etapa: stageToLegacy[row.stage] ?? 'Novo', origem: row.origin ?? '',
    responsavel: row.owner === 'ia' || !row.owner ? 'Ana (IA)' : row.owner,
    tags: Array.isArray(meta.tags) ? meta.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    ultimaInteracao: row.updated_at ? new Date(row.updated_at).toLocaleDateString('pt-BR') : '—', criadoEm: row.created_at.slice(0, 10),
    cargo: typeof meta.cargo === 'string' ? meta.cargo : undefined, campanha: typeof meta.campanha === 'string' ? meta.campanha : undefined,
    modoAtendimento: isHuman ? 'HUMANO' : 'IA', automacaoStatus: isHuman ? 'AGUARDANDO_HUMANO' : row.automation_status === 'paused' ? 'PAUSADA' : 'ATIVA',
    responsavelId: row.assigned_to ?? undefined, canalPreferencial: row.active_channel ?? undefined,
    intencao: null, sentimento: 'NEUTRO', confianca: 0, proximaAcao: null, motivoTransferencia: '', nextFollowUpAt: null, timeoutAt: null,
    followUpCount: 0, maxFollowUps: 2, automationEvents: [], historico: [], bloqueado: Boolean(row.opt_out), contatoPermitido: !row.opt_out,
    consentimentoWhatsApp: false, consentimentoEmail: false, primeiroContatoEnviadoEm: null, aguardandoAtivacao: false, noShows: 0, fluxosProgramados: [], arquivado: false,
  };
}
