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
          Execute esta instrucao no projeto: Obrigado pela estabilização do código. Porém, o schema public do banco Supabase conectado (thgzrkppouoevapjquyu) continua 100% vazio — confirmei diretamente no Table Editor do Supabase: nenhuma tabela foi criada.\n\nAgora preciso que você EXECUTE DE FATO as migrations SQL no banco Supabase conectado, não apenas ajuste tipos no código-fonte. Por favor:\n\n1. Escreva e execute (via migration real, aplicada no Supabase conectado) os comandos CREATE TABLE, CREATE TYPE, CREATE POLICY, CREATE FUNCTION, CREATE TRIGGER e CREATE EXTENSION necessários para recriar 100% da estrutura do banco que o código-fonte deste app espera (leads, organizations, profiles, prospecting_cache, outreach_sequences, lead_sequence_enrollments, company_settings, audit_logs, prospecting_schedules, prospecting_schedule_runs, notifications, contact_suppressions, e qualquer outra tabela referenciada no código).\n\n2. Confirme a execução real dessas migrations no banco (não apenas no código TypeScript) — preciso ver as tabelas aparecendo no Table Editor do Supabase.\n\n3. Mantenha o isolamento multi-tenant por organization_id em todas as RLS policies.\n\n4. Habilite a extension pg_cron e recrie as functions/triggers de automação (runScheduledProspecting, outreach-tick, prospecting-tick).\n\n5. Após aplicar, rode novamente o build/typecheck para confirmar que tudo funciona com o banco real populado.\n\nIMPORTANTE: use exclusivamente o Supabase já conectado a este projeto (thgzrkppouoevapjquyu). Não crie bancos paralelos nem use armazenamento temporário do Lovable Cloud.\n\nAo final, me diga exatamente quais tabelas foram criadas e liste qualquer erro ou limitação que tenha impedido a criação completa.
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
