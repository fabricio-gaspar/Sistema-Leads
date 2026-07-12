import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  DollarSign,
  Sparkles,
  TrendingUp,
  Flame,
  MessageCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, SectionTitle, StatCard, TempBadge, OwnerBadge } from "@/components/ui-kit";
import { useLeads } from "@/hooks/use-leads-store";
import { STAGES, formatBRL } from "@/lib/leads-data";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
  const leads = useLeads();
  const pipeline = leads.filter((l) => l.stage !== "fechado").reduce((a, l) => a + l.valor, 0);
  const fechado = leads.filter((l) => l.stage === "fechado").reduce((a, l) => a + l.valor, 0);
  const hot = leads.filter((l) => l.temperatura === "hot").length;
  const anaCount = leads.filter((l) => l.responsavel.startsWith("Ana")).length;

  const funnel = STAGES.map((s) => ({
    ...s,
    count: leads.filter((l) => l.stage === s.id).length,
    valor: leads.filter((l) => l.stage === s.id).reduce((a, l) => a + l.valor, 0),
  }));
  const maxCount = Math.max(...funnel.map((f) => f.count), 1);

  const anaActivity = [
    { at: "há 3 min", text: "Ana enviou mensagem para Roberto (Metalúrgica São Jorge)", kind: "chat" as const },
    { at: "há 12 min", text: "Ana qualificou Grupo Ferronorte — score 63", kind: "score" as const },
    { at: "há 40 min", text: "Ana escalou NorthTrade para Fabrício", kind: "handoff" as const },
    { at: "há 1h", text: "Ana enviou proposta ORC-882 para Vitalux", kind: "quote" as const },
    { at: "há 2h", text: "Ana prospectou 34 novos contatos em Metalurgia/SP", kind: "prospect" as const },
  ];

  const tarefas = [
    { text: "Ligar para Fernanda Rocha — Vitalux", due: "Hoje 15:00", owner: "Fabrício" },
    { text: "Revisar proposta ORC-879", due: "Hoje 17:00", owner: "Fabrício" },
    { text: "Follow-up com AutoParts Brasil", due: "Amanhã 09:00", owner: "Diego" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Leads ativos" value={String(leads.filter((l) => l.stage !== "fechado").length)} delta="+3 hoje" icon={<Users className="h-5 w-5" />} />
        <StatCard tone="ia" label="Trabalhados pela Ana" value={String(anaCount)} delta={`${Math.round((anaCount / leads.length) * 100)}% do total`} icon={<Sparkles className="h-5 w-5" />} />
        <StatCard tone="hot" label="Leads quentes" value={String(hot)} icon={<Flame className="h-5 w-5" />} />
        <StatCard tone="success" label="Fechado no mês" value={formatBRL(fechado)} delta="+18% vs. mês anterior" icon={<DollarSign className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <SectionTitle title="Funil comercial" hint={`Pipeline total: ${formatBRL(pipeline)}`} />
          <div className="space-y-2">
            {funnel.map((f) => (
              <div key={f.id} className="flex items-center gap-3">
                <div className="w-28 text-[12px] text-text-sec">{f.label}</div>
                <div className="flex-1">
                  <div
                    className={`h-8 rounded-md ${f.id === "fechado" ? "bg-success" : "bg-primary"} flex items-center justify-between px-3 text-[12px] font-medium text-white`}
                    style={{ width: `${Math.max((f.count / maxCount) * 100, 10)}%` }}
                  >
                    <span>{f.count} leads</span>
                    <span className="opacity-90">{formatBRL(f.valor)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Atividade da Ana" hint="Últimas ações da IA" />
          <ul className="space-y-3">
            {anaActivity.map((a, i) => (
              <li key={i} className="flex gap-2.5">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ia-bg text-ia">
                  <Sparkles className="h-3 w-3" />
                </div>
                <div className="min-w-0">
                  <div className="text-[12.5px] text-text-body">{a.text}</div>
                  <div className="text-[11px] text-text-ter">{a.at}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <SectionTitle
            title="Top leads quentes"
            action={<Link to="/leads" className="text-[12px] text-primary font-medium">Ver todos →</Link>}
          />
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase text-text-ter">
                <th className="pb-2">Empresa</th>
                <th className="pb-2">Score</th>
                <th className="pb-2">Valor</th>
                <th className="pb-2">Responsável</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-card">
              {leads
                .filter((l) => l.temperatura === "hot" && l.stage !== "fechado")
                .slice(0, 5)
                .map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5">
                      <Link to="/leads/$id" params={{ id: l.id }} className="font-medium text-text-title hover:text-primary">
                        {l.empresa}
                      </Link>
                      <div className="text-[11px] text-text-ter">{l.contato}</div>
                    </td>
                    <td className="py-2.5 font-semibold text-text-title">{l.score}</td>
                    <td className="py-2.5">{formatBRL(l.valor)}</td>
                    <td className="py-2.5"><OwnerBadge owner={l.responsavel} /></td>
                    <td className="py-2.5"><TempBadge t={l.temperatura} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <SectionTitle title="Suas tarefas" hint="Próximas ações" />
          <ul className="space-y-2.5">
            {tarefas.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-md border border-border-card p-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-text-ter" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-text-body">{t.text}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-ter">
                    <Clock className="h-3 w-3" /> {t.due} · {t.owner}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2 rounded-md bg-ia-bg p-2.5 text-[12px] text-ia">
            <MessageCircle className="h-4 w-4" />
            Ana está monitorando 27 conversas em segundo plano
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Comparativo: IA vs. Humano" hint="Últimos 30 dias" />
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Leads trabalhados", ia: 128, humano: 42 },
            { label: "Tempo médio 1ª resposta", ia: "2 min", humano: "1h 20 min" },
            { label: "Taxa de qualificação", ia: "38%", humano: "45%" },
            { label: "Ticket médio fechado", ia: formatBRL(41000), humano: formatBRL(87500) },
          ].map((m) => (
            <div key={m.label} className="rounded-md border border-border-card p-3">
              <div className="text-[11px] text-text-ter">{m.label}</div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <div className="text-[10px] text-ia font-semibold">🤖 Ana</div>
                  <div className="text-[15px] font-semibold text-text-title">{m.ia}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-primary font-semibold">👤 Humano</div>
                  <div className="text-[15px] font-semibold text-text-title">{m.humano}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
