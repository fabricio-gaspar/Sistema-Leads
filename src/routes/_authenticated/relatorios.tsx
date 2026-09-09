import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Activity, MessageSquare, Users, Timer, ArrowUpRight, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { getReportsData } from "@/lib/crm.functions";
import { getAutomationHealth } from "@/lib/insights.functions";

export const Route = createFileRoute("/_authenticated/relatorios")({ component: Relatorios });
type Period = "30d" | "3m" | "6m" | "12m";
const PERIODS: { id: Period; label: string }[] = [
  { id: "30d", label: "30 dias" }, { id: "3m", label: "3 meses" },
  { id: "6m", label: "6 meses" }, { id: "12m", label: "12 meses" },
];

function Relatorios() {
  const reportFn = useServerFn(getReportsData);
  const healthFn = useServerFn(getAutomationHealth);
  const [period, setPeriod] = useState<Period>("30d");
  const report = useQuery({ queryKey: ["reports", period], queryFn: () => reportFn({ data: { period } }) });
  const health = useQuery({ queryKey: ["automation-health"], queryFn: () => healthFn() });
  if (report.isLoading || !report.data) return <Card><div className="flex h-60 items-center justify-center gap-2 text-text-sec"><Loader2 className="h-5 w-5 animate-spin" /> Calculando dados reais…</div></Card>;
  const { canais, kpis, funnel, channelPerformance } = report.data;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-[15px] font-semibold text-text-title">Desempenho comercial</div><div className="text-[11px] text-text-sec">Métricas calculadas a partir de leads, mensagens, propostas e automações registradas.</div></div>
      <div className="flex gap-1 rounded-md border border-border-card bg-bg-card p-1">{PERIODS.map((item)=><button key={item.id} onClick={()=>setPeriod(item.id)} className={`rounded px-3 py-1.5 text-[12px] font-medium ${period===item.id?"bg-primary text-primary-foreground":"text-text-sec hover:bg-bg-general"}`}>{item.label}</button>)}</div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Kpi icon={Users} label="Leads gerados" value={String(kpis.leadsGerados)} />
      <Kpi icon={ArrowUpRight} label="Contatados" value={String(kpis.contactedLeads)} />
      <Kpi icon={MessageSquare} label="Responderam" value={String(kpis.responseLeads)} />
      <Kpi icon={Activity} label="Taxa de resposta" value={`${kpis.responseRate}%`} />
      <Kpi icon={Timer} label="Tempo até 1º contato" value={kpis.avgFirstContactMinutes == null ? "—" : `${kpis.avgFirstContactMinutes} min`} />
      <Kpi icon={ShieldCheck} label="Handoffs" value={String(kpis.escalated ?? 0)} />
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <Card><SectionTitle title="Funil do período" hint="Distribuição real dos leads por etapa" /><div className="space-y-3">{funnel.map((row)=>{const pct=kpis.leadsGerados>0?Math.round((row.count/kpis.leadsGerados)*100):0;return <div key={row.stage}><div className="mb-1 flex justify-between text-[12px]"><span className="font-medium text-text-title">{row.stage}</span><span className="text-text-sec">{row.count} · {pct}%</span></div><div className="h-2 rounded-full bg-bg-general"><div className="h-full rounded-full bg-primary" style={{width:`${Math.min(100,pct)}%`}} /></div></div>})}{funnel.length===0&&<Empty />}</div></Card>
      <Card><SectionTitle title="Origem dos leads" hint="Sem receita ou venda estimada" /><div className="space-y-3">{canais.map((row)=><div key={row.canal}><div className="mb-1 flex justify-between text-[12px]"><span className="text-text-title">{row.canal}</span><span className="text-text-sec">{row.leads} · {row.pct}%</span></div><div className="h-2 rounded-full bg-bg-general"><div className="h-full rounded-full bg-primary" style={{width:`${Math.min(100,row.pct)}%`}} /></div></div>)}{canais.length===0&&<Empty />}</div></Card>
    </div>
    <Card padded={false}><div className="border-b border-border-card p-4"><SectionTitle title="Desempenho por canal" hint="Tentativas, envios, respostas e falhas registradas" /></div><div className="overflow-x-auto"><table className="w-full text-[12px]"><thead className="bg-bg-general/50 text-left text-[10.5px] uppercase text-text-ter"><tr><th className="p-3">Canal</th><th className="p-3">Tentativas</th><th className="p-3">Enviadas</th><th className="p-3">Respostas</th><th className="p-3">Taxa</th><th className="p-3">Falhas</th></tr></thead><tbody className="divide-y divide-border-card">{channelPerformance.map((row)=><tr key={row.channel}><td className="p-3 font-medium capitalize text-text-title">{row.channel}</td><td className="p-3">{row.attempts}</td><td className="p-3">{row.sent}</td><td className="p-3">{row.replied}</td><td className="p-3 font-semibold text-success">{row.responseRate}%</td><td className="p-3 text-error">{row.failed}</td></tr>)}</tbody></table>{channelPerformance.length===0&&<div className="p-6"><Empty /></div>}</div></Card>
    <AutomationHealth data={health.data as any} loading={health.isLoading} />
  </div>;
}

function Kpi({icon:Icon,label,value}:{icon:React.ComponentType<{className?:string}>;label:string;value:string}){return <Card><div className="flex items-center justify-between"><div className="text-[10.5px] uppercase text-text-ter">{label}</div><Icon className="h-4 w-4 text-text-sec" /></div><div className="mt-2 text-[22px] font-semibold text-text-title">{value}</div></Card>}
function Empty(){return <div className="py-4 text-center text-[11px] text-text-ter">Ainda não há dados suficientes neste período.</div>}
function AutomationHealth({data,loading}:{data:any;loading:boolean}){if(loading)return <Card><div className="flex items-center gap-2 text-[12px] text-text-sec"><Loader2 className="h-4 w-4 animate-spin" /> Verificando automação…</div></Card>;if(!data)return null;const schedulers=Array.isArray(data.scheduler)?data.scheduler:[];const channels=Object.entries(data.byChannel??{}) as Array<[string,any]>;return <Card><SectionTitle title={`Saúde da automação · ${data.window_days??"—"} dias`} hint="Somente telemetria registrada" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Health label="Cadências ativas" value={data.enrollmentStatus?.active??0} hint={`Pausadas: ${data.enrollmentStatus?.paused??0}`} /><Health label="Jobs pendentes" value={data.jobStatus?.pending??0} hint={`Falhas: ${data.jobStatus?.failed??0}`} /><Health label="Handoffs" value={data.handoffs?.total??0} hint={`Aceitos: ${data.handoffs?.accepted??0} · SLA: ${data.handoffs?.sla_breached??0}`} /><Health label="Propostas" value={data.proposals?.total??0} hint={`IA: ${data.proposals?.from_ai??0} · aprovadas/enviadas: ${data.proposals?.sent_or_approved??0}`} /></div><div className="mt-4 grid gap-2 md:grid-cols-2">{schedulers.map((row:any)=><div key={row.job_name} className={`rounded-md border p-3 text-[11px] ${row.stale||row.status==="failed"?"border-error/30 bg-error/5 text-error":"border-success/30 bg-success-bg text-success"}`}><div className="font-semibold">{row.job_name}</div><div className="mt-1 opacity-80">{row.last_finished_at?new Date(row.last_finished_at).toLocaleString("pt-BR"):"Sem execução registrada"}{row.last_error?` · ${row.last_error}`:""}</div></div>)}</div>{channels.length>0&&<div className="mt-4 border-t border-border-card pt-3"><div className="mb-2 text-[11px] font-semibold text-text-title">Telemetria por canal</div><div className="grid gap-2 sm:grid-cols-2">{channels.map(([name,row])=><div key={name} className="flex items-center justify-between rounded-md bg-bg-general px-3 py-2 text-[11px]"><span className="font-medium capitalize">{name}</span><span className="text-text-sec">enviadas {row.sent??0} · entregues {row.delivered??0} · respostas {row.replied??0} · falhas {row.failed??0}</span></div>)}</div></div>}</Card>}
function Health({label,value,hint}:{label:string;value:number;hint:string}){return <div className="rounded-md bg-bg-general p-3"><div className="text-[10.5px] uppercase text-text-ter">{label}</div><div className="mt-1 text-[20px] font-semibold text-text-title">{value}</div><div className="text-[10.5px] text-text-sec">{hint}</div></div>}
