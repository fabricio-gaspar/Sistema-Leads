# PROMPT DE RECONSTRUÇÃO — FRONTEND (SPA React)

> Copie/cole todo o conteúdo deste arquivo em outro agente de IA para reconstruir a
> camada de frontend do sistema **Wayflex CRM**.

---

## TAREFA

Recrie o frontend de um SaaS de prospecção comercial B2B chamado **Wayflex CRM** —
assistente virtual **Ana**, para a empresa **Wayflex — Artefatos de Borracha, Silicone e PU**
(ISO 9001:2015, +6 anos, Sorocaba/SP, fone (11) 93288-4074, contato@wayflex.ind.br).

---

## STACK (obrigatório, não alterar)

- **Vite + React 19 + TypeScript + TailwindCSS** (SPA, desktop-first).
- Roteamento com `react-router-dom` (`BrowserRouter` com `basename={__BASE_PATH__}`).
- Ícones: **Remix Icon** e **FontAwesome** via CDN no `index.html` (nunca via npm).
- Cliente backend: `@supabase/supabase-js` (singleton, importar de módulo único
  `src/lib/supabase.ts`).
- Alias `@/` = `src/`. **Imports cross-dir SEMPRE com `@/` (nunca `../`).**
- Estado/negócio: **stores** via hooks customizados + `createBackendStore` (persistência
  no backend + cache local offline). `localStorage` só para preferências de UI.

---

## ESTRUTURA DE PASTAS

```
src/
  components/feature/   # componentes reutilizáveis (DashboardLayout, Modais, etc.)
  components/base/      # componentes básicos (botões, inputs, cards)
  hooks/                # stores e hooks (useLeadsStore, useConhecimentoStore, etc.)
  lib/                  # lógica de negócio (analise, automacao, transportador, tipos, selectors, supabase)
  mocks/                # dados de exemplo/semente (Wayflex)
  pages/                # uma pasta por página, cada uma com page.tsx + components/
  router/config.tsx     # rotas
  i18n/                 # internacionalização
  App.tsx / main.tsx / index.css
supabase/functions/     # Edge Functions (ver PROMPT_BACKEND.md)
```

---

## ROTAS

**Públicas:**
- `/` — Landing page do SaaS
- `/login`, `/register`, `/reset-password`

**Autenticadas (dentro de `/dashboard`, layout com sidebar `DashboardLayout`):**
- `/dashboard` (index) — painel de métricas/KPIs
- `/dashboard/empresa` — dados da organização + base de conhecimento + time + voz da Ana
- `/dashboard/busca-leads` — configuração de busca de leads + importação CSV
- `/dashboard/atendimento` — chat de atendimento da Ana + histórico de conversas
- `/dashboard/leads` — lista/curadoria de leads
- `/dashboard/kanban` — pipeline Kanban (drag & drop)
- `/dashboard/funil` — funil de conversão
- `/dashboard/equipe` — equipe/vendas
- `/dashboard/midia-drive` — drive de mídia
- `/dashboard/relatorios` — relatórios por período
- `/dashboard/agenda` — agenda/compromissos (reuniões da Ana)
- `/dashboard/orcamentos` — orçamentos/propostas
- `/dashboard/campanhas/calendario`, `/campanhas/publicacao`, `/campanhas/contas` — social
- `/dashboard/configuracoes` — configurações gerais (abas: Abordagem, Ana, Ambiente,
  Apresentação, Automações, Biblioteca de Prompts, Canais, Comercial, Fluxos, Fontes,
  Horários, Integrações, Logs, Pipeline, Produtos, Respostas Rápidas, Temas,
  Templates, Templates de Documento, Templates de Proposta, Variáveis Globais)

---

## MODELO DE DADOS DO NEGÓCIO (types em `src/lib/tipos.ts`)

- **Lead**: `{ id, nome, empresa, email, telefone, whatsapp, segmento, status, etapa,
  score, intencao, sentimento, confianca, proximaAcao, modoAtendimento ("IA"|"HUMANO"),
  automacaoStatus, bloqueado, aguardandoAtivacao, listaId, historico, motivoTransferencia }`
- **Proposta/Venda/Compromisso/Conversa/Notificação/Tarefa/Auditoria** — entidades
  correlatas com ids string e referências por string (sem FK de banco).
- **Pipeline** (etapas): Novo → Em Contato → Aguardando Resposta → Em Qualificação →
  Reunião Agendada → Proposta em Preparação → Orçamento Enviado → Negociação →
  Fechado — Ganho / Fechado — Perdido / Pausado.
- **Conhecimento**: `{ id, titulo, categoria, conteudo, palavrasChave, status }`
  (FAQ, objeções, cases, políticas, produtos — conteúdo industrial Wayflex).
- **Catálogo**: `{ id, nome, descricao, categoria, preco, unidade }` (10 produtos:
  perfis de borracha, juntas de dilatação, gaxetas, vedações, PU, silicone, mangueiras,
  mantas/lençóis, placas, acessórios).
- **Empresa (config)**: variáveis globais `{empresa.nome}`, `{empresa.assinatura}`,
  `{empresa.cnpj}`, `{empresa.telefone}`, `{empresa.whatsapp}`, `{empresa.site}`,
  `{empresa.email}` etc., espalhadas por templates/propostas/e-mails.

---

## MOTOR DE NEGÓCIO (implemente em `src/lib/`)

- **`analise.ts`** — qualificação determinística de mensagens (fallback quando não há LLM).
- **`automacao.ts`** — transições de Kanban (`transicoesPermitidas`), `podeEnviarMensagem`
  (respeita horário comercial, consentimento, bloqueio, cap diário), cadência de follow-ups.
- **`transportador.ts`** — ponto único de saída: decide envio simulado vs real e chama
  Edge Functions `enviar-email`/`enviar-whatsapp`.
- **`selectors.ts`** — selectors para métricas do dashboard/funil/relatórios.
- **`supabase.ts`** — cliente backend singleton.
- **`store.ts`** — implementa `createBackendStore` (documento/blob: 1 linha por usuário).

**Fluxo comercial de ponta a ponta (`useFluxoComercial.ts`):**
captura → deduplicação → distribuição IA/Humano → primeiro contato → qualificação →
handoff humano → follow-up/timeout (24h/48h) → reunião (oferece slots, confirma,
no-show + remarcação) → orçamento (gera proposta do catálogo) → negociação
(desconto com limite/aprovação) → fechamento (ganho/perdido). Motor roda em tick de 60s
no `DashboardLayout` (idempotente via `automationEvents`).

---

## REGRAS DE UI / DESIGN

- **Minimalismo**, cantos `rounded-lg` (cards) / `rounded-md` (botões) / `rounded-full` (pills).
- **Sem sombras** (look limpo), sem cores azul/roxo.
- **StyleSystem** com 5 papéis (escala OKLCH): `background`, `primary`, `accent`,
  `secondary`, `foreground` — usar classes como `bg-background-50`, `bg-primary-500`,
  `bg-accent-500`, `text-foreground-950`, etc. (tokens em `tailwind.config.ts`).
- Desktop-first, mínimo 1024px; responsivo com breakpoints (`lg:flex-row`, `grid-cols-1
  sm:grid-cols-2 lg:grid-cols-N`). Navbar desktop `hidden md:flex` + hambúrguer mobile.
- Botões com `whitespace-nowrap`; todo clicável com cursor pointer; ícones com
  `w-* h-* flex items-center justify-center` no pai.
- Tipografia refinada (14–16px), Google Fonts via `@import` no topo do `index.css`.
- Animações sutis como acabamento final.
- Formulários (contato/newsletter) via `get_form_url`; agendamento via painel de Booking
  (não criar calendário fake).

---

## IDENTIDADE / CONTEÚDO (Wayflex, já migrado)

Todo texto institucional deve referenciar a **Wayflex** (não "WF Digital"): artefatos de
borracha, silicone e poliuretano; materiais EPDM, SBR, borracha natural, silicone,
neoprene, nitrílica, PU e Viton; aplicações em construção civil, automotivo, alimentício,
farmacêutico, mineração e siderurgia; desenvolvimento sob medida conforme desenho/amostra;
ISO 9001:2015; Sorocaba/SP; fone (11) 93288-4074; contato@wayflex.ind.br.

---

## VERIFICAÇÃO FINAL

Compile sem erros. Garanta: import paths via `@/`; todo `page.tsx`/componente com um único
`export default`; JSX com raiz única; sem `React.`/`window.React` (usar named imports);
`@import` antes dos `@tailwind` no `index.css`.