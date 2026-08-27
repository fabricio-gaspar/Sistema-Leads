# PROMPT DE RECONSTRUÇÃO — BACKEND (Edge Functions + Secrets)

> Copie/cole todo o conteúdo deste arquivo em outro agente de IA para reconstruir a
> camada de backend do sistema **Wayflex CRM** (SaaS de prospecção B2B com IA).
> A plataforma-alvo é o Readdy Backend (stack compatível com Supabase: cliente
> `@supabase/supabase-js`, Edge Functions em Deno/TypeScript, Secrets gerenciados).

---

## TAREFA

Recrie as Edge Functions (backend serverless) de um SaaS de prospecção comercial B2B
chamado **Wayflex CRM**, cuja assistente virtual se chama **Ana**. O sistema automatiza
prospecção de leads, atendimento via WhatsApp/e-mail com IA, geração de orçamentos e
acompanhamento comercial para a empresa **Wayflex — Artefatos de Borracha, Silicone e PU**
(certificada ISO 9001:2015, +6 anos de mercado, Sorocaba/SP, fone (11) 93288-4074,
e-mail contato@wayflex.ind.br).

Implemente exatamente as 5 funções descritas abaixo. Use TypeScript/Deno, importe
`serve` de `https://deno.land/std@0.177.0/http/server.ts` (ou `0.168.0`), e aplique
headers CORS `*` em todas. Todas respondem JSON e aceitam `OPTIONS`.

---

## FUNÇÃO 1 — `ana-ia`

**Propósito:** cérebro da assistente "Ana". Chama a API da Anthropic (Claude) para
analisar mensagens de leads, redigir textos e autocompletar.

**Secrets usados (via `Deno.env.get`):**
- `ANTHROPIC_API_KEY` (obrigatória)
- `ANTHROPIC_MODEL` (opcional, default `claude-haiku-4-5-20251001`)

**Entrada (`POST` body JSON):**
```json
{ "acao": "analisar|redigir|autocompletar|responder", "mensagem": "...", "contexto": { ... }, "modelo": "..." }
```

**Ações:**

1. `analisar` — devolve APENAS JSON (sem texto extra) no formato:
```json
{
  "intencao": "INTERESSE|DUVIDA|OBJECAO|PRECO|ORCAMENTO|AGENDAMENTO|NEGATIVO|OPT_OUT|NEUTRO",
  "sentimento": "POSITIVO|NEUTRO|NEGATIVO",
  "scoreInteresse": 0,
  "confianca": 0,
  "proximaAcao": "RESPONDER|QUALIFICAR|CRIAR_ORCAMENTO|AGENDAR|TRANSFERIR_HUMANO|FOLLOW_UP|ENCERRAR",
  "etapaSugerida": "texto ou null",
  "motivoTransferencia": "texto ou null"
}
```
`scoreInteresse` e `confianca` são números 0–100. O código extrai o JSON do texto do
Claude (remove crases/```json```, localiza primeiro `{` e último `}`) e valida.

2. `redigir` — gera mensagem curta de proposta/orçamento (2–3 frases) ou follow-up
(1–2 frases), usando `contexto.tipo` (proposta|seguimento), `contexto.nome`,
`contexto.empresa`, `contexto.numero`, `contexto.valor`.

3. `autocompletar` — completa texto em andamento (`contexto.trecho`) conforme
`contexto.tipo` (produto|proposta|mensagem), em pt-BR, sem markdown.

4. `responder` (padrão) — responde à mensagem do lead como a Ana, usando a base de
conhecimento (`contexto.conhecimento`, array de `{titulo, conteudo}`) e os dados
`contexto.nome`/`contexto.empresa`.

**PERSONA (system prompt da Ana — use este texto exato):**
```
Você é a Ana, assistente virtual comercial da Wayflex — empresa especializada em artefatos de borracha, silicone e poliuretano.
A Wayflex fabrica e fornece perfis de borracha, juntas de dilatação, gaxetas, vedações, peças técnicas em poliuretano (PU), silicone atóxico e de alta temperatura, mangueiras industriais, lençóis, placas e acessórios de manutenção.
Todos os produtos são desenvolvidos sob medida conforme desenho, amostra ou especificação técnica do cliente.
A empresa é certificada ISO 9001:2015, atua no mercado há mais de 6 anos e atende indústrias de construção civil, automotivo, alimentício, farmacêutico, mineração, siderurgia e manutenção industrial.
Você é simpática, profissional, objetiva e tecnicamente precisa.
Responda SEMPRE em português do Brasil, de forma natural e humanizada, como uma conversa por WhatsApp.
Use frases curtas e acolhedoras, sem markdown e sem emojis excessivos.
NÃO invente materiais, preços, prazos ou promessas que não estejam na base de conhecimento fornecida.
Quando não souber algo, pergunte de forma educada para entender melhor a aplicação e necessidade técnica do lead.
Dados de contato da Wayflex: telefone (11) 93288-4074, e-mail contato@wayflex.ind.br, endereço R. Luiz Fornaziero, 134 - Sorocaba/SP.
```

**Saída:** `{ ok: true, analise }` (analisar), `{ ok: true, texto }` (redigir/autocompletar/responder),
ou `{ ok: false, erro }` em falha.

---

## FUNÇÃO 2 — `enviar-email`

**Propósito:** enviar e-mail transacional via Resend.

**Secrets:** `RESEND_API_KEY` e `RESEND_FROM_DOMAIN` (obrigatórios).

**Entrada:** `{ para, texto, assunto, modo }`.

**Lógica:** se faltar chave/domínio, retorna `400` com `{ enviado:false, erro:"email_nao_configurado" }`.
Monta `from = noreply@${dominio}` e chama `POST https://api.resend.com/emails` com
`Authorization: Bearer ${key}`, body `{ from, to:[para], subject, text }`.
Retorna `{ enviado:true, id, modo }` em sucesso.

---

## FUNÇÃO 3 — `enviar-whatsapp`

**Propósito:** enviar mensagem de WhatsApp por dois provedores: **Z-API** (default) ou
**Meta WhatsApp Cloud API**.

**Entrada:** `{ para, texto, modo, provedor }` (provedor default `"zapi"`; `modo:"SANDBOX"` liga sandbox).

**Z-API** — Secrets (prefixo `WHATSAPP_ZAPI_` ou `WHATSAPP_ZAPI_SANDBOX_` para sandbox):
`INSTANCE_ID`, `TOKEN`, `CLIENT_TOKEN` (opcional).
Endpoint `POST https://api.z-api.io/instances/{instanceId}/token/{token}/send-text`,
header `Client-Token` quando houver, body `{ phone: soDigitos(para), message: texto }`.
`soDigitos` remove tudo que não for dígito (ex.: `+55 (11) 99999-9999` → `5511999999999`).

**Meta** — Secrets: `WHATSAPP_TOKEN`/`WHATSAPP_PHONE_ID` (ou `WHATSAPP_SANDBOX_*` para sandbox).
Endpoint `POST https://graph.facebook.com/v20.0/{phoneNumberId}/messages`,
header `Authorization: Bearer {token}`, body
`{ messaging_product:"whatsapp", to:para, type:"text", text:{body:texto} }`.

**Saída:** `{ enviado:true, id, provedor, modo }` ou `{ enviado:false, erro, detalhe }`.

---

## FUNÇÃO 4 — `gerar-prompt-busca`

**Propósito:** gerar um prompt de prospecção de leads B2B otimizado a partir de
critérios soltos.

**Entrada:** `{ provider, campos, criterios }` (`provider` = `anthropic`|`openai`).

**Lógica:** monta um system ("especialista em engenharia de prompts para prospecção de
leads B2B") e um user com os critérios + campos. Retorna APENAS o texto do prompt
(imperativo, objetivo, com deduplicação e priorização de contatos válidos).
- `anthropic` → Secrets `ANTHROPIC_API_KEY`, model `claude-3-5-sonnet-latest`.
- `openai` → Secrets `OPENAI_API_KEY`, model `gpt-4o-mini`.

**Saída:** `{ prompt: texto }` ou `{ error, message }`.

---

## FUNÇÃO 5 — `webhook-whatsapp`

**Propósito:** receber mensagens dos leads (webhook do Z-API), acionar a `ana-ia` para
responder com a base de conhecimento e persistir conversa + atualizar o lead.

**Secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ZAPI_INSTANCE_ID`,
`WHATSAPP_ZAPI_TOKEN`, `WHATSAPP_ZAPI_CLIENT_TOKEN` (opcional).

**Fluxo (implemente nesta ordem):**
1. Ignora payloads `fromMe === true`, `isGroup === true`, `type !== "ReceivedCallback"`,
   sem texto (`text.message` / `image.caption` / `video.caption`) e sem `phone`.
2. Normaliza `phone` com `soDigitos` (remove `\D`).
3. Cria client `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`.
4. Busca leads na tabela `leads` (campo `dados`, jsonb array) e encontra o lead cujo
   `whatsapp`/`telefone` (normalizado) bate com o remetente (compara também sem o DDI `55`).
5. Ignora leads `bloqueado === true`, `modoAtendimento === "HUMANO"`,
   `automacaoStatus === "AGUARDANDO_HUMANO"` ou `"CONCLUIDA"`.
6. Carrega a base de conhecimento (`conhecimento`, campo `dados`, filtra `status === "ativo"`).
7. Invoca `ana-ia` (`acao:"responder"`) e `ana-ia` (`acao:"analisar"`) via
   `supabase.functions.invoke(...)`.
8. Grava a mensagem recebida (e a resposta da Ana, se houver) na tabela `crm_conversas`
   (ou `conversas`), campo `dados.mensagens`, com `ultima_mensagem` e `updated_at`.
9. Atualiza o lead na tabela `leads`: aplica intenção/sentimento/confiança/proximaAcao,
   recalcula `score` (delta = `(scoreInteresse - 50) / 2`, clamp 0–100), atualiza `etapa`
   e `motivoTransferencia`, e insere evento no `historico` (tipo `RESPOSTA_LEAD`).
10. Se a Ana gerou resposta, envia via Z-API (`send-text` para o `telefoneRemetente`).

**Saída:** `{ ok:true, leadId, respondeu:boolean }`.

---

## SECRETS NECESSÁRIOS (resumo)

| Nome | Função | Obrigatório |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude (ana-ia, gerar-prompt-busca) | sim |
| `ANTHROPIC_MODEL` | modelo do Claude | não |
| `OPENAI_API_KEY` | ChatGPT (gerar-prompt-busca) | não |
| `RESEND_API_KEY` / `RESEND_FROM_DOMAIN` | e-mail | sim (para e-mail) |
| `WHATSAPP_ZAPI_INSTANCE_ID` / `_TOKEN` / `_CLIENT_TOKEN` | saída WhatsApp (Z-API) | sim (para WhatsApp) |
| `WHATSAPP_ZAPI_SANDBOX_*` | sandbox Z-API | não |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` | saída WhatsApp (Meta) | não |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | acesso ao banco (webhook) | sim (webhook) |

> ⚠️ Nenhuma chave pode ser hardcoded no frontend; use apenas Secrets do Backend via
> `Deno.env.get(...)` dentro das Edge Functions.

---

## CONVENÇÕES DE RESPOSTA

- Todas as funções retornam `Content-Type: application/json`.
- Erros retornam `{ ok:false, erro, detalhe? }` com status 4xx/5xx coerentes.
- Sucesso retorna `{ ok:true, ...payload }`.