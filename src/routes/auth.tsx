import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

function formatAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  if (!message || message === "{}" || normalized.includes("failed to fetch")) {
    return "Não foi possível comunicar com o serviço de autenticação. Tente novamente em instantes.";
  }
  if (normalized.includes("redirect") || normalized.includes("not allowed")) {
    return "O endereço de retorno da recuperação não está autorizado no Supabase. Adicione este domínio e a rota /reset-password em Authentication → URL Configuration.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Muitas tentativas recentes. Aguarde alguns minutos antes de solicitar outro link.";
  }
  return message;
}

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
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
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
        const loginEmail = email.trim().toLowerCase();
        const { error: err } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (err) throw err;
        navigate({ to: "/", replace: true });
      } else if (mode === "signup") {
        const activationEmail = email.trim().toLowerCase();
        const emailRedirectTo = new URL("/auth", window.location.origin).toString();
        const { error: err } = await supabase.auth.signUp({
          email: activationEmail,
          password,
          options: { emailRedirectTo },
        });
        if (err) throw err;
        setInfo("Se houver um convite ativo para este e-mail, enviamos a confirmação de acesso. Depois de confirmar, entre com sua senha.");
      } else {
        const recoveryEmail = email.trim().toLowerCase();
        const redirectTo = new URL("/reset-password", window.location.origin).toString();
        const { error: err } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
          redirectTo,
        });
        if (err) throw err;
        setInfo("Se este e-mail existir na equipe, enviamos um link de redefinição.");
      }
    } catch (err) {
      setError(formatAuthError(err));
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
              {mode === "signin" ? "Entre na sua conta" : mode === "signup" ? "Ative seu acesso por convite" : "Recuperar senha"}
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
          {mode !== "forgot" && (
            <Field label="Senha">
              <input
                required
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
            {mode === "signin" ? "Entrar" : mode === "signup" ? "Ativar acesso" : "Enviar link de redefinição"}
          </button>
        </form>

        <div className="mt-4 text-center text-[12px] text-text-sec">
          {mode === "signin" ? (
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => { setMode("forgot"); setError(null); setInfo(null); }} className="text-primary hover:underline">
                Esqueci minha senha
              </button>
              <span className="text-text-ter">·</span>
              <button onClick={() => { setMode("signup"); setError(null); setInfo(null); }} className="text-primary hover:underline">
                Ativar convite
              </button>
            </div>
          ) : (
            <button onClick={() => { setMode("signin"); setError(null); setInfo(null); }} className="text-primary hover:underline">
              Voltar para login
            </button>
          )}
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
