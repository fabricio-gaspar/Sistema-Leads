
# Auditoria Sistema-Leads (Fase 1 — nada aplicado ainda)

## 1. Já existe e funciona

- **Auth + roles**: `profiles`, `user_roles` (`administrador`, `vendedor`, `sdr`, `cx`), gate em `_authenticated/route.tsx`, vendedor puro é redirecionado para `/atendimento`.
- **Core comercial**: `leads`, `lead_messages` (com `provider_message_id` para dedup), `lead_tasks`, `lead_outreach`, `proposals`, `orders`, `services`, `objections`, `documents`, `notifications`, `audit_logs`, `integrations`, `company_settings`, `contact_suppressions`, `score_weights`, `prospecting_cache`, `vendor_sessions`.
- **Prospecção**: CNPJ.ws, Google Places (com raio 1–50 km e cálculo de distância), Apify, sugestões IA; salva buscas; seleção em massa; importação com dedup por CNPJ/telefone/email.
- **Cadência WhatsApp→E-mail→Ligação** com `lead_outreach`, `contact_channels`, `active_channel`, `next_action_at`, `ai_paused`, `opt_out`.
- **Z-API**: envio + webhook (`/api/public/zapi-webhook`) com dedup por `provider_message_id`, status delivered/read/replied, detecção de opt-out e interesse (handoff).
- **Resend**: envio + webhook Svix (`/api/public/resend-webhook`) com verificação de assinatura.
- **Cron**: `/api/public/outreach-tick` protegido por `OUTREACH_CRON_SECRET`, marca timeout como `skipped` e chama próximo canal.
- **IA Ana**: `chatWithAna` com base em serviços, objeções, documentos textuais, FAQ; classifica intenção e move Kanban (Qualificado/Proposta/Negociação/Perdido); `unanswered_questions` para perguntas sem resposta.
- **Central de Atendimento**: badges SLA (verde/amarelo/vermelho), filtros, ações rápidas.
- **Relatórios**: filtro Mensal/Trimestral/Semestral/Anual; funil, canal, vendedores.
- **Storage**: buckets `docs`, `avatars`, `contracts`.
- **Orçamentos**: templates por categoria do catálogo, auto-avanço do Kanban.

## 2. Existe, mas está incompleto ou inseguro

| Item | Problema |
|---|---|
| Etapa do lead | `leads.stage` muda, mas não há **histórico imutável** (`lead_stage_history`). Auditoria hoje mistura tudo em `audit_logs` como texto. |
| Atribuição de vendedor | Só `leads.assigned_to`. Sem histórico de transferências (quem, quando, motivo). |
| Contatos do lead | Um único `whatsapp`/`email`/`phone` no `leads`. Sem múltiplos contatos, sem verificação, sem preferencial. |
| Cadência | `outreach-tick` varre `leads.next_action_at` diretamente. Sem fila com lock → risco de execução concorrente entre cron/webhook/ação manual. Sem `idempotency_key` na fila. |
| Webhooks | Sem tabela `webhook_events` para dedup por evento + reprocessamento. Dedup atual só existe por mensagem. |
| Base de conhecimento IA | `documents.content_text` é o texto inteiro; sem fragmentação (`knowledge_chunks`). PDF/DOCX não têm extração — o sistema já reconhece isso, mas não há indexador. |
| Opt-out | `contact_suppressions` bloqueia envios, mas não há trilha de **evento de consentimento** (`consent_events`) com origem/texto/data. |
| Prospecção auditável | Resultados vivem em `prospecting_cache` (JSON). Sem tabelas normalizadas para busca/resultado revisável (`prospecting_searches`, `prospecting_results`). |
| RLS | Precisa **revisão completa** de qualquer `USING (true)`; garantir que vendedor só leia próprios leads/mensagens/tarefas/propostas/outreach. |
| Notas internas | Não existe `lead_notes` separado do chat do cliente. Hoje qualquer texto vira mensagem. |
| Central de Atendimento vs Leads | Duas telas com sobreposição. Auditar se vendedor consegue acessar `/leads`, `/relatorios`, etc. via URL direta (RLS + guard de rota). |

## 3. Não existe e precisa ser criado

- Histórico de etapa e histórico de atribuição.
- Múltiplos contatos por lead + normalização/hash.
- Fila `outreach_jobs` com lock + idempotência.
- Tabela `webhook_events` para dedup/reprocesso.
- `knowledge_chunks` (indexação de documentos).
- `consent_events` (trilha auditável).
- `lead_notes` (visibilidade interna).
- Guard de rota por role para `/leads`, `/relatorios`, `/prospeccao`, `/configuracoes`, `/empresa`, `/orcamentos`, `/pedidos`, `/diagnostico` (hoje o gate redireciona vendedor puro só se estiver fora de `/atendimento` — está OK, mas RLS ainda precisa ser a fronteira final).

## 4. Tabelas / migrations necessárias

### 4.1 Obrigatórias agora (aditivas, sem drop)

1. **`lead_stage_history`** — id, lead_id, from_stage, to_stage, changed_by, reason, source (`ia|human|system`), created_at. Trigger em `leads` para popular automaticamente.
2. **`lead_assignments`** — id, lead_id, from_user, to_user, changed_by, reason, source, created_at. Trigger em `leads.assigned_to`.
3. **`contact_points`** — id, lead_id, kind (`whatsapp|phone|email|site`), value, value_normalized, value_hash, verified, preferred, status, source, created_at, updated_at. Backfill dos campos atuais de `leads`. Não remover colunas antigas nesta fase.
4. **`outreach_jobs`** — id, lead_id, channel, payload jsonb, status (`queued|locked|done|failed|cancelled`), attempt, idempotency_key (unique), run_at, locked_at, locked_by, processed_at, error, created_at. `outreach-tick` passa a consumir a fila.
5. **`webhook_events`** — id, provider (`zapi|resend|apify|other`), external_id (unique com provider), event_type, payload_sha, status, processed_at, error, lead_id, outreach_id, created_at.
6. **`knowledge_chunks`** — id, document_id, chunk_index, content, tokens, embedding (opcional `vector`), version, status, created_at. `chatWithAna` passa a montar contexto a partir dos chunks relevantes.
7. **`consent_events`** — id, lead_id, contact_point_id, event (`opt_in|opt_out|complaint|resubscribe`), channel, source (`client_reply|admin|webhook`), text, actor_id, created_at.
8. **`lead_notes`** — id, lead_id, author_id, body, visibility (`internal`), created_at, updated_at.

Todas com: `GRANT` para `authenticated`/`service_role`, RLS habilitado, políticas escopadas por `owner_id`/`assigned_to`/role admin, `updated_at` trigger onde aplicável.

### 4.2 Recomendadas para fase posterior (não aplicar agora)

- `organizations` + `organization_members` + `organization_id` em entidades comerciais (multi-tenant real). Como hoje o produto é da WAYFLEX, documentar decisão de operar single-tenant e reforçar RLS.
- `prospecting_searches` + `prospecting_results` substituindo gradualmente `prospecting_cache`.
- `campaigns`, `lead_campaigns`, `tags`, `lead_tags`.
- Views/materialized views para relatórios pesados.

### 4.3 Revisão de RLS (obrigatória, sem novas tabelas)

- Auditar cada política existente; substituir qualquer `USING (true)` em tabelas com dados do lead.
- Vendedor: SELECT/UPDATE apenas quando `assigned_to = auth.uid()` ou `owner_id = auth.uid()`.
- Admin: `has_role(auth.uid(),'administrador')`.
- Aplicar o mesmo padrão em `lead_messages`, `lead_tasks`, `lead_outreach`, `proposals`, `orders`, `lead_notes`, `contact_points`, `consent_events`, `lead_stage_history`, `lead_assignments`.

## 5. Impacto e risco

- Todas as migrations propostas são **aditivas** (novas tabelas + colunas + triggers). Nenhuma coluna existente será removida nesta fase.
- Backfill de `contact_points` a partir de `leads.whatsapp/email/phone` é idempotente.
- Cadência migra para `outreach_jobs` sem parar a atual: primeiro a fila passa a ser populada em paralelo; num segundo momento o `outreach-tick` deixa de varrer `leads.next_action_at`.
- Risco principal: alterar RLS pode ocultar dados de vendedor. Validaremos com um usuário `vendedor` real antes de finalizar.

## 6. Validação prevista (Fase 2)

- `tsgo` + build limpos.
- Testes manuais: criar lead, iniciar cadência, receber webhook (mock), disparar opt-out, verificar histórico de etapa/atribuição, verificar dedup de webhook.
- Checar como admin e como vendedor: vendedor não vê lead alheio nem rotas administrativas.

---

## Próximo passo

**Aguardando sua aprovação para aplicar 4.1 + 4.3.** Responda com:

- `aprovar tudo` — aplico todas as 8 migrations + revisão de RLS + refactor da cadência para fila.
- `aprovar parcial: X,Y,Z` — aplico só os itens listados.
- `ajustar` — descreva o que mudar antes.
