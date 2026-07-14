import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, MessagesSquare, FileText, ShoppingCart, TrendingUp, Bot } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Users} label="Leads ativos" value="—" hint="Conecte para carregar" />
        <StatCard icon={MessagesSquare} label="Conversas hoje" value="—" hint="Aguardando dados" />
        <StatCard icon={FileText} label="Propostas abertas" value="—" hint="Aguardando dados" />
        <StatCard icon={ShoppingCart} label="Pedidos do mês" value="—" hint="Aguardando dados" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Card>
            <SectionTitle
              title="Bem-vindo ao WF Digital CRM"
              hint="Comece cadastrando leads e configurando sua empresa"
            />
            <div className="grid grid-cols-2 gap-3">
              <QuickLink to="/empresa" icon={TrendingUp} label="Configurar empresa" />
              <QuickLink to="/leads" icon={Users} label="Ver leads" />
              <QuickLink to="/prospeccao" icon={Bot} label="Prospecção com Ana" />
              <QuickLink to="/configuracoes" icon={FileText} label="Configurações" />
            </div>
          </Card>
        </div>
        <Card>
          <SectionTitle title="Ana (IA)" hint="Status do cérebro conversacional" />
          <div className="space-y-2 text-[13px] text-text-body">
            <div className="flex justify-between">
              <span className="text-text-sec">Modelo</span>
              <span className="font-medium text-text-title">Claude Sonnet 4.5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-sec">Endpoint</span>
              <span className="font-medium text-success">/api/ana</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-sec">Chave API</span>
              <span className="font-medium text-success">Configurada</span>
            </div>
          </div>
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
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-text-ter">{label}</div>
          <div className="mt-1 text-2xl font-semibold text-text-title">{value}</div>
          {hint && <div className="mt-1 text-[11px] text-text-ter">{hint}</div>}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-light text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof Users;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-md border border-border-card bg-bg-general px-3 py-3 text-[13px] text-text-body hover:border-primary hover:text-primary"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
