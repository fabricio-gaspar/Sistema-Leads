import { useState } from 'react';
import { canaisComunicacao, eventosWebhook } from '@/mocks/canaisData';

const statusCores: Record<string, string> = {
  CONECTADO: 'bg-primary-100 text-primary-700',
  DESCONECTADO: 'bg-accent-100 text-accent-700',
  PENDENTE: 'bg-secondary-100 text-secondary-700',
};

const credenciaisIniciais = {
  numero: '+55 11 99999-8888',
  phoneNumberId: '',
  wabaId: '',
  token: '',
  webhookUrl: 'https://sua-empresa.com.br/api/webhooks/whatsapp/inbound',
  webhookSecret: '',
  instanciaId: '',
  clientToken: '',
};

type Credenciais = typeof credenciaisIniciais;

export default function CanaisTab() {
  const [canais, setCanais] = useState(canaisComunicacao);
  const [toast, setToast] = useState('');
  const [testando, setTestando] = useState<string | null>(null);
  const [mostrarToken, setMostrarToken] = useState(false);
  const [credenciais, setCredenciais] = useState<Credenciais>(credenciaisIniciais);
  const [provedor, setProvedor] = useState<'zapi' | 'meta'>('zapi');

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const testarCanal = (id: string) => {
    setTestando(id);
    setTimeout(() => {
      setTestando(null);
      mostrarToast('Teste simulado OK — sem conexão real (aguardando backend).');
    }, 1200);
  };

  const toggleAna = (id: string) => {
    setCanais(canais.map((c) => (c.id === id ? { ...c, permiteAna: !c.permiteAna } : c)));
  };

  const salvarCredenciais = () => {
    mostrarToast('Por segurança, o token não fica no navegador — configure o canal na aba Ambiente (segredo no backend).');
  };

  const atualizar = (campo: keyof Credenciais, valor: string) => {
    setCredenciais((prev) => ({ ...prev, [campo]: valor }));
  };

  const campo = (
    label: string,
    campoKey: keyof Credenciais,
    placeholder: string,
    tipo: 'text' | 'password' = 'text',
    extra?: React.ReactNode,
  ) => (
    <div>
      <label className="block text-xs font-medium text-foreground-600 mb-1">{label}</label>
      <div className="relative">
        <input
          type={campoKey === 'token' && !mostrarToken ? 'password' : 'text'}
          value={credenciais[campoKey]}
          onChange={(e) => atualizar(campoKey, e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full px-3 py-2 pr-10 bg-background-100 border border-background-200 rounded-md text-sm text-foreground-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        {tipo === 'password' && (
          <button
            onClick={() => setMostrarToken((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-foreground-400 hover:text-foreground-600 cursor-pointer"
            aria-label={mostrarToken ? 'Ocultar token' : 'Mostrar token'}
          >
            <i className={mostrarToken ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
          </button>
        )}
      </div>
      {extra}
    </div>
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      <div className="bg-secondary-50 border border-secondary-200 text-secondary-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
        <i className="ri-flask-line mt-0.5"></i>
        <span>
          <strong>Modo demonstração.</strong> Os canais abaixo são simulados. Para envio real (WhatsApp/e-mail), é preciso
          conectar o backend e as integrações.
        </span>
      </div>

      {/* Credenciais de WhatsApp */}
      <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <i className="ri-whatsapp-line text-primary-600 text-lg"></i>
          </div>
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Credenciais WhatsApp</h3>
            <p className="text-xs text-foreground-500">
              Escolha o provedor e preencha os dados. O token é guardado no cofre de segredos do backend, nunca no navegador.
            </p>
          </div>
        </div>

        {/* Seletor de provedor */}
        <div className="flex flex-wrap gap-1 p-1 bg-background-100 rounded-full w-fit mt-4">
          <button
            onClick={() => setProvedor('zapi')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
              provedor === 'zapi' ? 'bg-foreground-900 text-background-50' : 'text-foreground-500 hover:text-foreground-800'
            }`}
          >
            Z-API
          </button>
          <button
            onClick={() => setProvedor('meta')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
              provedor === 'meta' ? 'bg-foreground-900 text-background-50' : 'text-foreground-500 hover:text-foreground-800'
            }`}
          >
            Meta (Cloud API)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {provedor === 'zapi' ? (
            <>
              {campo('Número de origem (com DDI) *', 'numero', '+55 11 99999-9999')}
              {campo(
                'ID da Instância *',
                'instanciaId',
                'ex.: 3C8D2F1A...',
                'text',
                <p className="text-[11px] text-foreground-400 mt-1">Identificador da sua instância no painel Z-API.</p>,
              )}
              {campo(
                'Token da Instância *',
                'token',
                'Cole o token secreto',
                'password',
                <p className="text-[11px] text-foreground-400 mt-1">Token que entra na URL de integração da Z-API.</p>,
              )}
              {campo(
                'Client Token',
                'clientToken',
                'Chave do header Client-Token',
                'password',
                <p className="text-[11px] text-foreground-400 mt-1">Configurada em Segurança no painel da Z-API.</p>,
              )}
            </>
          ) : (
            <>
              {campo('Número de origem (com DDI) *', 'numero', '+55 11 99999-9999')}
              {campo(
                'Phone Number ID *',
                'phoneNumberId',
                'Ex.: 123456789012345',
                'text',
                <p className="text-[11px] text-foreground-400 mt-1">ID numérico do número no Meta Business.</p>,
              )}
              {campo('WABA ID (conta WhatsApp Business)', 'wabaId', 'Ex.: 123456789012345')}
              {campo(
                'Token de acesso (access token)',
                'token',
                'EAAG...',
                'password',
                <p className="text-[11px] text-foreground-400 mt-1">
                  Guarde com segurança. Nunca exibido por completo nem enviado ao frontend final.
                </p>,
              )}
            </>
          )}
          {campo('Webhook URL (inbound)', 'webhookUrl', 'https://sua-empresa.com.br/api/webhooks/whatsapp/inbound')}
          {campo(
            'Webhook Secret / Verify Token',
            'webhookSecret',
            'whs_...',
            'password',
            <p className="text-[11px] text-foreground-400 mt-1">Usado para validar a assinatura dos eventos recebidos.</p>,
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <button
            onClick={salvarCredenciais}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
          >
            <i className="ri-save-line"></i> Salvar credenciais
          </button>
          <button
            onClick={() => mostrarToast('Conectar de verdade fica disponível após configurar o backend.')}
            className="px-4 py-2 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
          >
            <i className="ri-link"></i> Conectar canal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {canais.map((c) => (
          <div key={c.id} className="bg-background-50 border border-background-200/70 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <i className={`${c.tipo === 'WhatsApp' ? 'ri-whatsapp-line' : 'ri-mail-line'} text-primary-600 text-lg`}></i>
              </div>
              <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${statusCores[c.status]}`}>
                {c.status}
              </span>
            </div>
            <h4 className="font-heading font-bold text-foreground-900 mb-1">{c.nome}</h4>
            <p className="text-xs text-foreground-500 mb-3">{c.remetente}</p>
            <div className="space-y-1 text-xs text-foreground-400 mb-4">
              <p>Horário permitido: {c.horarioPermitido}</p>
              <p>Limite diário: {c.limiteDiario.toLocaleString()} msgs</p>
              <p>Templates aprovados: {c.templatesAprovados}</p>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-foreground-600">Permitir Ana</span>
              <button
                onClick={() => toggleAna(c.id)}
                className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${c.permiteAna ? 'bg-primary-500' : 'bg-background-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${c.permiteAna ? 'translate-x-5' : ''}`}></span>
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => testarCanal(c.id)}
                disabled={testando === c.id}
                className="flex-1 px-3 py-2 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {testando === c.id ? (
                  <span className="inline-flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-foreground-300 border-t-foreground-700 rounded-full animate-spin"></div>
                    Testando...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <i className="ri-refresh-line"></i> Testar
                  </span>
                )}
              </button>
              <button
                onClick={() => mostrarToast('Conexão real disponível após conectar o backend.')}
                className="flex-1 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                Configurar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Eventos webhook */}
      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70">
          <h3 className="font-heading font-bold text-foreground-900 text-sm">Eventos recentes</h3>
          <p className="text-xs text-foreground-500">Logs de webhook dos últimos eventos.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Canal</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Evento</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Status</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Hora</th>
              </tr>
            </thead>
            <tbody>
              {eventosWebhook.map((e) => (
                <tr key={e.id} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5 text-foreground-700">{e.canal}</td>
                  <td className="px-6 py-3.5 text-foreground-700 font-medium">{e.evento}</td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${e.status === 'sucesso' ? 'bg-primary-100 text-primary-700' : 'bg-accent-100 text-accent-700'}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-500 text-xs">{e.hora}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
