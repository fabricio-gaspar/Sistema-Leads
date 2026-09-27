import { useCallback, useEffect, useState } from 'react';
import { previewTestLeadCleanup, purgeConfirmedTestLeads, type TestLeadCandidate } from '@/lib/crm/testLeadCleanupRepository';

export default function TestLeadCleanupPanel() {
  const [candidates, setCandidates] = useState<TestLeadCandidate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await previewTestLeadCleanup();
      setCandidates(rows);
      setSelected((current) => current.filter((id) => rows.some((row) => row.id === id)));
      setError('');
    } catch {
      setError('Não foi possível identificar os leads de teste agora. Nenhum dado foi removido.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const remove = async () => {
    if (!selected.length || purging) return;
    if (!window.confirm(`Remover ${selected.length} lead(s) de teste selecionado(s), incluindo conversas, filas, mensagens e histórico operacional? Esta ação não pode ser desfeita.`)) return;
    setPurging(true); setError(''); setNotice('');
    try {
      const count = await purgeConfirmedTestLeads(selected);
      setNotice(`${count} lead(s) de teste foram removidos com seus vínculos operacionais.`);
      setSelected([]);
      await refresh();
    } catch {
      setError('A limpeza não foi concluída. O banco preservou os dados; atualize a lista e tente novamente.');
    } finally { setPurging(false); }
  };

  return <section className="wf-surface overflow-hidden" aria-label="Limpeza de testes">
    <div className="flex flex-col gap-3 border-b border-background-200/70 px-5 py-4 sm:flex-row sm:items-start sm:justify-between md:px-6">
      <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Base operacional</p><h3 className="mt-1 font-heading font-bold text-foreground-950">Limpar leads de teste</h3><p className="mt-1 max-w-2xl text-xs leading-relaxed text-foreground-500">A lista mostra somente candidatos identificados por marcadores de teste e pelas referências anteriores. Se houver dúvida, deixe o contato desmarcado.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading || purging} className="wf-btn-secondary shrink-0 text-xs disabled:opacity-60"><i className="ri-refresh-line" />Atualizar lista</button>
    </div>
    <div className="space-y-3 p-5 md:p-6">
      {error && <p className="rounded-xl border border-[#BD3D32]/25 bg-[#BD3D32]/10 px-3 py-2.5 text-xs text-[#84251F]">{error}</p>}
      {notice && <p className="rounded-xl border border-[#168654]/25 bg-[#168654]/10 px-3 py-2.5 text-xs text-[#116B43]">{notice}</p>}
      {loading ? <p className="text-sm text-foreground-500">Identificando dados de teste…</p> : candidates.length === 0 ? <p className="rounded-xl border border-[#168654]/25 bg-[#168654]/10 px-3 py-3 text-sm text-[#116B43]">Nenhum lead de teste identificado nesta empresa.</p> : <>
        <div className="space-y-2">
          {candidates.map((candidate) => <label key={candidate.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-background-200 bg-background-50/60 px-3 py-3 transition hover:bg-background-100">
            <input type="checkbox" checked={selected.includes(candidate.id)} onChange={() => toggle(candidate.id)} className="mt-0.5 h-4 w-4 rounded border-background-300 text-primary-600 focus:ring-primary-500" />
            <span className="min-w-0 flex-1"><strong className="block text-sm text-foreground-900">{candidate.contact} · {candidate.company}</strong><span className="mt-0.5 block text-xs text-foreground-500">{candidate.reason}{candidate.phoneSuffix ? ` Telefone final ${candidate.phoneSuffix}.` : ''}</span><span className="mt-1 block font-mono text-[10px] text-foreground-400">{candidate.messageCount} mensagens · {candidate.jobCount} itens de fila · {candidate.runCount} execuções da Ana</span></span>
          </label>)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F2F4F8] px-3 py-3"><p className="text-xs text-foreground-600">{selected.length ? `${selected.length} selecionado(s) para remoção definitiva.` : 'Selecione somente os contatos usados nos testes.'}</p><button type="button" onClick={() => void remove()} disabled={!selected.length || purging} className="wf-btn-primary bg-[#BD3D32] hover:bg-[#A52F27] text-xs disabled:opacity-60"><i className="ri-delete-bin-6-line" />{purging ? 'Removendo…' : 'Remover selecionados'}</button></div>
      </>}
    </div>
  </section>;
}
