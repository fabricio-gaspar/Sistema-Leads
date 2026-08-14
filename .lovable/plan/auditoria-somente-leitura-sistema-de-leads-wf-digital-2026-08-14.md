# Auditoria somente-leitura — Sistema de Leads (WF Digital)

Nada foi editado, nenhuma migration aplicada, nada publicado. Verificações feitas: leitura de código, typecheck (`tsgo --noEmit` passa sem erros) e consultas de leitura ao Postgres (catálogo, políticas, contagens).

## 1. Erros e riscos críticos que impedem teste real

1. **Banco divergente do código — tabelas ausentes.** O banco tem 25 tabelas; o código consulta várias que **não existem**: `lead_outreach` (≈20 usos, núcleo do outreach/atendimento), `lead_qualifications` (5), `notifications` (3), `services` (4), `objections`, `consent_events`, `webhook_events`, `contact_points`, `docs`. Qualquer tela que dependa delas retorna erro PostgREST em runtime. Arquivos: `src/lib/outreach.functions.ts`, `src/lib/crm.functions.ts`, `src/hooks/use-notifications.ts`, `src/routes/_authenticated/atendimento.tsx`.
2. **Funções SQL ausentes.** O banco só possui `auto_assign_admin_fabricio` e `force_admin_on_login`. O código chama `has_role` (`crm.functions.ts:857`, `knowledge.functions.ts:33`, `mock-scan.functions.ts:117`, `outreach-sequences.functions.ts:99`), `has_contact_suppression` (`outreach.functions.ts:63`), `clear_contact_suppressions` (`outreach.functions.ts:110`) e `set_config` (`auth-middleware.ts:133`). Sem elas, checagens de admin falham ou passam silenciosamente (o `.catch(() => {})` do `set_config` esconde o erro).
3. **Bypass de autorização hardcoded por e-mail.** `src/routes/_authenticated/route.tsx:27` e `src/routes/auth.tsx:48` concedem `administrador` a um e-mail fixo, sem base no banco. É um privilégio que não pode ir para produção e mascara falhas reais de RBAC.
4. **Papéis incoerentes.** O enum `app_role` no banco é `administrador | vendedor | ia`, mas o roteador usa `sdr` e `cx` (`route.tsx:52-54`). Usuários SDR/CX não podem sequer ser criados → caem no `signOut()` por “papel inválido”.
5. **Recursão/lockout em `user_roles`.** A policy `user_roles_select_org` faz SELECT na própria `user_roles` (risco de recursão) e a tabela não tem policies de INSERT/UPDATE/DELETE — nenhum admin consegue criar usuários/papéis pelo app. Mesma ausência de INSERT em `profiles`.
6. **Banco vazio.** `leads`, `profiles`, `user_roles`, `documents`, `outreach_sequences` = 0 linhas; só existe 1 organização. Hoje não há como testar nenhum fluxo ponta a ponta sem seed.
7. **Typecheck não protege.** `src/types/database.ts` usa `Insert: any/Update: any` e muitas queries usam `(supabase as any)`, então erros de esquema só aparecem em runtime.

## 2. Dependências externas possivelmente ausentes

- **Configuradas no projeto:** `ANTHROPIC_API_KEY`, `APIFY_TOKEN`, `GOOGLE_PLACES_API_KEY`, `LOVABLE_API_KEY`, chaves Supabase.
- **Usadas no código e não configuradas:** `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`, `ZAPI_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `OUTREACH_EMAIL_FROM`, `OUTREACH_CRON_SECRET`, `CNPJWS_API_KEY`, `PUBLIC_SITE_URL`/`SITE_URL`, `GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY`, `APP_USER_CONNECTION_KEY_SECRET`. Consequência: WhatsApp, e-mail, cron protegido, enriquecimento CNPJ e Google Calendar não funcionam em teste real.
- **Storage:** nenhum bucket existe, mas `documents.storage_path` sugere upload de arquivos — fluxo de documentos não persiste binário.
- **Endpoint legado:** `src/routes/api/public/evolution-webhook.ts` responde 410 (ok, mas confirme que nenhuma integração ainda aponta para ele).

## 3. Telas e fluxos mockados/incompletos

- `src/lib/mock-scan.functions.ts` — diagnóstico com dados simulados, consumido por `/diagnostico`.
- `src/lib/leads-data.ts` — dados/base estática de leads.
- `src/components/PagePlaceholder.tsx` — páginas ainda em placeholder.
- `/atendimento` depende de `lead_outreach`/`lead_qualifications` inexistentes → chat e qualificação da Ana não são testáveis.
- Notificações (`use-notifications.ts`) apontam para tabela inexistente.
- `/relatorios` e `/` (dashboard) agregam tabelas vazias → números zerados, sem sinal de erro.

## 4. Melhorias recomendadas por prioridade

**P0 — destravar teste real**
1. Migration única de reconciliação: criar `lead_outreach`, `lead_qualifications`, `notifications` e demais tabelas realmente usadas, com GRANTs + RLS por `organization_id`.
2. Criar as funções `has_role`, `has_contact_suppression`, `clear_contact_suppressions` (SECURITY DEFINER, `search_path=public`) e remover a chamada a `set_config`.
3. Alinhar o enum `app_role` (incluir `sdr`, `cx`) com a matriz de navegação do roteador.
4. Adicionar policies de INSERT/UPDATE em `user_roles` e `profiles` restritas a administradores via `has_role`, e remover a policy recursiva.
5. Remover o bypass por e-mail e substituir por seed real de admin (perfil + papel) na organização WF Digital.

**P1 — confiabilidade**
6. Regenerar `src/types/database.ts` a partir do esquema real e eliminar os `as any` nas server functions.
7. Cadastrar os secrets faltantes e fazer as integrações degradarem com mensagem clara (hoje falham em silêncio).
8. Proteger `/api/public/outreach-tick` e `/prospecting-tick` com `OUTREACH_CRON_SECRET` obrigatório.

**P2 — produto e qualidade**
9. Substituir `mock-scan` e `leads-data` por consultas reais; remover placeholders.
10. Seed de demonstração (org, admin, sequência, 3–5 leads) para validar o funil ponta a ponta.
11. Testes automatizados dos motores de score e cadência; `head()`/SEO nas rotas públicas (`/auth`, `/reset-password`).
12. Revisar índices em `leads(organization_id, stage)` e `outreach_jobs(status, run_at)` antes de volume.

## Veredito

O app compila, mas **não é testável ponta a ponta hoje**: o esquema do banco está defasado em relação ao código, funções SQL usadas não existem, os papéis SDR/CX são impossíveis, e o acesso admin depende de um bypass hardcoded. Os itens P0 são pré-requisito para qualquer teste real.
