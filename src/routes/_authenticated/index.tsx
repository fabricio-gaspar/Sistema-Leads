import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, MessagesSquare, FileText, TrendingUp, Bot, Flame, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { formatBRL } from "@/lib/leads-data";
import { getDashboardStats } from "@/lib/crm.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({ component: Dashboard });
type Readiness = { mode: "real"|"demo"; modeLabel: string; productionReady: boolean; checks: Array<{ id:string; label:string; ok:boolean; detail:string }> };

function Dashboard() {
  const fn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => fn() });
  const readiness = useQuery({ queryKey:["operational-status"], queryFn: async()=>{const{data,error}=await supabase.functions.invoke("operational-diagnostics",{body:{action:"status"}});if(error||!data?.ok)throw new Error(data?.erro||error?.message||"Falha no readiness");return data.status as Readiness}, refetchInterval:60_000 });
  const val=(v?:number)=>(v==null?"—":String(v));
  const pending=readiness.data?.checks.filter((item)=>!item.ok)??[];
  return <div className="space-y-5">
    <Card className={readiness.data?.productionReady?"border-success/35":"border-warm/35"}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-start gap-3">{readiness.isLoading?<Loader2 className="mt-0.5 h-5 w-5 animate-spin text-text-sec"/>:readiness.data?.productionReady?<ShieldCheck className="mt-0.5 h-5 w-5 text-success"/>:<AlertTriangle className="mt-0.5 h-5 w-5 text-warm"/>}<div><div className="text-[13px] font-semibold text-text-title">{readiness.data?.modeLabel??"Verificando ambiente…"}</div><div className="mt-0.5 text-[11px] text-text-sec">{readiness.data?.productionReady?"Todos os checks obrigatórios do servidor estão prontos.":pending.length?`${pending.length} item(ns) ainda bloqueiam a operação real: ${pending.map((item)=>item.label).join(", ")}.`:"Verificando integrações e worker."}</div></div></div><Link to="/diagnostico" className="rounded-md bg-primary px-3 py-2 text-[11px] font-medium text-primary-foreground">Abrir Centro Operacional</Link></div></Card>
    <div className="grid gap-4 md:grid-cols-3"><StatCard icon={Users} label="Leads ativos" value={val(data?.leadsActive)} hint={data?`${data.leadsHot} quentes · ${data.leadsStale} parados`:"carregando..."}/><StatCard icon={MessagesSquare} label="Conversas hoje" value={val(data?.messagesToday)} hint={data?`${data.messagesAnaToday} da Ana`:""}/><StatCard icon={FileText} label="Orçamentos abertos" value={val(data?.proposalsOpen)} hint={data?formatBRL(data.proposalsValue):""}/></div>
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]"><Card><SectionTitle title="Fluxo comercial" hint="Acesso direto aos módulos canônicos" />{isLoading?<div className="flex h-32 items-center justify-center text-text-sec"><Loader2 className="h-5 w-5 animate-spin"/></div>:<div className="grid gap-3 sm:grid-cols-2"><QuickLink to="/leads" icon={Users} label="Leads e Kanban"/><QuickLink to="/prospeccao" icon={Bot} label="Prospecção"/><QuickLink to="/atendimento" icon={MessagesSquare} label="Central de Atendimento"/><QuickLink to="/orcamentos" icon={FileText} label="Orçamentos"/><QuickLink to="/relatorios" icon={TrendingUp} label="Relatórios"/></div>}</Card><Card><SectionTitle title="Atenção agora"/><ul className="space-y-3 text-[12px]"><li className="flex items-center gap-2 text-text-body"><Flame className="h-4 w-4 text-hot"/>{data?.leadsHot??0} leads quentes</li><li className="flex items-center gap-2 text-text-body"><Bot className="h-4 w-4 text-ia"/>Ana respondeu {data?.messagesAnaToday??0} conversa(s) hoje</li><li className="flex items-center gap-2 text-text-body"><FileText className="h-4 w-4 text-primary"/>{data?.proposalsOpen??0} orçamento(s) em aberto</li>{pending.slice(0,2).map((item)=><li key={item.id} className="flex items-start gap-2 text-warm"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{item.label}</li>)}</ul></Card></div>
  </div>;
}
function StatCard({icon:Icon,label,value,hint}:{icon:React.ComponentType<{className?:string}>;label:string;value:string;hint?:string}){return <Card><div className="flex items-center justify-between"><div className="text-[11px] uppercase text-text-ter">{label}</div><Icon className="h-4 w-4 text-text-sec"/></div><div className="mt-1 text-[24px] font-semibold text-text-title">{value}</div>{hint&&<div className="text-[11px] text-text-sec">{hint}</div>}</Card>}
function QuickLink({to,icon:Icon,label}:{to:string;icon:React.ComponentType<{className?:string}>;label:string}){return <Link to={to} className="flex items-center gap-2 rounded-md border border-border-card px-3 py-2 text-[13px] text-text-body hover:bg-bg-general"><Icon className="h-4 w-4 text-primary"/>{label}</Link>}
