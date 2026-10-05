import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession, assertOrganizationSession } from '@/lib/organizationSession';
import { isUuid, persistentLeadId } from '@/lib/crm/leadMapper';
import type { Tarefa } from '@/lib/tipos';

interface CrmTaskRow {
  id: string;
  organization_id: string;
  lead_id: string | null;
  owner_id: string | null;
  owner_label: string | null;
  text: string;
  due_at: string | null;
  completed: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

function taskToRow(task: Tarefa, organizationId: string): Partial<CrmTaskRow> & { organization_id: string; text: string } {
  return {
    id: persistentLeadId(task.id),
    organization_id: organizationId,
    lead_id: task.leadId && isUuid(task.leadId) ? task.leadId : null,
    owner_id: task.responsavelId && isUuid(task.responsavelId) ? task.responsavelId : null,
    owner_label: task.responsavel || null,
    text: task.titulo.trim(),
    due_at: task.dataLimite ? new Date(`${task.dataLimite}T12:00:00`).toISOString() : null,
    completed: task.concluida,
    metadata: {
      responsavel: task.responsavel,
      responsavelId: task.responsavelId,
      leadNome: task.leadNome,
      prioridade: task.prioridade,
      descricao: task.descricao,
      criadaEm: task.criadaEm,
    },
  };
}

function rowToTask(row: CrmTaskRow): Tarefa {
  const meta = row.metadata ?? {};
  return {
    id: row.id,
    titulo: row.text,
    responsavel: typeof meta.responsavel === 'string' ? meta.responsavel : row.owner_label ?? 'Sem responsável',
    responsavelId: typeof meta.responsavelId === 'string' ? meta.responsavelId : row.owner_id ?? undefined,
    leadId: row.lead_id ?? undefined,
    leadNome: typeof meta.leadNome === 'string' ? meta.leadNome : undefined,
    prioridade: meta.prioridade === 'ALTA' || meta.prioridade === 'BAIXA' ? meta.prioridade : 'MEDIA',
    concluida: row.completed,
    dataLimite: row.due_at?.slice(0, 10),
    criadaEm: typeof meta.criadaEm === 'string' ? meta.criadaEm : row.created_at,
    descricao: typeof meta.descricao === 'string' ? meta.descricao : undefined,
  };
}

export async function loadOperationalTasks(): Promise<Tarefa[]> {
  const session = await resolveOrganizationSession();
  assertOrganizationSession(session);
  const { data, error } = await supabase
    .from('lead_tasks')
    .select('*')
    .eq('organization_id', session.organizationId)
    .order('completed', { ascending: true })
    .order('due_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return ((data ?? []) as CrmTaskRow[]).map(rowToTask);
}

export async function persistOperationalTasks(previous: Tarefa[], next: Tarefa[]): Promise<Tarefa[]> {
  const session = await resolveOrganizationSession();
  assertOrganizationSession(session);
  const knownIds = new Set(previous.map((task) => task.id));
  const persisted = next.map((task) => ({ ...task, id: persistentLeadId(task.id) }));

  for (const task of persisted) {
    assertOrganizationSession(session);
    const row = taskToRow(task, session.organizationId);
    const { error } = knownIds.has(task.id)
      ? await supabase.from('lead_tasks').update(row).eq('id', task.id).eq('organization_id', session.organizationId)
      : await supabase.from('lead_tasks').insert(row);
    if (error) throw error;
  }
  return persisted;
}
