# Fase 4 — listas, cadências e catálogo operacionais

## Entrega

As telas de Busca de Leads, Listas, Fluxos Prontos e Produtos/Catálogo deixam de depender das tabelas genéricas de bloco (`listas_leads`, `fluxos_automatizacao` e `catalogo_produtos`). Elas passam a usar a fonte relacional multiempresa:

- `crm_lead_lists` e `crm_lead_list_members` para curadoria e ativação de listas;
- `crm_campaigns` para cadências controladas, com passo, canal, gatilho e descrição;
- `crm_catalog_items` para ofertas e serviços que podem compor o futuro CPQ.

O fluxo de Busca de Leads agora persiste os leads antes de criar os membros da lista, respeitando as chaves estrangeiras. Exclusões de catálogo e campanhas são arquivamentos lógicos; nenhum histórico operacional é apagado.

## Segurança e governança

- Todas as novas leituras e escritas são limitadas por `organization_id` e RLS baseada em associação ativa.
- Apenas owner, admin, manager e seller podem alterar listas, campanhas e catálogo.
- O catálogo tem RLS habilitado, grants explícitos para `authenticated` e índice parcial por organização/atividade.
- Os itens de uma lista podem ser removidos sob a mesma regra de contribuição; relações entre organizações continuam bloqueadas por chaves compostas.
- Campanhas armazenam somente cadência e metadados comerciais. Nenhuma chave de provedor, integração ou envio foi habilitado.

## Aplicação controlada

1. Aplicar as migrations da Fase 1 a Fase 4, em ordem, em uma branch Supabase de desenvolvimento.
2. Confirmar que o Data API expõe as tabelas novas para `authenticated` e que RLS está habilitado.
3. Executar os cenários de RLS com duas organizações e dois perfis de contribuição antes de produção.
4. Validar o fluxo: importar/criar leads → criar lista → editar membros → ativar lista → configurar cadência → cadastrar catálogo.

As migrations estão versionadas, mas não foram aplicadas a nenhum projeto remoto neste pacote.
