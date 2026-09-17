# Checkpoint — WayFlex CRM

## Organização operacional, monitoramento e resumo diário — 17/09/2026

- **Configurações** agora separa Canais, APIs e Fontes em itens próprios. Os links legados
  continuam redirecionando para a seção equivalente; **Registro do Sistema** fica em
  Configurações > Acesso e governança e a rota antiga redireciona para lá. **Equipe e acessos**
  passa a se chamar **Usuários**.
- A gestão de status e limpeza definitiva foi movida de **Leads** para **Funil de Conversão**;
  não existe uma segunda cópia dessa gestão na tela de Leads.
- O Dashboard apresenta Canais, APIs e Fontes em cartões compactos e separados, com estado de
  conexão validado pelo backend. Saldo/crédito ou expiração só aparece quando o provedor expõe
  esse dado público na configuração; o painel não estima nem inventa saldo.
- O novo monitor do WhatsApp usa contagens reais de jobs aceitos, callbacks de entrada,
  recibos de entrega, falhas e eventos de política nas últimas 1h/24h. O painel atualiza a
  leitura a cada minuto e mostra pausa/atenção somente a partir do estado persistido no servidor.
- Foi aplicado o relatório diário opcional por WhatsApp em **Usuários**. O administrador define
  destinatário, horário e fuso para cada membro. A configuração fica desligada por padrão; o
  worker só considera envios em Ambiente Real, por agendador server-side, canal saudável e sem
  política de pausa. O resumo contém somente totais agregados do funil, nunca nomes, telefones
  de leads ou conteúdo de conversas. O telefone é mascarado nas leituras da interface e a tabela
  de entregas guarda hash do conteúdo, não o conteúdo nem o número.
- Migration aplicada: `20260917213000_daily_whatsapp_lead_reports`. RLS está ligado na nova
  tabela e o acesso é exclusivo do backend `service_role`; nenhuma política de leitura de cliente
  foi criada intencionalmente.
- Funções implantadas no projeto `thgzrkppouoevapjquyu`: `automation-worker` v23,
  `team-members` v7 e `operational-diagnostics` v14. O worker também corrige a origem do sample
  de saúde do canal para o valor permitido pelo schema, permitindo que a telemetria persista.
- Validação antes da publicação do Site: type-check frontend e Edge, lint e build/artefato
  passaram. O contrato direto de resumo diário passou, incluindo telefone normalizado/mascarado,
  horário válido, etapas canônicas e ausência de dado individual de lead. Vitest continua
  bloqueado antes de iniciar pela junção local de `node_modules` sem permissão para o esbuild.
- Nenhum lead foi alterado, nenhuma mensagem foi criada/enviada e nenhuma configuração de relatório
  foi ativada nesta implementação.

## Refinamento visual executivo — 11/09/2026

- PUBLICADO: Site oficial versão 69, commit `5893352d252c61fb03dcc35b005757c3f4d6995c`,
  deploy confirmado como succeeded. Audiência privada preservada.

- Dashboard apresenta indicadores da carteira, barras proporcionais por etapa do Kanban,
  temperatura de leads abertos, conexões com estado individual e acompanhamento humano.
  Não exibe atalhos de começo/meio/fim nem gráficos de evolução sem dados históricos.
- Configurações agrupadas em Operação e conexões, Empresa e inteligência, Gestão comercial
  e Segurança e controle. Canais, APIs e fontes preservam seus componentes e ações existentes.
- Refinamento compartilhado de superfícies, espaçamento, tipografia, foco e menu lateral.
  Nenhuma alteração em hooks, repositórios, regras de domínio, Edge Functions ou dados.
- Validação: type-check frontend/Edge, lint e 159 testes em 15 arquivos passaram. Build Vite
  e artefato Worker concluídos. Sem QA visual autenticado nesta rodada.
- Git HTTPS recuperado com o helper existente em mingw64/bin e TLS OpenSSL por comando;
  credenciais temporárias não foram persistidas.

Última atualização: 2026-09-10. Este documento permite retomar o trabalho quando
Fabricio disser **“pode seguir”**, sem depender do histórico da conversa.

## Como retomar

1. Ler `AGENTS.md`, `.agent/AGENT_OS.md`, `.agent/audit-state.json` e este arquivo.
2. Conferir `git status`, o commit remoto e a versão privada do Site.
3. Revalidar somente o delta e o fluxo afetado; não repetir a auditoria inteira.
4. Preservar o modo protegido. Não enviar mensagens, ativar produção ou criar recurso
   faturável sem autorização específica.
5. Depois de cada lote: testar, atualizar `.agent/`, criar checkpoint Git e publicar apenas
   quando a versão estiver validada.

## Identidade e baseline validado

- Repositório: `/workspace/sites/leadai-crm-preview`.
- Supabase: `thgzrkppouoevapjquyu`.
- Site privado: `appgprj_6a905559159c8191a61fb776b9a4c531`.
- URL privada: `https://leadai-crm-preview.fabricio926564.chatgpt.site`.
- Commit funcional validado: `7c0e02c9a62c2716de408aed6818cb27dec01c33`.
- Baseline visual anterior: tag `baseline-pre-apple-mac-light-20260908` e Site versão 46.
- Antes da nova publicação, o Site ativo era a versão 48 no commit
  `4d072280a09b3b8462f5bf0dfa701b314eca31bb`.
- Prévia atual: Site versão 49, publicada com sucesso a partir do commit
  `947cf10d18e921e4250e5878b0a7ea43dedb3a6b`.

## Entregas deste checkpoint

- Protocolo persistente `.agent/` conectado ao `AGENTS.md`.
- Menu Configurações consolidado por responsabilidade. Diagnóstico, auditoria e registros
  estão no menu independente **Registro do Sistema**.
- Marca do shell mostra apenas **WAYFLEX**; sem círculos decorativos de janela.
- Dashboard consulta métricas e alertas operacionais reais.
- Central e Kanban compartilham lead e histórico em `lead_messages`; mensagens humanas usam
  a fila de saída e não são simuladas no navegador.
- Envio de orçamento agora prepara a mensagem para revisão; não altera status nem inventa
  validade antes da confirmação real.
- Quatro templates industriais persistidos, sem preço, prazo ou condição inventada.
- Integrações não comprovadas aparecem offline. Teste de IA valida credencial sem enviar
  mensagem. Cards diferenciam online, offline e teste vencido.
- Mudança para modo real ocorre no backend, é auditada e exige pré-flight. O modo real está
  corretamente bloqueado enquanto Claude, webhook de entrada e scheduler estão offline.
- Formulários de empresa só confirmam sucesso depois da persistência. Presets comerciais
  não comprovados foram retirados da tela; o catálogo real é a fonte indicada.
- Equipe e responsáveis usam membros remotos. Tempos e gráficos simulados foram removidos.
- Conteúdo operacional do frontend não exibe a antiga marca. Backup histórico permanece
  restrito em `docs/backup_wayflex_2026-08-26.sql` e não é carregado pelo runtime.

## Backend sincronizado

- `operational-diagnostics` v3, JWT obrigatório.
- `automation-worker` v10, JWT obrigatório.
- `enviar-whatsapp` v4, JWT obrigatório.
- `testar-integracao` v9, JWT obrigatório.
- `configurar-integracao` v11, JWT obrigatório.
- `ana-run` v14 e `webhook-whatsapp` v7 permanecem ativos.
- Correção posterior: `configurar-integracao` v12 e `testar-integracao` v10
  separam salvamento/validação da configuração de webhook Z-API.
- Correção posterior: `testar-integracao` v11 usa o contrato oficial de status
  Z-API sem header extra; validação sem envio, protegida por teste de contrato.
- Lote posterior: `operational-diagnostics` v4 e `configurar-integracao` v13.
  O Dashboard controla Ambiente de Demonstração/Ambiente Real com pré-flight persistido;
  as integrações passaram a ter categoria persistida entre comunicação, prospecção e IA.

Nenhuma mensagem real foi enviada e `sandbox_mode` não foi alterado.

## Validação

- `npm run type-check`: aprovado.
- `npm run type-check:edge`: aprovado.
- `npm run lint`: aprovado, sem warnings.
- `npm run test`: 13 arquivos, 107 testes aprovados.
- `npm run build`: aprovado.

Isso ainda não substitui teste E2E autenticado, WhatsApp/Claude real, concorrência Postgres,
RLS entre duas empresas e QA mobile autenticado.

## Bloqueios verdadeiros restantes

1. Criar scheduler server-side com segredo interno, lease, heartbeat, retry, dead-letter e
   alerta. Não existe credencial segura disponível para concluir isso automaticamente.
2. Homologar o webhook Z-API de entrada e recibos de entrega/leitura com número autorizado.
3. Validar a credencial Claude e o fluxo completo WhatsApp → Ana → fila → provedor.
4. Consolidar funções/stores legados que ainda oferecem caminhos paralelos a `ana-run`.
5. Concluir extração de PDF/DOCX/PPTX/XLSX, OCR, transcrição e busca híbrida. Hoje a Ana usa
   somente texto aprovado e transcrições fornecidas/revisadas.
6. Substituir os presets/localStorage restantes de módulos secundários e executar E2E/RLS.

## Lote mais recente, ainda sem nova publicação

- Commit validado e publicado: `1e2f3f406e0406c3c081d447ebbbb23510690045`.
- Prévia privada atual: Site versão 50.
- Ambiente de Demonstração segue ativo no banco. O Ambiente Real continua bloqueado até a
  pré-verificação aprovar empresa, Ana, kill switch, IA, WhatsApp, webhook e scheduler.
- Nove leads de demonstração confirmados e seus vínculos operacionais foram removidos. O lead
  “Lavanderia / Fabricio Gaspar” foi preservado para **REVISÃO NECESSÁRIA** por ter inbound sem
  marcador explícito de teste. Não há órfãos nas tabelas de lead verificadas.
- Histórico de auditoria é append-only e foi preservado por governança; ele não volta a aparecer
  como lead, conversa, tarefa, execução, proposta ou fila operacional.

O sistema continua **não liberado para comercialização autônoma** enquanto os itens 1 a 3
não forem homologados. Para retomar, começar pelo scheduler seguro ou pela homologação do
webhook em ambiente controlado.

## Lote atual — assistente de ativação de canal e worker

## Lote atual — envio controlado pela Central

- A causa da falha de envio manual em Demonstração foi corrigida no backend: o bloqueio
  ocorria antes da criação do job, o que impedia qualquer teste real de saída.
- A Central agora permite "Enviar teste controlado" após confirmação explícita. A mensagem
  escolhida é a única liberada, fica auditada e expira em cinco minutos; Ana, cadências e
  Ambiente Real permanecem bloqueados.
- Funções implantadas: `enviar-whatsapp` v5 e `automation-worker` v14. A integração de
  saída passa a ser selecionada por `key = whatsapp`, sem risco de usar o registro do webhook.
- Próximo passo humano: em uma conversa individual com lead cadastrado, escrever "Oi",
  usar **Enviar teste controlado**, confirmar e aguardar o processamento do worker. Depois o
  lead deve responder pela conversa individual para concluir a homologação de entrada.

## Lote atual — ativação inteligente

- O Dashboard mantém os botões Demonstração e Ambiente Real, mas o Ambiente Real agora chama
  um orquestrador autenticado no backend em vez de apenas bloquear o clique.
- O orquestrador prepara worker e entrada do WhatsApp quando aplicável, desliga a pausa global
  somente no momento seguro e grava `sandbox_mode=false` apenas após a checagem final completa.
- Quando uma confirmação externa ainda é indispensável, o sistema permanece em Demonstração
  e apresenta uma única próxima ação. Nenhuma ativação ou mensagem externa ocorreu na publicação.

- Commit de implementação: `357bdb98adad24a2eaf2feb0ab75a083b8f1c1a8`.
- A conexão de saída Z-API da WayFlex está confirmada no banco. O antigo aviso foi
  reescrito: ele não pede novamente a credencial; pede a **homologação da entrada de
  respostas**, indispensável para que a Ana reaja ao lead.
- Em **Configurações > Status operacional**, o assistente agora oferece:
  1. **Cadastrar entrada na Z-API**: chama no backend o endpoint oficial
     `PUT /update-webhook-received`, com URL e token protegidos no cofre. Depois, enviar
     mensagem controlada a partir de um número já cadastrado como lead; o callback deve
     aparecer como homologado somente depois de Ana processá-lo.
  2. **Preparar worker 24/7**: não pede chave. Cria token interno por empresa no Vault e
     habilita o cron do servidor. Em até um minuto, o card deve registrar heartbeat. No
     Ambiente de Demonstração, essa verificação não envia mensagens.
- Migration aplicada: `20260909182343_add_server_side_automation_dispatch`; cron ativo:
  `leadai-automation-worker-dispatch` a cada minuto. O dispatcher retornou `0` enquanto
  a WayFlex não ativa a integração scheduler, portanto nenhum efeito externo ocorreu.
- Funções publicadas: `operational-diagnostics` v5, `automation-worker` v11 e
  `webhook-whatsapp` v8. `automation-worker` só aceita sessão administrativa ou token
  interno por organização; o acesso anônimo ao dispatcher de banco foi verificado como
  negado.
- Validação do lote: typecheck frontend/Edge, lint, 112 testes e build aprovados. Restam
  a ação controlada do usuário no novo assistente, o callback Z-API e o primeiro heartbeat
  para evidência de produção. O modo real continua bloqueado até isso ocorrer.
- Prévia privada publicada com sucesso como Site versão 51 a partir do commit
  `a202a3fb9c0c8c33b179d82b377bc9395d42b6ef`.

## Lote atual — diagnóstico objetivo da homologação de respostas

- Evidência consultada após o relato do usuário: a Z-API aceitou o cadastro da entrada às
  `2026-09-09T18:32:29.026Z`, mas não há `webhook_events`, `channel_inbound_events`,
  mensagens nem `agent_runs` novos após esse momento. Portanto, a mensagem de teste ainda
  **não chegou ao endpoint do WayFlex**; não é falha da Ana, do modo Demo ou uma nova
  exigência de credencial Z-API.
- `operational-diagnostics` v6 adiciona diagnóstico de entrada baseado no servidor: sem
  callback após o cadastro, callback sem lead correspondente, callback não suportado,
  processamento pendente ou homologado. O pré-flight usa esse diagnóstico em vez de uma
  frase genérica.
- A interface mostra apenas o lead real disponível para teste, mascarando o telefone para os
  quatro últimos dígitos, e separa “Atualizar diagnóstico” de “Recadastrar entrada”. Nenhum
  lead fictício é criado e o Ambiente Real continua bloqueado até uma resposta efetivamente
  recebida, vinculada e analisada.
- Validação local: type-check frontend/Edge, lint, build e 113 testes aprovados. A função
  publicada foi confirmada como `operational-diagnostics` v6, JWT obrigatório.

## Consolidação oficial seletiva — 09/09/2026

- O projeto atual do Work é a versão principal. A branch
  `stabilize/production-readiness-2026-09-09` foi comparada por módulo e não foi aplicada por
  cima do projeto.
- Foram incorporados somente contratos comprovados: fontes das funções já implantadas,
  migrations ausentes no repositório, pipeline canônico, matching de WhatsApp, handoff atômico,
  RLS de mensagens/propostas e contrato de orçamentos.
- `company_settings.sandbox_mode` permaneceu `true`; o gate de Ambiente Real recusou a mudança
  em teste controlado porque a entrada WhatsApp ainda não está homologada.
- O worker não é mais pendência: cron e heartbeat server-side estão ativos. O último callback
  de teste foi de grupo e foi corretamente classificado como `non_direct_conversation`.
- Evidência consolidada: typecheck frontend/Edge, lint sem warnings, 115 testes, build, criação
  transacional de lead, telefone, pipeline, handoff, agenda, orçamento, ambiguidade WhatsApp,
  bloqueio Demo/Real e RLS multiempresa aprovados.
- Relatório completo: `docs/AUDITORIA_CONSOLIDACAO_2026-09-09.md`.
- Próxima ação segura: publicar este checkpoint e, em Demo, receber uma mensagem individual de
  um lead cadastrado para validar webhook → matching → histórico → `ana-run` exatamente uma vez.

## Ambiente Real único e limpeza segura — 10/09/2026

- O painel não oferece mais modo ou botão de Demonstração. `company_settings.sandbox_mode`
  continua apenas como proteção interna: enquanto estiver ligado, o painel informa que o
  Ambiente Real está em preparação e o backend bloqueia saídas automáticas.
- A validação bem-sucedida da Z-API registra a integração como pronta e, com empresa ativa e
  fila sem itens antigos, grava `sandbox_mode=false`. Assim a Central de Atendimento pode operar
  no Ambiente Real sem depender de localStorage. A tela diferencia claramente comunicação manual
  liberada de automações da Ana ainda pendentes.
- A ação **Verificar preparação** permanece útil depois da ativação do canal: ela continua
  tentando configurar o webhook de entrada e o worker 24/7, em vez de parar por o Ambiente Real
  já estar habilitado para comunicação.
- A migration `20260910134209_purge_selected_test_leads` e a função autenticada
  `cleanup-test-leads` removem, dentro de uma transação, o grafo completo de leads de teste
  previamente selecionados. O painel mostra os candidatos, exige seleção e confirmação e nunca
  apaga dados ambíguos automaticamente.
- Funções implantadas: `testar-integracao` v13, `operational-diagnostics` v11 e
  `cleanup-test-leads` v1, todas com JWT obrigatório. Nenhuma mensagem foi enviada e nenhuma
  exclusão foi disparada durante este lote.

## Teste simples de saída WhatsApp — 10/09/2026

- O teste da Z-API não depende mais de criar lead, preparar worker ou esperar a fila. Em
  **Configurações > Canais, APIs e fontes > WhatsApp > Testar envio**, informar um número sob
  controle do operador e uma mensagem. O backend confirma a instância e envia uma mensagem real
  diretamente; a confirmação do provedor e apenas os quatro últimos dígitos ficam auditados.
- Para uma mensagem manual da Central, o job continua sendo criado e auditado primeiro, mas a
  Central solicita o despacho do job específico imediatamente. O cron continua como recuperação
  segura caso essa tentativa não termine.
- Isto homologa somente a saída do WhatsApp. Para a Ana receber e responder, ainda é necessário
  cadastrar um lead com o mesmo número e enviar uma resposta individual para o webhook.

## Configuração publicada da Ana e cadência segura — 10/09/2026

- A tela **Configurar a Ana** agora publica uma versão ativa por organização. Essa versão é a
  fonte de instruções, tom, canais permitidos, horários, cadência, limite diário por lead e
  limiar de transferência. Publicar não liga canais, não libera o Ambiente Real e não envia
  mensagens.
- `ana-run` é a única autoridade automática. Os caminhos legados no navegador deixaram de
  disparar respostas ou follow-ups automáticos; a configuração não tem fallback para saudação
  genérica. Cada saída automática guarda a versão que a gerou e é bloqueada se essa versão
  deixar de ser a ativa. Orçamentos, preço, prazo, desconto e negociação exigem revisão humana.
- Foram aplicadas no projeto Supabase oficial as migrations de reconciliação de handoff e
  mensagens humanas, reserva de política de cadência e reserva idempotente de teste direto
  WhatsApp. As funções de configuração, Ana, worker, integração e webhook foram publicadas
  nas versões correspondentes deste checkpoint.
- As chaves de IA continuam no Vault: a interface só lê provedor, modelo e estado público.
  Selecionar ou salvar um modelo não comprova uma chamada real ao provedor.
- Validação local deste checkpoint: type-check do frontend e das Edge Functions, lint, 157
  testes e build aprovados. Não foi feito envio real, teste de modelo, mudança de
  `sandbox_mode` ou exclusão de dados.
- Limites conhecidos: recibo de entrega/leitura que chegar antes da persistência da aceitação
  do provedor pode exigir callback repetido para reconciliação; há uma janela residual entre a
  última revalidação do worker e a chamada ao provedor; e timeout já agendado não é rearmado
  retroativamente quando a configuração da Ana muda. Se a aceitação remota ocorrer e a
  persistência local falhar, o job fica em reconciliação até tratamento operacional. Esses
  pontos não autorizam afirmar homologação externa ponta a ponta.

## Layout Wayflex Executive Light — 10/09/2026

- A linguagem visual do Site foi alinhada à referência fornecida: base branca/cinza muito clara,
  verde institucional, bordas finas, sombras discretas e densidade de dashboard executivo. A
  mudança reaproveita componentes, rotas e regras existentes; não houve redesenho de domínio.
- O menu global agora comunica o fluxo comercial: **Começo · captar** (Busca e Leads),
  **Meio · atender** (Kanban, Central e Agenda), **Final · fechar** (Orçamentos, Funil e
  Relatórios) e Administração. A busca lateral filtra telas reais e o topo usa breadcrumb.
- O Dashboard ganhou atalhos de começo/meio/final e cartões de recursos que consultam
  `operational-diagnostics`: Ambiente Real, WhatsApp Z-API, entrada, Ana, worker e fontes. O
  rótulo Ativo nunca é decorativo; durante consulta aparece “Consultando”.
- Configurações inicia em Status operacional e separa **Canais** (WhatsApp/Z-API), **APIs**
  (IA e prospecção) e **Fontes** (ativação na Busca de Leads). O teste Z-API permanece somente
  no cartão WhatsApp. Conexão validada e uso ativo são exibidos como fatos diferentes.
- Regressão adicionada para impedir que integração conectada porém desativada apareça ativa.
  Type-check frontend/Edge, lint, 14 arquivos de teste/127 verificações e build passaram.
- Nenhum dado do Supabase, segredo, lead ou mensagem foi alterado durante este lote. A inspeção
  visual autenticada por Computer Use ficou pendente por falha local de permissão ao carregar o
  módulo do navegador; a referência foi analisada pela imagem pública da página compartilhada.
- O código foi registrado no commit `83ffd1001f8c6777a85f3aec304e1434897d5d8e` e publicado
  com sucesso no Site oficial como versão 59, sem mudar a audiência existente.

## Recuperação do Supabase no Site estático — 10/09/2026

- A mensagem “Configuração necessária” não indicava credencial ausente no Site nem erro do
  projeto Supabase. A URL pública e a chave publicável existentes foram confirmadas contra
  `thgzrkppouoevapjquyu`; o problema era que a versão estática anterior havia sido gerada sem
  essas variáveis no processo Vite.
- O artefato corretivo é construído com os valores públicos do ambiente do Site. Eles entram
  somente no bundle de navegador, como exige o cliente Supabase, e não em arquivos `.env`, Git,
  respostas, logs, Vault de frontend ou qualquer chave privada.
- Antes de publicar, foram aprovados type-check frontend/Edge, lint, 14 arquivos/127 testes,
  o build e a verificação de presença da URL/chave publicável no artefato. Nenhuma tabela,
  mensagem, lead, integração ou segredo foi alterado.
- A correção foi publicada com sucesso no Site oficial como versão 61. A próxima validação é
  somente atualizar a página autenticada e confirmar a abertura normal do CRM.

## Configuração pública resiliente e catálogo oficial da Ana — 10/09/2026

- A nova ocorrência de “Configuração necessária” foi confirmada como falha de empacotamento:
  as duas variáveis públicas do ambiente do Site correspondiam ao projeto Supabase
  `thgzrkppouoevapjquyu`, mas o bundle estático ainda podia nascer sem elas. O Worker agora
  entrega `/runtime-config.js` com cache `no-store`; o navegador lê URL e chave publicável em
  tempo de execução. O manifesto de hosting foi convertido de estático para Worker para que a
  rota dinâmica seja atendida em produção. O pacote foi verificado sem URL real nem chave
  publicável gravadas.
- A migration `20260910195000_refresh_wayflex_official_ana_catalog` foi aplicada ao projeto
  oficial. Ela aposentou as 7 memórias gerais v1 e ativou 61 fontes rastreáveis da Wayflex:
  17 catálogos, 18 segmentos, 18 famílias de acessórios e 8 fontes institucionais, de
  qualificação, respostas e limites. Cada item guarda a página oficial de origem e, nos
  catálogos, a referência visual por texto alternativo; nenhuma imagem externa foi baixada.
- `ana-run` v21 foi publicado. A recuperação lexical agora inclui URL-fonte e referência visual
  no contexto, e perguntas sobre catálogos, acessórios e componentes falham para revisão quando
  não houver fonte correspondente. Preço, prazo, estoque, certificação, laudo, composição e
  compatibilidade continuam bloqueados para confirmação humana/técnica.
- Validação local: type-check frontend/Edge, lint sem warnings, 15 arquivos/159 testes, build
  e smoke test do Worker com valores públicos simulados passaram. Não houve envio de WhatsApp,
  chamada a modelo, alteração de `sandbox_mode`, exclusão de lead nem download de mídia.
- A publicação final foi concluída no Site oficial como versão 65. A verificação no navegador
  confirmou que a rota inicial agora abre a tela de login, em vez de “Configuração necessária”.
  Não foi feito login, envio, execução de modelo ou interação comercial durante essa checagem.
- Pela tela autenticada **Configurar a Ana**, a versão ativa foi publicada como v13 com sete
  itens de resumo: site oficial, 17 catálogos, 18 segmentos, 18 famílias de acessórios,
  materiais/qualificação/limites, páginas-fonte e a regra de validação humana/técnica. A
  conferência no banco confirmou a versão ativa e manteve somente WhatsApp como canal permitido;
  publicar a configuração não habilitou o canal nem enviou mensagens.

## Clareza do botão Publicar configuração da Ana — 10/09/2026

- A investigação autenticada confirmou que a configuração v13 é carregada e que `ana-ia` está
  ativa. O botão da etapa 6 aparecia bloqueado porque não havia alteração pendente, mas o rótulo
  “Publicar configuração” não explicava a condição e fazia o fluxo parecer com defeito.
- A etapa agora informa a versão já publicada, mostra “Altere algum campo para publicar” no
  estado sem mudança e muda para “Publicar alteração” somente após uma edição. Assim o operador
  sabe exatamente como criar a próxima versão sem gerar versões duplicadas no banco.
- Foram aprovados type-check frontend/Edge, lint sem warnings, 15 arquivos/159 testes e build.
  A reprodução visual confirmou o estado bloqueado sem edição e o botão habilitado após alteração
  local; nenhum dado, mensagem, provedor IA ou modo operacional foi alterado durante o teste.
- A correção foi publicada no Site oficial como versão 68, preservando a audiência privada.

## Ana automática ativa após revalidação da IA — 10/09/2026

- A tela de Dashboard mostrava **Ana automática · Inativo** apesar de Ambiente Real, WhatsApp,
  entrada, worker e política publicada estarem ativos. A inspeção confirmou que a verificação
  da credencial do provedor de IA havia vencido, o que mantém a automação bloqueada por segurança.
- Foi executada a validação autenticada da credencial de IA. Ela confirmou acesso ao provedor sem
  enviar mensagem, executar o modelo, alterar a configuração comercial ou disparar a fila.
- Após recarregar o Dashboard, o backend confirmou **Ana automática · Ativo**: IA, canal,
  entrada, worker e políticas foram confirmados. Isso não substitui homologação de uma resposta
  real de modelo ou de entrega/leitura externa.

## Limpeza explícita de lead para novo teste — 10/09/2026

- Mediante solicitação explícita do operador, foi identificado um único lead associado ao
  telefone fornecido e a exclusão foi executada pela transação de limpeza, delimitada à empresa
  Wayflex e ao ID confirmado.
- A validação posterior confirmou ausência do lead e de seus vínculos operacionais: mensagens,
  filas, execuções da Ana, automações, Central, Kanban, agenda, comercial e identidades de
  canal/matching. O telefone pode ser cadastrado novamente para um teste limpo.
- `audit_logs` e `domain_events` são append-only no ambiente implantado e foram preservados como
  evidência de governança. Essas retenções não são usadas por matching, atendimento, fila ou
  automação. Não houve envio de mensagem, alteração da Ana, integração ou `sandbox_mode`.

## Segunda limpeza do lead Fabricio Gaspar — 11/09/2026

- O cadastro recriado com o telefone informado foi localizado de forma única e excluído pela
  transação operacional oficial, limitada à organização Wayflex.
- A verificação confirmou zero lead, mensagem, fila, execução da Ana e vínculo de canal restantes.

## Sincronização do heartbeat legado — 11/09/2026

- A telemetria operacional atual já usa a integração `scheduler`, atualizada pelo worker server-side. A tabela histórica `automation_heartbeats`, porém, permanecia em `never` desde agosto e podia induzir relatórios legados a indicar uma falha inexistente.
- A migration `20260911110000_sync_legacy_scheduler_heartbeat` instala um trigger que espelha toda nova confirmação de `integrations.last_success_at` do scheduler para `automation_heartbeats.automation_engine`. O registro existente foi preenchido com a última execução confirmada.
- A verificação posterior confirmou trigger instalado e `automation_engine` em `success`, sem erro. Nenhuma mensagem, lead, configuração da Ana ou modo operacional foi alterado.

## Dashboard operacional sem atalhos redundantes — 11/09/2026

- O Dashboard deixou de repetir a navegação do menu. A área principal agora prioriza indicadores de leads, handoffs, orçamentos, estado real de APIs/canais, fila, Kanban e alertas operacionais.
- Os agrupamentos do menu foram renomeados para Prospecção, Atendimento e Comercial. Não há mais rótulos de começo, meio ou fim no layout.

## Dashboard compacto — 11/09/2026

- Somente a apresentação visual do Dashboard foi reduzida: cards, barras, listas e blocos de status usam menos altura e espaçamento, preservando os mesmos dados, estados, filtros, rotas e regras.
- Validação local: type-check do frontend e Edge Functions, lint sem warnings, 15 arquivos/159 testes e build do artefato do Site passaram.
- Nenhum dado do Supabase, configuração, integração, mensagem, fila ou automação foi alterado. A inspeção visual autenticada permanece pendente nesta rodada.
- PUBLICADO: Site oficial versão 70, commit `3862ca243a5be0645e8dbfacb4b45c6282a7f2c2`, com deploy confirmado como succeeded e audiência existente preservada.

## Busca Apify — execução real e revisão fiel — 11/09/2026

- Causa confirmada: `prospectar-leads` tentava inserir em `prospecting_runs` sem os campos obrigatórios `estimated_records` e `quote_expires_at`. O banco recusava a criação antes de qualquer chamada à Apify; por isso não havia execução, cache ou lead para exibir.
- A função publicada `prospectar-leads` v6 agora grava esses campos com o volume solicitado e o instante da execução, mantendo a consulta direta sem confirmação/cobrança inventada.
- A Busca manual não simula mais enriquecimento, Ana ou remoção de duplicados por temporizadores. Em falha, ela permanece nos filtros e mostra o erro; em retorno vazio real, a revisão mostra a ausência de resultados sem tabela enganosa. O mapeamento também reconhece os campos reais retornados pelo provedor.
- Validação local: type-check frontend/Edge, lint, 15 arquivos/160 testes e build passaram. Nenhuma nova busca Apify foi disparada durante a correção.
- PUBLICADO: Site oficial versão 71, commit `e551635f180c4606ccedf27dac70393b443eb4b6`, com deploy confirmado como succeeded e audiência existente preservada.

## Busca de Leads — mapa, revisão e execução retomável — 11/09/2026

- A busca manual agora usa quatro etapas reais: **Fonte**, **Filtros**, **Revisão** e **Importação**. O seletor mantém fontes de prospecção não validadas visíveis, mas bloqueadas com orientação; cidade, UF, raio de cobertura, tipo/nicho, porte, contatos e quantidade são definidos antes da consulta.
- A revisão só abre depois de uma resposta final do provedor. Ela mostra lista selecionável, duplicados, contatos, contagem real de WhatsApp/e-mail e mapa OpenStreetMap dos resultados que vierem com latitude e longitude. Resultado sem coordenada continua na lista; nenhum marcador ou localização é inventado.
- A importação exige seleção explícita e só então cria a lista e navega para **Leads**. Ela não envia apresentação, não aciona a Ana e não dispara WhatsApp.
- Causa adicional confirmada: o endpoint anterior esperava a finalização da Apify na mesma requisição. Duas execuções ficaram sem `provider_run_id` e não podiam ser retomadas. Esses dois registros específicos foram preservados e marcados como `legacy_provider_start_timeout`; nenhum lead, cache ou dado comercial foi removido.
- `prospectar-leads` v8 agora inicia a execução rapidamente, grava o identificador do provedor e é consultado pelo painel até a conclusão. Somente após `SUCCEEDED` a função lê o dataset, grava o cache e conclui a execução. Falha/cancelamento do provedor não é apresentado como resultado vazio.
- A configuração pública atual da fonte indica Actor Google Maps e nenhuma Task. Se um `apify_http_400` voltar a ocorrer, o cartão da Apify apresenta **Corrigir Actor Google Maps**: a ação server-side preserva o token no Vault, troca somente o Actor e pede uma nova validação antes de habilitar a fonte. `configurar-integracao` v16 e `prospectar-leads` v8 estão ativos, ambos com JWT obrigatório.
- Validação local: type-check frontend/Edge, lint, build e 15 arquivos/163 testes passaram. Não foi iniciada nova busca externa pelo agente, não houve importação de leads, mensagem, alteração da Ana ou exposição de segredo. A validação visual autenticada por Computer Use ficou pendente porque o módulo local do navegador recusou carregamento por permissão.
- PUBLICADO: Site oficial versão 72, commit `78f41985b5c38b799849b503800cb7c4d0c293ad`, com deploy confirmado como `succeeded` e audiência customizada preservada.

## Dashboard — Canais e APIs compacto — 11/09/2026

- O card **Canais e APIs** foi reduzido a uma grade compacta com o nome de cada conexão e um
  único estado: **Conectado** ou **Desconectado**. Foram removidos provedor, data de teste e
  estados intermediários apenas dessa apresentação.
- O dado não é local nem decorativo: o Dashboard continua a consumir `operational-diagnostics`
  autenticado. O backend só entrega `online` quando a integração está conectada, habilitada,
  sem pausa/erro e com validação dentro de 24 horas. O card traduz qualquer outro estado para
  **Desconectado**.
- A consulta somente-leitura ao projeto Supabase oficial foi concluída pelo MCP. Nenhuma
  integração, dado, segredo, mensagem, fila ou automação foi alterado nesta rodada.
- Validação: type-check frontend/Edge, lint sem warnings, 15 arquivos/163 testes, build Vite e
  artefato Worker aprovados. QA visual autenticado não foi executado nesta rodada.
- PUBLICADO: Site oficial versão 73, commit `fb8fce803d77ac3235e75f22f9d82586786bc5a1`, com
  deploy confirmado como `succeeded` e audiência customizada preservada.

## Dashboard — conversas reais em tempo real — 11/09/2026

- O Dashboard passou a exibir um gráfico horizontalmente rolável das últimas 24 horas de
  conversas. Ele agrega exclusivamente `lead_messages` carregadas pela Central: separa
  recebidas de enviadas, exclui notas internas e mostra estado vazio quando não houver mensagem
  operacional no período. Não há seed, estimativa ou série de conteúdo inventado.
- A migration `20260911180000_enable_lead_messages_realtime` foi aplicada no projeto Supabase
  oficial. A verificação posterior confirmou `public.lead_messages` na publicação
  `supabase_realtime`; o assinante do Dashboard é filtrado por `organization_id` e recarrega a
  fonte operacional ao receber INSERT, UPDATE ou DELETE autorizado por RLS.
- O selo “Ao vivo” só é apresentado depois de `SUBSCRIBED`. Falha, timeout ou ausência de sessão
  deixam explícito que a consulta permanece real, mas que a página deve ser atualizada até a
  conexão em tempo real voltar.
- Validação local: type-check frontend/Edge, lint sem warnings, 16 arquivos/165 testes, build
  Vite e artefato do Site aprovados. O teste novo cobre a janela de 24 horas, direção das
  mensagens e exclusão de nota interna. Não houve envio de mensagem, mudança de integração,
  lead, automação ou configuração comercial.
- PUBLICADO: Site oficial versão 74, commit `1a2f0d1c40e20be475dd2eff34463228fe0a550e`, com
  deploy confirmado como `succeeded` e audiência customizada preservada. A inspeção visual
  autenticada não foi possível porque o runtime local de Computer Use falhou antes de acessar a
  janela por permissão; não declarar essa checagem como concluída.

## Equipe — criação direta de acesso administrativo — 14/09/2026

- A aba **Configurações > Equipe** passou a oferecer **Criar acesso** além do convite por e-mail.
  A ação usa a Edge Function `team-members` v2, que exige sessão autenticada e papel de
  administrador/owner na organização ativa.
- O backend valida nome, e-mail, papel e comprimento da senha, cria o usuário por
  `auth.admin.createUser` somente no servidor, confirma o e-mail e registra o membro ativo na
  mesma organização. A senha não é incluída em audit logs, eventos, respostas ou repositório.
- Se a associação organizacional falhar, o usuário recém-criado é removido para evitar uma conta
  órfã. E-mails já cadastrados retornam um erro específico, sem alterar permissões existentes.
- Validação local: type-check do frontend e das Edge Functions, lint e build Vite aprovados. O
  Vitest não inicializou neste worktree porque o esbuild resolve a dependência compartilhada em
  uma pasta sem permissão de leitura. A validação visual autenticada permanece pendente: o runtime
  de Computer Use falhou por permissão antes de abrir o navegador.

## Equipe — correção do vínculo organizacional de Juca — 14/09/2026

- Causa comprovada: `auth.admin.createUser` acionava `private.handle_new_auth_user` antes de existir
  um `organization_invites` para a WayFlex. O gatilho tratava o cadastro como onboarding comum,
  criava uma organização pessoal chamada Juca e por isso o membro não aparecia na equipe WayFlex.
- `team-members` v4 prepara o convite organizacional antes de criar ou convidar o usuário, bloqueia
  convites simultâneos para outra organização e restaura o estado anterior quando o Auth recusa a
  criação. A função preserva as proteções de autoexclusão presentes na v3.
- O cadastro real `juca@wayflex.ind.br` foi reparado de forma delimitada: usuário confirmado,
  perfil ativo na WayFlex, papel `administrador`, status `active` e um único vínculo organizacional.
  A organização de onboarding incorreta tinha zero leads, mensagens ou eventos; seu vínculo foi
  removido. O registro de auditoria imutável e os defaults inacessíveis foram preservados.
- A inspeção autenticada confirmou Juca e fabricio na lista de **Equipe e Acessos**. Type-check
  frontend/Edge, lint, 16 arquivos/172 testes e build passaram. A senha não foi consultada,
  registrada nem alterada; o login de Juca permanece para confirmação pelo próprio usuário.

## Mapa visual interativo de Configurar a Ana — 13/09/2026

- A navegação linear de **Configurar a Ana** foi reorganizada como um mapa de decisão moderno,
  mantendo os seis formulários, estados e ações existentes. Cada bloco seleciona sua etapa; não
  houve alteração no payload, na persistência, no botão de publicação ou na autoridade de
  `ana-run`.
- O mapa mostra Ana como IA sob controle humano, empresa/público, oferta permitida e Base
  aprovada, os grupos oficiais de 17 catálogos, 18 segmentos e 18 famílias de acessórios,
  conversa/qualificação, as decisões de reunião/orçamento e cadência/handoff, e a revisão final
  de canais/publicação.
- O pipeline canônico é exibido como orientação: Novo → Apresentado → Qualificando → Reunião →
  Orçamento → Ganho/Perdido. O estado visual usa somente a versão carregada e alterações locais
  pendentes; não declara canal, automação ou envio como ativo.
- A ponta oficial da versão 74 foi integrada por merge, sem força ou rollback. Type-check frontend
  e Edge Functions, lint sem warnings, 16 arquivos/165 testes e build de produção passaram no
  conjunto final. Nenhuma mensagem, lead, tabela, integração, segredo ou configuração da Ana foi
  alterada durante este delta exclusivamente visual.
- PUBLICADO: Site oficial versão 75, commit `0e8221bb4263d42c6c98652fcfb42d929ba09899`,
  com deploy confirmado como `succeeded` e audiência owner-only preservada. A inspeção visual
  autenticada confirmou o mapa, a configuração v17 e a navegação dos blocos até a etapa 6, sem
  editar ou publicar qualquer campo operacional.

## Restauração do layout anterior de Configurar a Ana — 13/09/2026

- O mapa visual da versão 75 foi removido após rejeição explícita do operador. A tela voltou à
  navegação compacta anterior de seis etapas.
- A restauração foi limitada ao JSX e CSS introduzidos pelo mapa. A comparação desses dois
  arquivos com a versão 74 ficou sem diferença; formulário, persistência, publicação, Supabase,
  `ana-run`, Dashboard, Busca/Apify e Realtime foram preservados.
- Type-check frontend/Edge, lint sem warnings, 16 arquivos/165 testes e build de produção
  passaram. Nenhum dado, mensagem, integração, segredo ou configuração da Ana foi alterado.
- PUBLICADO: Site oficial versão 76, commit `0b7892bd048c47d37be1d7985b9cfafaa61d8d26`,
  com deploy confirmado como `succeeded` e audiência owner-only preservada.

## Segurança de contato e autonomia controlada da Ana — 13/09/2026

- O fluxo principal de prospecção expõe somente **Apify** e as entradas manuais existentes. O
  backend legado foi preservado, sem criar fonte nova nem apagar configuração.
- A pontuação de captura foi separada em **aderência**, **contactabilidade** e **engajamento**;
  a origem do registro e a explicação do score passam até `leads`. Um telefone móvel não é mais
  considerado WhatsApp por formato.
- Busca, cadastro manual, importação, Leads e Kanban só ativam a Ana quando o canal foi confirmado,
  a autorização foi marcada e a origem dessa autorização foi registrada. O backend repete essa
  guarda em `ana-run`, `automation-worker` e no retorno do handoff.
- Mensagem individual recebida do próprio lead registra autorização de contato por iniciativa
  do destinatário. Grupo, ambiguidade ou direção inválida continuam bloqueados.
- `ana-run` combina conteúdo lexical aprovado e `match_knowledge_chunks` quando existir embedding.
  A instalação tem 61 documentos/chunks ativos e zero embeddings na verificação desta rodada;
  nenhuma reindexação paga foi iniciada sem autorização do operador.
- A ação `agendar_reuniao` exige horário explícito com offset, intervalo futuro válido,
  disponibilidade do Google Calendar e chave de idempotência. A Ana só confirma depois do evento;
  qualquer falha transfere para humano.
- O Registro do Sistema mostra jobs e saídas recentes por mensagem. Aceite, entrega e leitura não
  são tratados como sinônimos.
- Seis jobs históricos continham `provider_message_id` da Z-API e erro
  `provider_accepted_reconciliation_required`. A causa foi corrigida nas funções SQL atômicas;
  os seis foram reconciliados para `processed/sent` sem chamada ao provedor. A verificação posterior
  encontrou zero jobs em reconciliação. `automation-worker` v19 repete a rotina sem reenvio.
- Migrations aplicadas: `20260913173405`, `20260913174113`, `20260913174227`, `20260913174320`,
  `20260913174711` e `20260913174751`. As duas correções intermediárias de reconciliação foram
  preservadas porque já fazem parte do histórico aplicado; a última contém a definição válida.
- Validação: type-check frontend/Edge, lint sem warnings, 16 arquivos/168 testes, build e testes
  SQL transacionais com rollback para fila idempotente, aceite, entrega, handoff e retorno à Ana.
  Não houve busca Apify, mensagem, chamada de IA ou evento Calendar real nesta rodada.
- Referências operacionais: `docs/audit/saturday-regression-analysis.md`,
  `docs/DIAGNOSTICO_MENSAGENS.md` e `docs/RELATORIO_PRONTIDAO_2026-09-13.md`.

## Operação automática e Central de Alertas Comerciais — 13/09/2026

- **Configurações → Ana → Operação automática** agora governa a rotina existente em três modos:
  Simulação, Supervisionado e Automático. O estado inicial aplicado no banco é desativado e em
  Simulação; nenhum provedor foi chamado durante a implantação.
- A configuração persiste agenda, fuso, dias, ICP, regiões, canais mínimos, score, limites diário
  e mensal, distribuição, alertas, resumo diário e autorização explícita para prospecção paga.
  O botão **Pausar tudo** reutiliza o kill switch operacional já existente.
- `automation-worker` mantém uma fila idempotente em `prospecting_schedule_runs`, respeita limites,
  inicia/retoma o Apify, deduplica importações e distribui em rodízio quando configurado. No modo
  supervisionado, a busca e a resposta da Ana permanecem em aprovação; no automático, somente
  canal explicitamente informado pela fonte e score aprovado podem seguir para `ana-run`.
- `ana-run` continua como única autoridade de decisão e passou a persistir a qualificação comercial
  estruturada. Reunião, orçamento, lead quente, interesse, pedido humano e falha geram eventos
  objetivos e notificações auditáveis para o responsável.
- O sino usa `notifications` com Realtime e o Dashboard ganhou **Atenção do vendedor** com Responder
  agora, Leads quentes, Reuniões e orçamentos, Acompanhamentos de hoje e Sem resposta há muito tempo.
  O worker produz um resumo diário por carteira do vendedor no horário configurado.
- Migrations aplicadas no projeto oficial: `ana_autonomous_operation_and_commercial_alerts`,
  `commercial_alert_preferences`, `fix_commercial_alert_app_roles` e
  `index_ana_operation_foreign_keys`. Edge Functions publicadas: `ana-operations` v1, `ana-run` v24,
  `prospectar-leads` v11 e `automation-worker` v22.
- Validação sem efeitos externos: teste SQL transacional com rollback confirmou evento → notificação;
  endpoints rejeitaram chamadas sem autenticação; type-check frontend/Edge, lint, testes de contrato
  e build foram executados. WhatsApp, Apify, modelo de IA e Calendar reais não foram chamados.

## 2026-09-14 — Exclusão definitiva de membro da equipe

- **Configurações → Equipe e responsáveis → Excluir** agora remove definitivamente a identidade
  não compartilhada: credenciais, sessões, perfil, papéis, preferências, notificações e associação
  à organização deixam de existir. O mesmo e-mail pode ser criado novamente depois.
- Registros comerciais da empresa não são apagados. Leads, tarefas, propostas, handoffs, auditorias
  e históricos de prospecção antes associados ao membro permanecem na organização com a referência
  de responsável vazia, prontos para redistribuição.
- A remoção recusa a própria conta do operador, preserva a regra de que deve existir outro
  administrador e bloqueia a exclusão se a identidade também pertence a outra organização.
- Migration aplicada no Supabase oficial: `20260914203238_member_identity_deletion`.
  Ela tornou anuláveis as 13 referências de identidade que antes bloqueavam a exclusão e não removeu
  nenhum usuário ou dado comercial nesta implantação.
- Edge Function publicada: `team-members` v3. Foram adicionados testes de regressão para exclusão
  de identidade não compartilhada e bloqueio de conta compartilhada. Type-check frontend/Edge,
  lint e build passaram; o Vitest não iniciou por erro local de permissão no diretório compartilhado
  de dependências, antes da execução de qualquer caso de teste.

## 2026-09-16 — Base de Leads, site/WhatsApp e permissões por usuário

- **Leads** recebeu uma Base de Leads administrativa com filtros de status de atividade,
  responsável e busca. A exclusão é definitiva apenas para itens selecionados depois que o
  administrador digita `EXCLUIR N LEADS`; o backend reaproveita a transação já aprovada para
  remover mensagens, filas, execuções, vínculos de canal, Kanban, propostas e demais conexões
  operacionais. Nenhum registro foi removido durante a implantação.
- **Canais > WhatsApp** agora contém a Entrada do site. O administrador informa somente o número
  público já conectado à Z-API, rótulo/origem e mensagem inicial; o sistema produz um link
  `wa.me`. O marcador público no texto permite que o webhook crie o primeiro lead do visitante,
  registre a mensagem na Central e use exclusivamente `ana-run`. Sem marcador válido, ou em caso
  de identidade ambígua, o matching continua bloqueado e nenhum lead é criado.
- **Equipe e responsáveis** ganhou matriz de permissões individuais. Ela cobre Leads, conversas,
  prospecção, propostas, configurações, entrada do site, equipe e auditoria; o backend, RLS e UI
  usam a mesma matriz. Administradores preservam acesso completo. Não há chave Z-API, service
  role, token de IA nem qualquer outro segredo nessas telas ou no Git.
- Supabase oficial: migration `20260916205958_lead_governance_permissions_and_site_whatsapp`;
  Edge Functions `team-members` v6, `lead-governance` v1, `site-whatsapp-entry` v1 e
  `webhook-whatsapp` v17, todas ativas. A consulta administrativa retornou zero fora do contexto
  de backend e duas linhas para a organização com dados quando avaliada como service_role.
- Validação: type-check frontend/Edge, lint sem warnings e build/artefato do Site passaram. Foram
  acrescentados contratos para matriz de permissões e entrada pelo site. O Vitest permanece
  bloqueado antes de iniciar pelo `node_modules` ligado a diretório sem permissão local. Não houve
  envio/recebimento real de WhatsApp, chamada de IA, mudança de Z-API ou ação sobre leads.

## 2026-09-17 — Exclusão definitiva de Leads: confirmação compatível com o Site

- Causa confirmada no Site autenticado: o botão de **Gestão da base** chamava `window.prompt`;
  o runtime de hospedagem bloqueia essa API com `prompt() is not supported`, antes de qualquer
  chamada a `lead-governance` ou alteração no Supabase.
- A confirmação agora é um diálogo interno. Ele exige exatamente `EXCLUIR N LEADS`, mantém o
  botão definitivo desabilitado até a frase conferir e envia a mesma frase à validação server-side.
  Nenhum lead foi removido durante diagnóstico, implementação ou validação.
- Foram identificados dois pontos de limpeza: o gerenciador geral em **Leads** e o painel legado
  **Limpar leads de teste** em Configurações. O segundo é restrito a candidatos de teste, usa
  `cleanup-test-leads` e a transação compartilhada; foi mantido para evitar mudar a política de
  limpeza de testes sem autorização. Recomenda-se consolidar a UI em uma decisão futura.
- Validação local: type-check frontend, lint, teste direto da frase de confirmação e build do
  artefato do Site aprovados. Vitest não iniciou porque a junção local de `node_modules` aponta
  para uma pasta sem permissão de leitura. Falta publicar e validar visualmente o diálogo sem
  confirmar uma exclusão.

- PUBLICADO: Site oficial versão 82, commit `0c63c294dc226beb4bdeaa2af26a9618785cf680`, com
  deploy confirmado como `succeeded` e audiência pública existente preservada. A inspeção
  autenticada abriu o diálogo para um lead selecionado, exibiu a frase exigida e manteve a ação
  definitiva desabilitada; o diálogo foi cancelado sem remover dados.

## 2026-09-17 — Reserva do teste direto Z-API

- Causa confirmada para `whatsapp_test_reservation_failed`: depois de validar a instância, a Edge
  Function chamava a reserva idempotente e o PostgreSQL recusava `pg_catalog.coalesce/nullif`.
  Portanto, o fluxo falhava antes de criar a auditoria de reserva e antes de chamar `/send-text`.
- A migration aplicada no Supabase oficial é
  `20260917150914_fix_whatsapp_direct_test_reservation_special_forms`. Ela usa `coalesce` e
  `nullif` como formas especiais do PostgreSQL, mantendo locks, idempotência, `security invoker`
  e o grant apenas para `service_role`.
- A prova transacional devolveu `reserved` e foi revertida; a consulta posterior retornou zero
  registros de auditoria para o request de prova. Nenhuma mensagem, fila, lead, segredo ou chamada
  Z-API foi gerada nesta correção.
- Validação local: type-check frontend/Edge, lint, contrato de migration e build/artefato do Site
  aprovados. O Vitest não iniciou porque a junção local de `node_modules` leva a um diretório sem
  permissão de leitura pelo esbuild. Falta somente o teste externo controlado, no painel
  **Configurações > Canais > WhatsApp**, para comprovar aceite/entrega do provedor.
- PUBLICADO: Site oficial versão 83, commit `0f567b4836d6f5338873dd2605f648564db2ce57`, deploy
  `succeeded` e acesso público existente preservado.

## 2026-09-17 — Novo Lead: persistir como contato pendente

- O problema era exclusivamente anterior ao Supabase: no modo Ana, o formulário exigia duas
  confirmações e uma origem de autorização. Sem preencher a origem, `criarLead` retornava e o
  registro não era criado. Não havia duplicidade para os valores analisados e a sessão tinha
  `leads.create`.
- As confirmações foram removidas da tela. Ao salvar, o contato fica explicitamente pendente:
  telefone não é WhatsApp, não há consentimento declarado, a automação fica pausada e a Ana não
  é disparada. A guarda no mapper, Kanban, `ana-run` e worker permanece: canal comprovado e
  autorização são necessários antes do primeiro contato.
- Validação local: contrato de regressão direto, type-check frontend/Edge, lint e build passaram.
  Vitest não iniciou por restrição de leitura da junção `node_modules`; nenhum teste Vitest rodou.
  O formulário autenticado anterior foi fechado sem criar lead.
- PUBLICADO: Site oficial versão 84, commit `ddc4beb3a7cf6a909ea6fd6ed154d8230a25498a`, deploy
  `succeeded`. A sessão autenticada exibiu apenas o aviso de contato pendente; não havia caixas de
  confirmação nem campo de origem. O diálogo foi cancelado sem inserir um lead.

## 2026-09-17 — Lead manual com Ana: visibilidade correta no Kanban

- Diagnóstico do cadastro relatado: ele foi persistido com modo Ana, responsável atribuído e
  `contact_approval_status=pending`. O filtro do Kanban removia qualquer lead com
  `aguardandoAtivacao`, portanto o cartão não aparecia. Como o primeiro contato ainda não estava
  autorizado, o frontend também não chamou `ana-run`; banco confirmou zero mensagens, jobs e
  execuções. Não foi falha da Z-API ou do worker.
- O Kanban agora mostra esse lead em **Novo**, com aviso e selo de autorização pendente. O drawer
  explica o bloqueio e não permite Rodar, Retomar ou Devolver para Ana antes de comprovação de canal
  e autorização. A regra de bloqueio server-side continua igual.
- A migration `20260917175303_fix_pending_manual_lead_phone_identity` evita que um telefone seja
  copiado implicitamente para `whatsapp` e corrigiu somente o registro manual pendente afetado.
  Nenhum envio, job, execução, integração ou segredo foi acionado durante a correção.
- Validação pré-publicação: type-check frontend/Edge, lint, contrato direto de Kanban/migration e
  build/artefato do Site aprovados. Vitest não iniciou devido à permissão de leitura no destino da
  junção local de `node_modules`; nenhum caso Vitest foi executado.
- PUBLICADO: Site oficial versão 85, commit `48861eb7d79c8c5628f172f12d85c97f1b386c72`, com
  deploy `succeeded`. A inspeção autenticada confirmou Fabricio Gaspar / WF Digital em **Novo**,
  com IA, responsável atribuído, selo **Autorização pendente** e aviso de bloqueio do primeiro
  contato. Nenhum botão de Ana, mensagem ou job foi acionado.

## 2026-09-17 — Ana: apresentação inicial após envio ao Kanban

- O lead relatado não ficou parado por Z-API ou worker. O banco confirmou uma execução `lead.created`
  como `skipped` por `channel_not_allowed_by_ana_configuration`: tinha `active_channel=email`, e-mail
  desconectado e a versão ativa da Ana aceita somente WhatsApp. Por isso não havia mensagem nem job.
- Ao enviar um lead autorizado para o Kanban com Ana, o frontend agora promove explicitamente o
  telefone comprovado a WhatsApp como canal operacional; não infere autorização no cadastro manual.
  A mesma ação envia uma chave idempotente vinculada ao canal e informa bloqueio de modo explícito.
- `ana-run` v25 preserva todas as guardas existentes e, no primeiro contato autorizado em Novo sem
  histórico, usa a apresentação canônica da Wayflex, progride para Apresentado e cria a fila
  auditável. Não depende de modelo de IA para esse texto fixo.
- O reparo de dados alterou somente o canal do lead relatado para WhatsApp. O drawer do Kanban
  confirmou WhatsApp, automação ativa e Rodar Ana disponível. Nenhuma mensagem foi disparada nesta
  rodada: aguarda confirmação do operador imediatamente antes da ação externa.
- PUBLICADO: Site oficial versão 86, commit `7caa8903aa9c92b3d9ea5751ea50dd408e286374`, deploy
  confirmado como `succeeded`. Type-check frontend/Edge, lint e build passaram; Vitest não iniciou
  devido à permissão da junção local de `node_modules`.
