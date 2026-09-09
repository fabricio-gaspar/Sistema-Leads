import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadOperationalStatus, setOperationalMode, type OperationalCheck, type OperationalStatus } from '@/lib/crm/operationalDiagnosticsRepository';

const routesByCheck: Record<string, string> = {
  empresa: '/dashboard/configuracoes?tab=empresa',
  ia_empresa: '/dashboard/configuracoes?tab=ana',
  kill_switch: '/dashboard/configuracoes?tab=operacao',
  ia: '/dashboard/configuracoes?tab=conexoes',
  whatsapp: '/dashboard/configuracoes?tab=conexoes',
  whatsapp_webhook: '/dashboard/configuracoes?tab=conexoes',
  scheduler: '/dashboard/registro-sistema',
};

function MissingCheck({ check }: { check: OperationalCheck }) {
  const destination = routesByCheck[check.id] || '/dashboard/configuracoes?tab=operacao';
  return <Link to={destination} className="group flex items-start gap-3 rounded-xl border border-[#FF9500]/25 bg-[#FF9500]/[0.07] px-3 py-2.5 transition hover:bg-[#FF9500]/[0.12]">
    <i className="ri-error-warning-line mt-0.5 text-[#D97706]" aria-hidden="true" />
    <span className="min-w-0 flex-1"><strong className="block text-xs text-[#1D1D1F]">{check.label}</strong><span className="mt-0.5 block text-xs leading-relaxed text-[#6E6E73]">{check.detail}</span></span>
    <i className="ri-arrow-right-line mt-0.5 text-[#D97706] transition group-hover:translate-x-0.5" aria-hidden="true" />
  </Link>;
}

export default function OperationalModeControl() {
  const [status, setStatus] = useState<OperationalStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const next = await loadOperationalStatus();
      setStatus(next);
      setError('');
    } catch { setError('Não foi possível consultar o ambiente operacional agora.'); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const changeMode = async (mode: 'demo' | 'real') => {
    if (!status || busy || mode === status.mode) return;
    if (mode === 'real' && !status.productionReady) {
      setError('O Ambiente Real ainda não pode ser ativado. Conclua os itens abaixo.');
      return;
    }
    const confirmation = mode === 'real'
      ? 'Ativar o Ambiente Real? Apenas ações aprovadas por todas as regras do servidor poderão produzir efeitos externos.'
      : 'Voltar ao Ambiente de Demonstração? Novas saídas reais serão bloqueadas imediatamente.';
    if (!window.confirm(confirmation)) return;
    setBusy(true);
    try {
      const next = await setOperationalMode(mode);
      setStatus(next);
      setError('');
    } catch {
      setError(mode === 'real' ? 'O servidor recusou a ativação. Atualize os itens pendentes e tente novamente.' : 'O ambiente não foi alterado; o estado anterior foi preservado.');
    } finally { setBusy(false); }
  };

  if (!status) return <section className="wf-surface p-5"><p className="text-sm text-foreground-500">{error || 'Consultando o ambiente operacional…'}</p></section>;
  const missing = status.checks.filter((check) => !check.ok);
  const isReal = status.mode === 'real';

  return <section className="wf-surface overflow-hidden">
    <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between md:p-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Ambiente operacional</p>
        <h2 className="mt-1 font-heading text-xl font-bold tracking-tight text-foreground-950">{isReal ? 'Ambiente Real ativo' : 'Ambiente de Demonstração ativo'}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-foreground-500">{isReal ? 'O backend autorizou operações reais após a pré-verificação. As políticas de segurança continuam obrigatórias.' : 'Testes ficam isolados: o backend bloqueia novos envios e automações externas.'}</p>
      </div>
      <div className="inline-flex shrink-0 rounded-xl border border-[#E5E5EA] bg-[#F2F2F7] p-1" role="group" aria-label="Selecionar ambiente operacional">
        <button type="button" onClick={() => void changeMode('demo')} disabled={busy || !isReal} className={`rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed ${!isReal ? 'bg-white text-[#1D1D1F] shadow-xs' : 'text-[#6E6E73] hover:text-[#1D1D1F]'}`}>Demonstração</button>
        <button type="button" onClick={() => void changeMode('real')} disabled={busy || isReal} className={`rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed ${isReal ? 'bg-[#0071E3] text-white shadow-xs' : 'text-[#6E6E73] hover:text-[#1D1D1F]'}`}>Ambiente Real</button>
      </div>
    </div>
    {error && <div className="mx-5 mb-5 rounded-xl border border-[#FF9500]/25 bg-[#FF9500]/10 px-3.5 py-3 text-sm text-[#9A5A00] md:mx-6">{error}</div>}
    {!isReal && <div className="border-t border-background-200/70 bg-[#F8F9FA] px-5 py-4 md:px-6">
      <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-foreground-950">Antes de ativar o Ambiente Real</h3><p className="mt-0.5 text-xs text-foreground-500">{missing.length === 0 ? 'A pré-verificação está pronta para ativação.' : `Conclua ${missing.length} configuração${missing.length === 1 ? '' : 'ões'} abaixo.`}</p></div><Link to="/dashboard/configuracoes?tab=operacao" className="text-xs font-semibold text-primary-700">Ver status</Link></div>
      {missing.length > 0 && <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">{missing.map((check) => <MissingCheck key={check.id} check={check} />)}</div>}
      {missing.length === 0 && <p className="mt-3 rounded-xl border border-[#34C759]/25 bg-[#34C759]/10 px-3 py-2.5 text-sm text-[#237A3B]">A pré-verificação foi aprovada pelo backend. Você já pode ativar o Ambiente Real.</p>}
    </div>}
  </section>;
}
