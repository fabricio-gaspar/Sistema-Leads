import type { Lead } from '@/mocks/leadsData';
import type { Proposta } from '@/mocks/propostasData';
import { ACTIVE_PIPELINE_STAGES, PIPELINE_STAGE_LABEL, stageFromLegacy, type PipelineStageCode } from './pipeline';
import { analyticsWindow, dateKey, isCommercialLead, proposalNet, shiftDay, type AnalyticsPeriod, type StageEvent } from './commercialAnalytics';

export interface FunnelFilters {
  period: AnalyticsPeriod;
  owner: string;
  origin: string;
  stage: string;
  segment: string;
}

export const initialFunnelFilters: FunnelFilters = {
  period: '30',
  owner: '',
  origin: '',
  stage: '',
  segment: '',
};

const EMITTED_PROPOSAL_STATUSES = new Set<Proposta['status']>(['enviada', 'visualizada', 'aceita', 'recusada', 'expirada']);
const OPEN_PROPOSAL_STATUSES = new Set<Proposta['status']>(['enviada', 'visualizada']);

export function inFunnelWindow(value: string | undefined, start: string, end: string): boolean {
  const key = value ? dateKey(value) : '';
  return Boolean(key) && key >= start && key <= end;
}

export function matchesFunnelDimensions(lead: Lead, filters: FunnelFilters, includeStage = true): boolean {
  return !lead.arquivado
    && (!filters.owner || lead.responsavel === filters.owner)
    && (!filters.origin || lead.origem === filters.origin)
    && (!filters.segment || lead.segmento === filters.segment)
    && (!includeStage || !filters.stage || stageFromLegacy(lead.etapa) === filters.stage);
}

function eventStage(value: string | null): PipelineStageCode | null {
  if (!value) return null;
  if (ACTIVE_PIPELINE_STAGES.includes(value as PipelineStageCode)) return value as PipelineStageCode;
  const legacy: Record<string, PipelineStageCode> = {
    novo: 'entered', apresentado: 'engaging', qualificando: 'qualified', reuniao: 'quote_preparation', orcamento: 'quote_sent', ganho: 'won', perdido: 'lost',
  };
  return legacy[value] ?? null;
}

function proposalTimestamp(proposal: Proposta): string {
  return proposal.createdAt ?? proposal.data;
}

/** Select one current proposal revision per lead and proposal family. */
export function latestProposalRevisions(proposals: Proposta[]): Proposta[] {
  const latest = new Map<string, Proposta>();
  proposals.forEach((proposal) => {
    const key = `${proposal.leadId ?? `unlinked:${proposal.id}`}:${proposal.propostaPaiId ?? proposal.id}`;
    const current = latest.get(key);
    if (!current || proposal.versao > current.versao || (proposal.versao === current.versao && proposalTimestamp(proposal) > proposalTimestamp(current))) {
      latest.set(key, proposal);
    }
  });
  return [...latest.values()];
}

export function buildFunnelAnalytics(leads: Lead[], proposals: Proposta[], events: StageEvent[], filters: FunnelFilters, now = new Date()) {
  const range = analyticsWindow(filters.period, now);
  const historicalPopulation = leads.filter((lead) => matchesFunnelDimensions(lead, filters, false));
  const currentPopulation = leads.filter((lead) => matchesFunnelDimensions(lead, filters));
  const captured = historicalPopulation.filter((lead) => inFunnelWindow(lead.createdAt ?? lead.criadoEm, range.start, range.end));
  const previousCaptured = historicalPopulation.filter((lead) => inFunnelWindow(lead.createdAt ?? lead.criadoEm, range.previousStart, range.previousEnd));
  const portfolio = currentPopulation.filter(isCommercialLead);
  const portfolioIds = new Set(portfolio.map((lead) => lead.id));
  const historicalIds = new Set(historicalPopulation.map((lead) => lead.id));
  const revisions = latestProposalRevisions(proposals);
  const activeProposals = revisions.filter((proposal) => proposal.leadId && portfolioIds.has(proposal.leadId) && OPEN_PROPOSAL_STATUSES.has(proposal.status));
  const emittedProposals = revisions.filter((proposal) => proposal.leadId && historicalIds.has(proposal.leadId) && EMITTED_PROPOSAL_STATUSES.has(proposal.status));
  const decisions = events.filter((event) => historicalIds.has(event.lead_id) && inFunnelWindow(event.created_at, range.start, range.end) && ['won', 'lost'].includes(eventStage(event.to_stage) ?? ''));
  const wonDecisions = decisions.filter((event) => eventStage(event.to_stage) === 'won').length;
  const lostDecisions = decisions.filter((event) => eventStage(event.to_stage) === 'lost').length;
  const stageEvents = events.filter((event) => historicalIds.has(event.lead_id) && inFunnelWindow(event.created_at, range.start, range.end));
  const stageCounts = ACTIVE_PIPELINE_STAGES.map((stage) => {
    const stageLeads = portfolio.filter((lead) => stageFromLegacy(lead.etapa) === stage);
    const stageValue = activeProposals.filter((proposal) => proposal.leadId && stageLeads.some((lead) => lead.id === proposal.leadId)).reduce((sum, proposal) => sum + proposalNet(proposal), 0);
    return { stage, name: PIPELINE_STAGE_LABEL[stage], leads: stageLeads.length, value: stageValue };
  });
  const dayPoints = Array.from({ length: range.length }, (_, index) => {
    const key = shiftDay(range.start, index);
    return { key, label: `${key.slice(8)}/${key.slice(5, 7)}`, captured: 0, portfolio: 0, previous: 0, proposals: 0 };
  });
  const dayMap = new Map(dayPoints.map((day) => [day.key, day]));
  captured.forEach((lead) => { const day = dayMap.get(dateKey(lead.createdAt ?? lead.criadoEm)); if (day) day.captured += 1; });
  portfolio.forEach((lead) => { const day = dayMap.get(dateKey(lead.createdAt ?? lead.criadoEm)); if (day) day.portfolio += 1; });
  previousCaptured.forEach((lead) => { const key = dateKey(lead.createdAt ?? lead.criadoEm); const index = Math.round((Date.parse(`${key}T12:00:00Z`) - Date.parse(`${range.previousStart}T12:00:00Z`)) / 86_400_000); const day = dayPoints[index]; if (day) day.previous += 1; });
  emittedProposals.filter((proposal) => inFunnelWindow(proposalTimestamp(proposal), range.start, range.end)).forEach((proposal) => { const day = dayMap.get(dateKey(proposalTimestamp(proposal))); if (day) day.proposals += proposalNet(proposal); });
  const originRows = [...new Set(captured.map((lead) => lead.origem || 'Não informado'))].map((name) => {
    const rows = captured.filter((lead) => (lead.origem || 'Não informado') === name);
    return { name, count: rows.length, percentage: captured.length ? rows.length / captured.length * 100 : 0 };
  }).sort((a, b) => b.count - a.count);
  const progression = ACTIVE_PIPELINE_STAGES.slice(0, -2).map((stage, index) => {
    const next = ACTIVE_PIPELINE_STAGES[index + 1];
    const advanced = new Set(stageEvents.filter((event) => eventStage(event.to_stage) === next && eventStage(event.from_stage) === stage).map((event) => event.lead_id));
    const base = new Set(stageEvents.filter((event) => eventStage(event.to_stage) === stage || eventStage(event.from_stage) === stage).map((event) => event.lead_id));
    return { name: `${PIPELINE_STAGE_LABEL[stage]} → ${PIPELINE_STAGE_LABEL[next]}`, advanced: advanced.size, base: base.size, rate: base.size ? advanced.size / base.size * 100 : null };
  });
  return {
    range,
    captured,
    previousCaptured,
    portfolio,
    activeProposals,
    stageCounts,
    dayPoints,
    originRows,
    stageEvents,
    emittedProposals,
    decisions,
    wonDecisions,
    lostDecisions,
    decisionBase: wonDecisions + lostDecisions,
    conversion: wonDecisions + lostDecisions >= 10 ? wonDecisions / (wonDecisions + lostDecisions) * 100 : null,
    expectedValue: activeProposals.reduce((sum, proposal) => sum + proposalNet(proposal), 0),
    progression,
  };
}
