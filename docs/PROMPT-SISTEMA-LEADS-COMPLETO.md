# PROMPT COMPLETO — Sistema de Leads WF Digital (replicação 100%)

> Cole este documento inteiro em outro chat. Ele descreve o sistema real,
> sem depender de conexão com o banco de dados.

## 1. Papel e objetivo

Você é Arquiteto de Software Sênior. Construa, do zero, um CRM + plataforma de
automação de vendas B2B chamado **Sistema de Leads WF Digital**, em português do
Brasil, multi-empresa (multi-tenant), com IA de atendimento chamada **Ana**.

Fluxo de negócio ponta a ponta:
prospecção por ICP/localização/raio → score explicável → aprovação do admin →
lead → cadência automática (WhatsApp primeiro; e-mail se WhatsApp indisponível,
falhar ou não responder; telefone como tarefa humana) → Ana responde e qualifica →
handoff para vendedor com contexto → reunião/oportunidade/proposta → pedido →
relatórios.

## 2. Stack obrigatória

- React 19 + TypeScript + **TanStack Start v1** (rotas em `src/routes`, file-based)
- TanStack Router + TanStack Query (loaders com `ensureQueryData`, `useSuspenseQuery`)
- Vite 7, Tailwind CSS v4 (tokens semânticos em `src/styles.css`), shadcn/ui + Radix
- Backend: `createServerFn` do `@tanstack/react-start` (RPC tipado) e rotas HTTP
  públicas em `src/routes/api/public/*` (webhooks/cron)
- Banco: Supabase Postgres com RLS por `organization_id`; Storage para documentos
- IA: gateway de LLM (chat, embeddings, extração de texto)
- Runtime serverless (Cloudflare Workers): nada de child_process/sharp/puppeteer

## 3. Modelo de dados (schema `public`)

Toda tabela de negócio tem `organization_id uuid not null`, `created_at`,
`updated_at`. Toda tabela tem GRANTs explícitos + RLS habilitada.

Tabelas:

1. `organizations` — id, name, slug
2. `organization_members` — organization_id, user_id, role
3. `organization_invites` — email, role, inviter_id, expires_at, accepted_at
4. `profiles` — id (=auth.users.id), name, email, phone, avatar, active, can_use_ia
5. `user_roles` — organization_id, user_id, role (enum `app_role`:
   `administrador | vendedor | sdr | cx`)
6. `leads` — company, contact, title, phone, whatsapp, email, segment, uf,
   distance, score, temp (`quente|morno|frio`), stage, value, owner, owner_id,
   assigned_to, stale_hours, escalated, escalation_reason, sla_info,
   last_contact, lost_reason, origin, annual_revenue, score_snapshot (jsonb),
   score_explanation, score_source, score_verified_at, opt_out, ai_paused,
   next_action_at, contact_channels (jsonb)
7. `lead_messages` — lead_id, sender (`lead|ana|usuario`), sender_name, type, text, sent_at
8. `lead_tasks` — lead_id, text, due_at, owner_id, owner_label, completed
9. `lead_notes`, `lead_stage_history`, `lead_assignment_history`,
   `lead_contact_points`, `lead_consent_events` (histórico e conformidade)
10. `lead_qualifications` — lead_id, question, answer, status
11. `lead_handoffs` — lead_id, from_user_id, to_user_id, status, sla_expires_at
12. `appointments` — lead_id, user_id, title, start_at, end_at, status, meeting_url
13. `proposals` — number, lead_id, client, items, value, discount, creator,
    creator_name, status, need_approval
14. `orders` — number, lead_id, proposal_id, company, seller_name, seller_type,
    order_date, items, value, payment, contract_status, status
15. `company_settings` — name, ai_prompt, ai_model, ai_temperature, ai_max_tokens,
    description, tone_of_voice, differentiators, assignment_strategy,
    handoff_sla_minutes, handoff_readiness_score, nurture_days,
    nurture_max_cycles, autonomy (jsonb), outreach_wait_hours,
    outreach_max_attempts, prospecting_sources (jsonb)
16. `outreach_sequences` — name
17. `outreach_sequence_steps` — type (`whatsapp|email|call_task`), content,
    wait_hours, order_index, max_attempts, continue_on
18. `lead_sequence_enrollments` — lead_id, sequence_id, status, current_step_id,
    next_run_at, last_error
19. `lead_outreach` — lead_id, channel, actor_type, status, attempt, content,
    error, replied_at
20. `outreach_jobs` — lead_id, channel, attempt, run_at, status, locked_at,
    locked_by, processed_at, error (fila com lock, idempotente)
21. `prospecting_schedules` — owner_id, filters (jsonb), quantity,
    auto_approve_min_score, sequence_id, assignment_strategy, daily_cap, monthly_cap
22. `prospecting_schedule_runs` — imported_count, status
23. `prospecting_cache` — external_id, source, data (jsonb)
24. `score_weights` — segment, whatsapp, site, porte, google, regiao
25. `documents` — name, content_text, storage_path, type, size, status (base de conhecimento)
26. `unanswered_questions` — text, count, resolved
27. `integrations` — key, label, connected
28. `contact_suppressions` — contact, channel, reason (opt-out global)
29. `notifications` — owner_id, kind, title, description, read, link
30. `audit_logs` — actor_id, actor_name, actor_type, action, detail, rule, occurred_at
31. `services`, `objections` — catálogo comercial usado pela Ana

Funções SQL (SECURITY DEFINER, `set search_path = public`):
- `has_role(_user_id uuid, _role app_role) returns boolean`
- `current_org_id() returns uuid` — organização do usuário autenticado
- `is_org_member(_org uuid, _user uuid, _role text default null) returns boolean`

Padrão de RLS em toda tabela de negócio:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated;
GRANT ALL ON public.<t> TO service_role;
ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org isolation" ON public.<t> FOR ALL TO authenticated
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());
```
Papéis NUNCA ficam em `profiles`. Escrita em `user_roles` só para administradores.
Trigger em `auth.users` cria `profiles` + vínculo de organização no primeiro acesso.

## 4. Rotas da aplicação

`src/routes/__root.tsx` (shell, Toaster), `auth.tsx` (login/cadastro/recuperação),
`reset-password.tsx`, `oauth/*` (callback Google Calendar) e o grupo protegido
`_authenticated/` (gate que redireciona para `/auth`):

- `/` — Dashboard: leads ativos/quentes/parados, conversas do dia, propostas
  abertas, pedidos do mês, valor de pipeline, atalhos rápidos
- `/leads` — lista/kanban com filtros por estágio, temperatura, dono, origem
- `/leads/$id` — ficha 360°: dados, score explicável, timeline de mensagens,
  tarefas, notas, qualificação da Ana, handoff, cadência/enrollment, agenda,
  histórico de estágio e atribuição, opt-out
- `/prospeccao` — busca externa por ICP/localização/raio, pré-visualização com
  score e motivos, aprovação e importação em lote, buscas salvas, agendamentos
- `/atendimento` — central de conversas (Ana + humano), assumir manualmente,
  pausar IA, enviar WhatsApp manual
- `/orcamentos` — propostas: criar, duplicar, aprovar, converter em pedido
- `/pedidos` — pedidos e status de contrato/pagamento
- `/relatorios` — funil, conversão por estágio, produtividade por vendedor,
  desempenho de canais, receita — agregações reais do banco, com exportação
- `/empresa` — dados da empresa, tom de voz, diferenciais, serviços, objeções
- `/configuracoes` — abas: Equipe/RBAC, Cadências, Score (pesos), Autonomia,
  Base de conhecimento (upload PDF/DOCX), Integrações, Auditoria
- `/portal-vendedor` — fila pessoal do vendedor: handoffs, próximas ações, agenda
- `/diagnostico` — painel admin: saúde da automação, fila de jobs, conformidade,
  testes de integração (Z-API/Evolution/Resend), últimos erros

## 5. Server functions (RPC) — agrupamento

- **CRM** (`crm.functions.ts`): CRUD de leads, mensagens, tarefas, notas,
  propostas, pedidos, documentos; `moveLeadStage`, `assignLeadToSeller`,
  `bulkAssignProspects`, `getDashboardStats`, `getReportsData`, `getOpsMetrics`,
  `globalSearch`, `getSidebarCounts`, notificações, integrações, auditoria,
  equipe (`listTeam`, `inviteTeamMember`, `setUserRole`, `removeUserRole`),
  `getCompanySettings`/`updateCompanySettings`, `getScoreWeights`/`updateScoreWeights`,
  `chatWithAna`, `retrainAna`, perguntas não respondidas, consentimentos
- **Prospecção** (`prospecting.functions.ts`): `searchExternalCompanies`,
  `importExternalAsLead`, buscas salvas, `getEnabledSources`, `testApifyToken`
- **Agendador** (`prospecting-schedules.functions.ts`): CRUD de agendas,
  `toggleSchedule`, `runScheduleNow`, `listScheduleRuns`
- **Cadências** (`outreach-sequences.functions.ts`): sequências, passos,
  `getDefaultSequenceWithSteps`, `getLeadEnrollment`
- **Outreach** (`outreach.functions.ts`): `startOutreach`, `pauseAi`,
  `assumeManually`, `sendManualWhatsapp`, `setOptOut`, `listOutreach`,
  `testZapi`, `getOutreachHealth`
- **Ações de venda** (`sales-actions.functions.ts`): `draftInitialContact`,
  `autoDraftProposal`, `runNurtureNow`, `getLeadAutomation`, `scheduleAppointment`,
  `acceptHandoff`, `saveLeadQualification`
- **Conhecimento** (`knowledge.functions.ts`): extração/indexação de PDF e DOCX,
  `reindexDocument`, `reindexAllDocuments`, `getKnowledgeStats`
- **Insights** (`insights.functions.ts`): `getScoringInsights`,
  `getComplianceSnapshot`, `getAutomationHealth`
- **Google Calendar** (`google-calendar.functions.ts`): OAuth por usuário,
  status, desconectar, `syncAppointmentToGoogle`

Regras: todo handler valida entrada com Zod, exige sessão autenticada via
middleware, resolve `organization_id` do contexto (nunca do cliente), escreve
`audit_logs` em ações sensíveis, e usa `assertAdmin` para operações de RBAC.

## 6. Rotas HTTP públicas (`src/routes/api/public/`)

- `zapi-webhook.ts` e `evolution-webhook.ts` — respostas de WhatsApp: verificam
  assinatura/segredo, deduplicam por id de mensagem, gravam `lead_messages`,
  marcam `replied_at`, param a cadência e acionam a Ana
- `resend-webhook.ts` — eventos de e-mail (entregue, aberto, bounce, opt-out)
- `outreach-tick.ts` — cron: processa `outreach_jobs` com lock, avança passos da
  sequência, aplica fallback WhatsApp→e-mail→tarefa de ligação, executa nurture
- `prospecting-tick.ts` — cron: executa `prospecting_schedules` do dia,
  respeitando `daily_cap`/`monthly_cap` e `auto_approve_min_score`

Todos verificam o chamador (segredo/assinatura) antes de qualquer escrita.

## 7. Score explicável

`src/lib/score-explain.ts` calcula 0–100 combinando sinais com pesos
configuráveis (`score_weights`): segmento aderente ao ICP, WhatsApp válido,
site ativo, porte/faturamento, avaliações/presença no Google, região/raio.
Grava `score_snapshot` (jsonb com cada critério, peso, valor e contribuição),
`score_explanation` (texto), `score_source` e `score_verified_at`.
Temperatura: ≥70 quente, 40–69 morno, <40 frio. A UI mostra a decomposição.

## 8. Cadência multicanal

Sequência = passos ordenados. Cada passo: canal, conteúdo (template com
variáveis do lead), `wait_hours`, `max_attempts`, `continue_on`
(`no_reply | failure | always`). Ordem padrão: WhatsApp → WhatsApp follow-up →
e-mail → tarefa de ligação para humano. Regras invioláveis:
- respeitar `opt_out` e `contact_suppressions` (nunca contatar);
- respeitar janela comercial e limites diários;
- resposta do lead pausa a cadência e abre atendimento;
- toda tentativa gera `lead_outreach` + `audit_logs`;
- modo sandbox: simula envios sem chamar provedores.

## 9. Ana (IA)

Prompt do sistema montado com: dados da empresa, tom de voz, diferenciais,
serviços, objeções, base de conhecimento (documentos indexados) e contexto do
lead. Ana qualifica com perguntas configuráveis (`lead_qualifications`),
calcula prontidão e, ao atingir `handoff_readiness_score`, cria
`lead_handoffs` com SLA (`handoff_sla_minutes`), notifica o vendedor e resume o
contexto. Perguntas sem resposta na base vão para `unanswered_questions`.

## 10. Painel de Autonomia

`company_settings.autonomy` (jsonb) define, por etapa, se a execução é
`automatico | aprovar | manual`: prospecção, aprovação de leads, primeiro
contato, follow-up, qualificação, handoff, agendamento, rascunho de proposta,
nurture. A UI expõe um switch por etapa; o backend consulta a configuração
antes de agir sozinho.

## 11. Design

Tema escuro corporativo, densidade alta, tipografia 11–24px, cantos suaves.
Tokens semânticos obrigatórios (`--primary`, `--bg-general`, `--border-card`,
`--text-title/body/sec/ter`, `--hot`, `--ia`). Nunca usar `text-white`,
`bg-black` ou cores hex nos componentes. Componentes base em
`src/components/ui-kit.tsx` (`Card`, `SectionTitle`, `StatCard`, badges de
temperatura/estágio) e shell com sidebar em `AppShell.tsx`.

## 12. Critérios de aceite

- Isolamento multi-tenant provado: usuário de uma organização nunca lê dados de outra.
- Nenhum dado sensível no cliente; segredos só em variáveis de ambiente do servidor.
- Fluxo completo funcionando: prospectar → aprovar → cadenciar → responder →
  qualificar → handoff → agendar → propor → fechar → relatar.
- Relatórios calculados no banco (sem mock).
- Auditoria e opt-out em 100% das ações de saída.
- Build e typecheck sem erros; tipos do banco em `src/types/database.ts`.
