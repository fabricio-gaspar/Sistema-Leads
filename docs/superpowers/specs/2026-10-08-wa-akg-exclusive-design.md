# WA-AKG Exclusivo — Design

## Objetivo

Retirar o Evolution GO de todo comportamento ativo do WayFlex CRM e consolidar o WA-AKG como o único transporte de WhatsApp. A mudança deve preservar o fluxo validado localmente de Central de Atendimento e WA-AKG, sem enviar mensagens, alterar produção, aplicar migrations remotas ou publicar o Site.

## Contexto e decisão

O repositório contém duas implementações concorrentes de WhatsApp. A função `whatsapp-accounts` hoje seleciona `evolution_go` como provedor ativo, enquanto a Central, o worker de automação e o painel local WA-AKG mantêm fluxos WA-AKG. Essa duplicidade torna possível que interface, conta, fila e worker escolham provedores diferentes.

A decisão aprovada é a desativação total do Evolution GO no funcionamento ativo. Migrations históricas já versionadas e o histórico Git ficam preservados para reproduzir bancos existentes; eles não representam um caminho ativo do produto. Dados remotos permanecem intocados nesta etapa.

## Escopo funcional

### Canal WhatsApp canônico

- `wa_akg` será o único valor de provedor selecionável por telas, repositórios, Edge Functions, workers e rotas de mensagem do CRM.
- A Central continuará criando mensagens e jobs sem afirmar entrega quando houver apenas aceite/enfileiramento. Estados de recibo permanecem a única prova de entrega.
- A criação e a remoção de vendedores deverão usar o lifecycle WA-AKG existente ou um adaptador WA-AKG equivalente; nenhum caminho poderá criar, consultar ou remover uma instância Evolution GO.
- A recuperação de lifecycle aceitará apenas `wa_akg` e preservará isolamento por organização e por vendedor.

### Superfícies a retirar

- Painel, onboarding, tipos, textos, atalhos e testes do Evolution GO no frontend.
- Edge Functions, webhooks, workers, providers compartilhados e helpers exclusivos do Evolution GO.
- Referências de roteamento, provisionamento e exclusão de vendedor que dependam de tabelas, funções ou jobs Evolution GO.
- Configurações locais que publiquem funções Evolution GO.

### Dados e migrations

- Uma migration nova e reversível no repositório marcará contas, controles e integrações `evolution_go` como inativos, sem apagar contas, conversas, mensagens, recibos, auditoria ou segredos.
- Migrations históricas não serão apagadas nem reescritas. Elas são necessárias para replay, diagnóstico e recuperação de instalações que já as aplicaram.
- A migration permanecerá somente no checkout até autorização específica para homologação e aplicação remota.

## Proteções de escopo

As seguintes alterações locais pré-existentes são protegidas e não serão sobrescritas, descartadas ou revertidas:

- `src/components/feature/WaAkgPanel.tsx`
- `src/lib/crm/whatsappAccountsRepository.ts`
- `src/pages/dashboard/atendimento/AtendimentoEntry.tsx`
- `src/pages/dashboard/atendimento/page.tsx`
- `src/pages/dashboard/configuracoes/components/WhatsAppEntriesTab.tsx`
- `supabase/functions/wa-akg/index.ts`

Quando a retirada precisar alterar um desses arquivos, a implementação só poderá adicionar ou remover a parte Evolution GO, preservando o delta WA-AKG atual. Cada alteração terá teste de regressão direcionado.

## Fora de escopo

- Aplicar migration, alterar RLS/produção, fazer deploy de Edge Function/Site, criar recursos remotos ou enviar mensagens reais.
- Apagar dados remotos e históricos de Evolution GO.
- Criar staging, corrigir a versão upstream do gateway, decidir o modelo CRM interno/SaaS ou prometer MFA obrigatório. Esses itens exigem decisão de produto e/ou infraestrutura externa.
- Alterar o comportamento funcional já validado hoje para WA-AKG e Central de Atendimento.

## Arquitetura-alvo

```text
Central de Atendimento
  -> whatsapp_accounts (provider = wa_akg)
  -> enviar-whatsapp (job durável)
  -> automation-worker / wa-akg-worker
  -> WA-AKG
  -> webhook-wa-akg / recibo
  -> histórico da conversa
```

Todos os pontos de seleção de conta devem filtrar `provider = 'wa_akg'`, obedecer `organization_id`, dono da conta quando aplicável, permissões do ator e controles de envio. O worker deve diferenciar explicitamente aceite HTTP, processamento do job, confirmação do provedor e recibo de entrega.

## Erros e segurança

- Nenhuma falha de rede deve converter mensagem em entregue; ela fica em estado de falha ou reconciliação pendente.
- Webhooks e workers preservam segredo fora de logs, idempotência, timeout e isolamento multiempresa.
- Toda alteração de conta ou controle exige autorização da organização e da função do usuário; não haverá fallback para provedor legado.
- A UI informa indisponibilidade/pendência sem expor URL, token ou erro bruto do gateway.

## Estratégia de testes

- Cada alteração de comportamento começa por teste em vermelho e só então pelo código mínimo para verde.
- Testes unitários cobrem seleção de `wa_akg`, lifecycle, provisionamento/remoção de vendedor, estados de fila e recibo, e ausência de chamadas para Evolution GO.
- Testes de Edge cobrem autorização, organização diferente, duplicata, erro de rede e retomada de job.
- A validação final inclui testes direcionados, type-check, lint, build e suite completa. Falhas pré-existentes serão relatadas, não ocultadas.
- Não haverá QR, pareamento, mensagem real, chamada de gateway ou mudança de dados em testes.

## Critérios de aceite

1. Nenhuma tela, rota ativa, função publicada localmente, worker ou webhook chama Evolution GO.
2. O WA-AKG é o único provedor selecionado para conta, envio, provisionamento e lifecycle de vendedor.
3. A Central preserva o comportamento WA-AKG atualmente validado e apresenta corretamente estados de fila, falha, aceite e recibo.
4. O código não remove nem modifica dados remotos ou migrations históricas.
5. Os testes direcionados e a verificação estática passam; resultados da suite completa são reportados com transparência.

## Reversão

Antes de qualquer aplicação remota, a reversão é apenas Git: restaurar o commit anterior e não aplicar a nova migration. Caso a etapa seja futuramente homologada, a reversão remota exigirá uma migration compensatória revisada, nunca a exclusão ou edição de migrations já aplicadas.
