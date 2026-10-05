import { useEffect, useMemo, useState } from 'react';
import {
  catalogTypeLabel, formatKnowledgeMessage, loadKnowledgeCatalogItems, loadRelatedKnowledgeItems,
  type KnowledgeCatalogItem, type KnowledgeCatalogItemType, type KnowledgePresentationFormat,
} from '@/lib/crm/catalogKnowledgeRepository';

type Tab = 'suggestions' | 'product' | 'service' | 'catalog' | 'document';

const allTabs: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'suggestions', label: 'Sugestões', icon: 'ri-magic-line' },
  { id: 'product', label: 'Produtos', icon: 'ri-shapes-line' },
  { id: 'service', label: 'Serviços', icon: 'ri-tools-line' },
  { id: 'catalog', label: 'Catálogos', icon: 'ri-book-open-line' },
  { id: 'document', label: 'Arquivos', icon: 'ri-file-text-line' },
];

const typeIcon: Record<KnowledgeCatalogItemType, string> = {
  product: 'ri-shapes-line', service: 'ri-tools-line', catalog: 'ri-book-open-line', document: 'ri-file-text-line',
};

const ignoredSuggestionTerms = new Set(['para', 'com', 'sem', 'uma', 'que', 'qual', 'como', 'sobre', 'ola', 'tudo', 'bem', 'sou', 'ana']);

function normalize(value: string) {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function relevance(item: KnowledgeCatalogItem, context: string): number {
  const terms = normalize(context).split(' ').filter((term) => term.length >= 3 && !ignoredSuggestionTerms.has(term));
  if (!terms.length) return 0;
  const content = normalize([item.name, item.code, item.category, item.material, item.shortDescription, item.technicalDescription, item.applications.join(' '), item.keywords.join(' ')].filter(Boolean).join(' '));
  const matches = terms.filter((term) => content.includes(term));
  return matches.length >= 2 ? matches.length : 0;
}

function isLandingPage(item: KnowledgeCatalogItem): boolean {
  return /^wayflex\s*[—-]/i.test(item.name) && /^(catalogs|services)$/i.test(item.category ?? '');
}

export interface PreparedKnowledgeContent {
  item: KnowledgeCatalogItem;
  format: KnowledgePresentationFormat;
  text: string;
  sendImage: boolean;
}

export default function ConversationKnowledgePanel({ context, onPrepare, className = '' }: { context: string; onPrepare: (content: PreparedKnowledgeContent) => void; className?: string }) {
  const [tab, setTab] = useState<Tab>('suggestions');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<KnowledgeCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<KnowledgeCatalogItem | null>(null);
  const [related, setRelated] = useState<KnowledgeCatalogItem[]>([]);

  useEffect(() => {
    let active = true;
    void loadKnowledgeCatalogItems({ includeInactive: false, limit: 150 })
      .then((next) => { if (active) { setItems(next); setError(''); } })
      .catch(() => { if (active) setError('Não foi possível carregar o conhecimento da empresa agora.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const tabs = useMemo(() => allTabs.filter((item) => item.id !== 'document' || items.some((knowledge) => knowledge.type === 'document')), [items]);

  const displayed = useMemo(() => {
    const needle = normalize(query);
    const typed = tab === 'suggestions' ? items.filter((item) => !isLandingPage(item)) : items.filter((item) => item.type === tab);
    const searched = !needle ? typed : typed.filter((item) => normalize([item.name, item.code, item.category, item.material, item.shortDescription, item.technicalDescription, item.applications.join(' '), item.keywords.join(' ')].filter(Boolean).join(' ')).includes(needle));
    if (tab !== 'suggestions') return searched;
    if (!normalize(context)) return [];
    return searched.map((item) => ({ item, score: relevance(item, context) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .map(({ item }) => item);
  }, [context, items, query, tab]);

  const preview = async (item: KnowledgeCatalogItem) => {
    setSelected(item);
    setRelated([]);
    try { setRelated(await loadRelatedKnowledgeItems(item.id)); } catch { setError('O item foi aberto, mas os conteúdos relacionados não puderam ser carregados.'); }
  };

  return <section className={`overflow-hidden rounded-xl border border-background-200/70 bg-background-50 ${className}`}>
    <header className="border-b border-background-200/70 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-bold text-foreground-900">Conhecimento da empresa</p><p className="mt-0.5 text-xs leading-5 text-foreground-500">Pesquise, confira e prepare conteúdo antes de enviar.</p></div>
        <span className="shrink-0 rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-semibold text-primary-700">{items.length} ativo(s)</span>
      </div>
      {!selected && <nav className="mt-3 flex gap-1 overflow-x-auto pb-0.5" aria-label="Tipos de conhecimento">{tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-selected={tab === item.id} className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${tab === item.id ? 'bg-primary-500 text-background-50' : 'text-foreground-500 hover:bg-background-100'}`}><i className={`${item.icon} mr-1`} />{item.label}</button>)}</nav>}
    </header>
    {selected ? <KnowledgeDetail item={selected} related={related} onBack={() => setSelected(null)} onPrepare={(format, sendImage) => { onPrepare({ item: selected, format, text: formatKnowledgeMessage(selected, format), sendImage }); setSelected(null); }} /> : <>
      <div className="p-3"><div className="relative"><i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto, material ou catálogo" className="w-full rounded-lg border border-background-300 py-2 pl-9 pr-3 text-xs" /></div>{error && <p role="alert" className="mt-2 text-xs text-accent-700"><i className="ri-error-warning-line mr-1" />{error}</p>}</div>
      <div className="max-h-[420px] overflow-y-auto border-t border-background-100 p-3">{loading ? <EmptyState icon="ri-loader-4-line animate-spin" text="Carregando conteúdo…" /> : displayed.length === 0 ? <EmptyState icon={tab === 'suggestions' ? 'ri-lightbulb-line' : 'ri-inbox-line'} text={tab === 'suggestions' ? (normalize(context) ? 'Nenhuma sugestão confiável para a pergunta do cliente. Busque manualmente ou peça um detalhe técnico.' : 'As sugestões aparecem somente após uma pergunta recebida do cliente.') : 'Nenhum conteúdo ativo neste filtro.'} /> : <div className="space-y-1.5">{displayed.map((item) => <button key={item.id} type="button" onClick={() => void preview(item)} className="flex w-full items-center gap-3 rounded-lg border border-background-200/70 p-2.5 text-left transition hover:border-primary-200 hover:bg-primary-50/30"><span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary-100 text-primary-700">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <i className={typeIcon[item.type]} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-foreground-900">{item.name}</span><span className="mt-0.5 block truncate text-[11px] text-foreground-500">{item.category || item.shortDescription || item.technicalDescription || 'Conteúdo publicado pela empresa'}</span></span><span className="shrink-0 text-[10px] font-semibold text-primary-700">{catalogTypeLabel[item.type]}</span></button>)}</div>}</div>
      <footer className="border-t border-background-100 bg-background-100/40 px-4 py-2.5"><p className="text-[10px] leading-4 text-foreground-500"><i className="ri-information-line mr-1" />Preparar não envia: texto e imagem permanecem para revisão e seguem a fila auditável somente após confirmar no chat.</p></footer>
    </>}
  </section>;
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return <div className="py-8 text-center text-xs leading-5 text-foreground-500"><i className={`${icon} mb-2 block text-2xl`} />{text}</div>;
}

function KnowledgeDetail({ item, related, onBack, onPrepare }: { item: KnowledgeCatalogItem; related: KnowledgeCatalogItem[]; onBack: () => void; onPrepare: (format: KnowledgePresentationFormat, sendImage: boolean) => void }) {
  const [sendImage, setSendImage] = useState(false);
  const formats: Array<{ id: KnowledgePresentationFormat; label: string; icon: string; detail: string }> = item.type === 'product'
    ? [{ id: 'quick', label: 'Rápido', icon: 'ri-flashlight-line', detail: 'Resumo e link.' }, { id: 'commercial', label: 'Comercial', icon: 'ri-store-2-line', detail: 'Contexto e pergunta.' }, { id: 'technical', label: 'Técnico', icon: 'ri-flask-line', detail: 'Dados publicados.' }]
    : [{ id: item.type === 'catalog' ? 'document' : 'link', label: item.type === 'catalog' ? 'Preparar catálogo' : 'Preparar conteúdo', icon: 'ri-send-plane-2-line', detail: 'Texto e link rastreável.' }];
  return <div className="max-h-[540px] overflow-y-auto p-4">
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:text-primary-900"><i className="ri-arrow-left-line" />Voltar aos resultados</button>
    <div className="mt-3 flex gap-3">{item.imageUrl && <img src={item.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg border border-background-200 object-cover" />}<div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-primary-700">{catalogTypeLabel[item.type]}{item.category ? ` · ${item.category}` : ''}</p><h3 className="mt-1 text-sm font-bold leading-5 text-foreground-950">{item.name}</h3></div></div>
    <p className="mt-3 text-xs leading-5 text-foreground-700">{item.shortDescription || item.technicalDescription || 'A fonte não publicou um resumo deste conteúdo.'}</p>
    {item.technicalDescription && item.type === 'product' && <details className="mt-3 rounded-lg border border-background-200 bg-background-100/40 p-3"><summary className="cursor-pointer text-xs font-semibold text-foreground-700">Ver dados técnicos publicados</summary><p className="mt-2 whitespace-pre-line text-xs leading-5 text-foreground-600">{item.technicalDescription}</p></details>}
    <div className="mt-3 flex flex-wrap gap-2">{item.attachmentUrl && <a href={item.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-1.5 text-[11px] font-semibold text-primary-800"><i className="ri-attachment-2" />Arquivo</a>}<a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-background-200 px-2.5 py-1.5 text-[11px] font-semibold text-foreground-700"><i className="ri-external-link-line" />Origem</a></div>
    {item.imageUrl && <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-primary-200 bg-primary-50/50 p-2.5 text-xs text-primary-900"><input type="checkbox" checked={sendImage} onChange={(event) => setSendImage(event.target.checked)} className="mt-0.5" /><span><strong>Incluir imagem oficial</strong><span className="mt-0.5 block text-[11px] leading-4 text-primary-800">Use somente quando ela representar exatamente o conteúdo preparado.</span></span></label>}
    {related.length > 0 && <div className="mt-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-foreground-500">Relacionados</p><div className="mt-1.5 flex flex-wrap gap-1.5">{related.map((relatedItem) => <span key={relatedItem.id} className="max-w-full truncate rounded-full bg-background-100 px-2 py-1 text-[10px] text-foreground-700">{relatedItem.name}</span>)}</div></div>}
    <div className={`mt-4 grid gap-2 ${formats.length > 1 ? 'grid-cols-3' : ''}`}>{formats.map((format) => <button key={format.id} type="button" onClick={() => onPrepare(format.id, sendImage)} className="rounded-lg border border-primary-200 bg-primary-50 px-2.5 py-2.5 text-left transition hover:border-primary-400 hover:bg-primary-100"><i className={`${format.icon} text-primary-700`} /><span className="mt-1 block text-[11px] font-bold text-primary-950">{format.label}</span><span className="mt-0.5 block text-[10px] leading-4 text-primary-800">{format.detail}</span></button>)}</div>
  </div>;
}
