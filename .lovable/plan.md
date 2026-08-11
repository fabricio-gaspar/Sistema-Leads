# Auditoria Técnica do Sistema de Leads (WF Digital CRM)

## 1. Resumo Executivo
Auditoria realizada em 11/08/2026 como Arquiteto de Software Sênior. O sistema apresenta uma base sólida em TanStack Start e Supabase, mas possui falhas críticas de segurança RLS (isolamento por tenant) e inconsistências funcionais em fluxos de automação.

## 2. Relatório de Prioridades

### CRÍTICO (Ação Imediata)
| ID | Módulo | Descrição | Impacto | Recomendação |
|---|---|---|---|---|
| C1 | Segurança (RLS) | Políticas RLS genéricas (`USING(true)`) em `profiles`, `user_roles`, `leads`, `orders`, etc. | Um usuário autenticado pode ver e editar dados de qualquer empresa (vazamento total). | Refatorar RLS para usar `organization_id` vinculado ao `auth.uid()` via `user_roles`. |
| C2 | Segurança (RLS) | Tabelas com RLS ativo mas sem políticas explícitas (bloqueio total). | Funcionalidades como `appointments` e `documents` podem falhar para usuários autenticados. | Criar políticas RLS por `organization_id` para todas as 25 tabelas. |
| C3 | Auth (Admin) | Risco de auto-promoção a admin via `user_roles`. | Usuários comuns podem ganhar acesso total ao sistema. | Restringir `INSERT/UPDATE` em `user_roles` apenas para a role `service_role` ou via função RPC protegida. |

### ALTO (Prioridade Próxima)
| ID | Módulo | Descrição | Impacto | Recomendação |
|---|---|---|---|---|
| A1 | Automação | Fluxo de cadência (`outreach-tick`) depende de polling e pode falhar sob carga. | Leads perdem contatos agendados. | Implementar retry logic robusto e logs de erro em `lead_sequence_enrollments`. |
| A2 | CRM | Dashboard (`index.tsx`) usa contadores que podem ficar lentos com muitos dados. | Lentidão na página inicial. | Implementar tabelas de agregação ou caching para estatísticas do dashboard. |

---

## 3. Matriz de Rastreabilidade (Exemplo: Módulo Leads)

| Tela | Campo Frontend | Tabela | Coluna | Tipo | Obrigatório | Validação | RLS (Select/Edit) | Status |
|---|---|---|---|---|---|---|---|---|
| Leads | Nome Empresa | `leads` | `company` | `text` | Sim | Min 1 char | Org ID | Correto |
| Leads | Valor | `leads` | `value` | `numeric` | Não | Positivo | Org ID | Correto |
| Leads | Etapa | `leads` | `stage` | `enum` | Sim | Enum válido | Org ID | Correto |
| Leads | Canais de Contato | `leads` | `contact_channels` | `jsonb` | Não | Estrutura JSON | Org ID | Inconsistente (UI/DB) |

---

## 4. Diagnóstico de Banco de Dados vs Frontend
- **Inconsistência Identificada**: O frontend em `leads.tsx` tenta renderizar `contact_channels`, mas a estrutura salva no banco via `crm.functions.ts` nem sempre inclui os metadados esperados pela UI (disponibilidade, status real).
- **Campos Órfãos**: A coluna `origin` no banco é pouco usada no frontend (apenas filtros básicos), perdendo rastreabilidade de ROI.

## 5. Próximos Passos (Após Aprovação)
1. **Etapa 1**: Correção emergencial de RLS em `leads`, `profiles` e `user_roles`.
2. **Etapa 2**: Implementação de políticas RLS para as 21 tabelas bloqueadas.
3. **Etapa 3**: Refatoração do middleware de autenticação para garantir carregamento de `organization_id` em cada request.
