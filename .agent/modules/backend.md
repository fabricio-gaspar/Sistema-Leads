# Backend

- Edge Functions em `supabase/functions/`.
- `ana-run` é a única autoridade automática da Ana.
- `webhook-whatsapp` normaliza e deduplica entrada; `automation-worker` processa saída.
- Funções administrativas devem autenticar sessão, resolver organização ativa, validar papel,
  aplicar políticas e auditar sem expor segredos.
- Não chamar provedor direto do navegador.
