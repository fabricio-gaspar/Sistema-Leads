export function SupabaseConfigurationRequired() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[oklch(var(--background-50))] px-6">
      <section className="w-full max-w-2xl rounded-2xl border border-[oklch(var(--secondary-200))] bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[oklch(var(--primary-700))]">Configuração necessária</p>
        <h1 className="mt-3 text-2xl font-bold text-[oklch(var(--foreground-900))]">Conecte o ambiente Supabase para iniciar o CRM</h1>
        <p className="mt-3 text-sm leading-6 text-[oklch(var(--foreground-600))]">
          Este ambiente ainda não possui a URL e a chave pública do projeto. Nenhum dado foi enviado nem uma integração externa foi ativada.
        </p>
        <div className="mt-6 rounded-lg bg-[oklch(var(--background-100))] p-4 font-mono text-sm text-[oklch(var(--foreground-700))]">
          <p>VITE_PUBLIC_SUPABASE_URL=https://&lt;project-ref&gt;.supabase.co</p>
          <p className="mt-2">VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...</p>
        </div>
        <p className="mt-5 text-xs leading-5 text-[oklch(var(--foreground-500))]">
          Em projetos legados, VITE_PUBLIC_SUPABASE_ANON_KEY continua compatível. Nunca use service role ou secret key no navegador.
        </p>
      </section>
    </main>
  );
}
