import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

interface SiteEntry {
  id: string;
  name: string;
  source_label: string;
  public_phone: string;
  welcome_message: string;
  entry_code: string;
  active: boolean;
  link: string;
}

const emptyForm = { name: 'Site institucional', source_label: 'Site / WhatsApp', public_phone: '', welcome_message: 'Olá, vim pelo site e gostaria de falar com a Ana.', active: true };

function messageFor(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'permission_denied') return 'Seu usuário não possui permissão para configurar a entrada do site.';
  if (code === 'invalid_whatsapp_public_phone') return 'Informe o número público do WhatsApp com DDI e DDD.';
  if (code === 'site_entry_fields_required') return 'Preencha nome, origem, número e mensagem.';
  return 'Não foi possível concluir a configuração da entrada do site.';
}

async function invoke<T>(action: 'load' | 'save', payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('site-whatsapp-entry', { body: { action, ...payload } });
  if (error || !data?.ok) throw new Error(data?.erro ?? await detalheDoErroDeFuncao(error));
  return data as T;
}

export default function WhatsAppSiteEntry() {
  const [form, setForm] = useState(emptyForm);
  const [entry, setEntry] = useState<SiteEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void invoke<{ entry: SiteEntry | null }>('load')
      .then((result) => {
        setEntry(result.entry);
        if (result.entry) {
          setForm({
            name: result.entry.name,
            source_label: result.entry.source_label,
            public_phone: result.entry.public_phone,
            welcome_message: result.entry.welcome_message,
            active: result.entry.active,
          });
        }
      })
      .catch((error) => setNotice(messageFor(error)))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setNotice('');
    try {
      const result = await invoke<{ entry: SiteEntry }>('save', form);
      setEntry(result.entry);
      setNotice(result.entry.active ? 'Entrada do site salva e pronta para ser usada.' : 'Entrada do site salva como pausada.');
    } catch (error) { setNotice(messageFor(error)); }
    finally { setSaving(false); }
  };

  const copyLink = async () => {
    if (!entry?.link) return;
    try { await navigator.clipboard.writeText(entry.link); setNotice('Link copiado. Cole-o no botão do seu site.'); }
    catch { setNotice('Não foi possível copiar automaticamente. Selecione o link abaixo.'); }
  };

  return <section className="mt-5 rounded-xl border border-background-200 bg-background-50 p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Entrada do site</p>
        <h4 className="mt-1 text-base font-semibold text-foreground-950">Falar com a Ana pelo WhatsApp</h4>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-foreground-500">Gere o botão do seu site. Quando o visitante enviar a mensagem, o Wayflex cria ou encontra o lead, registra a conversa na Central e entrega o atendimento para a Ana.</p>
      </div>
      <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${entry?.active ? 'bg-primary-50 text-primary-800' : 'bg-background-100 text-foreground-600'}`}>{entry?.active ? 'Ativa' : 'Pausada'}</span>
    </div>
    {notice && <p className="mt-4 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-sm text-primary-800">{notice}</p>}
    {loading ? <p className="mt-5 text-sm text-foreground-500">Carregando entrada do site…</p> : <div className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium text-foreground-700">Nome da entrada<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-background-200 bg-white px-3 py-2.5 text-sm" placeholder="Site institucional" /></label>
      <label className="text-sm font-medium text-foreground-700">Origem mostrada no lead<input value={form.source_label} onChange={(event) => setForm({ ...form, source_label: event.target.value })} className="mt-1.5 w-full rounded-xl border border-background-200 bg-white px-3 py-2.5 text-sm" placeholder="Site / WhatsApp" /></label>
      <label className="text-sm font-medium text-foreground-700">Número WhatsApp público<input inputMode="numeric" value={form.public_phone} onChange={(event) => setForm({ ...form, public_phone: event.target.value.replace(/\D/g, '') })} className="mt-1.5 w-full rounded-xl border border-background-200 bg-white px-3 py-2.5 text-sm" placeholder="5511999999999" /><span className="mt-1 block text-xs font-normal text-foreground-500">Use DDI e DDD do mesmo número conectado ao WA-AKG.</span></label>
      <label className="flex items-start gap-3 rounded-xl border border-background-200 bg-white px-3 py-3 text-sm font-medium text-foreground-700"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="mt-0.5 h-4 w-4 accent-primary-600" /><span>Ativar esta entrada no site</span></label>
      <label className="md:col-span-2 text-sm font-medium text-foreground-700">Mensagem inicial<textarea value={form.welcome_message} onChange={(event) => setForm({ ...form, welcome_message: event.target.value })} maxLength={500} rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-background-200 bg-white px-3 py-2.5 text-sm" /></label>
      <div className="md:col-span-2 flex flex-wrap items-center gap-3"><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={saving} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar e gerar link'}</button>{entry?.link && <button type="button" className="wf-btn-secondary" onClick={() => void copyLink()}><i className="ri-file-copy-line" />Copiar link</button>}</div>
      {entry?.link && <label className="md:col-span-2 text-sm font-medium text-foreground-700">Link para o botão do site<input readOnly value={entry.link} className="mt-1.5 w-full rounded-xl border border-background-200 bg-background-100 px-3 py-2.5 text-xs text-foreground-700" /></label>}
    </div>}
  </section>;
}
