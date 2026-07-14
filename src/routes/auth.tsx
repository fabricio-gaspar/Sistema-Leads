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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        if (password.length < 8) throw new Error("A senha deve ter ao menos 8 caracteres.");
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name: name || email.split("@")[0] },
          },
        });
        if (err) throw err;
      }
      navigate({ to: "/", replace: true });
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
              {mode === "signin" ? "Entre na sua conta" : "Crie sua conta"}
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" && (
            <Field label="Nome">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Seu nome"
              />
            </Field>
          )}
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
          <Field label="Senha">
            <input
              required
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              minLength={mode === "signup" ? 8 : undefined}
            />
          </Field>

          {error && (
            <div className="rounded-md bg-error-bg px-3 py-2 text-[12px] text-error">{error}</div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-[13px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <div className="mt-4 text-center text-[12px] text-text-sec">
          {mode === "signin" ? (
            <>
              Não tem conta?{" "}
              <button onClick={() => setMode("signup")} className="text-primary hover:underline">
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já tem conta?{" "}
              <button onClick={() => setMode("signin")} className="text-primary hover:underline">
                Entrar
              </button>
            </>
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
