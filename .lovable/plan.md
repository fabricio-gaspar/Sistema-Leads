# Plano de Reconstrução da Tela Empresa — LeadAI

Este plano detalha a reconstrução da tela "Empresa" para alinhar-se visualmente à referência LeadAI (sidebar escura, primary teal) e funcionalmente aos módulos de Dados, Abordagem, Apresentação e Documentos.

## Objetivos
1.  **Reestruturação Visual**: Migrar para um layout de abas (Dados, Abordagem, Apresentação, Documentos) com navegação em pílulas Teal.
2.  **Módulo Dados**: Reutilizar `getCompanySettings` e `updateCompanySettings` para gerenciar informações básicas (CNPJ, Porte, Segmento).
3.  **Módulo Abordagem**: Integrar configurações de canais (WhatsApp, E-mail, Telefone) e orquestração de sequências multicanal.
4.  **Módulo Apresentação**: Centralizar argumentos de vendas, diferenciais e casos de sucesso que alimentam a base da Ana.
5.  **Módulo Documentos**: Melhorar o gerenciamento de documentos RAG (PDF, DOCX, TXT) com status de processamento e isolamento por tenant.
6.  **UX LeadAI**: Aplicar o tema escuro na sidebar e o tom teal (`oklch(70% 0.15 170)`) em botões de ação e estados ativos.

## Detalhes Técnicos

### 1. Interface de Abas
- Utilizar `framer-motion` para transições suaves entre abas.
- Barra de navegação customizada com indicadores de estado "Ativo" em Teal.

### 2. Integração de Dados
- **Dados**: Persistência na tabela `company_settings`.
- **Abordagem**: Utilizar `outreach_sequences` e `integrations` para exibir o status real dos canais.
- **Documentos**: Refinar o componente `DocumentosCard` para suportar o fluxo de upload para `<organizationId>/<arquivo>` no bucket `docs`.

### 3. Segurança e RLS
- Garantir que todas as chamadas `rpc("current_org_id")` sejam tratadas corretamente.
- Manter o uso de `assertAdmin` para proteger ações de escrita.

## Cronograma de Implementação
- **Fase 1**: Refatoração da estrutura base (Abas e Navegação).
- **Fase 2**: Reimplementação das sub-telas (Dados e Apresentação).
- **Fase 3**: Integração do novo fluxo de Abordagem (Sequências).
- **Fase 4**: Polimento visual e validação de permissões (has_role).

---
*Nota: Todas as funcionalidades mockadas serão mantidas em modo Sandbox até a conexão real ser explicitamente ativada.*
