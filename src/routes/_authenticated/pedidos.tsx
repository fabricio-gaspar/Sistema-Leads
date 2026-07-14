import { createFileRoute } from "@tanstack/react-router";
import { Package, Truck, CheckCircle2, Factory } from "lucide-react";
import { Card } from "@/components/ui-kit";
import { formatBRL } from "@/lib/leads-data";

export const Route = createFileRoute("/_authenticated/pedidos")({ component: Pedidos });

type Etapa = "producao" | "expedicao" | "entregue";
type Pedido = { id: string; cliente: string; valor: number; itens: number; emissao: string; etapa: Etapa; vendedor: string; origem: "Ana" | "Humano" };

const PEDIDOS: Pedido[] = [
  { id: "PED-441", cliente: "BioPharma Latam", valor: 210000, itens: 12, emissao: "Ontem", etapa: "producao", vendedor: "Fabrício", origem: "Humano" },
  { id: "PED-440", cliente: "AutoParts Brasil", valor: 67500, itens: 6, emissao: "3 dias atrás", etapa: "expedicao", vendedor: "Diego", origem: "Humano" },
  { id: "PED-439", cliente: "Ind. Ferrocampo", valor: 41000, itens: 4, emissao: "1 semana atrás", etapa: "entregue", vendedor: "Ana (IA)", origem: "Ana" },
  { id: "PED-438", cliente: "TechFix Componentes", valor: 32500, itens: 3, emissao: "2 semanas atrás", etapa: "entregue", vendedor: "Camila", origem: "Humano" },
];

const ETAPAS: Record<Etapa, { label: string; cls: string; icon: React.ComponentType<{ className?: string }>; step: number }> = {
  producao: { label: "Em produção", cls: "bg-warm-bg text-warm", icon: Factory, step: 1 },
  expedicao: { label: "Expedição", cls: "bg-cold-bg text-cold", icon: Truck, step: 2 },
  entregue: { label: "Entregue", cls: "bg-success-bg text-success", icon: CheckCircle2, step: 3 },
};

function Pedidos() {
  const total = PEDIDOS.reduce((a, p) => a + p.valor, 0);
  const entregue = PEDIDOS.filter((p) => p.etapa === "entregue").reduce((a, p) => a + p.valor, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="text-[11px] uppercase text-text-ter">Total faturado</div>
          <div className="text-[22px] font-semibold text-text-title">{formatBRL(total)}</div>
          <div className="text-[11px] text-text-sec">{PEDIDOS.length} pedidos ativos</div>
        </Card>
        <Card>
          <div className="text-[11px] uppercase text-text-ter">Entregue</div>
          <div className="text-[22px] font-semibold text-success">{formatBRL(entregue)}</div>
        </Card>
        <Card>
          <div className="text-[11px] uppercase text-text-ter">Em produção</div>
          <div className="text-[22px] font-semibold text-warm">
            {formatBRL(PEDIDOS.filter((p) => p.etapa === "producao").reduce((a, p) => a + p.valor, 0))}
          </div>
        </Card>
      </div>

      <div className="grid gap-3">
        {PEDIDOS.map((p) => {
          const meta = ETAPAS[p.etapa];
          const Icon = meta.icon;
          return (
            <Card key={p.id}>
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-mono text-[12px] text-text-sec">{p.id}</div>
                    <div className="text-[14px] font-semibold text-text-title">{p.cliente}</div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${p.origem === "Ana" ? "bg-ia-bg text-ia" : "bg-primary/10 text-primary"}`}>
                      {p.origem === "Ana" ? "🤖" : "👤"} {p.vendedor}
                    </span>
                  </div>
                  <div className="text-[12px] text-text-sec">{p.itens} itens · Emitido {p.emissao}</div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-semibold text-text-title">{formatBRL(p.valor)}</div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.cls}`}>
                    <Icon className="h-3 w-3" /> {meta.label}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {["Confirmado", "Em produção", "Expedição", "Entregue"].map((s, i) => {
                  const done = i <= meta.step;
                  return (
                    <div key={s} className="flex flex-1 items-center gap-2">
                      <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${done ? "bg-primary text-primary-foreground" : "bg-bg-general text-text-ter"}`}>
                        {i + 1}
                      </div>
                      <div className={`text-[11.5px] ${done ? "text-text-title" : "text-text-ter"}`}>{s}</div>
                      {i < 3 && <div className={`h-0.5 flex-1 ${i < meta.step ? "bg-primary" : "bg-border-card"}`} />}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
