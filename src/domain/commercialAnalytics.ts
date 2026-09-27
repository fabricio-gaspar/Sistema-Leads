import type { Lead } from '@/mocks/leadsData';
import type { Proposta } from '@/mocks/propostasData';
import { ACTIVE_PIPELINE_STAGES, PIPELINE_STAGE_LABEL, stageFromLegacy } from './pipeline';
import { shouldDisplayInKanban } from '@/lib/crm/kanbanLeadVisibility';

export type AnalyticsPeriod = '7' | '30' | '90' | 'year';
export interface AnalyticsFilters { period: AnalyticsPeriod; owner: string; origin: string; stage: string; segment: string; }
export const initialAnalyticsFilters: AnalyticsFilters = { period: '30', owner: '', origin: '', stage: '', segment: '' };
export interface StageEvent { id: string; lead_id: string; from_stage: string | null; to_stage: string; created_at: string; }
export interface ContactEvent { id: string; lead_id: string; sender: string; type: string; created_at: string; sent_at: string | null; }
export const analyticsTimezone = 'America/Sao_Paulo';

export function dateKey(value: string | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: analyticsTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function shiftDay(key: string, amount: number): string {
  const day = new Date(`${key}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + amount); return day.toISOString().slice(0, 10);
}
export function analyticsWindow(period: AnalyticsPeriod, now = new Date()) {
  const end = dateKey(now); const start = period === 'year' ? `${end.slice(0, 4)}-01-01` : shiftDay(end, 1 - Number(period));
  const length = Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000) + 1;
  return { start, end, length, previousStart: shiftDay(start, -length), previousEnd: shiftDay(start, -1) };
}
export function isCommercialLead(lead: Lead): boolean { return !lead.arquivado && shouldDisplayInKanban(lead); }
export function percentage(value: number, base: number): number | null { return base > 0 ? value / base * 100 : null; }
export function variation(current: number, previous: number): number | null { return previous > 0 ? (current - previous) / previous * 100 : null; }
export function proposalNet(proposal: Proposta): number { return Math.round(proposal.valor * (1 - proposal.descontoPct / 100) * 100) / 100; }
export function matchesLeadDimensions(lead: Lead, filters: AnalyticsFilters): boolean {
  return !lead.arquivado && (!filters.owner || lead.responsavel === filters.owner)
    && (!filters.origin || lead.origem === filters.origin)
    && (!filters.segment || lead.segmento === filters.segment)
    && (!filters.stage || stageFromLegacy(lead.etapa) === filters.stage);
}
function inWindow(value: string, start: string, end: string): boolean { const key = dateKey(value); return Boolean(key) && key >= start && key <= end; }
const stageCodes: Record<string, string> = { novo: 'entered', apresentado: 'engaging', qualificando: 'qualified', reuniao: 'quote_preparation', orcamento: 'quote_sent', ganho: 'won', perdido: 'lost' };
function canonicalStage(value: string | null): string | null {
  if (!value) return null;
  return stageCodes[value] ?? (ACTIVE_PIPELINE_STAGES.includes(value as typeof ACTIVE_PIPELINE_STAGES[number]) ? value : null);
}

/** Photography of the selected creation cohort. Contact approval is never inferred from membership. */
export function buildCommercialAnalytics(leads: Lead[], proposals: Proposta[], filters: AnalyticsFilters, events: StageEvent[] = [], contacts: ContactEvent[] = [], now = new Date()) {
  const range = analyticsWindow(filters.period, now);
  const dimensions = leads.filter((lead) => matchesLeadDimensions(lead, filters));
  const cohort = dimensions.filter((lead) => inWindow(lead.createdAt ?? lead.criadoEm, range.start, range.end));
  const previous = dimensions.filter((lead) => inWindow(lead.createdAt ?? lead.criadoEm, range.previousStart, range.previousEnd));
  const pipeline = cohort.filter(isCommercialLead);
  const pending = cohort.filter((lead) => !isCommercialLead(lead));
  const reviewBacklog = leads.filter((lead) => !lead.arquivado && !isCommercialLead(lead));
  const won = pipeline.filter((lead) => stageFromLegacy(lead.etapa) === 'won');
  const active = pipeline.filter((lead) => !['won', 'lost'].includes(stageFromLegacy(lead.etapa)));
  const ids = new Set(dimensions.map((lead) => lead.id));
  const pipelineIds = new Set(dimensions.filter(isCommercialLead).map((lead) => lead.id));
  const selectedProposals = proposals.filter((proposal) => inWindow(proposal.createdAt ?? proposal.data, range.start, range.end)
    && Boolean(proposal.leadId && pipelineIds.has(proposal.leadId)));
  const openProposals = selectedProposals.filter((proposal) => ['enviada', 'visualizada'].includes(proposal.status));
  const acceptedProposals = selectedProposals.filter((proposal) => proposal.status === 'aceita');
  const days = Array.from({ length: range.length }, (_, index) => {
    const key = shiftDay(range.start, index);
    return { key, label: `${key.slice(8)}/${key.slice(5, 7)}`, encontrados: 0, anteriores: previous.filter((lead) => dateKey(lead.createdAt ?? lead.criadoEm) === shiftDay(range.previousStart, index)).length, carteira: 0, recebidas: 0, enviadas: 0, orcado: 0, aceito: 0 };
  });
  const dayMap = new Map(days.map((point) => [point.key, point]));
  cohort.forEach((lead) => { const point = dayMap.get(dateKey(lead.createdAt ?? lead.criadoEm)); if (point) { point.encontrados++; if (isCommercialLead(lead)) point.carteira++; } });
  selectedProposals.forEach((proposal) => { const point = dayMap.get(dateKey(proposal.createdAt ?? proposal.data)); if (point) { if (['enviada', 'visualizada'].includes(proposal.status)) point.orcado += proposalNet(proposal); if (proposal.status === 'aceita') point.aceito += proposalNet(proposal); } });
  contacts.filter((event) => ids.has(event.lead_id)).forEach((event) => {
    const inbound = ['lead', 'contact', 'cliente'].includes(event.sender.toLowerCase()) && event.type === 'received';
    const accepted = event.type === 'sent' && Boolean(event.sent_at);
    if (!inbound && !accepted) return;
    const point = dayMap.get(dateKey(inbound ? event.created_at : event.sent_at!));
    if (point) { if (inbound) point.recebidas++; else point.enviadas++; }
  });
  const stages = ACTIVE_PIPELINE_STAGES.map((stage) => ({ stage, name: PIPELINE_STAGE_LABEL[stage], value: pipeline.filter((lead) => stageFromLegacy(lead.etapa) === stage).length }));
  const acceptedLeadIds = new Set(acceptedProposals.map((proposal) => proposal.leadId));
  const cohortIds = new Set(cohort.map((lead) => lead.id));
  const groupPopulation = dimensions.filter((lead) => cohortIds.has(lead.id) || acceptedLeadIds.has(lead.id));
  const group = (key: 'origem' | 'responsavel' | 'segmento') => [...new Set(groupPopulation.map((lead) => lead[key] || 'Não informado'))].map((name) => {
    const members = cohort.filter((lead) => (lead[key] || 'Não informado') === name);
    const proposalLeadIds = new Set(dimensions.filter((lead) => (lead[key] || 'Não informado') === name).map((lead) => lead.id));
    return { name, encontrados: members.length, carteira: members.filter(isCommercialLead).length, ganhos: members.filter((lead) => isCommercialLead(lead) && stageFromLegacy(lead.etapa) === 'won').length,
      aceito: acceptedProposals.filter((proposal) => proposal.leadId && proposalLeadIds.has(proposal.leadId)).reduce((total, proposal) => total + proposalNet(proposal), 0),
    };
  }).sort((a, b) => b.encontrados - a.encontrados);
  const validEvents = events.filter((event) => pipelineIds.has(event.lead_id) && inWindow(event.created_at, range.start, range.end));
  const progression = ACTIVE_PIPELINE_STAGES.slice(0, 5).map((stage, index) => {
    const next = ACTIVE_PIPELINE_STAGES[index + 1];
    const entered = new Map<string, string>();
    validEvents.forEach((event) => {
      if (canonicalStage(event.from_stage) === stage || canonicalStage(event.to_stage) === stage) {
        if (!entered.has(event.lead_id) || event.created_at < entered.get(event.lead_id)!) entered.set(event.lead_id, event.created_at);
      }
    });
    const advanced = new Set(validEvents.filter((event) => canonicalStage(event.to_stage) === next && entered.has(event.lead_id) && event.created_at >= entered.get(event.lead_id)!).map((event) => event.lead_id));
    return { name: `${PIPELINE_STAGE_LABEL[stage]} → ${PIPELINE_STAGE_LABEL[next]}`, base: entered.size, advanced: advanced.size, rate: percentage(advanced.size, entered.size) };
  });
  return { range, cohort, previous, pipeline, pending, reviewBacklog, active, won, stages, progression, days, origins: group('origem'), owners: group('responsavel'), segments: group('segmento'),
    openProposals, acceptedProposals, expectedValue: openProposals.reduce((sum, proposal) => sum + proposalNet(proposal), 0),
    acceptedValue: acceptedProposals.reduce((sum, proposal) => sum + proposalNet(proposal), 0),
    conversion: percentage(won.length, pipeline.length), growth: variation(cohort.length, previous.length),
    human: active.filter((lead) => lead.modoAtendimento === 'HUMANO' || lead.automacaoStatus === 'AGUARDANDO_HUMANO').length,
  };
}
