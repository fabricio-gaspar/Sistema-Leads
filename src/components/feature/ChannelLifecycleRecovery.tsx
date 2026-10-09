import { useId, useRef, useState } from 'react';
import { reviewChannelLifecycle, type ChannelRecoveryResult } from '@/lib/crm/whatsappAccountsRepository';

const reasonCopy: Record<string, string> = {
  external_mutation_terminality_unproven: 'O provedor não comprovou o término da alteração anterior. Não há recuperação automática segura; investigue o processamento no servidor do provedor.',
  provider_state_not_confirmed: 'O provedor não confirmou o estado. O bloqueio foi mantido.',
  lifecycle_not_recoverable: 'Esta operação não permite recuperação por consulta. O bloqueio foi mantido.',
};

/** Explicit administrative review. No automatic diagnose, retry, QR, connect or activation. */
export default function ChannelLifecycleRecovery({ provider, accountId, disabled = false, recoveryKind = 'read_only', onReconciled, review = reviewChannelLifecycle }: {
  provider: 'wa_akg'; accountId: string; disabled?: boolean;
  recoveryKind?: 'read_only' | 'provision';
  onReconciled: () => Promise<void>; review?: typeof reviewChannelLifecycle;
}) {
  const [diagnosis, setDiagnosis] = useState<ChannelRecoveryResult | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const running = useRef(false);
  const reasonId = useId();
  const run = async (reconcile: boolean) => {
    if (running.current || disabled || (reconcile && (!diagnosis?.recovery.eligible || reason.trim().length < 8))) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await review(provider, accountId, reconcile ? { expectedRevision: diagnosis!.lifecycle.revision, reason } : undefined, recoveryKind);
      setDiagnosis(result);
      if (reconcile) {
        setMessage(recoveryKind === 'provision'
          ? 'Provisionamento confirmado. A sessão está pronta para pareamento; envio, recebimento e Ana continuam desabilitados.'
          : 'Revisão registrada. A conta continua desabilitada; envio e Ana não foram liberados.');
        await onReconciled();
      }
    } catch (cause) {
      // Unknown/CAS conflict is not permission to repeat. Discard the observation.
      setDiagnosis(null);
      setError(cause instanceof Error && cause.message === 'account_lifecycle_needs_review'
        ? 'A revisão não confirmou uma recuperação segura. Consulte novamente e verifique o provedor; o bloqueio permanece.'
        : 'Não foi possível confirmar a revisão. Atualize a leitura antes de qualquer nova tentativa.');
    } finally { running.current = false; setBusy(false); }
  };
  return <section aria-label="Revisão administrativa da conta" className="mt-3 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <h4 className="font-semibold">Revisar operação pendente</h4>
    <p className="text-xs leading-5">O diagnóstico consulta o provedor sem iniciar sessão ou enviar mensagens. Uma alteração remota com resultado incerto não será repetida. A recuperação nunca libera envio, recebimento ou a Ana.</p>
    <button type="button" className="wf-btn-secondary text-xs" disabled={disabled || busy} onClick={() => void run(false)}>{busy ? 'Consultando…' : 'Consultar diagnóstico seguro'}</button>
    {diagnosis && <div role="status" className="space-y-2 text-xs">
      <p>Revisão {diagnosis.lifecycle.revision} · Conexão observada: {diagnosis.recovery.observedConnected === null ? 'não confirmada' : diagnosis.recovery.observedConnected ? 'conectada' : 'desconectada'}.</p>
      <p>{diagnosis.recovery.eligible ? (recoveryKind === 'provision' ? 'A sessão, o webhook e as proteções foram confirmados por leitura. A conta continuará desabilitada.' : 'Somente uma consulta anterior pode ser encerrada com segurança. A conta continuará desabilitada.') : reasonCopy[diagnosis.recovery.reason] || 'Não há evidência suficiente para recuperar esta operação. Solicite análise técnica do provedor.'}</p>
      {diagnosis.recovery.eligible && !diagnosis.recovery.reconciled && <div className="space-y-2">
        <label htmlFor={reasonId} className="block font-semibold">Motivo da revisão (8 a 500 caracteres)</label>
        <textarea id={reasonId} maxLength={500} value={reason} disabled={disabled || busy} onChange={(event) => setReason(event.target.value)} className="w-full" />
        <button type="button" className="wf-btn-secondary text-xs" disabled={disabled || busy || reason.trim().length < 8} onClick={() => void run(true)}>{recoveryKind === 'provision' ? 'Confirmar provisionamento mantendo bloqueios' : 'Encerrar consulta mantendo bloqueios'}</button>
      </div>}
    </div>}
    {error && <p role="alert" className="text-xs">{error}</p>}
    {message && <p role="status" className="text-xs">{message}</p>}
  </section>;
}
