# Fase 3 — Listas, cadências e CPQ

Inclui o domínio relacional para listas de leads, membros, campanhas com
cadência controlada e linhas de proposta. Todas as entidades são vinculadas a
`organization_id`, protegidas por RLS e usam relações compostas para impedir
referências entre empresas.

Aplicar após as migrations das Fases 1 e 2:

```text
supabase/migrations/20260826200531_phase_3_lists_campaigns_cpq.sql
```

Regras: uma campanha inicia como rascunho; lote-piloto e ativação exigem fluxo
operacional explícito; envio externo continua exclusivamente na outbox da Fase
1. Itens e versões de proposta devem ser persistidos antes de qualquer PDF ou
envio sandbox.
