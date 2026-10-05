# LeadAI - Sistema SaaS de Prospecção Automática com IA

## 1. Descrição do Projeto
Plataforma SaaS que permite empresas automatizarem todo o funil de prospecção de clientes utilizando Inteligência Artificial. O sistema cobre desde o cadastro da empresa, configuração de regras de busca de leads, abordagem multicanal automatizada, atendimento inteligente com chatbot IA, geração de orçamentos, conversão de vendas até pagamentos integrados, com dashboard completo de métricas.

**Público-alvo**: Empresas B2B que desejam escalar sua prospecção de clientes de forma automatizada.

**Valor principal**: Reduzir o custo de aquisição de clientes e aumentar a eficiência do time comercial através de automação inteligente.

## 2. Estrutura de Páginas

### Área Pública
- `/` - Landing Page / Home do SaaS
- `/login` - Login
- `/register` - Cadastro de nova empresa (Etapa 1)

### Área Autenticada (Dashboard)
- `/dashboard` - Painel Administrativo (Dashboard de métricas)
- `/dashboard/configuracao` - Configuração do Negócio (Etapa 2)
- `/dashboard/busca-leads` - Configuração de Busca de Leads (Etapa 3)
- `/dashboard/abordagem` - Configuração da Abordagem (Etapa 4)
- `/dashboard/apresentacao` - Apresentação da Empresa gerada por IA (Etapa 5)
- `/dashboard/atendimento` - Configuração do Agente de IA e Histórico de Conversas (Etapa 6)
- `/dashboard/leads` - Lista de Leads encontrados e status
- `/dashboard/orcamentos` - Orçamentos gerados e status
- `/dashboard/vendas` - Vendas realizadas e faturamento
- `/dashboard/configuracoes` - Configurações gerais da conta

## 3. Funcionalidades Principais

### Módulo 1: Cadastro e Onboarding
- [ ] Cadastro da empresa com dados completos
- [ ] Upload de logo
- [ ] Validação de CNPJ
- [ ] Configuração guiada do negócio (wizard de 4 etapas)

### Módulo 2: Automação de Prospecção
- [ ] Configuração de região e segmentos para busca
- [ ] Busca automática de leads via APIs públicas
- [ ] Filtros por porte de empresa, segmento, localização
- [ ] Limite diário de leads configurável

### Módulo 3: Abordagem Multicanal
- [ ] Templates de mensagens para WhatsApp
- [ ] Templates de e-mail
- [ ] Configuração de canais preferenciais
- [ ] Abordagem sequencial multicanal

### Módulo 4: IA e Atendimento
- [ ] Geração automática de apresentação institucional
- [ ] Agente de IA para conversação com leads
- [ ] Qualificação automática de oportunidades
- [ ] Histórico de conversas por lead
- [ ] Integração com CRM

### Módulo 5: Orçamentos e Propostas
- [ ] Geração automática de orçamento
- [ ] Criação de proposta comercial em PDF
- [ ] Envio por e-mail e WhatsApp
- [ ] Registro de status da proposta

### Módulo 6: Conversão e Pagamentos
- [ ] Opção de falar com vendedor humano
- [ ] Finalização de compra direta
- [ ] Integração com gateways de pagamento
- [ ] Comprovante automático

### Módulo 7: Dashboard e Relatórios
- [ ] Métricas de leads (encontrados, abordados, convertidos)
- [ ] Taxa de resposta e fechamento
- [ ] Faturamento total
- [ ] Relatórios por período
- [ ] Exportação de dados

## 4. Modelo de Dados

### Tabela: companies
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | Chave primária |
| user_id | uuid | FK para auth.users |
| name | text | Nome da empresa |
| cnpj | text | CNPJ |
| segment | text | Segmento de atuação |
| address | text | Endereço |
| phone | text | Telefone |
| whatsapp | text | WhatsApp |
| email | text | E-mail |
| website | text | Site |
| social_media | jsonb | Redes sociais |
| logo_url | text | URL da logo |
| created_at | timestamptz | Data de criação |
| updated_at | timestamptz | Data de atualização |

### Tabela: business_config
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | Chave primária |
| company_id | uuid | FK para companies |
| activity_branch | text | Ramo de atividade |
| products_services | jsonb | Produtos e serviços |
| competitive_advantages | jsonb | Diferenciais competitivos |
| service_region | text | Região de atendimento |
| target_audience | text | Público-alvo |
| price_range | text | Faixa de preço |

### Tabela: lead_search_config
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | Chave primária |
| company_id | uuid | FK para companies |
| city | text | Cidade |
| state | text | Estado |
| country | text | País |
| radius_km | int | Raio de atuação em km |
| segments | jsonb | Segmentos desejados |
| company_sizes | jsonb | Porte das empresas |
| leads_per_day | int | Quantidade de leads/dia |

### Tabela: approach_config
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | Chave primária |
| company_id | uuid | FK para companies |
| channels | jsonb | Canais selecionados |
| whatsapp_template | text | Template WhatsApp |
| email_template | text | Template E-mail |
| phone_script | text | Script telefone |

### Tabela: leads
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | Chave primária |
| company_id | uuid | FK para companies |
| name | text | Nome do lead |
| company_name | text | Empresa do lead |
| email | text | E-mail |
| phone | text | Telefone |
| whatsapp | text | WhatsApp |
| segment | text | Segmento |
| status | text | Status (novo, abordado, qualificado, convertido, perdido) |
| source | text | Origem do lead |
| conversation_history | jsonb | Histórico de conversas |
| crm_id | text | ID no CRM externo |
| created_at | timestamptz | Data de criação |
| updated_at | timestamptz | Data de atualização |

### Tabela: proposals
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | Chave primária |
| company_id | uuid | FK para companies |
| lead_id | uuid | FK para leads |
| amount | decimal | Valor da proposta |
| description | text | Descrição |
| pdf_url | text | URL do PDF |
| status | text | Status (enviada, visualizada, aceita, recusada) |
| sent_via | text | Canal de envio |
| created_at | timestamptz | Data de criação |
| updated_at | timestamptz | Data de atualização |

### Tabela: sales
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | Chave primária |
| company_id | uuid | FK para companies |
| lead_id | uuid | FK para leads |
| proposal_id | uuid | FK para proposals |
| amount | decimal | Valor da venda |
| payment_method | text | Método de pagamento |
| payment_status | text | Status do pagamento |
| receipt_url | text | URL do comprovante |
| created_at | timestamptz | Data de criação |

### Tabela: company_presentation
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | Chave primária |
| company_id | uuid | FK para companies |
| institutional_text | text | Apresentação institucional |
| services_summary | text | Resumo dos serviços |
| benefits | jsonb | Benefícios |
| advantages | jsonb | Diferenciais |
| success_cases | jsonb | Cases de sucesso |
| sales_arguments | jsonb | Argumentos de venda |
| generated_at | timestamptz | Data de geração |

## 5. Integrações Planejadas

- **Supabase**: Autenticação de usuários, banco de dados PostgreSQL, Edge Functions para APIs, Storage para logos e PDFs
- **OpenAI**: Geração de apresentação institucional, agente de IA para conversação, qualificação de leads
- **n8n**: Automações de workflow (busca de leads, disparo de mensagens, atualização de CRM)
- **Mercado Pago / Asaas / Stripe**: Gateways de pagamento
- **APIs Públicas**: Busca de dados de empresas para prospecção

## 6. Plano de Desenvolvimento por Fases

> **Status atual:** todas as telas do sistema (Fases 1 a 7) foram implementadas em versão MOCKADA,
> com dados de exemplo, autenticação por e-mail simulada e fluxos interativos. O backend (Supabase,
> OpenAI, integrações) ainda não foi conectado — a base de dados real será criada posteriormente.

### Fase 1: Estrutura Base + Cadastro da Empresa
- **Objetivo**: Criar a landing page do SaaS, sistema de autenticação (login/registro) e tela de cadastro completo da empresa
- **Entregáveis**: 
  - Landing page profissional do produto
  - Página de login
  - Página de registro com formulário completo de cadastro da empresa
  - Layout base do dashboard com sidebar
  - Navegação entre páginas

### Fase 2: Configuração do Negócio
- **Objetivo**: Wizard de configuração do negócio (etapas 2-4)
- **Entregáveis**:
  - Página de configuração do negócio
  - Página de configuração de busca de leads
  - Página de configuração de abordagem

### Fase 3: Apresentação IA + Atendimento Inteligente
- **Objetivo**: Geração de apresentação por IA e configuração do agente de atendimento
- **Entregáveis**:
  - Página de apresentação da empresa gerada por IA
  - Página de configuração do agente de IA
  - Interface de chat para histórico de conversas

### Fase 4: Gestão de Leads
- **Objetivo**: Listagem e gestão dos leads prospectados
- **Entregáveis**:
  - Tabela de leads com filtros e status
  - Detalhes do lead com histórico de interações
  - Atualização de status (CRM)

### Fase 5: Orçamentos e Propostas
- **Objetivo**: Geração e gestão de orçamentos
- **Entregáveis**:
  - Página de orçamentos
  - Geração de proposta
  - Envio e acompanhamento de status

### Fase 6: Vendas e Pagamentos
- **Objetivo**: Conversão de vendas e integração com pagamentos
- **Entregáveis**:
  - Página de vendas
  - Fluxo de pagamento
  - Comprovantes e status

### Fase 7: Dashboard e Relatórios
- **Objetivo**: Painel completo de métricas e relatórios
- **Entregáveis**:
  - Dashboard com gráficos e KPIs
  - Filtros por período
  - Exportação de relatórios

---

## 7. Estado Atual do Fluxo Comercial (nível produto/fluxo — concluído)

> **Atualizado em 2026-08-20.** O fluxo comercial foi conectado de ponta a ponta em nível de
> produto, regras de negócio e interface, usando os stores locais (localStorage). Nenhum backend,
> banco real, API externa, WhatsApp/e-mail real, LLM ou job foi conectado — seguem **fora de escopo**
> nesta fase, conforme planejado.

### 7.1 O que está funcional no fluxo (de ponta a ponta)

| Etapa | Comportamento implementado |
|---|---|
| **Captura / validação / deduplicação** | Busca de leads, importação CSV e lead manual com deduplicação por e-mail/WhatsApp/empresa e validação de dados. |
| **Distribuição IA × Humano** | Campo `modoAtendimento` obrigatório; Humano exige responsável; IA gera `PRIMEIRO_CONTATO_PENDENTE`, Humano gera tarefa + notificação. |
| **Primeiro contato** | `processarPrimeiroContato` valida kill switch, horário, consentimento, bloqueio e template; envia mensagem simulada no Chat e move o lead para "Em Contato". |
| **Qualificação (Ana)** | `analisarMensagemLead` determinístico calcula intenção, sentimento, score, confiança e próxima ação a cada resposta. |
| **Handoff** | `transferirParaHumano` cria tarefa + notificação + contexto; gatilhos automáticos (desconto, reunião, urgência, reclamação, baixa confiança, score ≥ 80). Ações Pausar/Retomar/Assumir/Devolver. |
| **Follow-up / timeout** | `processarAutomacoesPendentes` dispara follow-up (24h/48h) e timeout (48h → "Fechado — Perdido" com motivo). Idempotência via `automationEvents`. |
| **Orçamento / negociação** | Desconto acima do limite → "aguardando aprovação" + tarefa + notificação + envio bloqueado; nova versão preserva histórico; aceite gera venda e receita. |
| **Fechamento** | Aceite → "Fechado — Ganho" + venda; recusa → "Fechado — Perdido" com motivo obrigatório. |
| **Métricas vivas** | Dashboard, Funil e Relatórios consomem os stores vivos via `selectors.ts`; auditoria e logs deixaram de ser estáticos. |
| **Notificações / Tarefas** | Painel do cabeçalho lê `useNotificacoesStore` e `useTarefasStore` (abas Notificações/Tarefas) e exibe os itens criados pelo fluxo. |

### 7.2 Regras de transição do Kanban

Mapa `transicoesPermitidas` em `src/lib/automacao.ts` valida drag & drop; perda exige motivo; reativação exige motivo; etapa final cancela automações.

**Pipeline atualizado em 2026-08-22** — novas etapas mapeadas no funil (Kanban, Funil, Leads, config de Pipeline):

1. Novo → 2. Em Contato → 3. Aguardando Resposta → 4. Em Qualificação → 5. **Reunião Agendada** → 6. Proposta em Preparação → 7. **Orçamento Enviado** (antes "Proposta Enviado") → 8. Negociação → 9. Fechado — Ganho → 10. Fechado — Perdido → 11. Pausado.

- **Reunião Agendada**: inserida após "Em Qualificação" — representa a reunião que a Ana agenda ao qualificar o lead (intenção + poder de decisão).
- **Orçamento Enviado**: renomeação de "Proposta Enviado" (orçamento e proposta são a mesma coisa). A etapa "Proposta em Preparação" permanece.
- Transições novas: `Em Qualificação → Reunião Agendada` e `Reunião Agendada → Proposta em Preparação` (além de voltas para qualificação, pausa e perda).

### 7.3 Arquitetura (fontes únicas)

- **Tipos/enums**: `src/lib/tipos.ts`
- **Motor determinístico**: `src/lib/analise.ts` (qualificação) e `src/lib/automacao.ts` (transições + `podeEnviarMensagem` + cadência)
- **Orquestrador**: `src/hooks/useFluxoComercial.ts`
- **Stores vivos**: leads, propostas, vendas, supressão, config, tarefas, notificações, auditoria, conversas
- **Selectors**: `src/lib/selectors.ts`

### 7.4 Fases concluídas vs. pendentes

**Concluídas (nível produto/fluxo):**
- Fase 1–7 (telas mockadas/interativas) — já existentes.
- Fluxo comercial P0/P1/P2 (auditoria → correções): modo IA/Humano, primeiro contato, qualificação, handoff, follow-up/timeout, métricas vivas, regras de Kanban, contexto no Chat, desconto/aprovação/versão, controles locais (horário/consentimento/kill switch).

**Concluído (2026-08-22):**
- Banco real (Readdy Backend) conectado: as stores já persistem nas tabelas do
  Backend (leads, propostas, vendas, compromissos, conversas, empresa_config, etc.)
  via `createBackendStore`, com cache local como fallback offline.
- Autenticação real: cadastro persiste os dados completos da empresa (CNPJ, segmento,
  endereço, telefone, WhatsApp, site e redes sociais), recuperação de senha envia
  e-mail de verdade (`resetPasswordForEmail` + tela `/reset-password`), confirmação de
  e-mail tratada na interface, e campo "Seu nome" separado do nome da empresa.

**Pendente (fora de escopo — próxima etapa):**
- Integrações externas: Receita Federal, Google Places, Apify.

---

## 8. Fluxo de Curadoria: Busca → Listas → Leads → Kanban (concluído)

> **Atualizado em 2026-08-22.** Implementada a etapa de "curadoria humana" entre a
> descoberta e o disparo, alinhada ao desenho de produto do usuário.

### 8.1 Ciclo de vida do lead

```
EMPENHADO (Busca) → NA BASE (Leads, aguardando aprovação) → ATIVADO (Kanban, Ana dispara) → EM CONVERSA (Atendimento) → FECHADO
```

### 8.2 O que mudou

- **Busca de Leads**: ao concluir, cria uma **lista nomeada** (com nome definido pelo admin)
  e envia os leads para o menu **Leads** com `aguardandoAtivacao = true`. A Ana **não** dispara
  neste momento.
- **Menu Leads**: exibe as listas pendentes (cards) e um badge "Aguardando" nos leads.
  O admin seleciona lead a lead (ou envia a lista inteira) e clica em **"Enviar para o Kanban"**.
- **Orquestrador (`useFluxoComercial`)**: novo método `ativarParaKanban(ids)` limpa o flag de
  aprovação e dispara `processarPrimeiroContato` (IA) ou `criarTarefaHumano` (humano).
- **Stores**: novo `useListasStore` (listas nomeadas) + campos `listaId`/`aguardandoAtivacao` no
  tipo `Lead`.

### 8.3 Decisões de produto assumidas

1. **Aprovação** lead a lead, com "enviar lista inteira" (curation humana obrigatória antes do disparo).
2. **Cadência** completa automática (apresentação + follow-ups) após ativação.
3. **Cap diário** respeitado via `limiteDiarioTotal` da config + `podeEnviarMensagem`.

### 8.4 Automação de Reunião e Orçamento (concluído)

> **Atualizado em 2026-08-22.** A Ana passou a conduzir sozinha os dois momentos
> pós-qualificação que antes só mudavam por drag & drop no Kanban.

- **Reunião Agendada**: quando detecta intenção de agendamento (`intencao = AGENDAMENTO` +
  `proximaAcao = AGENDAR`), a Ana **oferece 2–3 horários livres** (`oferecerHorarios` + `gerarSlotsLivres`,
  evitando conflitos com compromissos existentes) e fica `aguardandoEscolhaHorario`. Quando o lead
  responde o número/ordinal ("1", "opção 2", "segunda"), `detectarEscolhaSlot` identifica o slot,
  `confirmarHorario` cria o compromisso no `useCompromissosStore` (origem `ana`), confirma a data/hora
  na conversa e move o lead para "Reunião Agendada".
- **No-show + remarcação automática**: `processarNoShows` (dentro de `processarAutomacoesPendentes`)
  detecta reuniões da Ana com data/hora no passado ainda `agendado`, marca `no_show`, incrementa o
  contador de no-shows do lead (a partir de 2 aplica a tag "Risco de no-show") e reoferece horários
  automaticamente (`oferecerHorarios(leadId, true)`).
- **Orçamento Enviado**: quando detecta pedido de orçamento (`intencao = ORCAMENTO` +
  `proximaAcao = CRIAR_ORCAMENTO`), a Ana gera uma proposta a partir do catálogo, envia e move
  o lead para "Orçamento Enviado" (evento `ORCAMENTO_AUTO` para idempotência).
- **Agenda** (menu já existente) agora consome o `useCompromissosStore` + a etapa
  "Reunião Agendada" dos leads, com datas dinâmicas (semana corrente), painel
  "Reuniões agendadas pela Ana", criação manual de compromissos funcional e status
  `no_show` exibido no detalhe do compromisso.

### 8.5 Lembretes, horários personalizados e curadoria no funil (concluído)

> **Atualizado em 2026-08-22.**

- **Lembretes automáticos da Ana**: `processarLembretesReuniao` (dentro de
  `processarAutomacoesPendentes`) envia lembretes **24h** e **1h** antes da reunião,
  via WhatsApp/e-mail (canal preferencial do lead), com idempotência via campo
  `lembretesEnviados` no `Compromisso`. Usa checagem leve de consentimento/bloqueio
  (não é barrado pelo horário comercial, por ser mensagem transacional).
- **Horários personalizados**: `gerarSlotsLivres` deixou de usar uma lista fixa de
  horários e agora gera os candidatos **dentro do horário comercial configurado**
  (`diasSemana` início/fim), pulando dias inativos e **feriados** (`feriados`), além
  de evitar conflitos com compromissos já agendados.
- **Curadoria no funil**: leads com `aguardandoAtivacao = true` (vindos da Busca/CSV)
  **não aparecem mais no Kanban nem no Funil de Conversão** — ficam restritos ao menu
  Leads até serem aprovados ("Enviar para o Kanban").

### 8.6 Modo de execução (Demo / Sandbox / Produção) e transporte (concluído)

> **Atualizado em 2026-08-22.** Arquitetura de "dois eixos" para tirar o sistema do
> demo de forma segura, além de horários clicáveis na conversa.

- **Modo de execução global** (`modoExecucao`): `DEMO` (tudo simulado), `SANDBOX`
  (APIs reais com credenciais de teste) ou `PRODUCAO` (efeitos reais). Persistido no
  `useConfiguracaoStore` e exposto num seletor na aba **Ambiente** (Configurações).
- **Estágio por módulo** (`estadosModulos`): cada braço (WhatsApp, E-mail, Agendamento,
  Pagamento, IA) tem estado `DESLIGADO`/`SANDBOX`/`ATIVO` + flag `temCredenciais`. Um
  módulo só dispara efeito real quando modo global ≠ DEMO **e** está ATIVO **e** tem credencial.
- **Transportador** (`src/lib/transportador.ts`): ponto único de saída. `resolverTransportador`
  decide se o envio é simulado ou real; `enviarViaApi` chama as Edge Functions
  `enviar-email`/`enviar-whatsapp`. O fluxo comercial (`enviarParaLead`) passou a rotear
  todos os envios da Ana por essa camada.
- **Registro de envios** (`useEnvioLogStore`): log de tudo que a Ana tentou enviar,
  com a tag do modo (`[DEMO]`/`[SANDBOX]`/`[PRODUCAO]`) e por que foi simulado/bloqueado.
- **Guard de sandbox** (`contatoPermitidoNoSandbox`): em SANDBOX, só contatos marcados
  como "de teste" (aba Ambiente) recebem envio — nenhum lead real é acionado.
- **Banner global**: no topo do dashboard, um aviso persistente indica o modo atual
  quando não é PRODUCAO.
- **Segurança**: o token do WhatsApp deixou de ser gravado no localStorage; as credenciais
  devem ficar como secrets do Readdy Backend (Edge Functions).
- **Horários clicáveis**: a Ana agora envia os slots como botões clicáveis dentro da
  conversa (campo `opcoesHorario` na `Mensagem`), em vez de pedir "responda 1, 2 ou 3".
  O clique confirma o horário diretamente (`confirmarHorario` exposto pelo fluxo).

**Concluído (2026-08-22) — Ativação e dados reais:**
- **Tela de Ativação** (Configurações → Ambiente) agora mostra, de forma clara, o
  status efetivo de cada módulo: um resumo de prontidão ("X de 5 módulos prontos"),
  os três requisitos visíveis (modo real + módulo ligado + credencial) e o estado
  "Pronto / Incompleto / Desligado" por braço.
- **Persistência no Backend**: as stores (leads, compromissos, conversas, propostas,
  vendas, etc.) já gravam nas tabelas reais do Readdy Backend via `createBackendStore`
  (a nota anterior sobre "localStorage mesmo no modo real" está desatualizada).

**Pendente (próxima etapa):** conectar credenciais reais (Resend/Meta/LLM) para que os
módulos disparem efeito real de fato, e ligar um LLM real no lugar do casador
determinístico. Os dados de demonstração (leads/propostas/vendas de exemplo) seguem
mantidos por opção do usuário, até decisão de remover.

---

## 9. Plano — Aceleração de Preenchimento (Templates, Respostas Rápidas, Prompts e Temas)

> **Atualizado em 2026-08-23.** Plano (não implementado) para reduzir o trabalho manual de
> preenchimento do sistema, reutilizando conteúdo em todo lugar: templates, respostas rápidas,
> prompts do Agente de Prompt, documentos, temas e preenchimento assistido por IA.

### 9.1 Diagnóstico (o que já existe hoje)

| Recurso | Onde está | Estado |
|---|---|---|
| Templates de mensagem (WhatsApp/E-mail) com variáveis `{nome}`, `{empresa}` | `useTemplatesStore` → tabela `templates`; UI em Configurações → Templates | Pronto (CRUD completo, ativo/uso/versão/aprovador) |
| Base de conhecimento (FAQ, objeções, cases, políticas, produtos) | `useConhecimentoStore` → tabela `conhecimento` | Pronto (CRUD + palavras-chave + status) |
| Catálogo de produtos/serviços | `useCatalogoStore` → tabela `catalogo_produtos` | Pronto |
| Gerador de prompt de busca de leads | `PromptAgent.tsx` + `promptBusca.ts` (modelos fixos em código) | Parcial — modelos são hardcoded, sem CRUD/histórico |
| Propostas/orçamentos | `usePropostasStore` (geradas a partir do catálogo) | Funcional, mas sem template reutilizável |

**Conclusão:** templates e conhecimento já são reutilizáveis; o que falta é transformar os
modelos/prompts em dados editáveis, criar as "peças" que ainda não existem (respostas rápidas com
atalho, templates de proposta/documento, temas) e ligar tudo por **variáveis globais** + **IA**.

### 9.2 Objetivo

Reduzir a digitação repetitiva e acelerar o preenchimento em três frentes:
1. **Reuso** — peças prontas (templates, respostas, prompts, documentos) aplicáveis com 1 clique.
2. **Contexto único** — variáveis globais da empresa preenchidas uma vez e espalhadas por tudo.
3. **Assistência** — IA sugerindo/autocompletando enquanto o usuário digita.

### 9.3 Workstreams (blocos de trabalho)

#### WS1 — Variáveis globais da empresa (fundação) — ✅ concluído (2026-08-23)
- **O que cria:** um "dicionário" de valores usados em todos os templates: `nome_empresa`, `cnpj`,
  `endereco`, `telefone`, `whatsapp`, `site`, `email`, `logo_url`, `assinatura`, `link_proposta`.
- **Onde:** reutilizar a tabela `empresa_config` (já existe) + expor via `useEmpresaSettingsStore`.
- **Como ajuda:** qualquer template/proposta/e-mail puxa esses valores automaticamente — nunca mais
  digitar "Atenciosamente, Nome da Empresa" à mão.
- **Detalhe:** as variáveis ficam disponíveis como `{empresa.nome}`, `{empresa.assinatura}` etc. no
  seletor de variáveis dos templates.

#### WS2 — Respostas rápidas + atalhos — ✅ concluído (2026-08-23)
- **O que cria:** respostas curtas e prontas com **atalho** (ex.: `/saudacao`, `/orcamento`,
  `/followup`, `/desconto`, `/agenda`, `/objeção`), por canal e por tom (formal/descontraído).
- **Modelo:** nova tabela `respostas_rapidas` (id, atalho, titulo, canal, tom, conteudo, variaveis, ativo).
- **Onde:** atalhos funcionam no chat de Atendimento (digitou `/` → abre o seletor) e no editor de
  mensagens da Ana.
- **Reuso:** aproveita o conceito de templates já existente (a categoria "Resposta rápida" vira um
  grupo de atalho), mas com `atalho` único e busca instantânea.

#### WS3 — Biblioteca de prompts do Agente de Prompt — ✅ concluído (2026-08-23)
- **O que cria:** os `modelosPrompt` (antes hardcoded em `promptBusca.ts`) viraram dados editáveis
  na nova tabela `biblioteca_prompts` (via `useBibliotecaPromptsStore`).
- **Modelo:** nova tabela `biblioteca_prompts` (id, titulo, objetivo, prompt, campos, preset, ativo).
- **Funcionalidades:**
  - **Presets com contexto do negócio** (o que a empresa vende, tom, público) embutidos no prompt,
    sem redigir do zero.
  - **Histórico/favoritos** dos últimos prompts usados.
  - **Sugestão automática** de prompt pela intenção detectada (buscar lead, qualificar, campanha,
    resumir conversa, redigir follow-up).
- **IA:** usar a Edge Function `ana-ia` para "melhorar/sugerir" o prompt antes de gerar.

#### WS4 — Templates de mensagem (evolução) — ✅ concluído (2026-08-23)
- **O que foi feito:** **pré-visualização com lead de teste** (as variáveis são resolvidas com dados
  reais de um lead fictício no modal de detalhe), campo **tom** (formal/consultivo/descontraído) no
  formulário e no detalhe, e resolução com **variáveis globais** da empresa.
- **Onde:** Configurações → Templates.

#### WS5 — Templates de proposta/orçamento — ✅ concluído (2026-08-23)
- **O que cria:** modelos de proposta com estrutura pronta (itens do catálogo, prazo de validade,
  condições, forma de pagamento, garantia) e **blocos reutilizáveis** (termos, cláusulas, rodapé).
- **Modelo:** nova tabela `templates_proposta` (id, nome, blocos jsonb, validade_padrao_dias, termos, ativo).
- **Onde:** Orçamentos — ao gerar proposta, escolher o template; a Ana usa o template padrão.
- **Validação automática:** avisa "orçamento sem prazo" / "item sem preço".

#### WS6 — Templates de documentos — ✅ concluído (2026-08-23)
- **O que cria:** contratos, NDA, termo de serviço, checklist de onboarding, recibo — com variáveis.
- **Modelo:** nova tabela `templates_documento` (id, nome, tipo, conteudo, variaveis, ativo).
- **Onde:** nova aba em Configurações e reuso no envio de proposta (gerar contrato a partir do
  orçamento aceito).

#### WS7 — Temas e assinatura visual — ✅ concluído (2026-08-23)
- **O que cria:** temas de proposta/e-mail (cores, logo, tipografia, assinatura padrão).
- **Modelo:** nova tabela `temas` (id, nome, cores jsonb, logo_url, assinatura, padrao).
- **Onde:** Configurações → nova aba "Aparência/Temas"; aplicado a propostas e e-mails com 1 clique.

#### WS8 — Fluxos de automação prontos (presets) — ✅ concluído (2026-08-23)
- **O que cria:** sequências prontas (boas-vindas, follow-up pós-orçamento 1/3/7 dias, lead inativo,
  aniversário) já com as mensagens preenchidas e editáveis.
- **Modelo:** nova tabela `fluxos_automatizacao` (id, nome, gatilho, passos jsonb, ativo).
- **Onde:** Configurações → Automações; ligar o fluxo e ele monta as mensagens automaticamente.
- **Ligado ao motor (2026-08-23):** os gatilhos agora disparam de verdade. `novo_lead` dispara na
  ativação, `orcamento_enviado` ao gerar orçamento, e `lead_inativo`/`aniversario` são detectados
  no tick do motor (`processarAutomacoesPendentes`). Os passos são agendados no lead
  (`fluxosProgramados`), com `diasApos` resolvido em datas reais, e as variáveis `{nome}`,
  `{empresa_nome}`, `{assinatura}`, `{oferta}` e `{validade}` saem resolvidas com dados do lead,
  da empresa e das variáveis globais.

#### WS9 — Importação em massa (CSV) — ✅ concluído (2026-08-23)
- **O que cria:** importar leads/contatos/produtos por CSV com mapeamento de colunas e prévia.
- **Onde:** Busca de Leads → "Importar lista" e Configurações → Produtos (botão "Importar CSV").
- **Como ajuda:** substitui cadastro manual um a um.
- **Detalhe:** componente reutilizável `CsvImportModal` (parser `src/lib/csv.ts` + detecção
  automática de colunas + mapeamento ajustável + prévia de 5 linhas), com deduplicação por
  e-mail/WhatsApp/empresa (leads) e por código/nome (produtos).

#### WS10 — Preenchimento assistido por IA (autocomplete) — ✅ concluído (2026-08-23)
- **O que cria:** ao digitar (descrição de produto, texto de proposta, resposta no chat), a Ana
  sugere completar usando a Edge Function `ana-ia` (ação `autocompletar`).
- **Onde:** descrição de produto (Produtos), termos do template de proposta, e chat de Atendimento
  (botão "Completar com IA").
- **Detalhe:** sempre com fallback (sugestão opcional, nunca trava a digitação). Componente
  reutilizável `AutocompleteTextarea` + cliente `autocompletarTexto` em `anaIA.ts`.

### 9.4 Modelo de dados (novas tabelas no Backend)

| Tabela | Campos principais | Propósito |
|---|---|---|
| `respostas_rapidas` | id, atalho, categoria, texto, ativo | Respostas com atalho `/` |
| `variaveis_globais` | id, chave, valor, descricao | Variáveis personalizadas (`{link_proposta}`, `{link_agendamento}` etc.) |
| `biblioteca_prompts` | id, titulo, objetivo, prompt, campos, preset, ativo | Prompts editáveis do Agente de Prompt |
| `templates_proposta` | id, nome, blocos, validade_padrao_dias, termos, ativo | Modelos de orçamento |
| `templates_documento` | id, nome, tipo, conteudo, variaveis, ativo | Contratos/NDA/checklists |
| `temas` | id, nome, cores, logo_url, assinatura, padrao | Temas visuais |
| `fluxos_automatizacao` | id, nome, gatilho, passos, ativo | Fluxos prontos |

> Todas seguem o padrão `createBackendStore` das demais stores (persistência no Readdy Backend +
> cache local como fallback). As variáveis globais (WS1) reaproveitam `empresa_config`.

### 9.5 Fases de implementação (priorização por impacto/esforço)

- **Fase A (fundação + reuso imediato):** WS1 (variáveis globais) + WS2 (respostas rápidas). ✅ Concluída (2026-08-23).
- **Fase B (destravar a IA):** WS3 (biblioteca de prompts) + WS4 (pré-visualização/tom dos templates). ✅ Concluída (2026-08-23).
- **Fase C (documentos e proposta):** WS5 (templates de proposta) + WS6 (documentos). ✅ Concluída (2026-08-23).
- **Fase D (automação e escala):** WS7 (temas) + WS8 (fluxos prontos). ✅ Concluída (2026-08-23).
- **Fase E (aceleração fina):** WS9 (CSV) + WS10 (autocomplete IA). ✅ Concluída (2026-08-23).

> **Ordem recomendada:** A → B → C → D → E. Cada fase é testável e entregável de forma independente.

---

## 10. Auditoria técnica de ponta a ponta (backend + banco + Ana) — 2026-08-23

### 10.1 Arquitetura real de persistência (descoberta)

As stores usam o padrão **documento/blob** via `createBackendStore`: cada tabela guarda
**uma linha por usuário** (`user_id` PK + `dados` jsonb + `updated_at`), com o dataset inteiro
(leads, propostas, vendas...) serializado dentro do `dados`. RLS correto em todas (`auth.uid() = user_id`).

**Correção de entendimento:** não há FKs relacionais entre `leads` ↔ `propostas` ↔ `vendas`.
As "ligações" (ex.: `proposta.leadId`) são referências por string **dentro** do JSON `dados`,
não constraints de banco. Funciona, mas não há integridade referencial no nível do Postgres.

### 10.2 Tabelas órfãs (identificadas, sem código referente)

- `crm_leads`, `crm_propostas`, `crm_vendas`, `crm_conversas`, `crm_compromissos` — schema relacional
  legado, **nenhuma store usa**. Peso morto; pode ser limpo manualmente se desejado (não removido
  aqui por restrição de tool).

### 10.3 Correções aplicadas

1. **Social → Backend:** `useSocialStore` usava apenas `localStorage` (não sincronizava com a tabela
   `campanhas`). Migrado para `createBackendStore('campanhas', ...)` com migração das chaves locais
   antigas (`leadai_social_contas_v1` / `leadai_social_posts_v1`).
2. **Motor automático (Ana ponta a ponta):** `processarAutomacoesPendentes` só rodava por clique
   manual em "Executar automações". Adicionado tick em segundo plano (60s) no `DashboardLayout`,
   disparando follow-ups, timeouts, no-shows, lembretes e fluxos prontos automaticamente (idempotente).

### 10.4 Pendências conhecidas

- Teste real de responsividade em tablet/smartphone (revisão de classes feita; teste visual por
  dispositivo pendente).
- Ordem lógica dos cards revisada no Dashboard/menu; revisão nos demais menus pode ser feita sob demanda.

---

## Fim do plano (seção 9)