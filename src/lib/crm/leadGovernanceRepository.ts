import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

export interface LeadPurgeResult {
  deletedCount: number;
}

/**
 * Removes an explicitly confirmed set of leads through the protected server
 * operation. The Edge Function verifies the caller permission again and
 * deletes the operational graph transactionally in the database.
 */
export async function purgeOperationalLeads(leadIds: string[], confirmation: string): Promise<LeadPurgeResult> {
  const { data, error } = await supabase.functions.invoke('lead-governance', {
    body: { action: 'purge', lead_ids: leadIds, confirmation },
  });
  if (error || !data?.ok) throw new Error(data?.erro ?? await detalheDoErroDeFuncao(error));
  return { deletedCount: Number(data.deleted_count) || 0 };
}

export function leadPurgeErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'permission_denied') return 'Seu usuário não possui permissão para excluir leads definitivamente.';
  if (code === 'lead_purge_confirmation_required') return 'A confirmação digitada não confere com os leads selecionados.';
  if (code === 'lead_purge_selection_changed') return 'A base mudou antes da confirmação. Atualize a lista e tente novamente.';
  if (code === 'lead_selection_required') return 'Selecione ao menos um lead para excluir.';
  return 'Não foi possível excluir o lead. Nenhum dado foi removido sem confirmação do servidor.';
}
