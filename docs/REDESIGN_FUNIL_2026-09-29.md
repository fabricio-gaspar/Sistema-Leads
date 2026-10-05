# Redesign do Funil — 29/09/2026

## Escopo aplicado

O redesign usa a rota existente `/dashboard/funil`, o hook `useCommercialAnalytics` e as
entidades operacionais já existentes (`leads`, `proposals` e `lead_stage_history`). Não foi
criado um motor paralelo, endpoint novo, migration, dado demonstrativo ou integração externa.

O Funil agora separa explicitamente fotografia atual da carteira, eventos persistidos no período,
captação por data de cadastro, orçamento ativo por versão mais recente e decisões Ganho/Perdido
registradas no histórico.

## Indicadores e limites

- **Leads captados:** leads não arquivados criados no período selecionado.
- **Na carteira:** leads válidos para o Kanban, na etapa atual, respeitando os filtros atuais.
- **Orçamentos abertos:** somente as revisões mais recentes com status `enviada` ou `visualizada`.
- **Valor em aberto:** valor líquido dessas revisões, sem somar versões substituídas.
- **Conversão:** Ganhos / (Ganhos + Perdidos) decididos no período; abaixo de 10 decisões o
  painel mostra `—` e `Base insuficiente`.

Filtros ficam na URL. O filtro de etapa afeta a fotografia atual, mas não reescreve os
denominadores dos eventos históricos. O horário exibido usa `America/Sao_Paulo`.

## Interface

O cabeçalho removeu `Gerenciar base` e qualquer exclusão. A gestão definitiva da base permanece
em Leads/área administrativa. O painel inclui Pipeline atual (Leads/Valor), Movimentação no
período, Evolução, Origem, Avanço entre etapas, aviso de amostra pequena e links de exploração
para Leads, Orçamentos, histórico e Kanban.

Exportar gera CSV agregado com filtros, horário, indicadores e etapas; não expõe credenciais nem
cria uma nova fonte de dados.

## Validação

- `npm run type-check` — aprovado.
- `npm run lint` — aprovado sem warnings.
- `npm test -- --run` — 56 arquivos / 328 testes aprovados.
- `npm run build` — aprovado; artefato Sites produzido.
- Nenhum lead, orçamento, mensagem, busca, automação ou provedor externo foi acionado.

## Limitações honestas

O banco atual não possui snapshots diários nem uma entidade de oportunidade independente de lead.
Por isso a evolução informa captação e situação atual, e o painel não simula conversão histórica
de toda a carteira. A evolução futura de oportunidade deve nascer de uma tabela/evento governado,
sem alterar este contrato visual.
