import { useCallback, useEffect, useState } from 'react';
import {
  createEvolutionGoInstance,
  loadEvolutionGoStatus,
  requestEvolutionGoPairingCode,
  requestEvolutionGoQr,
  runEvolutionGoAction,
  saveEvolutionGoConfiguration,
  type EvolutionGoChannelStatus,
  type EvolutionGoConfigurationInput,
} from '@/lib/crm/whatsappAccountsRepository';

type Form = Required<Pick<EvolutionGoConfigurationInput, 'label' | 'baseUrl' | 'instanceName'>> & EvolutionGoConfigurationInput;
const initialForm: Form = { label: 'WhatsApp Evolution GO', baseUrl: '', instanceName: '', globalApiKey: '', instanceToken: '', instanceId: '', timeoutMs: 12_000, retryAttempts: 0 };

function statusCopy(status: EvolutionGoChannelStatus | null) {
  if (!status?.configured) return { label: 'Não configurado', className: 'bg-background-100 text-foreground-600' };
  if (status.controls?.killSwitch || !status.account?.enabled) return { label: 'Protegido', className: 'bg-[#FFF1D8] text-[#965A12]' };
  if (status.integration?.connected && status.controls?.sendEnabled && status.controls?.inboundEnabled) return { label: 'Operacional', className: 'bg-[#E8F7EF] text-[#147445]' };
  return { label: 'Aguardando conexão', className: 'bg-[#EEF1F3] text-[#68757D]' };
}

function errorCopy(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const map: Record<string, string> = {
    permission_denied: 'Seu usuário não possui permissão para gerenciar o canal.',
    evolution_go_allowed_origins_not_configured: 'O domínio HTTPS do Evolution GO ainda não foi liberado no ambiente seguro.',
    evolution_go_credentials_required: 'Informe URL HTTPS, chave global, token e nome da instância.',
    evolution_go_instance_create_credentials_required: 'Para criar uma instância, informe URL HTTPS, chave global e nome.',
    evolution_go_connection_validation_required: 'Conecte a instância e confirme o status antes de ativar o uso operacional.',
    evolution_go_credentials_save_failed: 'Não foi possível armazenar as credenciais no cofre.',
  };
  return map[code] || 'Não foi possível concluir a operação. O estado operacional anterior foi preservado.';
}

function stamp(value: string | null | undefined) {
  if (!value) return 'Ainda não registrado';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Dedicated Evolution GO configuration. Credentials only travel to the Edge Function and are never read back. */
export default function EvolutionGoPanel() {
  const [status, setStatus] = useState<EvolutionGoChannelStatus | null>(null);
  const [form, setForm] = useState<Form>(initialForm);
  const [phone, setPhone] = useState('');
  const [qr, setQr] = useState<{ qrcode: string | null; code: string | null; expiresAt: string | null } | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setBusy('refresh'); setNotice(null);
    try { setStatus(await loadEvolutionGoStatus()); }
    catch (error) { setNotice({ tone: 'error', text: errorCopy(error) }); }
    finally { setBusy(null); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (key: string, task: () => Promise<EvolutionGoChannelStatus>, success: string) => {
    setBusy(key); setNotice(null);
    try { const next = await task(); setStatus(next); setNotice({ tone: 'success', text: success }); }
    catch (error) { setNotice({ tone: 'error', text: errorCopy(error) }); }
    finally { setBusy(null); }
  };
  const save = () => void run('save', () => saveEvolutionGoConfiguration(form), 'Configuração armazenada no cofre. O canal permanece protegido até a validação.');
  const create = () => {
    if (!window.confirm('Criar uma nova instância Evolution GO? O pedido será enviado uma única vez para evitar instâncias duplicadas.')) return;
    void run('create', () => createEvolutionGoInstance(form), 'Instância criada e vinculada com segurança. Conecte-a antes de ativar o canal.');
  };
  const action = (name: Parameters<typeof runEvolutionGoAction>[0], label: string) => void run(name, () => runEvolutionGoAction(name), label);
  const loadQr = async () => {
    setBusy('qr'); setNotice(null);
    try { const result = await requestEvolutionGoQr(); setQr(result.qr); setNotice({ tone: 'success', text: 'QR Code atualizado a partir do provedor.' }); }
    catch (error) { setNotice({ tone: 'error', text: errorCopy(error) }); }
    finally { setBusy(null); }
  };
  const pair = async () => {
    setBusy('pair'); setNotice(null);
    try { const result = await requestEvolutionGoPairingCode(phone); setPairingCode(result.pairingCode); setNotice({ tone: 'success', text: 'Código de pareamento solicitado ao provedor.' }); }
    catch (error) { setNotice({ tone: 'error', text: errorCopy(error) }); }
    finally { setBusy(null); }
  };
  const badge = statusCopy(status);
  const connected = status?.integration?.connected === true;
  const active = status?.account?.enabled === true && status?.controls?.killSwitch === false;
  const qrImage = qr?.qrcode && (qr.qrcode.startsWith('data:image/') || qr.qrcode.startsWith('https://')) ? qr.qrcode : null;

  return <section id="evolution-go-configuration" className="rounded-2xl border border-background-200 bg-white p-5 shadow-[0_10px_24px_rgba(29,29,31,0.035)]" aria-label="Configuração do Evolution GO">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8F7EF] text-xl text-[#168654]"><i className="ri-whatsapp-line" /></span><div><h4 className="font-semibold text-foreground-950">Evolution GO</h4><p className="mt-1 text-xs leading-5 text-foreground-500">Canal corporativo com instância, webhook assinado e fila idempotente.</p></div></div>
      <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
    </header>
    {notice && <p role="status" className={`mt-4 rounded-xl border px-3 py-2 text-xs ${notice.tone === 'success' ? 'border-[#B9E4CB] bg-[#EFFAF3] text-[#176B43]' : 'border-[#E8B8B1] bg-[#FFF4F2] text-[#8B3027]'}`}>{notice.text}</p>}
    <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3"><div className="rounded-xl bg-background-50 p-3"><p className="text-foreground-500">Conexão</p><p className="mt-1 font-semibold text-foreground-900">{connected ? `Conectada${status?.account?.phoneSuffix ? ` · final ${status.account.phoneSuffix}` : ''}` : status?.account?.connectionStatus || 'Não configurada'}</p></div><div className="rounded-xl bg-background-50 p-3"><p className="text-foreground-500">Instância</p><p className="mt-1 truncate font-semibold text-foreground-900">{status?.integration?.instanceName || 'Não informada'}</p></div><div className="rounded-xl bg-background-50 p-3"><p className="text-foreground-500">Última validação</p><p className="mt-1 font-semibold text-foreground-900">{stamp(status?.integration?.lastTestedAt)}</p></div></div>
    <details className="mt-4 rounded-xl border border-background-200 p-3.5"><summary className="cursor-pointer text-sm font-semibold text-foreground-800">Vincular instância existente ou criar uma nova</summary><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-foreground-700">Nome do canal<input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} className="mt-1.5 w-full rounded-lg border border-background-200 px-3 py-2 text-sm" /></label><label className="text-xs font-medium text-foreground-700">URL HTTPS do servidor<input inputMode="url" placeholder="https://evolution.suaempresa.com" value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} className="mt-1.5 w-full rounded-lg border border-background-200 px-3 py-2 text-sm" /></label><label className="text-xs font-medium text-foreground-700">Nome da instância<input value={form.instanceName} onChange={(event) => setForm({ ...form, instanceName: event.target.value })} className="mt-1.5 w-full rounded-lg border border-background-200 px-3 py-2 text-sm" /></label><label className="text-xs font-medium text-foreground-700">Chave global<input type="password" autoComplete="new-password" value={form.globalApiKey} onChange={(event) => setForm({ ...form, globalApiKey: event.target.value })} className="mt-1.5 w-full rounded-lg border border-background-200 px-3 py-2 text-sm" /></label><label className="text-xs font-medium text-foreground-700">Token da instância<input type="password" autoComplete="new-password" value={form.instanceToken} onChange={(event) => setForm({ ...form, instanceToken: event.target.value })} className="mt-1.5 w-full rounded-lg border border-background-200 px-3 py-2 text-sm" /></label><label className="text-xs font-medium text-foreground-700">ID da instância <span className="font-normal text-foreground-400">opcional</span><input value={form.instanceId} onChange={(event) => setForm({ ...form, instanceId: event.target.value })} className="mt-1.5 w-full rounded-lg border border-background-200 px-3 py-2 text-sm" /></label></div><p className="mt-3 text-[11px] leading-5 text-foreground-500">As chaves são enviadas somente ao cofre do servidor e nunca são retornadas à tela. A URL precisa ter HTTPS e estar liberada na lista operacional do ambiente.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy !== null} onClick={save} className="wf-btn-primary text-xs disabled:opacity-60"><i className="ri-save-line" />Salvar e vincular</button><button type="button" disabled={busy !== null} onClick={create} className="wf-btn-secondary text-xs disabled:opacity-60"><i className="ri-add-circle-line" />Criar instância</button></div></details>
    {status?.configured && <div className="mt-4 rounded-xl border border-background-200 p-3.5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h5 className="text-sm font-semibold text-foreground-900">Conexão e ativação</h5><p className="mt-1 text-xs text-foreground-500">O uso só é liberado após status conectado. Desconectar preserva credenciais e histórico.</p></div><button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => void refresh()}><i className={busy === 'refresh' ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} />Atualizar status</button></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => action('connect', 'Conexão iniciada; leia o QR Code ou use o pareamento.')}>Conectar</button><button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => void loadQr()}>Ver QR Code</button><button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null || !phone.trim()} onClick={() => void pair()}>Gerar código</button><input aria-label="Telefone para pareamento" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="5511999999999" className="w-40 rounded-lg border border-background-200 px-3 py-2 text-xs" /><button type="button" className="wf-btn-secondary text-xs" disabled={busy !== null} onClick={() => action('reconnect', 'Reconexão solicitada. Atualize o QR Code para continuar.')}>Reconectar</button>{!active ? <button type="button" className="wf-btn-primary text-xs" disabled={busy !== null || !connected} onClick={() => { if (window.confirm('Ativar Evolution GO como canal corporativo padrão? Os outros provedores corporativos serão desativados no WayFlex, sem apagar sessões nem histórico.')) action('activate', 'Evolution GO ativado como canal corporativo padrão.'); }}>Ativar uso</button> : <button type="button" className="wf-btn-secondary text-xs text-accent-700" disabled={busy !== null} onClick={() => { if (window.confirm('Desativar o uso operacional do Evolution GO? A sessão e as credenciais serão preservadas.')) action('deactivate', 'Uso operacional desativado; sessão e histórico preservados.'); }}>Desativar uso</button>}<button type="button" className="wf-btn-secondary text-xs text-accent-700" disabled={busy !== null} onClick={() => { if (window.confirm('Encerrar a sessão remota do Evolution GO? Esta ação exige novo pareamento.')) action('logout', 'Sessão Evolution GO encerrada.'); }}>Encerrar sessão</button></div>{(qr || pairingCode) && <div className="mt-4 grid gap-3 rounded-xl bg-background-50 p-3 sm:grid-cols-2">{qr && <div><p className="text-xs font-semibold text-foreground-800">QR Code atual</p>{qrImage ? <img src={qrImage} alt="QR Code de pareamento da instância Evolution GO" className="mt-2 h-40 w-40 rounded-lg bg-white object-contain p-2" /> : <p className="mt-2 break-all text-[11px] text-foreground-600">{qr.code || 'O provedor não retornou uma imagem QR legível. Use o código ou atualize o QR.'}</p>}<p className="mt-2 text-[11px] text-foreground-500">Expira: {stamp(qr.expiresAt)}</p></div>}{pairingCode && <div><p className="text-xs font-semibold text-foreground-800">Código de pareamento</p><code className="mt-2 block rounded-lg bg-white p-3 text-base font-bold tracking-widest text-foreground-950">{pairingCode}</code><p className="mt-2 text-[11px] text-foreground-500">Use no WhatsApp antes de atualizar o status.</p></div>}</div>}</div>}
    <p className="mt-4 text-[11px] leading-5 text-foreground-500">Webhook: aceitação rápida, assinatura por integração e processamento assíncrono. Eventos desconhecidos, grupos e mídia sem metadados suficientes são registrados para revisão, nunca associados silenciosamente a um lead.</p>
  </section>;
}
