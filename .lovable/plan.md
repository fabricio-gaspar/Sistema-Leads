# Plano de Correção — WF Digital CRM

Baseado na auditoria anterior. A execução é **incremental**: cada bloco é aplicado, testado e reportado antes do próximo. **Nada é feito em uma única alteração gigante.**

---

## Diagnóstico consolidado

O sistema hoje é um protótipo HTML/JS estático (`public/crm/*`) servido dentro de um `<iframe>` na rota `/`. As tabelas Supabase existem mas estão **vazias**, **nenhuma tela grava/lê do banco**, **não há autenticação real**, e a chave da Anthropic já está protegida via server route `/api/ana` (único ponto realmente funcional).

## Problemas classificados

### CRÍTICOS (bloqueiam uso real)
| # | Problema | Arquivos | Correção |
|---|---|---|---|
| C1 | UI oficial é iframe estático desconectado do banco | `public/crm/*`, `src/routes/index.tsx` | Migrar para rotas React `/leads`, `/atendimento`, etc. já existentes; aposentar iframe |
| C2 | Sem autenticação — qualquer um acessa tudo | inexistente | Criar `/auth` (email/senha) + layout `_authenticated` gerenciado |
| C3 | Nenhuma tela conectada ao Supabase (CRUD real) | todas rotas React | Plugar leads, mensagens, tarefas, propostas, pedidos via server functions |
| C4 | RLS "internal collaborative" abre dados entre usuários indevidamente | migrations existentes | Refinar policies por `owner_id` + `has_role('admin')` |
| C5 | Ana no CRM legado grava só em memória do navegador | `public/crm/app.js` | Após C1, chat da Ana grava em `lead_messages` |

### ALTA PRIORIDADE
| # | Problema | Correção |
|---|---|---|
| A1 | Sem tabela `organizations` — sem separação multi-tenant | Adicionar `organization_id` em tabelas de negócio + policies |
| A2 | Storage buckets criados mas sem UI de upload/download | Componentes de upload em Empresa/Documentos/Contratos |
| A3 | Prompt da Ana salvo em `localStorage` | Mover para `company_settings.ai_prompt` |
| A4 | Configurações da IA (modelo, temperatura) só no cliente | Persistir em `company_settings` |
| A5 | Sem tratamento de erro/duplo clique nos forms | Estados `pending`, `disabled`, toasts de erro reais |

### MÉDIA PRIORIDADE
| # | Problema | Correção |
|---|---|---|
| M1 | Sem paginação nas listas (funciona só com poucos dados) | Cursor pagination nas queries |
| M2 | Sem realtime nos leads/mensagens | Supabase Realtime nas telas de atendimento |
| M3 | Exportação PDF/CSV usa dados de memória | Gerar a partir do banco |
| M4 | Notificações in-memory (perdem no refresh) | Tabela `notifications` + realtime |
| M5 | Sem testes automatizados | Vitest para server fns críticas, Playwright para fluxos ponta a ponta |

### BAIXA PRIORIDADE
| # | Problema | Correção |
|---|---|---|
| B1 | Dark mode incompleto em algumas telas | Auditoria visual |
| B2 | Sem logs estruturados no lado do servidor | `console.info` padronizado + campos em `audit_logs` |
| B3 | Integração real WhatsApp/Z-API ausente | Fora do escopo até você fornecer credenciais de sandbox |

---

## Ordem de execução (blocos)

**BLOCO 0 — Decisão de UI (aprovação necessária uma vez)**
Aposentar o iframe `public/crm/*` e adotar as rotas React (`/leads`, `/atendimento`, etc.) como UI oficial. Sem essa decisão nada mais faz sentido: o iframe roda 100% no navegador e nunca poderá acessar o banco com segurança.

**BLOCO 1 — Auth + gate `_authenticated`**
- Rota pública `/auth` (login + cadastro email/senha)
- Layout `src/routes/_authenticated/route.tsx` (gerenciado pela integração)
- Mover rotas atuais para `_authenticated/`
- Sign-in reflete estado no shell, sign-out com cache teardown
- Criar 1 usuário admin para o próprio Fabricio para você testar

**BLOCO 2 — Banco: refinar schema + RLS**
- Adicionar `organization_id`/`owner_id` onde falta
- Policies por `auth.uid()` + `has_role('admin')`
- Índices em FKs quentes (`leads.organization_id`, `lead_messages.lead_id`)
- Migração de dados: nenhum dado de produção a preservar (tabelas vazias hoje)
- Rodar `supabase--linter` e resolver warnings

**BLOCO 3 — Server functions CRUD (leads, mensagens, tarefas, propostas, pedidos)**
- `src/lib/leads.functions.ts` com `list/get/create/update/moveStage/delete`
- Mesma coisa para mensagens, tarefas, propostas, pedidos
- Todas com `.middleware([requireSupabaseAuth])` + validação Zod
- Tratamento de erro padronizado

**BLOCO 4 — Plugar telas React ao Supabase**
- `/leads` (Kanban): read + drag→moveStage grava no banco
- `/leads/$id`: chat grava em `lead_messages`, timeline lê de `audit_logs`
- `/atendimento`, `/orcamentos`, `/pedidos`: idem
- `/configuracoes`: persiste em `company_settings`
- Realtime nos leads e mensagens
- Loading/empty/error states reais

**BLOCO 5 — Storage UI**
- Upload de avatar em `/empresa` (bucket público `avatars`)
- Upload/download de documentos em `/leads/$id` (bucket privado `docs`)
- Upload/download de contratos em `/orcamentos` (bucket privado `contracts`)
- URLs assinadas para os privados

**BLOCO 6 — Ana no fluxo real**
- `/api/ana` continua, mas passa a receber `lead_id` e gravar tanto a mensagem do usuário quanto a resposta da Ana em `lead_messages`
- Prompt customizado vem de `company_settings.ai_prompt` (não `localStorage`)
- Rate limit simples por usuário
- Logging em `audit_logs`

**BLOCO 7 — Testes + segurança final**
- Vitest para server fns críticas
- Playwright ponta a ponta: login → criar lead → mover estágio → mensagem → refresh persiste
- `supabase--linter` + `security--run_security_scan` limpos
- `bun run build` sem erros

---

## Critérios de aprovação por bloco

Só avanço para o próximo quando o bloco atual atende:
1. Build passa
2. Fluxo manual via Playwright (screenshot) mostra dado persistindo após refresh
3. `supabase--read_query` confirma linhas no banco
4. Sem erro crítico no console
5. RLS testada com 2 usuários distintos quando aplicável

## Relatório após cada bloco
Problemas corrigidos, arquivos alterados, migrations criadas, testes rodados, próximo bloco.

---

## Fora do escopo (preciso de sinal verde separado)
- Integração real Z-API (precisa credenciais sandbox)
- Multi-organização real com convite/aceite (posso fazer se confirmar que quer)
- Cobrança / Stripe

## O que preciso de você antes de começar

**Uma única decisão** — Bloco 0: **posso aposentar o iframe `public/crm/*` e usar as rotas React como UI oficial?** Sem isso os demais blocos não têm efeito prático porque o iframe é código estático no navegador. Design visual das telas React já existe e segue o padrão WF Digital.

Se responder "sim", já começo pelo Bloco 1 (auth) e sigo automaticamente pelos próximos até bater num bloco que precise de decisão sua.
