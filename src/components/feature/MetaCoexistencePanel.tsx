import { useEffect, useMemo, useState } from 'react';
import type { TeamMember } from '@/lib/crm/teamMembersRepository';
import {
  bootstrapMetaSignup,
  completeMetaSignup,
  metaCoexistenceFeatureEnabled,
  type WhatsappAccount,
} from '@/lib/crm/whatsappAccountsRepository';

interface FacebookLoginResponse {
  authResponse?: { code?: string };
  status?: string;
}

interface FacebookSdk {
  init(options: { appId: string; cookie: boolean; xfbml: boolean; version: string }): void;
  login(callback: (response: FacebookLoginResponse) => void, options: Record<string, unknown>): void;
}

declare global {
  interface Window { FB?: FacebookSdk; }
}

interface SignupResult { businessAccountId: string; phoneNumberId: string; }

function loadFacebookSdk(): Promise<FacebookSdk> {
  if (window.FB) return Promise.resolve(window.FB);
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('facebook-jssdk');
    const finish = () => window.FB ? resolve(window.FB) : reject(new Error('meta_sdk_unavailable'));
    if (existing) {
      existing.addEventListener('load', finish, { once: true });
      window.setTimeout(finish, 3_000);
      return;
    }
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => reject(new Error('meta_sdk_load_failed')), { once: true });
    document.head.appendChild(script);
  });
}

function waitForSignupResult(): { promise: Promise<SignupResult>; cancel: () => void } {
  let handler: ((event: MessageEvent) => void) | null = null;
  let timeout = 0;
  const promise = new Promise<SignupResult>((resolve, reject) => {
    handler = (event: MessageEvent) => {
      if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(event.origin)) return;
      let payload: unknown = event.data;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
      const message = payload as Record<string, unknown>;
      if (message.type !== 'WA_EMBEDDED_SIGNUP' || message.event !== 'FINISH') return;
      const data = message.data && typeof message.data === 'object' && !Array.isArray(message.data)
        ? message.data as Record<string, unknown> : {};
      const businessAccountId = typeof data.waba_id === 'string' ? data.waba_id : '';
      const phoneNumberId = typeof data.phone_number_id === 'string' ? data.phone_number_id : '';
      if (businessAccountId && phoneNumberId) resolve({ businessAccountId, phoneNumberId });
    };
    window.addEventListener('message', handler);
    timeout = window.setTimeout(() => reject(new Error('meta_signup_timeout')), 120_000);
  });
  return {
    promise,
    cancel: () => {
      if (handler) window.removeEventListener('message', handler);
      window.clearTimeout(timeout);
    },
  };
}

function errorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  const copy: Record<string, string> = {
    meta_signup_cancelled: 'A conexão com a Meta foi cancelada sem alterar o canal atual.',
    meta_signup_timeout: 'A Meta não concluiu o cadastro dentro do prazo. Nenhuma conta foi ativada.',
    meta_sdk_load_failed: 'Não foi possível carregar o cadastro oficial da Meta.',
    meta_coexistence_feature_disabled: 'A integração Meta continua desligada até o gate de homologação.',
    meta_phone_already_connected: 'Este número já está conectado a uma conta Meta.',
    meta_owner_or_phone_already_connected: 'O usuário ou o número já possui uma conta operacional.',
  };
  return copy[code] ?? 'A conexão Meta não foi concluída. O canal Z-API atual foi preservado.';
}

export default function MetaCoexistencePanel({
  member,
  accounts,
  canManage,
  onConnected,
}: {
  member?: TeamMember;
  accounts: WhatsappAccount[];
  canManage: boolean;
  onConnected: () => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const metaAccounts = useMemo(() => accounts.filter((account) => account.provider === 'meta_cloud'
    && (!member || account.ownerUserId === member.userId)), [accounts, member]);

  useEffect(() => {
    let active = true;
    void metaCoexistenceFeatureEnabled().then((value) => { if (active) setEnabled(value); })
      .catch(() => { if (active) setEnabled(false); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  const connect = async () => {
    setBusy(true); setError(''); setNotice('');
    const resultWait = waitForSignupResult();
    try {
      const bootstrap = await bootstrapMetaSignup(member?.userId);
      const sdk = await loadFacebookSdk();
      sdk.init({ appId: bootstrap.appId, cookie: true, xfbml: false, version: bootstrap.graphApiVersion });
      const login = new Promise<string>((resolve, reject) => {
        sdk.login((response) => {
          const code = response.authResponse?.code;
          if (code) resolve(code);
          else reject(new Error('meta_signup_cancelled'));
        }, {
          config_id: bootstrap.configurationId,
          response_type: 'code',
          override_default_response_type: true,
          state: bootstrap.state,
          extras: { setup: {}, sessionInfoVersion: '3' },
        });
      });
      const [code, signup] = await Promise.all([login, resultWait.promise]);
      await completeMetaSignup({
        sessionId: bootstrap.sessionId,
        state: bootstrap.state,
        code,
        businessAccountId: signup.businessAccountId,
        phoneNumberId: signup.phoneNumberId,
        label: member ? `WhatsApp Meta — ${member.name}` : 'WhatsApp Meta corporativo',
      });
      setNotice('Conta Meta conectada. Entrada, saída e Ana continuam bloqueadas até a homologação deste número.');
      await onConnected();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      resultWait.cancel();
      setBusy(false);
    }
  };

  if (checking || !enabled) return null;
  return <section className="rounded-2xl border border-background-200 bg-white p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8eeff] text-xl text-[#0866ff]"><i className="ri-meta-line" /></span>
        <div><h3 className="font-semibold text-foreground-950">Meta WhatsApp Cloud API · Coexistence</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-foreground-600">Conexão oficial pela Meta. O WhatsApp Business permanece no celular; nenhum QR Code alternativo ou sessão Web é criado.</p></div>
      </div>
      {canManage && metaAccounts.length === 0 && <button type="button" disabled={busy} onClick={() => void connect()} className="wf-btn-primary whitespace-nowrap disabled:opacity-60"><i className="ri-meta-line" />{busy ? 'Conectando…' : 'Conectar com a Meta'}</button>}
    </div>
    {error && <p role="alert" className="mt-3 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-800">{error}</p>}
    {notice && <p role="status" className="mt-3 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-800">{notice}</p>}
    {metaAccounts.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{metaAccounts.map((account) => <div key={account.id} className="rounded-xl border border-background-200 bg-background-50 p-3 text-xs"><div className="flex items-center justify-between gap-2"><strong className="truncate text-foreground-900">{account.verifiedName || account.label}</strong><span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-800">Gate de homologação</span></div><dl className="mt-3 grid grid-cols-2 gap-2 text-foreground-600"><div><dt className="text-foreground-400">Conexão</dt><dd className="mt-0.5 font-semibold">{account.connected ? 'Conectada' : 'Pendente'}</dd></div><div><dt className="text-foreground-400">Sincronização</dt><dd className="mt-0.5 font-semibold">{account.syncStatus}</dd></div><div><dt className="text-foreground-400">Modo da Ana</dt><dd className="mt-0.5 font-semibold">{account.messagingMode}</dd></div><div><dt className="text-foreground-400">Qualidade</dt><dd className="mt-0.5 font-semibold">{account.qualityRating || 'Não informada'}</dd></div></dl></div>)}</div>}
  </section>;
}
