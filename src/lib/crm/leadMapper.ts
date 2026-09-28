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
  ana_stage?: string | null;
  ana_outcome?: string | null;
  modo_atendimento?: string | null;
  origin: string | null;
  owner: string | null;
  owner_id?: string | null;
  assigned_to: string | null;
  opt_out: boolean | null;
  ai_paused: boolean | null;
  automation_status: string | null;
  contact_approval_status?: string | null;
  contact_approval_reason?: string | null;
  contact_approved_at?: string | null;
  contact_approved_by?: string | null;
  active_channel: string | null;
  city: string | null;
  uf?: string | null;
  size: string | null;
  source_metadata: Record<string, unknown> | null;
  source_record_id?: string | null;
  source_url?: string | null;
  pipeline_stage_id?: string | null;
  deduplication_key?: string | null;
  prospect_identity?: string | null;
  score_snapshot?: Record<string, unknown> | null;
  score_explanation?: string | null;
  score_source?: string | null;
  score_verified_at?: string | null;
  created_at: string;
  updated_at: string;
  /** Timestamp written by the conversation persistence when a commercial message is recorded. */
  last_contact?: string | null;
  next_action_at?: string | null;
  no_reply_deadline_at?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
}

export type LeadHandoffPolicyRow = {
  lead_id: string;
  handoff_stage: string;
  assignee_user_id: string;
  notify_whatsapp: boolean;
};

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

const anaStageToLegacy: Record<string, string> = {
  novo: 'Novo',
  apresentado: 'Apresentado',
  qualificando: 'Qualificando',
  reuniao: 'Reunião',
  orcamento: 'Orçamento',
  fechado: 'Ganho',
};

const legacyToAnaStage: Record<string, { stage: string; outcome?: 'ganho' | 'perdido' }> = {
  Novo: { stage: 'novo' },
  Apresentado: { stage: 'apresentado' },
  Qualificando: { stage: 'qualificando' },
  Reunião: { stage: 'reuniao' },
  Orçamento: { stage: 'orcamento' },
  Ganho: { stage: 'fechado', outcome: 'ganho' },
  Perdido: { stage: 'fechado', outcome: 'perdido' },
  'Em Contato': { stage: 'apresentado' },
  'Aguardando Resposta': { stage: 'apresentado' },
  'Em Qualificação': { stage: 'qualificando' },
  'Reunião Agendada': { stage: 'reuniao' },
  'Proposta em Preparação': { stage: 'orcamento' },
  'Orçamento Enviado': { stage: 'orcamento' },
  Negociação: { stage: 'orcamento' },
  'Fechado — Ganho': { stage: 'fechado', outcome: 'ganho' },
  'Fechado — Perdido': { stage: 'fechado', outcome: 'perdido' },
  Pausado: { stage: 'apresentado' },
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

export function canonicalLeadChannel(value: string | null | undefined): string | null {
  const normalized = (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized === 'whatsapp') return 'whatsapp';
  if (normalized === 'email') return 'email';
  if (normalized === 'instagram' || normalized === 'meta') return 'instagram';
  if (normalized === 'voice' || normalized === 'voip' || normalized === 'telefone') return 'voice';
  return normalized || null;
}

function leadChannelLabel(value: string | null): string | undefined {
  return ({ whatsapp: 'WhatsApp', email: 'E-mail', instagram: 'Instagram', voice: 'VoIP' } as Record<string, string>)[canonicalLeadChannel(value) ?? ''] ?? value ?? undefined;
}

function normalizedIdentity(lead: Lead): string | null {
  const cnpj = lead.cnpj.replace(/\D/g, '');
  if (cnpj.length === 14) return `cnpj:${cnpj}`;
  const whatsapp = lead.whatsapp.replace(/\D/g, '');
  if (whatsapp.length >= 10) return `whatsapp:${whatsapp}`;
  const email = lead.email.trim().toLowerCase();
  if (email) return `email:${email}`;
  const company = lead.empresa.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  return company ? `company:${company}` : null;
}

export function leadToCrmRow(lead: Lead, organizationId: string): Partial<CrmLeadRow> & { organization_id: string; company: string } {
  const ana = legacyToAnaStage[lead.etapa] ?? { stage: lead.anaStage ?? 'novo', outcome: lead.anaOutcome ?? undefined };
  const approvalStatus = lead.contactApprovalStatus ?? (lead.contatoPermitido ? 'approved' : 'pending');
  const scoreSnapshot = {
    fit: Math.max(0, Math.min(100, Math.round(lead.fitScore ?? lead.score))),
    contactability: Math.max(0, Math.min(100, Math.round(lead.contactabilityScore ?? 0))),
    engagement: Math.max(0, Math.min(100, Math.round(lead.engagementScore ?? 0))),
  };
  const identity = lead.deduplicationKey || normalizedIdentity(lead);
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
    stage: legacyToStage[lead.etapa] ?? databaseStageForAna(ana.stage),
    ana_stage: ana.stage,
    ana_outcome: ana.outcome ?? null,
    modo_atendimento: lead.modoAtendimento ? lead.modoAtendimento.toLowerCase() : null,
    origin: lead.origem.trim() || null,
    owner: lead.responsavel || 'ia',
    owner_id: lead.responsavelId && isUuid(lead.responsavelId) ? lead.responsavelId : null,
    assigned_to: lead.responsavelId && isUuid(lead.responsavelId) ? lead.responsavelId : null,
    opt_out: Boolean(lead.bloqueado || approvalStatus === 'rejected'),
    ai_paused: (lead.modoAtendimento ?? 'IA') === 'HUMANO',
    automation_status: approvalStatus !== 'approved' ? 'pending_approval' : lead.automacaoStatus === 'AGUARDANDO_HUMANO' ? 'human' : lead.automacaoStatus === 'PAUSADA' ? 'paused' : 'running',
    contact_approval_status: approvalStatus,
    contact_approval_reason: lead.contactApprovalReason?.trim() || null,
    contact_approved_at: approvalStatus === 'approved' ? (lead.contactApprovedAt || new Date().toISOString()) : null,
    active_channel: canonicalLeadChannel(lead.canalPreferencial),
    city: lead.cidade || null,
    uf: lead.estado || null,
    size: lead.porte || null,
    source_record_id: lead.sourceRecordId?.trim() || null,
    source_url: lead.sourceUrl?.trim() || null,
    deduplication_key: identity,
    prospect_identity: identity,
    score_snapshot: scoreSnapshot,
    score_explanation: lead.scoreExplanation?.trim() || null,
    score_source: lead.origem.trim() || null,
    score_verified_at: lead.scoreVerifiedAt || new Date().toISOString(),
    source_metadata: { cnpj: lead.cnpj, estado: lead.estado, tags: lead.tags, cargo: lead.cargo, campanha: lead.campanha, score_breakdown: scoreSnapshot },
  };
}

function databaseStageForAna(stage: string): string {
  return ({ novo: 'Prospecção', apresentado: 'Prospecção', qualificando: 'Qualificado', reuniao: 'Qualificado', orcamento: 'Proposta', fechado: 'Fechado' } as Record<string, string>)[stage] ?? 'Prospecção';
}

export function crmRowToLead(row: CrmLeadRow, handoffPolicy?: LeadHandoffPolicyRow): Lead {
  const meta = row.source_metadata ?? {};
  const score = row.score ?? 0;
  const isHuman = row.modo_atendimento === 'humano' || row.ai_paused || row.automation_status === 'human';
  const etapaAna = row.ana_stage ? (row.ana_stage === 'fechado' && row.ana_outcome === 'perdido' ? 'Perdido' : anaStageToLegacy[row.ana_stage] ?? 'Novo') : (stageToLegacy[row.stage] ?? 'Novo');
  const scoreSnapshot = row.score_snapshot ?? (meta.score_breakdown && typeof meta.score_breakdown === 'object' ? meta.score_breakdown as Record<string, unknown> : {});
  const approvalStatus = row.contact_approval_status === 'approved' || row.contact_approval_status === 'rejected' ? row.contact_approval_status : 'pending';
  const isContactApproved = row.contact_approval_status == null ? !row.opt_out : approvalStatus === 'approved';
  return {
    id: row.id, nome: row.contact ?? '', empresa: row.company,
    cnpj: typeof meta.cnpj === 'string' ? meta.cnpj : '—', email: row.email ?? '', telefone: row.phone ?? '', whatsapp: row.whatsapp ?? '',
    segmento: row.segment ?? '', cidade: row.city ?? '', estado: row.uf ?? (typeof meta.estado === 'string' ? meta.estado : ''), porte: row.size ?? '',
    score, temperatura: temperature(row.temp, score), etapa: etapaAna, origem: row.origin ?? '',
    responsavel: row.owner === 'ia' || !row.owner ? 'Ana (IA)' : row.owner,
    tags: Array.isArray(meta.tags) ? meta.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    // `updated_at` changes for administrative edits as well.  Prefer the
    // dedicated operational timestamp so the portfolio never presents an edit
    // as if it were a customer interaction.
    ultimaInteracao: row.last_contact ? new Date(row.last_contact).toLocaleString('pt-BR') : '—', criadoEm: row.created_at.slice(0, 10), createdAt: row.created_at, updatedAt: row.updated_at,
    cargo: typeof meta.cargo === 'string' ? meta.cargo : undefined, campanha: typeof meta.campanha === 'string' ? meta.campanha : undefined,
    modoAtendimento: isHuman ? 'HUMANO' : 'IA', automacaoStatus: isHuman ? 'AGUARDANDO_HUMANO' : row.automation_status === 'running' && approvalStatus === 'approved' ? 'ATIVA' : 'PAUSADA',
    responsavelId: row.owner_id ?? row.assigned_to ?? undefined, canalPreferencial: leadChannelLabel(row.active_channel),
    anaStage: row.ana_stage as Lead['anaStage'], anaOutcome: row.ana_outcome === 'ganho' || row.ana_outcome === 'perdido' ? row.ana_outcome : null,
    intencao: null, sentimento: 'NEUTRO', confianca: 0, proximaAcao: null, motivoTransferencia: '', nextFollowUpAt: row.next_action_at ?? null, timeoutAt: row.no_reply_deadline_at ?? null,
    followUpCount: 0, maxFollowUps: 2, automationEvents: [], historico: [], bloqueado: Boolean(row.opt_out), contatoPermitido: isContactApproved && !row.opt_out,
    consentimentoWhatsApp: isContactApproved && canonicalLeadChannel(row.active_channel) === 'whatsapp', consentimentoEmail: isContactApproved && canonicalLeadChannel(row.active_channel) === 'email',
    contactApprovalStatus: approvalStatus, contactApprovalReason: row.contact_approval_reason ?? '', contactApprovedAt: row.contact_approved_at ?? null,
    sourceRecordId: row.source_record_id ?? undefined, sourceUrl: row.source_url ?? undefined, deduplicationKey: row.deduplication_key ?? undefined,
    fitScore: typeof scoreSnapshot.fit === 'number' ? scoreSnapshot.fit : score, contactabilityScore: typeof scoreSnapshot.contactability === 'number' ? scoreSnapshot.contactability : 0,
    engagementScore: typeof scoreSnapshot.engagement === 'number' ? scoreSnapshot.engagement : 0, scoreExplanation: row.score_explanation ?? '', scoreVerifiedAt: row.score_verified_at ?? null,
    primeiroContatoEnviadoEm: null, aguardandoAtivacao: approvalStatus !== 'approved', noShows: 0, fluxosProgramados: [], arquivado: Boolean(row.archived_at),
    etapaHandoff: handoffPolicy?.handoff_stage, handoffWhatsappAtivo: handoffPolicy?.notify_whatsapp === true,
  };
}
