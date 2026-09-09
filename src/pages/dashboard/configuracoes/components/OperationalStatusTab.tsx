import { useCallback, useEffect, useState } from 'react';
import { loadOperationalStatus, setOperationalKillSwitch, setOperationalMode, type OperationalStatus } from '@/lib/crm/operationalDiagnosticsRepository';

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString('pt-BR') : 'Ainda não registrado';
}

export default function OperationalStatusTab() {
  const [status, setStatus] = useState<OperationalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setStatus(await loadOperationalStatus()); setError(''); }
    catch { setError('Não foi possível consultar o estado operacional. Atualize e tente novamente.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const changeKillSwitch = async () => {
    if (!status || changing) return;
    const next = !status.killSwitch;
    const message = next
      ? 'Pausar toda automação da Ana agora? Nenhuma nova ação automática será liberada enquanto a pausa estiver ligada.'
      : 'Liberar a automação? Os demais requisitos de segurança ainda serão verificados pelo servidor.';
    if (!window.confirm(message)) return;
    setChanging(true);
    try { setStatus(await setOperationalKillSwitch(next)); setError(''); }
    catch { setError('A pausa global não foi atualizada. O estado anterior foi preservado.'); }
    finally { setChanging(false); }
  };

  const changeMode = async () => {
    if (!status || changing) return;
    const next = status.mode === 'real' ? 'protected' : 'real';
    if (next === 'real' && !status.productionReady) {
      setError('O modo real permanece bloqueado. Resolva todos os itens da pré-verificação antes de tentar novamente.');
      return;
    }
    const message = next === 'real'
      ? 'Ativar o modo real? Depois desta confirmação, ações que passarem por todas as políticas do servidor poderão produzir efeitos reais.'
      : 'Voltar ao modo protegido e bloquear toda saída real?';
    if (!window.confirm(message)) return;
    setChanging(true);
    try { setStatus(await setOperationalMode(next)); setError(''); }
    catch { setError(next === 'real' ? 'O servidor recusou o modo real porque a pré-verificação não está completa.' : 'Não foi possível ativar o modo protegido. O estado anterior foi preservado.'); }
    finally { setChanging(false); }
  };

  if (loading) return <div className="wf-surface p-6 text-sm text-foreground-500">Consultando o estado operacional…</div>;
  if (!status) return <div className="wf-surface p-6 text-sm text-accent-700">{error || 'Estado operacional indisponível.'}</div>;

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800">{error}</div>}
      <section className="wf-surface p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Fonte operacional</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-foreground-950">{status.modeLabel}</h2>
            <p className="mt-1 max-w-2xl text-sm text-foreground-500">
              Este estado vem diretamente da empresa e das integrações. Nenhum botão nesta tela altera o navegador para simular produção.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${status.mode === 'real' ? 'border-primary-200 bg-primary-50 text-primary-800' : 'border-accent-200 bg-accent-50 text-accent-800'}`}>
              <span className={`h-2 w-2 rounded-full ${status.mode === 'real' ? 'bg-primary-500' : 'bg-accent-500'}`} />
              {status.mode === 'real' ? 'Efeitos reais sujeitos às políticas' : 'Saída real bloqueada'}
            </div>
            <button
              type="button"
              disabled={changing || (status.mode !== 'real' && !status.productionReady)}
              onClick={() => void changeMode()}
              className={`wf-btn text-xs disabled:cursor-not-allowed disabled:opacity-50 ${status.mode === 'real' ? 'wf-btn-secondary' : 'wf-btn-primary'}`}
              title={status.mode !== 'real' && !status.productionReady ? 'Conclua toda a pré-verificação para liberar o modo real.' : undefined}
            >
              <i className={status.mode === 'real' ? 'ri-shield-check-line' : 'ri-rocket-line'} />
              {changing ? 'Atualizando…' : status.mode === 'real' ? 'Voltar ao modo protegido' : 'Ativar modo real'}
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {status.checks.map((check) => (
            <div key={check.id} className={`rounded-xl border p-3 ${check.ok ? 'border-primary-100 bg-primary-50/50' : 'border-background-200 bg-background-100/60'}`}>
              <div className="flex items-center gap-2"><i className={`${check.ok ? 'ri-checkbox-circle-fill text-primary-600' : 'ri-error-warning-line text-accent-600'}`} /><p className="text-xs font-semibold text-foreground-800">{check.label}</p></div>
              <p className="mt-1 text-xs leading-relaxed text-foreground-500">{check.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="wf-surface p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-950">Pausa global da automação</h3>
            <p className="mt-1 text-sm text-foreground-500">Este é o kill switch consultado pela Ana e pela fila de saída.</p>
          </div>
          <button type="button" onClick={() => void changeKillSwitch()} disabled={changing} className={`wf-btn ${status.killSwitch ? 'wf-btn-primary' : 'wf-btn-secondary'} disabled:opacity-60`}>
            <i className={status.killSwitch ? 'ri-play-circle-line' : 'ri-pause-circle-line'} />
            {changing ? 'Atualizando…' : status.killSwitch ? 'Liberar automação' : 'Pausar automação'}
          </button>
        </div>
        <p className={`mt-4 rounded-xl px-3 py-2 text-xs ${status.killSwitch ? 'bg-accent-50 text-accent-800' : 'bg-primary-50 text-primary-800'}`}>
          {status.killSwitch ? 'A automação está pausada pelo controle global.' : 'A pausa global está desligada; a Ana ainda exige os demais requisitos acima antes de agir.'}
        </p>
      </section>

      <section className="wf-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-background-200/70 px-5 py-4">
          <div><h3 className="font-heading font-bold text-foreground-950">Conexões verificadas</h3><p className="mt-0.5 text-xs text-foreground-500">Status remoto, sem presets locais.</p></div>
          <button type="button" onClick={() => void refresh()} className="wf-btn-secondary text-xs"><i className="ri-refresh-line" />Atualizar</button>
        </div>
        <div className="divide-y divide-background-200/70">
          {status.integrations.map((item) => (
            <div key={item.key} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-semibold text-foreground-800">{item.label}</p><p className="text-xs text-foreground-500">{item.detail || item.provider || 'Sem detalhe de status.'}</p></div>
              <div className="text-left sm:text-right"><span className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold ${item.health === 'online' ? 'border-[#34C759]/25 bg-[#34C759]/10 text-[#237A3B]' : item.health === 'stale' ? 'border-[#FF9500]/25 bg-[#FF9500]/10 text-[#B76100]' : 'border-[#FF3B30]/25 bg-[#FF3B30]/10 text-[#D92D27]'}`}>{item.health === 'online' ? 'ONLINE' : item.health === 'stale' ? 'VALIDAÇÃO VENCIDA' : 'OFFLINE'}</span><p className="mt-1 text-[11px] text-foreground-400">Última validação: {formatDate(item.lastTestedAt)}</p></div>
            </div>
          ))}
          {status.integrations.length === 0 && <p className="px-5 py-8 text-sm text-foreground-500">Nenhuma conexão foi configurada para esta empresa.</p>}
        </div>
      </section>
    </div>
  );
}
