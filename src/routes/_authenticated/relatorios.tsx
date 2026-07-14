import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingUp, Sparkles, User, Loader2 } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { formatBRL } from "@/lib/leads-data";
import { getReportsData } from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/relatorios")({ component: Relatorios });

const CANAL_COR = ["bg-ia", "bg-primary", "bg-success", "bg-warm", "bg-text-ter"];

function Relatorios() {
  const fn = useServerFn(getReportsData);
  const { data, isLoading } = useQuery({ queryKey: ["reports"], queryFn: () => fn() });

  if (isLoading || !data) {
    return (
      <Card>
        <div className="flex h-60 items-center justify-center text-text-sec">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </Card>
    );
  }

  const { months, ranking, canais, kpis } = data;
  const max = Math.max(1, ...months.map((m) => Math.max(m.ia, m.humano)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[
          { l: "Receita 7 meses", v: formatBRL(kpis.receita7m) },
          { l: "Leads gerados", v: String(kpis.leadsGerados) },
          { l: "Ticket médio", v: formatBRL(kpis.ticket) },
          { l: "Fechados", v: String(kpis.fechados7m), d: "Últimos 7 meses" },
        ].map((k) => (
          <Card key={k.l}>
            <div className="text-[11px] uppercase text-text-ter">{k.l}</div>
            <div className="text-[22px] font-semibold text-text-title">{k.v}</div>
            {k.d && <div className="text-[11px] text-text-sec">{k.d}</div>}
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
    </div>
  );
}
