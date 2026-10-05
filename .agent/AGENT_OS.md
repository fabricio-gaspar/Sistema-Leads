# AGENT OS — WayFlex CRM

## Finalidade

Este diretório é a memória técnica persistente do projeto. Ele evita auditorias completas
repetidas, perda de requisitos e declarações sem evidência. Não substitui o código, as
migrations, os testes ou `docs/CONTINUIDADE_WAYFLEX.md`.

## Fluxo obrigatório

Para uma nova solicitação:

1. Ler `audit-state.json`, `system-baseline.md`, `architecture-map.md`,
   `requirements-registry.json`, `known-issues.md`, `test-baseline.json`,
   `execution-history.md` e somente os módulos relevantes em `modules/`.
2. Comparar `last_audited_commit` com o `HEAD` e o working tree.
3. Analisar o pedido integralmente e registrar requisitos numerados.
4. Verificar dependências diretas, consumidores, rotas, tabelas, funções e testes afetados.
5. Produzir um pré-flight curto com baseline, delta, impacto, estado, risco, plano e aceite.
6. Solicitar uma única aprovação quando ainda não houver autorização equivalente.
7. Após aprovação, executar todo o escopo possível, testar, auditar e atualizar o baseline.

Quando o usuário disser “aplique”, “pode seguir”, “continue” ou equivalente sobre um plano já
aprovado, isso é autorização de execução. Não solicitar aprovações repetidas para etapas
normais do mesmo escopo.

## Primeira auditoria e auditoria incremental

Uma auditoria completa só é necessária quando não há baseline confiável ou quando houver:

- mudança arquitetural ampla, framework, autenticação ou multiempresa;
- banco migrado de forma estrutural;
- histórico Git reescrito, baseline inconsistente ou divergência de releases;
- marco de produção/comercialização ou evidência nova de risco crítico.

Nos demais casos usar:

`BASELINE + DELTA + IMPACTO + NOVO PEDIDO`

Não reler indiscriminadamente o repositório. A unidade de análise é:

`arquivo alterado + dependências diretas + consumidores + módulo afetado`.

## Estados e evidência

Durante análise técnica, usar:

- `CONFIRMADO`: há evidência proporcional e atual.
- `PARCIAL`: existe implementação, mas falta validação ou parte do fluxo.
- `INFERIDO`: sinais fortes, sem confirmação suficiente.
- `NÃO VERIFICADO`: não houve acesso ou teste adequado.
- `AUSENTE`: busca dirigida confirmou que não existe.

Na matriz final usar somente `CONCLUÍDO`, `PARCIAL`, `BLOQUEADO` ou `NÃO APLICÁVEL`.

Código não prova funcionamento; botão não prova conexão; tabela não prova fluxo; API
configurada não prova disponibilidade; migration escrita não prova aplicação; build não
prova homologação; `sent` não prova entrega/leitura.

Nunca inventar arquivo, componente, tabela, coluna, endpoint, credencial, resultado, teste,
commit, deploy, dado empresarial, preço, prazo, desconto, estoque, certificação ou status.

## Pré-flight compacto

Antes de implementar, informar somente o necessário:

- pedido interpretado e requisitos;
- baseline reutilizado;
- delta desde a última validação;
- módulos e fluxos afetados;
- estado de cada requisito;
- problemas relacionados encontrados;
- risco real, sequência e critérios de aceite;
- roteamento de modelo recomendado, sem fingir que houve troca.

## Roteamento econômico

- `LUNA`: localização, inventário, comparação mecânica, textos e pequenas alterações.
- `TERRA`: executor padrão para frontend, backend convencional, CRUD, testes e refatoração.
- `SOL`: arquitetura, segurança, RLS/RBAC, multiempresa, migrations críticas, concorrência,
  filas, IA complexa e revisão crítica.

Usar o modelo de menor custo capaz de realizar a tarefa com segurança. Se o ambiente não
permitir alternar ou delegar, registrar apenas a recomendação e usar o modelo disponível.
Não fingir troca de modelo.

## Regras de execução

- Reutilizar → corrigir → estender → refatorar → criar.
- Preservar funções existentes e testar consumidores de componentes compartilhados.
- Fazer banco/schema, backend, segurança, integração, frontend, estados, erros e testes na
  ordem exigida pelo fluxo, ajustando somente quando tecnicamente necessário.
- Não encerrar após implementar apenas frontend ou backend de um requisito ponta a ponta.
- Em bloqueio externo, concluir o restante e registrar motivo, evidência, requisito faltante,
  local de configuração e validação posterior.
- Em falha comum, investigar causa, corrigir, repetir o teste relacionado e continuar.
- Não usar mocks operacionais, métricas fictícias ou estados locais como verdade de produção.
- Filtros e preferências pessoais podem permanecer locais; dados operacionais não.

## Critérios permanentes do WayFlex CRM

- Supabase é a fonte operacional; RLS/RBAC preservam organização e carteira.
- `ana-run` é a única autoridade automática da Ana; assistências humanas não alteram o CRM
  nem enviam sem passar pelo backend.
- O fluxo crítico é Lead → Atendimento → Ana/Humano → Kanban → Tarefa/Reunião → Orçamento.
- Toda entrada e saída deve ficar no histórico cronológico do lead.
- Eventos, filas e ações externas precisam de idempotência, retry controlado, reconciliação e
  auditoria. Resultado ambíguo nunca é reenviado às cegas.
- Produção, envio real e reprocessamento de callbacks antigos permanecem bloqueados durante
  testes não homologados.
- Ana não confirma preço, desconto, prazo, estoque, frete, certificação ou compatibilidade sem
  fonte aprovada e revisão humana; não marca “Ganho” sozinha.
- Opt-out interrompe automação; handoff humano preserva todo o histórico.
- Segredos ficam no backend e nunca em navegador, documentação, logs ou Git.

## Testes proporcionais

Selecionar os testes relacionados: typecheck, lint, build, unitários, integração, banco,
migrations, RLS/RBAC, API, webhook, filas, autenticação, E2E, responsividade e estados de
loading/empty/error. Não executar testes irrelevantes apenas para aumentar números.

## Auditoria e fechamento

Antes de encerrar comparar requisitos × implementação × integrações × testes × resultado.
Procurar requisito esquecido, TODO crítico, mock indevido, botão sem ação, rota sem proteção,
API sem conexão, duplicidade, regressão e fluxo parcialmente conectado.

Atualizar:

- `audit-state.json` com hashes reais e estado do working tree;
- `system-baseline.md` somente com fatos úteis;
- `requirements-registry.json` sem apagar requisitos;
- `known-issues.md` separando bugs de sugestões;
- `test-baseline.json` com comandos e resultados reais;
- `execution-history.md` de forma resumida;
- `architecture-map.md` e `modules/` somente quando mudarem.

Nenhum processo do agente continua depois do fim da conversa. O checkpoint deve indicar a
próxima ação exata para que “pode seguir” retome sem nova auditoria completa.
