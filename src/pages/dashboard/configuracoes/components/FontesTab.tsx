import { useState } from 'react';
import { useFontesStore, type FonteLead } from '@/hooks/useFontesStore';
import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

const statusMeta: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativa na busca', className: 'border-primary-200 bg-primary-50 text-primary-700' },
  inativo: { label: 'Inativa na busca', className: 'border-background-200 bg-background-100 text-foreground-600' },
  pendente: { label: 'Aguardando validação', className: 'border-[#BC8B42]/25 bg-[#BC8B42]/12 text-[#8C651D]' },
  erro: { label: 'Com erro', className: 'border-[#BD3D32]/25 bg-[#BD3D32]/10 text-[#A52F27]' },
};

function sourceCanBeTested(source: FonteLead) {
  return source.sourceKey === 'apify';
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
    <div className="rounded-xl border border-background-200 bg-background-100 px-4 py-3 text-sm leading-6 text-foreground-600">
      <strong className="text-foreground-900">O que esta área controla:</strong> quais fontes validadas ficam disponíveis na Busca de Leads. Configurar a credencial acontece em APIs; aqui você ativa ou pausa o uso operacional.
    </div>
    {notice && <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">{notice}</div>}
    {fontes.length === 0 ? <div className="rounded-xl border border-dashed border-background-200 bg-white p-8 text-center"><i className="ri-radar-line text-2xl text-foreground-400" /><h3 className="mt-3 font-semibold text-foreground-950">Nenhuma fonte operacional cadastrada</h3><p className="mx-auto mt-1 max-w-lg text-sm text-foreground-500">Configure Apify ou Google Places na etapa de APIs. Depois que o conector for salvo e validado, ele será exibido aqui para ativação.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{fontes.map((source) => {
      const meta = statusMeta[source.status] || statusMeta.pendente;
      return <article key={source.remoteId || source.id} className="flex min-h-[248px] flex-col rounded-xl border border-background-200 bg-white p-5 shadow-2xs"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><i className={source.tipo === 'CSV' ? 'ri-file-upload-line text-lg' : 'ri-radar-line text-lg'} /></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${meta.className}`}>{meta.label}</span></div><h3 className="mt-4 font-semibold text-foreground-950">{source.nome}</h3><p className="mt-1 text-xs leading-5 text-foreground-500">{source.mapeamento}</p><dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-background-100 p-3 text-[11px]"><div><dt className="text-foreground-400">Conexão</dt><dd className="mt-0.5 font-semibold text-foreground-700">{source.connectionStatus === 'connected' ? 'Validada' : 'Pendente'}</dd></div><div><dt className="text-foreground-400">Busca de Leads</dt><dd className="mt-0.5 font-semibold text-foreground-700">{source.status === 'ativo' ? 'Ativa' : 'Inativa'}</dd></div></dl><div className="mt-3 text-[11px] text-foreground-400"><p>Última validação: {source.ultimaSincronizacao}</p>{source.lastError && <p className="mt-1 text-[#A52F27]">{source.lastError}</p>}</div><div className="mt-auto grid grid-cols-2 gap-2 pt-4"><button type="button" disabled={busy === `test-${source.id}`} onClick={() => void test(source)} className="wf-btn-secondary justify-center text-xs disabled:opacity-60">{busy === `test-${source.id}` ? 'Validando…' : 'Testar conexão'}</button><button type="button" disabled={busy === `toggle-${source.id}`} onClick={() => void toggle(source)} className={`${source.status === 'ativo' ? 'wf-btn-secondary' : 'wf-btn-primary'} justify-center text-xs disabled:opacity-60`}>{busy === `toggle-${source.id}` ? 'Salvando…' : source.status === 'ativo' ? 'Pausar fonte' : 'Ativar fonte'}</button></div></article>;
    })}</div>}
  </section>;
}
