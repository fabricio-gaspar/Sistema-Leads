import { supabase } from '@/lib/supabase';
import { assertOrganizationSession, resolveOrganizationSession, type OrganizationSession } from '@/lib/organizationSession';
import { leadToCrmRow, isUuid } from '@/lib/crm/leadMapper';
import type { Lead } from '@/mocks/leadsData';

export interface ProspectingBatchInput {
  importGroupId?: string;
  batchId: string;
  leads: Lead[];
  listName: string;
  listCriteria: { segmento: string; cidade: string; estado: string; fonte: string };
}

export interface ProspectingBatchResult {
  listId: string;
  leadIds: string[];
  duplicateCount: number;
  alreadyImported: boolean;
}

/** A única mutação da revisão: o RPC grava lista, leads e vínculos no mesmo commit. */
async function importBatch(
  rpcName: 'import_prospecting_batch' | 'import_prospecting_bulk_batch',
  input: ProspectingBatchInput,
  expectedSession?: OrganizationSession,
): Promise<ProspectingBatchResult> {
  if (!isUuid(input.batchId) || input.leads.length === 0 || input.leads.length > 100) {
    throw new Error('prospecting_import_invalid_request');
  }
  const session = expectedSession ?? await resolveOrganizationSession();
  try {
    assertOrganizationSession(session);
  } catch {
    throw new Error('prospecting_import_organization_changed');
  }
  const rows = input.leads.map((lead) => leadToCrmRow(lead, session.organizationId));
  if (rpcName === 'import_prospecting_bulk_batch' && !isUuid(input.importGroupId ?? '')) {
    throw new Error('prospecting_import_invalid_group');
  }
  const payload = {
    p_batch_id: input.batchId,
    p_leads: rows,
    p_list_name: input.listName,
    p_list_criteria: input.listCriteria,
    ...(rpcName === 'import_prospecting_bulk_batch' ? { p_import_group_id: input.importGroupId } : {}),
  };
  const { data, error } = await supabase.rpc(rpcName, payload);
  if (error) throw error;
  const result = data as Partial<ProspectingBatchResult> | null;
  const duplicateCount = typeof result?.duplicateCount === 'number' && Number.isInteger(result.duplicateCount)
    ? result.duplicateCount
    : 0;
  const validCount = rpcName === 'import_prospecting_bulk_batch'
    ? (result?.leadIds?.length ?? -1) + duplicateCount === input.leads.length
    : result?.leadIds?.length === input.leads.length && duplicateCount === 0;
  if (!result || result.listId !== input.batchId || !Array.isArray(result.leadIds)
    || !validCount || duplicateCount < 0 || !result.leadIds.every(isUuid)
    || typeof result.alreadyImported !== 'boolean') {
    throw new Error('prospecting_import_result_unconfirmed');
  }
  return { ...result, duplicateCount } as ProspectingBatchResult;
}

export async function importProspectingBatch(input: ProspectingBatchInput, expectedSession?: OrganizationSession): Promise<ProspectingBatchResult> {
  return importBatch('import_prospecting_batch', input, expectedSession);
}

/** Importação de arquivo: o servidor também exige leitura global da carteira. */
export async function importProspectingBulkBatch(input: ProspectingBatchInput, expectedSession?: OrganizationSession): Promise<ProspectingBatchResult> {
  return importBatch('import_prospecting_bulk_batch', input, expectedSession);
}
