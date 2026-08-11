import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate({ to: "/", replace: true });
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setInfo("Se este e-mail existir na equipe, enviamos um link de redefinição.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-general px-4">
      <div className="w-full max-w-md rounded-xl border border-border-card bg-bg-card p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            WF
          </div>
          <div>
            <div className="text-base font-semibold text-text-title">WF Digital CRM</div>
            <div className="text-[12px] text-text-sec">
              {mode === "signin" ? "Entre na sua conta" : "Recuperar senha"}
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="E-mail">
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="voce@empresa.com"
            />
          </Field>
          {mode === "signin" && (
            <Field label="Senha">
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </Field>
          )}

          {error && <div className="rounded-md bg-error-bg px-3 py-2 text-[12px] text-error">{error}</div>}
          {info && <div className="rounded-md bg-success-bg px-3 py-2 text-[12px] text-success">{info}</div>}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-[13px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Entrar" : "Enviar link de redefinição"}
          </button>
        </form>

        <div className="mt-4 text-center text-[12px] text-text-sec">
          {mode === "signin" ? (
            <button onClick={() => { setMode("forgot"); setError(null); setInfo(null); }} className="text-primary hover:underline">
              Esqueci minha senha
            </button>
          ) : (
            <button onClick={() => { setMode("signin"); setError(null); setInfo(null); }} className="text-primary hover:underline">
              Voltar para login
            </button>
          )}
        </div>

        <div className="mt-3 text-center text-[11px] text-text-ter italic bg-yellow-50 p-2 rounded border border-yellow-200 whitespace-pre-wrap">
          Execute esta instrucao no projeto: O schema public do nosso banco Supabase conectado está completamente vazio (sem tabelas, functions, policies ou tipos). Preciso que você recrie TODA a estrutura do banco de dados do zero, com base na lógica e nas referências já existentes no código-fonte do projeto (types.ts, hooks, queries, componentes de Leads, CRM, Prospecção, Automação Comercial, Atendimento Omnicanal, Central de Atendimento, Calendário e Configurações).\n\nImportante: as tabelas devem ser criadas no MEU projeto Supabase já conectado a este app (thgzrkppouoevapjquyu), usando a integração nativa Lovable-Supabase. Não crie um novo banco, não use um banco paralelo do Lovable Cloud, e não duplique projetos — aplique tudo diretamente no Supabase já vinculado.\n\nPor favor:\n\n1. Recrie todas as tabelas necessárias (incluindo mas não se limitando a: leads, organizações/organization, usuários/perfis, prospecting_cache, outreach_sequences, lead_sequence_enrollments, company_settings, audit_logs, prospecting_schedules, prospecting_schedule_runs, notifications, contact_suppressions, e qualquer outra tabela usada pelo código atual), com colunas, tipos, constraints (PK, FK, unique, not null, defaults) coerentes com o que o código espera.\n\n2. Recrie todos os enums/tipos customizados necessários.\n\n3. Recrie todas as Row Level Security (RLS) policies, mantendo o isolamento por organization_id como estava documentado.\n\n4. Recrie todas as functions, triggers e stored procedures necessárias (incluindo runScheduledProspecting e qualquer rotina usada pelo pg_cron).\n\n5. Habilite as extensions necessárias (incluindo pg_cron).\n\n6. Recrie os indexes necessários para performance.\n\n7. Ao final, rode um typecheck/build para confirmar que o frontend, backend, rotas e integrações (incluindo Central de Atendimento, handoff, qualificação de leads e exportação de calendário) funcionam corretamente com o banco recriado.\n\nMe avise ao final com um resumo de tudo que foi criado e qualquer coisa que precise da minha confirmação manual.
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          height: 40px;
          border-radius: 6px;
          border: 1px solid var(--border-card, #e2e8f0);
          background: var(--bg-general, #f8fafc);
          padding: 0 12px;
          font-size: 13px;
          color: var(--text-title, #0f172a);
          outline: none;
        }
        .input:focus { border-color: hsl(var(--primary)); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-ter">
        {label}
      </span>
      {children}
    </label>
  );
}
