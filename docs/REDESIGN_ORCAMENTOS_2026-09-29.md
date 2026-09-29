# Redesign de Orçamentos — 2026-09-29

## Escopo aplicado

- Cabeçalho da operação comercial alinhado ao mockup, com `Novo orçamento` e acesso a modelos e catálogo.
- Ação primária da tela usa o verde Wayflex da referência, sem alterar a paleta do restante do shell.
- Abas compactas com contagens reais do store operacional: Todos, Rascunhos, Em aprovação, Enviados, Aceitos e Vencidos.
- Barra de pesquisa por número, empresa, contato e itens do orçamento; filtro de responsável; filtros recolhíveis; ordenação por atualização, criação, validade e valor.
- Carteira em tabela com seleção, número/versão, empresa e contato, valor líquido, situação, responsável, validade e ações existentes.
- Estado vazio com criação do primeiro orçamento e atalhos para catálogo/modelos.
- Responsividade preservada: a tabela mantém rolagem horizontal em telas estreitas e o detalhe continua em drawer acessível.

## Preservação operacional

O redesign usa `usePropostasStore` e os contratos existentes. Não criou tabela, endpoint, integração ou fonte paralela. Permanecem os fluxos já existentes de criação vinculada a lead, aprovação de desconto, revisão, PDF, encaminhamento para atendimento, aceite, recusa com motivo e arquivamento reversível.

## Limitações confirmadas

O modelo atual ainda representa itens e condições em `proposals.items`/metadata e não possui entidades independentes para versões imutáveis, PDFs privados, tokens públicos de aceite, eventos de entrega ou busca server-side. Esses recursos do prompt completo não foram simulados no frontend; continuam como evolução de backend separada, com migration, RLS, idempotência e homologação própria antes de serem exibidos.

## Validação

- `npm run type-check`
- `npm run lint`
- `npm test -- --run` — 56 arquivos, 328 testes
- `npm run build` — artefato `dist/` gerado para Sites

Nenhuma mensagem, cobrança, checkout, chamada de provedor ou mutação operacional foi executada durante a validação.
