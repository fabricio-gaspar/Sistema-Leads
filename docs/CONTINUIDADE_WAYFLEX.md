# Checkpoint — WayFlex CRM

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
