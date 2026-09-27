import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentAccess } from '@/hooks/useCurrentAccess';
import {
  loadAnaOperation,
  setAnaAutomaticOperation,
  type AnaOperationSnapshot,
} from '@/lib/crm/anaOperationRepository';
import InfoTooltip from '@/components/feature/InfoTooltip';

const ERROR_COPY: Record<string, string> = {
  automatic_mode_not_ready: 'Conclua os pré-requisitos da Ana antes de ativar.',
  paid_prospecting_approval_required: 'Confirme os limites da prospecção nas configurações da Ana.',
  operation_schedule_missing: 'Configure a rotina da Ana antes de ativar.',
  operation_run_in_progress: 'Existe uma execução em andamento. Aguarde a conclusão para ativar.',
  operation_assignment_member_required: 'Defina quem receberá os leads nas configurações da Ana.',
  operation_assignment_member_cannot_reply: 'O responsável configurado não pode atender conversas.',
  permission_denied: 'Seu acesso não permite alterar a operação automática.',
};

export default function AnaAutomaticControl() {
  const { access, loading: accessLoading } = useCurrentAccess();
  const [snapshot, setSnapshot] = useState<AnaOperationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    try {
      setSnapshot(await loadAnaOperation());
      setError('');
    } catch {
      setSnapshot(null);
      setError('Não foi possível confirmar a operação da Ana.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const schedule = snapshot?.schedule;
  const active = snapshot?.company?.ana_operation_enabled === true
    && snapshot.company.ana_operation_mode === 'automatic'
    && schedule?.active === true;
  const configured = Boolean(schedule);
  const approved = schedule?.paid_prospecting_approved === true;
  const ready = snapshot?.readiness.automaticReady === true && approved;
  const canManage = access?.permissions['configuration.manage'] === true;
  const status = loading || accessLoading
    ? 'Consultando'
    : active && ready
      ? 'Ativa'
      : active
        ? 'Proteção acionada'
        : !configured
          ? 'Configuração necessária'
          : ready
            ? 'Pronta para ativar'
            : 'Preparação necessária';

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      await setAnaAutomaticOperation(!active);
      await refresh();
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : '';
      setError(ERROR_COPY[code] || 'Não foi possível alterar a operação automática.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="wf-surface flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" aria-label="Controle da Ana automática">
    <div className="flex min-w-0 items-center gap-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active && ready ? 'bg-primary-100 text-primary-700' : 'bg-background-100 text-foreground-700'}`} aria-hidden="true"><i className="ri-robot-2-line text-lg" /></span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5"><h2 className="text-sm font-bold text-foreground-950">Ana automática</h2><InfoTooltip text="Ativa a rotina já configurada. O servidor valida conexões, limites, permissões e proteções antes de liberar." label="Sobre a Ana automática" /></div>
        <p className={`text-xs font-semibold ${active && ready ? 'text-primary-700' : active || error ? 'text-amber-700' : 'text-foreground-500'}`} aria-live="polite">{error || status}</p>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {(!ready && !active) || !canManage ? <Link to="/dashboard/configuracoes?tab=ana" className="wf-btn-secondary text-xs">{canManage ? 'Preparar' : 'Ver configuração'}</Link> : <button type="button" onClick={() => void toggle()} disabled={busy || loading || accessLoading} className={`${active ? 'wf-btn-secondary' : 'wf-btn-primary'} text-xs disabled:opacity-60`}>{busy ? 'Validando…' : active ? 'Pausar' : 'Ativar'}</button>}
    </div>
  </section>;
}

