# Backend

## 05/10/2026 — R4/R6/R8/R11 locais

Administração de equipe controla vínculo/convite, não identidade global Auth. Entrada usa etapa local atômica e lease; provisionamento automático compartilha ledger de lifecycle; recuperação só encerra consulta comprovada por GET/CAS e mantém corte. Ana/worker revalidam contexto comercial e autorização antes dos efeitos; pedido de orçamento continua rascunho humano. Rotina paga exige cidade, uma UF e termo no handler e guard SQL. Sem deploy; contratos e limites em `docs/remediacao/2026-10-05-r4-r14/`.

## 05/10/2026 — R2/R3 locais e type-check integral, não publicados

Handlers WA/Evolution usam `accountLifecycle`: intenção/corte persistente antes do remoto, token/revisão, revalidação entre etapas de provisionamento manual e conclusão CAS. Falha após efeito incerto mantém bloqueio, sem repetir POST. Consumidores recebem lifecycle público sem token; 202/409 não são sucesso de conexão. Recibos tardios autenticados são conciliados por escopo sem reabrir gates/Ana; callback conectado não restaura enabled/paused. Todas as Edge Functions agora entram no type-check (nove diagnósticos corrigidos). Recuperação manual e workers automáticos fora do ledger permanecem R6. Nenhuma Edge publicada nesta etapa.

- O E2E controlado confirmou a proteção pós-aceite: quando a Z-API aceitou e a persistência local falhou, `automation-worker` gravou `provider_accepted_reconciliation_required` com o ID remoto e não repetiu o envio. Depois da correção do trigger, a RPC canônica reconciliou o mesmo aceite como `processed/sent`.

- O caminho canônico `ana-run` → `resolve_lead_whatsapp_account` voltou a obter a conta/integração corporativa depois da correção SQL de ambiguidade. Nenhuma Edge Function foi substituída ou publicada nesta correção; `ana-run` continua sendo a única autoridade automática e a fila existente continua sendo a única via de saída.

- `ana-operations` v4 expõe `set_automatic` para sessão administrativa. A ação reutiliza a agenda existente, revalida readiness e roteamento e delega a persistência atômica à RPC exclusiva de `service_role`; não chama Apify, IA ou WhatsApp.

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

## Meta Coexistence — 24/09/2026

- `webhook-meta-whatsapp` v2: verificação GET, HMAC POST, ledger idempotente, parser de mensagens,
  status, eco e sincronização; retry é auditável e não persiste payload integral.
- `meta-whatsapp-onboarding` v1 e `meta-whatsapp-messages` v1 exigem JWT; o primeiro grava segredo
  no Vault e o segundo somente reserva a outbox transacional depois de revalidar permissões/gates.
- `meta-whatsapp-worker` v2 exige token interno, faz claim atômico, aplica retry/DLQ e não repete
  automaticamente um envio aceito pelo provedor quando a gravação local ficou ambígua.
- `whatsapp-accounts` v2 preserva ações Z-API e rejeita mistura de provedor. `ana-run` não foi
  substituída nem duplicada.
