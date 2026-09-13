import { useCallback, useEffect, useState } from 'react';
import { loadOperationalDiagnostics, type OperationalDiagnostics, type OperationalEvent } from '@/lib/crm/operationalDiagnosticsRepository';

function date(value: string | null | undefined): string { return value ? new Date(value).toLocaleString('pt-BR') : '—'; }

function EventList({ title, items, label }: { title: string; items: OperationalEvent[]; label: (item: OperationalEvent) => string }) {
  return <section className="wf-surface overflow-hidden"><div className="border-b border-background-200/70 px-5 py-4"><h3 className="font-heading font-bold text-foreground-950">{title}</h3></div><div className="divide-y divide-background-200/70">{items.length === 0 ? <p className="px-5 py-8 text-sm text-foreground-500">Nenhum registro recente.</p> : items.slice(0, 12).map((item) => <div key={item.id} className="px-5 py-3"><p className="text-sm font-medium text-foreground-800">{label(item)}</p><p className="mt-0.5 text-xs text-foreground-500">{item.detail || item.error_message || item.error || 'Sem erro registrado.'}</p><p className="mt-1 text-[11px] text-foreground-400">{date(item.occurredAt || item.replied_at || item.read_at || item.delivered_at || item.sent_at || item.processed_at || item.run_at || item.scheduled_for || item.created_at)}</p></div>)}</div></section>;
}

export default function DiagnosticsTab() {
  const [data, setData] = useState<OperationalDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => { setLoading(true); try { setData(await loadOperationalDiagnostics()); setError(''); } catch { setError('Não foi possível carregar os registros operacionais.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  if (loading) return <div className="wf-surface p-6 text-sm text-foreground-500">Carregando diagnóstico real…</div>;
  if (!data) return <div className="wf-surface p-6 text-sm text-accent-700">{error}</div>;
  return <div className="space-y-5">
    <section className="wf-surface p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Monitoramento operacional</p><h2 className="mt-1 font-heading text-xl font-bold text-foreground-950">Diagnóstico e auditoria</h2><p className="mt-1 text-sm text-foreground-500">Eventos reais da Ana, fila, canal e integrações. Nenhum registro de demonstração é exibido aqui.</p></div><button type="button" className="wf-btn-secondary text-xs" onClick={() => void refresh()}><i className="ri-refresh-line" />Atualizar</button></div><div className="mt-5 grid gap-3 sm:grid-cols-4"><Metric label="Fila pendente" value={data.summary.queuedJobs} tone="primary" /><Metric label="Aguardando reconciliação" value={data.summary.reconciliationJobs} tone={data.summary.reconciliationJobs ? 'danger' : 'neutral'} /><Metric label="Falhas na fila" value={data.summary.failedJobs} tone={data.summary.failedJobs ? 'danger' : 'neutral'} /><Metric label="Alertas de risco" value={data.summary.openRiskEvents} tone={data.summary.openRiskEvents ? 'danger' : 'neutral'} /></div></section>
    {data.risks.length > 0 && <section className="rounded-xl border border-accent-200 bg-accent-50 p-4"><p className="text-sm font-semibold text-accent-900">Canal sob atenção</p>{data.risks.map((risk) => <p key={risk.id} className="mt-1 text-xs text-accent-800">{risk.channel}: {risk.reason}</p>)}</section>}
    <div className="grid gap-5 xl:grid-cols-2"><EventList title="Fila de saída" items={data.jobs} label={(item) => `${item.channel || 'canal'} · ${item.status || 'sem status'} · tentativa ${item.attempt ?? 0}`} /><EventList title="Entrega por mensagem" items={data.outreach} label={(item) => `${item.channel || 'canal'} · ${item.status || 'sem status'}${item.provider ? ` · ${item.provider}` : ''}`} /></div>
    <div className="grid gap-5 xl:grid-cols-3"><EventList title="Execuções da Ana" items={data.runs} label={(item) => `${item.event || 'Execução'} · ${item.status || 'sem status'}`} /><EventList title="Entradas de canal" items={data.inbound} label={(item) => `${item.provider || 'Canal'} · ${item.event_type || 'evento'} · ${item.status || 'sem status'}`} /><EventList title="Auditoria" items={data.audit} label={(item) => `${item.actor_name || 'Sistema'} · ${item.action || 'evento'}`} /></div>
  </div>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'primary' | 'danger' | 'neutral' }) {
  const color = tone === 'primary' ? 'bg-primary-50 text-primary-800' : tone === 'danger' ? 'bg-accent-50 text-accent-800' : 'bg-background-100 text-foreground-700';
  return <div className={`rounded-xl border border-background-200/70 p-4 ${color}`}><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs font-medium">{label}</p></div>;
}
