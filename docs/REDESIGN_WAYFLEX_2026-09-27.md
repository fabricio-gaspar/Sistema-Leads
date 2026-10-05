# WayFlex CRM — redesign implementado e especificação

Data: 27/09/2026. Base: Site existente, versão 136; checkout inicial `527d2ca14b1732aad4953b8fc06f7f98f3d76954`.

**Publicação confirmada:** versão 137, código `e19a3570143f55976e3f080efa2c43f9e916d2ea`, deploy `appgdep_6ab948949864819190d1f63be2a0d5a2` em estado `succeeded`. Endereço: https://leadai-crm-preview.fabricio926564.chatgpt.site. Esta confirmação é de publicação, não de homologação visual autenticada.

## Resultado e limite desta entrega

Implementação no React/TypeScript existente, sem segundo CRM, troca de stack ou alteração de credenciais. As 11 rotas foram preservadas. Dashboard, Funil e Relatórios receberam uma estrutura analítica nova; as demais telas receberam refinamentos compartilhados e correções dirigidas de fluxo e estados. O layout entregue é código executável, não uma imagem com números demonstrativos.

Não houve envio de mensagem, busca paga, criação de lead, ativação da Ana, troca de provedor ou escrita de dados comerciais durante a validação. As consultas remotas realizadas foram de leitura para confirmar schema, publicação Realtime e população agregada. A confirmação visual autenticada de todas as telas ainda não foi realizada; não apresentar esta entrega como homologação integral ou ausência garantida de erros.

## 1. Diagnóstico objetivo

| Área | Evidência no código/base | Tratamento |
| --- | --- | --- |
| População comercial | Dashboard e Relatórios contavam toda a base; Funil excluía por autorização de contato; Kanban exigia modo e responsável | Predicado comercial compartilhado; autorização continua independente |
| Revisão | Dois leads persistidos, nenhum atribuído, nenhum com contato autorizado na leitura agregada | Cadastros não são apresentados como carteira aprovada; fila de revisão separada |
| Percentuais | Bases vazias produziam 0%; diferença de estoque entre etapas parecia avanço | Denominador zero vira “—”; avanço histórico limitado à evidência registrada |
| Valores | Dashboard somava valor bruto; relatórios incluíam rascunhos no aberto | Abertos = enviada/visualizada; desconto aplicado uma vez; aceite não é receita recebida |
| Atualização | Apenas mensagens estavam na publicação Realtime entre as entidades verificadas | Mensagens por evento; carteira/propostas por consulta de 60 s, explicitamente rotulada |
| Completude | Repositórios base não paginavam | Paginação estável, joins em lotes e falha explícita no limite de segurança |
| Navegação | Atalho “Indicadores” abria Kanban; menus duplicavam caminhos | Removida navegação superior redundante; sidebar com grupos e rótulos |
| Operação | “Fonte conectada” não provava disponibilidade atual | Busca indica “fonte habilitada”; diagnóstico continua autoridade da saúde |
| Formulários | Sucesso de Agenda e algumas ações de propostas antecedia persistência | Feedback após confirmação; falha visível; guarda de criação duplicada de proposta |
| Preços | Zero de catálogo podia significar preço desconhecido | Campo de preço humano; zero intencional requer entrada explícita; documentos bloqueiam preço não confirmado |
| Acessibilidade | Sidebar móvel fora da tela permanecia focável; diálogos sem contenção nativa | `inert`, Escape/foco na sidebar; diálogo nativo em Leads, Agenda e Orçamentos |

## 2. Arquitetura das telas e ciclo comercial

Navegação: **Visão geral → Prospecção → Atendimento → Comercial → Administração**. Permissões existentes continuam determinando os itens disponíveis.

O fluxo é: busca externa → revisão do retorno → importação confirmada → cadastro em Leads → atribuição de modo e responsável → carteira/Kanban → atendimento → reunião/orçamento → ganho ou perda. A autorização de contato é um controle separado e obrigatório no caminho de automação. Importar não autoriza contato; atribuir não comprova consentimento; orçamento aceito não comprova pagamento.

| Tela e rota | Organização e comportamento implementado |
| --- | --- |
| Dashboard `/dashboard` | Cabeçalho e agenda; filtros; faixa integrada de indicadores; evolução diária e comparação; fila de revisão e ações; pipeline; origem/equipe; Ana e saúde operacional |
| Busca `/dashboard/busca-leads` | Modos busca/CSV/assistente preservados; histórico recuperável; etapas buscar/revisar/importar; contexto explícito de que retorno não é oportunidade; fonte sem falso selo de disponibilidade |
| Leads `/dashboard/leads` | Tabela operacional e filtros preservados; erro de leitura separado de vazio; edição de empresa/cidade/UF; revisão, atribuição e contato mantidos; diálogos com foco nativo |
| Kanban `/dashboard/kanban` | Sete etapas, rolagem horizontal contida; filtros salvos; atribuição canônica; arquivados fora; contato pendente visível sem liberar Ana; datas analíticas no mesmo fuso |
| Central `/dashboard/atendimento` | Superfície integrada de lista, conversa e contexto; assinatura real existente preservada; conversas sem histórico rotuladas “Sem mensagens”; ações de Agenda/Orçamento continuam abrindo formulário, não gravando automaticamente |
| Meu WhatsApp `/dashboard/meu-whatsapp` | Cabeçalho contextual e painel de conta existente; distinção entre conexão, consentimento e entrega; QR/conexão continuam no fluxo original |
| Agenda `/dashboard/agenda` | Calendário, filtros e próximos compromissos preservados; duração selecionável; resumo de data/horário; gravação confirmada; erro e exclusão explícitos; reagendamento preserva duração |
| Orçamentos `/dashboard/orcamentos` | Busca por número/empresa/contato e situação; indicadores com base; preço unitário confirmado; desconto e validade humanos; bloqueio de preço ambíguo; versão aceita anterior preservada; arquivamento nomeado corretamente |
| Funil `/dashboard/funil` | Mesma base analítica do Dashboard; distribuição atual separada do histórico observado; sem funil decorativo nem inferência de perda entre colunas |
| Relatórios `/dashboard/relatorios` | Período, responsável, origem, etapa e segmento; evolução, contatos, propostas, distribuição; visões salvas com leitura do formato anterior; CSV dos registros filtrados |
| Configurações `/dashboard/configuracoes` | Nove áreas existentes preservadas e agrupadas; URL acompanha a seleção e histórico do navegador; formulários, permissões e gates de operação permanecem |

## 3. Design system aplicado

### Cores e composição

| Token/uso | Valor |
| --- | --- |
| Grafite, texto forte e ações principais | `#171A1D` |
| Canvas frio | `#F4F6F7` |
| Superfícies | `#FFFFFF` |
| Divisórias | `#E0E5E8` |
| Lima de destaque e ação de revisão | `#D8F66B` com texto grafite |
| Verde de dados | `#168654` |
| Texto secundário | `#65717B` |
| Potencial em propostas | Superfície escura `#19211E`, texto claro; não usar verde para fingir receita |
| Atenção | Fundo claro âmbar, texto escuro; estados críticos sempre acompanhados de texto |

Mantida a família tipográfica do produto. Título principal entre 26,4 e 32 px, peso 700; título de painel 17 px; corpo/tabelas 14–16 px; metadados 12–13 px. Números usam alinhamento tabular. Escala de espaçamento principal: 4, 8, 12, 16, 20, 24 e 32 px. Superfícies com raio aproximado de 14 px, controles 9–10 px e sombras contidas.

A faixa de seis indicadores usa divisórias, não seis cartões decorativos iguais. A composição é assimétrica: gráfico principal amplo e coluna de trabalho; distribuição abaixo; operação separada de desempenho comercial. Lima é acento, não preenchimento dominante de todos os componentes.

### Componentes e estados

- Botão primário grafite, secundário branco/borda, ação contextual de revisão lima. Ações destrutivas têm texto e confirmação. Estado desabilitado não promete operação.
- Inputs e seletores com altura mínima de aproximadamente 42–44 px; foco visível; labels nos filtros novos. Tabelas preservam colunas e rolagem local em telas pequenas.
- `CommercialAnalytics`: filtros, indicadores, gráficos, tabelas equivalentes, CSV, definições e estados de fonte.
- `DataReadNotice`: carregando, erro com tentativa de nova leitura e aviso de possível desatualização. Erro não é tratado como lista vazia confirmada.
- `AccessibleDialog`: modal nativo, fundo inerte, Escape, contenção e devolução de foco; título associado ao cabeçalho interno. Aplicado aos 12 diálogos/drawers principais de Leads, Agenda e Orçamentos.
- Gráficos sem animação de dados inventada; tooltip, legenda, foco via Recharts, tabela alternativa e ausência de barras mínimas quando o valor é zero. A comparação possui tabela própria com as duas datas.
- Estados operacionais: não configurado, consultando, validado, validação vencida, pausado, erro, indisponível. O estado vem do backend existente; nenhum rótulo “modo seguro” foi criado.
- Movimento reduzido respeita a preferência do dispositivo. Sidebar móvel fechada é inerte; aberta recebe foco e permite Escape.

### Responsividade implementada, ainda não homologada visualmente

Desktop amplo: sidebar rotulada, KPIs 6 colunas, gráfico/ações em duas colunas, painéis inferiores lado a lado. Até 1279 px: KPIs 3 × 2 e operação empilhada. Até 1023 px: menu sobreposto, área analítica principal empilhada. Até 639 px: filtros 2 colunas, KPIs 2 × 3, fila de ações antes do gráfico, tabelas com rolagem interna, painéis em uma coluna. Kanban mantém colunas horizontais roláveis, sem comprimir cartões ilegíveis.

Os gráficos possuem alternativa tabular. A conformidade WCAG integral dos componentes legados não foi auditada em navegador/leitor de tela; não declarar certificação de acessibilidade.

## 4. Dicionário único de métricas

Fonte canônica: `src/domain/commercialAnalytics.ts`, reutilizada por Dashboard, Funil e Relatórios; Kanban usa o mesmo predicado de carteira.

| Indicador | Regra / denominador |
| --- | --- |
| Cadastrados | Leads persistidos, não arquivados, criados na janela; não inclui retorno de busca não importado |
| Em revisão (indicador) | Subconjunto da coorte sem modo ou responsável necessário ao Kanban |
| Fila de revisão (ação) | Todos os leads não arquivados sem atribuição, independente da idade ou dos filtros analíticos |
| Na carteira | `!arquivado && Boolean(modoAtendimento && responsavelId)`; não equivale a autorização de contato |
| Atendimento humano | Carteira não ganha/perdida em HUMANO ou AGUARDANDO_HUMANO |
| Conversão da coorte | Ganhos atuais / carteira atribuída criada no período × 100; inclui perdidos no denominador; base zero = “—”; base menor que 10 é sinalizada |
| Participação na etapa | Quantidade atual da etapa / carteira da coorte × 100; não é conversão histórica |
| Propostas abertas | Propostas enviadas/visualizadas criadas no período, vinculadas à carteira que corresponde às dimensões |
| Potencial não ponderado | Soma dos abertos × `(1 − descontoPct/100)`, arredondamento em centavos por proposta; rascunhos não entram |
| Propostas aceitas | Soma líquida de propostas atualmente aceitas, pela criação da proposta; não é receita recebida ou aceite ocorrido naquele dia |
| Aceite em Orçamentos | Aceitas / (aceitas + recusadas) × 100; indicador geral da tela, não conversão de leads |
| Envios aceitos | Mensagem `type=sent` com `sent_at`; filas, falhas, notas e rascunhos fora; não comprova entrega/leitura |
| Recebidas | Mensagem de cliente/lead `type=received`, agrupada pela criação |
| Comparação de cadastros | `(atual − anterior) / anterior × 100`; janela anterior de igual duração; base anterior zero = indisponível |
| Avanço observado | Leads únicos que alcançaram a próxima etapa / leads com evento que evidencia passagem pela etapa anterior; apenas entre movimentados no período |

Janelas: 7, 30 e 90 dias inclusivos; “Este ano” de 1º de janeiro ao dia atual. Fuso analítico `America/Sao_Paulo`. Timestamp original é preservado; datas antigas sem horário mantêm a data registrada. Responsável, origem, segmento, arquivamento e etapa são os valores atuais, não uma fotografia histórica. As propostas têm sua própria data de criação, portanto podem pertencer a leads mais antigos; os grupos de origem/equipe incluem essa população para reconciliar os valores.

**Limite histórico:** não existe denominador completo comprovado para conversão por etapa de toda a carteira no início de cada janela. Eventos não registram todos os leads parados. A interface explica isso e não reconstrói essa conversão por diferença de estoques. “Fechado” legado, sem ganho/perda explícito, não vira ganho.

## 5. Contrato de dados e atualização

Implementado no hook `useCommercialAnalytics`:

- Contexto autenticado único por consulta, com `organization_id` explícito nos repositórios base e RLS preservada. Nova conferência de organização antes de aceitar o resultado; mudança reinicia assinatura e limpa snapshot incompatível.
- Snapshot: `organizationId`, `leads`, `proposals`, `contacts`, `stages`, `updatedAt`, `historyError`, `contactError`.
- Entidades: `leads`, `proposals`, `lead_messages`, `lead_stage_history`; joins de políticas de handoff e nomes necessários preservados.
- Confirmado remotamente: coluna `lead_stage_history.created_at`; publicação Realtime somente de `lead_messages` entre as quatro entidades verificadas.
- `SUBSCRIBED` permite o rótulo **Mensagens ao vivo · carteira a cada 60 s**. Eventos são agrupados por 400 ms antes de nova leitura; não fabricam registros locais.
- Consulta periódica de 60 s apenas com aba visível e rede disponível; atualização no foco/retorno à aba, reconexão e botão manual. Conexão degradada/sem rede aparece explicitamente.
- Contatos consideram criação **ou** aceite dentro da janela para não perder uma mensagem antiga aceita depois.
- Paginação até página vazia, avanço pelo tamanho efetivamente recebido e ordenação por ID. Joins em lotes de 100 IDs. Acima de 50 mil linhas na consulta detalhada, falha explícita em vez de total parcial.
- Erro do histórico/contatos bloqueia a série correspondente sem inventar valores; falha da carteira/propostas invalida os indicadores principais e mantém data da última consulta conhecida.

Não há snapshot transacional único entre todas as tabelas: escritas simultâneas podem produzir divergência transitória até a próxima leitura. Para escala maior, a próxima etapa é uma RPC de agregação autenticada com a mesma semântica, contagem exata, `as_of`, timezone, filtros normalizados, bases de cada percentual e indicadores de completude. Ela deve executar sob RLS, sem service-role no frontend. Sua adoção requer migration, testes de isolamento por organização, comparação com o domínio atual e publicação autorizada. Não foi implantada uma API fictícia.

Para conversão histórica completa: registrar entradas iniciais/saídas e snapshot por etapa, com momento de atribuição comercial distinto do momento de autorização de contato; não preencher retrospectivamente eventos por suposição. Para tempo real da carteira/propostas: habilitar publicação somente após avaliação de RLS, carga e consumo, ou transmitir invalidações por organização. Até lá, o fallback de 60 s é o comportamento correto.

## 6. Alterações de comportamento explicadas

1. Arquivados ficam fora do Kanban e da análise comercial ativa; histórico permanece no banco.
2. Atribuição é chamada **carteira**, não “aprovação comercial”, pois o schema não registra esse evento separado. Contato pendente não retira um lead humano atribuído.
3. Rascunhos deixam de inflar propostas abertas. A taxa de aceite usa somente decisões aceitas/recusadas, diferente da antiga razão sobre todos os rascunhos.
4. Preço desconhecido deixa de ser zero implícito. Um humano informa o unitário; zero explícito é registrado como confirmado no JSON de itens. Não muda regras de desconto, autoridade da Ana ou forma de envio.
5. Criar versão nova não transforma a versão aceita anterior em expirada. Revisão não apaga o aceite consultado pelos indicadores.
6. Agenda preserva o fuso local do dispositivo usado pelo repositório existente, agora declarado na tela. Não foi feita migração silenciosa de horários para São Paulo. O fuso da organização deve ser formalizado numa etapa própria, com revisão dos agendamentos existentes.
7. Configurações usa navegação com histórico de URL. Formulários e permissões foram mantidos.

## 7. Validação e revisão independente

Revisões independentes de produto/UX, dados/frontend e design estático encontraram e motivaram correções de: população truncada, fuso, conversão observada, backlog antigo, soma por origem, duplicação de proposta em clique duplo, versão aceita, hover de contraste, foco móvel, diálogo e tabela equivalente da comparação.

Validações realizadas: checagem TypeScript frontend e Edge, lint sem warnings, build Vite/Worker e `git diff --check`. O script `node scripts/check-commercial-analytics.mjs` concluiu 17 verificações determinísticas sobre os módulos reais, sem rede. Há 22 novos testes Vitest de domínio/paginação/preço para execução em ambiente normal.

A execução Vitest mostrou asserções aprovadas, mas não encerrou; tentativas com pools limitados também atingiram timeout. **A suíte completa não é declarada aprovada.** O smoke determinístico não substitui essa suíte nem E2E. Nenhum dado operacional foi alterado para testes.

**Pendências de homologação:** renderização autenticada das 11 telas a 1440, 1024 e 390 px; zoom de 200%; leitor de tela/teclado; abrir/fechar diálogos e retornar foco; filtros salvos e CSV; reconexão de mensagens; consistência após mudanças feitas por outro usuário; salvar/editar/reagendar e gerar proposta em ambiente controlado; isolamento entre organizações. O meio de inspeção visual autenticada exigido pelo ambiente não estava disponível nesta execução.

## 8. Prioridades e matriz de entrega

| Prioridade / entrega | Estado | Próximo passo |
| --- | --- | --- |
| P0 — diagnóstico e semântica comercial | CONCLUÍDO | Manter regressões na integração contínua |
| P0 — preservar consentimento, Ana, RBAC/RLS e provedores | CONCLUÍDO no escopo de alterações | E2E operacional continua separado e supervisionado |
| P1 — arquitetura, componentes e fórmulas | CONCLUÍDO | Documentação e domínio central neste repositório |
| P1 — implementação nas 11 rotas | CONCLUÍDO | Publicação pelo fluxo do Site existente |
| P1 — alta fidelidade das 11 telas e responsividade homologadas | PARCIAL | Código responsivo implementado; falta revisão visual autenticada completa |
| P1 — executável navegável publicado | CONCLUÍDO | Site v137 confirmado; avaliar a interface com a sessão real |
| P1 — revisão independente estática | CONCLUÍDO | Achados prioritários corrigidos; não equivale a revisão visual |
| P1 — suíte completa de regressão | BLOQUEADO neste runtime | Executar Vitest em CI/runtime onde o processo encerre normalmente |
| P2 — atualização automática com infraestrutura atual | CONCLUÍDO | Mensagens por evento, demais indicadores por consulta explícita |
| P2 — conversão histórica completa e grandes volumes | PARCIAL | Snapshot/eventos completos e RPC agregada futura; sem backfill inventado |
| P2 — fuso organizacional único | PARCIAL | Preservada Agenda local, analítico São Paulo documentado; migração requer definição e validação |

## 9. Como avaliar

No endereço habitual, entre com sua conta e comece pela Visão geral. Com a base pequena atual, é esperado haver cadastros em revisão e pipeline vazio; isso é uma evidência correta, não falta de preenchimento visual. Alterne os filtros e séries, abra as tabelas, compare o período anterior, navegue à carteira completa e confira as definições. Em seguida, examine Leads, Kanban, Central, Agenda, Orçamentos e Configurações sem acionar envios ou automações apenas para testar aparência.

Comandos locais: `npm run type-check`, `npm run type-check:edge`, `npm run lint`, `npm test`, `node scripts/check-commercial-analytics.mjs`, `npm run build`. O frontend recebe apenas configuração pública do Worker existente. Nenhuma chave privada foi incorporada ao bundle.
