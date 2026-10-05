# PROMPT DE RECONSTRUÇÃO — BANCO DE DADOS (PostgreSQL)

> Copie/cole todo o conteúdo deste arquivo em outro agente de IA (ou use o SQL gerado)
> para recriar o schema e o conteúdo do banco do sistema **Wayflex CRM** no
> Readdy Backend (PostgreSQL compatível com Supabase).

---

## TAREFA

Recrie o banco de dados do **Wayflex CRM**. As tabelas seguem o padrão **documento/blob**:
cada tabela guarda **uma linha por usuário**, com três colunas e o dataset inteiro
serializado em JSON no campo `dados`.

---

## PADRÃO DE SCHEMA (para todas as tabelas de negócio)

```sql
CREATE TABLE IF NOT EXISTS public.<nome> (
  user_id    uuid NOT NULL,
  dados      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id)
);

ALTER TABLE public.<nome> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<nome>_proprio"
  ON public.<nome> FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

> `user_id` referencia `auth.users.id`. RLS: cada usuário só lê/grava a própria linha.
> `dados` contém o array/objeto completo do módulo (ex.: `leads.dados` é um array de leads).

---

## TABELAS DE NEGÓCIO (todas `user_id uuid PK` + `dados jsonb` + `updated_at timestamptz`)

| Tabela | Conteúdo de `dados` |
|---|---|
| `empresa_config` | identidade: nome, cnpj, segmento, endereço, telefone, whatsapp, email, site, redes, logo, assinatura (variáveis globais `{empresa.*}`) |
| `equipe` | usuários/membros do time (Admin, Comercial, Vendedor, Prospecção, Atendimento) |
| `variaveis_globais` | variáveis personalizadas `{link_proposta}`, `{link_agendamento}` etc. |
| `documentos` | documentos (contratos, NDA, etc.) |
| `temas` | temas visuais (cores, logo, assinatura, padrao) |
| `conhecimento` | base de conhecimento da Ana: array de `{id, titulo, categoria, conteudo, palavrasChave, status}` (FAQ, objeções, cases, políticas, produtos) |
| `catalogo_produtos` | catálogo: array de `{id, nome, descricao, categoria, preco, unidade}` (10 produtos industriais Wayflex) |
| `templates` | templates de mensagem (WhatsApp/E-mail) com variáveis `{nome}`, `{empresa}` |
| `respostas_rapidas` | respostas curtas com atalho `/` |
| `biblioteca_prompts` | prompts editáveis do Agente de Prompt |
| `fluxos_automatizacao` | fluxos prontos (gatilho + passos) |
| `templates_proposta` | modelos de orçamento (blocos, validade, termos) |
| `templates_documento` | modelos de documentos |
| `integracoes` | config de integrações externas |
| `fontes` | fontes de dados / pesquisa assistida |
| `configuracao_runtime` | modo de execução (`DEMO`/`SANDBOX`/`PRODUCAO`), estágios dos módulos |
| `pipeline` | configuração das etapas do pipeline |
| `leads` | array de leads (ver campos no PROMPT_FRONTEND) |
| `listas_leads` | listas nomeadas de curadoria |
| `propostas` | array de propostas/orçamentos |
| `vendas` | array de vendas |
| `compromissos` | array de compromissos/reuniões |
| `conversas` | conversas (mensagens) |
| `notificacoes` | notificações |
| `tarefas` | tarefas |
| `auditoria` | eventos de auditoria |
| `envio_logs` | log de envios (e-mail/WhatsApp) |
| `supressao` | opt-outs/supressão |
| `campanhas` | contas sociais + posts |
| `midia_drive` | drive de mídia |

**Tabelas legadas/órfãs (NÃO usar, podem ser ignoradas):**
`crm_leads`, `crm_propostas`, `crm_vendas`, `crm_conversas`, `crm_compromissos`.

---

## TABELAS PRONTAS DO PRODUTO (já existem, com RLS próprio)

### Comércio (produtos)

- `product_categories`: `id`, `name`, `sort_order`, timestamps.
- `product_items`: `id`, `name`, `category_id`, `status` (active/inactive/draft),
  `description`, `pricing_mode` (0 = preço único, 1 = por variante), `currency`,
  `price`, `stock`, `discount_enabled`, `discount_price`, `media jsonb`, timestamps.
- `product_variants`: `id`, `product_id`, `name`, `options jsonb`, `sort_order`.
- `product_skus`: `id`, `product_id`, `label`, `options jsonb`, `price`, `stock`,
  `discount_enabled`, `discount_price`.
- `product_custom_fields`: `id`, `name`, `field_type`, `options jsonb`, `required`, `sort_order`.
- `product_custom_values`: `id`, `product_id`, `field_id`, `value` (UNIQUE product_id+field_id).

RLS: anon key = SELECT apenas; INSERT/UPDATE/DELETE exigem service key.

### Pedidos

- `order_headers`: `id`, `customer_id`, `status` (pending_payment/paid/processing/shipped/
  delivered/cancelled/refunded), `customer_notes`, `admin_notes`, `tracking_number`,
  `currency`, `shipping_total`, `tax_total`, `subtotal_items`, `discount_price`,
  `payment_provider`, `checkout_session_id`, `payment_id`, `recipient jsonb`, timestamps.
- `order_items`: `id`, `order_id`, `product_id`, `product_name`, `sku_id`, `sku_label`,
  `quantity`, `unit_price`, `final_price`, `subtotal`.

RLS: anon key = SELECT/INSERT/UPDATE; DELETE não permitido.

---

## CONTEÚDO SEMENTE (Wayflex, já migrado — substitua "WF Digital" por nada disso)

- **Identidade:** "Wayflex — Artefatos de Borracha, Silicone e PU", `wayflex.ind.br`,
  (11) 93288-4074, contato@wayflex.ind.br, R. Luiz Fornaziero, 134 — Sorocaba/SP.
- **Conhecimento (18 itens):** materiais (EPDM, SBR, borracha natural, silicone,
  neoprene, nitrílica, PU, Viton), prazos, ISO 9001:2015, como pedir orçamento,
  peças sob medida, objeções ("já tenho fornecedor", "está caro"), cases (construção
  civil, automotivo, alimentício), LGPD, garantia.
- **Catálogo (10 produtos):** perfis de borracha, juntas de dilatação, gaxetas, vedações,
  peças em PU, silicone, mangueiras industriais, mantas/lençóis, placas, acessórios.
- **Leads de demo:** empresas fictícias B2B (ex.: "Lavanderia São Roque Ltda",
  "Souza Marketing", etc.) com histórico e scores variados.

---

## SEGURANÇA / REGRAS

- **RLS obrigatória** em toda tabela de negócio (`auth.uid() = user_id`).
- Service role key ignora RLS (usada apenas nas Edge Functions).
- **Nenhuma chave/segredo em texto puro** no banco — segredos ficam em Secrets do Backend.
- Não usar `DROP`/`TRUNCATE`; migrações são idempotentes (`CREATE TABLE IF NOT EXISTS`,
  `INSERT ... ON CONFLICT DO NOTHING`).

---

## RESTAURAÇÃO

O dump SQL completo está em `docs/backup_wayflex_2026-08-26.sql`. Para recriar do zero,
execute primeiro o schema (DDL acima), depois os INSERTs de semente, e por fim os dados
transacionais. A ordem não importa entre tabelas, pois não há FK entre as tabelas de negócio.