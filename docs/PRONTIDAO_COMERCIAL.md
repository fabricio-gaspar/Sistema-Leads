# Operação comercial do Sistema-Leads

Esta versão consolida o fluxo de prospecção, atendimento e conversão em uma operação rastreável:

1. A equipe encontra ou importa empresas no módulo de Prospecção.
2. O administrador seleciona os leads de maior potencial e os aprova para a abordagem.
3. A Ana inicia a cadência conforme as regras de horário, consentimento e limite de frequência.
4. A prioridade é WhatsApp, seguida por e-mail; ligação vira atividade humana para o vendedor.
5. Respostas básicas usam apenas documentos ativos e indexados. Dúvidas técnicas, preço, proposta, negociação ou falta de fonte geram handoff.
6. O vendedor assume a Central de Atendimento, registra ligação, agenda reunião e conduz o negócio até a venda.

## Aplicação do banco

Antes de publicar o código, aplique as migrations em ordem, incluindo:

```text
supabase/migrations/20260722170000_commercial_readiness.sql
```

Ela cria/atualiza contatos normalizados, consentimento, solicitações LGPD, alertas, contas e decisores, campanhas, eventos de origem/UTM, busca por relevância na base de conhecimento, agenda `.ics`, atividades de ligação e recuperação da fila de cadência.

## Configuração inicial obrigatória

No painel, abra **Configurações → Operação comercial** e defina:

- dias, fuso e horário comercial;
- limite de contatos por dia e intervalo mínimo entre tentativas;
- se o contato precisa estar verificado;
- se cada lead exige aprovação administrativa antes da cadência;
- e-mail do encarregado de privacidade e período de retenção.

Para a WayFlex, a recomendação inicial é: segunda a sexta, 08:00–18:00, 1 tentativa proativa por contato/dia, intervalo de 24 horas e aprovação humana ativada durante a fase de teste.

## Secrets e integrações

| Variável | Uso |
| --- | --- |
| `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` | WhatsApp por Z-API |
| `RESEND_API_KEY`, `OUTREACH_EMAIL_FROM` | fallback por e-mail |
| `OUTREACH_CRON_SECRET` | autentica o agendador da fila |
| `LEAD_CAPTURE_WEBHOOK_SECRET` | autentica integrações de captação servidor-a-servidor |
| `TURNSTILE_SECRET_KEY` | valida formulário público com Cloudflare Turnstile |
| `CAPTURE_FORM_ALLOWED_ORIGINS` | lista separada por vírgula de domínios autorizados para formulário público |
| `ANTHROPIC_API_KEY` | geração de mensagens pela Ana; sem ela há fallback determinístico |

Google Calendar e Outlook não exigem credenciais para a primeira fase: cada reunião gera um convite `.ics` que pode ser importado em ambos. Uma integração OAuth só deve ser ativada quando houver credenciais e política de armazenamento de tokens aprovada.

## Captação nativa e webhooks

`POST /api/public/lead-capture` recebe JSON e protege os dois modos abaixo:

- **Webhook de parceiro:** envie o corpo JSON e o header `x-lead-capture-signature` com HMAC SHA-256 hexadecimal do corpo usando `LEAD_CAPTURE_WEBHOOK_SECRET`.
- **Formulário público:** envie `source: "public_form"`, `turnstile_token` e `honeypot`; a origem precisa estar em `CAPTURE_FORM_ALLOWED_ORIGINS` (ou ser o próprio domínio da aplicação).

Campos aceitos: `company`, `name`, `title`, `email`, `phone`, `whatsapp`, `cnpj`, `website`, `segment`, `city`, `uf`, `message`, `external_id`, `campaign_id`, campos `utm_*` e `landing_page`.

O endpoint faz deduplicação por CNPJ, domínio, e-mail e telefone/WhatsApp. Uma nova conversão é vinculada ao lead existente, preservando o evento de origem, em vez de criar duplicata.

## Operação diária

- Execute `POST /api/public/outreach-tick` a cada cinco minutos com `Authorization: Bearer <OUTREACH_CRON_SECRET>`.
- Acompanhe **Configurações → Operação comercial → Alertas da operação**. Jobs falhos fazem retentativas com espera progressiva; falhas definitivas viram alerta crítico.
- Mantenha documentos, serviços e respostas aprovadas atualizados em **Minha Empresa** e **Governança IA**. A busca por relevância usa apenas trechos ativos desses documentos.
- Use **Relatórios** para comparar fontes, campanhas, conversão entre etapas, qualidade de contatos, opt-outs e razões de perda.

## Privacidade e qualidade

- Não coloque números, e-mails ou dados pessoais em prompts livres, logs externos ou planilhas sem base legal.
- Registre pedidos de acesso, correção, exclusão, anonimização, portabilidade e oposição em **Configurações → Operação comercial**.
- Opt-out bloqueia canais de contato e é preservado no histórico. A reativação é uma ação consciente, auditada e visível ao administrador.
- A busca de duplicidade respeita a permissão do usuário; não expõe leads de outro vendedor.
