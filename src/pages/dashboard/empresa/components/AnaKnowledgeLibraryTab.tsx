import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { categoriasConhecimento, type CategoriaConhecimento } from '@/mocks/conhecimentoData';
import {
  deleteAnaKnowledgeSource, loadAnaKnowledgeSources, registerAnaKnowledgeLink, saveAnaKnowledgeText,
  setAnaKnowledgeStatus, uploadAnaKnowledgeFile, type AnaKnowledgeKind, type AnaKnowledgeSource,
} from '@/lib/crm/anaKnowledgeLibraryRepository';

const typeIcon: Record<AnaKnowledgeKind, string> = {
  documento: 'ri-file-text-line', imagem: 'ri-image-line', apresentacao: 'ri-slideshow-3-line',
  planilha: 'ri-file-excel-2-line', video: 'ri-video-line', link: 'ri-link', texto: 'ri-text',
};
const kindFromFile = (file: File): AnaKnowledgeKind => {
  const name = file.name.toLowerCase();
  if (/\.(png|jpe?g|webp)$/i.test(name)) return 'imagem';
  if (/\.(ppt|pptx)$/i.test(name)) return 'apresentacao';
  if (/\.(xls|xlsx|csv)$/i.test(name)) return 'planilha';
  if (/\.(mp4|webm|mov)$/i.test(name)) return 'video';
  if (/\.(txt|md)$/i.test(name)) return 'texto';
  return 'documento';
};
const statusStyle: Record<string, string> = {
  active: 'bg-secondary-100 text-secondary-700', draft: 'bg-primary-100 text-primary-700', processing: 'bg-accent-100 text-accent-700',
};
const statusLabel: Record<string, string> = { active: 'Aprovada para a Ana', draft: 'Aguardando aprovação', processing: 'Precisa de texto revisado' };
const formatSize = (size: string | null) => {
  const number = Number(size || 0); if (!number) return 'Link ou texto';
  if (number < 1024 * 1024) return `${Math.max(1, Math.round(number / 1024))} KB`;
  return `${(number / (1024 * 1024)).toFixed(1)} MB`;
};

export default function AnaKnowledgeLibraryTab() {
  const [sources, setSources] = useState<AnaKnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'review'>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [selected, setSelected] = useState<AnaKnowledgeSource | null>(null);
  const [toast, setToast] = useState('');

  const refresh = async () => {
    setLoading(true);
    try { setSources(await loadAnaKnowledgeSources()); setError(''); }
    catch { setError('Não foi possível carregar as fontes da Ana.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3200); };
  const updateStatus = async (source: AnaKnowledgeSource, publish: boolean) => {
    try { await setAnaKnowledgeStatus(source.id, publish); await refresh(); setSelected(null); notify(publish ? 'Fonte aprovada. A Ana já pode consultá-la.' : 'Fonte pausada. A Ana não a utilizará.'); }
    catch (cause) { notify(cause instanceof Error && cause.message === 'reviewed_text_required' ? 'Antes de aprovar, adicione um texto revisado ou uma transcrição.' : 'Não foi possível alterar o status da fonte.'); }
  };
  const remove = async (source: AnaKnowledgeSource) => {
    if (!window.confirm(`Remover “${source.name}” da Base aprovada da Ana?`)) return;
    try { await deleteAnaKnowledgeSource(source.id); await refresh(); setSelected(null); notify('Fonte removida da base da Ana.'); }
    catch { notify('Não foi possível remover esta fonte.'); }
  };
  const filtered = useMemo(() => sources.filter((source) => {
    const needle = query.trim().toLowerCase();
    const matchText = !needle || [source.name, source.category, source.tags.join(' '), source.content].join(' ').toLowerCase().includes(needle);
    const matchStatus = filter === 'all' || (filter === 'active' ? source.status === 'active' : source.status !== 'active');
    return matchText && matchStatus;
  }), [sources, query, filter]);
  const active = sources.filter((source) => source.status === 'active').length;
  const review = sources.length - active;

  return (
    <div className="space-y-4">
      {toast && <Notice icon="ri-information-line" tone="info">{toast}</Notice>}
      {error && <Notice icon="ri-error-warning-line" tone="warning"><span>{error}</span><button onClick={() => void refresh()} className="font-semibold underline">Tentar novamente</button></Notice>}

      <section className="bg-foreground-950 text-background-50 rounded-xl p-5 md:p-6">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-primary-200 text-xs font-semibold uppercase tracking-[.12em]">Base aprovada da Ana</p>
            <h2 className="mt-1 text-xl font-heading font-bold">Documentos, fotos, portfólio e vídeos com resposta segura</h2>
            <p className="mt-2 text-sm text-background-200 leading-relaxed">Todo material entra como rascunho. A Ana só consulta uma fonte depois que você revisa o texto extraído, resumo técnico ou transcrição e a aprova.</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button onClick={() => setLinkOpen(true)} className="px-3.5 py-2 border border-background-50/25 hover:bg-background-50/10 rounded-lg text-sm font-semibold"><i className="ri-link mr-1.5" />Adicionar link</button>
            <button onClick={() => setUploadOpen(true)} className="px-3.5 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg text-sm font-bold"><i className="ri-upload-2-line mr-1.5" />Enviar arquivo</button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Metric label="Fontes aprovadas" value={active} icon="ri-shield-check-line" />
          <Metric label="Aguardando revisão" value={review} icon="ri-time-line" />
          <Metric label="Textos consultáveis" value={sources.filter((source) => source.chunks > 0).length} icon="ri-file-search-line" />
        </div>
      </section>

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1"><i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por documento, produto, material ou palavra-chave" className="w-full pl-9 pr-3 py-2.5 border border-background-300 rounded-lg bg-background-50 text-sm" /></div>
        <div className="flex rounded-lg bg-background-100 p-1 self-start md:self-auto">
          {([{ id: 'all', label: 'Todas' }, { id: 'active', label: 'Aprovadas' }, { id: 'review', label: 'Revisar' }] as const).map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${filter === item.id ? 'bg-background-50 text-foreground-900 shadow-sm' : 'text-foreground-500'}`}>{item.label}</button>)}
        </div>
      </div>

      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-background-200/70 flex justify-between"><h3 className="font-heading font-bold text-sm">Fontes da memória</h3><span className="text-xs text-foreground-500">{loading ? 'Carregando…' : `${filtered.length} itens`}</span></div>
        <div className="divide-y divide-background-100">
          {!loading && filtered.length === 0 && <div className="py-12 text-center text-foreground-500 text-sm"><i className="ri-inbox-line block text-3xl mb-2" />Nenhuma fonte encontrada.</div>}
          {filtered.map((source) => <button key={source.id} onClick={() => setSelected(source)} className="w-full px-5 py-4 text-left hover:bg-background-100/60 flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-background-100 text-primary-700 flex items-center justify-center shrink-0"><i className={`${typeIcon[source.kind]} text-lg`} /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold text-sm text-foreground-900 truncate">{source.name}</span><span className="block mt-0.5 text-xs text-foreground-500 truncate">{categoryLabel(source.category)} · {source.tags.length ? source.tags.join(', ') : formatSize(source.size)} · {source.chunks ? `${source.chunks} trechos revisados` : 'sem texto consultável'}</span></span>
            <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${statusStyle[source.status]}`}>{statusLabel[source.status]}</span><i className="ri-arrow-right-s-line text-foreground-400" />
          </button>)}
        </div>
      </div>

      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onDone={async () => { setUploadOpen(false); await refresh(); notify('Arquivo adicionado. Revise o conteúdo antes de aprovar para a Ana.'); }} />}
      {linkOpen && <LinkModal onClose={() => setLinkOpen(false)} onDone={async () => { setLinkOpen(false); await refresh(); notify('Link adicionado. Revise o conteúdo antes de aprovar para a Ana.'); }} />}
      {selected && <ReviewPanel source={selected} onClose={() => setSelected(null)} onRefresh={refresh} onStatus={updateStatus} onDelete={remove} notify={notify} />}
    </div>
  );
}

function Notice({ children, icon, tone }: { children: ReactNode; icon: string; tone: 'info' | 'warning' }) {
  return <div className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${tone === 'info' ? 'bg-primary-100 border border-primary-200 text-primary-800' : 'bg-accent-100 border border-accent-300 text-accent-800'}`}><i className={icon} />{children}</div>;
}
function Metric({ label, value, icon }: { label: string; value: number; icon: string }) { return <div className="rounded-lg bg-background-50/10 border border-background-50/10 p-3 flex items-center gap-3"><i className={`${icon} text-primary-200 text-lg`} /><div><strong className="text-lg leading-none">{value}</strong><span className="block mt-1 text-xs text-background-200">{label}</span></div></div>; }
function categoryLabel(category: CategoriaConhecimento) { return categoriasConhecimento.find((item) => item.id === category)?.nome || category; }

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null); const [file, setFile] = useState<File | null>(null); const [category, setCategory] = useState<CategoriaConhecimento>('solucoes_e_produtos'); const [tags, setTags] = useState(''); const [note, setNote] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const submit = async () => {
    if (!file) { setError('Selecione um arquivo.'); return; }
    if (file.size > 100 * 1024 * 1024) { setError('O arquivo deve ter no máximo 100 MB.'); return; }
    setSaving(true); setError('');
    try { await uploadAnaKnowledgeFile({ file, category, kind: kindFromFile(file), tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean), processingNote: note }); await onDone(); }
    catch { setError('Não foi possível enviar o arquivo. Confira o formato e tente novamente.'); }
    finally { setSaving(false); }
  };
  return <Modal title="Adicionar documento ou mídia" onClose={onClose}><div className="space-y-4">{error && <Notice tone="warning" icon="ri-error-warning-line">{error}</Notice>}<div><label className="block text-sm font-medium text-foreground-800 mb-1.5">Arquivo</label><input ref={input} type="file" accept=".pdf,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />{file && <p className="mt-1 text-xs text-foreground-500">{file.name} · {formatSize(String(file.size))}</p>}</div><SourceFields category={category} setCategory={setCategory} tags={tags} setTags={setTags} note={note} setNote={setNote} /><p className="text-xs text-foreground-500">PDFs, fotos, apresentações e vídeos ficam privados. Para a Ana usar o material, abra a fonte depois do envio e registre o texto, resumo técnico ou transcrição revisada.</p></div><ModalActions onClose={onClose} onSave={submit} saving={saving} label="Enviar para revisão" /></Modal>;
}

function LinkModal({ onClose, onDone }: { onClose: () => void; onDone: () => Promise<void> }) {
  const [name, setName] = useState(''); const [url, setUrl] = useState(''); const [content, setContent] = useState(''); const [category, setCategory] = useState<CategoriaConhecimento>('institucional'); const [kind, setKind] = useState<AnaKnowledgeKind>('link'); const [tags, setTags] = useState(''); const [note, setNote] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const submit = async () => { if (!name.trim() || !url.trim()) { setError('Informe um título e um link válido.'); return; } setSaving(true); setError(''); try { await registerAnaKnowledgeLink({ name, sourceUrl: url, content, category, kind, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean), processingNote: note }); await onDone(); } catch { setError('Não foi possível adicionar o link.'); } finally { setSaving(false); } };
  const label = 'block text-sm font-medium text-foreground-800 mb-1.5'; const field = 'w-full px-3 py-2.5 border border-background-300 rounded-lg bg-background-50 text-sm text-foreground-900';
  return <Modal title="Adicionar link, portfólio ou vídeo" onClose={onClose}><div className="space-y-4">{error && <Notice tone="warning" icon="ri-error-warning-line">{error}</Notice>}<div><label className={label}>Título</label><input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Ex.: Vídeo de apresentação da linha de vedação" /></div><div><label className={label}>Link</label><input value={url} onChange={(e) => setUrl(e.target.value)} className={field} placeholder="https://…" /></div><div><label className={label}>Tipo</label><select value={kind} onChange={(e) => setKind(e.target.value as AnaKnowledgeKind)} className={field}><option value="link">Página ou portfólio</option><option value="video">Vídeo</option><option value="documento">Documento externo</option></select></div><SourceFields category={category} setCategory={setCategory} tags={tags} setTags={setTags} note={note} setNote={setNote} /><div><label className={label}>Texto, resumo ou transcrição já revisada <span className="text-foreground-400">(opcional)</span></label><textarea value={content} onChange={(e) => setContent(e.target.value)} className={`${field} min-h-28`} placeholder="Cole a descrição oficial, os pontos técnicos ou a transcrição do vídeo." /></div></div><ModalActions onClose={onClose} onSave={submit} saving={saving} label="Adicionar para revisão" /></Modal>;
}

function ReviewPanel({ source, onClose, onRefresh, onStatus, onDelete, notify }: { source: AnaKnowledgeSource; onClose: () => void; onRefresh: () => Promise<void>; onStatus: (source: AnaKnowledgeSource, publish: boolean) => Promise<void>; onDelete: (source: AnaKnowledgeSource) => Promise<void>; notify: (text: string) => void }) {
  const [content, setContent] = useState(source.content); const [category, setCategory] = useState(source.category); const [tags, setTags] = useState(source.tags.join(', ')); const [note, setNote] = useState(source.processingNote || ''); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const save = async () => { if (!content.trim()) { setError('Inclua o texto revisado, resumo técnico ou transcrição que a Ana poderá consultar.'); return; } setSaving(true); setError(''); try { await saveAnaKnowledgeText(source.id, { content, category, kind: source.kind, tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean), processingNote: note }); await onRefresh(); notify('Texto revisado salvo. Aprove a fonte quando estiver correto.'); } catch { setError('Não foi possível salvar o texto revisado.'); } finally { setSaving(false); } };
  const label = 'block text-sm font-medium text-foreground-800 mb-1.5'; const field = 'w-full px-3 py-2.5 border border-background-300 rounded-lg bg-background-50 text-sm text-foreground-900';
  return <div className="fixed inset-0 z-50 bg-foreground-950/45 flex justify-end" onClick={onClose}><section className="w-full max-w-2xl bg-background-50 h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}><div className="sticky top-0 bg-background-50 px-6 py-5 border-b border-background-200/70 flex gap-4 justify-between"><div className="min-w-0"><span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-semibold ${statusStyle[source.status]}`}>{statusLabel[source.status]}</span><h3 className="mt-2 font-heading font-bold text-lg truncate">{source.name}</h3><p className="mt-1 text-sm text-foreground-500">{categoryLabel(source.category)} · {formatSize(source.size)} · {source.chunks} trechos</p></div><button onClick={onClose} className="w-8 h-8 shrink-0 rounded-lg hover:bg-background-100"><i className="ri-close-line text-lg" /></button></div><div className="p-6 space-y-5">{error && <Notice tone="warning" icon="ri-error-warning-line">{error}</Notice>}<div className="rounded-lg border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900"><strong>Regra de segurança:</strong> a Ana não interpreta automaticamente um arquivo como fato comercial. Use o campo abaixo para registrar somente o conteúdo correto e aprovado da WayFlex.</div>{source.sourceUrl && <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:underline"><i className="ri-external-link-line" />Abrir fonte original</a>}<SourceFields category={category} setCategory={setCategory} tags={tags} setTags={setTags} note={note} setNote={setNote} /><div><label className={label}>Texto que a Ana pode consultar</label><textarea value={content} onChange={(e) => setContent(e.target.value)} className={`${field} min-h-72`} placeholder={source.kind === 'video' ? 'Cole a transcrição revisada do vídeo e os pontos técnicos aprovados.' : source.kind === 'imagem' ? 'Descreva a foto, a peça, aplicações e limites técnicos já confirmados.' : 'Cole ou revise o conteúdo que a Ana poderá usar para responder.'} /><p className="mt-1.5 text-xs text-foreground-500">Não inclua instruções para a Ana. Inclua apenas informações comprovadas, limitações e condições de uso.</p></div></div><div className="sticky bottom-0 bg-background-50 border-t border-background-200/70 p-4 flex flex-wrap gap-2 justify-between"><button onClick={() => void onDelete(source)} className="px-3.5 py-2 text-sm font-semibold text-accent-600 hover:bg-accent-50 rounded-lg"><i className="ri-delete-bin-6-line mr-1" />Excluir</button><div className="flex flex-wrap gap-2"><button onClick={() => void save()} disabled={saving} className="px-3.5 py-2 border border-background-300 text-sm font-semibold rounded-lg hover:bg-background-100 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar texto revisado'}</button>{source.status === 'active' ? <button onClick={() => void onStatus(source, false)} className="px-3.5 py-2 bg-background-200 text-foreground-800 text-sm font-bold rounded-lg">Pausar fonte</button> : <button onClick={() => void onStatus(source, true)} className="px-3.5 py-2 bg-secondary-500 hover:bg-secondary-600 text-background-50 text-sm font-bold rounded-lg">Aprovar para a Ana</button>}</div></div></section></div>;
}

function SourceFields({ category, setCategory, tags, setTags, note, setNote }: { category: CategoriaConhecimento; setCategory: (value: CategoriaConhecimento) => void; tags: string; setTags: (value: string) => void; note: string; setNote: (value: string) => void }) { const label = 'block text-sm font-medium text-foreground-800 mb-1.5'; const field = 'w-full px-3 py-2.5 border border-background-300 rounded-lg bg-background-50 text-sm text-foreground-900'; return <><div><label className={label}>Categoria</label><select value={category} onChange={(e) => setCategory(e.target.value as CategoriaConhecimento)} className={field}>{categoriasConhecimento.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></div><div><label className={label}>Palavras-chave</label><input value={tags} onChange={(e) => setTags(e.target.value)} className={field} placeholder="Ex.: vedação, EPDM, indústria alimentícia" /></div><div><label className={label}>Observação interna <span className="text-foreground-400">(opcional)</span></label><input value={note} onChange={(e) => setNote(e.target.value)} className={field} placeholder="Ex.: revisar a cada nova versão do catálogo" /></div></>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-50 bg-foreground-950/50 p-4 flex items-center justify-center" onClick={onClose}><section className="bg-background-50 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}><header className="px-6 py-4 border-b border-background-200/70 flex justify-between items-center"><h3 className="font-heading font-bold">{title}</h3><button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-background-100"><i className="ri-close-line text-lg" /></button></header><div className="p-6">{children}</div></section></div>; }
function ModalActions({ onClose, onSave, saving, label }: { onClose: () => void; onSave: () => void; saving: boolean; label: string }) { return <div className="mt-6 pt-4 border-t border-background-200/70 flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold border border-background-300 rounded-lg hover:bg-background-100">Cancelar</button><button onClick={onSave} disabled={saving} className="px-4 py-2.5 text-sm font-bold bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-background-50 rounded-lg">{saving ? 'Salvando…' : label}</button></div>; }
