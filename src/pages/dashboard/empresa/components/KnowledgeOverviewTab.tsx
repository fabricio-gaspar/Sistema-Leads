import { useEffect, useState } from 'react';
import DadosTab from './DadosTab';
import { loadKnowledgeCatalogItems, loadKnowledgeSources, type KnowledgeCatalogItem, type KnowledgeSource } from '@/lib/crm/catalogKnowledgeRepository';

function Metric({ label, value, detail, icon, tone = 'primary' }: { label: string; value: number; detail: string; icon: string; tone?: 'primary' | 'secondary' | 'accent' }) {
  const toneClass = tone === 'secondary' ? 'bg-secondary-100 text-secondary-700' : tone === 'accent' ? 'bg-accent-100 text-accent-700' : 'bg-primary-100 text-primary-700';
  return <div className="rounded-xl border border-background-200/70 bg-background-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-2xl font-heading font-extrabold text-foreground-950">{value}</p><p className="mt-1 text-sm font-semibold text-foreground-800">{label}</p><p className="mt-0.5 text-xs text-foreground-500">{detail}</p></div><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}><i className={icon} /></span></div></div>;
}

export default function KnowledgeOverviewTab() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [items, setItems] = useState<KnowledgeCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([loadKnowledgeSources(), loadKnowledgeCatalogItems({ includeInactive: true })])
      .then(([nextSources, nextItems]) => { if (active) { setSources(nextSources); setItems(nextItems); } })
      .catch(() => { if (active) setError('Não foi possível carregar os indicadores da base de conhecimento.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const activeForAna = items.filter((item) => item.status === 'active' && item.anaEnabled).length;
  const healthySources = sources.filter((source) => source.syncStatus === 'healthy' && source.enabled).length;

  return <div className="space-y-6">
    <section className="rounded-xl border border-background-200/70 bg-foreground-950 p-5 text-background-50 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-200">Empresa e conhecimento</p><h2 className="mt-1 font-heading text-xl font-bold">Uma fonte operacional para a Ana e para a Central</h2><p className="mt-2 text-sm leading-6 text-background-200">Produtos, serviços, catálogos e documentos mantêm URL de origem, revisão e status próprio. A Ana só consulta itens ativos e liberados.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-background-50/20 bg-background-50/10 px-3 py-2 text-xs font-semibold"><i className={loading ? 'ri-loader-4-line animate-spin' : 'ri-shield-check-line'} />{loading ? 'Atualizando base' : `${activeForAna} item(ns) disponíveis para a Ana`}</span></div>
      {error && <p className="mt-4 rounded-lg border border-accent-300/40 bg-accent-100/10 px-3 py-2 text-xs text-accent-100"><i className="ri-error-warning-line mr-1.5" />{error}</p>}
    </section>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Produtos e acessórios" value={items.filter((item) => item.type === 'product' && item.status === 'active').length} detail="Itens ativos no catálogo" icon="ri-shapes-line" />
      <Metric label="Serviços" value={items.filter((item) => item.type === 'service' && item.status === 'active').length} detail="Escopo comercial e técnico" icon="ri-tools-line" tone="secondary" />
      <Metric label="Catálogos e documentos" value={items.filter((item) => ['catalog', 'document'].includes(item.type) && item.status === 'active').length} detail="Links e arquivos rastreáveis" icon="ri-file-list-3-line" tone="primary" />
      <Metric label="Fontes saudáveis" value={healthySources} detail={`${sources.length} fonte(s) cadastrada(s)`} icon="ri-radar-line" tone={sources.some((source) => source.syncStatus === 'error') ? 'accent' : 'secondary'} />
    </div>

    <section className="rounded-xl border border-background-200/70 bg-background-50 p-5"><div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 text-primary-700"><i className="ri-building-2-line" /></span><div><h3 className="text-sm font-bold text-foreground-900">Dados da empresa</h3><p className="text-xs text-foreground-500">Informações institucionais usadas nas respostas da Ana.</p></div></div><DadosTab /></section>
  </div>;
}
