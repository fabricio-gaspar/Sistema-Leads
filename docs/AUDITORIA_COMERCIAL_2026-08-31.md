# Auditoria comercial — Sistema de Leads Wayflex

Data da leitura: 31 de agosto de 2026. Esta auditoria descreve somente o que foi confirmado no repositório e no projeto Supabase conectado. Ela não considera uma integração como funcional sem um teste real registrado.

## Escopo comercial aprovado

O produto deve executar este percurso: **capturar ou importar leads → apresentar empresa e serviços → qualificar e aquecer a oportunidade → agendar reunião → preparar e enviar orçamento**. A Ana opera dentro de regras publicadas; uma pessoa pode assumir a conversa. Não há venda direta, checkout, recebimentos ou processamento de pagamentos no produto.

## Veredito

O núcleo operacional já existe: leads, mensagens, propostas, agenda, personalização da Ana, funções de automação e funções de integração estão presentes. A base ainda não está pronta para se declarar comercial em modo real porque as fontes de prospecção não têm credenciais configuradas/validadas, não há execução real registrada e parte das configurações administrativas ainda usa o adaptador legado de dados genéricos.

## Evidências positivas

| Item | Evidência confirmada |
|---|---|
| Busca real protegida | `prospectar-leads` exige usuário, organização ativa, papel autorizado, fonte e integração conectadas e segredo servidor antes de chamar o provedor (`supabase/functions/prospectar-leads/index.ts`, linhas 220–253). |
| Limite de busca | A função corta o retorno do provedor no `volumeMaximo` solicitado (linha 254). A tela transmite esse valor em produção (página `busca-leads`, linhas 251–269). |
| Fonte da verdade das APIs | A Busca usa `lead_source_configs` da organização ativa e só exibe fontes `ativo + connected` (`src/hooks/useFontesStore.ts`, linhas 57–128). |
| Falha visível e segura | Falha em busca real desabilita a fonte e a integração até novo teste explícito (`prospectar-leads`, linhas 265–285). |
| Limite de acesso por organização | `leads` e `proposals` possuem RLS ativo e políticas por organização/papel; as tabelas de fila, eventos de webhook e versões da Ana estão sem acesso de `anon`/`authenticated`, como deve ocorrer para dados exclusivos do servidor. |
| Funções publicadas | Estão ativas: `ana-ia`, `automation-worker`, `enviar-whatsapp`, `enviar-email`, `testar-integracao`, `configurar-integracao`, `prospectar-leads`, `webhook-whatsapp` e `lead-workflow`. |

## Pendências encontradas

| Prioridade | Problema confirmado | Evidência | Correção necessária |
|---|---|---|---|
| P0 | Nenhuma busca Apify/Google Places pode ser considerada real hoje. | `lead_source_configs` dessas fontes está `enabled=false`, `connection_status=not_configured`, `mode=sandbox`; Apify ainda registra `integration_credentials_missing`. Não existe linha em `prospecting_runs`. | Inserir as credenciais verdadeiras pela tela, testar cada uma, ativar somente após o retorno do provedor e executar busca de homologação com limite baixo. |
| P0 | A proteção contra senha vazada do Supabase está desabilitada. | Security Advisor do projeto Supabase. | Ativar “Leaked password protection” no painel Authentication do projeto antes de abrir cadastro comercial. |
| P1 | O repositório contém uma migration local de vendas/recebíveis que não pertence ao escopo aprovado. | `supabase/migrations/20260826205811_phase_6_sales_receivables_operational.sql`, linhas 1–90, cria `crm_sales`, `crm_receivables` e regras de pagamento. Essas tabelas não estão no schema ativo consultado; o banco ativo ainda possui `orders` com um registro histórico, inacessível ao navegador. | Retirar essa migration do fluxo de migração e criar uma migração explícita de aposentadoria/arquivo para `orders`, preservando o histórico antes de removê-lo. Não executar exclusão direta sem backup. |
| P1 | Parte da configuração continua dependente de tabelas genéricas que não existem no banco atual; ela cai em cache local. | `src/lib/backendStore.ts`, linhas 45–83, faz `upsert` de `{user_id, dados}` em tabelas passadas pelo módulo. O banco não possui, por exemplo, `equipe`, `templates`, `documentos`, `biblioteca_prompts`, `pipeline` ou `configuracao_runtime`. | Migrar cada módulo necessário para tabela relacional por organização ou desativá-lo; não usar cache local como fonte operacional em produção. |
| P1 | Existem dois modelos de schema no histórico do repositório. | O banco ativo usa `leads`, `proposals`, `orders` e `lead_source_configs`; migrations locais antigas usam `crm_leads`, `crm_proposals`, `crm_sales` e `crm_receivables`. | Criar uma migration de reconciliação idempotente a partir do schema ativo e instituir `supabase db diff`/CI como controle de divergência. |
| P2 | O Advisor aponta FKs sem índice em `crm_stage_events` e duas políticas RLS com chamada de autenticação não encapsulada. | Performance Advisor do Supabase: `actor_id`, `ai_decision_id`, `evidence_message_id`, `lead_id`, `organization_id`; políticas `prospecting_cache_isolation` e `notifications_org_member_insert`. | Corrigir em migration de performance após confirmar o nome das constraints e testar o plano de consulta; não apagar índices somente por estarem “unused”. |
| P2 | Os testes atuais não exercitam provedores reais nem a integração de webhook ponta a ponta. | Há funções publicadas, mas nenhuma execução em `prospecting_runs` e nenhuma validação de credencial real registrada. | Criar ambiente de homologação, registrar webhooks de teste, executar cenários de sucesso/erro/duplicidade e guardar evidências. |

## Situação das integrações

Não há base para afirmar que todas as APIs estão configuradas ou funcionando. O banco contém conexões sandbox e alguns itens marcados conectados para demonstração, mas `last_tested_at`/`last_success_at` está vazio nos provedores consultados. Em particular, **Apify e Google Places estão desativados e sem configuração real**. A publicação das Edge Functions confirma apenas que o código está implantado, não que a credencial do fornecedor responde.

## Ordem de conclusão comercial

1. Ativar proteção de senha vazada e criar ambiente de homologação isolado.
2. Reconciliar migrations e remover do plano de execução as estruturas de venda/recebimento incompatíveis com o produto.
3. Migrar as configurações que ainda dependem de `createBackendStore` para entidades por organização; manter somente módulos que servem ao fluxo comercial aprovado.
4. Configurar e testar, um a um, Apify/Google Places, WhatsApp, e-mail, agenda e IA com chaves reais mantidas no servidor.
5. Executar uma homologação completa: busca de até 10 leads, deduplicação, primeiro contato autorizado, resposta recebida, passagem para humano, reunião, rascunho de orçamento, envio e auditoria.
6. Publicar somente após evidências de RLS entre duas organizações, logs de webhook idempotentes e monitoramento de falhas/risco de WhatsApp.

## Critério objetivo para “modo real”

Um canal ou fonte só pode ser marcado como produção quando: credencial está salva no servidor; teste do provedor passou; `last_success_at` possui data real; uma execução de homologação registrou resultado; e há mecanismo de desativação imediata. Sem essas cinco condições, a interface deve mostrar **Sandbox** ou **Não configurado**, nunca “Conectado”.
