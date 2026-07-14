import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Plus, Send, CheckCircle2, Clock, XCircle, Sparkles, Download } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { formatBRL } from "@/lib/leads-data";
import { generateOrcamentoPDF } from "@/lib/exports";

export const Route = createFileRoute("/_authenticated/orcamentos")({ component: Orcamentos });

type Status = "rascunho" | "enviado" | "visualizado" | "aprovado" | "recusado";
type Orc = {
  id: string;
  cliente: string;
  itens: number;
  valor: number;
  emissao: string;
  validade: string;
  status: Status;
  origem: "Ana" | "Humano";
  vendedor: string;
};

const ORCS: Orc[] = [
  { id: "ORC-882", cliente: "Indústria Vitalux", itens: 3, valor: 56000, emissao: "Hoje 08:40", validade: "18/07/2026", status: "visualizado", origem: "Ana", vendedor: "Ana (IA)" },
  { id: "ORC-881", cliente: "Metalúrgica São Jorge", itens: 5, valor: 84000, emissao: "Hoje 10:15", validade: "18/07/2026", status: "enviado", origem: "Ana", vendedor: "Ana (IA)" },
  { id: "ORC-880", cliente: "AutoParts Brasil", itens: 2, valor: 67500, emissao: "Ontem", validade: "17/07/2026", status: "aprovado", origem: "Humano", vendedor: "Diego" },
  { id: "ORC-879", cliente: "NorthTrade Importadora", itens: 8, valor: 145000, emissao: "Ontem", validade: "17/07/2026", status: "visualizado", origem: "Humano", vendedor: "Fabrício" },
  { id: "ORC-878", cliente: "TechFix Componentes", itens: 4, valor: 32500, emissao: "3 dias atrás", validade: "15/07/2026", status: "rascunho", origem: "Humano", vendedor: "Camila" },
  { id: "ORC-877", cliente: "Móveis Aurora", itens: 2, valor: 22000, emissao: "1 semana atrás", validade: "12/07/2026", status: "recusado", origem: "Ana", vendedor: "Ana (IA)" },
];

const STATUS_META: Record<Status, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  rascunho: { label: "Rascunho", cls: "bg-bg-general text-text-sec", icon: FileText },
  enviado: { label: "Enviado", cls: "bg-cold-bg text-cold", icon: Send },
  visualizado: { label: "Visualizado", cls: "bg-warm-bg text-warm", icon: Clock },
  aprovado: { label: "Aprovado", cls: "bg-success-bg text-success", icon: CheckCircle2 },
  recusado: { label: "Recusado", cls: "bg-error-bg text-error", icon: XCircle },
};

function Orcamentos() {
  const [tab, setTab] = useState<"todos" | Status>("todos");
  const [creating, setCreating] = useState(false);

  const rows = tab === "todos" ? ORCS : ORCS.filter((o) => o.status === tab);

  const totals = {
    total: ORCS.reduce((a, o) => a + o.valor, 0),
    aprovado: ORCS.filter((o) => o.status === "aprovado").reduce((a, o) => a + o.valor, 0),
    ana: ORCS.filter((o) => o.origem === "Ana").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="text-[11px] uppercase text-text-ter">Total emitido</div>
          <div className="text-[22px] font-semibold text-text-title">{formatBRL(totals.total)}</div>
          <div className="text-[11px] text-text-sec">{ORCS.length} orçamentos</div>
        </Card>
        <Card>
          <div className="text-[11px] uppercase text-text-ter">Aprovado</div>
          <div className="text-[22px] font-semibold text-success">{formatBRL(totals.aprovado)}</div>
          <div className="text-[11px] text-text-sec">Taxa de conversão 33%</div>
        </Card>
        <Card>
          <div className="text-[11px] uppercase text-text-ter">Gerado pela Ana</div>
          <div className="text-[22px] font-semibold text-ia">{totals.ana}</div>
          <div className="text-[11px] text-text-sec">de {ORCS.length} orçamentos</div>
        </Card>
        <Card className="!bg-ia !text-white">
          <div className="flex items-center gap-2 text-[12px] opacity-90"><Sparkles className="h-4 w-4" /> Sugestão da Ana</div>
          <div className="mt-1 text-[13px] leading-snug">"3 orçamentos visualizados sem resposta há +24h. Quer que eu faça o follow-up?"</div>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-md bg-bg-card p-1 border border-border-card">
          {(["todos", "rascunho", "enviado", "visualizado", "aprovado", "recusado"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 text-[12px] font-medium ${tab === t ? "bg-primary text-primary-foreground" : "text-text-sec hover:bg-bg-general"}`}
            >
              {t === "todos" ? "Todos" : STATUS_META[t].label}
            </button>
          ))}
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover">
          <Plus className="h-3.5 w-3.5" /> Novo orçamento
        </button>
      </div>

      <Card padded={false}>
        <table className="w-full text-[13px]">
          <thead className="border-b border-border-card bg-bg-general/50">
            <tr className="text-left text-[11px] uppercase text-text-ter">
              <th className="p-3">Nº</th>
              <th className="p-3">Cliente</th>
              <th className="p-3">Itens</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Emissão</th>
              <th className="p-3">Validade</th>
              <th className="p-3">Origem</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-card">
            {rows.map((o) => {
              const m = STATUS_META[o.status];
              const Icon = m.icon;
              return (
                <tr key={o.id} className="hover:bg-bg-general/40">
                  <td className="p-3 font-mono text-[12px] text-text-title">{o.id}</td>
                  <td className="p-3 font-medium text-text-title">{o.cliente}</td>
                  <td className="p-3 text-text-body">{o.itens}</td>
                  <td className="p-3 font-medium text-text-title">{formatBRL(o.valor)}</td>
                  <td className="p-3 text-text-body">{o.emissao}</td>
                  <td className="p-3 text-text-body">{o.validade}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${o.origem === "Ana" ? "bg-ia-bg text-ia" : "bg-primary/10 text-primary"}`}>
                      {o.origem === "Ana" ? "🤖" : "👤"} {o.vendedor}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${m.cls}`}>
                      <Icon className="h-3 w-3" /> {m.label}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => generateOrcamentoPDF(o)}
                      className="inline-flex items-center gap-1 rounded-md border border-border-card bg-bg-card px-2 py-1 text-[11px] font-medium text-text-body hover:bg-primary hover:text-primary-foreground hover:border-primary"
                      title="Baixar PDF"
                    >
                      <Download className="h-3 w-3" /> PDF
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setCreating(false)}>
          <div className="w-[560px] rounded-lg bg-bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <SectionTitle title="Novo orçamento" hint="Preencha os dados básicos" />
            <div className="space-y-3">
              <Input label="Cliente" placeholder="Escolha um lead..." />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Validade" type="date" />
                <Input label="Prazo de entrega" placeholder="Ex: 15 dias úteis" />
              </div>
              <Input label="Observações" placeholder="Condições comerciais, garantias..." />
              <div className="rounded-md border border-ia/30 bg-ia-bg p-3 text-[12px] text-text-body">
                <div className="flex items-center gap-2 font-semibold text-ia"><Sparkles className="h-3.5 w-3.5" /> Ana pode preencher para você</div>
                <p className="mt-1">Com base no histórico do lead e do seu catálogo, a Ana sugere: 3 itens · R$ 42.500 · validade 15 dias.</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="rounded-md border border-border-card px-3 py-2 text-[12px] text-text-body hover:bg-bg-general">Cancelar</button>
              <button onClick={() => setCreating(false)} className="rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover">Criar orçamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase text-text-ter">{label}</div>
      <input {...props} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary" />
    </div>
  );
}
