import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import IntegracoesTab from './IntegracoesTab';
import WhatsappAccountPanel from '@/components/feature/WhatsappAccountPanel';
import WhatsappProviderControlPanel from '@/components/feature/WhatsappProviderControlPanel';
import EvolutionGoPanel from '@/components/feature/EvolutionGoPanel';
import WaAkgPanel from '@/components/feature/WaAkgPanel';
import {
  loadWhatsappAccounts,
  type WhatsappAccount,
  type WhatsappChannelCheck,
  type WhatsappChannelHistoryEntry,
  type WhatsappChannelOverview,
} from '@/lib/crm/whatsappAccountsRepository';
import {
  loadOperationalDiagnostics,
  type OperationalDiagnostics,
  type OperationalStatus,
} from '@/lib/crm/operationalDiagnosticsRepository';
import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

type View = 'configuration' | 'diagnostic' | 'history';
type Tone = 'ready' | 'attention' | 'pending' | 'neutral';

interface SiteEntry {
  id: string;
  name: string;
  source_label: string;
  public_phone: string;
  welcome_message: string;
  entry_code: string;
  active: boolean;
  updated_at?: string | null;
  link: string;
}

interface EntryForm {
  name: string;
  source_label: string;
  public_phone: string;
  welcome_message: string;
  active: boolean;
}

const emptyForm: EntryForm = {
  name: 'Site institucional',
  source_label: 'Site / WhatsApp',
  public_phone: '',
  welcome_message: 'Olá, vim pelo site e gostaria de falar com a Ana.',
  active: true,
};

function withDeadline<T>(request: Promise<T>, timeoutMs = 8_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('whatsapp_entries_request_timeout')), timeoutMs);
    request.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (error) => { clearTimeout(timeout); reject(error); },
    );
  });
}

async function invokeEntry<T>(action: 'load' | 'save' | 'rotate', payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('site-whatsapp-entry', { body: { action, ...payload } });
  if (error || !data?.ok) throw new Error(data?.erro ?? await detalheDoErroDeFuncao(error));
  return data as T;
}

function date(value: string | null | undefined): string {
  if (!value) return 'Ainda não registrado';
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data indisponível';
}

function phoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  return digits ? `+${digits}` : 'Não informado';
}

function errorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  if (code === 'permission_denied' || code === 'organization_access_denied') return 'Seu usuário não possui permissão para configurar esta entrada.';
  if (code === 'invalid_whatsapp_public_phone') return 'Informe um número público válido com DDI e DDD.';
  if (code === 'site_entry_fields_required') return 'Preencha nome, origem, número e mensagem inicial.';
  if (code === 'site_entry_not_configured') return 'Salve a entrada antes de gerar um novo link.';
  if (code === 'whatsapp_provider_disabled') return 'O provedor WhatsApp está desativado no Wayflex. Valide o canal em Configurações > Status operacional.';
  if (code === 'whatsapp_entries_request_timeout' || code === 'whatsapp_accounts_request_timeout' || code === 'operational_request_timeout') return 'Uma consulta operacional demorou mais do que o permitido. Os dados disponíveis foram mantidos; atualize o status para tentar novamente.';
  return 'Não foi possível concluir esta ação. Nenhuma configuração foi alterada.';
}

function ToneBadge({ tone, children }: { tone: Tone; children: string }) {
  const styles: Record<Tone, string> = {
    ready: 'bg-[#E8F7EF] text-[#147445]',
    attention: 'bg-[#FFF1D8] text-[#9A5D11]',
    pending: 'bg-[#EEF1F3] text-[#68757D]',
    neutral: 'bg-[#EEF1F3] text-[#68757D]',
  };
  const icons: Record<Tone, string> = { ready: 'ri-checkbox-circle-fill', attention: 'ri-error-warning-fill', pending: 'ri-time-line', neutral: 'ri-subtract-line' };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}><i className={icons[tone]} aria-hidden="true" />{children}</span>;
}

function Switch({ checked, disabled = false, label }: { checked: boolean; disabled?: boolean; label: string }) {
  return <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground-700"><span role="switch" aria-checked={checked} aria-label={label} className={`relative inline-flex h-6 w-10 items-center rounded-full p-1 transition ${checked ? 'bg-[#168654]' : 'bg-[#CBD3D8]'} ${disabled ? 'opacity-60' : ''}`}><span className={`h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? 'translate-x-4' : 'translate-x-0'}`} /></span><span>{checked ? 'Ativo' : 'Desativado'}</span></span>;
}

function CheckRow({ check }: { check: WhatsappChannelCheck }) {
  const tone: Tone = check.state === 'ready' ? 'ready' : check.state === 'attention' ? 'attention' : 'pending';
  const label = check.state === 'ready' ? 'Configurado' : check.state === 'attention' ? 'Atenção' : 'Pendente';
  return <div className="flex flex-col gap-2 border-b border-background-200/70 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground-900">{check.label}</p><p className="mt-0.5 text-xs leading-5 text-foreground-500">{check.detail}</p></div>
    <div className="flex shrink-0 items-center gap-3"><ToneBadge tone={tone}>{label}</ToneBadge><span className="hidden text-[11px] text-foreground-400 sm:inline">{date(check.checkedAt)}</span></div>
  </div>;
}

function RoutingRow({ icon, title, detail, tone, status, checked, disabled = true, onClick }: { icon: string; title: string; detail: string; tone: Tone; status: string; checked: boolean; disabled?: boolean; onClick?: () => void }) {
  return <div className="flex flex-col gap-3 border-b border-background-200/70 py-4 last:border-b-0 sm:flex-row sm:items-center sm:gap-4">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-lg text-primary-700"><i className={icon} aria-hidden="true" /></span>
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground-900">{title}</p><p className="mt-0.5 text-xs leading-5 text-foreground-500">{detail}</p></div>
    <div className="flex shrink-0 items-center gap-3"><ToneBadge tone={tone}>{status}</ToneBadge><button type="button" onClick={onClick} disabled={disabled} className="disabled:cursor-not-allowed" aria-label={`${title}: ${checked ? 'ativo' : 'desativado'}`}><Switch checked={checked} disabled={disabled} label={title} /></button></div>
  </div>;
}

function historyLabel(event: WhatsappChannelHistoryEntry): string {
  const labels: Record<string, string> = {
    'whatsapp_provider.enabled': 'Provedor ativado',
    'whatsapp_provider.disabled': 'Provedor desativado',
    'whatsapp_account.connected': 'Conta conectada',
    'whatsapp_account.connection_pending': 'Conexão pendente',
    'whatsapp.site_entry_saved': 'Entrada do site atualizada',
    'whatsapp.site_entry_rotated': 'Link público renovado',
  };
  return labels[event.action] || event.action.replaceAll('.', ' · ');
}

function statusForCheck(check: WhatsappChannelCheck | undefined): { tone: Tone; status: string } {
  if (!check) return { tone: 'pending', status: 'Não retornado' };
  return check.state === 'ready' ? { tone: 'ready', status: 'Configurado' } : check.state === 'attention' ? { tone: 'attention', status: 'Atenção' } : { tone: 'pending', status: 'Pendente' };
}

export default function WhatsAppEntriesTab() {
  const [view, setView] = useState<View>('configuration');
  const [entry, setEntry] = useState<SiteEntry | null>(null);
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [accounts, setAccounts] = useState<WhatsappAccount[]>([]);
  const [overview, setOverview] = useState<WhatsappChannelOverview | null>(null);
  const [history, setHistory] = useState<WhatsappChannelHistoryEntry[]>([]);
  const [diagnostics, setDiagnostics] = useState<OperationalDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [entryResult, accountsResult, diagnosticsResult] = await Promise.allSettled([
      withDeadline(invokeEntry<{ entry: SiteEntry | null }>('load')),
      loadWhatsappAccounts(),
      loadOperationalDiagnostics(),
    ]);
    if (entryResult.status === 'fulfilled') {
      const nextEntry = entryResult.value.entry;
      setEntry(nextEntry);
      if (nextEntry) setForm({ name: nextEntry.name, source_label: nextEntry.source_label, public_phone: nextEntry.public_phone, welcome_message: nextEntry.welcome_message, active: nextEntry.active });
    }
    if (accountsResult.status === 'fulfilled') {
      setAccounts(accountsResult.value.accounts);
      setHistory(accountsResult.value.channelHistory || []);
      const nextAccount = accountsResult.value.accounts.find((item) => item.accountType === 'corporate' && item.isDefault)
        || accountsResult.value.accounts.find((item) => item.accountType === 'corporate')
        || accountsResult.value.accounts[0];
      setOverview(nextAccount ? accountsResult.value.channelOverviews?.[nextAccount.id] || null : null);
    }
    if (diagnosticsResult.status === 'fulfilled') setDiagnostics(diagnosticsResult.value);
    const failedReads = [entryResult, accountsResult, diagnosticsResult].filter((result) => result.status === 'rejected');
    if (failedReads.length === 3) setNotice({ tone: 'error', text: 'Não foi possível carregar as informações reais da entrada agora.' });
    else if (failedReads.length > 0) setNotice({ tone: 'error', text: 'Parte do diagnóstico demorou mais do que o permitido. Os dados reais disponíveis permanecem visíveis; atualize o status para tentar novamente.' });
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const account = useMemo(() => accounts.find((item) => item.accountType === 'corporate' && item.isDefault) || accounts.find((item) => item.accountType === 'corporate') || accounts[0] || null, [accounts]);
  const webhookCheck = overview?.checks.find((check) => check.key === 'events');
  const routingCheck = overview?.checks.find((check) => check.key === 'routing');
  const deliveryCheck = overview?.checks.find((check) => check.key === 'send_receive');
  const statusChecks = diagnostics?.status.checks || [];
  const aiCheck = statusChecks.find((check) => check.id === 'ia' || check.id === 'ia_empresa');
  const whatsappCheck = statusChecks.find((check) => check.id === 'whatsapp');
  const webhookOperationalCheck = statusChecks.find((check) => check.id === 'whatsapp_webhook');
  const entryPhoneValid = form.public_phone.replace(/\D/g, '').length >= 10 && form.public_phone.replace(/\D/g, '').length <= 15;
  const receivingAttention = diagnostics?.status.webhookDiagnostic.state === 'lead_not_matched' || diagnostics?.status.webhookDiagnostic.state === 'processing_failed' || diagnostics?.status.webhookDiagnostic.state === 'unsupported_callback';
  const anaReady = Boolean(aiCheck?.ok && whatsappCheck?.ok && webhookOperationalCheck?.ok && statusChecks.find((check) => check.id === 'scheduler')?.ok);
  const entryStatus = entry?.active ? { tone: 'ready' as Tone, label: 'Ativa' } : { tone: 'neutral' as Tone, label: 'Desativada' };
  const eventStatus = statusForCheck(webhookCheck);
  const leadStatus = diagnostics?.status.webhookDiagnostic.state === 'lead_not_matched' ? { tone: 'attention' as Tone, label: 'Atenção' } : { tone: 'pending' as Tone, label: 'Não separado' };
  const fallbackReady = routingCheck?.state === 'ready' && overview?.routing.active === true;

  const save = async () => {
    if (saving) return;
    if (!entryPhoneValid) { setNotice({ tone: 'error', text: 'Informe um número público válido com DDI e DDD.' }); return; }
    if (!form.name.trim() || !form.source_label.trim() || !form.welcome_message.trim()) { setNotice({ tone: 'error', text: 'Preencha os campos obrigatórios antes de salvar.' }); return; }
    if (entry?.active && !form.active && !window.confirm('Desativar a entrada impede novos links do site de encaminharem conversas. A configuração será preservada. Continuar?')) return;
    setSaving(true); setNotice(null);
    try {
      const result = await invokeEntry<{ entry: SiteEntry }>('save', { ...form, public_phone: form.public_phone.replace(/\D/g, '') });
      setEntry(result.entry); setNotice({ tone: 'success', text: result.entry.active ? 'Entrada salva e ativa no ambiente real.' : 'Entrada salva e desativada. O histórico foi preservado.' });
      await refresh();
    } catch (error) { setNotice({ tone: 'error', text: errorMessage(error) }); }
    finally { setSaving(false); }
  };

  const rotateLink = async () => {
    if (rotating || !entry) return;
    if (!window.confirm('Gerar um novo link invalida o link público anterior. Continuar?')) return;
    setRotating(true); setNotice(null);
    try { const result = await invokeEntry<{ entry: SiteEntry }>('rotate'); setEntry(result.entry); setNotice({ tone: 'success', text: 'Novo link gerado. O anterior deixou de ser válido.' }); await refresh(); }
    catch (error) { setNotice({ tone: 'error', text: errorMessage(error) }); }
    finally { setRotating(false); }
  };

  const copyLink = async () => {
    if (!entry?.link) return;
    try { await navigator.clipboard.writeText(entry.link); setNotice({ tone: 'success', text: 'Link público copiado.' }); }
    catch { setNotice({ tone: 'error', text: 'Não foi possível copiar automaticamente o link.' }); }
  };

  const validateControlled = async () => {
    if (validating) return;
    setValidating(true); setNotice(null);
    try {
      const { data, error } = await supabase.functions.invoke('testar-integracao', { body: { canal: 'whatsapp' } });
      if (error || !data?.pronto) throw new Error(error ? await detalheDoErroDeFuncao(error) : data?.erro || data?.detalhe || 'whatsapp_provider_disabled');
      setNotice({ tone: 'success', text: 'Validação controlada concluída. Nenhuma mensagem foi enviada e nenhuma conversa foi criada.' });
      await refresh();
    } catch (error) { setNotice({ tone: 'error', text: errorMessage(error) }); }
    finally { setValidating(false); }
  };

  if (loading && !diagnostics && !entry) return <div className="cc-operational-loading"><i className="ri-loader-4-line animate-spin text-xl" /><span>Carregando Entradas do WhatsApp…</span></div>;

  return <div className="space-y-5" data-testid="whatsapp-entries-tab">
    <header className="flex flex-col gap-3 border-b border-background-200/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="wf-eyebrow">Canais de atendimento</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground-950">Entradas do WhatsApp</h2><p className="mt-1 text-sm text-foreground-500">Links, recebimento e roteamento.</p></div>
      <div className="flex flex-wrap gap-2"><Link to="/dashboard/configuracoes?tab=registro" className="wf-btn-secondary text-xs"><i className="ri-history-line" />Registro de auditoria</Link><button type="button" className="wf-btn-secondary text-xs" onClick={() => void refresh()} disabled={loading}><i className={loading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />Atualizar status</button></div>
    </header>

    {notice && <div role="status" className={`rounded-xl border px-3.5 py-3 text-sm ${notice.tone === 'success' ? 'border-[#B9E4CB] bg-[#EFFAF3] text-[#176B43]' : 'border-[#E8B8B1] bg-[#FFF4F2] text-[#8B3027]'}`}>{notice.text}</div>}

    <nav className="flex gap-5 border-b border-background-200" aria-label="Seções das entradas do WhatsApp"><button type="button" className={`border-b-2 px-1 pb-3 text-sm font-semibold ${view === 'configuration' ? 'border-primary-600 text-primary-700' : 'border-transparent text-foreground-500'}`} onClick={() => setView('configuration')}>Configuração</button><button type="button" className={`border-b-2 px-1 pb-3 text-sm font-semibold ${view === 'diagnostic' ? 'border-primary-600 text-primary-700' : 'border-transparent text-foreground-500'}`} onClick={() => setView('diagnostic')}>Diagnóstico</button><button type="button" className={`border-b-2 px-1 pb-3 text-sm font-semibold ${view === 'history' ? 'border-primary-600 text-primary-700' : 'border-transparent text-foreground-500'}`} onClick={() => setView('history')}>Histórico</button></nav>

    {view === 'configuration' && <>
      <EvolutionGoPanel />
      {receivingAttention && <details className="rounded-xl border border-[#F0C171] bg-[#FFF8E9] text-[#8B5A1D]"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Diagnóstico do canal requer atenção <i className="ri-arrow-down-s-line float-right" /></summary><div className="flex flex-col gap-3 border-t border-[#F0C171] px-4 py-3 text-xs sm:flex-row sm:items-center"><p className="flex-1">{diagnostics?.status.webhookDiagnostic.detail || 'O último callback não foi processado.'}</p><Link to="/dashboard/configuracoes?tab=registro" className="wf-btn-secondary text-xs">Abrir diagnóstico <i className="ri-arrow-right-line" /></Link></div></details>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,.9fr)]">
        <section className="wf-surface overflow-hidden"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-background-200/70 px-5 py-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F7EF] text-xl text-[#168654]"><i className="ri-whatsapp-line" /></span><div><h3 className="text-base font-semibold text-foreground-950">Entrada do site</h3><p className="mt-1 text-xs text-foreground-500">Link público para receber conversas do seu site.</p></div></div><ToneBadge tone={entryStatus.tone}>{entryStatus.label}</ToneBadge></div><div className="space-y-4 p-5">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-background-200 bg-background-50 px-3.5 py-3"><span><span className="block text-sm font-semibold text-foreground-900">Ativar entrada no site</span><span className="mt-0.5 block text-xs text-foreground-500">Permite que o link receba novas conversas.</span></span><button type="button" onClick={() => setForm((current) => ({ ...current, active: !current.active }))} aria-label="Ativar entrada no site"><Switch checked={form.active} label="Ativar entrada no site" /></button></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-foreground-700">Nome da entrada<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-background-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500" /></label><label className="text-sm font-medium text-foreground-700">Origem<input value={form.source_label} onChange={(event) => setForm({ ...form, source_label: event.target.value })} className="mt-1.5 w-full rounded-xl border border-background-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500" /></label></div>
          <label className="block text-sm font-medium text-foreground-700">Número público<input inputMode="tel" value={form.public_phone} onChange={(event) => setForm({ ...form, public_phone: event.target.value.replace(/\D/g, '') })} className="mt-1.5 w-full rounded-xl border border-background-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500" placeholder="5511999999999" /><span className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs font-normal text-foreground-500"><span>Use E.164 com DDI e DDD. Exibição: {phoneDisplay(form.public_phone)}</span>{entryPhoneValid && <span className="font-semibold text-[#168654]"><i className="ri-checkbox-circle-fill" /> Formato validado</span>}</span></label>
          <label className="block text-sm font-medium text-foreground-700">Mensagem inicial<textarea value={form.welcome_message} onChange={(event) => setForm({ ...form, welcome_message: event.target.value })} maxLength={500} rows={3} className="mt-1.5 w-full resize-y rounded-xl border border-background-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-500" /><span className="mt-1 block text-right text-xs font-normal text-foreground-400">{form.welcome_message.length}/500</span></label>
          <div className="flex flex-wrap gap-2"><button type="button" className="wf-btn-primary text-xs disabled:opacity-60" disabled={saving} onClick={() => void save()}><i className={saving ? 'ri-loader-4-line animate-spin' : 'ri-save-line'} />{saving ? 'Salvando…' : 'Salvar alterações'}</button><button type="button" className="wf-btn-secondary text-xs disabled:opacity-60" disabled={validating} onClick={() => void validateControlled()}><i className={validating ? 'ri-loader-4-line animate-spin' : 'ri-play-circle-line'} />{validating ? 'Validando…' : 'Testar em ambiente controlado'}</button></div>
          <div className="rounded-xl border border-background-200 bg-background-50 p-3.5"><p className="text-xs font-semibold uppercase tracking-[.1em] text-foreground-500">Link público</p>{entry?.link ? <div className="mt-2 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs text-foreground-700">wa.me/{entry.public_phone}</code><button type="button" className="wf-btn-secondary text-xs" onClick={() => void copyLink()}><i className="ri-file-copy-line" />Copiar link</button><button type="button" className="wf-btn-secondary text-xs disabled:opacity-60" disabled={rotating} onClick={() => void rotateLink()}><i className={rotating ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />{rotating ? 'Gerando…' : 'Gerar novo link'}</button></div> : <p className="mt-2 text-xs text-foreground-500">Salve uma configuração válida para gerar o link público.</p>}</div>
        </div></section>

        <div className="space-y-5"><section className="wf-surface p-5"><div className="flex items-start gap-3 border-b border-background-200/70 pb-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF3FF] text-xl text-[#176FB8]"><i className="ri-node-tree" /></span><div><h3 className="text-base font-semibold text-foreground-950">Recebimento e roteamento</h3><p className="mt-1 text-xs text-foreground-500">Como as conversas chegam e são processadas.</p></div></div><div className="mt-1">
          <RoutingRow icon="ri-link" title="Webhook do canal" detail={webhookCheck?.detail || 'Aguardando confirmação do callback no backend.'} tone={eventStatus.tone} status={eventStatus.status} checked={webhookCheck?.state === 'ready'} />
          <RoutingRow icon="ri-user-search-line" title="Identificar lead" detail={diagnostics?.status.webhookDiagnostic.state === 'lead_not_matched' ? 'O último callback não foi vinculado a um lead.' : 'A identificação usa o número normalizado e as regras do webhook.'} tone={leadStatus.tone} status={leadStatus.label} checked={diagnostics?.status.webhookDiagnostic.state === 'homologated'} />
          <RoutingRow icon="ri-robot-2-line" title="Encaminhar para Ana" detail={anaReady ? 'Pré-requisitos operacionais confirmados pelo backend.' : 'Bloqueado até IA, WhatsApp, callbacks e worker serem validados.'} tone={anaReady ? 'ready' : 'pending'} status={anaReady ? 'Configurado' : 'Bloqueado'} checked={anaReady} />
          <RoutingRow icon="ri-team-line" title="Fila humana de fallback" detail={overview?.routing.detail || 'Destino real não retornado pelo backend.'} tone={fallbackReady ? 'ready' : 'pending'} status={fallbackReady ? 'Pronto' : 'Pendente'} checked={fallbackReady} />
        </div></section>
        <section className="wf-surface p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-base font-semibold text-foreground-950">Pré-requisitos</h3><p className="mt-1 text-xs text-foreground-500">Itens necessários para o funcionamento da entrada.</p></div><button type="button" className="wf-btn-secondary text-xs" onClick={() => void refresh()}><i className="ri-refresh-line" />Validar agora</button></div><div className="mt-4 space-y-2"><div className="flex items-center justify-between rounded-lg bg-background-50 px-3 py-2.5 text-sm"><span><i className="ri-checkbox-circle-fill mr-2 text-[#168654]" />Número público validado</span><ToneBadge tone={entryPhoneValid ? 'ready' : 'attention'}>{entryPhoneValid ? 'Concluído' : 'Pendente'}</ToneBadge></div><div className="flex items-center justify-between rounded-lg bg-background-50 px-3 py-2.5 text-sm"><span><i className="ri-checkbox-circle-fill mr-2 text-[#168654]" />Callback vinculado a lead</span><ToneBadge tone={diagnostics?.status.webhookDiagnostic.state === 'homologated' ? 'ready' : 'attention'}>{diagnostics?.status.webhookDiagnostic.state === 'homologated' ? 'Concluído' : 'Pendente'}</ToneBadge></div><div className="flex items-center justify-between rounded-lg bg-background-50 px-3 py-2.5 text-sm"><span><i className="ri-checkbox-circle-fill mr-2 text-[#168654]" />Destino definido</span><ToneBadge tone={fallbackReady ? 'ready' : 'pending'}>{fallbackReady ? 'Concluído' : 'Pendente'}</ToneBadge></div></div></section></div>
      </div>

      <section className="wf-surface overflow-hidden"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-background-200/70 px-5 py-4"><div><h3 className="text-base font-semibold text-foreground-950">Atividade recente</h3><p className="mt-1 text-xs text-foreground-500">Últimas ações relacionadas a esta entrada e ao canal.</p></div><button type="button" className="wf-btn-secondary text-xs" onClick={() => setView('history')}>Ver histórico completo <i className="ri-arrow-right-line" /></button></div><div className="grid divide-y divide-background-200/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">{history.slice(0, 3).map((event) => <div key={event.id} className="flex gap-3 px-5 py-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><i className="ri-pulse-line" /></span><div><p className="text-sm font-semibold text-foreground-800">{historyLabel(event)}</p><p className="mt-1 text-xs text-foreground-500">{event.detail}</p><p className="mt-1 text-[11px] text-foreground-400">{date(event.occurredAt)}</p></div></div>)}{history.length === 0 && <p className="px-5 py-6 text-sm text-foreground-500 sm:col-span-3">Nenhuma ação de canal retornada pelo backend.</p>}</div></section>

      <details className="wf-surface overflow-hidden"><summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-foreground-900">Provedores legados e contingência <i className="ri-arrow-down-s-line float-right text-foreground-500" /></summary><div className="space-y-5 border-t border-background-200/70 p-5"><p className="rounded-xl border border-[#E9D2A9] bg-[#FFF8EA] px-3 py-2 text-xs leading-5 text-[#7B521B]">WA-AKG, Z-API e Meta permanecem disponíveis para transição e retorno seguro. Não conecte o mesmo número em dois provedores ao mesmo tempo.</p><WaAkgPanel /><WhatsappProviderControlPanel /><div className="grid gap-5 xl:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-[.1em] text-[#128C3E]">Z-API</p><div className="mt-3"><IntegracoesTab category="communication" /></div></div><div><p className="text-xs font-semibold uppercase tracking-[.1em] text-[#0866ff]">Meta WhatsApp Cloud API</p><div className="mt-3"><WhatsappAccountPanel mode="meta" /></div></div></div></div></details>
    </>}

    {view === 'diagnostic' && <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,.85fr)]"><section className="wf-surface p-5"><div className="flex items-start justify-between gap-3"><div><p className="wf-eyebrow">Diagnóstico do recebimento</p><h3 className="mt-1 text-lg font-semibold text-foreground-950">Último callback e roteamento</h3><p className="mt-1 text-sm text-foreground-500">Dados retornados pelo backend; nenhum resultado é inferido no navegador.</p></div><button type="button" className="wf-btn-secondary text-xs" onClick={() => void refresh()}><i className="ri-refresh-line" />Atualizar</button></div><dl className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-background-50 p-3.5"><dt className="text-xs text-foreground-500">Estado</dt><dd className="mt-1 text-sm font-semibold text-foreground-900">{diagnostics?.status.webhookDiagnostic.state || 'Não retornado'}</dd></div><div className="rounded-xl bg-background-50 p-3.5"><dt className="text-xs text-foreground-500">Último callback</dt><dd className="mt-1 text-sm font-semibold text-foreground-900">{date(diagnostics?.status.webhookDiagnostic.lastEventAt)}</dd></div><div className="rounded-xl bg-background-50 p-3.5 sm:col-span-2"><dt className="text-xs text-foreground-500">Motivo reportado</dt><dd className="mt-1 text-sm leading-6 text-foreground-800">{diagnostics?.status.webhookDiagnostic.detail || 'Não retornado pelo backend.'}</dd></div><div className="rounded-xl bg-background-50 p-3.5"><dt className="text-xs text-foreground-500">Lead de teste</dt><dd className="mt-1 text-sm font-semibold text-foreground-900">{diagnostics?.status.webhookDiagnostic.testLead?.label || 'Não retornado'}</dd></div><div className="rounded-xl bg-background-50 p-3.5"><dt className="text-xs text-foreground-500">Telefone normalizado</dt><dd className="mt-1 text-sm font-semibold text-foreground-900">{diagnostics?.status.webhookDiagnostic.testLead?.phoneSuffix ? `final ${diagnostics.status.webhookDiagnostic.testLead.phoneSuffix}` : 'Não retornado'}</dd></div></dl><div className="mt-5 rounded-xl border border-[#E8B8B1] bg-[#FFF4F2] p-3.5 text-xs leading-5 text-[#8B3027]">Reprocessamento seguro só deve ser executado pelo Registro do Sistema quando existir evento elegível e permissão. Esta tela não duplica mensagens nem reenvia callbacks.</div></section><section className="wf-surface p-5"><h3 className="text-base font-semibold text-foreground-950">Checagens do canal</h3><p className="mt-1 text-xs text-foreground-500">Estado técnico atual da conta corporativa.</p><div className="mt-3">{overview?.checks?.map((check) => <CheckRow key={check.key} check={check} />) || <p className="py-5 text-sm text-foreground-500">Nenhuma conta de WhatsApp retornada.</p>}</div><div className="mt-4 rounded-xl bg-background-50 p-3 text-xs text-foreground-500">Último evento de entrada: {date(overview?.lastInboundAt)}. Aceite do teste direto: {date(overview?.directTestAcceptedAt)}.</div></section><section className="wf-surface p-5 xl:col-span-2"><h3 className="text-base font-semibold text-foreground-950">Entradas recentes</h3><div className="mt-3 grid gap-3 md:grid-cols-2">{diagnostics?.inbound.slice(0, 8).map((event) => <div key={event.id} className="rounded-xl border border-background-200 p-3"><p className="text-sm font-semibold text-foreground-800">{event.event_type || 'Evento de entrada'} · {event.status || 'sem status'}</p><p className="mt-1 text-xs text-foreground-500">{event.error_message || event.error || event.detail || 'Sem detalhe de erro.'}</p><p className="mt-1 text-[11px] text-foreground-400">{date(event.created_at || event.processed_at)}</p></div>)}{(!diagnostics?.inbound || diagnostics.inbound.length === 0) && <p className="text-sm text-foreground-500">Nenhuma entrada recente retornada.</p>}</div></section></div>}

    {view === 'history' && <section className="wf-surface overflow-hidden"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-background-200/70 px-5 py-4"><div><p className="wf-eyebrow">Auditoria do canal</p><h3 className="mt-1 text-lg font-semibold text-foreground-950">Histórico da entrada e do WhatsApp</h3><p className="mt-1 text-sm text-foreground-500">Ativações, alterações, validações e eventos registrados pelo servidor.</p></div><button type="button" className="wf-btn-secondary text-xs" onClick={() => void refresh()}><i className="ri-refresh-line" />Atualizar</button></div><div className="divide-y divide-background-200/70">{history.map((event) => <div key={event.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)_auto] sm:items-center"><div><p className="text-sm font-semibold text-foreground-900">{historyLabel(event)}</p><p className="mt-1 text-xs text-foreground-400">{event.actorName || 'Sistema'} · {date(event.occurredAt)}</p></div><p className="text-xs leading-5 text-foreground-600">{event.detail}</p><ToneBadge tone={event.result === 'success' ? 'ready' : event.result === 'attention' ? 'attention' : 'pending'}>{event.result === 'success' ? 'Sucesso' : event.result === 'attention' ? 'Atenção' : 'Pendente'}</ToneBadge></div>)}{history.length === 0 && <p className="px-5 py-10 text-center text-sm text-foreground-500">Nenhum evento de canal retornado pelo backend.</p>}</div></section>}
  </div>;
}
