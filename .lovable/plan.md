
# Fluxo de primeiro contato automático (Prospecção → Leads)

Objetivo: quando um lead é enviado da Prospecção para Leads, a IA inicia uma cadência de contato **sequencial** (nunca simultânea) começando por WhatsApp (Z-API), com fallback para E-mail e, por último, tarefa de ligação. O sistema diferencia **falha** de **entregue-sem-resposta** e só avança de canal em falha real.

## 1. Banco (uma migration)

Nova tabela `lead_outreach` (auditável, uma linha por tentativa):
- `lead_id`, `channel` (whatsapp|email|phone), `status` (pending|sent|delivered|read|replied|failed|skipped), `provider` (zapi|smtp|manual), `provider_message_id`, `content`, `error`, `attempt`, `scheduled_for`, `sent_at`, `delivered_at`, `read_at`, `replied_at`, `failed_at`, `actor_type` (ia|human|system), `metadata jsonb`.

Novas colunas em `leads`:
- `contact_channels jsonb` — snapshot de disponibilidade por canal (whatsapp/email/phone) com `available`, `last_status`, `last_attempt_at`.
- `active_channel` (text) — canal atual da cadência.
- `next_action_at` (timestamptz) — quando a próxima tentativa está agendada.
- `ai_paused` (bool default false).
- `opt_out` (bool default false).

Novas colunas em `company_settings` (cadência configurável):
- `outreach_wait_hours` (int default 24)
- `outreach_max_attempts` (int default 3)

Grants + RLS por `owner_id` como no restante do CRM.

## 2. Backend (`src/lib/outreach.functions.ts` novo, `prospecting.functions.ts` ajustado)

- `startOutreach(lead_id)` — decide o canal (WhatsApp > E-mail > Telefone) baseado em `contact_channels` e opt-out; grava `lead_outreach` como `pending`, aciona envio.
- `sendWhatsappZapi(lead_id, text)` — chamada server-only à Z-API usando `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` (secrets). Marca `sent`/`failed` e devolve `provider_message_id`.
- `sendEmailFallback(lead_id, subject, text)` — usa a integração de e-mail já existente (ou registra `failed:no_provider` se ainda não houver, sem quebrar o fluxo).
- `scheduleFollowUp(lead_id)` — se WhatsApp foi entregue mas ainda não respondeu, agenda `next_action_at = now + outreach_wait_hours`, mantém canal.
- `advanceChannelOnFailure(lead_id)` — só troca de canal quando `failed`; se acabar canais, cria `lead_task` "Ligação pendente" com roteiro gerado pela IA.
- `pauseAi(lead_id)` / `assumeManually(lead_id)` / `handoffToHuman(lead_id, reason)`.
- `recordZapiWebhook` — server route em `src/routes/api/public/zapi-webhook.ts` recebe eventos da Z-API (delivered/read/replied), atualiza `lead_outreach` e `contact_channels`, e se `replied` → cria `lead_message` (evita duplicar via `provider_message_id`) e dispara handoff quando detectar interesse/pedido humano.
- Ajuste em `prospecting.functions.ts::sendToLeads`: remover `anaFirstContact` local; chamar `startOutreach(lead.id)` no lugar. Preencher `contact_channels` no insert.

Gatilhos de handoff da IA (já usa Claude via `chatWithAna`): pedido explícito por humano, sinais de compra (orçamento/proposta/reunião), termos de preço/contrato/jurídico, opt-out, baixa confiança (heurística por prompt).

## 3. Frontend

- **Card do Kanban** (`leads.tsx`): badges dos canais em `contact_channels` com cores por status; badge do canal recomendado.
- **Detalhe do lead** (`leads.$id.tsx`): nova seção **"Canais de contato"** e nova seção **"Estratégia de aquecimento"** mostrando canal atual, próxima ação com data/hora, histórico completo de `lead_outreach`, botões **Pausar IA** e **Assumir manualmente**.
- **Prospecção** (`prospeccao.tsx`): toast pós-envio agora diz "Ana iniciará contato via WhatsApp em instantes".
- **Configurações → Integrações**: campos para credenciais Z-API + botão "Testar Z-API" (segue o padrão do Apify).

## 4. Cadência agendada

`pg_cron` a cada 5 min chama `POST /api/public/outreach-tick` (protegido por `apikey` anon) que:
- pega leads com `next_action_at <= now()` e `ai_paused=false`,
- executa próximo passo (retry, avançar canal, ou criar tarefa de ligação).

## 5. LGPD & auditoria

- Toda ação da IA vira `audit_logs` (canal, conteúdo resumido, status, motivo do fallback, executor).
- Botão **"Não contatar"** no detalhe do lead → `opt_out=true` cancela cadência.
- Nenhuma mensagem duplicada: Central de Atendimentos e histórico do lead leem a mesma `lead_messages`; Z-API dedupe por `provider_message_id`.

## Detalhes técnicos

- Z-API: `POST https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/send-text` com header `Client-Token`. Webhook configurado no painel Z-API apontando para `https://<projeto>.lovable.app/api/public/zapi-webhook`.
- Secrets novos a criar (via `add_secret` após aprovação): `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`.
- Cadência não simultânea: `advanceChannelOnFailure` só é chamado em `status='failed'`; `delivered` sem reply agenda follow-up no mesmo canal.
- Reuso total: `lead_messages`, `lead_tasks`, `audit_logs`, `company_settings`, integrações e componentes de chat já existentes.

## Fora de escopo

- Discagem automática (só cria a tarefa de ligação).
- Provedor de e-mail próprio se ainda não houver integração — o passo grava tentativa `failed:no_provider` para o vendedor tratar, sem travar o fluxo.
