# Fase 5 — CPQ e Orçamentos Operacionais

## Entrega

Orçamentos deixam o armazenamento legado e passam a usar as entidades relacionais multiempresa:

- `crm_opportunities` como oportunidade comercial vinculada ao lead;
- `crm_proposals` para proposta, versão, validade, desconto, status e arquivamento lógico;
- `crm_proposal_lines` para itens e preços congelados no momento da cotação;
- `crm_catalog_items.base_unit_price` como preço-base do catálogo operacional.

O formulário de catálogo agora permite cadastrar/importar o preço-base. A tela de Orçamentos consome somente os itens ativos, permitidos para orçamento e pertencentes à organização ativa. Não há mais catálogo paralelo fixo no módulo de proposta.

## Integridade e segurança

- A criação é atômica: uma única RPC cria oportunidade, proposta e itens, ou não grava nada.
- A edição substitui as linhas em uma transação depois de validar associação, valores, status e organização.
- A exclusão da interface é arquivamento lógico; propostas e linhas não são apagadas pelo navegador.
- Toda RPC valida usuário autenticado e associação ativa com papel `owner`, `admin`, `manager` ou `seller` antes de operar.
- O número da proposta segue o formato `PRP-AAAAMMDD-XXXXXX`, reduzindo colisões sem revelar volume comercial de outras empresas.
- Preço e descrição das linhas são registrados na própria proposta; uma alteração posterior no catálogo não reescreve documentos históricos.

## Aplicação controlada

1. Aplicar as migrations das Fases 1 a 5 em ordem em um projeto Supabase de homologação.
2. Conferir grants e RLS para `crm_catalog_items`, `crm_proposals`, `crm_proposal_lines`, `crm_opportunities` e `crm_leads`.
3. Criar duas organizações, com um vendedor em cada uma, e validar que nenhuma RPC aceita IDs da outra organização.
4. Cadastrar um item com preço-base, criar uma proposta, editar itens/desconto, gerar nova versão e arquivar a versão não aceita.
5. Só depois conectar aceite público, assinatura, pagamento ou envio por e-mail/WhatsApp — esses canais continuam desligados nesta fase.

As migrations são versionadas e não foram aplicadas a ambiente remoto neste pacote.
