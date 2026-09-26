import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  catalogTypeLabel, createKnowledgeSource, deleteKnowledgeCatalogItem, loadKnowledgeCatalogItems, loadKnowledgeSources,
  loadRelatedKnowledgeItems, saveKnowledgeCatalogItem, saveKnowledgeRelation, setKnowledgeCatalogItemStatus,
  type KnowledgeCatalogDraft, type KnowledgeCatalogItem, type KnowledgeCatalogItemType, type KnowledgeSource,
} from '@/lib/crm/catalogKnowledgeRepository';
import './knowledge-catalog.css';

interface Props { itemType: KnowledgeCatalogItemType; }

const iconByType: Record<KnowledgeCatalogItemType, string> = {
  product: 'ri-shapes-line', service: 'ri-tools-line', catalog: 'ri-book-open-line', document: 'ri-file-text-line',
};
const fieldClassName = 'w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 outline-none transition placeholder:text-foreground-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-100';

function splitList(value: string): string[] { return value.split(',').map((item) => item.trim()).filter(Boolean); }

function sourceForType(sources: KnowledgeSource[], type: KnowledgeCatalogItemType): KnowledgeSource[] {
  const expected = type === 'product' ? 'products' : type === 'service' ? 'services' : type === 'catalog' ? 'catalogs' : 'documents';
  return sources.filter((source) => source.contentScope === expected || source.contentScope === 'mixed');
}

function emptyDraft(type: KnowledgeCatalogItemType, sourceId = ''): KnowledgeCatalogDraft {
  return { sourceId, type, name: '', status: 'draft', anaEnabled: false, sourceUrl: '', applications: [], qualificationQuestions: [], keywords: [] };
}

function draftFrom(item: KnowledgeCatalogItem): KnowledgeCatalogDraft {
  return {
    sourceId: item.sourceId, type: item.type, externalKey: item.externalKey, name: item.name, status: item.status, anaEnabled: item.anaEnabled,
    code: item.code || '', shortDescription: item.shortDescription || '', technicalDescription: item.technicalDescription || '', category: item.category || '', material: item.material || '',
    applications: item.applications, qualificationQuestions: item.qualificationQuestions, keywords: item.keywords, imageUrl: item.imageUrl || '', attachmentUrl: item.attachmentUrl || '', websiteUrl: item.websiteUrl || '', sourceUrl: item.sourceUrl, sourceLabel: item.sourceLabel || '',
  };
}

export default function KnowledgeCatalogManagerTab({ itemType }: Props) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [items, setItems] = useState<KnowledgeCatalogItem[]>([]);
  const [relationshipCandidates, setRelationshipCandidates] = useState<KnowledgeCatalogItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<KnowledgeCatalogItem | null>(null);
  const [related, setRelated] = useState<KnowledgeCatalogItem[]>([]);
  const [editor, setEditor] = useState<KnowledgeCatalogDraft | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const title = itemType === 'product' ? 'Produtos e acessórios' : itemType === 'service' ? 'Serviços e segmentos' : itemType === 'catalog' ? 'Catálogos e documentos' : 'Documentos e mídia';
  const availableSources = useMemo(() => sourceForType(sources, itemType), [sources, itemType]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [nextSources, nextItems, nextRelationshipCandidates] = await Promise.all([
        loadKnowledgeSources(),
        loadKnowledgeCatalogItems({ type: itemType, includeInactive: true, query }),
        loadKnowledgeCatalogItems({ includeInactive: true, limit: 300 }),
      ]);
      setSources(nextSources); setItems(nextItems); setRelationshipCandidates(nextRelationshipCandidates); setError('');
    } catch { setError('Não foi possível carregar este catálogo. Os itens existentes não foram alterados.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [itemType]); // eslint-disable-line react-hooks/exhaustive-deps

  const openItem = async (item: KnowledgeCatalogItem) => {
    setSelected(item); setRelated([]);
    try { setRelated(await loadRelatedKnowledgeItems(item.id, true)); } catch { setError('Não foi possível carregar os relacionamentos deste item.'); }
  };
  const editItem = (item: KnowledgeCatalogItem) => {
    setEditor(draftFrom(item));
    setEditingId(item.id);
    setSelected(null);
  };
  const openNew = () => {
    const source = availableSources[0];
    setEditingId(undefined);
    setEditor(emptyDraft(itemType, source?.id || ''));
  };
  const save = async () => {
    if (!editor) return;
    setSaving(true); setError('');
    try {
      const source = sources.find((item) => item.id === editor.sourceId);
      const draft = { ...editor, sourceUrl: editor.sourceUrl || source?.sourceUrl || '', sourceLabel: editor.sourceLabel || source?.name || '', type: itemType };
      const item = await saveKnowledgeCatalogItem(draft, editingId);
      setEditor(null); setEditingId(undefined); await refresh(); await openItem(item);
      setNotice(item.status === 'active' && item.anaEnabled ? 'Item salvo e incluído na memória aprovada da Ana.' : 'Item salvo como rascunho. Ative a Ana somente após revisar o conteúdo.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar o item.'); }
    finally { setSaving(false); }
  };
  const toggleAna = async (item: KnowledgeCatalogItem) => {
    try {
      const nextActive = !(item.status === 'active' && item.anaEnabled);
      await setKnowledgeCatalogItemStatus(item.id, nextActive ? 'active' : 'draft', nextActive);
      await refresh();
      const next = items.find((current) => current.id === item.id);
      if (next) await openItem({ ...next, status: nextActive ? 'active' : 'draft', anaEnabled: nextActive });
      setNotice(nextActive ? 'Item aprovado para a Ana.' : 'Item removido da consulta automática da Ana.');
    } catch { setError('Não foi possível atualizar o status da Ana.'); }
  };
  const deleteItem = async (item: KnowledgeCatalogItem) => {
    if (!window.confirm(`Excluir “${item.name}”? O documento derivado da memória da Ana também será removido.`)) return;
    try { await deleteKnowledgeCatalogItem(item.id); setSelected(null); await refresh(); setNotice('Item removido com seus vínculos de conhecimento.'); }
    catch { setError('Não foi possível excluir o item.'); }
  };
  const relate = async (targetId: string) => {
    if (!selected || !targetId) return;
    try { await saveKnowledgeRelation({ sourceItemId: selected.id, targetItemId: targetId }); setRelated(await loadRelatedKnowledgeItems(selected.id, true)); setNotice('Relacionamento salvo na mesma base de conhecimento.'); }
    catch { setError('Não foi possível relacionar os conteúdos.'); }
  };

  return <div className="wf-knowledge-catalog space-y-4">
    {notice && <div className="rounded-lg border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm text-secondary-900"><i className="ri-checkbox-circle-line mr-2" />{notice}</div>}
    {error && <div className="rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800"><i className="ri-error-warning-line mr-2" />{error}</div>}
    <section className="wf-knowledge-toolbar">
      <div className="wf-knowledge-toolbar-top">
        <div><p className="wf-knowledge-kicker">Base estruturada</p><h2><i className={iconByType[itemType]} aria-hidden="true" />{title}</h2><p>Conteúdo, origem e aprovação reunidos no catálogo operacional.</p></div>
        <button type="button" onClick={openNew} className="wf-knowledge-primary"><i className="ri-add-line" aria-hidden="true" />Novo {catalogTypeLabel[itemType].toLowerCase()}</button>
      </div>
      <div className="wf-knowledge-search"><label><span className="sr-only">Buscar no catálogo</span><i className="ri-search-line" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void refresh(); }} placeholder="Buscar por nome, código, material, aplicação ou palavra-chave" /></label><button type="button" onClick={() => void refresh()}><i className="ri-refresh-line" aria-hidden="true" />Atualizar</button></div>
    </section>
    {!loading && availableSources.length === 0 && <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900"><i className="ri-information-line mr-2" />Cadastre ou sincronize uma fonte em <strong>Fontes de conhecimento</strong> antes de criar itens neste grupo.</div>}
    <section className="wf-knowledge-results"><div className="wf-knowledge-results-heading"><div><p className="wf-knowledge-kicker">Itens cadastrados</p><h3>{title}</h3></div><span>{loading ? 'Carregando…' : `${items.length} ${items.length === 1 ? 'item' : 'itens'}`}</span></div>{loading ? <div className="px-5 py-12 text-center text-sm text-foreground-500" role="status"><i className="ri-loader-4-line mb-2 block animate-spin text-2xl" />Carregando conteúdo operacional…</div> : items.length === 0 ? <div className="px-5 py-12 text-center text-sm text-foreground-500"><i className={`${iconByType[itemType]} mb-2 block text-3xl`} />Nenhum item disponível. Sincronize uma fonte ou cadastre o primeiro conteúdo.</div> : <div className="wf-knowledge-grid">{items.map((item) => <CatalogItemCard key={item.id} item={item} onOpen={() => void openItem(item)} onEdit={() => editItem(item)} />)}</div>}</section>
    {selected && <ItemDrawer item={selected} sources={sources} related={related} candidates={relationshipCandidates.filter((item) => item.id !== selected.id)} onClose={() => setSelected(null)} onEdit={() => editItem(selected)} onToggleAna={() => void toggleAna(selected)} onDelete={() => void deleteItem(selected)} onRelate={(targetId) => void relate(targetId)} />}
    {editor && <ItemEditor draft={editor} sources={availableSources} itemType={itemType} saving={saving} onChange={setEditor} onClose={() => { setEditor(null); setEditingId(undefined); }} onSave={() => void save()} />}
  </div>;
}

function CatalogItemCard({ item, onOpen, onEdit }: { item: KnowledgeCatalogItem; onOpen: () => void; onEdit: () => void }) {
  const active = item.status === 'active' && item.anaEnabled;
  const statusLabel = active ? 'Disponível para Ana' : item.status === 'archived' ? 'Arquivado' : item.status === 'active' ? 'Fora da Ana' : 'Rascunho';
  return <article className="wf-knowledge-card">
    <div className="wf-knowledge-card-media">{item.imageUrl ? <img src={item.imageUrl} alt={`Imagem de ${item.name}`} /> : <i className={iconByType[item.type]} aria-hidden="true" />}</div>
    <div className="wf-knowledge-card-content">
      <div className="wf-knowledge-card-meta"><span>{catalogTypeLabel[item.type]}</span><span className={`wf-knowledge-state ${active ? 'is-active' : item.status === 'archived' ? 'is-archived' : 'is-pending'}`}><i className="ri-circle-fill" aria-hidden="true" />{statusLabel}</span></div>
      <h4>{item.name}</h4>
      {item.category && <p className="wf-knowledge-category">{item.category}</p>}
      <p className="wf-knowledge-summary">{item.shortDescription || item.technicalDescription || 'Sem resumo publicado.'}</p>
      <div className="wf-knowledge-card-foot"><span title={item.sourceLabel || 'Fonte não identificada'}><i className="ri-links-line" aria-hidden="true" />{item.sourceLabel || 'Fonte não identificada'}</span><div><button type="button" onClick={onOpen}>Detalhes</button><button type="button" onClick={onEdit} className="wf-knowledge-edit"><i className="ri-edit-line" aria-hidden="true" />Editar</button></div></div>
    </div>
  </article>;
}

function ItemDrawer({ item, sources, related, candidates, onClose, onEdit, onToggleAna, onDelete, onRelate }: { item: KnowledgeCatalogItem; sources: KnowledgeSource[]; related: KnowledgeCatalogItem[]; candidates: KnowledgeCatalogItem[]; onClose: () => void; onEdit: () => void; onToggleAna: () => void; onDelete: () => void; onRelate: (id: string) => void; }) {
  const source = sources.find((candidate) => candidate.id === item.sourceId);
  const active = item.status === 'active' && item.anaEnabled;
  return <div className="fixed inset-0 z-50 flex justify-end bg-foreground-950/50" onClick={onClose}><aside className="flex h-full w-full max-w-xl flex-col bg-background-50 shadow-xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-background-200/70 px-5 py-4"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">{catalogTypeLabel[item.type]}</p><h3 className="mt-1 truncate font-heading text-lg font-bold text-foreground-950">{item.name}</h3><p className="mt-1 text-xs text-foreground-500">{item.code || 'Sem código'} · {source?.name || item.sourceLabel || 'Fonte não identificada'}</p></div><button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-background-100"><i className="ri-close-line text-lg" /></button></header><div className="flex-1 space-y-5 overflow-y-auto p-5">{item.imageUrl && <img src={item.imageUrl} alt={`Imagem de ${item.name}`} className="max-h-56 w-full rounded-xl border border-background-200 object-cover" />}<div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-secondary-100 text-secondary-800' : 'bg-accent-100 text-accent-800'}`}>{active ? 'Disponível para a Ana' : 'Fora da consulta automática'}</span>{item.material && <span className="rounded-full bg-background-100 px-2.5 py-1 text-xs text-foreground-700">{item.material}</span>}{item.category && <span className="rounded-full bg-background-100 px-2.5 py-1 text-xs text-foreground-700">{item.category}</span>}</div>{item.shortDescription && <Block title="Resumo" value={item.shortDescription} />}{item.technicalDescription && <Block title="Detalhes técnicos publicados" value={item.technicalDescription} />}{item.applications.length > 0 && <Tags title="Aplicações" values={item.applications} />}{item.qualificationQuestions.length > 0 && <Tags title="Perguntas internas de qualificação" values={item.qualificationQuestions} />}{item.keywords.length > 0 && <Tags title="Palavras-chave e campanhas" values={item.keywords} />}<div className="rounded-xl border border-background-200/70 bg-background-100/50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">Origem verificável</p><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block truncate text-sm font-semibold text-primary-700 underline">{item.sourceUrl}</a>{item.attachmentUrl && <a href={item.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700"><i className="ri-attachment-2" />Abrir arquivo ou catálogo</a>}</div><section><div className="flex items-center justify-between"><h4 className="text-sm font-bold text-foreground-900">Relacionamentos</h4><span className="text-xs text-foreground-500">{related.length} vínculo(s)</span></div>{related.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{related.map((relatedItem) => <span key={relatedItem.id} className="rounded-full bg-primary-100 px-2.5 py-1 text-xs text-primary-800">{relatedItem.name}</span>)}</div>}<select defaultValue="" onChange={(event) => { void onRelate(event.target.value); event.currentTarget.value = ''; }} className="mt-3 w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2.5 text-sm"><option value="">Relacionar produto, serviço, catálogo ou documento…</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{catalogTypeLabel[candidate.type]} · {candidate.name}</option>)}</select></section></div><footer className="flex flex-wrap gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" onClick={onEdit} className="inline-flex items-center gap-2 rounded-lg border border-background-300 px-3 py-2 text-sm font-semibold text-foreground-700"><i className="ri-edit-line" />Editar</button><button type="button" onClick={onToggleAna} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${active ? 'bg-accent-100 text-accent-800' : 'bg-secondary-500 text-background-50'}`}><i className={active ? 'ri-pause-circle-line' : 'ri-play-circle-line'} />{active ? 'Pausar Ana' : 'Aprovar para Ana'}</button><button type="button" onClick={onDelete} className="ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-accent-700 hover:bg-accent-50"><i className="ri-delete-bin-6-line" />Excluir</button></footer></aside></div>;
}

function Block({ title, value }: { title: string; value: string }) { return <div><p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">{title}</p><p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-foreground-800">{value}</p></div>; }
function Tags({ title, values }: { title: string; values: string[] }) { return <div><p className="text-xs font-semibold uppercase tracking-wide text-foreground-500">{title}</p><div className="mt-2 flex flex-wrap gap-2">{values.map((value) => <span key={value} className="rounded-full bg-background-100 px-2.5 py-1 text-xs text-foreground-700">{value}</span>)}</div></div>; }

function ItemEditor({ draft, sources, itemType, saving, onChange, onClose, onSave }: { draft: KnowledgeCatalogDraft; sources: KnowledgeSource[]; itemType: KnowledgeCatalogItemType; saving: boolean; onChange: (draft: KnowledgeCatalogDraft) => void; onClose: () => void; onSave: () => void; }) {
  const update = (changes: Partial<KnowledgeCatalogDraft>) => onChange({ ...draft, ...changes });
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/50 p-4" onClick={onClose}><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background-50" onClick={(event) => event.stopPropagation()}><header className="flex items-center justify-between border-b border-background-200/70 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-primary-700">{catalogTypeLabel[itemType]}</p><h3 className="font-heading text-lg font-bold text-foreground-950">{draft.name ? 'Editar conteúdo' : `Novo ${catalogTypeLabel[itemType].toLowerCase()}`}</h3></div><button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-background-100"><i className="ri-close-line text-lg" /></button></header><div className="grid gap-4 p-5 md:grid-cols-2"><Field label="Fonte"><select value={draft.sourceId} onChange={(event) => { const source = sources.find((item) => item.id === event.target.value); update({ sourceId: event.target.value, sourceUrl: source?.sourceUrl || draft.sourceUrl, sourceLabel: source?.name || draft.sourceLabel }); }} className={fieldClassName}><option value="">Selecione uma fonte</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}</select></Field><Field label="Nome"><input value={draft.name} onChange={(event) => update({ name: event.target.value })} className={fieldClassName} /></Field><Field label="Código (se publicado)"><input value={draft.code || ''} onChange={(event) => update({ code: event.target.value })} className={fieldClassName} /></Field><Field label="Categoria"><input value={draft.category || ''} onChange={(event) => update({ category: event.target.value })} className={fieldClassName} /></Field>{itemType === 'product' && <Field label="Material"><input value={draft.material || ''} onChange={(event) => update({ material: event.target.value })} className={fieldClassName} /></Field>}<Field label="Aplicações (vírgulas)"><input value={(draft.applications || []).join(', ')} onChange={(event) => update({ applications: splitList(event.target.value) })} className={fieldClassName} /></Field><div className="md:col-span-2"><Field label="Resumo publicado"><textarea rows={3} value={draft.shortDescription || ''} onChange={(event) => update({ shortDescription: event.target.value })} className={`${fieldClassName} resize-y`} /></Field></div><div className="md:col-span-2"><Field label="Detalhes técnicos publicados"><textarea rows={5} value={draft.technicalDescription || ''} onChange={(event) => update({ technicalDescription: event.target.value })} className={`${fieldClassName} resize-y`} /></Field></div><div className="md:col-span-2"><Field label="Perguntas internas de qualificação (uma por linha)"><textarea rows={4} value={(draft.qualificationQuestions || []).join('\n')} onChange={(event) => update({ qualificationQuestions: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean).slice(0, 8) })} className={`${fieldClassName} resize-y`} /><small className="mt-1 block text-xs text-foreground-500">São guias para entender a necessidade; não substituem nem afirmam especificações técnicas.</small></Field></div><Field label="Palavras-chave e campanhas (vírgulas)"><input value={(draft.keywords || []).join(', ')} onChange={(event) => update({ keywords: splitList(event.target.value) })} className={fieldClassName} /></Field><Field label="URL de origem"><input type="url" value={draft.sourceUrl} onChange={(event) => update({ sourceUrl: event.target.value })} placeholder="https://" className={fieldClassName} /></Field><Field label="URL da imagem (opcional)"><input type="url" value={draft.imageUrl || ''} onChange={(event) => update({ imageUrl: event.target.value })} placeholder="https://" className={fieldClassName} /></Field><Field label="PDF/arquivo ou página de envio"><input type="url" value={draft.attachmentUrl || draft.websiteUrl || ''} onChange={(event) => update({ attachmentUrl: event.target.value })} placeholder="https://" className={fieldClassName} /></Field><label className="md:col-span-2 flex items-start gap-2 rounded-lg border border-background-200 bg-background-100/60 p-3 text-sm text-foreground-700"><input type="checkbox" checked={draft.status === 'active' && draft.anaEnabled} onChange={(event) => update({ status: event.target.checked ? 'active' : 'draft', anaEnabled: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary-500" /><span><strong>Disponibilizar para a Ana</strong><small className="mt-0.5 block text-xs text-foreground-500">Só ative após confirmar que as informações, URLs e conteúdo técnico refletem a fonte.</small></span></label></div><footer className="flex justify-end gap-2 border-t border-background-200/70 px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-background-300 px-3 py-2 text-sm font-semibold text-foreground-700">Cancelar</button><button type="button" onClick={onSave} disabled={saving} className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 hover:bg-primary-600 disabled:cursor-wait disabled:bg-primary-300">{saving ? 'Salvando…' : 'Salvar conteúdo'}</button></footer></div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-sm font-medium text-foreground-800"><span className="mb-1.5 block">{label}</span>{children}</label>; }
