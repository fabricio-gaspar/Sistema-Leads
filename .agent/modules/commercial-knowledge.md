# Conhecimento comercial estruturado

## Fonte operacional

- `knowledge_sources` registra origem, escopo, estado e erro de sincronização.
- `knowledge_catalog_items` separa produto, serviço, catálogo e documento, preservando URL e
  payload de origem. `qualification_questions` armazena até oito guias internos de descoberta;
  itens ativos aprovados geram `documents` e `knowledge_chunks` derivados.
- `knowledge_item_relations` relaciona os quatro tipos sem cruzar organizações.
- `conversation_knowledge_events` liga conteúdo preparado à mensagem humana auditável.

## Caminhos

- Configurações > Empresa e conhecimento usa `catalogKnowledgeRepository.ts` e as abas
  Visão geral, Produtos, Serviços, Catálogos, Documentos, Fontes e Configurações da Ana.
- `catalog-knowledge` é o único adaptador inicial de importação; aceita somente as três páginas
  HTTPS oficiais Wayflex. Cada nova fonte futura precisa de adaptador próprio, não de URL livre.
- A Central prepara texto e, quando o atendente marca explicitamente **Incluir imagem oficial**,
  uma referência ao item aprovado. O envio continua exclusivamente em `enviar-whatsapp` → fila
  existente → `automation-worker`; o navegador nunca recebe credenciais nem envia ao provedor.
- `ana-run` consulta os chunks derivados pela recuperação atual e recebe a intenção comercial
  classificada. Ele não recebe uma rota automática paralela nem confirma fatos ausentes.

## Guardas

- Gestão de fontes/itens/relações exige `configuration.manage`; leitura exige membro ativo;
  eventos da conversa respeitam `private.can_access_lead`.
- Fontes e URLs são rastreáveis. A sincronização falha de forma explícita em `last_error` e no
  histórico de importações; não cria dados de fallback inventados.
- Nenhuma chave privada ou envio externo é feito pelo frontend.
- Perguntas de qualificação não são fatos de produto, nem podem afirmar compatibilidade, preço,
  prazo, disponibilidade ou aplicação sem fonte oficial. O editor restringe a oito por item.
- A imagem de saída só pode referenciar um item ativo. O worker relê o item, exige URL HTTPS pública
  sem credenciais/host local, confirma o anexo auditável e interrompe o job se o item ou a imagem
  mudarem antes do despacho.

## Validação de 18/09/2026

- Migrations `commercial_knowledge_catalog`, `index_commercial_knowledge_foreign_keys` e
  `consolidate_commercial_knowledge_policies` foram aplicadas no projeto oficial. As cinco tabelas
  novas têm RLS e as tabelas de gestão têm uma política por ação; o advisor não apontou nova falha
  de política para elas.
- `catalog-knowledge` v4, `enviar-whatsapp` v7 e `ana-run` v30 estão ativos e exigem JWT.
  A v4 remove a dependência inexistente de `DOMParser` no Edge Runtime.
- Type-check frontend/Edge, lint, build e quatro testes de conteúdo passaram, incluindo dois de
  regressão do parser portátil.
- A sincronização autenticada de `/acessorios`, `/servicos` e `/catalogos` foi concluída: há três
  fontes saudáveis e três itens ativos para a Ana e a Central. A origem retornou somente as três
  páginas resumidas, sem cards/PDFs individuais no HTML; portanto nada adicional foi criado.
  Um envio externo de conteúdo ainda depende da autorização própria para a mensagem.

## Delta de 23/09/2026 — cards publicados da Wayflex

- `catalog-knowledge` v6 reconhece que as páginas públicas são uma SPA: produtos e catálogos
  são extraídos dos módulos publicados, sem simular DOM no Edge Runtime. A fonte de serviços é
  apresentada como **Segmentos e aplicações**; como seus cards são carregados dinamicamente fora
  do bundle disponível, o adaptador registra um snapshot público explícito, datado e rastreável.
- A sincronização oficial confirmou 18 produtos, 18 segmentos e 17 catálogos visuais. Cada item
  preserva a página canônica, a URL de imagem oficial, payload de origem e uma URL derivada única
  para o documento/chunk gerado; isso evita colisão na unicidade de `documents.source_url` sem
  perder rastreabilidade.
- Configurações apresenta os itens como cards responsivos com imagem, categoria, estado da Ana e
  origem. A Central mantém a pré-visualização e os formatos rápido/comercial/técnico, agora com
  nome e resumo antes do link. Arquivos seguem como links oficiais; imagem pode usar a fila Z-API,
  mas a opção automática da Ana nasce desligada até homologação controlada.
- `ana-run` v32 mantém a mesma autoridade e as mesmas guardas de canal/funil, mas trata plurais
  na busca lexical e orienta a resposta a citar até três conteúdos concretos antes da URL. Quando
  os dados não bastarem, continua perguntando ou transferindo, sem inventar especificações.
- Limitação conhecida: nenhum PDF foi publicado nas páginas atuais e o snapshot de segmentos deve
  ser trocado por uma fonte estruturada/aprovada quando a Wayflex a disponibilizar.

## Delta de 23/09/2026 — mídia de catálogo na fila WhatsApp

- A migration `20260923133000_catalog_media_whatsapp_queue` acrescenta a referência de mídia ao
  job de catálogo já existente e cria unicidade por mensagem/anexo. Não há tabela paralela, URL de
  imagem no payload de saída ou alteração de dados de lead.
- `enviar-whatsapp` v8 aceita apenas `content_send_image` booleano associado a um item do catálogo.
  `automation-worker` v31 usa `send-image` da Z-API somente depois de revalidar item, anexo,
  política, canal, aprovação e URL pública. Falhas seguras não trocam mídia nem fazem downgrade
  silencioso para outro conteúdo.
- `ana-run` v33 só seleciona uma imagem em resposta recebida via WhatsApp quando a configuração
  publicada habilita mídia, não há handoff/risco/orçamento e a correspondência lexical é forte. A
  apresentação inicial permanece texto; a Ana não decide anexos pelo modelo.
- A Central oferece a seleção manual por item e indica que imagem e texto estão vinculados à fila.
  Ainda não houve envio externo de mídia: aceite, entrega e leitura continuam pendentes de
  homologação controlada.
