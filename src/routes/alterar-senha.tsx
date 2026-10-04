import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { completeTemporaryPasswordChange } from "@/lib/crm.functions";

export const Route = createFileRoute("/alterar-senha")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AlterarSenha,
});

function AlterarSenha() {
  const navigate = useNavigate();
  const complete = useServerFn(completeTemporaryPasswordChange);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (password.length < 12) return setError("Use ao menos 12 caracteres na nova senha.");
    if (password !== confirm) return setError("As senhas não conferem.");
    setPending(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await complete();
      navigate({ to: "/", replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível alterar sua senha.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-general px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-border-card bg-bg-card p-8 shadow-lg"
      >
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-text-title">Atualize sua senha</h1>
            <p className="mt-1 text-[12px] text-text-sec">
              Este é seu primeiro acesso. Defina uma senha pessoal antes de continuar.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase text-text-ter">
              Nova senha
            </span>
            <input
              autoFocus
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 w-full rounded-md border border-border-card bg-bg-general px-3 text-[13px]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase text-text-ter">
              Confirmar senha
            </span>
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="h-10 w-full rounded-md border border-border-card bg-bg-general px-3 text-[13px]"
            />
          </label>
          {error && (
            <div className="rounded-md bg-error-bg px-3 py-2 text-[12px] text-error">{error}</div>
          )}
          <button
            disabled={pending}
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-[13px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Salvando…" : "Salvar e continuar"}
          </button>
        </div>
      </form>
    </div>
  );
}
