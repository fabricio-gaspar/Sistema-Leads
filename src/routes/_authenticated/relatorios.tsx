import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, Sparkles, User, Loader2 } from "lucide-react";
import { useState } from "react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { formatBRL } from "@/lib/leads-data";
import { getReportsData, getOpsMetrics } from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/relatorios")({ component: Relatorios });

const CANAL_COR = ["bg-ia", "bg-primary", "bg-success", "bg-warm", "bg-text-ter"];
type Period = "30d" | "3m" | "6m" | "12m";
const PERIODS: { id: Period; label: string }[] = [
  { id: "30d", label: "Mensal" },
  { id: "3m", label: "Trimestral" },
  { id: "6m", label: "Semestral" },
  { id: "12m", label: "Anual" },
];

function Relatorios() {
  const fn = useServerFn(getReportsData);
  const [period, setPeriod] = useState<Period>("6m");
  const { data, isLoading } = useQuery({ queryKey: ["reports", period], queryFn: () => fn({ data: { period } }) });

  if (isLoading || !data) {
    return (
      <Card>
        <div className="flex h-60 items-center justify-center text-text-sec">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Card>
    );
  }

  const { months, ranking, canais, kpis, funnel, channelPerformance } = data;
  const max = Math.max(1, ...months.map((m) => Math.max(m.ia, m.humano)));


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-text-sec">Período de análise</div>
        <div className="flex gap-1 rounded-md border border-border-card bg-bg-card p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`rounded px-3 py-1 text-[12px] font-medium transition ${period === p.id ? "bg-primary text-white" : "text-text-body hover:bg-bg-general"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { l: `Receita (${PERIODS.find((p) => p.id === period)?.label.toLowerCase()})`, v: formatBRL(kpis.receita7m) },
          { l: "Leads gerados", v: String(kpis.leadsGerados) },
          { l: "Ticket médio", v: formatBRL(kpis.ticket) },
          { l: "Fechados", v: String(kpis.fechados7m) },

        ].map((k) => (
          <Card key={k.l}>
            <div className="text-[11px] uppercase text-text-ter">{k.l}</div>
            <div className="text-[22px] font-semibold text-text-title">{k.v}</div>
          </Card>

        ))}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {[
          { l: "Leads contatados", v: String(kpis.contactedLeads) },
          { l: "Leads que responderam", v: String(kpis.responseLeads) },
          { l: "Taxa de resposta", v: `${kpis.responseRate}%` },
          { l: "Conversão em venda", v: `${kpis.conversionRate}%` },
          {
            l: "Tempo até 1º contato",
            v: kpis.avgFirstContactMinutes == null ? "—" : `${kpis.avgFirstContactMinutes} min`,
          },
        ].map((k) => (
          <Card key={k.l}>
            <div className="text-[11px] uppercase text-text-ter">{k.l}</div>
            <div className="text-[20px] font-semibold text-text-title">{k.v}</div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionTitle
          title="Leads fechados por mês"
          hint="Comparativo IA vs. Humano"
          action={
            <div className="flex gap-3 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ia" /> Ana</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" /> Humano</span>
            </div>
          }
        />
        <div className="flex h-52 items-end gap-6 px-2">
          {months.map((m) => (
            <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-40 w-full items-end justify-center gap-1">
                <div className="w-4 rounded-t bg-ia" style={{ height: `${(m.ia / max) * 100}%` }} title={`Ana: ${m.ia}`} />
                <div className="w-4 rounded-t bg-primary" style={{ height: `${(m.humano / max) * 100}%` }} title={`Humano: ${m.humano}`} />
              </div>
              <div className="text-[11px] text-text-sec">{m.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <SectionTitle title="Desempenho por canal" hint="Tentativas, entregas e respostas" />
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase text-text-ter">
                <th className="pb-2">Canal</th>
                <th className="pb-2">Tentativas</th>
                <th className="pb-2">Enviadas</th>
                <th className="pb-2">Respostas</th>
                <th className="pb-2">Taxa</th>
                <th className="pb-2">Falhas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-card">
              {channelPerformance.map((row) => (
                <tr key={row.channel}>
                  <td className="py-2.5 font-medium capitalize text-text-title">{row.channel}</td>
                  <td className="py-2.5">{row.attempts}</td>
                  <td className="py-2.5">{row.sent}</td>
                  <td className="py-2.5">{row.replied}</td>
                  <td className="py-2.5 font-semibold text-success">{row.responseRate}%</td>
                  <td className="py-2.5 text-error">{row.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <SectionTitle title="Funil do período" hint={`${kpis.escalated} lead(s) encaminhado(s) ao time`} />
          <div className="space-y-2">
            {funnel.map((row) => {
              const pct = kpis.leadsGerados > 0 ? Math.round((row.count / kpis.leadsGerados) * 100) : 0;
              return (
                <div key={row.stage}>
                  <div className="mb-1 flex justify-between text-[12px]">
                    <span className="text-text-body">{row.stage}</span>
                    <span className="text-text-sec">{row.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-bg-general">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <SectionTitle title="Ranking de vendedores" />
          {ranking.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-text-sec">Sem dados ainda.</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase text-text-ter">
                  <th className="pb-2">Vendedor</th>
                  <th className="pb-2">Leads</th>
                  <th className="pb-2">Fechados</th>
                  <th className="pb-2">Receita</th>
                  <th className="pb-2">Taxa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-card">
                {ranking.map((r) => (
                  <tr key={r.nome}>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium ${r.isAI ? "bg-ia-bg text-ia" : "bg-primary/10 text-primary"}`}>
                        {r.isAI ? <Sparkles className="h-3 w-3" /> : <User className="h-3 w-3" />}
                        {r.nome}
                      </span>
                    </td>
                    <td className="py-2.5 text-text-body">{r.leads}</td>
                    <td className="py-2.5 text-text-body">{r.fechados}</td>
                    <td className="py-2.5 font-medium text-text-title">{formatBRL(r.receita)}</td>
                    <td className="py-2.5 text-success font-semibold">{r.taxa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <SectionTitle title="Origem dos leads" />
          {canais.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-text-sec">Sem dados ainda.</div>
          ) : (
            <div className="space-y-2.5">
              {canais.map((c, i) => (
                <div key={c.canal}>
                  <div className="mb-1 flex items-center justify-between text-[12.5px]">
                    <span className="text-text-body">{c.canal}</span>
                    <span className="text-text-sec">{c.leads} <span className="text-text-ter">({c.pct}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-bg-general">
                    <div className={`h-full rounded-full ${CANAL_COR[i % CANAL_COR.length]}`} style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 rounded-md bg-ia-bg p-3 text-[12.5px] text-text-body">
            <div className="flex items-center gap-2 font-semibold text-ia"><TrendingUp className="h-4 w-4" /> Insight</div>
            <p className="mt-1">Dados calculados em tempo real a partir dos leads cadastrados.</p>
          </div>
        </Card>
      </div>

      <OpsMetricsCard />
    </div>
  );
}

function OpsMetricsCard() {
  const fn = useServerFn(getOpsMetrics);
  const { data } = useQuery({ queryKey: ["ops-metrics"], queryFn: () => fn() });
  if (!data) return null;
  const channels: Array<{ id: "whatsapp" | "email" | "phone"; label: string }> = [
    { id: "whatsapp", label: "WhatsApp" },
    { id: "email", label: "E-mail" },
    { id: "phone", label: "Ligação" },
  ];
  const catLabels: Record<string, string> = {
    orcamento: "Orçamento",
    agendamento: "Visita",
    fechamento: "Fechamento",
    urgente: "Urgente",
    geral: "Geral",
  };
  return (
    <Card>
      <SectionTitle title="Operação (últimos 30 dias)" hint="Cadência, opt-outs e handoffs para vendedores" />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          { label: "Cadências ativas", value: data.sequences.active },
          { label: "Cadências concluídas", value: data.sequences.completed },
          { label: "Handoffs pendentes", value: data.handoffs.pending },
          { label: "Handoffs fora do SLA", value: data.handoffs.overdue },
          { label: "Tempo médio p/ assumir", value: data.handoffs.avgResponseMinutes == null ? "—" : `${data.handoffs.avgResponseMinutes} min` },
        ].map((item) => (
          <div key={item.label} className="rounded-md border border-border-card bg-bg-general p-2.5">
            <div className="text-[10px] uppercase text-text-ter">{item.label}</div>
            <div className="mt-1 text-[18px] font-semibold text-text-title">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <div className="mb-2 text-[12px] font-semibold text-text-title">Cadência por canal</div>
          <div className="space-y-2">
            {channels.map((c) => {
              const b = data.byChannel[c.id];
              const rate = b.attempts ? Math.round((b.sent / b.attempts) * 100) : 0;
              return (
                <div key={c.id} className="rounded-md border border-border-card bg-bg-general p-2 text-[11.5px]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-body">{c.label}</span>
                    <span className="text-text-ter">{b.attempts} tentativa(s)</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10.5px] text-text-sec">
                    <span>✓ {b.sent} entregues ({rate}%)</span>
                    <span>↩ {b.replied} respostas</span>
                    <span className="text-hot">✕ {b.failed} falhas</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[12px] font-semibold text-text-title">Handoffs por categoria</div>
          {Object.keys(data.handoffByCategory).length === 0 ? (
            <div className="text-[12px] text-text-ter">Sem handoffs no período.</div>
          ) : (
            <ul className="space-y-1.5">
              {Object.entries(data.handoffByCategory).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between rounded-md border border-border-card bg-bg-general px-2 py-1.5 text-[12px]">
                  <span>{catLabels[k] ?? k}</span>
                  <span className="font-semibold text-primary">{v}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 rounded-md bg-ia-bg p-2 text-[11px] text-text-body">
            <span className="font-semibold text-ia">Tarefas geradas para vendedores: </span>
            {data.anaTaskCount}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[12px] font-semibold text-text-title">Consentimento</div>
          <div className="rounded-md border border-border-card bg-bg-general p-3">
            <div className="text-[11px] uppercase text-text-ter">Opt-outs ativos</div>
            <div className="mt-1 text-[22px] font-semibold text-hot">{data.optOutCount}</div>
            <p className="mt-1 text-[11px] text-text-sec">Leads que solicitaram parar de receber mensagens.</p>
          </div>
          <div className="mt-2 rounded-md border border-border-card bg-bg-general p-3">
            <div className="text-[11px] uppercase text-text-ter">Reuniões no período</div>
            <div className="mt-1 text-[11px] text-text-sec">
              {data.appointments.scheduled} agendada(s) · {data.appointments.completed} concluída(s) · {data.appointments.noShow} ausência(s)
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
