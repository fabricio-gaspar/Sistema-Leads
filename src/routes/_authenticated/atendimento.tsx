import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Sparkles, User, Phone, Mail } from "lucide-react";
import { Card, TempBadge } from "@/components/ui-kit";
import { useLeads } from "@/hooks/use-leads-store";

export const Route = createFileRoute("/atendimento")({ component: Atendimento });

function Atendimento() {
  const leads = useLeads().filter((l) => l.chat.length > 0 || ["contatado", "qualificado", "proposta", "negociacao"].includes(l.stage));
  const [filter, setFilter] = useState<"todos" | "ana" | "humano" | "pendente">("todos");
  const [selectedId, setSelectedId] = useState<string | null>(leads[0]?.id ?? null);

  const filtered = leads.filter((l) => {
    if (filter === "ana") return l.responsavel.startsWith("Ana");
    if (filter === "humano") return !l.responsavel.startsWith("Ana");
    if (filter === "pendente") return l.paradoHa >= 1;
    return true;
  });
  const current = leads.find((l) => l.id === selectedId) ?? filtered[0];

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "340px 1fr" }}>
      <Card padded={false} className="overflow-hidden">
        <div className="border-b border-border-card p-3">
          <div className="flex h-9 items-center gap-2 rounded-md border border-border-card px-3">
            <Search className="h-3.5 w-3.5 text-text-ter" />
            <input placeholder="Buscar conversa..." className="flex-1 bg-transparent text-[13px] outline-none" />
          </div>
          <div className="mt-2 flex gap-1">
            {[
              ["todos", "Todos"],
              ["ana", "🤖 Ana"],
              ["humano", "👤 Humano"],
              ["pendente", "Pendentes"],
            ].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setFilter(k as never)}
                className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium ${
                  filter === k ? "bg-primary text-primary-foreground" : "text-text-sec hover:bg-bg-general"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <ul className="max-h-[calc(100vh-220px)] overflow-y-auto">
          {filtered.map((l) => {
            const isAI = l.responsavel.startsWith("Ana");
            const last = l.chat[l.chat.length - 1];
            return (
              <li key={l.id}>
                <button
                  onClick={() => setSelectedId(l.id)}
                  className={`w-full border-b border-border-card p-3 text-left hover:bg-bg-general ${
                    current?.id === l.id ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-text-title">{l.empresa}</div>
                      <div className="truncate text-[11.5px] text-text-sec">{l.contato}</div>
                    </div>
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${isAI ? "bg-ia-bg text-ia" : "bg-primary/10 text-primary"}`}>
                      {isAI ? "🤖" : "👤"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <TempBadge t={l.temperatura} />
                    <span className="text-[11px] text-text-ter">{l.ultimaInteracao}</span>
                  </div>
                  {last && (
                    <div className="mt-1.5 truncate text-[12px] text-text-body">
                      {last.from === "ana" ? "🤖 " : last.from === "vendedor" ? "👤 " : ""}
                      {last.text}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {current ? (
        <Card padded={false} className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-card p-4">
            <div>
              <div className="text-[15px] font-semibold text-text-title">{current.empresa}</div>
              <div className="text-[12px] text-text-sec">{current.contato} · {current.cargo}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${current.responsavel.startsWith("Ana") ? "bg-ia-bg text-ia" : "bg-primary/10 text-primary"}`}>
                {current.responsavel.startsWith("Ana") ? <Sparkles className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {current.responsavel}
              </span>
              <button className="rounded-md border border-border-card p-2 hover:bg-bg-general" title="Ligar">
                <Phone className="h-3.5 w-3.5 text-text-sec" />
              </button>
              <button className="rounded-md border border-border-card p-2 hover:bg-bg-general" title="E-mail">
                <Mail className="h-3.5 w-3.5 text-text-sec" />
              </button>
              <Link to="/leads/$id" params={{ id: current.id }} className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover">
                Abrir lead
              </Link>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-bg-general p-6">
            {current.chat.length === 0 && (
              <div className="rounded-md bg-bg-card p-4 text-center text-[12px] text-text-sec">
                Nenhuma mensagem ainda.
              </div>
            )}
            {current.chat.map((m) => {
              const mine = m.from !== "lead";
              const isAI = m.from === "ana";
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 text-[13px] shadow-sm ${
                    mine
                      ? isAI
                        ? "bg-ia text-white rounded-br-sm"
                        : "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-bg-card text-text-title rounded-bl-sm border border-border-card"
                  }`}>
                    {mine && (
                      <div className="mb-0.5 text-[10px] opacity-80">
                        {isAI ? "🤖 Ana" : "👤 " + current.responsavel}
                      </div>
                    )}
                    {m.text}
                    <div className={`mt-0.5 text-right text-[10px] ${mine ? "opacity-70" : "text-text-ter"}`}>{m.at}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border-card p-3">
            <div className="flex gap-2">
              <input
                placeholder="Digite uma mensagem..."
                className="flex-1 h-10 rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none"
              />
              <button className="rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary-hover">
                Enviar
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-ia">
              <Sparkles className="h-3 w-3" /> Ana sugere: "Ótimo! Posso enviar a proposta ainda hoje?"
            </div>
          </div>
        </Card>
      ) : (
        <Card>Selecione uma conversa</Card>
      )}
    </div>
  );
}
