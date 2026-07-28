
# Multiempresa (organization_id) + RLS por tenant

Refatoração ampla. Vou executar em **4 fases** para não quebrar o app em produção. Cada fase é aplicável isoladamente.

## Fase 1 — Fundação (schema + membership)

Migration nova:
- `organizations(id, name, slug, created_by, created_at, updated_at)`
- `organization_members(org_id, user_id, role app_role, created_at)` — PK composta, substitui o papel global de `user_roles` no contexto por-tenant. `user_roles` fica só para "super admin de plataforma".
- `organization_invites(id, org_id, email, role, token, expires_at, accepted_at)`
- Função `public.current_org_id()` (SECURITY DEFINER, lê de `auth.jwt() -> 'app_metadata' -> 'org_id'` **ou** de um GUC `app.current_org`) — usada em todas as políticas.
- Função `public.is_org_member(_org uuid, _user uuid, _role app_role default null)` (SECURITY DEFINER) — evita recursão em RLS.
- Trigger em `auth.users` (via `handle_new_user`): cria org pessoal automática no primeiro login e adiciona como `administrador`.

## Fase 2 — Propagação de `organization_id`

Adicionar coluna `organization_id uuid NOT NULL REFERENCES organizations(id)` em:
`leads, appointments, proposals, orders, documents, knowledge_chunks, lead_messages, lead_notes, lead_tasks, lead_outreach, lead_qualifications, lead_handoffs, lead_sequence_enrollments, outreach_sequences, outreach_sequence_steps, outreach_jobs, tasks, notifications, audit_logs, contact_points, contact_suppressions, consent_events, prospecting_cache, vendor_sessions, unanswered_questions, objections, services, integrations, company_settings, score_weights, webhook_events, lead_stage_history, lead_assignments`.

Backfill: cria uma organização "Legado" e associa todas as linhas existentes a ela. Todos os `profiles` atuais viram membros dessa org.

Índices: `(organization_id)` em toda tabela filtrada por tenant; índices compostos onde já existem (`organization_id, created_at`, `organization_id, stage`, etc.).

## Fase 3 — RLS por tenant

Reescrever **todas** as políticas para incluir `organization_id = current_org_id()`. Padrão:

```sql
CREATE POLICY leads_tenant_read ON public.leads FOR SELECT TO authenticated
  USING (organization_id = current_org_id()
         AND (owner_id = auth.uid()
              OR assigned_to = auth.uid()
              OR is_org_member(organization_id, auth.uid(), 'administrador')));

CREATE POLICY leads_tenant_write ON public.leads FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_org_id());
```

Trigger `BEFORE INSERT` em cada tabela: se `organization_id` vier NULL, preenche com `current_org_id()`.

Storage: prefixar todos os paths dos buckets `docs/contracts/avatars` com `{org_id}/...` e escrever policies em `storage.objects` restringindo por prefixo.

## Fase 4 — Server functions + UI

**Server side:**
- Middleware `withOrgContext` que lê `x-org-id` do request, valida via `is_org_member`, e faz `set_config('app.current_org', org, true)` no `context.supabase` antes de qualquer query. Aplicado em todos os `.functions.ts` protegidos.
- Todos os `INSERT` explicitam `organization_id: context.orgId`.
- `supabaseAdmin` (service role) recebe `organization_id` como parâmetro obrigatório onde é usado.

**Client side:**
- Hook `useCurrentOrg()` + `OrgSwitcher` no header (dropdown com orgs do usuário).
- Header `x-org-id` injetado no `functionMiddleware` (`src/start.ts`) junto com o bearer.
- Tela "Organizações" em `configuracoes.tsx`: criar org, listar membros, convidar por e-mail (aceite via link com token), promover/rebaixar/remover membros.
- Tela de aceite de convite `/invite/$token` (rota pública que exige login e ativa a membership).

**Cadeia crítica:**
- Realtime: canais passam a filtrar por `organization_id`.
- Webhooks públicos (`zapi-webhook`, `resend-webhook`): resolvem `organization_id` a partir do `lead_id` recebido, não do JWT.
- pg_cron: jobs SQL passam a iterar por org.

## Riscos e mitigação

- **Downtime de RLS**: cada fase mantém compatibilidade — Fase 2 permite NULL temporariamente, Fase 3 torna NOT NULL após backfill.
- **Perda de dados**: nenhuma DELETE; tudo é ALTER + backfill.
- **Regressão em queries**: rodo `bunx tsgo --noEmit` + `bun run build` ao fim de cada fase.
- **Convites e Google OAuth**: OAuth continua idêntico; org é resolvida após login.

## Fora de escopo (proponho depois)

- Billing por org.
- Custom domain por org.
- Migração automática de leads entre orgs.

---

**Confirma esse plano e a ordem das 4 fases?** Assim que aprovar começo pela Fase 1 (schema + membership + org pessoal automática no cadastro). Cada fase termina com typecheck+build verdes antes de eu iniciar a próxima.
