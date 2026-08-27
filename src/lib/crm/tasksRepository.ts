import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { isUuid, persistentLeadId } from '@/lib/crm/leadMapper';
import type { Tarefa } from '@/lib/tipos';

interface CrmTaskRow {
  id: string;
  organization_id: string;
  lead_id: string | null;
  assigned_to: string | null;
  title: string;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

function taskToRow(task: Tarefa, organizationId: string, userId?: string): Partial<CrmTaskRow> & { organization_id: string; title: string } {
  return {
    id: persistentLeadId(task.id),
    organization_id: organizationId,
    lead_id: task.leadId && isUuid(task.leadId) ? task.leadId : null,
    assigned_to: task.responsavelId && isUuid(task.responsavelId) ? task.responsavelId : null,
    title: task.titulo.trim(),
    due_at: task.dataLimite ? new Date(`${task.dataLimite}T12:00:00`).toISOString() : null,
    completed_at: task.concluida ? new Date().toISOString() : null,
    metadata: {
      responsavel: task.responsavel,
      responsavelId: task.responsavelId,
      leadNome: task.leadNome,
      prioridade: task.prioridade,
      descricao: task.descricao,
      criadaEm: task.criadaEm,
    },
    ...(userId ? { created_by: userId } : {}),
  };
}

function rowToTask(row: CrmTaskRow): Tarefa {
  const meta = row.metadata ?? {};
  return {
    id: row.id,
    titulo: row.title,
    responsavel: typeof meta.responsavel === 'string' ? meta.responsavel : 'Sem responsável',
    responsavelId: typeof meta.responsavelId === 'string' ? meta.responsavelId : row.assigned_to ?? undefined,
    leadId: row.lead_id ?? undefined,
    leadNome: typeof meta.leadNome === 'string' ? meta.leadNome : undefined,
    prioridade: meta.prioridade === 'ALTA' || meta.prioridade === 'BAIXA' ? meta.prioridade : 'MEDIA',
    concluida: Boolean(row.completed_at),
    dataLimite: row.due_at?.slice(0, 10),
    criadaEm: typeof meta.criadaEm === 'string' ? meta.criadaEm : row.created_at,
    descricao: typeof meta.descricao === 'string' ? meta.descricao : undefined,
  };
}

export async function loadOperationalTasks(): Promise<Tarefa[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase
    .from('crm_tasks')
    .select('*')
    .eq('organization_id', session.organizationId)
    .order('completed_at', { ascending: true, nullsFirst: true })
    .order('due_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return ((data ?? []) as CrmTaskRow[]).map(rowToTask);
}

export async function persistOperationalTasks(previous: Tarefa[], next: Tarefa[]): Promise<Tarefa[]> {
  const session = await resolveOrganizationSession();
  const knownIds = new Set(previous.map((task) => task.id));
  const persisted = next.map((task) => ({ ...task, id: persistentLeadId(task.id) }));

  for (const task of persisted) {
    const row = taskToRow(task, session.organizationId, session.userId);
    const { error } = knownIds.has(task.id)
      ? await supabase.from('crm_tasks').update(row).eq('id', task.id).eq('organization_id', session.organizationId)
      : await supabase.from('crm_tasks').insert(row);
    if (error) throw error;
  }
  return persisted;
}
