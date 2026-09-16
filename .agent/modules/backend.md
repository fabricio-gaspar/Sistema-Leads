# Backend

- Edge Functions em `supabase/functions/`.
- `ana-run` é a única autoridade automática da Ana.
- A Base aprovada da Ana é consultada por organização em `documents`/`knowledge_chunks`; cada
  resposta recuperada pode levar a URL de sua fonte pública, mas preço, prazo, certificação e
  especificações continuam sujeitos a handoff humano/técnico.
- `webhook-whatsapp` normaliza e deduplica entrada; `automation-worker` processa saída.
- Funções administrativas devem autenticar sessão, resolver organização ativa, validar papel,
  aplicar políticas e auditar sem expor segredos.
- Não chamar provedor direto do navegador.

- `lead-governance` expõe snapshot e exclusão somente para sessão autenticada com permissão. A
  exclusão exige quantidade/seleção e confirmação textual, e reaproveita a procedure transacional
  de limpeza do grafo operacional.
- `site-whatsapp-entry` salva somente configuração pública do link do site. `webhook-whatsapp`
  preserva matching ambíguo bloqueado e só cria um novo lead a partir de marcador ativo.
