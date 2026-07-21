import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"validating" | "ready" | "invalid">("validating");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // O SDK Supabase parseia o hash (#access_token=…&type=recovery) e cria a sessão de recovery.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setState("ready");
        return;
      }
      // Aguarda o onAuthStateChange por até 5s.
      const { data: sub } = supabase.auth.onAuthStateChange((_ev, sess) => {
        if (!mounted) return;
        if (sess) {
          setState("ready");
          if (timer) clearTimeout(timer);
          sub.subscription.unsubscribe();
        }
      });
      timer = setTimeout(() => {
        if (!mounted) return;
        sub.subscription.unsubscribe();
        setState((s) => (s === "ready" ? s : "invalid"));
      }, 5000);
    });

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (password.length < 8) return setError("A senha deve ter ao menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");
    setPending(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
      // Encerra a sessão temporária de recovery antes de redirecionar ao login.
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/auth", replace: true }), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao redefinir a senha.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-general px-4">
      <div className="w-full max-w-md rounded-xl border border-border-card bg-bg-card p-8 shadow-lg">
        <div className="mb-6">
          <div className="text-base font-semibold text-text-title">Redefinir senha</div>
          <div className="text-[12px] text-text-sec">Defina uma nova senha para acessar sua conta.</div>
        </div>

        {state === "validating" && !done && (
          <div className="flex items-center gap-2 rounded-md bg-bg-general px-3 py-2 text-[12px] text-text-sec">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validando link de redefinição…
          </div>
        )}

        {state === "invalid" && !done && (
          <div className="rounded-md bg-warm-bg px-3 py-2 text-[12px] text-warm">
            Link inválido ou expirado. Solicite um novo em <a href="/auth" className="underline">/auth</a>.
          </div>
        )}

        {done && (
          <div className="rounded-md bg-success-bg px-3 py-2 text-[12px] text-success">
            Senha atualizada. Redirecionando para o login…
          </div>
        )}


        {ready && !done && (
          <form onSubmit={onSubmit} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-ter">Nova senha</span>
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-10 rounded-md border border-border-card bg-bg-general px-3 text-[13px]" minLength={8} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-ter">Confirmar</span>
              <input required type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full h-10 rounded-md border border-border-card bg-bg-general px-3 text-[13px]" minLength={8} />
            </label>
            {error && <div className="rounded-md bg-error-bg px-3 py-2 text-[12px] text-error">{error}</div>}
            <button type="submit" disabled={pending} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-[13px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar nova senha
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
