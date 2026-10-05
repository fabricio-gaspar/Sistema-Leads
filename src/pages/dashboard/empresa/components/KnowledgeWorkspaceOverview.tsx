import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadAnaKnowledgeSources, type AnaKnowledgeSource } from '@/lib/crm/anaKnowledgeLibraryRepository';
import { loadKnowledgeCatalogItems, loadKnowledgePublicationState, loadKnowledgeSources, publishKnowledge, setKnowledgeUsage, type KnowledgeAuditEvent, type KnowledgeCatalogItem, type KnowledgePublication, type KnowledgeSource, type KnowledgeUsage, type KnowledgeUsageKey } from '@/lib/crm/catalogKnowledgeRepository';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';

type Navigate = (tab: string) => void;

function UsageSwitch({ label, enabled, loading, onChange }: { label: string; enabled: boolean; loading: boolean; onChange: () => void }) {
  return <button type="button" role="switch" aria-checked={enabled} aria-label={label} disabled={loading} onClick={onChange} className="inline-flex items-center gap-2 text-xs font-semibold text-foreground-700 disabled:cursor-wait disabled:opacity-60"><span className={`relative inline-flex h-6 w-10 items-center rounded-full p-1 transition ${enabled ? 'bg-[#168654]' : 'bg-[#CBD3D8]'}`}><span className={`h-4 w-4 rounded-full bg-white shadow-sm transition ${enabled ? 'translate-x-4' : 'translate-x-0'}`} /></span><span>{loading ? 'Salvando…' : enabled ? 'Ativo' : 'Desativado'}</span></button>;
}

function ReviewBadge({ state }: { state: 'reviewed' | 'pending' | 'empty' }) {
  const copy = state === 'reviewed' ? ['Revisado', 'bg-[#E8F7EF] text-[#147445]', 'ri-checkbox-circle-fill'] : state === 'pending' ? ['Revisar', 'bg-[#FFF1D8] text-[#9A5D11]', 'ri-error-warning-fill'] : ['Sem itens', 'bg-background-100 text-foreground-500', 'ri-subtract-line'];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${copy[1]}`}><i className={copy[2]} aria-hidden="true" />{copy[0]}</span>;
}

function CardHeader({ icon, title, description, right }: { icon: string; title: string; description: string; right?: ReactNode }) {
  return <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><i className={icon} aria-hidden="true" /></span><div className="min-w-0"><h3 className="text-sm font-semibold text-foreground-950">{title}</h3><p className="mt-0.5 text-xs text-foreground-500">{description}</p></div></div>{right}</div>;
}

function formatDate(value: string | null | undefined) { return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem publicação'; }

function itemReview(items: KnowledgeCatalogItem[], type?: KnowledgeCatalogItem['type']): 'reviewed' | 'pending' | 'empty' {
  const subset = type ? items.filter((item) => item.type === type) : items;
  if (!subset.length) return 'empty';
  return subset.every((item) => item.status === 'active') ? 'reviewed' : 'pending';
}

export default function KnowledgeWorkspaceOverview({ onNavigate, onPublish, requestPublish = 0 }: { onNavigate: Navigate; onPublish: () => void; requestPublish?: number }) {
  const { settings } = useEmpresaSettingsStore();
  const [items, setItems] = useState<KnowledgeCatalogItem[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [documents, setDocuments] = useState<AnaKnowledgeSource[]>([]);
  const [usage, setUsage] = useState<KnowledgeUsage | null>(null);
  const [publication, setPublication] = useState<KnowledgePublication | null>(null);
  const [audit, setAudit] = useState<KnowledgeAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<KnowledgeUsageKey | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const [nextItems, nextSources, nextDocuments, state] = await Promise.all([loadKnowledgeCatalogItems({ type: 'all', includeInactive: true, limit: 300 }), loadKnowledgeSources(), loadAnaKnowledgeSources(), loadKnowledgePublicationState()]);
      setItems(nextItems); setSources(nextSources); setDocuments(nextDocuments); setUsage(state.usage); setPublication(state.publication); setAudit(state.audit);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a visão de conhecimento.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const currentUsage = usage ?? { profile: true, business: true, products: true, services: true, catalogs: true, documents: true, sources: true };
  const grouped = useMemo(() => ({ products: items.filter((item) => item.type === 'product'), services: items.filter((item) => item.type === 'service'), catalogs: items.filter((item) => item.type === 'catalog'), documents: [...items.filter((item) => item.type === 'document'), ...documents.map((document) => ({ id: document.id, status: document.status === 'active' ? 'active' : 'draft' } as KnowledgeCatalogItem))] }), [items, documents]);
  const profileReady = Boolean(settings.organizacao.nome && settings.organizacao.site);
  const pendingCount = items.filter((item) => item.status !== 'active').length + sources.filter((source) => source.syncStatus !== 'healthy').length + documents.filter((document) => document.status !== 'active').length;
  const publicationPending = dirty || !publication;

  const toggle = async (key: KnowledgeUsageKey) => {
    const enabled = !currentUsage[key];
    if (!enabled && !window.confirm('Desativar este conteúdo impede novas respostas da Ana de consultá-lo. O histórico será preservado. Continuar?')) return;
    setBusyKey(key); setError(''); setNotice('');
    try { const next = await setKnowledgeUsage(key, enabled); setUsage(next); setDirty(true); setNotice(`${key === 'profile' ? 'Perfil da empresa' : key === 'business' ? 'Contexto comercial' : 'Fonte de conhecimento'} ${enabled ? 'ativado' : 'desativado'} para a Ana.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível alterar a disponibilidade.'); }
    finally { setBusyKey(null); }
  };

  const publish = async () => {
    if (!window.confirm(`Publicar a configuração atual para a Ana? ${pendingCount ? `${pendingCount} conteúdo(s) continuarão aguardando revisão e não serão usados.` : 'Todos os conteúdos disponíveis estão revisados.'}`)) return;
    setBusyKey('sources'); setError(''); setNotice('');
    try { const next = await publishKnowledge(); setPublication(next); setDirty(false); setNotice(`Publicação ${next.version} confirmada. A Ana continuará usando somente conteúdos ativos e revisados.`); onPublish(); void refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível publicar o conhecimento.'); }
    finally { setBusyKey(null); }
  };
  useEffect(() => { if (requestPublish > 0) void publish(); }, [requestPublish]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = settings.organizacao;
  const rows: Array<{ key: KnowledgeUsageKey; title: string; icon: string; count: number; review: 'reviewed' | 'pending' | 'empty'; detail: string }> = [
    { key: 'products', title: 'Produtos e orçamentos', icon: 'ri-box-3-line', count: grouped.products.length, review: itemReview(items, 'product'), detail: 'Itens comerciais' },
    { key: 'services', title: 'Serviços', icon: 'ri-tools-line', count: grouped.services.length, review: itemReview(items, 'service'), detail: 'Serviços e segmentos' },
    { key: 'catalogs', title: 'Catálogos e documentos', icon: 'ri-book-open-line', count: grouped.catalogs.length, review: itemReview(items, 'catalog'), detail: 'Catálogos estruturados' },
    { key: 'documents', title: 'Documentos e mídia', icon: 'ri-file-image-line', count: grouped.documents.length, review: itemReview(grouped.documents), detail: 'Arquivos e biblioteca' },
    { key: 'sources', title: 'Fontes de conhecimento', icon: 'ri-radar-line', count: sources.length, review: sources.length ? sources.every((source) => source.syncStatus === 'healthy') ? 'reviewed' : 'pending' : 'empty', detail: 'Origens sincronizadas' },
  ];

  return <div className="space-y-4">
    {error && <div role="alert" className="rounded-xl border border-[#E8B8B1] bg-[#FFF4F2] px-4 py-3 text-sm text-[#8B3027]"><i className="ri-error-warning-line mr-2" />{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-[#B9E4CB] bg-[#EFFAF3] px-4 py-3 text-sm text-[#176B43]"><i className="ri-checkbox-circle-line mr-2" />{notice}</div>}
    {pendingCount > 0 && <div className="flex flex-col gap-3 rounded-xl border border-[#F0C171] bg-[#FFF8E9] px-4 py-3 text-[#744514] sm:flex-row sm:items-center"><i className="ri-error-warning-fill text-xl" aria-hidden="true" /><div className="flex-1"><p className="text-sm font-semibold">{pendingCount} conteúdos aguardam revisão</p><p className="mt-0.5 text-xs text-[#8B5A1D]">A Ana continua usando apenas itens revisados.</p></div><button type="button" className="wf-btn-secondary text-xs" onClick={() => onNavigate('catalogo')}>Ver pendências <i className="ri-arrow-right-line" /></button></div>}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(23rem,.95fr)]">
      <div className="space-y-4">
        <section className="wf-surface p-5"><CardHeader icon="ri-building-2-line" title="Dados da empresa" description="Informações institucionais para respostas da Ana." right={<ReviewBadge state={profileReady ? 'reviewed' : 'pending'} />} /><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-foreground-900">Usar perfil da empresa</p><p className="mt-0.5 text-xs text-foreground-500">{currentUsage.profile ? 'Informações da empresa são usadas pela Ana.' : 'Perfil removido das novas respostas.'}</p></div><UsageSwitch label="Usar perfil da empresa" enabled={currentUsage.profile} loading={busyKey === 'profile'} onChange={() => void toggle('profile')} /></div><div className="mt-4 grid gap-2 rounded-xl bg-background-50 p-4 text-xs text-foreground-700 sm:grid-cols-2"><p><i className="ri-building-line mr-2 text-foreground-400" /><strong>Nome:</strong> {summary.nome || 'Não informado'}</p><p><i className="ri-global-line mr-2 text-foreground-400" /><strong>Site:</strong> {summary.site || 'Não informado'}</p><p><i className="ri-map-pin-line mr-2 text-foreground-400" /><strong>Local:</strong> {summary.endereco || 'Não informado'}</p><p><i className="ri-time-line mr-2 text-foreground-400" /><strong>Idioma/fuso:</strong> {summary.idioma} · {summary.fusoHorario}</p></div><button type="button" className="wf-btn-secondary mt-4 text-xs" onClick={() => onNavigate('perfil')}><i className="ri-edit-line" />Editar dados</button></section>
        <section className="wf-surface p-5"><CardHeader icon="ri-briefcase-4-line" title="Contexto comercial" description="Informações que ajudam a Ana a responder sobre o negócio." /><div className="mt-4 space-y-2">{[{ key: 'business' as KnowledgeUsageKey, title: 'Ramo de atividade', value: settings.ramo, icon: 'ri-focus-3-line' }, { key: 'business' as KnowledgeUsageKey, title: 'Diferenciais', value: settings.diferenciais.join(' · '), icon: 'ri-star-line' }, { key: 'business' as KnowledgeUsageKey, title: 'Região e público', value: `${settings.regiao} · ${settings.publico}`, icon: 'ri-group-line' }].map((row, index) => <div key={`${row.title}-${index}`} className="flex flex-col gap-2 rounded-xl border border-background-200/70 px-3.5 py-3 sm:flex-row sm:items-center"><i className={`${row.icon} text-lg text-foreground-400`} aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-foreground-900">{row.title}</p><p className="mt-0.5 truncate text-xs text-foreground-500" title={row.value}>{row.value || 'Não informado'}</p></div><ReviewBadge state={row.value ? 'reviewed' : 'pending'} /><span className="text-[11px] font-semibold text-foreground-500">Usar na Ana</span><UsageSwitch label={`Usar ${row.title} para Ana`} enabled={currentUsage.business} loading={busyKey === 'business'} onChange={() => void toggle('business')} /><button type="button" className="rounded-lg border border-background-300 px-2.5 py-1.5 text-xs font-semibold text-foreground-700 hover:bg-background-50" onClick={() => onNavigate('perfil')}>Editar</button></div>)}</div></section>
      </div>
      <div className="space-y-4"><section className="wf-surface p-5"><CardHeader icon="ri-database-2-line" title="Disponibilidade para Ana" description="Controle por fonte." right={<span className="hidden items-center gap-3 text-[11px] text-foreground-500 sm:flex"><span><i className="ri-toggle-line mr-1 text-[#168654]" />Uso para Ana</span><span><i className="ri-checkbox-circle-fill mr-1 text-[#168654]" />Status da revisão</span></span>} /><div className="mt-4 space-y-2">{rows.map((row) => <div key={row.key} className="flex items-center gap-2 rounded-xl border border-background-200/70 px-3 py-2.5"><i className={`${row.icon} shrink-0 text-lg text-foreground-400`} aria-hidden="true" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-foreground-900">{row.title}</p><p className="text-[11px] text-foreground-500">{row.count} {row.count === 1 ? 'item' : 'itens'} · {row.detail}</p></div><ReviewBadge state={row.review} /><span className="hidden text-[11px] font-semibold text-foreground-500 md:inline">Usar na Ana</span><UsageSwitch label={`Usar ${row.title} para Ana`} enabled={currentUsage[row.key]} loading={busyKey === row.key} onChange={() => void toggle(row.key)} /></div>)}</div></section><section className="wf-surface p-5"><div className="flex items-center justify-between gap-3"><CardHeader icon="ri-calendar-check-line" title="Próxima revisão" description="Itens que precisam de atenção." /><button type="button" className="wf-btn-secondary text-xs" onClick={() => onNavigate('catalogo')}>Revisar agora</button></div><div className="mt-4 space-y-2">{pendingCount === 0 ? <p className="rounded-xl bg-background-50 px-3.5 py-4 text-xs text-foreground-500">Nenhum conteúdo pendente. A base atual está pronta para a Ana.</p> : <>{items.filter((item) => item.status !== 'active').slice(0, 3).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-background-200/70 px-3.5 py-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-foreground-900">{item.name}</p><p className="mt-0.5 text-[11px] text-foreground-500">Catálogo · atualizado {formatDate(item.updatedAt)}</p></div><ReviewBadge state="pending" /></div>)}{sources.filter((source) => source.syncStatus !== 'healthy').slice(0, 2).map((source) => <div key={source.id} className="flex items-center justify-between gap-3 rounded-xl border border-background-200/70 px-3.5 py-3"><div className="min-w-0"><p className="truncate text-xs font-semibold text-foreground-900">{source.name}</p><p className="mt-0.5 text-[11px] text-foreground-500">Fonte · {source.lastSyncedAt ? `última sincronização ${formatDate(source.lastSyncedAt)}` : 'nunca sincronizada'}</p></div><ReviewBadge state="pending" /></div>)}</>}</div></section></div>
    </div>
    <section className="wf-surface overflow-hidden"><div className="flex items-center justify-between border-b border-background-200/70 px-5 py-3"><div><h3 className="text-sm font-semibold text-foreground-950">Atividade recente</h3><p className="mt-0.5 text-xs text-foreground-500">Alterações e publicações da base da Ana.</p></div><button type="button" className="text-xs font-semibold text-primary-700" onClick={() => onNavigate('historico')}>Ver histórico completo <i className="ri-arrow-right-line" /></button></div>{loading ? <p className="px-5 py-6 text-xs text-foreground-500">Carregando histórico…</p> : audit.length === 0 ? <p className="px-5 py-6 text-xs text-foreground-500">Nenhuma atividade registrada.</p> : <div className="grid divide-y divide-background-200/70 md:grid-cols-3 md:divide-x md:divide-y-0">{audit.slice(0, 3).map((event) => <div key={event.id} className="px-5 py-3"><p className="text-xs font-semibold text-foreground-900">{event.action.replace('knowledge.', '').replaceAll('_', ' ')}</p><p className="mt-1 text-[11px] text-foreground-500">{event.actorName || 'Sistema'} · {formatDate(event.createdAt)}</p></div>)}</div>}</section>
    {publicationPending && <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-xl border border-[#F0C171] bg-[#FFF8E9] px-4 py-3 shadow-lg sm:flex-row sm:items-center"><i className="ri-draft-line text-xl text-[#9A5D11]" aria-hidden="true" /><div className="flex-1"><p className="text-sm font-semibold text-[#744514]">Alterações não publicadas</p><p className="mt-0.5 text-xs text-[#8B5A1D]">A Ana só recebe o estado publicado da base revisada.</p></div><button type="button" className="wf-btn-secondary text-xs" onClick={() => { setDirty(false); void refresh(); }}>Descartar</button><button type="button" className="wf-btn-primary text-xs" disabled={busyKey !== null} onClick={() => void publish()}><i className="ri-send-plane-line" />Revisar e publicar</button></div>}
  </div>;
}
