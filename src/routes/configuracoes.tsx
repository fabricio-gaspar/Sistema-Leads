import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, User, Bell, Shield, Zap, Plus } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui-kit";

export const Route = createFileRoute("/configuracoes")({ component: Configuracoes });

const TABS = [
  { id: "ana", label: "Ana (IA)", icon: Sparkles },
  { id: "equipe", label: "Equipe", icon: User },
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
        {tab === "notificacoes" && <AbaNotif />}
        {tab === "integracoes" && <AbaInt />}
        {tab === "seguranca" && <AbaSeg />}
      </div>
    </div>
  );
}

function AbaAna() {
  const [autonomia, setAutonomia] = useState(70);
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="Comportamento da Ana" hint="Personalize como a IA conversa e qualifica" />
        <div className="space-y-4">
          <Field label="Nome da assistente">
            <input defaultValue="Ana" className="h-9 w-full max-w-xs rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none" />
          </Field>
          <Field label="Tom de voz">
            <select className="h-9 rounded-md border border-border-card bg-bg-card px-3 text-[13px] outline-none">
              <option>Profissional cordial (recomendado)</option>
              <option>Consultivo técnico</option>
              <option>Descontraído</option>
            </select>
          </Field>
          <Field label={`Autonomia da Ana — ${autonomia}%`} hint="Quanto ela pode decidir antes de escalar para um humano">
            <input type="range" min={0} max={100} value={autonomia} onChange={(e) => setAutonomia(Number(e.target.value))} className="w-full max-w-md accent-ia" />
            <div className="mt-1 flex max-w-md justify-between text-[11px] text-text-ter">
              <span>Só sugere</span><span>Escala rápido</span><span>Age sozinha</span>
            </div>
          </Field>
          <Field label="Escalar para humano quando" hint="Selecione os gatilhos">
            <div className="flex flex-wrap gap-2">
              {["Lead pediu proposta", "Score ≥ 85", "Menção a concorrente", "Objeção de preço", "Pedido acima de R$ 100k"].map((t) => (
                <label key={t} className="flex items-center gap-1.5 rounded-full border border-border-card bg-bg-card px-3 py-1 text-[12px] text-text-body">
                  <input type="checkbox" defaultChecked className="accent-primary" /> {t}
                </label>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Horário de atendimento" hint="A Ana responde 24/7; humanos têm horário definido" />
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <Field label="Início"><input type="time" defaultValue="08:00" className="h-9 rounded-md border border-border-card bg-bg-card px-3 text-[13px]" /></Field>
          <Field label="Fim"><input type="time" defaultValue="18:00" className="h-9 rounded-md border border-border-card bg-bg-card px-3 text-[13px]" /></Field>
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
      <SectionTitle title="Equipe de vendas" hint="3 usuários ativos" action={
        <button className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover">
          <Plus className="h-3.5 w-3.5" /> Convidar
        </button>
      } />
      <table className="w-full text-[13px]">
        <thead><tr className="text-left text-[11px] uppercase text-text-ter"><th className="pb-2">Nome</th><th className="pb-2">E-mail</th><th className="pb-2">Perfil</th><th /></tr></thead>
        <tbody className="divide-y divide-border-card">
          {team.map((t) => (
            <tr key={t.e}>
              <td className="py-2.5 font-medium text-text-title">{t.n}</td>
              <td className="py-2.5 text-text-body">{t.e}</td>
              <td className="py-2.5"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{t.r}</span></td>
              <td className="py-2.5 text-right"><button className="text-[12px] text-text-sec hover:text-primary">Editar</button></td>
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
        <thead><tr className="text-left text-[11px] uppercase text-text-ter"><th /><th className="pb-2">E-mail</th><th className="pb-2">Push</th><th className="pb-2">WhatsApp</th></tr></thead>
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
        <Field label="Alterar senha"><input type="password" placeholder="Nova senha" className="h-9 w-full rounded-md border border-border-card bg-bg-card px-3 text-[13px]" /></Field>
        <Field label="Autenticação em 2 fatores" hint="Recomendado para administradores">
          <label className="inline-flex items-center gap-2 text-[13px] text-text-body"><input type="checkbox" className="accent-primary" /> Ativar 2FA por app autenticador</label>
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
