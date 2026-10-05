import { useEffect, useState } from 'react';
import BaseConhecimentoTab from './BaseConhecimentoTab';
import DadosTab from './DadosTab';
import KnowledgeSourcesTab from './KnowledgeSourcesTab';
import KnowledgeCatalogManagerTab from './KnowledgeCatalogManagerTab';
import KnowledgeDocumentsMediaTab from './KnowledgeDocumentsMediaTab';
import KnowledgeWorkspaceOverview from './KnowledgeWorkspaceOverview';
import { loadKnowledgePublicationState } from '@/lib/crm/catalogKnowledgeRepository';

type WorkspaceTab = 'visao-geral' | 'perfil' | 'catalogo' | 'fontes' | 'ana' | 'historico';
type CatalogTab = 'produtos' | 'servicos' | 'catalogos' | 'documentos';

const tabs: Array<{ id: WorkspaceTab; nome: string; icone: string }> = [
  { id: 'visao-geral', nome: 'Visão geral', icone: 'ri-dashboard-line' },
  { id: 'perfil', nome: 'Perfil da empresa', icone: 'ri-building-2-line' },
  { id: 'catalogo', nome: 'Catálogo', icone: 'ri-book-open-line' },
  { id: 'fontes', nome: 'Fontes', icone: 'ri-radar-line' },
  { id: 'ana', nome: 'Ana', icone: 'ri-robot-2-line' },
  { id: 'historico', nome: 'Histórico', icone: 'ri-history-line' },
];

const catalogTabs: Array<{ id: CatalogTab; label: string }> = [
  { id: 'produtos', label: 'Produtos e acessórios' }, { id: 'servicos', label: 'Serviços' }, { id: 'catalogos', label: 'Catálogos' }, { id: 'documentos', label: 'Documentos e mídia' },
];

function Header({ onPublish }: { onPublish: () => void }) {
  return <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="wf-eyebrow">Conhecimento operacional</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground-950">Empresa e conhecimento</h2><p className="mt-1 text-sm text-foreground-500">Perfil, catálogo e fontes usadas pela Ana.</p></div><div className="flex flex-wrap gap-2"><a href="/dashboard/configuracoes?tab=registro" className="wf-btn-secondary text-xs"><i className="ri-history-line" />Registro de auditoria</a><button type="button" className="wf-btn-primary text-xs" onClick={onPublish}><i className="ri-send-plane-line" />Revisar e publicar</button></div></header>;
}

function CatalogHub({ initial }: { initial: CatalogTab }) {
  const [tab, setTab] = useState<CatalogTab>(initial);
  return <div className="space-y-4"><nav className="flex flex-wrap gap-2" aria-label="Tipos de catálogo">{catalogTabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${tab === item.id ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-background-300 text-foreground-600 hover:bg-background-50'}`}>{item.label}</button>)}</nav>{tab === 'produtos' && <KnowledgeCatalogManagerTab itemType="product" />}{tab === 'servicos' && <KnowledgeCatalogManagerTab itemType="service" />}{tab === 'catalogos' && <KnowledgeCatalogManagerTab itemType="catalog" />}{tab === 'documentos' && <KnowledgeDocumentsMediaTab />}</div>;
}

function HistoryTab() {
  const [events, setEvents] = useState<Array<{ id: string; action: string; detail: string | null; actorName: string | null; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void loadKnowledgePublicationState().then((state) => setEvents(state.audit)).finally(() => setLoading(false)); }, []);
  return <section className="wf-surface overflow-hidden"><div className="border-b border-background-200/70 px-5 py-4"><p className="wf-eyebrow">Auditoria</p><h3 className="mt-1 text-lg font-semibold text-foreground-950">Histórico de conhecimento</h3><p className="mt-1 text-xs text-foreground-500">Publicações, ativações e alterações registradas para a Ana.</p></div>{loading ? <p className="px-5 py-10 text-sm text-foreground-500">Carregando histórico…</p> : events.length === 0 ? <p className="px-5 py-10 text-sm text-foreground-500">Nenhum evento de conhecimento registrado.</p> : <div className="divide-y divide-background-200/70">{events.map((event) => <div key={event.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)_auto] sm:items-center"><div><p className="text-sm font-semibold text-foreground-900">{event.action.replace('knowledge.', '').replaceAll('_', ' ')}</p><p className="mt-1 text-[11px] text-foreground-500">{event.actorName || 'Sistema'} · {new Date(event.createdAt).toLocaleString('pt-BR')}</p></div><p className="text-xs text-foreground-600">{event.detail || 'Sem detalhe adicional.'}</p><span className="text-xs font-semibold text-primary-700">Registrado</span></div>)}</div>}</section>;
}

export default function EmpresaTabs() {
  const requested = new URLSearchParams(window.location.search).get('subtab') || '';
  const legacyMap: Record<string, WorkspaceTab> = { dados: 'perfil', conhecimento: 'ana', fontes: 'fontes', 'visao-geral': 'visao-geral', perfil: 'perfil', catalogo: 'catalogo', ana: 'ana', historico: 'historico' };
  const initial = legacyMap[requested] || (['produtos', 'servicos', 'catalogos', 'documentos'].includes(requested) ? 'catalogo' : 'visao-geral');
  const [tab, setTab] = useState<WorkspaceTab>(initial);
  const [catalogInitial] = useState<CatalogTab>(['produtos', 'servicos', 'catalogos', 'documentos'].includes(requested) ? requested as CatalogTab : 'produtos');
  const [publishSignal, setPublishSignal] = useState(0);

  const selectTab = (id: WorkspaceTab) => { setTab(id); const url = new URL(window.location.href); url.searchParams.set('subtab', id); window.history.replaceState(null, '', url.toString()); };
  const publish = () => { setPublishSignal((value) => value + 1); window.dispatchEvent(new CustomEvent('wayflex:knowledge-publish')); };

  return <>
    <Header onPublish={publish} />
    <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-background-200/70 bg-background-50 p-1" role="tablist" aria-label="Empresa e conhecimento">{tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => selectTab(item.id)} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition sm:flex-none ${tab === item.id ? 'bg-white text-primary-700 shadow-sm' : 'text-foreground-500 hover:text-foreground-800'}`}><i className={item.icone} aria-hidden="true" />{item.nome}</button>)}</div>
    {tab === 'visao-geral' && <KnowledgeWorkspaceOverview requestPublish={publishSignal} onNavigate={selectTab} onPublish={() => undefined} />}
    {tab === 'perfil' && <DadosTab />}
    {tab === 'catalogo' && <CatalogHub initial={catalogInitial} />}
    {tab === 'fontes' && <KnowledgeSourcesTab />}
    {tab === 'ana' && <BaseConhecimentoTab />}
    {tab === 'historico' && <HistoryTab />}
  </>;
}
