## Escopo aprovado × estado atual

Antes de escrever código, alinho o plano em 4 blocos independentes. Cada bloco entrega valor isolado e pode ser revisado individualmente.

---

### Bloco 1 — Minha Empresa › Documentos: Visualizar e Editar

Ajustes de UI em `src/routes/_authenticated/empresa.tsx` (card `DocumentosCard`) e nova server function em `src/lib/crm.functions.ts`.

- Novo botão `Visualizar` (ícone `Eye`, tooltip) em cada linha → abre `Dialog` (shadcn) com nome, tipo, tamanho, status, `updated_at` e `content_text` em `<pre>` rolável. Botão "Baixar original" quando `storage_path` existir. Vazio → mensagem clara.
- Novo botão `Editar` visível somente se o usuário for administrador (via `useQuery` de `has_role`). Abre `Dialog` com:
  - Campo Nome (obrigatório, ≤ 200).
  - Textarea "Conteúdo usado pela Ana" (≤ 500 000 chars, mesmo limite do upload).
  - Select Status (`active` / `archived`), refletindo o enum atual.
  - Nota explicando que o arquivo original no Storage não é substituído.
- Nova server function admin-only `updateDocument({ id, name, content_text, status })` (zod + `assertAdmin`):
  - Atualiza a linha em `documents`.
  - Se `status = active`: chama `reindexDocumentInternal` para regenerar chunks.
  - Se `status = archived` (ou conteúdo vazio): marca chunks ativos como `stale`.
  - Grava evento em `audit_logs` (autor, doc_id, ação).
- Confirmação nativa (`window.confirm`) já existe para exclusão — mantida, apenas adicionada mensagem clara.
- `invalidateQueries(["documents"])` + `["knowledge-stats"]` no sucesso.

### Bloco 2 — Prospecção: renomear + reposicionar histórico

Somente `src/routes/_authenticated/prospeccao.tsx`:

- Rótulo "Buscas salvas" → **"Histórico de prospecção"** (título do card + microcópia em torno).
- Reordenar layout para: [filtros de busca] → [Histórico de prospecção] → [Resultados].
- Card sempre visível; quando vazio: "Nenhuma prospecção salva ainda."
- Cada item exibe data/hora, fonte, município/UF quando existir, raio quando aplicável e total de resultados. Ações `Abrir/Reabrir`, `Renomear`, `Excluir` são preservadas (já existem).
- Nenhuma mudança em server function nem em `prospecting_cache`.

### Bloco 3 — Configurações › Equipe: convite, senha, RBAC operacional

**UI (`configuracoes.tsx › AbaEquipe`):**
- Botão "Adicionar integrante" abre `Dialog` com Nome, E-mail, Telefone (opcional), Perfil (administrador/vendedor/sdr/cx), toggle "Pode usar IA", toggle Ativo.
- Submit chama `inviteTeamMember` (server); toast "Convite enviado — o integrante recebeu um e-mail para definir a senha."
- Nova coluna de ações: mudar perfil (com `confirm` para "administrador" ou desativação do último admin), ativar/desativar (bloqueia auto-desativação), "Redefinir senha/Reenviar acesso" (server fn separada).
- Skeleton/erro/estado vazio; layout responsivo com overflow horizontal na tabela.

**Server (`src/lib/crm.functions.ts`):**
- `inviteTeamMember` (admin-only, zod): normaliza e-mail, verifica duplicidade em `profiles`, chama `supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: <APP_ORIGIN>/reset-password })`. Em seguida: upsert em `profiles` (name, phone, active), insert exatamente um registro em `user_roles`. Rollback (`supabaseAdmin.auth.admin.deleteUser`) se etapas pós-criação falharem. Grava em `audit_logs`.
- `resendTeamInvite` (admin-only): `supabaseAdmin.auth.admin.generateLink({ type: "recovery", email, redirectTo })`.
- Atualiza `updateTeamMember` para banir/desbanir no Auth (`ban_duration: "876600h"` / `"none"`) quando `active` muda, e bloquear auto-desativação/rebaixamento do último admin. Grava em `audit_logs`.
- `APP_ORIGIN` derivado de `getRequest()` + validação server-side (host precisa bater com `SITE_URL` ou domínio conhecido) para impedir open redirect.

**Auth flow (`src/routes/auth.tsx` + nova rota `/reset-password`):**
- Remover a alternância signin/signup — deixar apenas login e link "Esqueci minha senha" (usa `resetPasswordForEmail` com `redirectTo` para `/reset-password`). Mensagem neutra ("Se o e-mail existir, enviaremos instruções.").
- Criar `src/routes/reset-password.tsx` (ssr:false, público): detecta `type=recovery`/`access_token`, chama `supabase.auth.updateUser({ password })` com validação de mínimo 8 chars.

**Gate autenticada (`src/routes/_authenticated/route.tsx`):**
- Depois de `getUser`, ler `profiles.active` — se `false`, executar `signOut()` e redirect para `/auth?blocked=1`.
- RBAC de rota: mapa `path → roles permitidos`; se rota não permitida, redirect para a home do perfil (admin → `/`, vendedor/cx → `/atendimento`, sdr → `/prospeccao`).
- Sidebar (`AppShell`) já esconde itens; agora a rota bloqueia acesso direto por URL.

### Bloco 4 — Migration incremental + regeneração de tipos

Uma única migration idempotente, apenas o que estiver realmente faltando após leitura das políticas atuais:

- `profiles.can_use_ai boolean not null default true` (se ainda não existir).
- Índices em `user_roles(user_id)` e `profiles(active)` se ausentes.
- Revisar RLS de `documents` para que só administradores possam `UPDATE`. Adicionar policy apenas se não existir uma equivalente.
- **Não** cria política nova em `audit_logs`, `leads`, `prospecting_cache` — as existentes já cobrem a matriz aprovada.

Após aprovação da migration, regenerar `src/integrations/supabase/types.ts` e rodar typecheck/build. Corrijo erros até o build ficar limpo.

---

### Fora do escopo (declarado)
- Não altero cadência da Ana, `outreach_jobs`, webhooks, nem `atendimento.tsx`.
- Não crio Portal do Vendedor separado — Central de Atendimento continua sendo o painel do vendedor.
- Não abro `authenticated` global em nenhuma RLS.

### Dependências externas para o usuário
- No painel Supabase Auth → **URL Configuration**, garantir que `https://<preview>.lovable.app/reset-password` e o domínio publicado estejam na lista de **Redirect URLs** (senão o link de convite/recuperação não redireciona).
- Sem novos secrets: usa `SUPABASE_SERVICE_ROLE_KEY` já configurado.

### Ordem de execução
1. Bloco 2 (baixo risco, só UI).
2. Bloco 1 (UI + 1 server fn + reuso de `reindexDocumentInternal`).
3. Migration do Bloco 4 (mínima).
4. Bloco 3 (maior — auth admin, RBAC, reset-password).
5. Lint + build + correções.

Confirma que posso executar nessa ordem? Se preferir dividir em entregas separadas (ex.: aprovar Blocos 1+2 primeiro e depois Blocos 3+4), me avise.