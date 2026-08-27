import type { Lead } from '@/mocks/leadsData';

export interface CrmLeadRow {
  id: string;
  organization_id: string;
  owner_id: string | null;
  company_name: string;
  primary_contact_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  segment: string | null;
  lifecycle_stage: string;
  score: number;
  source: string | null;
  consent_status: 'unknown' | 'legitimate_interest' | 'opted_in' | 'opted_out';
  is_archived: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function persistentLeadId(id: string): string {
  return isUuid(id) ? id : crypto.randomUUID();
}

function consentStatus(lead: Lead): CrmLeadRow['consent_status'] {
  if (lead.bloqueado || lead.contatoPermitido === false) return 'opted_out';
  if (lead.consentimentoWhatsApp || lead.consentimentoEmail) return 'opted_in';
  return 'unknown';
}

export function leadToCrmRow(lead: Lead, organizationId: string, userId?: string): Partial<CrmLeadRow> & { organization_id: string; company_name: string } {
  const metadata = {
    cnpj: lead.cnpj,
    telefone: lead.telefone,
    whatsapp: lead.whatsapp,
    cidade: lead.cidade,
    estado: lead.estado,
    porte: lead.porte,
    responsavel: lead.responsavel,
    tags: lead.tags,
    cargo: lead.cargo,
    campanha: lead.campanha,
    ultimaInteracao: lead.ultimaInteracao,
    modoAtendimento: lead.modoAtendimento,
    automacaoStatus: lead.automacaoStatus,
    responsavelId: lead.responsavelId,
    canalPreferencial: lead.canalPreferencial,
    templateId: lead.templateId,
    intencao: lead.intencao,
    sentimento: lead.sentimento,
    confianca: lead.confianca,
    proximaAcao: lead.proximaAcao,
    motivoTransferencia: lead.motivoTransferencia,
    nextFollowUpAt: lead.nextFollowUpAt,
    timeoutAt: lead.timeoutAt,
    followUpCount: lead.followUpCount,
    maxFollowUps: lead.maxFollowUps,
    automationEvents: lead.automationEvents,
    historico: lead.historico,
    consentimentoWhatsApp: lead.consentimentoWhatsApp,
    consentimentoEmail: lead.consentimentoEmail,
    motivoPerda: lead.motivoPerda,
    primeiroContatoEnviadoEm: lead.primeiroContatoEnviadoEm,
    listaId: lead.listaId,
    aguardandoAtivacao: lead.aguardandoAtivacao,
    slotsOfertados: lead.slotsOfertados,
    aguardandoEscolhaHorario: lead.aguardandoEscolhaHorario,
    noShows: lead.noShows,
    fluxosProgramados: lead.fluxosProgramados,
    etapaHandoff: lead.etapaHandoff,
    aguardandoProdutosOrcamento: lead.aguardandoProdutosOrcamento,
  };

  return {
    id: persistentLeadId(lead.id),
    organization_id: organizationId,
    owner_id: lead.responsavelId && isUuid(lead.responsavelId) ? lead.responsavelId : null,
    company_name: lead.empresa.trim(),
    primary_contact_name: lead.nome.trim() || null,
    primary_email: lead.email.trim().toLowerCase() || null,
    primary_phone: (lead.whatsapp || lead.telefone).trim() || null,
    segment: lead.segmento.trim() || null,
    lifecycle_stage: lead.etapa.trim() || 'Novo',
    score: Math.max(0, Math.min(100, Math.round(lead.score))),
    source: lead.origem.trim() || null,
    consent_status: consentStatus(lead),
    is_archived: Boolean(lead.arquivado),
    metadata,
    ...(userId ? { created_by: userId } : {}),
  };
}

export function crmRowToLead(row: CrmLeadRow): Lead {
  const meta = row.metadata ?? {};
  return {
    id: row.id,
    nome: row.primary_contact_name ?? '',
    empresa: row.company_name,
    cnpj: typeof meta.cnpj === 'string' ? meta.cnpj : '—',
    email: row.primary_email ?? '',
    telefone: typeof meta.telefone === 'string' ? meta.telefone : row.primary_phone ?? '',
    whatsapp: typeof meta.whatsapp === 'string' ? meta.whatsapp : row.primary_phone ?? '',
    segmento: row.segment ?? '',
    cidade: typeof meta.cidade === 'string' ? meta.cidade : '',
    estado: typeof meta.estado === 'string' ? meta.estado : '',
    porte: typeof meta.porte === 'string' ? meta.porte : '',
    score: row.score,
    temperatura: row.score >= 80 ? 'Quente' : row.score >= 60 ? 'Morno' : 'Frio',
    etapa: row.lifecycle_stage,
    origem: row.source ?? '',
    responsavel: typeof meta.responsavel === 'string' ? meta.responsavel : 'Sem responsável',
    tags: Array.isArray(meta.tags) ? meta.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    ultimaInteracao: typeof meta.ultimaInteracao === 'string' ? meta.ultimaInteracao : 'agora',
    criadoEm: row.created_at.slice(0, 10),
    cargo: typeof meta.cargo === 'string' ? meta.cargo : undefined,
    campanha: typeof meta.campanha === 'string' ? meta.campanha : undefined,
    modoAtendimento: meta.modoAtendimento === 'HUMANO' ? 'HUMANO' : 'IA',
    automacaoStatus: typeof meta.automacaoStatus === 'string' ? meta.automacaoStatus as Lead['automacaoStatus'] : 'ATIVA',
    responsavelId: typeof meta.responsavelId === 'string' ? meta.responsavelId : undefined,
    canalPreferencial: typeof meta.canalPreferencial === 'string' ? meta.canalPreferencial : undefined,
    templateId: typeof meta.templateId === 'string' ? meta.templateId : undefined,
    intencao: typeof meta.intencao === 'string' ? meta.intencao : null,
    sentimento: meta.sentimento === 'POSITIVO' || meta.sentimento === 'NEGATIVO' ? meta.sentimento : 'NEUTRO',
    confianca: typeof meta.confianca === 'number' ? meta.confianca : 0,
    proximaAcao: typeof meta.proximaAcao === 'string' ? meta.proximaAcao : null,
    motivoTransferencia: typeof meta.motivoTransferencia === 'string' ? meta.motivoTransferencia : '',
    nextFollowUpAt: typeof meta.nextFollowUpAt === 'string' ? meta.nextFollowUpAt : null,
    timeoutAt: typeof meta.timeoutAt === 'string' ? meta.timeoutAt : null,
    followUpCount: typeof meta.followUpCount === 'number' ? meta.followUpCount : 0,
    maxFollowUps: typeof meta.maxFollowUps === 'number' ? meta.maxFollowUps : 2,
    automationEvents: Array.isArray(meta.automationEvents) ? meta.automationEvents.filter((event): event is string => typeof event === 'string') : [],
    historico: Array.isArray(meta.historico) ? meta.historico as Lead['historico'] : [],
    bloqueado: row.consent_status === 'opted_out',
    contatoPermitido: row.consent_status !== 'opted_out',
    consentimentoWhatsApp: meta.consentimentoWhatsApp === true,
    consentimentoEmail: meta.consentimentoEmail === true,
    motivoPerda: typeof meta.motivoPerda === 'string' ? meta.motivoPerda : undefined,
    primeiroContatoEnviadoEm: typeof meta.primeiroContatoEnviadoEm === 'string' ? meta.primeiroContatoEnviadoEm : null,
    listaId: typeof meta.listaId === 'string' ? meta.listaId : undefined,
    aguardandoAtivacao: meta.aguardandoAtivacao === true,
    slotsOfertados: Array.isArray(meta.slotsOfertados) ? meta.slotsOfertados as Lead['slotsOfertados'] : undefined,
    aguardandoEscolhaHorario: meta.aguardandoEscolhaHorario === true,
    noShows: typeof meta.noShows === 'number' ? meta.noShows : 0,
    fluxosProgramados: Array.isArray(meta.fluxosProgramados) ? meta.fluxosProgramados as Lead['fluxosProgramados'] : [],
    etapaHandoff: typeof meta.etapaHandoff === 'string' ? meta.etapaHandoff : undefined,
    aguardandoProdutosOrcamento: meta.aguardandoProdutosOrcamento === true,
    arquivado: row.is_archived,
  };
}
