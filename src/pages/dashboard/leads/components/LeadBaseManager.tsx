import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';
import { isLeadPurgeConfirmationValid, leadPurgeConfirmation } from './leadPurgeConfirmation';

type LifecycleStatus = 'Em conversa' | 'Ativo' | 'Sem interação' | 'Inativo' | 'Ganho' | 'Perdido';

interface GovernedLead {
  id: string;
  company: string;
  contact: string | null;
  stage: string;
  owner: string;
  origin: string | null;
  created_at: string;
  last_activity_at: string | null;
  message_count: number;
  lifecycle_status: LifecycleStatus;
}

const statuses: Array<'Todos' | LifecycleStatus> = ['Todos', 'Em conversa', 'Ativo', 'Sem interação', 'Inativo', 'Ganho', 'Perdido'];

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Sem interação';
}

function errorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'permission_denied') return 'Seu usuário não possui acesso à gestão completa da base de leads.';
  if (code === 'lead_purge_confirmation_required') return 'A confirmação digitada não confere com a quantidade selecionada.';
  if (code === 'lead_purge_selection_changed') return 'A base foi alterada enquanto a exclusão era confirmada. Atualize a lista e tente novamente.';
  return 'Não foi possível concluir a ação solicitada na base de leads.';
}

async function invoke<T>(action: 'snapshot' | 'purge', body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('lead-governance', { body: { action, ...body } });
  if (error || !data?.ok) throw new Error(data?.erro ?? await detalheDoErroDeFuncao(error));
  return data as T;
}

const badge: Record<LifecycleStatus, string> = {
  'Em conversa': 'bg-primary-100 text-primary-800',
  Ativo: 'bg-primary-50 text-primary-800',
  'Sem interação': 'bg-background-100 text-foreground-600',
  Inativo: 'bg-accent-50 text-accent-800',
  Ganho: 'bg-primary-600 text-white',
  Perdido: 'bg-background-200 text-foreground-600',
};

export default function LeadBaseManager() {
  const [leads, setLeads] = useState<GovernedLead[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'Todos' | LifecycleStatus>('Todos');
  const [owner, setOwner] = useState('Todos');
  const [selected, setSelected] = useState<string[]>([]);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeConfirmation, setPurgeConfirmation] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<{ leads: GovernedLead[]; can_delete: boolean }>('snapshot');
      setLeads(result.leads);
      setCanDelete(result.can_delete);
      setNotice('');
    } catch (error) { setNotice(errorMessage(error)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const owners = useMemo(() => ['Todos', ...Array.from(new Set(leads.map((lead) => lead.owner || 'Sem responsável'))).sort()], [leads]);
  const filtered = useMemo(() => leads.filter((lead) => {
    const haystack = `${lead.company} ${lead.contact ?? ''} ${lead.origin ?? ''}`.toLocaleLowerCase('pt-BR');
    return (status === 'Todos' || lead.lifecycle_status === status)
      && (owner === 'Todos' || (lead.owner || 'Sem responsável') === owner)
      && haystack.includes(query.toLocaleLowerCase('pt-BR').trim());
  }), [leads, owner, query, status]);
  const counts = useMemo(() => Object.fromEntries(statuses.map((item) => [item, item === 'Todos' ? leads.length : leads.filter((lead) => lead.lifecycle_status === item).length])), [leads]);

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  const toggleFiltered = () => setSelected((current) => filtered.length > 0 && filtered.every((lead) => current.includes(lead.id)) ? current.filter((id) => !filtered.some((lead) => lead.id === id)) : [...new Set([...current, ...filtered.map((lead) => lead.id)])]);

  const openPurgeDialog = () => {
    if (!selected.length || !canDelete) return;
    setPurgeConfirmation('');
    setPurgeDialogOpen(true);
  };

  const purge = async () => {
    if (!selected.length || !canDelete || !isLeadPurgeConfirmationValid(purgeConfirmation, selected.length)) return;
    setBusy(true);
    try {
      const result = await invoke<{ deleted_count: number }>('purge', { lead_ids: selected, confirmation: purgeConfirmation });
      setSelected([]);
      setPurgeDialogOpen(false);
      setPurgeConfirmation('');
      setNotice(`${result.deleted_count} lead(s) foram removidos definitivamente da base.`);
      await load();
    } catch (error) { setNotice(errorMessage(error)); }
    finally { setBusy(false); }
  };

  return <section className="mb-5 rounded-xl border border-background-200 bg-background-50 p-5 shadow-2xs">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-primary-700">Gestão da base</p>
        <h2 className="mt-1 font-heading text-lg font-bold text-foreground-950">Status e limpeza definitiva de leads</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-foreground-500">A lista usa a atividade registrada em Leads e na Central. A exclusão remove o lead selecionado e seus vínculos operacionais da organização.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading || busy} className="wf-btn-secondary text-sm disabled:opacity-60"><i className="ri-refresh-line" />Atualizar</button>
    </div>
    {notice && <p className="mt-4 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-sm text-primary-800">{notice}</p>}
    <div className="mt-5 flex flex-wrap gap-2">{statuses.map((item) => <button key={item} type="button" onClick={() => setStatus(item)} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${status === item ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-background-200 bg-white text-foreground-600 hover:bg-background-100'}`}>{item} <span className="ml-1 text-foreground-500">{counts[item]}</span></button>)}</div>
    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_190px]">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por empresa, contato ou origem" className="w-full rounded-xl border border-background-200 bg-white px-3 py-2.5 text-sm" />
      <select value={owner} onChange={(event) => setOwner(event.target.value)} className="rounded-xl border border-background-200 bg-white px-3 py-2.5 text-sm"><option value="Todos">Todos os responsáveis</option>{owners.filter((item) => item !== 'Todos').map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <button type="button" disabled={!canDelete || selected.length === 0 || busy} onClick={openPurgeDialog} className="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"><i className="ri-delete-bin-6-line mr-1.5" />Excluir selecionados ({selected.length})</button>
    </div>
    {loading ? <p className="py-10 text-center text-sm text-foreground-500">Carregando status reais da base…</p> : <div className="mt-4 overflow-x-auto rounded-xl border border-background-200"><table className="w-full min-w-[760px] text-sm"><thead className="bg-background-100 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground-500"><tr><th className="w-12 px-4 py-3"><input aria-label="Selecionar leads filtrados" type="checkbox" checked={filtered.length > 0 && filtered.every((lead) => selected.includes(lead.id))} onChange={toggleFiltered} disabled={!canDelete} className="h-4 w-4 accent-primary-600" /></th><th className="px-4 py-3">Lead</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Interação</th><th className="px-4 py-3 text-right">Mensagens</th></tr></thead><tbody>{filtered.map((lead) => <tr key={lead.id} className="border-t border-background-200/70"><td className="px-4 py-3"><input aria-label={`Selecionar ${lead.company}`} type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggle(lead.id)} disabled={!canDelete} className="h-4 w-4 accent-primary-600" /></td><td className="px-4 py-3"><p className="font-semibold text-foreground-800">{lead.company}</p><p className="mt-0.5 text-xs text-foreground-500">{lead.contact || 'Contato não informado'} · {lead.origin || 'Origem não informada'}</p></td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge[lead.lifecycle_status]}`}>{lead.lifecycle_status}</span><p className="mt-1 text-xs text-foreground-500">{lead.stage}</p></td><td className="px-4 py-3 text-foreground-600">{lead.owner || 'Sem responsável'}</td><td className="px-4 py-3 text-foreground-600">{formatDate(lead.last_activity_at)}</td><td className="px-4 py-3 text-right font-medium text-foreground-700">{lead.message_count}</td></tr>)}</tbody></table>{filtered.length === 0 && <p className="px-5 py-10 text-center text-sm text-foreground-500">Nenhum lead corresponde aos filtros selecionados.</p>}</div>}
    {!canDelete && !loading && <p className="mt-3 text-xs leading-5 text-foreground-500">Seu acesso permite consultar a base, mas não excluir leads definitivamente.</p>}
    {purgeDialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/50 p-4" onClick={() => !busy && setPurgeDialogOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="lead-purge-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-accent-700">Ação irreversível</p>
        <h3 id="lead-purge-title" className="mt-1 font-heading text-xl font-bold text-foreground-950">Excluir {selected.length} lead(s) definitivamente?</h3>
        <p className="mt-3 text-sm leading-6 text-foreground-600">Serão removidos os leads selecionados e seus vínculos operacionais: mensagens, tarefas, propostas, eventos e filas. Essa ação não pode ser desfeita.</p>
        <label className="mt-5 block text-sm font-semibold text-foreground-800">Digite <code className="rounded bg-background-100 px-1.5 py-1 text-xs">{leadPurgeConfirmation(selected.length)}</code> para confirmar
          <input autoFocus value={purgeConfirmation} onChange={(event) => setPurgeConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-background-300 bg-white px-3 py-2.5 text-sm font-normal text-foreground-900 outline-none focus:border-accent-500" aria-label="Confirmação da exclusão definitiva" />
        </label>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setPurgeDialogOpen(false)} disabled={busy} className="rounded-xl border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-700 hover:bg-background-100 disabled:opacity-60">Cancelar</button>
          <button type="button" onClick={() => void purge()} disabled={busy || !isLeadPurgeConfirmationValid(purgeConfirmation, selected.length)} className="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Excluindo…' : 'Excluir definitivamente'}</button>
        </div>
      </div>
    </div>}
  </section>;
}
