import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, User, Bell, Shield, Zap, Loader2, Check, ClipboardList, AlertCircle, Package, MessageSquareWarning, Gauge, HelpCircle, Plus, Trash2, Plug, Search, SlidersHorizontal } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getCompanySettings,
  updateCompanySettings,
  listTeam,
  setUserRole,
  updateTeamMember,
  inviteTeamMember,
  resendMemberInvite,
  listAuditLogs,
  listServices,
  upsertService,
  deleteService,
  listObjections,
  upsertObjection,
  deleteObjection,
  getScoreWeights,
  updateScoreWeights,
  listUnansweredQuestions,
  resolveUnansweredQuestion,
  deleteUnansweredQuestion,
  listIntegrations,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  disconnectIntegration,
} from "@/lib/crm.functions";
import { reindexAllDocuments, getKnowledgeStats } from "@/lib/knowledge.functions";
import { getOutreachHealth, testZapi } from "@/lib/outreach.functions";
import {
  listSequences,
  getSequenceWithSteps,
  updateSequence,
  upsertSequenceStep,
  deleteSequenceStep,
  type SequenceChannel,
} from "@/lib/outreach-sequences.functions";
import {
  getCommercialPolicy,
  updateCommercialPolicy,
  listOperationalAlerts,
  updateOperationalAlert,
  listDataSubjectRequests,
  upsertDataSubjectRequest,
  listCampaigns,
  upsertCampaign,
} from "@/lib/commercial.functions";


type TabId = "ana" | "prospeccao" | "equipe" | "servicos" | "objecoes" | "score" | "governanca" | "auditoria" | "notificacoes" | "integracoes" | "operacao" | "seguranca";
export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: Configuracoes,
  validateSearch: (s: Record<string, unknown>): { tab?: TabId } => {
    const t = s.tab;
    const valid: TabId[] = ["ana","prospeccao","equipe","servicos","objecoes","score","governanca","auditoria","notificacoes","integracoes","operacao","seguranca"];
    return typeof t === "string" && (valid as string[]).includes(t) ? { tab: t as TabId } : {};
  },
});

const TABS = [
  { id: "ana", label: "Ana (IA)", icon: Sparkles },
  { id: "prospeccao", label: "Prospecção", icon: Search },
  { id: "equipe", label: "Equipe", icon: User },
  { id: "servicos", label: "Serviços", icon: Package },
  { id: "objecoes", label: "Objeções", icon: MessageSquareWarning },
  { id: "score", label: "Score", icon: Gauge },
  { id: "governanca", label: "Governança IA", icon: HelpCircle },
  { id: "auditoria", label: "Auditoria", icon: ClipboardList },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "integracoes", label: "Integrações", icon: Zap },
  { id: "operacao", label: "Operação comercial", icon: SlidersHorizontal },
  { id: "seguranca", label: "Segurança", icon: Shield },
] as const;


function Configuracoes() {
  const search = Route.useSearch();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(search.tab ?? "ana");
  useEffect(() => { if (search.tab && search.tab !== tab) setTab(search.tab); }, [search.tab]);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "220px 1fr" }}>
      <Card padded={false}>
        <ul className="p-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <li key={t.id}>
                <button
                  onClick={() => setTab(t.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] ${active ? "bg-primary text-primary-foreground" : "text-text-body hover:bg-bg-general"}`}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <div>
        {tab === "ana" && <AbaAna />}
        {tab === "prospeccao" && <AbaProspeccao />}
        {tab === "equipe" && <AbaEquipe />}
        {tab === "servicos" && <AbaServicos />}
        {tab === "objecoes" && <AbaObjecoes />}
        {tab === "score" && <AbaScore />}
        {tab === "governanca" && <AbaGovernanca />}
        {tab === "auditoria" && <AbaAuditoria />}
        {tab === "notificacoes" && <AbaNotif />}
        {tab === "integracoes" && <AbaInt />}
        {tab === "operacao" && <AbaOperacao />}
        {tab === "seguranca" && <AbaSeg />}
      </div>
    </div>
  );
}


const DEFAULT_PROMPT = `Você é Ana, assistente comercial virtual da WayFlex Indústria e Comércio.
Apresente a WayFlex como especialista em soluções industriais de borracha, silicone e poliuretano, com foco em perfis de borracha, peças técnicas, vedações especiais, soluções em silicone (inclusive atóxico) e peças em poliuretano, usando apenas informações disponíveis na base oficial da empresa.
Seja profissional, cordial, objetiva e consultiva, respondendo sempre em português do Brasil.

Siga estas regras:
– Responda apenas dúvidas básicas e comprovadas sobre tipos de produtos, materiais, prazos gerais e formas de contato.
– Não negocie preço, desconto, prazo específico, garantia, condição técnica detalhada ou contratos.
– Não confirme especificações técnicas, disponibilidade ou aplicações críticas sem fonte oficial na base de conhecimento.
– Nunca invente produtos, certificações, prazos, garantias, clientes, resultados ou qualquer informação não registrada na base oficial.
– Quando tiver dúvida ou faltar informação, explique que vai encaminhar para um especialista da WayFlex e não tente "completar" com suposições.

Handoff obrigatório:
Se o cliente pedir orçamento, proposta, preço, desconto, contrato, visita, demonstração, ligação, reunião, intenção de compra, ajuda urgente, reclamação, assunto sensível, tirar dúvidas técnicas avançadas ou pedir para falar com uma pessoa, você deve:
– Encerrar sua resposta com uma mensagem cordial informando que vai encaminhar para um vendedor.
– Registrar a intenção do cliente (tipo de pedido, canal, resumo) na ficha do lead.
– Pausar qualquer automação da conversa.
– Criar ou solicitar a criação de uma tarefa de atendimento para um vendedor, com o motivo do handoff.

LGPD e opt-out:
– Sempre respeite o horário comercial definido pelo sistema; fora dele, não faça disparos proativos.
– Se o cliente pedir para não receber mensagens ou cancelar o contato, encerre cordialmente, registre opt-out e não envie novas mensagens.

Estilo de resposta:
– Use frases curtas, claras e diretas, com tom industrial e consultivo.
– Evite jargões em excesso; quando usar termos técnicos, explique de forma simples.
– Não use linguagem exagerada de marketing; foque em qualidade, segurança e adequação industrial como descrito pela WayFlex.`;

function AbaAna() {
  const qc = useQueryClient();
  const getFn = useServerFn(getCompanySettings);
  const updateFn = useServerFn(updateCompanySettings);
  const { data, isLoading } = useQuery({ queryKey: ["company-settings"], queryFn: () => getFn() });

  const [model, setModel] = useState("claude-sonnet-4-5-20250929");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(512);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [tone, setTone] = useState("Profissional cordial");
  const [sandboxMode, setSandboxMode] = useState(false);

  useEffect(() => {
    if (!data) return;
    if (data.ai_model) setModel(data.ai_model);
    if (data.ai_temperature != null) setTemperature(Number(data.ai_temperature));
    if (data.ai_max_tokens != null) setMaxTokens(Number(data.ai_max_tokens));
    if (data.ai_prompt) setPrompt(data.ai_prompt);
    if (data.tone_of_voice) setTone(data.tone_of_voice);
    if (typeof (data as any).sandbox_mode === "boolean") setSandboxMode((data as any).sandbox_mode);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          ai_model: model,
          ai_temperature: temperature,
          ai_max_tokens: maxTokens,
          ai_prompt: prompt,
          tone_of_voice: tone,
          sandbox_mode: sandboxMode,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-settings"] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-text-sec">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando configurações…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="Cérebro conversacional da Ana"
          hint="Modelo, temperatura e prompt aplicados na prospecção autônoma"
          action={
            <button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Salvar
            </button>
          }
        />
        <div className="space-y-4">
          <Field label="Tom de voz">
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="h-9 rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none"
            >
              <option>Profissional cordial</option>
              <option>Consultivo técnico</option>
              <option>Descontraído</option>
            </select>
          </Field>

          <Field label="Modelo de Linguagem" hint="Cérebro conversacional para prospecção autônoma">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-9 w-full max-w-md rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none"
            >
              <optgroup label="Anthropic Claude">
                <option value="claude-opus-4-1-20250805">Claude Opus 4.1 — máxima qualidade</option>
                <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5 — equilíbrio (padrão)</option>
                <option value="claude-haiku-4-5-20250901">Claude Haiku 4.5 — rápido e econômico</option>
              </optgroup>
            </select>
          </Field>

          <div className="grid max-w-md grid-cols-2 gap-4">
            <Field label={`Temperatura — ${temperature.toFixed(2)}`} hint="0 = objetivo, 1 = criativo">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full accent-ia"
              />
            </Field>
            <Field label="Máx. tokens" hint="Tamanho máximo da resposta">
              <input
                type="number"
                min={64}
                max={4096}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none"
              />
            </Field>
          </div>

          <Field label="Prompt do Cérebro Conversacional" hint="Este texto define personalidade, regras comerciais e limites da Ana">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-border-card bg-bg-card p-3 font-mono text-[12px] outline-none focus:border-primary"
            />
            <div className="mt-1 text-[11px] text-text-ter">
              Variáveis disponíveis no runtime: contexto da empresa e do lead são anexados automaticamente.
            </div>
          </Field>

          <div className="rounded-lg border border-border-card bg-bg-card p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sandboxMode}
                onChange={(e) => setSandboxMode(e.target.checked)}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <div>
                <div className="text-[13px] font-semibold text-text-pri">Modo sandbox / teste</div>
                <div className="text-[12px] text-text-sec">
                  Substitui as mensagens geradas pela Ana por templates de teste padrão (WhatsApp, e-mail e roteiro de ligação),
                  deixando claro que é validação do fluxo e oferecendo opt-out. Use enquanto valida integrações; desative para operar em produção.
                </div>
              </div>
            </label>
          </div>
        </div>
      </Card>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = {
  administrador: "Administrador",
  vendedor: "Vendedor",
  sdr: "SDR",
  cx: "Customer Success",
};

function AdminGate({ error, children }: { error: unknown; children: React.ReactNode }) {
  const msg = error instanceof Error ? error.message : "";
  if (msg.includes("administradores")) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-[13px] text-text-sec">
          <AlertCircle className="h-4 w-4 text-warm" />
          Acesso restrito a administradores.
        </div>
      </Card>
    );
  }
  return <>{children}</>;
}

function AbaEquipe() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTeam);
  const setRoleFn = useServerFn(setUserRole);
  const updateFn = useServerFn(updateTeamMember);
  const inviteFn = useServerFn(inviteTeamMember);
  const resetFn = useServerFn(resendMemberInvite);
  const { data, isLoading, error } = useQuery({ queryKey: ["team"], queryFn: () => listFn() });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inv, setInv] = useState({
    email: "",
    name: "",
    role: "vendedor" as "administrador" | "vendedor" | "sdr" | "cx",
    phone: "",
    can_use_ia: true,
    active: true,
  });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const setRoleMut = useMutation({
    mutationFn: (v: { user_id: string; role: "administrador" | "vendedor" | "sdr" | "cx" }) =>
      setRoleFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      toast.success("Perfil atualizado");
    },
    onError: (e: Error) => {
      toast.error("Falha ao alterar perfil", { description: e.message });
      setFlash(`Erro: ${e.message}`);
      setTimeout(() => setFlash(null), 4000);
    },
  });
  const toggleActiveMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      updateFn({ data: { id: v.id, patch: { active: v.active } } }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["team"] });
      toast.success(v.active ? "Usuário reativado" : "Usuário desativado");
    },
    onError: (e: Error) => {
      toast.error("Falha ao alterar status", { description: e.message });
      setFlash(`Erro: ${e.message}`);
      setTimeout(() => setFlash(null), 4000);
    },
  });
  const toggleIaMut = useMutation({
    mutationFn: (v: { id: string; can_use_ia: boolean }) =>
      updateFn({ data: { id: v.id, patch: { can_use_ia: v.can_use_ia } } }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: ["team"] });
      toast.success(v.can_use_ia ? "IA permitida" : "IA bloqueada");
    },
    onError: (e: Error) => {
      toast.error("Falha ao atualizar IA", { description: e.message });
      setFlash(`Erro: ${e.message}`);
      setTimeout(() => setFlash(null), 4000);
    },
  });
  const inviteMut = useMutation({
    mutationFn: () =>
      inviteFn({
        data: {
          email: inv.email.trim().toLowerCase(),
          name: inv.name.trim(),
          role: inv.role,
          phone: inv.phone.trim() || null,
          can_use_ia: inv.can_use_ia,
          active: inv.active,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      setInviteOpen(false);
      setInv({ email: "", name: "", role: "vendedor", phone: "", can_use_ia: true, active: true });
      toast.success("Convite enviado por e-mail");
      setFlash("✔ Convite enviado por e-mail.");
      setTimeout(() => setFlash(null), 3500);
    },
    onError: (e: Error) => {
      setInviteError(e.message);
      toast.error("Falha ao convidar", { description: e.message });
    },
  });
  const resetMut = useMutation({
    mutationFn: (email: string) => resetFn({ data: { email } }),
    onSuccess: () => {
      toast.success("Link de redefinição enviado");
      setFlash("✔ Link de redefinição enviado.");
      setTimeout(() => setFlash(null), 3500);
    },
    onError: (e: Error) => {
      toast.error("Falha ao enviar link", { description: e.message });
      setFlash(`Erro: ${e.message}`);
      setTimeout(() => setFlash(null), 4000);
    },
  });

  // Escape fecha o dialog de convite
  useEffect(() => {
    if (!inviteOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setInviteOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inviteOpen]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-text-sec">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando equipe…
      </div>
    );
  }

  return (
    <AdminGate error={error}>
      <Card>
        <SectionTitle
          title="Equipe"
          hint={`${data?.length ?? 0} usuário(s)`}
          action={
            <button
              onClick={() => { setInviteError(null); setInviteOpen(true); }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
            >
              + Adicionar integrante
            </button>
          }
        />
        {flash && <div className="mb-2 rounded-md bg-primary/5 border border-primary/40 px-3 py-2 text-[12px] text-text-title">{flash}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase text-text-ter">
                <th className="pb-2">Nome</th>
                <th className="pb-2">E-mail</th>
                <th className="pb-2">Perfil</th>
                <th className="pb-2">IA</th>
                <th className="pb-2">Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-card">
              {(data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-[12.5px] text-text-ter">Nenhum integrante cadastrado ainda.</td>
                </tr>
              )}
              {(data ?? []).map((t) => {
                const currentRole = (t.roles?.[0] as string | undefined) ?? "vendedor";
                const rolePending = setRoleMut.isPending && setRoleMut.variables?.user_id === t.id;
                const activePending = toggleActiveMut.isPending && toggleActiveMut.variables?.id === t.id;
                const iaPending = toggleIaMut.isPending && toggleIaMut.variables?.id === t.id;
                const resetPending = resetMut.isPending && resetMut.variables === t.email;
                return (
                  <tr key={t.id}>
                    <td className="py-2.5 font-medium text-text-title">{t.name ?? "—"}</td>
                    <td className="py-2.5 text-text-body">{t.email ?? "—"}</td>
                    <td className="py-2.5">
                      <select
                        value={currentRole}
                        disabled={rolePending}
                        onChange={(e) => {
                          const nextRole = e.target.value as "administrador" | "vendedor" | "sdr" | "cx";
                          if (nextRole === currentRole) return;
                          const willTouchAdmin = currentRole === "administrador" || nextRole === "administrador";
                          const msg = willTouchAdmin
                            ? `Confirmar alteração de perfil de ${t.name ?? t.email} para "${ROLE_LABEL[nextRole] ?? nextRole}"?\n\nMudanças envolvendo administrador impactam o acesso ao sistema.`
                            : `Alterar perfil de ${t.name ?? t.email} para "${ROLE_LABEL[nextRole] ?? nextRole}"?`;
                          if (!confirm(msg)) {
                            // reverte visual: força re-render pela query
                            qc.invalidateQueries({ queryKey: ["team"] });
                            return;
                          }
                          setRoleMut.mutate({ user_id: t.id, role: nextRole });
                        }}
                        className="h-8 rounded-md border border-border-card bg-bg-card px-2 text-[12px] outline-none disabled:opacity-50"
                        aria-label={`Perfil de ${t.name ?? t.email}`}
                      >
                        {Object.entries(ROLE_LABEL).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5">
                      <label className="inline-flex items-center gap-1.5 text-[12px] text-text-body">
                        <input
                          type="checkbox"
                          checked={Boolean(t.can_use_ia)}
                          disabled={iaPending}
                          onChange={(e) => toggleIaMut.mutate({ id: t.id, can_use_ia: e.target.checked })}
                          className="h-3.5 w-3.5 accent-primary disabled:opacity-50"
                          aria-label={`Permitir uso da IA para ${t.name ?? t.email}`}
                        />
                        {t.can_use_ia ? "Permitido" : "Bloqueado"}
                      </label>
                    </td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.active ? "bg-success-bg text-success" : "bg-error-bg text-error"}`}>
                        {t.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right space-x-3 whitespace-nowrap">
                      <button
                        onClick={() => t.email && resetMut.mutate(t.email)}
                        disabled={!t.email || resetPending}
                        className="text-[12px] text-text-sec hover:text-primary disabled:opacity-50"
                      >
                        {resetPending ? "Enviando…" : "Redefinir senha"}
                      </button>
                      <button
                        onClick={() => {
                          const next = !t.active;
                          const msg = next
                            ? `Reativar ${t.name ?? t.email}? O histórico do usuário será preservado.`
                            : `Desativar ${t.name ?? t.email}? O acesso será bloqueado, mas todo o histórico será preservado.`;
                          if (!confirm(msg)) return;
                          toggleActiveMut.mutate({ id: t.id, active: next });
                        }}
                        disabled={activePending}
                        className="text-[12px] text-text-sec hover:text-primary disabled:opacity-50"
                      >
                        {activePending ? "Aguarde…" : t.active ? "Desativar" : "Reativar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setInviteOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            className="w-full max-w-md rounded-xl border border-border-card bg-bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border-card p-4">
              <div>
                <div id="invite-title" className="text-[14px] font-semibold text-text-title">Adicionar integrante</div>
                <div className="text-[11px] text-text-ter">Enviaremos um e-mail para o novo usuário definir a senha.</div>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setInviteOpen(false)}
                className="rounded-md p-1 text-text-ter hover:bg-bg-general hover:text-text-title"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase text-text-ter">E-mail *</span>
                <input type="email" required value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} className="w-full h-9 rounded-md border border-border-card bg-bg-general px-2 text-[13px]" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase text-text-ter">Nome *</span>
                <input required value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} className="w-full h-9 rounded-md border border-border-card bg-bg-general px-2 text-[13px]" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase text-text-ter">Telefone</span>
                <input value={inv.phone} onChange={(e) => setInv({ ...inv, phone: e.target.value })} className="w-full h-9 rounded-md border border-border-card bg-bg-general px-2 text-[13px]" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase text-text-ter">Perfil *</span>
                <select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value as typeof inv.role })} className="w-full h-9 rounded-md border border-border-card bg-bg-general px-2 text-[13px]">
                  {Object.entries(ROLE_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-1.5 text-[12.5px] text-text-body">
                  <input type="checkbox" checked={inv.can_use_ia} onChange={(e) => setInv({ ...inv, can_use_ia: e.target.checked })} className="h-3.5 w-3.5 accent-primary" />
                  Pode usar a IA (Ana)
                </label>
                <label className="inline-flex items-center gap-1.5 text-[12.5px] text-text-body">
                  <input type="checkbox" checked={inv.active} onChange={(e) => setInv({ ...inv, active: e.target.checked })} className="h-3.5 w-3.5 accent-primary" />
                  Usuário ativo
                </label>
              </div>
              {inviteError && <div className="rounded-md bg-error-bg px-3 py-2 text-[12px] text-error">{inviteError}</div>}
            </div>
            <div className="flex justify-end gap-2 border-t border-border-card p-3">
              <button onClick={() => setInviteOpen(false)} className="rounded-md border border-border-card px-3 py-1.5 text-[12px] text-text-body hover:bg-bg-general">Cancelar</button>
              <button
                onClick={() => { setInviteError(null); inviteMut.mutate(); }}
                disabled={!inv.email || !inv.name || inviteMut.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
              >
                {inviteMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Enviar convite
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminGate>
  );
}

function AbaAuditoria() {
  const listFn = useServerFn(listAuditLogs);
  const { data, isLoading, error } = useQuery({ queryKey: ["audit-logs"], queryFn: () => listFn() });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-text-sec">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando auditoria…
      </div>
    );
  }

  return (
    <AdminGate error={error}>
      <Card>
        <SectionTitle title="Trilha de auditoria" hint="Últimos 200 eventos do sistema" />
        <div className="max-h-[560px] overflow-y-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-bg-card">
              <tr className="text-left text-[11px] uppercase text-text-ter">
                <th className="pb-2">Quando</th>
                <th className="pb-2">Autor</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Ação</th>
                <th className="pb-2">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-card">
              {(data ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="py-2 text-text-sec whitespace-nowrap">
                    {new Date(l.occurred_at ?? l.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 text-text-body">{l.actor_name ?? "—"}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${l.actor_type === "ia" ? "bg-ia-bg text-ia" : "bg-primary/10 text-primary"}`}
                    >
                      {l.actor_type}
                    </span>
                  </td>
                  <td className="py-2 font-medium text-text-title">{l.action}</td>
                  <td className="py-2 text-text-body">{l.detail ?? "—"}</td>
                </tr>
              ))}
              {(data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[12px] text-text-ter">
                    Nenhum evento registrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminGate>
  );
}



function AbaNotif() {
  const qc = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const markAllFn = useServerFn(markAllNotificationsRead);
  const markFn = useServerFn(markNotificationRead);
  const delFn = useServerFn(deleteNotification);
  const { data = [], isLoading } = useQuery({ queryKey: ["notifications"], queryFn: () => listFn() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["sidebar-counts"] });
  };

  const markAllMut = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => { toast.success("Todas marcadas como lidas"); invalidate(); },
  });
  const toggleMut = useMutation({
    mutationFn: (v: { id: string; read: boolean }) => markFn({ data: v }),
    onSuccess: () => invalidate(),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Notificação removida"); invalidate(); },
  });

  const unread = data.filter((n) => !n.read).length;

  return (
    <Card>
      <SectionTitle
        title="Notificações"
        hint={`${data.length} recente(s) · ${unread} não lida(s)`}
        action={
          <button
            onClick={() => markAllMut.mutate()}
            disabled={markAllMut.isPending || unread === 0}
            className="rounded-md border border-border-card bg-bg-card px-3 py-1.5 text-[12px] hover:bg-bg-general disabled:opacity-50"
          >
            {markAllMut.isPending ? "…" : "Marcar todas como lidas"}
          </button>
        }
      />
      {isLoading ? (
        <div className="flex items-center gap-2 p-4 text-text-sec">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : data.length === 0 ? (
        <div className="p-4 text-[12.5px] text-text-ter">Nenhuma notificação registrada.</div>
      ) : (
        <ul className="divide-y divide-border-card">
          {data.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary capitalize">
                    {n.kind}
                  </span>
                  <span className="truncate text-[13px] font-medium text-text-title">{n.title}</span>
                </div>
                {n.description && <div className="mt-0.5 text-[12px] text-text-sec">{n.description}</div>}
                <div className="mt-0.5 text-[10.5px] text-text-ter">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                <button
                  onClick={() => toggleMut.mutate({ id: n.id, read: !n.read })}
                  className="rounded px-2 py-0.5 text-[11px] text-text-sec hover:bg-bg-general"
                >
                  {n.read ? "Marcar não lida" : "Marcar lida"}
                </button>
                <button
                  onClick={() => confirm("Excluir esta notificação?") && delMut.mutate(n.id)}
                  className="rounded p-1 text-text-ter hover:bg-error-bg hover:text-error"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AbaInt() {
  const qc = useQueryClient();
  const listFn = useServerFn(listIntegrations);
  const disconnectFn = useServerFn(disconnectIntegration);
  const { data = [], isLoading } = useQuery({ queryKey: ["integrations"], queryFn: () => listFn() });

  const disconnectMut = useMutation({
    mutationFn: (key: string) => disconnectFn({ data: { key } }),
    onSuccess: () => { toast.success("Integração desconectada"); qc.invalidateQueries({ queryKey: ["integrations"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <SectionTitle title="Integrações" hint="Status real dos canais e do cofre de secrets" />
      {isLoading ? (
        <div className="flex items-center gap-2 p-4 text-text-sec">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {data.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-md border border-border-card p-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-text-title">{i.label}</div>
                <div className="text-[11.5px] text-text-sec truncate">
                  {i.connected ? "Configurado e ativo" : "Aguardando credenciais"}
                </div>
              </div>
              {i.connected ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-success-bg px-2 py-0.5 text-[10.5px] font-semibold text-success">
                    Conectado
                  </span>
                  {i.managed ? (
                    <span className="rounded-full border border-border-card px-2 py-0.5 text-[10.5px] text-text-ter">Cofre de secrets</span>
                  ) : <button
                    onClick={() => confirm(`Desconectar ${i.label}?`) && disconnectMut.mutate(i.key)}
                    disabled={disconnectMut.isPending}
                    className="rounded-md border border-border-card px-2 py-1 text-[11px] text-text-sec hover:bg-error hover:text-white hover:border-error disabled:opacity-50"
                  >
                    Desconectar
                  </button>}
                </div>
              ) : (
                <button
                  onClick={() =>
                    toast.info(`${i.label} ainda não configurado`, {
                      description:
                        "Cadastre as credenciais no cofre de secrets do projeto. O status muda automaticamente quando a integração ficar ativa.",
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-border-card bg-bg-card px-2.5 py-1 text-[11.5px] font-medium text-text-body hover:bg-primary hover:text-primary-foreground hover:border-primary"
                >
                  <Plug className="h-3 w-3" /> Conectar
                </button>
              )}
            </div>
          ))}
          {data.length === 0 && (
            <div className="col-span-2 rounded-md border border-dashed border-border-card p-4 text-center text-[12px] text-text-ter">
              Nenhuma integração cadastrada.
            </div>
          )}
        </div>
      )}
      <ZapiCadenceCard />
      <SequenceEditorCard />
      <HandoffAutomationCard />

    </Card>
  );
}

function AbaOperacao() {
  const qc = useQueryClient();
  const policyFn = useServerFn(getCommercialPolicy);
  const savePolicyFn = useServerFn(updateCommercialPolicy);
  const alertsFn = useServerFn(listOperationalAlerts);
  const updateAlertFn = useServerFn(updateOperationalAlert);
  const dsrFn = useServerFn(listDataSubjectRequests);
  const saveDsrFn = useServerFn(upsertDataSubjectRequest);
  const campaignsFn = useServerFn(listCampaigns);
  const saveCampaignFn = useServerFn(upsertCampaign);
  const policyQ = useQuery({ queryKey: ["commercial-policy"], queryFn: () => policyFn() });
  const alertsQ = useQuery({ queryKey: ["operational-alerts"], queryFn: () => alertsFn() });
  const dsrQ = useQuery({ queryKey: ["privacy-requests"], queryFn: () => dsrFn() });
  const campaignsQ = useQuery({ queryKey: ["commercial-campaigns"], queryFn: () => campaignsFn() });
  const [policy, setPolicy] = useState({
    business_timezone: "America/Sao_Paulo", business_days: [1, 2, 3, 4, 5] as number[],
    business_start_time: "08:00", business_end_time: "18:00", outreach_daily_limit_per_contact: 1,
    outreach_min_interval_minutes: 1440, outreach_require_verified_contact: false,
    outreach_require_manual_approval: false, outreach_auto_start: true,
    handoff_escalation_minutes: 60, privacy_contact_email: "", retention_days: 730,
  });
  const [campaignName, setCampaignName] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("");
  const [campaignChannel, setCampaignChannel] = useState<"whatsapp" | "email" | "phone" | "mixed" | "inbound">("mixed");

  useEffect(() => {
    if (!policyQ.data) return;
    const value: any = policyQ.data;
    setPolicy({
      business_timezone: value.business_timezone ?? "America/Sao_Paulo",
      business_days: value.business_days ?? [1, 2, 3, 4, 5],
      business_start_time: String(value.business_start_time ?? "08:00").slice(0, 5),
      business_end_time: String(value.business_end_time ?? "18:00").slice(0, 5),
      outreach_daily_limit_per_contact: Number(value.outreach_daily_limit_per_contact ?? 1),
      outreach_min_interval_minutes: Number(value.outreach_min_interval_minutes ?? 1440),
      outreach_require_verified_contact: Boolean(value.outreach_require_verified_contact),
      outreach_require_manual_approval: Boolean(value.outreach_require_manual_approval),
      outreach_auto_start: value.outreach_auto_start !== false,
      handoff_escalation_minutes: Number(value.handoff_escalation_minutes ?? 60),
      privacy_contact_email: value.privacy_contact_email ?? "",
      retention_days: Number(value.retention_days ?? 730),
    });
  }, [policyQ.data]);

  const savePolicyMut = useMutation({
    mutationFn: () => savePolicyFn({ data: { ...policy, privacy_contact_email: policy.privacy_contact_email || null } }),
    onSuccess: () => { toast.success("Política comercial atualizada."); qc.invalidateQueries({ queryKey: ["commercial-policy"] }); },
    onError: (error: Error) => toast.error("Não foi possível salvar", { description: error.message }),
  });
  const alertMut = useMutation({
    mutationFn: (value: { id: string; status: "acknowledged" | "resolved" }) => updateAlertFn({ data: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operational-alerts"] }),
  });
  const dsrMut = useMutation({
    mutationFn: (value: { request_type: "access" | "correction" | "deletion" | "anonymization" | "portability" | "objection"; requester_email: string }) => saveDsrFn({ data: value }),
    onSuccess: () => { toast.success("Solicitação LGPD registrada."); qc.invalidateQueries({ queryKey: ["privacy-requests"] }); },
    onError: (error: Error) => toast.error("Não foi possível registrar", { description: error.message }),
  });
  const campaignMut = useMutation({
    mutationFn: () => saveCampaignFn({ data: { name: campaignName, objective: campaignObjective || null, channel: campaignChannel, status: "draft" } }),
    onSuccess: () => { setCampaignName(""); setCampaignObjective(""); toast.success("Campanha criada como rascunho."); qc.invalidateQueries({ queryKey: ["commercial-campaigns"] }); },
    onError: (error: Error) => toast.error("Não foi possível criar a campanha", { description: error.message }),
  });
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const openAlerts = (alertsQ.data ?? []).filter((alert: any) => alert.status !== "resolved");
  const dsrs = dsrQ.data ?? [];
  const campaigns = campaignsQ.data ?? [];

  return (
    <AdminGate error={policyQ.error || alertsQ.error || dsrQ.error || campaignsQ.error}>
      <div className="space-y-4">
        <Card>
          <SectionTitle title="Regras de contato e proteção comercial" hint="A Ana só inicia ou retoma cadências dentro destas regras." />
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Fuso horário"><input value={policy.business_timezone} onChange={(e) => setPolicy({ ...policy, business_timezone: e.target.value })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]" /></Field>
            <Field label="Início do expediente"><input type="time" value={policy.business_start_time} onChange={(e) => setPolicy({ ...policy, business_start_time: e.target.value })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]" /></Field>
            <Field label="Fim do expediente"><input type="time" value={policy.business_end_time} onChange={(e) => setPolicy({ ...policy, business_end_time: e.target.value })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]" /></Field>
            <Field label="Máximo por contato/dia"><input type="number" min={1} max={20} value={policy.outreach_daily_limit_per_contact} onChange={(e) => setPolicy({ ...policy, outreach_daily_limit_per_contact: Number(e.target.value) })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]" /></Field>
            <Field label="Intervalo mínimo (minutos)"><input type="number" min={5} max={43200} value={policy.outreach_min_interval_minutes} onChange={(e) => setPolicy({ ...policy, outreach_min_interval_minutes: Number(e.target.value) })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]" /></Field>
            <Field label="Escalar handoff após (minutos)"><input type="number" min={5} max={10080} value={policy.handoff_escalation_minutes} onChange={(e) => setPolicy({ ...policy, handoff_escalation_minutes: Number(e.target.value) })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]" /></Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {days.map((label, index) => <label key={label} className="inline-flex items-center gap-1.5 text-[12px] text-text-body"><input type="checkbox" checked={policy.business_days.includes(index)} onChange={(e) => setPolicy({ ...policy, business_days: e.target.checked ? [...policy.business_days, index].sort() : policy.business_days.filter((day) => day !== index) })} className="accent-primary" />{label}</label>)}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <ToggleLabel label="Exigir contato verificado" checked={policy.outreach_require_verified_contact} onChange={(checked) => setPolicy({ ...policy, outreach_require_verified_contact: checked })} />
            <ToggleLabel label="Exigir aprovação humana" checked={policy.outreach_require_manual_approval} onChange={(checked) => setPolicy({ ...policy, outreach_require_manual_approval: checked })} />
            <ToggleLabel label="Iniciar automaticamente" checked={policy.outreach_auto_start} onChange={(checked) => setPolicy({ ...policy, outreach_auto_start: checked })} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="E-mail de privacidade"><input type="email" value={policy.privacy_contact_email} onChange={(e) => setPolicy({ ...policy, privacy_contact_email: e.target.value })} placeholder="lgpd@suaempresa.com.br" className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]" /></Field>
            <Field label="Retenção (dias)"><input type="number" min={30} max={3650} value={policy.retention_days} onChange={(e) => setPolicy({ ...policy, retention_days: Number(e.target.value) })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]" /></Field>
          </div>
          <button onClick={() => savePolicyMut.mutate()} disabled={savePolicyMut.isPending || policy.business_days.length === 0} className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground disabled:opacity-50">{savePolicyMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Salvar regras</button>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle title="Campanhas" hint="Crie rascunhos, selecione os leads e aprove-os antes do disparo." />
            <div className="space-y-2">
              <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} maxLength={160} placeholder="Nome da campanha" className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]" />
              <input value={campaignObjective} onChange={(e) => setCampaignObjective(e.target.value)} maxLength={600} placeholder="Objetivo (opcional)" className="h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]" />
              <div className="flex items-center gap-2"><select value={campaignChannel} onChange={(e) => setCampaignChannel(e.target.value as typeof campaignChannel)} className="h-9 rounded-md border border-border-card bg-bg-card px-2 text-[13px]"><option value="mixed">Multicanal</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="phone">Telefone</option><option value="inbound">Inbound</option></select><button onClick={() => campaignName.trim() && campaignMut.mutate()} disabled={!campaignName.trim() || campaignMut.isPending} className="rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50">Criar rascunho</button></div>
            </div>
            <ul className="mt-4 space-y-2">{campaigns.slice(0, 6).map((campaign: any) => <li key={campaign.id} className="flex items-center justify-between rounded-md border border-border-card bg-bg-general px-3 py-2 text-[12px]"><span className="font-medium text-text-title">{campaign.name}</span><span className="text-text-sec">{campaign.channel} · {campaign.status} · {campaign.campaign_members?.[0]?.count ?? 0} leads</span></li>)}{campaigns.length === 0 && <li className="text-[12px] text-text-ter">Nenhuma campanha criada.</li>}</ul>
          </Card>
          <Card>
            <SectionTitle title="Alertas da operação" hint={`${openAlerts.length} alerta(s) pendente(s)`} />
            <ul className="space-y-2">{openAlerts.slice(0, 8).map((alert: any) => <li key={alert.id} className="rounded-md border border-border-card bg-bg-general p-2.5"><div className="flex items-start justify-between gap-2"><div><div className="text-[12px] font-semibold text-text-title">{alert.title}</div><div className="mt-0.5 text-[11px] text-text-sec">{alert.detail || alert.category}</div></div><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${alert.severity === "critical" ? "bg-error-bg text-error" : "bg-warm-bg text-warm"}`}>{alert.severity}</span></div><div className="mt-2 flex gap-2"><button onClick={() => alertMut.mutate({ id: alert.id, status: "acknowledged" })} className="text-[11px] text-primary">Reconhecer</button><button onClick={() => alertMut.mutate({ id: alert.id, status: "resolved" })} className="text-[11px] text-success">Resolver</button></div></li>)}{openAlerts.length === 0 && <li className="py-4 text-center text-[12px] text-text-ter">Nenhum alerta aberto.</li>}</ul>
          </Card>
        </div>

        <Card>
          <SectionTitle title="Solicitações LGPD" hint="Registre, acompanhe e conclua pedidos de titulares de dados." action={<button onClick={() => { const email = prompt("E-mail do solicitante:"); if (email) dsrMut.mutate({ requester_email: email, request_type: "access" }); }} className="rounded-md border border-border-card px-3 py-1.5 text-[12px] hover:bg-bg-general">+ Registrar pedido</button>} />
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-[12px]"><thead><tr className="text-left text-[10px] uppercase text-text-ter"><th className="pb-2">Solicitante</th><th className="pb-2">Pedido</th><th className="pb-2">Prazo</th><th className="pb-2">Status</th></tr></thead><tbody className="divide-y divide-border-card">{dsrs.slice(0, 12).map((request: any) => <tr key={request.id}><td className="py-2">{request.requester_email || request.requester_phone || "—"}</td><td className="py-2">{request.request_type}</td><td className="py-2">{new Date(request.due_at).toLocaleDateString("pt-BR")}</td><td className="py-2"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{request.status}</span></td></tr>)}{dsrs.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-text-ter">Nenhuma solicitação registrada.</td></tr>}</tbody></table></div>
        </Card>
      </div>
    </AdminGate>
  );
}

function ToggleLabel({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center justify-between rounded-md border border-border-card bg-bg-general px-3 py-2 text-[12px] text-text-body"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-primary" /></label>;
}


function AbaSeg() {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) {
      toast.error("A senha precisa ter no mínimo 8 caracteres.");
      return;
    }
    if (pwd !== pwd2) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) {
      toast.error("Falha ao alterar senha", { description: error.message });
      return;
    }
    setPwd("");
    setPwd2("");
    toast.success("Senha atualizada com sucesso.");
  };

  return (
    <Card>
      <SectionTitle title="Segurança" hint="Sua conta de acesso ao CRM" />
      <form onSubmit={onSubmit} className="space-y-3 max-w-md">
        <Field label="Nova senha" hint="Mínimo 8 caracteres">
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoComplete="new-password"
            className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
          />
        </Field>
        <Field label="Confirmar nova senha">
          <input
            type="password"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
            autoComplete="new-password"
            className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none focus:border-primary"
          />
        </Field>
        <button
          type="submit"
          disabled={busy || !pwd || !pwd2}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12.5px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Alterar senha
        </button>
      </form>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] font-medium text-text-title">{label}</div>
      {hint && <div className="mb-1.5 text-[11.5px] text-text-sec">{hint}</div>}
      {!hint && <div className="mb-1.5" />}
      {children}
    </div>
  );
}

// ============= SERVIÇOS =============
type ServiceRow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price: number | null;
  unit: string | null;
  term: string | null;
  max_discount: number | null;
  active: boolean | null;
};

function AbaServicos() {
  const qc = useQueryClient();
  const listFn = useServerFn(listServices);
  const upsertFn = useServerFn(upsertService);
  const delFn = useServerFn(deleteService);
  const { data = [], isLoading } = useQuery<ServiceRow[]>({ queryKey: ["services"], queryFn: () => listFn() as Promise<ServiceRow[]> });
  const [draft, setDraft] = useState<Partial<ServiceRow> | null>(null);

  const save = useMutation({
    mutationFn: (payload: Partial<ServiceRow>) =>
      upsertFn({
        data: {
          id: payload.id ?? null,
          patch: {
            name: payload.name!,
            category: payload.category ?? null,
            description: payload.description ?? null,
            price: payload.price != null ? Number(payload.price) : null,
            unit: payload.unit ?? null,
            term: payload.term ?? null,
            max_discount: payload.max_discount != null ? Number(payload.max_discount) : null,
            active: payload.active ?? true,
          },
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      setDraft(null);
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
  });

  return (
    <Card>
      <div className="flex items-center justify-between">
        <SectionTitle title="Catálogo de Serviços" hint="Ana usa este catálogo em propostas e respostas" />
        <button
          onClick={() => setDraft({ active: true })}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Novo serviço
        </button>
      </div>
      {isLoading ? (
        <Loader2 className="mx-auto my-6 h-4 w-4 animate-spin text-text-sec" />
      ) : (
        <table className="mt-3 w-full text-[13px]">
          <thead>
            <tr className="border-b border-border-card text-left text-[11px] uppercase text-text-ter">
              <th className="pb-2">Nome</th>
              <th className="pb-2">Categoria</th>
              <th className="pb-2">Preço</th>
              <th className="pb-2">Unidade</th>
              <th className="pb-2">Desc. máx.</th>
              <th className="pb-2">Ativo</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-card">
            {data.map((s) => (
              <tr key={s.id}>
                <td className="py-2 font-medium text-text-title">{s.name}</td>
                <td className="py-2 text-text-body">{s.category ?? "—"}</td>
                <td className="py-2 text-text-body">{s.price != null ? `R$ ${Number(s.price).toFixed(2)}` : "—"}</td>
                <td className="py-2 text-text-body">{s.unit ?? "—"}</td>
                <td className="py-2 text-text-body">{s.max_discount != null ? `${s.max_discount}%` : "—"}</td>
                <td className="py-2">{s.active ? <span className="text-success">Sim</span> : <span className="text-text-ter">Não</span>}</td>
                <td className="py-2 text-right">
                  <button onClick={() => setDraft(s)} className="mr-2 text-[12px] text-primary">Editar</button>
                  <button onClick={() => del.mutate(s.id)} className="text-[12px] text-red-500">
                    <Trash2 className="inline h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!data.length && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-[13px] text-text-sec">Nenhum serviço cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDraft(null)}>
          <div className="w-full max-w-lg rounded-lg bg-bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-[15px] font-semibold text-text-title">{draft.id ? "Editar" : "Novo"} serviço</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome"><input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px]" /></Field>
              <Field label="Categoria"><input value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px]" /></Field>
              <Field label="Preço (R$)"><input type="number" value={draft.price ?? ""} onChange={(e) => setDraft({ ...draft, price: e.target.value === "" ? null : Number(e.target.value) })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px]" /></Field>
              <Field label="Unidade"><input value={draft.unit ?? ""} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px]" /></Field>
              <Field label="Prazo"><input value={draft.term ?? ""} onChange={(e) => setDraft({ ...draft, term: e.target.value })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px]" /></Field>
              <Field label="Desconto máx. (%)"><input type="number" value={draft.max_discount ?? ""} onChange={(e) => setDraft({ ...draft, max_discount: e.target.value === "" ? null : Number(e.target.value) })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px]" /></Field>
            </div>
            <Field label="Descrição">
              <textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} className="w-full rounded-md border border-border-card bg-bg-card px-3 py-2 text-[13px]" />
            </Field>
            <label className="mt-2 flex items-center gap-2 text-[12px] text-text-body">
              <input type="checkbox" checked={draft.active ?? true} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Ativo
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="rounded-md border border-border-card px-3 py-1.5 text-[12px]">Cancelar</button>
              <button
                disabled={!draft.name || save.isPending}
                onClick={() => save.mutate(draft)}
                className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ============= OBJEÇÕES =============
type ObjectionRow = { id: string; trigger: string; response: string };

function AbaObjecoes() {
  const qc = useQueryClient();
  const listFn = useServerFn(listObjections);
  const upsertFn = useServerFn(upsertObjection);
  const delFn = useServerFn(deleteObjection);
  const { data = [], isLoading } = useQuery<ObjectionRow[]>({ queryKey: ["objections"], queryFn: () => listFn() as Promise<ObjectionRow[]> });
  const [draft, setDraft] = useState<Partial<ObjectionRow> | null>(null);
  const save = useMutation({
    mutationFn: (p: Partial<ObjectionRow>) => upsertFn({ data: { id: p.id ?? null, trigger: p.trigger!, response: p.response! } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["objections"] });
      setDraft(null);
    },
  });
  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["objections"] }) });

  return (
    <Card>
      <div className="flex items-center justify-between">
        <SectionTitle title="Biblioteca de Objeções" hint="Ana reage automaticamente quando o cliente diz o gatilho" />
        <button onClick={() => setDraft({})} className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> Nova objeção
        </button>
      </div>
      {isLoading ? (
        <Loader2 className="mx-auto my-6 h-4 w-4 animate-spin text-text-sec" />
      ) : (
        <div className="mt-3 space-y-2">
          {data.map((o) => (
            <div key={o.id} className="rounded-md border border-border-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-[12px] font-semibold text-warm">Gatilho: {o.trigger}</div>
                  <div className="mt-1 text-[13px] text-text-body">{o.response}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDraft(o)} className="text-[12px] text-primary">Editar</button>
                  <button onClick={() => del.mutate(o.id)} className="text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
          {!data.length && <div className="py-6 text-center text-[13px] text-text-sec">Nenhuma objeção cadastrada.</div>}
        </div>
      )}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDraft(null)}>
          <div className="w-full max-w-lg rounded-lg bg-bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 text-[15px] font-semibold text-text-title">{draft.id ? "Editar" : "Nova"} objeção</div>
            <Field label="Gatilho (ex.: 'está caro')">
              <input value={draft.trigger ?? ""} onChange={(e) => setDraft({ ...draft, trigger: e.target.value })} className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px]" />
            </Field>
            <Field label="Resposta da Ana">
              <textarea value={draft.response ?? ""} onChange={(e) => setDraft({ ...draft, response: e.target.value })} rows={4} className="w-full rounded-md border border-border-card bg-bg-card px-3 py-2 text-[13px]" />
            </Field>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDraft(null)} className="rounded-md border border-border-card px-3 py-1.5 text-[12px]">Cancelar</button>
              <button disabled={!draft.trigger || !draft.response || save.isPending} onClick={() => save.mutate(draft)} className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground disabled:opacity-50">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ============= SCORE WEIGHTS =============
type Weights = { segment: number; whatsapp: number; site: number; porte: number; google: number; regiao: number };
const DEFAULT_WEIGHTS: Weights = { segment: 25, whatsapp: 20, site: 15, porte: 15, google: 15, regiao: 10 };

function AbaScore() {
  const qc = useQueryClient();
  const getFn = useServerFn(getScoreWeights);
  const updFn = useServerFn(updateScoreWeights);
  const { data, isLoading } = useQuery({ queryKey: ["score-weights"], queryFn: () => getFn() });
  const [w, setW] = useState<Weights>(DEFAULT_WEIGHTS);
  useEffect(() => {
    if (data) setW({ segment: data.segment ?? 25, whatsapp: data.whatsapp ?? 20, site: data.site ?? 15, porte: data.porte ?? 15, google: data.google ?? 15, regiao: data.regiao ?? 10 });
  }, [data]);
  const save = useMutation({
    mutationFn: () => updFn({ data: w }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["score-weights"] }),
  });
  const total = w.segment + w.whatsapp + w.site + w.porte + w.google + w.regiao;

  const rows: { key: keyof Weights; label: string }[] = [
    { key: "segment", label: "Segmento" },
    { key: "whatsapp", label: "WhatsApp ativo" },
    { key: "site", label: "Site institucional" },
    { key: "porte", label: "Porte / faturamento" },
    { key: "google", label: "Presença Google" },
    { key: "regiao", label: "Região atendida" },
  ];

  return (
    <Card>
      <SectionTitle title="Pesos do Score da Ana" hint="Como Ana pontua um novo prospect (soma sugerida: 100)" />
      {isLoading ? (
        <Loader2 className="mx-auto my-6 h-4 w-4 animate-spin text-text-sec" />
      ) : (
        <div className="max-w-md space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3">
              <div className="w-40 text-[13px] text-text-body">{r.label}</div>
              <input type="range" min={0} max={50} value={w[r.key]} onChange={(e) => setW({ ...w, [r.key]: Number(e.target.value) })} className="flex-1 accent-primary" />
              <div className="w-10 text-right text-[13px] font-semibold text-text-title">{w[r.key]}</div>
            </div>
          ))}
          <div className={`text-[12px] ${total === 100 ? "text-success" : "text-warm"}`}>Soma atual: {total} {total !== 100 && "(recomendado: 100)"}</div>
          <button disabled={save.isPending} onClick={() => save.mutate()} className="mt-2 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-50">
            {save.isPending ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 inline h-3.5 w-3.5" />} Salvar pesos
          </button>
        </div>
      )}
    </Card>
  );
}

// ============= GOVERNANÇA IA =============
type UQ = { id: string; text: string; answer: string | null; count: number | null; resolved: boolean | null; created_at: string };

function AbaGovernanca() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUnansweredQuestions);
  const resolveFn = useServerFn(resolveUnansweredQuestion);
  const delFn = useServerFn(deleteUnansweredQuestion);
  const reindexFn = useServerFn(reindexAllDocuments);
  const statsFn = useServerFn(getKnowledgeStats);
  const { data = [], isLoading } = useQuery<UQ[]>({ queryKey: ["unanswered"], queryFn: () => listFn() as Promise<UQ[]> });
  const statsQ = useQuery({ queryKey: ["knowledge-stats"], queryFn: () => statsFn() });
  const reindexMut = useMutation({
    mutationFn: () => reindexFn(),
    onSuccess: (r: { documents: number; chunks: number }) => {
      toast.success(`Base reindexada: ${r.documents} documento(s), ${r.chunks} chunk(s).`);
      qc.invalidateQueries({ queryKey: ["knowledge-stats"] });
    },
    onError: (e: Error) => toast.error("Falha ao reindexar", { description: e.message }),
  });
  const resolve = useMutation({
    mutationFn: (vars: { id: string; resolved: boolean; answer?: string | null }) => resolveFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unanswered"] }),
  });
  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["unanswered"] }) });

  const abertas = data.filter((q) => !q.resolved);
  const resolvidas = data.filter((q) => q.resolved);
  const stats = statsQ.data;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="Base de conhecimento da Ana"
          hint="Documentos indexados que a Ana usa como contexto"
          action={
            <button
              onClick={() => reindexMut.mutate()}
              disabled={reindexMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {reindexMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Reindexar base
            </button>
          }
        />
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border border-border-card bg-bg-general p-3">
            <div className="text-[11px] uppercase text-text-ter">Documentos ativos</div>
            <div className="mt-1 text-[20px] font-semibold text-text-title">{stats?.documentsWithText ?? "—"}</div>
          </div>
          <div className="rounded-md border border-border-card bg-bg-general p-3">
            <div className="text-[11px] uppercase text-text-ter">Chunks ativos</div>
            <div className="mt-1 text-[20px] font-semibold text-text-title">{stats?.activeChunks ?? "—"}</div>
          </div>
          <div className="rounded-md border border-border-card bg-bg-general p-3">
            <div className="text-[11px] uppercase text-text-ter">Chunks antigos</div>
            <div className="mt-1 text-[20px] font-semibold text-text-title">{stats?.staleChunks ?? "—"}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warm-bg text-warm">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-text-title">Perguntas sem resposta — {abertas.length}</div>
            <div className="text-[12px] text-text-sec">Dúvidas de clientes que a Ana não conseguiu responder. Treine a base para reduzir escalações.</div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Em aberto" />
        {isLoading ? (
          <Loader2 className="mx-auto my-6 h-4 w-4 animate-spin text-text-sec" />
        ) : abertas.length === 0 ? (
          <div className="py-6 text-center text-[13px] text-text-sec">🎉 Nenhuma pergunta em aberto.</div>
        ) : (
          <ul className="divide-y divide-border-card">
            {abertas.map((q) => (
              <li key={q.id} className="flex items-start justify-between gap-3 py-3">
                <div className="flex-1">
                  <div className="text-[13px] text-text-body">{q.text}</div>
                  <div className="text-[11px] text-text-ter">Ocorrências: {q.count ?? 1} · {new Date(q.created_at).toLocaleDateString("pt-BR")}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    const answer = prompt("Resposta aprovada que a Ana poderá usar:");
                    if (answer?.trim()) resolve.mutate({ id: q.id, resolved: true, answer: answer.trim() });
                  }} className="rounded-md bg-success-bg px-2.5 py-1 text-[11.5px] font-medium text-success">
                    Responder e aprovar
                  </button>
                  <button onClick={() => del.mutate(q.id)} className="text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {resolvidas.length > 0 && (
        <Card>
          <SectionTitle title={`Resolvidas (${resolvidas.length})`} />
          <ul className="divide-y divide-border-card">
            {resolvidas.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <div className="text-[12.5px] text-text-sec">{q.text}</div>
                  <div className="mt-0.5 text-[11.5px] text-success">Resposta aprovada: {q.answer}</div>
                </div>
                <button onClick={() => resolve.mutate({ id: q.id, resolved: false })} className="text-[11px] text-primary">Reabrir</button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

// ============= PROSPECÇÃO — Fontes ativas =============
import { getEnabledSources, testApifyToken } from "@/lib/prospecting.functions";

function AbaProspeccao() {
  const qc = useQueryClient();
  const getEnabled = useServerFn(getEnabledSources);
  const updateSettings = useServerFn(updateCompanySettings);
  const testApify = useServerFn(testApifyToken);

  const { data: enabled, isLoading } = useQuery({ queryKey: ["enabled-sources"], queryFn: () => getEnabled() });

  const [apifyResult, setApifyResult] = useState<
    | { ok: boolean; message: string; username?: string | null; email?: string | null; plan?: string | null }
    | null
  >(null);
  const testApifyMut = useMutation({
    mutationFn: () => testApify(),
    onSuccess: (r) => {
      setApifyResult(r);
      if (r.ok) toast.success("Apify: token válido");
      else toast.error("Apify: falha na verificação", { description: r.message });
    },
    onError: (e: Error) => {
      setApifyResult({ ok: false, message: e.message });
      toast.error("Erro ao testar Apify", { description: e.message });
    },
  });

  const [state, setState] = useState({ cnpj_ws: true, google_places: false, ai_only: false, apify: false });

  useEffect(() => {
    if (enabled) {
      setState({
        cnpj_ws: enabled.cnpj_ws,
        google_places: enabled.google_places,
        ai_only: enabled.ai_only,
        apify: (enabled as { apify?: boolean }).apify ?? false,
      });
    }
  }, [enabled]);

  const save = useMutation({
    mutationFn: () =>
      updateSettings({
        data: { prospecting_sources: state },
      }),
    onSuccess: () => {
      toast.success("Fontes de prospecção atualizadas.");
      qc.invalidateQueries({ queryKey: ["enabled-sources"] });
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-text-sec">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando fontes…
      </div>
    );
  }

  const sources: Array<{
    id: "cnpj_ws" | "google_places" | "ai_only" | "apify";
    title: string;
    desc: string;
    cost: string;
    keyStatus: { ok: boolean; msg: string } | null;
  }> = [
    {
      id: "cnpj_ws",
      title: "CNPJ.ws / BrasilAPI (Receita Federal)",
      desc: "Busca empresas ativas na base pública da Receita por CNAE, UF, cidade e porte. Dados oficiais.",
      cost: "Grátis (3 req/min sem chave). Chave opcional em cnpj.ws para maior volume.",
      keyStatus: null,
    },
    {
      id: "google_places",
      title: "Google Places API",
      desc: "Busca empresas por palavra-chave (ex.: 'restaurantes em Curitiba'). Traz telefone, endereço, site.",
      cost: "Paga — requer chave da Google Cloud (Places API New).",
      keyStatus: enabled
        ? enabled.has_google_key
          ? { ok: true, msg: "GOOGLE_PLACES_API_KEY configurada" }
          : { ok: false, msg: "GOOGLE_PLACES_API_KEY ausente — solicite ao administrador para adicionar nas secrets." }
        : null,
    },
    {
      id: "apify",
      title: "Apify (Google Maps Scraper)",
      desc: "Usa actors da Apify para extrair empresas do Google Maps com telefone, e-mail (quando disponível), site e endereço.",
      cost: "Pago por consumo — plano free da Apify traz US$5/mês. Requer APIFY_TOKEN.",
      keyStatus: enabled
        ? (enabled as { has_apify_token?: boolean }).has_apify_token
          ? { ok: true, msg: "APIFY_TOKEN configurado" }
          : { ok: false, msg: "APIFY_TOKEN ausente — peça ao administrador para adicionar nas secrets." }
        : null,
    },
    {
      id: "ai_only",
      title: "Só IA (Claude gera sugestões)",
      desc: "Ana usa o perfil da sua empresa para sugerir potenciais clientes plausíveis do mercado brasileiro. Não retorna CNPJ/telefone reais.",
      cost: "Usa créditos do Anthropic (ANTHROPIC_API_KEY já configurada).",
      keyStatus: enabled
        ? enabled.has_anthropic_key
          ? { ok: true, msg: "ANTHROPIC_API_KEY configurada" }
          : { ok: false, msg: "ANTHROPIC_API_KEY ausente" }
        : null,
    },
  ];

  return (
    <Card>
      <SectionTitle
        title="Fontes de prospecção"
        hint="Ative apenas as fontes que quer usar na tela de Prospecção"
        action={
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Salvar
          </button>
        }
      />
      <div className="space-y-3">
        {sources.map((s) => {
          const on = state[s.id];
          return (
            <div
              key={s.id}
              className={`rounded-lg border p-4 transition ${on ? "border-primary/60 bg-primary/5" : "border-border-card"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-text-title">{s.title}</div>
                  <div className="mt-1 text-[12.5px] text-text-body">{s.desc}</div>
                  <div className="mt-1.5 text-[11.5px] text-text-ter">{s.cost}</div>
                  {s.keyStatus && (
                    <div
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.keyStatus.ok ? "bg-success-bg text-success" : "bg-error-bg text-error"}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {s.keyStatus.msg}
                    </div>
                  )}
                  {s.id === "apify" && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => testApifyMut.mutate()}
                        disabled={testApifyMut.isPending}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border-card bg-bg-card px-3 py-1.5 text-[12px] font-medium hover:bg-bg-general disabled:opacity-50"
                      >
                        {testApifyMut.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Plug className="h-3.5 w-3.5" />
                        )}
                        Testar token Apify
                      </button>
                      {apifyResult && (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium ${apifyResult.ok ? "bg-success-bg text-success" : "bg-error-bg text-error"}`}
                        >
                          {apifyResult.ok ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                          {apifyResult.ok
                            ? `Conectado${apifyResult.username ? ` como ${apifyResult.username}` : ""}${apifyResult.plan ? ` · plano ${apifyResult.plan}` : ""}`
                            : apifyResult.message}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={on}
                    onChange={(e) => setState({ ...state, [s.id]: e.target.checked })}
                  />
                  <div className="peer h-6 w-11 rounded-full bg-bg-general after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full" />
                </label>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
        <b>Como adicionar a chave do Google:</b> cadastre a secret <code>GOOGLE_PLACES_API_KEY</code> no cofre do projeto. Gere a chave em console.cloud.google.com → APIs & Services → Credentials e ative <i>Places API (New)</i> e <i>Geocoding API</i> para a busca por raio.
      </div>
    </Card>
  );
}


function ZapiCadenceCard() {
  const getFn = useServerFn(getCompanySettings);
  const updateFn = useServerFn(updateCompanySettings);
  const healthFn = useServerFn(getOutreachHealth);
  const testFn = useServerFn(testZapi);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["company-settings"], queryFn: () => getFn() });
  const { data: health } = useQuery({ queryKey: ["outreach-health"], queryFn: () => healthFn() });
  const [waitH, setWaitH] = useState<number>(24);
  const [maxA, setMaxA] = useState<number>(3);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => {
    if (data) {
      setWaitH(Number((data as any).outreach_wait_hours ?? 24));
      setMaxA(Number((data as any).outreach_max_attempts ?? 3));
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () =>
      updateFn({ data: { outreach_wait_hours: waitH, outreach_max_attempts: maxA } as any }),
    onSuccess: () => {
      toast.success("Cadência salva");
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result: any = await testFn();
      setTestResult({
        ok: result.ok,
        message: result.ok
          ? result.connected
            ? "Z-API conectada e pronta para envio."
            : "Credenciais válidas, mas a instância ainda não está conectada."
          : result.error || "Falha ao testar a Z-API.",
      });
    } catch (error) {
      setTestResult({ ok: false, message: (error as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const healthItems = [
    ["Z-API", health?.zapi],
    ["Client Token", health?.zapiClientToken],
    ["Webhook", health?.zapiWebhook],
    ["Agendador", health?.scheduler],
    ["E-mail (Resend)", health?.email],
    ["Webhook e-mail", health?.emailWebhook],
  ] as const;

  return (
    <div className="mt-4 rounded-md border border-border-card p-4">
      <div className="mb-1 text-[13px] font-semibold text-text-title">
        Cadência de primeiro contato (IA)
      </div>
      <div className="mb-3 text-[11.5px] text-text-sec">
        Configure a estratégia sequencial WhatsApp → E-mail → Ligação. A IA só
        avança de canal se o anterior falhar ou não tiver resposta no prazo. A Z-API
        é o único provedor de WhatsApp deste sistema.
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-6">
        {healthItems.map(([label, ready]) => (
          <div key={label} className="rounded-md border border-border-card px-2 py-1.5">
            <div className="text-[10.5px] text-text-ter">{label}</div>
            <div className={`text-[11.5px] font-semibold ${ready ? "text-success" : "text-error"}`}>
              {ready ? "Configurado" : "Pendente"}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <label className="block text-[12px]">
          <span className="text-text-sec">Aguardar (horas) sem resposta</span>
          <input
            type="number"
            min={1}
            max={168}
            value={waitH}
            onChange={(e) => setWaitH(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border-card bg-bg-card px-2 py-1.5 text-[13px]"
          />
        </label>
        <label className="block text-[12px]">
          <span className="text-text-sec">Tentativas por canal</span>
          <input
            type="number"
            min={1}
            max={10}
            value={maxA}
            onChange={(e) => setMaxA(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border-card bg-bg-card px-2 py-1.5 text-[13px]"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          {saveMut.isPending ? "Salvando…" : "Salvar cadência"}
        </button>
        <button
          onClick={testConnection}
          disabled={testing || !health?.zapi}
          className="inline-flex h-8 items-center rounded-md border border-border-card bg-bg-card px-3 text-[12px] font-medium text-text-body hover:bg-bg-general disabled:opacity-50"
        >
          {testing ? "Testando…" : "Testar Z-API"}
        </button>
        {testResult && (
          <span className={`text-[11.5px] font-medium ${testResult.ok ? "text-success" : "text-error"}`}>
            {testResult.message}
          </span>
        )}
      </div>
      <div className="mt-3 text-[11px] text-text-ter">
        Secrets necessários: ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN,
        ZAPI_WEBHOOK_SECRET, OUTREACH_CRON_SECRET, RESEND_API_KEY e OUTREACH_EMAIL_FROM.
        Para respostas por e-mail, configure também RESEND_WEBHOOK_SECRET.
      </div>
    </div>
  );
}

// Editor da sequência de outreach padrão. Reutiliza os server fns admin em
// outreach-sequences.functions.ts. Interface mínima: lista passos ordenados,
// permite adicionar/editar/remover passos e ativar/desativar a sequência.
function SequenceEditorCard() {
  const listFn = useServerFn(listSequences);
  const getFn = useServerFn(getSequenceWithSteps);
  const updSeq = useServerFn(updateSequence);
  const upsertStep = useServerFn(upsertSequenceStep);
  const delStep = useServerFn(deleteSequenceStep);
  const qc = useQueryClient();
  const { data: sequences } = useQuery({
    queryKey: ["outreach-sequences"],
    queryFn: () => listFn(),
  });
  const seqId = sequences?.[0]?.id;
  const { data: bundle } = useQuery({
    queryKey: ["outreach-sequence", seqId],
    queryFn: () => getFn({ data: { id: seqId! } }),
    enabled: !!seqId,
  });

  const seq = bundle?.sequence;
  const steps = bundle?.steps ?? [];

  const saveActive = useMutation({
    mutationFn: (active: boolean) =>
      updSeq({ data: { id: seq!.id, active } }),
    onSuccess: () => {
      toast.success("Sequência atualizada");
      qc.invalidateQueries({ queryKey: ["outreach-sequences"] });
      qc.invalidateQueries({ queryKey: ["outreach-sequence", seqId] });
    },
  });

  const saveStep = useMutation({
    mutationFn: (payload: {
      id?: string;
      order_index: number;
      channel: SequenceChannel;
      delay_minutes: number;
      max_attempts?: number;
      template?: string | null;
      active?: boolean;
      continue_on?: Array<"failed" | "skipped">;
    }) =>
      upsertStep({
        data: {
          sequence_id: seq!.id,
          ...payload,
        },
      }),
    onSuccess: () => {
      toast.success("Passo salvo");
      qc.invalidateQueries({ queryKey: ["outreach-sequence", seqId] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const removeStep = useMutation({
    mutationFn: (id: string) => delStep({ data: { id } }),
    onSuccess: () => {
      toast.success("Passo removido");
      qc.invalidateQueries({ queryKey: ["outreach-sequence", seqId] });
    },
  });

  if (!seq) {
    return (
      <div className="mt-4 rounded-md border border-border-card p-4 text-[12px] text-text-sec">
        Nenhuma cadência cadastrada. Uma sequência padrão é criada
        automaticamente na primeira migração.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-md border border-border-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-text-title">
            {seq.name}
          </div>
          <div className="text-[11.5px] text-text-sec">
            {seq.description ?? "Sequência configurável passo a passo."}
          </div>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-text-sec">
          <input
            type="checkbox"
            checked={seq.active}
            onChange={(e) => saveActive.mutate(e.target.checked)}
          />
          {seq.active ? "Ativa" : "Inativa"}
        </label>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="text-left text-text-ter">
            <tr>
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Canal</th>
              <th className="py-1 pr-2">Atraso (min)</th>
              <th className="py-1 pr-2">Tentativas</th>
              <th className="py-1 pr-2">Continua em</th>
              <th className="py-1 pr-2">Ativo</th>
              <th className="py-1 pr-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.id} className="border-t border-border-card">
                <td className="py-1 pr-2">{s.order_index + 1}</td>
                <td className="py-1 pr-2">
                  <select
                    defaultValue={s.channel}
                    className="rounded border border-border-card bg-bg-card px-1 py-0.5"
                    onChange={(e) =>
                      saveStep.mutate({
                        id: s.id,
                        order_index: s.order_index,
                        channel: e.target.value as SequenceChannel,
                        delay_minutes: s.delay_minutes,
                      })
                    }
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">E-mail</option>
                    <option value="phone">Telefone (tarefa)</option>
                  </select>
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="number"
                    min={0}
                    defaultValue={s.delay_minutes}
                    className="w-24 rounded border border-border-card bg-bg-card px-1 py-0.5"
                    onBlur={(e) =>
                      saveStep.mutate({
                        id: s.id,
                        order_index: s.order_index,
                        channel: s.channel,
                        delay_minutes: Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={s.max_attempts ?? 1}
                    className="w-20 rounded border border-border-card bg-bg-card px-1 py-0.5"
                    onBlur={(e) =>
                      saveStep.mutate({
                        id: s.id,
                        order_index: s.order_index,
                        channel: s.channel,
                        delay_minutes: s.delay_minutes,
                        max_attempts: Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="py-1 pr-2 text-text-sec">
                  {(s.continue_on ?? []).join(", ") || "—"}
                </td>
                <td className="py-1 pr-2">
                  <input
                    type="checkbox"
                    defaultChecked={s.active}
                    onChange={(e) =>
                      saveStep.mutate({
                        id: s.id,
                        order_index: s.order_index,
                        channel: s.channel,
                        delay_minutes: s.delay_minutes,
                        active: e.target.checked,
                      })
                    }
                  />
                </td>
                <td className="py-1 pr-2">
                  <button
                    onClick={() => removeStep.mutate(s.id)}
                    className="text-error hover:underline"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={() =>
          saveStep.mutate({
            order_index: Math.max(1, steps.find((step) => step.active && step.channel === "phone")?.order_index ?? steps.length),
            channel: "email",
            delay_minutes: 1440,
            max_attempts: 1,
            continue_on: ["failed", "skipped"],
          })
        }
        className="mt-3 inline-flex h-8 items-center rounded-md border border-border-card bg-bg-card px-3 text-[12px] font-medium text-text-body hover:bg-bg-general"
      >
        + Adicionar e-mail antes da ligação
      </button>

      <div className="mt-3 text-[11px] text-text-ter">
        Ordem WhatsApp → E-mail → Telefone é o padrão obrigatório. Telefone
        cria uma tarefa humana e nunca é disparado automaticamente. Uma
        resposta, opt-out ou handoff pausa a cadência automaticamente.
      </div>
    </div>
  );
}

function HandoffAutomationCard() {
  const getFn = useServerFn(getCompanySettings);
  const updateFn = useServerFn(updateCompanySettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["company-settings"], queryFn: () => getFn() });
  const [strategy, setStrategy] = useState<"manual" | "round_robin" | "least_loaded">("manual");
  const [sla, setSla] = useState(30);
  const [readiness, setReadiness] = useState(70);

  useEffect(() => {
    if (!data) return;
    setStrategy(((data as any).assignment_strategy ?? "manual") as typeof strategy);
    setSla(Number((data as any).handoff_sla_minutes ?? 30));
    setReadiness(Number((data as any).handoff_readiness_score ?? 70));
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () => updateFn({ data: {
      assignment_strategy: strategy,
      handoff_sla_minutes: sla,
      handoff_readiness_score: readiness,
    } }),
    onSuccess: () => {
      toast.success("Distribuição e handoff salvos");
      qc.invalidateQueries({ queryKey: ["company-settings"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  return (
    <div className="mt-4 rounded-md border border-border-card p-4">
      <div className="text-[13px] font-semibold text-text-title">Distribuição e handoff para vendedores</div>
      <div className="mt-1 text-[11.5px] text-text-sec">
        Define quando a Ana transfere a conversa, como escolhe o vendedor e em quanto tempo o atendimento deve ser assumido.
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="block text-[12px]">
          <span className="text-text-sec">Distribuição</span>
          <select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)}
            className="mt-1 h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]">
            <option value="manual">Manual</option>
            <option value="round_robin">Rodízio entre vendedores</option>
            <option value="least_loaded">Menor carteira ativa</option>
          </select>
        </label>
        <label className="block text-[12px]">
          <span className="text-text-sec">SLA para assumir (minutos)</span>
          <input type="number" min={5} max={1440} value={sla} onChange={(e) => setSla(Number(e.target.value))}
            className="mt-1 h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]" />
        </label>
        <label className="block text-[12px]">
          <span className="text-text-sec">Prontidão para handoff (0–100)</span>
          <input type="number" min={0} max={100} value={readiness} onChange={(e) => setReadiness(Number(e.target.value))}
            className="mt-1 h-9 w-full rounded-md border border-border-card bg-bg-card px-2 text-[13px]" />
        </label>
      </div>
      <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
        className="mt-3 inline-flex h-8 items-center rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50">
        {saveMut.isPending ? "Salvando…" : "Salvar distribuição"}
      </button>
    </div>
  );
}
