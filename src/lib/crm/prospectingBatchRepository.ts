import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { leadToCrmRow, isUuid } from '@/lib/crm/leadMapper';
import type { Lead } from '@/mocks/leadsData';

export interface ProspectingBatchInput {
  batchId: string;
  leads: Lead[];
  listName: string;
  listCriteria: { segmento: string; cidade: string; estado: string; fonte: string };
}

export interface ProspectingBatchResult {
  listId: string;
  leadIds: string[];
  alreadyImported: boolean;
}

/** A única mutação da revisão: o RPC grava lista, leads e vínculos no mesmo commit. */
export async function importProspectingBatch(input: ProspectingBatchInput): Promise<ProspectingBatchResult> {
  if (!isUuid(input.batchId) || input.leads.length === 0 || input.leads.length > 100) {
    throw new Error('prospecting_import_invalid_request');
  }
  const session = await resolveOrganizationSession();
  const rows = input.leads.map((lead) => leadToCrmRow(lead, session.organizationId));
  const { data, error } = await supabase.rpc('import_prospecting_batch', {
    p_batch_id: input.batchId,
    p_leads: rows,
    p_list_name: input.listName,
    p_list_criteria: input.listCriteria,
  });
  if (error) throw error;
  const result = data as Partial<ProspectingBatchResult> | null;
  if (!result || result.listId !== input.batchId || !Array.isArray(result.leadIds)
    || result.leadIds.length !== input.leads.length || !result.leadIds.every(isUuid)
    || typeof result.alreadyImported !== 'boolean') {
    throw new Error('prospecting_import_result_unconfirmed');
  }
  return result as ProspectingBatchResult;
}
