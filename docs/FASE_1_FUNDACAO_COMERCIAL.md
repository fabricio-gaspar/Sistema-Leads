# Fase 1 — Fundação Comercial

Esta fase transforma o protótipo em uma base segura para um SaaS B2B
multiempresa. Ela preserva a interface existente e estabelece um novo domínio
de dados. Nenhuma integração externa é ativada automaticamente.

## Decisões adotadas

- Cada dado operacional possui `organization_id` e é protegido por RLS.
- Os papéis são `owner`, `admin`, `manager`, `seller` e `viewer`.
- Segredos de provedores não são gravados no navegador, `localStorage` ou
  colunas JSON. A tabela `integration_connections` mantém apenas metadados e
  uma referência de secret administrada pelo servidor.
- Mensagens de e-mail e WhatsApp entram em `outbound_messages`; um worker
  autenticado, criado na fase de integrações, será o único responsável pelo
  envio ao provedor.
- Webhooks são idempotentes, vinculados a uma conexão específica e autenticados
  antes de acessarem dados da organização.
- A IA recebe identidade, regras e limites da organização consultada no banco.
  Não há persona ou dados de cliente codificados nas Edge Functions.

## Ordem de aplicação

1. Crie uma branch de desenvolvimento ou um projeto Supabase limpo.
2. Aplique `supabase/migrations/20260826191633_phase_1_commercial_foundation.sql`.
3. Defina os secrets: `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGIN`,
   `WHATSAPP_WEBHOOK_SHARED_SECRET`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`,
   `OPENAI_API_KEY` e `OPENAI_PROMPT_MODEL`, somente quando cada integração for
   habilitada.
4. Faça o deploy das Edge Functions. Apenas `webhook-whatsapp` deve ter
   `verify_jwt = false`; ele valida o header `x-leadai-webhook-secret` no
   código. Antes de expor esse endpoint, confirme que o provedor consegue
   encaminhar esse header. Caso não consiga, use um gateway/proxy sob controle
   da empresa para inserir e rotacionar o segredo — nunca deixe o webhook
   público sem validação.
5. Execute os testes de RLS com dois usuários de organizações distintas antes
   de migrar dados reais.
6. Migre os dados do modelo legado de blobs JSON para as entidades novas em
   lotes auditáveis e com plano de reversão.

O formulário público foi deliberadamente desligado até existir uma função
autenticada, com rate limit, antispam e destino comercial definido. Ele não
envia dados a serviços externos nesta base.

## Critérios de aceite

- Um usuário não consegue consultar, inserir ou alterar dados de outra
  organização, mesmo alterando requisições no navegador.
- Um vendedor não consegue alterar membros, organização ou conexões.
- Nenhuma chave de provedor aparece no build do frontend, em tabelas públicas
  ou no armazenamento do navegador.
- Um evento de webhook repetido não gera processamento duplicado.
- Um pedido de envio gera uma mensagem na outbox e um log de auditoria; ele não
  dispara um provedor diretamente.

## Validações locais

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run type-check
npm run lint
npm test
npm run build
```

O `package-lock.json` já faz parte desta entrega. A CI usa `npm ci` para
instalação reproduzível, sem executar scripts de ciclo de vida de dependências.
