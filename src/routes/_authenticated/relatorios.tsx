import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp, Sparkles, User } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { formatBRL } from "@/lib/leads-data";

export const Route = createFileRoute("/_authenticated/relatorios")({ component: Relatorios });

function Relatorios() {
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"];
  const ia = [12, 18, 24, 31, 42, 55, 68];
  const humano = [22, 26, 25, 28, 32, 30, 34];
  const max = Math.max(...ia, ...humano);

  const rank = [
    { nome: "Ana (IA)", leads: 128, fechados: 12, receita: 486000, taxa: "9.4%", isAI: true },
    { nome: "Fabrício", leads: 42, fechados: 8, receita: 720000, taxa: "19.0%", isAI: false },
    { nome: "Diego", leads: 31, fechados: 5, receita: 285000, taxa: "16.1%", isAI: false },
    { nome: "Camila", leads: 28, fechados: 4, receita: 172000, taxa: "14.3%", isAI: false },
  ];

  const canais = [
    { canal: "Prospecção Ana", leads: 92, pct: 45, cor: "bg-ia" },
    { canal: "Site (formulário/chat)", leads: 48, pct: 24, cor: "bg-primary" },
    { canal: "Indicação", leads: 32, pct: 16, cor: "bg-success" },
    { canal: "LinkedIn Ads", leads: 20, pct: 10, cor: "bg-warm" },
    { canal: "Outros", leads: 10, pct: 5, cor: "bg-text-ter" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        {[
          { l: "Receita 7 meses", v: formatBRL(1663000), d: "+42% YoY" },
          { l: "Leads gerados", v: "202", d: "+58% vs. período" },
          { l: "Ticket médio", v: formatBRL(56000) },
          { l: "Ciclo de venda", v: "18 dias", d: "-4d com IA" },
        ].map((k) => (
          <Card key={k.l}>
            <div className="text-[11px] uppercase text-text-ter">{k.l}</div>
            <div className="text-[22px] font-semibold text-text-title">{k.v}</div>
            {k.d && <div className="text-[11px] text-success">{k.d}</div>}
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
          {meses.map((m, i) => (
            <div key={m} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-40 w-full items-end justify-center gap-1">
                <div className="w-4 rounded-t bg-ia" style={{ height: `${(ia[i] / max) * 100}%` }} title={`Ana: ${ia[i]}`} />
                <div className="w-4 rounded-t bg-primary" style={{ height: `${(humano[i] / max) * 100}%` }} title={`Humano: ${humano[i]}`} />
              </div>
              <div className="text-[11px] text-text-sec">{m}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <SectionTitle title="Ranking de vendedores" />
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
              {rank.map((r) => (
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
        </Card>

        <Card>
          <SectionTitle title="Origem dos leads" />
          <div className="space-y-2.5">
            {canais.map((c) => (
              <div key={c.canal}>
                <div className="mb-1 flex items-center justify-between text-[12.5px]">
                  <span className="text-text-body">{c.canal}</span>
                  <span className="text-text-sec">{c.leads} <span className="text-text-ter">({c.pct}%)</span></span>
                </div>
                <div className="h-2 rounded-full bg-bg-general">
                  <div className={`h-full rounded-full ${c.cor}`} style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md bg-ia-bg p-3 text-[12.5px] text-text-body">
            <div className="flex items-center gap-2 font-semibold text-ia"><TrendingUp className="h-4 w-4" /> Insight da Ana</div>
            <p className="mt-1">A prospecção da IA respondeu por 45% dos leads e 29% da receita fechada — mantendo custo por lead 4x menor que LinkedIn Ads.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
