import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, MessagesSquare, FileText, ShoppingCart, TrendingUp, Bot, Flame, Loader2 } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { formatBRL } from "@/lib/leads-data";
import { getDashboardStats } from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => fn() });

  const val = (v?: number) => (v == null ? "—" : String(v));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Leads ativos"
          value={val(data?.leadsActive)}
          hint={data ? `${data.leadsHot} quentes · ${data.leadsStale} parados` : "carregando..."}
        />
        <StatCard
          icon={MessagesSquare}
          label="Conversas hoje"
          value={val(data?.messagesToday)}
          hint={data ? `${data.messagesAnaToday} da Ana` : ""}
        />
        <StatCard
          icon={FileText}
          label="Propostas abertas"
          value={val(data?.proposalsOpen)}
          hint={data ? formatBRL(data.proposalsValue) : ""}
        />
        <StatCard
          icon={ShoppingCart}
          label="Pedidos do mês"
          value={val(data?.ordersMonthCount)}
          hint={data ? formatBRL(data.ordersMonthValue) : ""}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Card>
            <SectionTitle
              title="Pipeline"
              hint={data ? `${formatBRL(data.pipelineValue)} em oportunidades ativas` : ""}
            />
            {isLoading ? (
              <div className="flex h-40 items-center justify-center text-text-sec">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <QuickLink to="/leads" icon={Users} label="Ver todos os leads" />
                <QuickLink to="/prospeccao" icon={Bot} label="Prospecção com Ana" />
                <QuickLink to="/atendimento" icon={MessagesSquare} label="Atendimento" />
                <QuickLink to="/orcamentos" icon={FileText} label="Orçamentos" />
                <QuickLink to="/pedidos" icon={ShoppingCart} label="Pedidos" />
                <QuickLink to="/relatorios" icon={TrendingUp} label="Relatórios" />
              </div>
            )}
          </Card>
        </div>

        <Card>
          <SectionTitle title="Destaques" />
          <ul className="space-y-3 text-[13px]">
            <li className="flex items-center gap-2 text-text-body">
              <Flame className="h-4 w-4 text-hot" /> {data?.leadsHot ?? 0} leads quentes
            </li>
            <li className="flex items-center gap-2 text-text-body">
              <Bot className="h-4 w-4 text-ia" /> Ana respondeu {data?.messagesAnaToday ?? 0} conversas hoje
            </li>
            <li className="flex items-center gap-2 text-text-body">
              <FileText className="h-4 w-4 text-primary" /> {data?.proposalsOpen ?? 0} propostas em aberto
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase text-text-ter">{label}</div>
        <Icon className="h-4 w-4 text-text-sec" />
      </div>
      <div className="mt-1 text-[24px] font-semibold text-text-title">{value}</div>
      {hint && <div className="text-[11px] text-text-sec">{hint}</div>}
    </Card>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-md border border-border-card px-3 py-2 text-[13px] text-text-body hover:bg-bg-general"
    >
      <Icon className="h-4 w-4 text-primary" /> {label}
    </Link>
  );
}
