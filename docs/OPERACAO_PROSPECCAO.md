# Operação de prospecção e atendimento

## Fluxo oficial

1. O administrador pesquisa empresas em **Prospecção** e informa os filtros, inclusive município e raio quando usar Google Places.
2. A pesquisa apenas cria uma lista de prospectos. Nenhum contato é realizado nessa etapa.
3. O administrador marca explicitamente os prospectos desejados e usa **Enviar selecionados para Leads**. Essa ação aplica o modo configurado: **automático**, **por score** ou **manual**.
4. Toda decisão fica registrada no lead e em `lead_contact_approval_events`. Somente os estados `approved` ou `inbound` podem iniciar contato.
5. Quando aprovado, o banco cria o ticket, o sistema matricula o lead na cadência escolhida e tenta imediatamente: **WhatsApp (Z-API) → e-mail (Resend) → tarefa humana de ligação**.
6. Cada tentativa, falha de integração, entrega, resposta e encaminhamento fica registrada no histórico do lead.
7. Dúvidas básicas são respondidas somente com a base aprovada. Interesse comercial, pedido de atendimento humano ou baixa confiança pausam a IA e criam tarefa/notificação para o vendedor.
8. Imagens recebidas são descritas pela IA configurada; áudios são transcritos pela OpenAI. Falha ou formato sem análise segura gera handoff.
9. Opt-out interrompe a cadência imediatamente.

## Secrets obrigatórios

Configure no cofre de secrets do projeto; nunca salve esses valores no navegador ou em tabelas acessíveis ao usuário.

| Secret                                                    | Uso                                                                 |
| --------------------------------------------------------- | ------------------------------------------------------------------- |
| `SUPABASE_URL`                                            | Banco, autenticação e storage                                       |
| `SUPABASE_PUBLISHABLE_KEY`                                | Cliente autenticado do Supabase                                     |
| `SUPABASE_SERVICE_ROLE_KEY`                               | Webhooks e agendador no servidor                                    |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` | Configure um ou mais provedores; áudio exige OpenAI                 |
| `ZAPI_INSTANCE_ID`                                        | Instância WhatsApp                                                  |
| `ZAPI_TOKEN`                                              | Token da instância Z-API                                            |
| `ZAPI_CLIENT_TOKEN`                                       | Segurança adicional da conta Z-API                                  |
| `ZAPI_WEBHOOK_SECRET`                                     | Segredo incluído na URL do callback ou no header `x-webhook-secret` |
| `RESEND_API_KEY`                                          | Envio do fallback por e-mail                                        |
| `OUTREACH_EMAIL_FROM`                                     | Remetente validado, por exemplo `Ana <ana@empresa.com.br>`          |
| `RESEND_WEBHOOK_SECRET`                                   | Assinatura Svix do webhook de eventos e e-mails recebidos           |
| `OUTREACH_CRON_SECRET`                                    | Bearer token do agendador de cadência                               |
| `GOOGLE_PLACES_API_KEY`                                   | Places API (New) e Geocoding API para busca por raio                |
| `APIFY_TOKEN`                                             | Fonte Apify, se habilitada                                          |
| `INBOUND_MEDIA_ALLOWED_HOSTS`                             | Lista opcional de hosts autorizados para baixar anexos              |

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

O repositório inclui `.github/workflows/automation-cron.yml`. Cadastre em **GitHub > Settings > Secrets and variables > Actions**:

- `AUTOMATION_BASE_URL`: URL publicada, sem barra final;
- `OUTREACH_CRON_SECRET`: o mesmo segredo configurado na aplicação.

O workflow chama o follow-up e as campanhas a cada cinco minutos. A tela **Relatórios** mostra o último heartbeat e alerta após 15 minutos sem execução.

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
- documentos ativos enviados em PDF, DOCX, XLSX, TXT, Markdown, CSV ou JSON;
- páginas HTTPS importadas por URL.

PDF, Word e Excel só entram no RAG depois que a extração e indexação terminarem sem erro. Para cada pergunta, o sistema recupera por relevância apenas os trechos relacionados antes de enviá-los à Ana; essa busca lexical não gera custo de embeddings. O card do documento mostra o estado da indexação.

## Checklist antes de produção

- Aplicar todas as migrations do Supabase.
- Confirmar em **Configurações > Prospecção** o modo de aprovação, score mínimo, provedores e estratégia de classificação.
- Confirmar na tela de Integrações que Z-API, webhook, agendador e e-mail aparecem como configurados.
- Testar a conexão Z-API.
- Validar o domínio remetente no Resend.
- Executar um teste com um número e e-mail controlados.
- Confirmar recebimento, resposta, handoff, opt-out e fallback de canal.
- Revisar textos legais, política de privacidade, base legal e retenção de dados com responsável jurídico/LGPD.
- Configurar monitoramento de erros e alertas de falha dos webhooks/agendador.

# Operação comercial automatizada

## Fluxo ponta a ponta

1. A prospecção consulta uma fonte real, aplica filtros de ICP, município/UF e raio.
2. O administrador analisa score, motivo, fonte e data de verificação antes de converter.
3. Na conversão, o sistema grava score determinístico, parecer de cada IA, resultado combinado e aplica a aprovação configurada.
4. Após aprovação, cria ticket, matricula na cadência padrão ou naquela escolhida pela campanha e executa o primeiro passo imediatamente.
5. A cadência tenta WhatsApp, aguarda o prazo configurado, usa e-mail quando permitido e, por último, cria uma tarefa humana de telefone. O sistema nunca simula uma ligação automática.
6. Resposta, opt-out, bloqueio, fechamento ou handoff pausam/cancelam a cadência imediatamente.
7. A Ana responde apenas com base em documentos e respostas aprovadas. Cada interação pode atualizar a qualificação estruturada.
8. Pedido de humano, proposta, preço, reunião, baixa confiança, risco ou prontidão acima do limite gera um handoff único, com resumo, responsável e SLA.
9. O vendedor aceita o atendimento na Central, agenda reunião, conduz proposta e atualiza o estágio até Fechado ou Perdido.

## Estruturas de dados

- `outreach_sequences` e `outreach_sequence_steps`: definição administrativa da cadência.
- `lead_sequence_enrollments`: posição, próxima execução, pausa, conclusão e falha por lead.
- `lead_qualifications`: intenção, dor, urgência, decisor, objeções, sentimento, próxima ação, resumo, evidências e prontidão.
- `lead_handoffs`: fila de transferência, contexto, responsável, SLA e aceite.
- `appointments`: reuniões internas. Um calendário externo só é considerado integrado quando houver provider e credenciais válidas.
- `leads.score_snapshot`: fotografia do score e sinais disponíveis na conversão.

## Requisitos externos

- Supabase com todas as migrations aplicadas.
- Uma ou mais entre `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` e `GEMINI_API_KEY` para classificação e atendimento.
- `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN` e, quando exigido, `ZAPI_CLIENT_TOKEN`.
- `ZAPI_WEBHOOK_SECRET` para validar eventos de WhatsApp.
- `RESEND_API_KEY`, `OUTREACH_EMAIL_FROM` e `RESEND_WEBHOOK_SECRET` para e-mail.
- `OUTREACH_CRON_SECRET` e agendador chamando `POST /api/public/outreach-tick` a cada cinco minutos.

Ausência de credencial deve aparecer como **Pendente/Não configurado**. Nunca registrar o valor de um secret em tela, log ou auditoria.

## Checklist de teste seguro

1. Ativar `sandbox_mode`.
2. Criar um lead exclusivo de teste e marcar ao menos um `contact_points.sandbox=true`.
3. Confirmar que contato real sem a marca de sandbox é bloqueado.
4. Iniciar a cadência e verificar matrícula, passo atual e `outreach_jobs` idempotente.
5. Simular entrega, leitura, falha e resposta usando payloads assinados de teste.
6. Confirmar que resposta e opt-out param próximos passos.
7. Gerar handoff, validar que não duplica, conferir SLA e aceitar como vendedor.
8. Agendar reunião e confirmar a criação da próxima tarefa.
9. Conferir RLS com administrador, SDR, vendedor e CX.
10. Rodar typecheck, build e a varredura de dados simulados antes de desativar o sandbox.
