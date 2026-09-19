import { useEffect, useMemo, useState } from 'react';
import {
  catalogTypeLabel, formatKnowledgeMessage, loadKnowledgeCatalogItems, loadRelatedKnowledgeItems,
  type KnowledgeCatalogItem, type KnowledgeCatalogItemType, type KnowledgePresentationFormat,
} from '@/lib/crm/catalogKnowledgeRepository';

type Tab = 'suggestions' | 'product' | 'service' | 'catalog' | 'document';

const tabs: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'suggestions', label: 'Sugestões', icon: 'ri-magic-line' },
  { id: 'product', label: 'Produtos', icon: 'ri-shapes-line' },
  { id: 'service', label: 'Serviços', icon: 'ri-tools-line' },
  { id: 'catalog', label: 'Catálogos', icon: 'ri-book-open-line' },
  { id: 'document', label: 'Arquivos', icon: 'ri-file-text-line' },
];

const typeIcon: Record<KnowledgeCatalogItemType, string> = { product: 'ri-shapes-line', service: 'ri-tools-line', catalog: 'ri-book-open-line', document: 'ri-file-text-line' };

function normalize(value: string) { return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
function relevance(item: KnowledgeCatalogItem, context: string): number {
  const terms = normalize(context).split(' ').filter((term) => term.length >= 3 && !['para', 'com', 'sem', 'uma', 'que', 'qual', 'como', 'sobre'].includes(term));
  if (!terms.length) return 0;
  const content = normalize([item.name, item.code, item.category, item.material, item.shortDescription, item.technicalDescription, item.applications.join(' '), item.keywords.join(' ')].filter(Boolean).join(' '));
  return terms.reduce((total, term) => total + (content.includes(term) ? 1 : 0), 0);
}

export interface PreparedKnowledgeContent { item: KnowledgeCatalogItem; format: KnowledgePresentationFormat; text: string; }

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
      .catch(() => { if (active) setError('Não foi possível carregar o conhecimento comercial agora.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const displayed = useMemo(() => {
    const needle = normalize(query);
    const typed = tab === 'suggestions' ? items : items.filter((item) => item.type === tab);
    const searched = !needle ? typed : typed.filter((item) => normalize([item.name, item.code, item.category, item.material, item.shortDescription, item.technicalDescription, item.applications.join(' '), item.keywords.join(' ')].filter(Boolean).join(' ')).includes(needle));
    if (tab !== 'suggestions') return searched;
    return searched.map((item) => ({ item, score: relevance(item, context) })).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score).slice(0, 3).map(({ item }) => item);
  }, [context, items, query, tab]);

  const preview = async (item: KnowledgeCatalogItem) => {
    setSelected(item); setRelated([]);
    try { setRelated(await loadRelatedKnowledgeItems(item.id)); } catch { setError('O item foi aberto, mas os conteúdos relacionados não puderam ser carregados.'); }
  };

  return <section className={`overflow-hidden rounded-xl border border-background-200/70 bg-background-50 ${className}`}>
    <div className="border-b border-background-200/70 px-4 py-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-foreground-900">Produtos e catálogos</p><p className="mt-0.5 text-xs leading-5 text-foreground-500">Conteúdo comercial rastreável para preparar antes de enviar.</p></div><span className="shrink-0 rounded-full bg-primary-100 px-2.5 py-1 text-[10px] font-semibold text-primary-700">{items.length} ativo(s)</span></div><div className="mt-3 grid grid-cols-2 gap-1">{tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`min-w-0 rounded-md px-2 py-1.5 text-[11px] font-semibold ${tab === item.id ? 'bg-primary-500 text-background-50' : 'text-foreground-500 hover:bg-background-100'}`}><i className={`${item.icon} mr-1`} />{item.label}</button>)}</div></div>
    <div className="p-3"><div className="relative"><i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto, material ou catálogo" className="w-full rounded-lg border border-background-300 py-2 pl-9 pr-3 text-xs" /></div>{error && <p className="mt-2 text-xs text-accent-700"><i className="ri-error-warning-line mr-1" />{error}</p>}</div>
    <div className="max-h-[420px] overflow-y-auto border-t border-background-100 p-3">{loading ? <div className="py-8 text-center text-xs text-foreground-500"><i className="ri-loader-4-line mb-2 block animate-spin text-xl" />Carregando conteúdo…</div> : displayed.length === 0 ? <div className="py-7 text-center text-xs leading-5 text-foreground-500"><i className={`${tab === 'suggestions' ? 'ri-lightbulb-line' : 'ri-inbox-line'} mb-2 block text-2xl`} />{tab === 'suggestions' ? 'Nenhuma sugestão confiável para a última mensagem. Faça uma busca ou peça um dado técnico ao cliente.' : 'Nenhum conteúdo ativo neste filtro.'}</div> : <div className="space-y-2">{displayed.map((item) => <button key={item.id} type="button" onClick={() => void preview(item)} className="flex w-full items-start gap-3 rounded-lg border border-background-200/70 p-3 text-left transition hover:border-primary-200 hover:bg-primary-50/30"><span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary-100 text-primary-700">{item.imageUrl ? <img src={item.imageUrl} alt="" className="h-full w-full object-cover" /> : <i className={typeIcon[item.type]} />}</span><span className="min-w-0 flex-1"><span className="block whitespace-normal break-words text-xs font-bold leading-5 text-foreground-900">{item.name}</span><span className="mt-1 block whitespace-normal break-words text-[11px] leading-5 text-foreground-500">{item.shortDescription || item.technicalDescription || item.sourceUrl}</span><span className="mt-1.5 block text-[10px] font-semibold text-primary-700">{catalogTypeLabel[item.type]} · ver opções</span></span></button>)}</div>}</div>
    <div className="border-t border-background-100 bg-background-100/40 px-4 py-2.5"><p className="text-[10px] leading-4 text-foreground-500"><i className="ri-information-line mr-1" />A fila homologada envia texto. PDFs e imagens são compartilhados por link rastreável até existir envio de mídia validado.</p></div>
    {selected && <KnowledgePreview item={selected} related={related} onClose={() => setSelected(null)} onPrepare={(format) => { onPrepare({ item: selected, format, text: formatKnowledgeMessage(selected, format) }); setSelected(null); }} />}
  </section>;
}

function KnowledgePreview({ item, related, onClose, onPrepare }: { item: KnowledgeCatalogItem; related: KnowledgeCatalogItem[]; onClose: () => void; onPrepare: (format: KnowledgePresentationFormat) => void }) {
  const formats: Array<{ id: KnowledgePresentationFormat; label: string; icon: string; detail: string }> = item.type === 'product'
    ? [{ id: 'quick', label: 'Envio rápido', icon: 'ri-flashlight-line', detail: 'Nome, resumo e link.' }, { id: 'commercial', label: 'Envio comercial', icon: 'ri-store-2-line', detail: 'Apresentação e pergunta de contexto.' }, { id: 'technical', label: 'Envio técnico', icon: 'ri-flask-line', detail: 'Somente dados publicados e pedido de aplicação.' }]
    : [{ id: item.type === 'catalog' ? 'document' : 'link', label: item.type === 'catalog' ? 'Enviar catálogo' : 'Enviar conteúdo', icon: 'ri-send-plane-2-line', detail: 'Prepara texto e link rastreável para revisão.' }];
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground-950/50 p-4" onClick={onClose}><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-background-50" onClick={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-background-200/70 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Pré-visualização · {catalogTypeLabel[item.type]}</p><h3 className="mt-1 font-heading text-lg font-bold text-foreground-950">{item.name}</h3></div><button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-background-100"><i className="ri-close-line text-lg" /></button></header><div className="space-y-4 p-5">{item.imageUrl && <img src={item.imageUrl} alt={`Imagem de ${item.name}`} className="max-h-60 w-full rounded-xl border border-background-200 object-cover" />}<p className="text-sm leading-6 text-foreground-700">{item.shortDescription || item.technicalDescription || 'A fonte não publicou um resumo deste conteúdo.'}</p>{item.technicalDescription && item.type === 'product' && <details className="rounded-lg border border-background-200 bg-background-100/40 p-3"><summary className="cursor-pointer text-xs font-semibold text-foreground-700">Ver conteúdo técnico publicado</summary><p className="mt-2 whitespace-pre-line text-xs leading-5 text-foreground-600">{item.technicalDescription}</p></details>}{item.attachmentUrl && <a href={item.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-800"><i className="ri-attachment-2" />Pré-visualizar arquivo</a>}<a href={item.sourceUrl} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary-700 underline">Origem: {item.sourceUrl}</a>{related.length > 0 && <div><p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Relacionados</p><div className="mt-2 flex flex-wrap gap-2">{related.map((relatedItem) => <span key={relatedItem.id} className="rounded-full bg-background-100 px-2.5 py-1 text-xs text-foreground-700">{relatedItem.name}</span>)}</div></div>}<div><p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Formato da mensagem</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{formats.map((format) => <button key={format.id} type="button" onClick={() => onPrepare(format.id)} className="rounded-lg border border-background-200 p-3 text-left transition hover:border-primary-300 hover:bg-primary-50"><i className={`${format.icon} text-primary-700`} /><span className="mt-2 block text-xs font-bold text-foreground-900">{format.label}</span><span className="mt-1 block text-[11px] leading-4 text-foreground-500">{format.detail}</span></button>)}</div></div></div><footer className="border-t border-background-200/70 px-5 py-4 text-right"><button type="button" onClick={onClose} className="rounded-lg border border-background-300 px-3 py-2 text-sm font-semibold text-foreground-700">Fechar</button></footer></div></div>;
}
