import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { activateRealEnvironment, loadOperationalStatus, type OperationalCheck, type OperationalStatus } from '@/lib/crm/operationalDiagnosticsRepository';

const routesByCheck: Record<string, string> = {
  empresa: '/dashboard/configuracoes?tab=empresa',
  ia_empresa: '/dashboard/configuracoes?tab=ana',
  kill_switch: '/dashboard/configuracoes?tab=operacao',
  ia: '/dashboard/configuracoes?tab=conexoes',
  whatsapp: '/dashboard/configuracoes?tab=conexoes',
  whatsapp_webhook: '/dashboard/configuracoes?tab=operacao&setup=whatsapp-webhook',
  scheduler: '/dashboard/configuracoes?tab=operacao&setup=worker',
};

function MissingCheck({ check }: { check: OperationalCheck }) {
  const destination = routesByCheck[check.id] || '/dashboard/configuracoes?tab=operacao';
  return <Link to={destination} className="group flex items-start gap-3 rounded-xl border border-[#BC8B42]/25 bg-[#BC8B42]/[0.07] px-3 py-2.5 transition hover:bg-[#BC8B42]/[0.12]">
    <i className="ri-error-warning-line mt-0.5 text-[#D97706]" aria-hidden="true" />
    <span className="min-w-0 flex-1"><strong className="block text-xs text-[#14151A]">{check.label}</strong><span className="mt-0.5 block text-xs leading-relaxed text-[#69717D]">{check.detail}</span></span>
    <i className="ri-arrow-right-line mt-0.5 text-[#D97706] transition group-hover:translate-x-0.5" aria-hidden="true" />
  </Link>;
}

export default function OperationalModeControl() {
  const [status, setStatus] = useState<OperationalStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      setStatus(await loadOperationalStatus());
      setError('');
    } catch { setError('Não foi possível consultar o Ambiente Real agora.'); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const prepare = async () => {
    if (!status || busy) return;
    if (!window.confirm('Verificar e preparar o Ambiente Real? O servidor só libera operações depois das confirmações obrigatórias.')) return;
    setBusy(true);
    try {
      const result = await activateRealEnvironment();
      setStatus(result.status);
      setNotice(result.message);
      setError('');
    } catch {
      setError('Não foi possível concluir a preparação. As proteções do servidor foram preservadas.');
      setNotice('');
    } finally { setBusy(false); }
  };

  if (!status) return <section className="wf-surface p-5"><p className="text-sm text-foreground-500">{error || 'Consultando o Ambiente Real…'}</p></section>;
  const missing = status.checks.filter((check) => !check.ok && check.id !== 'kill_switch');
  const isReal = status.mode === 'real';
  const automationReady = status.productionReady;

  return <section className="wf-surface overflow-hidden">
    <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between md:p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Ambiente operacional</p>
        <h2 className="mt-1 font-heading text-xl font-bold tracking-tight text-foreground-950">{isReal ? automationReady ? 'Ambiente Real ativo' : 'Ambiente Real ativo · automação em preparação' : 'Ambiente Real em preparação'}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground-500">{isReal ? automationReady ? 'O backend confirmou a operação real. As políticas de segurança, opt-out e pausa global continuam obrigatórias.' : 'O WhatsApp já pode ser usado pela Central de Atendimento. A Ana automática continua bloqueada até as verificações abaixo serem concluídas.' : 'Conclua somente as verificações necessárias. Até lá, o backend mantém saídas automáticas bloqueadas.'}</p>
      </div>
      <div className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${automationReady ? 'border-[#168654]/25 bg-[#168654]/10 text-[#116B43]' : 'border-[#BC8B42]/25 bg-[#BC8B42]/10 text-[#8C651D]'}`}>
        <span className={`h-2 w-2 rounded-full ${automationReady ? 'bg-[#168654]' : 'bg-[#BC8B42]'}`} />
        {automationReady ? 'AUTOMAÇÃO PRONTA' : isReal ? 'COMUNICAÇÃO ATIVA' : 'CONFIGURAÇÃO PENDENTE'}
      </div>
    </div>
    {error && <div className="mx-5 mb-5 rounded-xl border border-[#BC8B42]/25 bg-[#BC8B42]/10 px-3.5 py-3 text-sm text-[#8C651D] md:mx-6">{error}</div>}
    {notice && <div className="mx-5 mb-5 rounded-xl border border-[#168654]/25 bg-[#168654]/10 px-3.5 py-3 text-sm text-[#116B43] md:mx-6">{notice}</div>}
    {!automationReady && <div className="border-t border-background-200/70 bg-[#F7F8FA] px-5 py-4 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-foreground-950">Preparação assistida</h3><p className="mt-0.5 text-xs text-foreground-500">O sistema conclui automaticamente as etapas internas que já podem ser verificadas.</p></div><button type="button" onClick={() => void prepare()} disabled={busy} className="wf-btn-primary text-xs disabled:opacity-60"><i className="ri-shield-check-line" />{busy ? 'Verificando…' : 'Verificar preparação'}</button></div>
      {missing.length > 0 && <div className="mt-3"><p className="mb-2 text-[11px] font-semibold uppercase tracking-[.1em] text-[#777E89]">Próxima ação</p><MissingCheck check={missing[0]} />{missing.length > 1 && <p className="mt-2 text-xs text-foreground-500">As demais etapas aparecerão quando esta for concluída.</p>}</div>}
      {missing.length === 0 && <p className="mt-3 rounded-xl border border-[#168654]/25 bg-[#168654]/10 px-3 py-2.5 text-sm text-[#116B43]">Tudo pronto. Clique em “Verificar preparação” para registrar a ativação no backend.</p>}
    </div>}
  </section>;
}
