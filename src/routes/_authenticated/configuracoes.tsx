import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, User, Bell, Shield, Zap, Loader2, Check, ClipboardList, AlertCircle, Package, MessageSquareWarning, Gauge, HelpCircle, Plus, Trash2, Plug, Search } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getCompanySettings,
  updateCompanySettings,
  listTeam,
  setUserRole,
  updateTeamMember,
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
} from "@/lib/crm.functions";

type TabId = "ana" | "prospeccao" | "equipe" | "servicos" | "objecoes" | "score" | "governanca" | "auditoria" | "notificacoes" | "integracoes" | "seguranca";
export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: Configuracoes,
  validateSearch: (s: Record<string, unknown>): { tab?: TabId } => {
    const t = s.tab;
    const valid: TabId[] = ["ana","prospeccao","equipe","servicos","objecoes","score","governanca","auditoria","notificacoes","integracoes","seguranca"];
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
        {tab === "seguranca" && <AbaSeg />}
      </div>
    </div>
  );
}


const DEFAULT_PROMPT = `Você é Ana, vendedora virtual da WF Digital.
Seja consultiva, cordial, objetiva e comercial.
Reposicione objeções (preço, "vou pensar", concorrente) com valor.
Responda em português do Brasil, mensagens curtas de WhatsApp (2 a 4 frases).`;

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

  useEffect(() => {
    if (!data) return;
    if (data.ai_model) setModel(data.ai_model);
    if (data.ai_temperature != null) setTemperature(Number(data.ai_temperature));
    if (data.ai_max_tokens != null) setMaxTokens(Number(data.ai_max_tokens));
    if (data.ai_prompt) setPrompt(data.ai_prompt);
    if (data.tone_of_voice) setTone(data.tone_of_voice);
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
  const { data, isLoading, error } = useQuery({ queryKey: ["team"], queryFn: () => listFn() });

  const setRoleMut = useMutation({
    mutationFn: (v: { user_id: string; role: "administrador" | "vendedor" | "sdr" | "cx" }) =>
      setRoleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });
  const toggleActiveMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) =>
      updateFn({ data: { id: v.id, patch: { active: v.active } } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });

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
        <SectionTitle title="Equipe" hint={`${data?.length ?? 0} usuário(s)`} />
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase text-text-ter">
              <th className="pb-2">Nome</th>
              <th className="pb-2">E-mail</th>
              <th className="pb-2">Perfil</th>
              <th className="pb-2">Status</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-card">
            {(data ?? []).map((t) => {
              const currentRole = (t.roles?.[0] as string | undefined) ?? "vendedor";
              return (
                <tr key={t.id}>
                  <td className="py-2.5 font-medium text-text-title">{t.name ?? "—"}</td>
                  <td className="py-2.5 text-text-body">{t.email ?? "—"}</td>
                  <td className="py-2.5">
                    <select
                      value={currentRole}
                      onChange={(e) =>
                        setRoleMut.mutate({
                          user_id: t.id,
                          role: e.target.value as "administrador" | "vendedor" | "sdr" | "cx",
                        })
                      }
                      className="h-8 rounded-md border border-border-card bg-bg-card px-2 text-[12px] outline-none"
                    >
                      {Object.entries(ROLE_LABEL).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${t.active ? "bg-success-bg text-success" : "bg-error-bg text-error"}`}
                    >
                      {t.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => toggleActiveMut.mutate({ id: t.id, active: !t.active })}
                      className="text-[12px] text-text-sec hover:text-primary"
                    >
                      {t.active ? "Desativar" : "Reativar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 text-[11.5px] text-text-ter">
          Novos usuários são criados através da tela de cadastro (/auth) — perfil padrão: Vendedor.
        </div>
      </Card>
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
  const { data = [], isLoading } = useQuery({ queryKey: ["notifications"], queryFn: () => listFn() });

  const markMut = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => {
      toast.success("Todas marcadas como lidas");
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["sidebar-counts"] });
    },
  });

  const unread = data.filter((n) => !n.read).length;

  return (
    <Card>
      <SectionTitle
        title="Notificações"
        hint={`${data.length} recente(s) · ${unread} não lida(s)`}
        action={
          <button
            onClick={() => markMut.mutate()}
            disabled={markMut.isPending || unread === 0}
            className="rounded-md border border-border-card bg-bg-card px-3 py-1.5 text-[12px] hover:bg-bg-general disabled:opacity-50"
          >
            {markMut.isPending ? "…" : "Marcar todas como lidas"}
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
              <div className="min-w-0">
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
              {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AbaInt() {
  const listFn = useServerFn(listIntegrations);
  const { data = [], isLoading } = useQuery({ queryKey: ["integrations"], queryFn: () => listFn() });

  return (
    <Card>
      <SectionTitle title="Integrações" hint="Status real de cada canal — leituras da tabela integrations" />
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
                <span className="rounded-full bg-success-bg px-2 py-0.5 text-[10.5px] font-semibold text-success">
                  Conectado
                </span>
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
    </Card>
  );
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
type UQ = { id: string; text: string; count: number | null; resolved: boolean | null; created_at: string };

function AbaGovernanca() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUnansweredQuestions);
  const resolveFn = useServerFn(resolveUnansweredQuestion);
  const delFn = useServerFn(deleteUnansweredQuestion);
  const { data = [], isLoading } = useQuery<UQ[]>({ queryKey: ["unanswered"], queryFn: () => listFn() as Promise<UQ[]> });
  const resolve = useMutation({
    mutationFn: (vars: { id: string; resolved: boolean }) => resolveFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unanswered"] }),
  });
  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["unanswered"] }) });

  const abertas = data.filter((q) => !q.resolved);
  const resolvidas = data.filter((q) => q.resolved);

  return (
    <div className="space-y-4">
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
                  <button onClick={() => resolve.mutate({ id: q.id, resolved: true })} className="rounded-md bg-success-bg px-2.5 py-1 text-[11.5px] font-medium text-success">
                    Marcar resolvida
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
                <div className="text-[12.5px] text-text-sec line-through">{q.text}</div>
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
        <b>Como adicionar a chave do Google Places:</b> peça ao administrador para cadastrar a secret <code>GOOGLE_PLACES_API_KEY</code> no cofre do projeto. Gere a chave em console.cloud.google.com → APIs & Services → Credentials, e ative a <i>Places API (New)</i>.
      </div>
    </Card>
  );
}

