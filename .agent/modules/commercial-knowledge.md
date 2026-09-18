# Conhecimento comercial estruturado

## Fonte operacional

- `knowledge_sources` registra origem, escopo, estado e erro de sincronização.
- `knowledge_catalog_items` separa produto, serviço, catálogo e documento, preservando URL e
  payload de origem. Itens ativos aprovados geram `documents` e `knowledge_chunks` derivados.
- `knowledge_item_relations` relaciona os quatro tipos sem cruzar organizações.
- `conversation_knowledge_events` liga conteúdo preparado à mensagem humana auditável.

## Caminhos

- Configurações > Empresa e conhecimento usa `catalogKnowledgeRepository.ts` e as abas
  Visão geral, Produtos, Serviços, Catálogos, Documentos, Fontes e Configurações da Ana.
- `catalog-knowledge` é o único adaptador inicial de importação; aceita somente as três páginas
  HTTPS oficiais Wayflex. Cada nova fonte futura precisa de adaptador próprio, não de URL livre.
- A Central apenas prepara conteúdo. O envio continua em `enviar-whatsapp` → fila existente →
  `automation-worker`; PDF/imagem é compartilhado como link rastreável até existir um pipeline de
  mídia homologado.
- `ana-run` consulta os chunks derivados pela recuperação atual e recebe a intenção comercial
  classificada. Ele não recebe uma rota automática paralela nem confirma fatos ausentes.

## Guardas

- Gestão de fontes/itens/relações exige `configuration.manage`; leitura exige membro ativo;
  eventos da conversa respeitam `private.can_access_lead`.
- Fontes e URLs são rastreáveis. A sincronização falha de forma explícita em `last_error` e no
  histórico de importações; não cria dados de fallback inventados.
- Nenhuma chave privada ou envio externo é feito pelo frontend.

## Validação de 18/09/2026

- Migrations `commercial_knowledge_catalog`, `index_commercial_knowledge_foreign_keys` e
  `consolidate_commercial_knowledge_policies` foram aplicadas no projeto oficial. As cinco tabelas
  novas têm RLS e as tabelas de gestão têm uma política por ação; o advisor não apontou nova falha
  de política para elas.
- `catalog-knowledge` v3, `enviar-whatsapp` v7 e `ana-run` v30 estão ativos e exigem JWT.
- Type-check frontend/Edge, lint, build e dois testes de formatação de conteúdo passaram.
- A sincronização real das páginas e um envio externo de conteúdo continuam dependentes da ação
  autenticada/autorizações próprias; não devem ser declarados homologados antes disso.
