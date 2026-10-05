import { supabase } from '@/lib/supabase';

export type TechnicalDossier = {
  application: string | null;
  measurementOrDrawing: string | null;
  materialOrCondition: string | null;
  quantity: string | null;
  deadline: string | null;
  need: string | null;
};

export type LeadQualification = {
  leadId: string;
  summary: string | null;
  nextAction: string | null;
  nextActionDueAt: string | null;
  readinessScore: number | null;
  interestLevel: 'negative' | 'neutral' | 'positive' | 'hot';
  requestedAction: 'none' | 'follow_up' | 'meeting' | 'quote' | 'human';
  decisionMaker: string | null;
  objections: string[];
  missingFields: string[];
  technical: TechnicalDossier;
  updatedAt: string;
};

type QualificationRow = {
  lead_id: string;
  summary: string | null;
  next_action: string | null;
  next_action_due_at?: string | null;
  readiness_score: number | null;
  interest_level: LeadQualification['interestLevel'];
  requested_action: LeadQualification['requestedAction'];
  decision_maker: string | null;
  objections: unknown;
  missing_fields: unknown;
  technical_context: unknown;
  updated_at: string;
};

const asText = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const asList = (value: unknown, maximum = 8): string[] => Array.isArray(value)
  ? value.map(asText).filter((item): item is string => Boolean(item)).slice(0, maximum)
  : [];
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown>
  : {};

export function mapLeadQualification(row: QualificationRow): LeadQualification {
  const technical = asRecord(row.technical_context);
  return {
    leadId: row.lead_id,
    summary: asText(row.summary),
    nextAction: asText(row.next_action),
    nextActionDueAt: asText(row.next_action_due_at),
    readinessScore: typeof row.readiness_score === 'number' ? Math.max(0, Math.min(100, Math.round(row.readiness_score))) : null,
    interestLevel: row.interest_level,
    requestedAction: row.requested_action,
    decisionMaker: asText(row.decision_maker),
    objections: asList(row.objections),
    missingFields: asList(row.missing_fields),
    technical: {
      application: asText(technical.application),
      measurementOrDrawing: asText(technical.measurement_or_drawing),
      materialOrCondition: asText(technical.material_or_condition),
      quantity: asText(technical.quantity),
      deadline: asText(technical.deadline),
      need: asText(technical.need),
    },
    updatedAt: row.updated_at,
  };
}

export async function loadLeadQualification(leadId: string): Promise<LeadQualification | null> {
  const { data, error } = await supabase.from('lead_qualifications')
    .select('lead_id,summary,next_action,next_action_due_at,readiness_score,interest_level,requested_action,decision_maker,objections,missing_fields,technical_context,updated_at')
    .eq('lead_id', leadId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapLeadQualification(data as QualificationRow) : null;
}

/**
 * One bounded read for portfolio rows.  The table is already RLS-protected by
 * the current organization and lead access policies; this helper deliberately
 * does not introduce a client-side bypass or a new endpoint.
 */
export async function loadLeadQualifications(leadIds: string[]): Promise<Map<string, LeadQualification>> {
  const result = new Map<string, LeadQualification>();
  for (let index = 0; index < leadIds.length; index += 100) {
    const ids = leadIds.slice(index, index + 100);
    if (!ids.length) continue;
    const { data, error } = await supabase.from('lead_qualifications')
      .select('lead_id,summary,next_action,next_action_due_at,readiness_score,interest_level,requested_action,decision_maker,objections,missing_fields,technical_context,updated_at')
      .in('lead_id', ids);
    if (error) throw error;
    for (const row of (data ?? []) as QualificationRow[]) {
      const qualification = mapLeadQualification(row);
      result.set(qualification.leadId, qualification);
    }
  }
  return result;
}
