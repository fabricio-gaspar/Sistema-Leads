# Frontend

## 06/10/2026 — Evolution GO: self-service do vendedor condicionado ao lifecycle local

O contrato local mantém o vendedor limitado à própria conta/pareamento, sem QR de terceiros ou segredos; a conta só fica disponível após o job multi-tenant durável criado pelo vínculo. Desconexão/desativação não apaga o histórico. A validação consolidada registrou 769 Vitest/93 arquivos, type-check app/Edge, lint, build/artefato, PGlite 6/6 e PostgreSQL nativo 2/2; não houve QR real, chamada a provedor, mensagem, dado de cliente, migration aplicada, deploy ou publicação. Drift remoto, staging coordenado, QR Evolution 400/500 e política de senha/Auth pendente impedem release isolada.

## 06/10/2026 — Evolution GO: papéis separados no painel compartilhado

`EvolutionGoPanel.tsx` agora deixa Configurações com o formulário/teste do servidor corporativo e estado/controle dos conectores, sem QR, código ou conexão de sessão. A Central de Atendimento em modo vendedor mantém o pareamento individual e exibe conta, instância não secreta e instruções. Backend e permissões existentes foram preservados; Site não publicado.

## 06/10/2026 — Gerenciador Evolution GO visível em Usuários

`UsersAccessWorkspace.tsx` reutiliza `EvolutionGoPanel mode="administration"` na seção Membros de Configurações → Usuários. O painel existente continua verificando permissão e lendo metadados reais pelo backend; nenhuma ação de QR, configuração ou envio foi executada. Prévia local autenticada validada; Site oficial não publicado.

## 06/10/2026 — Conceito visual de referência no shell do CRM

`DashboardLayout.tsx`, `wayflex-visual.css` e `wayflex-redesign.css` passam a compor a mesma hierarquia leve da referência usando somente os elementos existentes: sidebar clara por grupos, topbar compacto, busca de telas já existente, cards com borda discreta e ações primárias verdes acessíveis. `page.tsx` e `command-center.css` de Configurações mantêm os mesmos grupos e rótulos, com seletor compacto até 2xl. Nenhuma rota, permissão, handler, integração ou regra de negócio mudou; Site não publicado.

## 06/10/2026 — Configurações: provedores de contingência sempre visíveis

`WhatsAppEntriesTab.tsx` substitui o painel recolhido por estágios permanentes para seleção corporativa, configuração/validação e WA-AKG individual; também resolve âncoras após a renderização para Z-API, Meta e WA-AKG. `IntegracoesTab.tsx` aceita apresentação de coluna única no contexto estreito, enquanto `WhatsappProviderControlPanel.tsx` e `command-center.css` usam grade baseada na largura disponível. `MetaCoexistencePanel.tsx` mostra indisponibilidade explícita apenas quando o consumidor pede essa apresentação; o gate de homologação continua fechado. A prévia autenticada confirmou o layout em desktop e mobile sem overflow; Site não publicado.

## 06/10/2026 — Configurações: cards de Canais e Status operacional organizados

`src/pages/dashboard/configuracoes/page.tsx` mantém a navegação agrupada e usa uma descrição contextual por seção. `WhatsAppEntriesTab.tsx` separa Configuração, Diagnóstico e Histórico, preservando os mesmos handlers e ações; o estado salvo **Não configurada** não é mais confundido com o rascunho **Ativa ao salvar**. `OperationalStatusTab.tsx` só adiciona rótulos semânticos para a apresentação responsiva, enquanto `command-center.css` converte as linhas da tabela em cards no mobile. A prévia autenticada confirmou Canais/Diagnóstico e Status sem corte horizontal; Site não publicado.

## 06/10/2026 — Configurações → APIs abre configuração e atualiza uso operacional

`src/pages/dashboard/configuracoes/components/ApisProvidersTab.tsx` separa a ausência de configuração da indisponibilidade operacional. Ao pedir ativação sem configuração, abre `ConfigureModal` e não escreve estado parcial. Com configuração validada, reutiliza `configurar-integracao set_usage`; ao desativar, preserva todos os dados e atualiza a tela pela leitura canônica. A prévia abriu e cancelou a configuração de Google Places sem erro de console; Site não publicado.

## 06/10/2026 — Leads → Kanban roteia o mesmo registro sem ativar a Ana

`src/pages/dashboard/leads/page.tsx` oferece **Enviar ao Kanban** no menu de cada linha e na seleção em massa. O diálogo não pede consentimento, handoff ou ação da Ana: ele informa o vínculo necessário, os registros já visíveis e os bloqueios mínimos. `src/lib/crm/kanbanDispatchPlan.ts` identifica Ana sem rota, humano incompleto e registros já roteados; `assignKanbanRoutingUser` preserva todos os dados, mudando somente `responsavelId`. A validação autenticada confirmou um cartão único em Novo após reload, sem mensagem ou automação; Site não publicado.

## 05/10/2026 — Leads → Kanban preserva a classificação importada

`src/pages/dashboard/leads/page.tsx` não oferece mais Ana/Humano como nova escolha no envio ao Kanban. `src/lib/crm/kanbanDispatchPlan.ts` separa a seleção pelos modos já persistidos: Ana mantém os gates de canal/autorização e a transferência automática opcional; humano conserva o responsável importado. O diálogo local mostrou esse resumo para um lead Ana e foi cancelado; Site não publicado.

## 05/10/2026 — Leads → Kanban, local validado

`src/pages/dashboard/leads/page.tsx` reutiliza o fluxo existente `enviarParaKanban`: a barra de leads selecionados agora expõe o acionador e bloqueia somente uma seleção que o operador não pode editar. `src/lib/crm/leadStageRepository.ts` é a fonte canônica de chaves/rótulos/terminais para os seletores; Ganho e Perdido são exibidos, porém continuam protegidos como resultados do orçamento. A validação autenticada abriu e cancelou o diálogo sem fazer escrita; Site não publicado.

## 05/10/2026 — deltas R5/R9/R12 locais, não publicados

Auth → sessionContext (user/org/generation) → OrganizationGate → stores por contexto. Respostas antigas e setters anteriores são recusados; não há seed operacional por localStorage. Convites têm aceite explícito fora do CRM. CSV/exports usam parser e escape central; próxima ação da Agenda usa RPC idempotente; tooltip/CSV usam interação e diálogo acessíveis; CTAs do Wizard compartilham motivo. Recovery de canal é administrativo, explícito e não ativa transporte. Ver `docs/remediacao/2026-10-05-r4-r14/` e manifesto final; não publicar frontend sem backend/migrations compatíveis.

- Busca de Leads (05/10, LOCAL VALIDADO): o preenchimento é guiado por **Fonte → Região → Perfil → Critérios**. Cada etapa valida apenas seu dado obrigatório e mantém o progresso ao voltar; fonte continua derivada de `lead_source_configs` conectadas/ativas. A consulta real ainda acontece somente em **Testar com 10 empresas**; revisão e importação não foram modificadas. O commit `b01f600` aguarda publicação e inspeção autenticada do Site.

- Leads (28/09, Site v144): carteira operacional com abas de prioridade, pesquisa normalizada, filtros básicos/avançados, ordenação, colunas salvas por usuário e tabela de dados autorizados. Aderência explica os critérios; próxima ação usa tarefa persistida; etapa e responsável preservam os contratos atuais. Exclusão definitiva não é duplicada: o atalho direciona à gestão governada em Funil.

- Busca de Leads (28/09, Site v142): **Termos de busca** preserva a entrada livre e acrescenta um assistente por segmento com seis grupos Wayflex. O usuário marca opções relacionadas, remove-as pelo mesmo controle e pode adicionar as disponíveis em lote, sempre com deduplicação e limite de dez termos. A seleção não inicia busca externa.

- Busca de Leads (27/09): o cabeçalho **Fonte e local** mantém um seletor de API visível, alimentado por `lead_source_configs`. Somente Apify e Google Places conectados e ativos são opções; uma única fonte é pré-selecionada sem esconder o controle. A tela recarrega o estado ao montar e ao retomar o foco.

- Funil (27/09, Site v140): **Gerenciar base** volta a montar `LeadBaseManager` depois da análise comercial. Somente `leads.read_all` vê a superfície; a ação definitiva continua desabilitada sem seleção e sem `leads.delete`. Um teste de posicionamento impede que o componente fique órfão ou seja duplicado em Leads.

- Redesign 27/09: `CommercialAnalytics` e `commercialAnalytics.ts` centralizam coortes, valores líquidos, histórico observado e atualização transparente. `DataReadNotice`, `AccessibleDialog` e `wayflex-redesign.css` refinam estados e composição. Detalhes em `docs/REDESIGN_WAYFLEX_2026-09-27.md`; observações históricas abaixo não substituem este checkpoint atual.

- Operação automática (27/09): pré-requisitos pendentes mostram motivo e ação no módulo exato; a ativação rola até a primeira pendência. Links profundos abrem Configuração publicada, IA, Apify, worker, WhatsApp e Ambiente Real sem modificar os gates server-side.

- Paleta global (27/09): todo o CRM sob `wf-app` reutiliza as cores da Dashboard. Tokens centrais definem grafite, canvas frio, verde Wayflex, lima, âmbar e coral; telas antigas e estados visuais foram normalizados sem modificar comportamento.

- Dashboard (27/09): controle compacto **Ana automática** consulta a configuração operacional real, respeita `configuration.manage` e oferece Ativar/Pausar somente quando seguro. Estado incompleto abre Configurações > Ana e nunca simula ativação local.

- Busca de Leads, etapa 4 (25/09): a revisão importa seleção, lista e vínculos por uma RPC atômica. Em resposta incerta, preserva ID e payload para confirmar o mesmo lote sem duplicar. Após sucesso confirmado, relê leads e listas do servidor. Nenhuma alteração nos caminhos CSV, Ana, canais ou envio.

- Busca de Leads, etapa 3 (25/09): **Adicionar aos Leads** aguarda a persistência dos leads,
  da lista e do vínculo final antes de navegar. Falha aparece em alerta, bloqueia reenvio
  cego e oferece acesso a Leads para verificar possível gravação parcial. O fluxo de sucesso
  e a seleção explícita não mudaram.
- Dashboard: o gráfico de conversas usa somente o histórico operacional carregado da Central e
  mostra as últimas 24 horas em faixa horizontal rolável. Notas internas não entram na métrica;
  nenhuma mensagem no período produz estado vazio, nunca valores ou conteúdo simulados.
- O selo do gráfico declara “Ao vivo” somente após a assinatura Realtime estar `SUBSCRIBED`.
  A assinatura é limitada à `organization_id` da sessão; falha de conexão não é mascarada como
  atualização em tempo real.
- Refinamento visual de 11/09: Dashboard concentra métricas, distribuição Kanban e temperatura,
  status individual das integrações, atendimento humano e fila. Barras zero permanecem vazias.
- Compactação de 11/09: o mesmo Dashboard usa cards e listas mais densos, sem alterar fontes
  remotas, callbacks, estados, rotas ou regras de domínio.
- Canais e APIs, em 11/09, usa uma grade compacta com nome e somente Conectado/Desconectado.
  O selo vem de `operational-diagnostics`; não há estado inferido no navegador.
- Busca manual: a revisão só abre após retorno real do provedor. Falhas ficam visíveis nos
  filtros, e um retorno vazio real mostra estado vazio explícito. O adaptador reconhece os
  campos de empresa e localização devolvidos pela prospecção.
- Menu usa Prospecção, Atendimento e Comercial. Configurações agrupam conexões, empresa/IA,
  gestão comercial e segurança, preservando IDs, callbacks e componentes de formulário.

- React/TypeScript/Vite, rotas em `src/router/config.tsx`.
- Shell e menu em `src/components/feature/DashboardLayout.tsx`.
- Design atual segue tokens Wayflex Executive Light em `src/index.css`: branco e cinza
  claro, verde institucional, bordas finas, raios contidos e sombras discretas.
- O menu global está agrupado pelo fluxo Começo · captar, Meio · atender, Final · fechar
  e Administração. A busca lateral filtra somente telas existentes e cada resultado navega
  para uma rota real.
- O Dashboard mostra uma sequência de trabalho e cartões de recursos derivados do
  `operational-diagnostics`; nenhum estado ativo é inferido localmente.
- `src/lib/supabase.ts` prefere a configuração pública entregue pelo Worker em
  `/runtime-config.js` e preserva as variáveis `VITE_PUBLIC_SUPABASE_*` apenas como fallback
  local. O Worker lê URL e chave publicável do ambiente do Site a cada carregamento; não
  versionar valores reais em `.env` ou no Git.
- Dados operacionais devem vir de repositories em `src/lib/crm/`; localStorage é permitido
  somente para filtros e preferências pessoais.
- Telas críticas: Dashboard, Leads, Kanban, Atendimento, Orçamentos, Agenda, Configurações e
  Registro do Sistema.
- Em **Configurar a Ana**, a última etapa apresenta explicitamente a versão já publicada e o
  botão só fica habilitado após alteração pendente. O rótulo e a dica explicam esse estado para
  evitar a aparência de falha e impedir versões duplicadas sem mudança.
- **Configurar a Ana** usa novamente a navegação compacta anterior de seis etapas. O mapa visual
  da versão 75 foi removido a pedido do operador; formulário, payload, persistência e autoridade
  automática de `ana-run` permaneceram inalterados.

## Central de Atendimento — 18/09/2026

- A Central usa uma assinatura Supabase Realtime de `lead_messages`, filtrada pela
  `organization_id` da sessão autenticada. O evento apenas solicita nova leitura do repository
  operacional; ele não insere mensagem, não escolhe lead e não acessa segredo no navegador.
- O selo só diz **Atualização ao vivo** após `SUBSCRIBED`. Durante reconexão ou em rede sem
  WebSocket, a Central continua atualizando automaticamente por leitura periódica e deixa isso
  explícito, sem exigir F5 nem alegar um estado ao vivo inexistente.
- O layout da Central é uma superfície de trabalho com caixa de conversas, conversa e contexto
  comercial. Em desktop, o contexto liga Agenda, Orçamentos e Kanban pelo ID do lead; em telas
  menores, continua disponível pelo drawer. Agenda e Orçamentos recebem `leadId` com `new=1` apenas
  para abrir seus formulários já preenchidos — nenhuma reunião ou proposta é criada sem confirmação
  explícita no respectivo módulo.
- Atalhos de resposta apenas preenchem o compositor. A mensagem humana continua passando pela fila
  auditável e o orçamento preparado continua exigindo revisão e envio explícito.

## Busca de Leads — 11/09/2026

- A busca manual usa Fonte → Filtros → Revisão → Importação. Fontes de prospecção ainda não
  validadas aparecem bloqueadas, em vez de desaparecerem do seletor.
- O retorno real pode ser assíncrono: enquanto a Apify processa, a tela consulta a mesma
  execução por `runId`; a revisão só aparece quando o backend entrega resultados finais.
- `ProspectingMap` desenha somente latitude/longitude devolvidos pela fonte, com tiles do
  OpenStreetMap e abertura do drawer ao clicar no marcador. Sem coordenadas, exibe estado
  transparente e mantém os leads na tabela.
- A última etapa exige seleção e leva ao módulo Leads após a persistência. Não há promessa nem
  disparo automático da Ana ou de WhatsApp nesse fluxo.

## Governança e entrada do site — 16/09/2026

- Leads inclui a Base de Leads: filtros por ciclo de atividade, seleção explícita e confirmação
  textual antes de uma exclusão definitiva.
- Configurações > Canais > WhatsApp inclui a entrada do site, com link copiável e status real da
  configuração. Equipe ganhou editor de permissões por membro; nenhuma dessas telas exibe segredo.

## Provedores da Busca de Leads — 22/09/2026

- **APIs** é o único ponto visual para Apify — Google Maps e Google Places: cada cartão mostra
  conexão validada, disponibilidade do provedor e o estado real de uso na Busca de Leads, com a
  ação de ativar ou pausar.
- O item de navegação **Fontes** foi removido para evitar os mesmos provedores em duas telas. A
  URL legada `?tab=fontes` continua compatível e abre **APIs**; o Dashboard mantém apenas o
  resumo de status e também aponta para essa tela única.

## Meta Coexistence — 24/09/2026

- **Canais > WhatsApp** reutiliza o painel existente e pode exibir o Embedded Signup oficial da
  Meta somente quando `meta_coexistence` estiver habilitado para a organização. Com a flag atual
  desligada, o usuário não vê uma integração ainda não homologada.
- A Central carrega o provedor da conta da conversa. Mensagem humana Meta usa o endpoint Meta; a
  conta Z-API continua no caminho atual. Mídia comercial Meta falha de forma explícita enquanto a
  sincronização/homologação própria não existir, evitando promessa silenciosa.
- O nome visível do produto foi normalizado para **Sistema de Leads** sem renomear tabelas, chaves,
  classes internas ou identificadores compatíveis.
