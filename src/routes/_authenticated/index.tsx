/* Execute esta instrucao no projeto: Analise os anexos enviados. */
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
      <div>
        <h1 className="text-2xl font-bold text-text-title">Dashboard</h1>
        <p className="text-sm text-text-sec">Bem-vindo de volta! Aqui está o resumo da sua prospecção.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Leads Encontrados"
          value="1.247"
          delta="+12%"
          tone="primary"
        />
        <StatCard
          icon={<Bot className="h-5 w-5" />}
          label="Leads Abordados"
          value="856"
          delta="+8%"
          tone="hot"
        />
        <StatCard
          icon={<ShoppingCart className="h-5 w-5" />}
          label="Convertidos"
          value="187"
          delta="+15%"
          tone="success"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Leads Qualificados"
          value="423"
          delta="+18%"
          tone="ia"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-text-title">Evolução de Leads</h2>
              <select className="text-[11px] border border-border-card rounded bg-bg-general px-2 py-1 outline-none">
                <option>Últimos 6 meses</option>
              </select>
            </div>
            
            <div className="space-y-4">
              {[
                { m: 'Jan', v: 180, p: '70%' },
                { m: 'Fev', v: 210, p: '82%' },
                { m: 'Mar', v: 195, p: '76%' },
                { m: 'Abr', v: 240, p: '93%' },
                { m: 'Mai', v: 260, p: '100%' },
                { m: 'Jun', v: 247, p: '96%' }
              ].map((item) => (
                <div key={item.m} className="flex items-center gap-4">
                  <div className="w-8 text-[11px] text-text-ter">{item.m}</div>
                  <div className="flex-1 h-6 bg-bg-general rounded-sm overflow-hidden relative">
                    <div 
                      className="h-full bg-primary transition-all duration-500" 
                      style={{ width: item.p }}
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">
                      {item.v}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-6">
              <div className="flex items-center gap-2 text-[10px] text-text-sec">
                <span className="h-2 w-2 rounded-full bg-primary" /> Encontrados
              </div>
              <div className="flex items-center gap-2 text-[10px] text-text-sec">
                <span className="h-2 w-2 rounded-full bg-hot" /> Abordados
              </div>
              <div className="flex items-center gap-2 text-[10px] text-text-sec">
                <span className="h-2 w-2 rounded-full bg-success" /> Convertidos
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-sm font-bold text-text-title mb-6">Indicadores</h2>
          <div className="space-y-8">
            <Indicator label="Taxa de Resposta" value="68.6%" color="bg-primary" />
            <Indicator label="Taxa de Fechamento" value="44.2%" color="bg-hot" />
            <Indicator label="Taxa de Qualificação" color="bg-primary" value="49.4%" />
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="p-4 border-b border-border-card flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-title">Leads Recentes</h2>
          <button className="text-[11px] text-primary font-medium hover:underline">Ver todos</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-bg-general/50 text-text-ter uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3 font-semibold">Lead</th>
                <th className="px-4 py-3 font-semibold">Empresa</th>
                <th className="px-4 py-3 font-semibold">Cidade</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-card">
              <tr className="text-text-body">
                <td className="px-4 py-3">João Silva</td>
                <td className="px-4 py-3">Empresa A</td>
                <td className="px-4 py-3">São Paulo</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full bg-success-bg text-success text-[10px] font-medium">Novo</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Indicator({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-text-body">{label}</span>
        <span className="font-bold text-text-title">{value}</span>
      </div>
      <div className="h-2 w-full bg-bg-general rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: value }} />
      </div>
    </div>
  );
}

import { StatCard } from "@/components/ui-kit";

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
