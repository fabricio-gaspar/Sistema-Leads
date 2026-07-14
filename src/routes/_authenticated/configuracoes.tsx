import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, User, Bell, Shield, Zap, Loader2, Check, ClipboardList, AlertCircle } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";
import {
  getCompanySettings,
  updateCompanySettings,
  listTeam,
  setUserRole,
  updateTeamMember,
  listAuditLogs,
} from "@/lib/crm.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({ component: Configuracoes });

const TABS = [
  { id: "ana", label: "Ana (IA)", icon: Sparkles },
  { id: "equipe", label: "Equipe", icon: User },
  { id: "auditoria", label: "Auditoria", icon: ClipboardList },
  { id: "notificacoes", label: "Notificações", icon: Bell },
  { id: "integracoes", label: "Integrações", icon: Zap },
  { id: "seguranca", label: "Segurança", icon: Shield },
] as const;

function Configuracoes() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("ana");

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
        {tab === "equipe" && <AbaEquipe />}
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

function AbaEquipe() {
  const team = [
    { n: "Fabrício Rocha", e: "fabricio@wfdigital.com.br", r: "Administrador" },
    { n: "Camila Souza", e: "camila@wfdigital.com.br", r: "Vendedor Sr." },
    { n: "Diego Martins", e: "diego@wfdigital.com.br", r: "Vendedor" },
  ];
  return (
    <Card>
      <SectionTitle
        title="Equipe de vendas"
        hint="3 usuários ativos"
        action={
          <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover">
            <Plus className="h-3.5 w-3.5" /> Convidar
          </button>
        }
      />
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase text-text-ter">
            <th className="pb-2">Nome</th>
            <th className="pb-2">E-mail</th>
            <th className="pb-2">Perfil</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-border-card">
          {team.map((t) => (
            <tr key={t.e}>
              <td className="py-2.5 font-medium text-text-title">{t.n}</td>
              <td className="py-2.5 text-text-body">{t.e}</td>
              <td className="py-2.5">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{t.r}</span>
              </td>
              <td className="py-2.5 text-right">
                <button className="text-[12px] text-text-sec hover:text-primary">Editar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function AbaNotif() {
  const items = [
    "Novo lead quente (score ≥ 85)",
    "Ana escalou lead para você",
    "Proposta visualizada pelo cliente",
    "Lead parado há mais de 2 dias",
    "Pedido confirmado",
  ];
  return (
    <Card>
      <SectionTitle title="Notificações" hint="Escolha o canal de cada evento" />
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase text-text-ter">
            <th />
            <th className="pb-2">E-mail</th>
            <th className="pb-2">Push</th>
            <th className="pb-2">WhatsApp</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-card">
          {items.map((i) => (
            <tr key={i}>
              <td className="py-2.5 text-text-body">{i}</td>
              <td className="py-2.5"><input type="checkbox" defaultChecked className="accent-primary" /></td>
              <td className="py-2.5"><input type="checkbox" defaultChecked className="accent-primary" /></td>
              <td className="py-2.5"><input type="checkbox" className="accent-primary" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function AbaInt() {
  return (
    <Card>
      <SectionTitle title="Integrações" />
      <div className="grid grid-cols-2 gap-3">
        {[
          { n: "WhatsApp Business", d: "Canal principal da Ana", ok: true },
          { n: "E-mail (SMTP)", d: "Envio de propostas", ok: true },
          { n: "ERP Bling", d: "Sincroniza pedidos", ok: false },
          { n: "Meta Ads", d: "Importa leads de campanhas", ok: false },
        ].map((i) => (
          <div key={i.n} className="flex items-center justify-between rounded-md border border-border-card p-3">
            <div>
              <div className="text-[13px] font-semibold text-text-title">{i.n}</div>
              <div className="text-[11.5px] text-text-sec">{i.d}</div>
            </div>
            <button className={`rounded-md px-3 py-1.5 text-[12px] font-medium ${i.ok ? "bg-success-bg text-success" : "bg-primary text-primary-foreground"}`}>
              {i.ok ? "Conectado" : "Conectar"}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AbaSeg() {
  return (
    <Card>
      <SectionTitle title="Segurança" />
      <div className="space-y-3 max-w-md">
        <Field label="Alterar senha">
          <input type="password" placeholder="Nova senha" className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px]" />
        </Field>
        <Field label="Autenticação em 2 fatores" hint="Recomendado para administradores">
          <label className="inline-flex items-center gap-2 text-[13px] text-text-body">
            <input type="checkbox" className="accent-primary" /> Ativar 2FA por app autenticador
          </label>
        </Field>
      </div>
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
