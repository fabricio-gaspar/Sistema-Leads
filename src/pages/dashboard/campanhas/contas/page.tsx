import { useState } from 'react';
import { useSocialStore } from '@/hooks/useSocialStore';
import type { SocialAccount, SocialNetwork } from '@/mocks/socialData';
import { networkMeta, statusContaMeta } from '@/pages/dashboard/campanhas/socialMeta';

const requisitos: { network: SocialNetwork; app: string; callback: string; validade: string; limite: string; revisao: string }[] = [
  {
    network: 'LINKEDIN',
    app: 'LinkedIn Developer Portal (App ID + Client Secret)',
    callback: 'https://{seu-dominio}/api/social/accounts/linkedin/callback',
    validade: 'Access token de 60 dias (renovável)',
    limite: 'Limites por membro/página conforme tier',
    revisao: 'Exige revisão do app para publicar em Company Page',
  },
  {
    network: 'INSTAGRAM',
    app: 'Meta for Developers (App ID + Client Secret)',
    callback: 'https://{seu-dominio}/api/social/accounts/instagram/callback',
    validade: 'User token 60 dias; tokens de página 60 dias',
    limite: 'Limite de API por conta/página',
    revisao: 'Exige revisão para publicar (instagram_content_publish)',
  },
  {
    network: 'FACEBOOK',
    app: 'Meta for Developers (App ID + Client Secret)',
    callback: 'https://{seu-dominio}/api/social/accounts/facebook/callback',
    validade: 'Page Access Token (long-lived)',
    limite: 'Limite de API por página',
    revisao: 'pages_manage_posts requer revisão do app',
  },
];

export default function ContasConectadas() {
  const { contas, atualizarConta } = useSocialStore();
  const [toast, setToast] = useState('');

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const conectar = (c: SocialAccount) => {
    atualizarConta(c.id, { status: 'AWAITING_AUTH', connectedBy: 'Você' });
    mostrarToast('Fluxo OAuth real será habilitado após conectar o backend. Marcado como "aguardando autorização".');
  };

  const testar = (c: SocialAccount) => {
    mostrarToast(`Teste simulado de ${networkMeta[c.network].label} — sem conexão real (aguardando backend).`);
  };

  const reautorizar = (c: SocialAccount) => {
    atualizarConta(c.id, { status: 'AWAITING_AUTH' });
    mostrarToast('Reautorização solicitada (simulada).');
  };

  const desconectar = (c: SocialAccount) => {
    atualizarConta(c.id, { status: 'DISCONNECTED', connectedBy: '', lastSyncAt: null, tokenExpiresAt: null });
    mostrarToast(`${c.accountName} desconectada. Tokens seriam revogados com segurança.`);
  };

  const sincronizar = () => {
    mostrarToast('Sincronização simulada — contas reais serão listadas após conectar o backend.');
  };

  return (
    <div className="wf-page">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-2">
          Contas Conectadas
        </h1>
        <p className="text-foreground-600 text-sm">
          Conecte e gerencie as redes sociais usadas nas campanhas de conteúdo.
        </p>
      </div>

      {toast && (
        <div className="mb-4 bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      <div className="mb-6 bg-secondary-50 border border-secondary-200 text-secondary-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
        <i className="ri-flask-line mt-0.5"></i>
        <span>
          <strong>Modo demonstração.</strong> As conexões abaixo são simuladas. O OAuth 2.0 real (troca de token,
          armazenamento criptografado e publicação) depende de conectar o backend e registrar os apps nos portais de
          desenvolvedor.
        </span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-foreground-600">Selecione exatamente quais contas serão usadas nas campanhas.</p>
        <button
          onClick={sincronizar}
          className="inline-flex items-center gap-2 px-4 py-2 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
        >
          <i className="ri-refresh-line"></i> Sincronizar contas
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {contas.map((c) => {
          const meta = networkMeta[c.network];
          const st = statusContaMeta[c.status];
          return (
            <div key={c.id} className="bg-background-50 border border-background-200/70 rounded-xl p-5 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${meta.cor}`}>
                    <i className={`${meta.icone} text-xl`}></i>
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-foreground-900">{meta.label}</h3>
                    <p className="text-xs text-foreground-500">{c.accountType}</p>
                  </div>
                </div>
                <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${st.cor}`}>{st.label}</span>
              </div>

              <div className="mb-4">
                <p className="text-sm font-semibold text-foreground-900">{c.accountName}</p>
                {c.externalAccountId && <p className="text-xs text-foreground-400 font-mono">{c.externalAccountId}</p>}
              </div>

              <div className="space-y-2 text-xs text-foreground-600 mb-4">
                <div className="flex justify-between">
                  <span className="text-foreground-400">Responsável</span>
                  <span>{c.connectedBy || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-400">Última sincronização</span>
                  <span>{c.lastSyncAt || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-400">Expiração do token</span>
                  <span>{c.tokenExpiresAt || '—'}</span>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-wide text-foreground-400 font-semibold mb-1.5">
                  Permissões solicitadas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {c.scopes.map((s) => (
                    <span key={s} className="px-2 py-0.5 bg-background-100 text-foreground-500 rounded text-[10px] font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-auto flex flex-wrap gap-2">
                <button
                  onClick={() => conectar(c)}
                  className="flex-1 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Conectar
                </button>
                <button
                  onClick={() => testar(c)}
                  className="flex-1 px-3 py-2 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Testar
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => reautorizar(c)}
                  className="flex-1 px-3 py-2 bg-secondary-100 hover:bg-secondary-200 text-secondary-800 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Reautorizar
                </button>
                <button
                  onClick={() => desconectar(c)}
                  className="flex-1 px-3 py-2 border border-background-300 text-foreground-600 hover:bg-background-100 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Desconectar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <h2 className="font-heading font-bold text-foreground-900 text-lg mb-1">Requisitos de conexão por rede</h2>
        <p className="text-foreground-500 text-sm mb-4">
          Documentação de referência — será usada quando você conectar o backend. Nada aqui é armazenado em texto aberto.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {requisitos.map((r) => (
            <div key={r.network} className="bg-background-50 border border-background-200/70 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <i className={`${networkMeta[r.network].icone} text-primary-600 text-lg`}></i>
                <h3 className="font-heading font-bold text-foreground-900 text-sm">{networkMeta[r.network].label}</h3>
              </div>
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-foreground-400 font-medium">App / credenciais</dt>
                  <dd className="text-foreground-700">{r.app}</dd>
                </div>
                <div>
                  <dt className="text-foreground-400 font-medium">URL de callback</dt>
                  <dd className="text-foreground-700 font-mono break-all">{r.callback}</dd>
                </div>
                <div>
                  <dt className="text-foreground-400 font-medium">Validade do token</dt>
                  <dd className="text-foreground-700">{r.validade}</dd>
                </div>
                <div>
                  <dt className="text-foreground-400 font-medium">Limites de API</dt>
                  <dd className="text-foreground-700">{r.limite}</dd>
                </div>
                <div>
                  <dt className="text-foreground-400 font-medium">Revisão</dt>
                  <dd className="text-foreground-700">{r.revisao}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
