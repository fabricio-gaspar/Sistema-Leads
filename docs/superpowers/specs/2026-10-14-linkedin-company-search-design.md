# Conector LinkedIn Company Search — WayFlex CRM

## Objetivo

Adicionar uma fonte técnica `linkedin` para buscar empresas B2B pelo Actor LinkedIn Company Search Scraper da HarvestAPI, sem substituir as fontes atuais `apify` (Google Maps) e `google_places` (Google Places).

O resultado entra em uma fila de revisão do CRM. A busca não cria campanha, não envia WhatsApp e não ativa a Ana automaticamente.

## Baseline e limites

- `apify` permanece associado ao fluxo de Google Maps e ao contrato já validado.
- `google_places` permanece separado e continua exigindo uma chave Google Places.
- O Actor recomendado é `taHaRcqil3scbchuI`, mas o ID final deve ser configurável no cofre para permitir rotação sem novo build.
- O token Apify, o Actor ID e o Task ID nunca aparecem no frontend, Git ou logs.
- Busca, custo e disponibilidade do Actor dependem do Apify; nenhum run pago será iniciado automaticamente por esta implementação.

## Contrato funcional

### Configuração da fonte

`source_key = linkedin` usa credenciais server-side com:

- `api_token` obrigatório;
- `actor_id` ou `task_id`, exatamente um obrigatório;
- `default_mode` opcional (`short` ou `full`), com `full` como escolha explícita do administrador.

O card LinkedIn começa desativado e só fica disponível após teste autenticado da configuração. O teste consulta metadados do Actor/Task, sem iniciar uma execução.

### Filtros

Os filtros aceitos são:

- `searchQuery` (texto);
- `locations` (até 20 localidades);
- `industryIds` (até 20 IDs);
- `companySize` (faixas de porte);
- `maxItems` (limite explícito, no máximo 1.000);
- `scraperMode` (`short`/`full`).

O backend remove campos desconhecidos, aplica limites e rejeita entrada vazia antes de criar qualquer execução.

### Normalização e revisão

Cada item é normalizado para o contrato de prospecção existente:

- `name` ← nome da empresa;
- `website` ← site público quando fornecido;
- `phone` ← telefone quando fornecido, podendo permanecer vazio;
- `address`, `city` e `uf` ← localização parseada quando disponível;
- `segment` ← indústrias/especialidades;
- `sourceUrl` ← URL pública do LinkedIn;
- `employeeCount`/porte ficam em metadados de origem, sem inventar contato.

O resultado é deduplicado antes de ser apresentado. A prioridade de identidade é URL do LinkedIn, depois domínio normalizado e, por fim, nome + localidade. Um item sem telefone ou e-mail continua sendo empresa encontrada, mas não é convertido em contato abordável nem liberado para a Ana.

## Arquitetura e segurança

1. A tela solicita uma execução autenticada da Edge `prospectar-leads`.
2. A Edge valida organização, papel e configuração `linkedin` no backend.
3. O cliente Apify inicia uma execução uma única vez; respostas ambíguas não são reenviadas automaticamente.
4. O backend acompanha o estado, lê o dataset e grava resultado/cache com `organization_id`, `source_key` e `provider_run_id`.
5. Cada execução recebe chave idempotente por organização, fonte e parâmetros normalizados. Repetições retornam a execução existente enquanto ela estiver pendente ou pronta.
6. Falhas de autenticação, limite, timeout e Actor inválido viram códigos sanitizados; o token nunca entra em logs ou resposta.
7. Toda promoção de empresa para lead continua explícita e auditável. Handoff, proteção de agenda e bloqueios da Ana permanecem inalterados.

Não haverá migration nesta primeira etapa se as tabelas atuais de fontes, runs e cache suportarem `source_key` arbitrário. Se a constraint atual impedir `linkedin`, será criada uma migration mínima e somente após validação de RLS, índices e isolamento por organização.

## Interface

- Adicionar LinkedIn ao catálogo de fontes reais em Configurações → APIs.
- Exibir descrição, estado (`Não configurado`, `Validando`, `Pronto`, `Erro`) e último teste sem mostrar segredos.
- Adicionar LinkedIn como opção de busca somente quando a fonte estiver pronta.
- Mostrar custo/limite antes de iniciar uma busca e permitir cancelar antes do início; não executar busca em carregamento de tela.
- Exibir resultados como revisão, com ação explícita para promover ao CRM.

## Erros e observabilidade

Registrar somente metadados sanitizados: organização, fonte, run ID do provedor, estado, duração, quantidade e código de erro. Usar timeout e retry apenas para leituras idempotentes; não repetir automaticamente o POST que inicia o Actor. Falhas persistentes devem aparecer na execução e no diagnóstico da fonte.

## Testes e aceite

- Testes unitários para validação de filtros e normalização de itens completos, incompletos e duplicados.
- Testes de contrato para `source_key=linkedin`, configuração ausente, tenant diferente e permissão insuficiente.
- Teste de idempotência para POST repetido e resposta ambígua.
- Teste de erro para 401/403/404/429/timeout sem expor segredo.
- Type-check Edge/frontend, lint direcionado, suíte Vitest, build e artefato Sites.
- Teste autenticado no painel somente com credencial cadastrada pelo usuário; não executar Actor pago nem enviar mensagem real durante a validação.

## Pendências explícitas

- Token Apify e Actor/Task ID precisam ser inseridos pelo administrador no painel.
- A execução real continua bloqueada até esse cadastro e um teste de conexão aprovado.
- O Actor não substitui um conector de perfis/pessoas; esse é um fluxo futuro separado.
