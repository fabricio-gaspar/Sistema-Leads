# Operação de prospecção e atendimento

## Fluxo oficial

1. O administrador pesquisa empresas em **Prospecção** e informa os filtros, inclusive município e raio quando usar Google Places.
2. A pesquisa apenas cria uma lista de prospectos. Nenhum contato é realizado nessa etapa.
3. O administrador marca explicitamente os prospectos desejados e usa **Enviar selecionados para Leads**.
4. Ao criar o lead, a Ana inicia o primeiro contato em cascata: **WhatsApp (Z-API) → e-mail (Resend) → tarefa de ligação**.
5. Cada tentativa, falha, entrega, resposta e encaminhamento fica registrada no histórico do lead.
6. Dúvidas básicas são respondidas somente com a base aprovada. Interesse comercial, pedido de atendimento humano ou baixa confiança pausam a IA e criam tarefa/notificação para o vendedor.
7. Opt-out interrompe a cadência imediatamente.

## Secrets obrigatórios

Configure no cofre de secrets do projeto; nunca salve esses valores no navegador ou em tabelas acessíveis ao usuário.

| Secret | Uso |
| --- | --- |
| `SUPABASE_URL` | Banco, autenticação e storage |
| `SUPABASE_PUBLISHABLE_KEY` | Cliente autenticado do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhooks e agendador no servidor |
| `ANTHROPIC_API_KEY` | Mensagem inicial, resposta e decisão de handoff |
| `ZAPI_INSTANCE_ID` | Instância WhatsApp |
| `ZAPI_TOKEN` | Token da instância Z-API |
| `ZAPI_CLIENT_TOKEN` | Segurança adicional da conta Z-API |
| `ZAPI_WEBHOOK_SECRET` | Segredo incluído na URL do callback ou no header `x-webhook-secret` |
| `RESEND_API_KEY` | Envio do fallback por e-mail |
| `OUTREACH_EMAIL_FROM` | Remetente validado, por exemplo `Ana <ana@empresa.com.br>` |
| `RESEND_WEBHOOK_SECRET` | Assinatura Svix do webhook de eventos e e-mails recebidos |
| `OUTREACH_CRON_SECRET` | Bearer token do agendador de cadência |
| `GOOGLE_PLACES_API_KEY` | Places API (New) e Geocoding API para busca por raio |
| `APIFY_TOKEN` | Fonte Apify, se habilitada |

## Webhook Z-API

- URL no painel Z-API: `https://SEU_DOMINIO/api/public/zapi-webhook?secret=VALOR_DE_ZAPI_WEBHOOK_SECRET`
- Método: `POST`
- O endpoint também aceita o segredo no header `x-webhook-secret`, caso o seu intermediário permita headers personalizados.
- Habilite eventos de mensagem recebida e status de mensagem.
- O identificador da mensagem é deduplicado; reenvios do mesmo evento não duplicam a conversa.

## Agendador da cadência

Chame a cada 5 minutos:

- URL: `https://SEU_DOMINIO/api/public/outreach-tick`
- Método: `POST`
- Header: `Authorization: Bearer VALOR_DE_OUTREACH_CRON_SECRET`

O endpoint procura leads vencidos, encerra o canal sem resposta e dispara de fato o próximo canal disponível.

## Webhook Resend

- URL: `https://SEU_DOMINIO/api/public/resend-webhook`
- Método: `POST`
- Eventos: entrega, abertura, falha e `email.received`.
- Cadastre o signing secret entregue pelo Resend como `RESEND_WEBHOOK_SECRET`.
- Para receber respostas, habilite Receiving no Resend e configure o domínio/MX. O webhook valida a assinatura Svix, recupera o corpo pela API e registra a resposta no histórico.

## Base de conhecimento

A Ana usa somente:

- dados de **Minha Empresa**;
- serviços ativos do catálogo;
- respostas aprovadas em **Objeções**;
- documentos textuais ativos enviados em TXT, Markdown, CSV ou JSON.

PDF e DOC não devem ser considerados conhecimento apenas por estarem armazenados. É necessário um extrator/indexador específico antes de habilitar esses formatos.

## Checklist antes de produção

- Aplicar todas as migrations do Supabase.
- Confirmar na tela de Integrações que Z-API, webhook, agendador e e-mail aparecem como configurados.
- Testar a conexão Z-API.
- Validar o domínio remetente no Resend.
- Executar um teste com um número e e-mail controlados.
- Confirmar recebimento, resposta, handoff, opt-out e fallback de canal.
- Revisar textos legais, política de privacidade, base legal e retenção de dados com responsável jurídico/LGPD.
- Configurar monitoramento de erros e alertas de falha dos webhooks/agendador.
