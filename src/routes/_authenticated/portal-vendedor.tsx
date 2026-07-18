import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  MessageCircle,
  Phone,
  Loader2,
  Users,
  FileText,
  BarChart3,
  Send,
  LogOut,
  Sparkles,
  User as UserIcon,
  Search,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import {
  listLeads,
  listLeadMessages,
  createLeadMessage,
  listProposals,
} from "@/lib/crm.functions";
import { formatBRL } from "@/lib/leads-data";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type MsgRow = Database["public"]["Tables"]["lead_messages"]["Row"];
type ProposalRow = Database["public"]["Tables"]["proposals"]["Row"];

type Tab = "conversas" | "leads" | "orcamentos" | "desempenho";

export const Route = createFileRoute("/_authenticated/portal-vendedor")({
  component: PortalVendedor,
});

function PortalVendedor() {
  const [me, setMe] = useState<string | null>(null);
  const [meEmail, setMeEmail] = useState<string>("");
  const [tab, setTab] = useState<Tab>("conversas");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setMe(data.user?.id ?? null);
      setMeEmail(data.user?.email ?? "");
    });
  }, []);

  const leadsFn = useServerFn(listLeads);
  const proposalsFn = useServerFn(listProposals);

  const { data: leads = [], isLoading: leadsLoading } = useQuery<LeadRow[]>({
    queryKey: ["leads"],
    queryFn: () => leadsFn(),
  });
  const { data: proposals = [] } = useQuery<ProposalRow[]>({
    queryKey: ["proposals"],
    queryFn: () => proposalsFn(),
  });

  const meusLeads = useMemo(
    () =>
      leads.filter(
        (l) =>
          l.owner === "human" &&
          (!me || l.assigned_to === me || !l.assigned_to) &&
          l.stage !== "Fechado" &&
          l.stage !== "Perdido",
      ),
    [leads, me],
  );

  const meusOrcamentos = useMemo(
    () => proposals.filter((p) => !me || p.owner_id === me),
    [proposals, me],
  );

  // Métricas
  const fechados = leads.filter(
    (l) => l.stage === "Fechado" && (!me || l.assigned_to === me),
  );
  const perdidos = leads.filter(
    (l) => l.stage === "Perdido" && (!me || l.assigned_to === me),
  );
  const receita = fechados.reduce((sum, l) => sum + Number(l.value || 0), 0);
  const taxaConversao =
    meusLeads.length + fechados.length + perdidos.length > 0
      ? Math.round(
          (fechados.length / (meusLeads.length + fechados.length + perdidos.length)) * 100,
        )
      : 0;

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-bg-general">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-primary px-4 pb-4 pt-5 text-primary-foreground shadow-md">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[11px] opacity-80">Portal do Vendedor</div>
            <div className="truncate text-[15px] font-semibold">{meEmail || "Vendedor"}</div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
          <MiniStat label="Leads" value={meusLeads.length} />
          <MiniStat label="Prop." value={meusOrcamentos.length} />
          <MiniStat label="Fech." value={fechados.length} />
          <MiniStat label="Conv." value={`${taxaConversao}%`} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {tab === "conversas" && (
          selectedLead ? (
            <ConversationView
              lead={selectedLead}
              meEmail={meEmail}
              onBack={() => setSelectedLeadId(null)}
            />
          ) : (
            <ConversasList
              leads={meusLeads}
              loading={leadsLoading}
              onOpen={(id) => setSelectedLeadId(id)}
            />
          )
        )}
        {tab === "leads" && <MeusLeadsList leads={meusLeads} loading={leadsLoading} />}
        {tab === "orcamentos" && <MeusOrcamentosList proposals={meusOrcamentos} />}
        {tab === "desempenho" && (
          <DesempenhoTab
            fechados={fechados.length}
            perdidos={perdidos.length}
            ativos={meusLeads.length}
            receita={receita}
            taxa={taxaConversao}
            propostas={meusOrcamentos.length}
          />
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-border-card bg-bg-card">
        <div className="grid grid-cols-4">
          <TabButton
            active={tab === "conversas"}
            onClick={() => {
              setTab("conversas");
              setSelectedLeadId(null);
            }}
            icon={<MessageCircle className="h-5 w-5" />}
            label="Conversas"
          />
          <TabButton
            active={tab === "leads"}
            onClick={() => setTab("leads")}
            icon={<Users className="h-5 w-5" />}
            label="Leads"
          />
          <TabButton
            active={tab === "orcamentos"}
            onClick={() => setTab("orcamentos")}
            icon={<FileText className="h-5 w-5" />}
            label="Orçamentos"
          />
          <TabButton
            active={tab === "desempenho"}
            onClick={() => setTab("desempenho")}
            icon={<BarChart3 className="h-5 w-5" />}
            label="Desempenho"
          />
        </div>
      </nav>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-white/10 py-2">
      <div className="text-[15px] font-semibold leading-tight">{value}</div>
      <div className="text-[10px] opacity-80">{label}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors ${
        active ? "text-primary" : "text-text-ter"
      }`}
    >
      {icon}
      <span className={active ? "font-semibold" : ""}>{label}</span>
    </button>
  );
}

/* ============= Conversas ============= */

function ConversasList({
  leads,
  loading,
  onOpen,
}: {
  leads: LeadRow[];
  loading: boolean;
  onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = leads.filter((l) =>
    !q.trim() || l.company.toLowerCase().includes(q.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex justify-center p-8 text-text-sec">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  return (
    <div className="p-3">
      <div className="mb-3 flex h-10 items-center gap-2 rounded-lg bg-bg-card px-3">
        <Search className="h-4 w-4 text-text-ter" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar conversa..."
          className="flex-1 bg-transparent text-[13px] outline-none"
        />
      </div>
      {filtered.length === 0 && (
        <div className="rounded-lg bg-bg-card p-6 text-center text-[12px] text-text-sec">
          Nenhuma conversa disponível.
        </div>
      )}
      <ul className="space-y-1.5">
        {filtered.map((l) => {
          const waiting = waitingMinutes(l.last_contact);
          return (
            <li key={l.id}>
              <button
                onClick={() => onOpen(l.id)}
                className="w-full rounded-lg bg-bg-card p-3 text-left active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-text-title">
                      {l.company}
                    </div>
                    <div className="truncate text-[11px] text-text-sec">
                      {l.contact ?? "—"} · {l.stage}
                    </div>
                  </div>
                  {waiting != null && waiting > 0 && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        waiting > 60
                          ? "bg-hot-bg text-hot"
                          : waiting > 15
                            ? "bg-warm-bg text-warm"
                            : "bg-cold-bg text-cold"
                      }`}
                    >
                      {waiting < 60 ? `${waiting}min` : `${Math.floor(waiting / 60)}h`}
                    </span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ConversationView({
  lead,
  meEmail,
  onBack,
}: {
  lead: LeadRow;
  meEmail: string;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const msgsFn = useServerFn(listLeadMessages);
  const sendFn = useServerFn(createLeadMessage);
  const [text, setText] = useState("");

  const { data: messages = [] } = useQuery<MsgRow[]>({
    queryKey: ["lead-messages", lead.id],
    queryFn: () => msgsFn({ data: { lead_id: lead.id } }),
    refetchInterval: 15_000,
  });

  const sendMut = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          lead_id: lead.id,
          sender: "human",
          sender_name: meEmail || "Vendedor",
          type: "chat" as never,
          text: text.trim(),
        },
      }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["lead-messages", lead.id] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const wa = waLink(lead.phone);

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col">
      <div className="flex items-center gap-3 border-b border-border-card bg-bg-card px-3 py-2.5">
        <button onClick={onBack} className="rounded-md p-1.5 hover:bg-bg-general">
          <ArrowLeft className="h-4 w-4 text-text-sec" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-text-title">
            {lead.company}
          </div>
          <div className="truncate text-[11px] text-text-sec">
            {lead.contact ?? "—"} · {lead.stage}
          </div>
        </div>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-white"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        )}
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white"
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-bg-general p-3">
        {messages.length === 0 && (
          <div className="rounded-md bg-bg-card p-4 text-center text-[12px] text-text-sec">
            Nenhuma mensagem ainda.
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender !== "client";
          const isMsgAI = m.sender === "ia";
          const time = new Date(m.sent_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-[13px] shadow-sm ${
                  mine
                    ? isMsgAI
                      ? "bg-ia text-white rounded-br-sm"
                      : "bg-primary text-white rounded-br-sm"
                    : "bg-bg-card text-text-title rounded-bl-sm border border-border-card"
                }`}
              >
                {mine && (
                  <div className="mb-0.5 text-[10px] opacity-80">
                    {isMsgAI ? <Sparkles className="inline h-3 w-3" /> : <UserIcon className="inline h-3 w-3" />} {m.sender_name}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.text}</div>
                <div className={`mt-0.5 text-right text-[10px] ${mine ? "opacity-70" : "text-text-ter"}`}>
                  {time}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form
        className="flex gap-2 border-t border-border-card bg-bg-card p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim() && !sendMut.isPending) sendMut.mutate();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Digite sua mensagem..."
          className="h-10 flex-1 rounded-full border border-border-card bg-bg-general px-4 text-[13px] outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!text.trim() || sendMut.isPending}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
        >
          {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}

/* ============= Meus Leads ============= */

function MeusLeadsList({ leads, loading }: { leads: LeadRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex justify-center p-8 text-text-sec">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (leads.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-bg-card p-6 text-center text-[12px] text-text-sec">
          Nenhum lead atribuído a você ainda.
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2 p-3">
      {leads.map((l) => {
        const wa = waLink(l.phone);
        return (
          <Link
            key={l.id}
            to="/leads/$id"
            params={{ id: l.id }}
            className="block rounded-lg bg-bg-card p-3 shadow-sm active:scale-[0.98] transition-transform"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-text-title">
                  {l.company}
                </div>
                <div className="truncate text-[11px] text-text-sec">
                  {l.contact ?? "—"} · {l.uf ?? ""} · {l.stage}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  l.temp === "hot"
                    ? "bg-hot-bg text-hot"
                    : l.temp === "warm"
                      ? "bg-warm-bg text-warm"
                      : "bg-cold-bg text-cold"
                }`}
              >
                {l.score}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-[13px] font-semibold text-primary">
                {formatBRL(Number(l.value || 0))}
              </div>
              <div className="flex gap-1">
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-white"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </a>
                )}
                {l.phone && (
                  <a
                    href={`tel:${l.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                )}
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-general text-text-sec">
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ============= Meus Orçamentos ============= */

function MeusOrcamentosList({ proposals }: { proposals: ProposalRow[] }) {
  if (proposals.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-bg-card p-6 text-center text-[12px] text-text-sec">
          Você ainda não possui orçamentos.
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2 p-3">
      {proposals.map((p) => (
        <Link
          key={p.id}
          to="/orcamentos"
          className="block rounded-lg bg-bg-card p-3 shadow-sm active:scale-[0.98] transition-transform"
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[11px] text-text-ter">{p.number}</div>
              <div className="mt-0.5 truncate text-[13px] font-semibold text-text-title">
                {p.client}
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(p.status)}`}
            >
              {p.status}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="text-[13px] font-semibold text-primary">
              {formatBRL(Number(p.total || 0))}
            </div>
            <div className="text-[10px] text-text-ter">
              {new Date(p.created_at).toLocaleDateString("pt-BR")}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    Rascunho: "bg-bg-general text-text-sec",
    Enviada: "bg-primary/10 text-primary",
    Aprovada: "bg-success-bg text-success",
    Rejeitada: "bg-error-bg text-error",
  };
  return map[s] ?? "bg-bg-general text-text-sec";
}

/* ============= Desempenho ============= */

function DesempenhoTab({
  fechados,
  perdidos,
  ativos,
  receita,
  taxa,
  propostas,
}: {
  fechados: number;
  perdidos: number;
  ativos: number;
  receita: number;
  taxa: number;
  propostas: number;
}) {
  return (
    <div className="space-y-3 p-3">
      <div className="rounded-lg bg-gradient-to-br from-primary to-primary/80 p-5 text-white">
        <div className="text-[11px] opacity-80">Receita fechada</div>
        <div className="mt-1 text-[24px] font-bold">{formatBRL(receita)}</div>
        <div className="mt-2 text-[11px] opacity-90">
          {fechados} negócio{fechados === 1 ? "" : "s"} fechado{fechados === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Leads ativos" value={ativos} accent="bg-primary/10 text-primary" />
        <StatCard
          label="Taxa de conversão"
          value={`${taxa}%`}
          accent="bg-success-bg text-success"
        />
        <StatCard label="Propostas" value={propostas} accent="bg-warm-bg text-warm" />
        <StatCard label="Perdidos" value={perdidos} accent="bg-error-bg text-error" />
      </div>

      <div className="rounded-lg bg-bg-card p-4">
        <div className="mb-2 text-[13px] font-semibold text-text-title">Funil</div>
        <FunnelBar label="Ativos" value={ativos} max={Math.max(ativos, fechados, perdidos, 1)} color="bg-primary" />
        <FunnelBar
          label="Propostas"
          value={propostas}
          max={Math.max(ativos, fechados, perdidos, 1)}
          color="bg-warm"
        />
        <FunnelBar label="Fechados" value={fechados} max={Math.max(ativos, fechados, perdidos, 1)} color="bg-success" />
        <FunnelBar label="Perdidos" value={perdidos} max={Math.max(ativos, fechados, perdidos, 1)} color="bg-error" />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="rounded-lg bg-bg-card p-3">
      <div className="text-[11px] text-text-sec">{label}</div>
      <div className={`mt-1 inline-block rounded px-2 py-0.5 text-[16px] font-bold ${accent}`}>
        {value}
      </div>
    </div>
  );
}

function FunnelBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-text-sec">{label}</span>
        <span className="font-semibold text-text-title">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg-general">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ============= Utils ============= */

function waLink(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

function waitingMinutes(lastContact: string | null | undefined): number | null {
  if (!lastContact) return null;
  const d = new Date(lastContact).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / 60000);
}
