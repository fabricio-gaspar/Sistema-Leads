import { useState } from 'react';
import { useFontesStore, type FonteLead } from '@/hooks/useFontesStore';
import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

const statusMeta: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativa', className: 'border-[#34C759]/25 bg-[#34C759]/12 text-[#218838]' },
  inativo: { label: 'Pausada', className: 'border-[#86868B]/20 bg-[#F2F2F7] text-[#6E6E73]' },
  pendente: { label: 'Aguardando validação', className: 'border-[#FF9500]/25 bg-[#FF9500]/12 text-[#B76100]' },
  erro: { label: 'Com erro', className: 'border-[#FF3B30]/25 bg-[#FF3B30]/10 text-[#D92D27]' },
};

function sourceCanBeTested(source: FonteLead) {
  return source.sourceKey === 'apify' || source.sourceKey === 'google_places';
}

export default function FontesTab() {
  const { fontes, definirAtivacao, recarregar } = useFontesStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const test = async (source: FonteLead) => {
    if (!sourceCanBeTested(source)) { setNotice(`${source.nome} não possui teste de provedor implementado nesta versão.`); return; }
    setBusy(`test-${source.id}`); setNotice('');
    try {
      const { data, error } = await supabase.functions.invoke('testar-integracao', { body: { canal: source.sourceKey } });
      if (error || !data?.pronto) throw new Error(error ? await detalheDoErroDeFuncao(error) : data?.erro || data?.detalhe || 'validation_failed');
      await recarregar();
      setNotice(`${source.nome} foi validada. Você pode ativá-la para a Busca de Leads.`);
    } catch (cause) { setNotice(`Não foi possível validar ${source.nome}: ${cause instanceof Error ? cause.message : 'tente novamente.'}`); }
    finally { setBusy(null); }
  };

  const toggle = async (source: FonteLead) => {
    const activate = source.status !== 'ativo';
    setBusy(`toggle-${source.id}`); setNotice('');
    try {
      await definirAtivacao(source.id, activate);
      setNotice(activate ? `${source.nome} está ativa para a Busca de Leads.` : `${source.nome} foi pausada para a Busca de Leads.`);
    } catch (cause) {
      setNotice(cause instanceof Error && cause.message === 'source_not_validated'
        ? `${source.nome} precisa ser configurada e validada antes de ser ativada.`
        : `Não foi possível alterar ${source.nome}.`);
    } finally { setBusy(null); }
  };

  return <section className="space-y-4">
    <div className="rounded-xl border border-[#E5E5EA] bg-[#F8F9FA] px-4 py-3 text-sm text-[#4A4A4D]">
      <strong>Fontes realmente cadastradas.</strong> Esta lista vem de <span className="font-mono text-xs">lead_source_configs</span>. Não é possível criar uma fonte apenas no navegador; novas fontes exigem um conector de backend antes de aparecerem aqui.
    </div>
    {notice && <div className="rounded-xl border border-[#0071E3]/20 bg-[#F2F7FF] px-4 py-3 text-sm text-[#1559A6]">{notice}</div>}
    {fontes.length === 0 ? <div className="rounded-2xl border border-dashed border-[#E5E5EA] bg-white p-8 text-center"><i className="ri-radar-line text-2xl text-[#86868B]" /><h3 className="mt-3 font-bold text-[#1D1D1F]">Nenhuma fonte operacional cadastrada</h3><p className="mx-auto mt-1 max-w-lg text-sm text-[#6E6E73]">Configure Apify ou Google Places acima. Depois que o conector for salvo, testado e confirmado pelo backend, ele será exibido aqui.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{fontes.map((source) => {
      const meta = statusMeta[source.status] || statusMeta.pendente;
      return <article key={source.remoteId || source.id} className="flex min-h-[230px] flex-col rounded-2xl border border-[#E5E5EA] bg-white p-5 shadow-2xs"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2F2F7] text-[#0071E3]"><i className={source.tipo === 'CSV' ? 'ri-file-upload-line text-lg' : 'ri-radar-line text-lg'} /></div><span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold ${meta.className}`}>{meta.label}</span></div><h3 className="mt-4 font-bold text-[#1D1D1F]">{source.nome}</h3><p className="mt-1 text-xs leading-relaxed text-[#6E6E73]">{source.mapeamento}</p><div className="mt-4 text-[11px] text-[#86868B]"><p>Última validação: {source.ultimaSincronizacao}</p>{source.lastError && <p className="mt-1 text-[#D92D27]">{source.lastError}</p>}</div><div className="mt-auto grid grid-cols-2 gap-2 pt-4"><button type="button" disabled={busy === `test-${source.id}`} onClick={() => void test(source)} className="wf-btn-secondary justify-center text-xs disabled:opacity-60">{busy === `test-${source.id}` ? 'Validando…' : 'Testar'}</button><button type="button" disabled={busy === `toggle-${source.id}`} onClick={() => void toggle(source)} className={`${source.status === 'ativo' ? 'wf-btn-secondary' : 'wf-btn-primary'} justify-center text-xs disabled:opacity-60`}>{busy === `toggle-${source.id}` ? 'Salvando…' : source.status === 'ativo' ? 'Pausar' : 'Ativar'}</button></div></article>;
    })}</div>}
  </section>;
}
