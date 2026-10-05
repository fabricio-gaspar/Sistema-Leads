# BACKUP MANIFEST — Wayflex CRM (ex-WF Digital)

## Informações gerais

| Item | Valor |
|---|---|
| **Nome do projeto** | Wayflex CRM — atendimento comercial inteligente (ex-WF Digital / LeadAI) |
| **Data/hora do backup** | 2026-08-26 |
| **Arquivo de backup de dados (backend)** | `docs/backup_wayflex_2026-08-26.sql` |
| **Framework** | React 19 + Vite + TypeScript + TailwindCSS |
| **Tipo de aplicação** | SPA (Single Page Application) — React Web |

---

## 1. Rotas / Telas

| Rota | Tela | Arquivo |
|---|---|---|
| `/` | Landing (apresentação do produto) | `src/pages/landing/page.tsx` |
| `/login` | Login | `src/pages/login/page.tsx` |
| `/register` | Cadastro | `src/pages/register/page.tsx` |
| `/dashboard` | Dashboard (visão geral) | `src/pages/dashboard/page.tsx` |
| `/dashboard/empresa` | Empresa | `src/pages/dashboard/empresa/page.tsx` |
| `/dashboard/busca-leads` | Busca de Leads | `src/pages/dashboard/busca-leads/page.tsx` |
| `/dashboard/atendimento` | Atendimento (Chat) | `src/pages/dashboard/atendimento/page.tsx` |
| `/dashboard/leads` | Leads | `src/pages/dashboard/leads/page.tsx` |
| `/dashboard/kanban` | Kanban | `src/pages/dashboard/kanban/page.tsx` |
| `/dashboard/funil` | Funil de Conversão | `src/pages/dashboard/funil/page.tsx` |
| `/dashboard/midia-drive` | Mídia Drive | `src/pages/dashboard/midia-drive/page.tsx` |
| `/dashboard/relatorios` | Relatórios | `src/pages/dashboard/relatorios/page.tsx` |
| `/dashboard/agenda` | Agenda / Tarefas | `src/pages/dashboard/agenda/page.tsx` |
| `/dashboard/campanhas/calendario` | Calendário Editorial | `src/pages/dashboard/campanhas/calendario/page.tsx` |
| `/dashboard/campanhas/publicacao` | Criar Publicação | `src/pages/dashboard/campanhas/publicacao/page.tsx` |
| `/dashboard/campanhas/contas` | Contas Conectadas | `src/pages/dashboard/campanhas/contas/page.tsx` |
| `/dashboard/orcamentos` | Orçamentos | `src/pages/dashboard/orcamentos/page.tsx` |
| `/dashboard/configuracoes` | Configurações | `src/pages/dashboard/configuracoes/page.tsx` |
| `*` | 404 (NotFound) | `src/pages/NotFound.tsx` |

---

## 2. Componentes principais

**Componentes de layout / feature (compartilhados):**
- `src/components/feature/DashboardLayout.tsx` — layout do dashboard (navegação lateral + topo).
- `src/components/feature/FilterChips.tsx` — chips de filtro reutilizáveis.
- `src/components/feature/SavedViewsControl.tsx` — controle de "views salvas".

**Componentes de página (por módulo):**
- `src/pages/dashboard/configuracoes/components/*` — abas do menu de Configurações.
- `src/pages/dashboard/empresa/components/*` — abas de Empresa (Dados, Base de Conhecimento, Documentos).
- `src/pages/dashboard/atendimento/components/ConversaDrawer.tsx` — drawer de conversa do atendimento.
- `src/pages/dashboard/kanban/components/LeadDrawer.tsx` — drawer de detalhes do lead no Kanban.

---

## 3. Stores / Hooks (persistência e estado)

Localizados em `src/hooks/`:

| Arquivo | Responsabilidade |
|---|---|
| `useAuth.tsx` | Contexto de autenticação (mock — sem auth real) |
| `useLocalStorageState.ts` | Hook base de persistência em localStorage |
| `useLeadsStore.ts` | Leads |
| `usePropostasStore.ts` | Propostas / Orçamentos |
| `useVendasStore.ts` | Vendas |
| `useConversasStore.ts` | Conversas (Atendimento/Chat) |
| `useTarefasStore.ts` | Tarefas / Agenda |
| `useNotificacoesStore.ts` | Notificações |
| `useConfiguracaoStore.ts` | Configurações |
| `useSupressaoStore.ts` | Supressão (LGPD/opt-out) |
| `useSocialStore.ts` | Campanhas / Redes sociais |
| `useAuditoriaStore.ts` | Auditoria |
| `useSavedViews.ts` | Views salvas |
| `useAnaResposta.ts` | Respostas da Ana (IA) |
| `useFluxoComercial.ts` | Fluxo comercial da Ana |

**Lógica de negócio em `src/lib/`:**
- `store.ts`, `selectors.ts`, `analise.ts`, `automacao.ts`, `tipos.ts`.

---

## 4. Mocks e dados locais (`src/mocks/`)

- `leadsData.ts`, `propostasData.ts`, `atendimentoData.ts`, `dashboardData.ts`
- `businessData.ts`, `comercialData.ts`, `canaisData.ts`, `fontesData.ts`
- `conhecimentoData.ts`, `pipelineData.ts`, `produtosData.ts`, `templatesData.ts`
- `automacaoData.ts`, `horariosData.ts`, `logsData.ts`, `midiaData.ts`
- `socialData.ts`, `anaQualificacao.ts`, `anaComercial.ts`, `anaTemplates.ts`
- `frontendAdvancedData.ts`, `users.ts`

> A interface (frontend) ainda lê/grava nesses mocks + `localStorage`.

---

## 5. Dados no Readdy Backend (⚠️ descoberta importante)

**Correção em relação ao manifesto anterior:** o backend **NÃO está vazio**. Existem tabelas *chave-valor* que guardam o estado real do CRM, cada uma com 1 linha por usuário (`user_id` + `dados` jsonb + `updated_at`):

| Tabela | Conteúdo (resumo) |
|---|---|
| `conhecimento` | 15 itens (FAQs, objeções, cases, políticas) |
| `fluxos_automatizacao` | 4 fluxos de automação |
| `pipeline` | 11 etapas do funil |
| `catalogo_produtos` | 5 produtos/serviços |
| `templates` | 9 templates de mensagem |
| `fontes` | 5 fontes de prospecção (⚠️ ver segurança abaixo) |
| `integracoes` | 6 integrações (WhatsApp, e-mail, etc.) |
| `empresa_config` | Configurações da empresa/Ana |
| `equipe` | 5 membros |
| `variaveis_globais` | 3 variáveis |
| `respostas_rapidas` | 4 respostas rápidas |
| `biblioteca_prompts` | 8 prompts |
| `templates_proposta` | 3 modelos de proposta |
| `templates_documento` | 5 documentos (contrato, NDA, etc.) |
| `leads` | 1 lead ativo real ("Lavanderia São Roque Ltda") |
| `propostas` | 1 proposta real (PRP-1000) |
| `conversas` | ~21 conversas de WhatsApp |
| `auditoria` | ~48 eventos de log |
| `envio_logs` | ~28 registros de envio (Z-API) |
| `campanhas` | 6 posts + 3 contas sociais |
| `midia_drive` | 5 pastas + 12 arquivos |
| `documentos` | 6 documentos |
| `temas` | 3 temas de proposta |
| `listas_leads` | 1 lista de prospecção |
| `supressao` | 4 registros (LGPD/opt-out) |
| `configuracao_runtime` | Regras de runtime (horários, handoff, follow-up) |

Tabelas **vazias**: `vendas`, `compromissos`, `notificacoes`, `tarefas`, e as normalizadas `crm_leads`, `crm_propostas`, `crm_vendas`, `crm_conversas`, `crm_compromissos` (o sistema usa as chave-valor, não essas).

> **Estado:** ✅ **Migração para Wayflex concluída em 2026-08-26** — todo o conteúdo (identidade, produtos, base de conhecimento, templates, conversas e logs) foi atualizado no backend ao vivo. Nenhuma referência a "WF Digital" permanece.

---

## 6. 🔴 SEGURANÇA — chave vazada no backend

Na tabela `fontes`, o registro "Pesquisa assistida por IA" (`id: f-4`) contém uma **chave da Anthropic (Claude) gravada em texto puro** no campo `endpoint` (prefixo `sk-ant-api03-`).

**Ações recomendadas:**
1. **Revogar/rotacionar** essa chave imediatamente no painel da Anthropic.
2. Apagar o valor do campo `endpoint` dessa fonte no backend.
3. No backup (`docs/backup_wayflex_2026-08-26.sql`) a chave foi **redigida** (`[REDACTADO_CHAVE_ANTHROPIC_ROTACIONAR]`).

---

## 7. Dependências

Ver `docs/DEPENDENCIAS.md` para a lista completa.

**Principais (runtime):** react/react-dom (19.x), react-router-dom (7.x), i18next, @supabase/supabase-js, firebase, @stripe/react-stripe-js, recharts, lucide-react.

---

## 8. Integrações

| Integração | Status |
|---|---|
| Readdy Backend | 🟢 Conectado (tabelas Loja/Pedidos + tabelas chave-valor do CRM com dados) |
| Shopify | 🔴 Não conectado |
| Stripe | 🔴 Não conectado |
| Toss Payments | 🔴 Não conectado |
| PayPal | 🔴 Não conectado |
| Resend (e-mail) | 🔴 Não configurado |
| Auth real (login) | 🔴 Simulado (`useAuth` é mock) |

---

## 9. Arquivos NÃO exportados por segurança

| Arquivo/valor | Motivo |
|---|---|
| `.env` (valores reais) | Contém `VITE_PUBLIC_SUPABASE_URL` e `VITE_PUBLIC_SUPABASE_ANON_KEY`. Disponível apenas `.env.example`. |
| Chave Anthropic (fonte `f-4`) | Redigida no backup por estar vazada em texto puro. |
| Segredos de backend (Resend, Stripe, Shopify, etc.) | Nenhum configurado. |

---

## 10. Observações finais

- O **frontend** ainda roda sobre `mocks` + `localStorage` (não está ligado às tabelas do backend).
- O **backend** contém dados reais (chave-valor), **já migrados para Wayflex** (concluído em 26/08/2026).
- Autenticação é simulada.
- O arquivo `docs/backup_wayflex_2026-08-26.sql` foi gerado num estágio intermediário da migração; o estado **autoritativo atual** é o backend ao vivo (migrado).
- Não há integração real de WhatsApp/e-mail/redes configurada e ativa em produção no momento.