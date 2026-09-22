# Histórico resumido de execução

## 2026-09-22 — Operação automática da Ana com roteamento explícito

- A agenda agora permite escolher Ana, vendedor específico ou equipe selecionada. A validação
  aponta o campo ausente antes da ativação e o `ana-operations` repete a autorização no servidor.
- As migrations `20260922113000_ana_automatic_routing_and_validation` e
  `20260922120000_prospecting_schedule_assignment_fk_indexes` foram aplicadas no Supabase
  oficial. `ana-operations` v2 e `automation-worker` v29 preservam o Kanban manual e só usam
  `ana-run` para decisões automáticas; a simulação não chama fornecedor nem canal externo.
- Type-check frontend/Edge, lint, 27 arquivos/206 testes e build/artefato Sites passaram. A
  homologação visual publicada será anotada separadamente; nenhum lead, mensagem ou busca real
  foi criada por este trabalho.

## 2026-09-19 — Ana: evento de handoff idempotente

- A inspeção do atendimento reportado confirmou que **Retornar Ana** concluiu o handoff anterior e
  que a nova mensagem de WhatsApp chegou ao `ana-run`. A execução foi interrompida somente ao
  tentar auditar o handoff humano: `domain_events.idempotency_key` é obrigatório.
- `ana-run` v31 agora grava `lead.handoff.requested` com uma chave derivada do identificador da
  execução. A regra que protege reunião, orçamento, pedido de humano e repetição comercial não foi
  flexibilizada; ela continua podendo devolver o lead ao atendimento humano.
- A regressão do handler exige a chave de idempotência. Type-check frontend/Edge, lint, 25
  arquivos/200 testes e build passaram. A função publicada foi conferida no projeto Supabase
  oficial.
- A mensagem real que falhou não foi reenviada nem reprocessada, para evitar contato duplicado.


## 2026-09-17 — Correção da reserva do teste direto Z-API

- O erro `whatsapp_test_reservation_failed` foi reproduzido no banco antes de qualquer chamada
  externa: a função `reserve_whatsapp_direct_test` tentava resolver
  `pg_catalog.coalesce/nullif`, que não existem como funções desse catálogo.
- A migration `20260917150914_fix_whatsapp_direct_test_reservation_special_forms` foi aplicada no
  Supabase oficial. Ela preserva a reserva idempotente, os advisory locks, a auditoria e o grant
  exclusivo de `service_role`; não modifica segredos, integração, lead, fila ou Edge Function.
- O rollback controlado retornou `reserved` mesmo com nome de ator vazio. A auditoria posterior
  retornou zero linhas para a prova; nenhuma mensagem foi criada nem a Z-API foi chamada.
- Type-check frontend/Edge, lint, contrato estático e build do artefato do Site passaram. O Vitest
  segue bloqueado antes de iniciar pela junção local de dependências sem permissão de leitura.
- PUBLICADO: Site oficial versão 83, commit `0f567b4836d6f5338873dd2605f648564db2ce57`, com
  deploy `succeeded` e acesso público existente preservado.

## 2026-09-09 — Baseline de Configurações

- Configurações passaram a usar status, equipe, integrações, fontes e supressões remotos.
- Funções `operational-diagnostics` e `team-members` publicadas; `ana-run` e worker reforçados.
- 104 testes, lint, typecheck e build aprovados; commit `4d072280a09b3b8462f5bf0dfa701b314eca31bb`.
- Site privado publicado como versão 48. Produção e envios não foram ativados.

## 2026-09-09 — Lote atual (em validação)

- Solicitação: concluir os 13 requisitos e instalar o protocolo de memória técnica incremental.
- Aplicados: Registro do Sistema separado, marca textual WAYFLEX, Dashboard remoto,
  Central sem simulação e saída humana pela fila segura.
- `.agent/` criado e conectado ao `AGENTS.md`.
- Quatro templates industriais sem preço/prazo inventado foram gravados na fonte operacional.
- Modo real ganhou pré-flight no backend e permanece bloqueado com Claude, webhook e scheduler offline.
- Equipe e responsáveis agora usam membros reais; gráficos e tempos estimados foram removidos.
- Typecheck frontend/Edge, lint, 107 testes e build aprovados. Commit e publicação ainda pendentes.
- Implementação salva no commit `7c0e02c9a62c2716de408aed6818cb27dec01c33`.
- Prévia privada publicada como Site versão 49 a partir do checkpoint documental
  `947cf10d18e921e4250e5878b0a7ea43dedb3a6b`; publicação concluída com sucesso.

## 2026-09-09 — Correção Z-API: salvamento de credenciais

- Causa confirmada: `configurar-integracao` misturava a gravação no cofre com
  uma tentativa automática de registrar webhook em `update-every-webhooks`.
  A resposta HTTP 400 desse endpoint fazia a interface informar que as chaves
  não haviam sido salvas, embora já estivessem no cofre.
- O salvamento e o teste de conexão agora não alteram webhook. Eles validam
  somente a instância, token e conexão do aparelho, sem enviar mensagem.
- A homologação do webhook segue pendente e mantém o modo real bloqueado até
  existir callback controlado com contrato confirmado.
- Publicadas: `configurar-integracao` v12 e `testar-integracao` v10. Testes:
  typecheck Edge e 108 testes aprovados.

## 2026-09-09 — Correção Z-API: contrato de status

- A documentação oficial atual foi confrontada com o teste: `GET /status` usa
  somente `Client-Token` e `Content-Type: application/json`.
- O header extra `Accept` foi removido; o teste automatizado protege esse
  contrato e confirma que a validação não envia mensagem.
- Publicada `testar-integracao` v11. Typecheck Edge e 109 testes aprovados.

## 2026-09-09 — Ambientes, limpeza segura e categorias de integração

- Dashboard ganhou controle real de Ambiente de Demonstração/Ambiente Real. A fonte continua
  em `company_settings.sandbox_mode`; a Edge Function faz o pré-flight e audita a alteração.
  A versão atual mantém Ambiente Real bloqueado por IA, webhook e worker 24/7 não homologados.
- `integrations.category` foi aplicado e indexado. Comunicação, Prospecção e Inteligência da
  Ana usam a categoria persistida, sem duplicar credenciais ou testes.
- Nove leads com marcadores objetivos de demonstração foram removidos com mensagens, tarefas,
  execuções, filas, agenda, propostas, contatos e contas exclusivas. Um lead com inbound e
  sem marcador de teste ficou preservado para revisão; não foram encontrados órfãos nas tabelas
  verificadas. O audit log append-only preservou o histórico de governança.
- Publicadas: `operational-diagnostics` v4 e `configurar-integracao` v13.
- Typecheck frontend/Edge, lint, 110 testes e build aprovados. Site privado publicado como
  versão 50 a partir do commit `1e2f3f406e0406c3c081d447ebbbb23510690045`.

## 2026-09-09 — Assistente de entrada Z-API e Worker 24/7

- Confirmado no banco: WhatsApp/Z-API de saída e Claude estavam validados; o item pendente
  era a entrada de mensagens, não uma nova validação de credenciais.
- O assistente agora cadastra somente o webhook oficial `PUT /update-webhook-received` pelo
  backend, sem expor URL/token. A entrada só fica homologada após callback real vinculado
  ao lead e processado pela Ana.
- Migration `20260909182343_add_server_side_automation_dispatch` instalou o cron
  `leadai-automation-worker-dispatch` por minuto. O botão prepara token por organização
  no Vault; o worker aceita apenas esse token interno ou usuário administrador e grava
  heartbeat sem liberar saída em Demo.
- Publicadas: `automation-worker` v11 (`verify_jwt=false` com autenticação interna),
  `operational-diagnostics` v5 e `webhook-whatsapp` v8.
- Typecheck frontend/Edge, lint, 112 testes e build aprovados. O cron foi confirmado ativo;
  como a integração scheduler da WayFlex segue desativada, a execução controlada retornou
  zero despachos e nenhuma mensagem foi enviada.
- Interface publicada com sucesso como Site privado versão 51 a partir do commit
  `a202a3fb9c0c8c33b179d82b377bc9395d42b6ef`.

## 2026-09-09 — Diagnóstico da entrega de callback Z-API

- Investigação do envio manual relatado: nenhum callback foi recebido no WayFlex depois do
  registro da entrada, portanto não houve associação ao lead, execução da Ana ou atualização
  de homologação. Não foram enviados testes adicionais nem callbacks antigos foram repetidos.
- `operational-diagnostics` v6 agora devolve o estado objetivo do último callback desde o
  cadastro e a interface orienta o teste com lead real de telefone mascarado. Há ação separada
  para atualizar o diagnóstico e recadastrar somente a entrada, sem qualquer segredo no painel.
- Type-check frontend/Edge, lint, build e 113 testes passaram.

## 2026-09-09 — Consolidação seletiva do projeto oficial

- O projeto atual do Work foi preservado como canônico e comparado, sem merge global, com
  `stabilize/production-readiness-2026-09-09` e com o Supabase implantado.
- O código-fonte local foi reconciliado com sete Edge Functions e 16 migrations que já estavam
  implantadas, eliminando divergência de release sem sobrescrever o frontend atual.
- Pipeline canônico de sete etapas restaurado no Dashboard/Kanban; Ganho e Perdido permanecem
  separados e Ganho exige humano.
- Handoff transformado em RPC transacional. O primeiro teste encontrou o campo obrigatório
  `actor_name`; a transação reverteu e a migration corretiva foi aplicada antes da aprovação.
- RLS-base de mensagens e propostas foi restaurada; isolamento entre duas organizações passou.
- Contrato real de orçamento (itens e estados) foi alinhado e testado sem criar Pedido/Venda.
- Matching de telefone bloqueou ambiguidade em transação e escolheu a única conversa IA ativa
  no caso real observado.
- Scheduler e heartbeat foram confirmados ativos. O callback relatado era de grupo e foi
  corretamente ignorado; entrada direta continua pendente de homologação.
- Typecheck frontend/Edge, lint, 115 testes e build de produção aprovados. Nenhuma mensagem
  real foi enviada e `company_settings.sandbox_mode` permaneceu ativo.
- Implementação consolidada salva no commit
  `1fbd231ff88b4e02c3ddddd18253a1f3be8be5ee`; publicação do Site ainda pendente neste ponto.
- A consolidação foi publicada com sucesso no Site oficial privado. O modo Demonstração foi
  preservado e nenhuma integração externa foi acionada durante a publicação.
## 2026-09-10 — Central: teste controlado de WhatsApp em Demonstração

- Diagnóstico confirmado no servidor: a mensagem manual era bloqueada por
  `operational_mode_protected` antes de criar a fila quando `sandbox_mode=true`; portanto
  não chegava à Z-API nem criava histórico de saída.
- `enviar-whatsapp` v5 permite exclusivamente um **teste controlado** confirmado por
  owner/admin/manager. Ele é auditado, expira em cinco minutos e não libera Ana, cadências
  ou Ambiente Real. Mensagens manuais comuns seguem bloqueadas no modo Demonstração.
- `automation-worker` v14 ignora toda fila em Demonstração, salvo esse job controlado ainda
  válido. A seleção da integração de saída foi corrigida para usar a chave exata `whatsapp`,
  sem confundir o webhook de entrada com o canal de envio.
- A Central ganhou botão e confirmação explícita para o teste. As funções implantadas foram
  verificadas nas versões v5 e v14. Type-check frontend/Edge passou. O arquivo de teste de
  handlers passou 33 verificações; o processo do Vitest não encerrou sozinho após concluir,
  por isso foi interrompido depois do resultado. Build e lint aguardam nova execução porque
  a execução local foi cancelada pelo ambiente antes de iniciar.
## 2026-09-10 — Ativação inteligente do Ambiente Real

- O botão Ambiente Real deixou de ficar bloqueado pela lista de pré-requisitos. Ao ser
  confirmado, chama uma única operação autenticada no backend.
- O backend prepara o worker quando ainda não foi configurado, cadastra a entrada Z-API
  quando o canal de saída já está validado e libera o kill switch somente depois de todas
  as demais verificações passarem.
- `company_settings.sandbox_mode` continua como única autoridade. Se faltar confirmação
  externa, o resultado permanece em Demonstração e informa somente a próxima ação. O modo
  real só é gravado após nova verificação integral do servidor.
- `operational-diagnostics` v8 publicado com JWT obrigatório. Type-check frontend/Edge,
  lint, build e 35 testes direcionados do fluxo passaram. Nenhum modo foi ativado e nenhuma
  mensagem foi enviada durante a implantação.

## 2026-09-10 — Ambiente Real único e limpeza confirmada de testes

- O seletor e os textos de Demonstração foram removidos do Dashboard, Configurações, Central e página inicial. `sandbox_mode` não foi removido: ele continua sendo o bloqueio interno até a preparação mínima estar confirmada no backend.
- A validação bem-sucedida da Z-API agora registra o canal como pronto e, se a empresa estiver ativa e não houver itens antigos na fila, grava `sandbox_mode=false` e audita a ativação do Ambiente Real. O painel diferencia “Comunicação ativa” de “Automação pronta”; portanto não promete que a Ana está homologada sem IA, entrada e worker.
- Foi aplicada a migration `20260910134209_purge_selected_test_leads`. A nova função `cleanup-test-leads` (JWT obrigatório) apresenta os candidatos, exige seleção e confirmação, e chama uma rotina transacional que limpa mensagens, filas, execuções, histórico, agenda, tickets, Kanban, propostas e vínculos de canal sem deixar referências de lead.
- Funções implantadas: `testar-integracao` v13, `operational-diagnostics` v11 e `cleanup-test-leads` v1, todas com JWT obrigatório.
- Type-check frontend/Edge, lint e build passaram. O arquivo de testes direcionado mostrou 36 verificações aprovadas; o processo Vitest permaneceu aberto após concluir e foi interrompido somente depois de registrar esse resultado. Nenhuma mensagem foi enviada e nenhuma exclusão foi disparada automaticamente.

## 2026-09-10 — Teste direto Z-API e despacho imediato da Central

- A causa estrutural do relato foi corrigida: a Central antes apenas gravava o job e aguardava o próximo ciclo do worker. Agora ela chama o worker autenticado para despachar **somente o job recém-criado**; o claim atômico mantém o cron seguro contra duplicidade e a fila continua como recuperação se a tentativa imediata não concluir.
- Em **Configurações > Canais, APIs e fontes**, o botão de teste do WhatsApp agora abre um fluxo único: número controlado + mensagem → validação da Z-API → envio real direto. A nova função `enviar-teste-whatsapp` exige JWT e papel administrativo, não usa segredo no navegador, não cria lead/conversa e mascara o telefone na auditoria.
- Funções implantadas: `automation-worker` v15 e `enviar-teste-whatsapp` v1. Type-check frontend/Edge, lint e build passaram. O teste direcionado imprimiu 39 verificações aprovadas; o processo permaneceu aberto após a saída e foi interrompido somente então. Nenhuma mensagem real foi enviada pelo agente.

## 2026-09-10 — Configuração publicada da Ana e políticas de cadência

- A personalização passou a salvar uma versão ativa da Ana, sem ativar canais ou enviar por
  efeito colateral. A versão governa comportamento, conteúdo, canais, cadência, horário,
  limite diário por lead e handoff do `ana-run`. Toda saída automática guarda essa versão e
  é bloqueada se outra configuração for publicada antes do provedor.
- Foram aplicadas as migrations `20260910170000_reconcile_handoffs_and_human_messages`,
  `20260910183000_enforce_ana_cadence_policy` e
  `20260910190000_reserve_whatsapp_direct_test` no projeto Supabase oficial.
- Foram publicadas as funções `ana-ia` v9, `ana-run` v20, `automation-worker` v17,
  `configurar-integracao` v14, `enviar-teste-whatsapp` v2, `enviar-whatsapp` v6,
  `operational-diagnostics` v12, `testar-integracao` v14, `webhook-whatsapp` v15 e
  `lead-workflow` v3.
- A configuração de IA não revela chave; modelos permitidos são validados no backend e o
  painel declara corretamente que a seleção não equivale a teste real do modelo.
- Type-check frontend/Edge, lint, 157 testes e build passaram. Não houve envio de WhatsApp,
  execução de modelo, alteração de `sandbox_mode` ou remoção de dados neste lote.

## 2026-09-10 — Layout executivo e fluxo comercial orientado

- O Site oficial foi preservado como fonte operacional; o `main` público do GitHub foi
  comparado e não recebeu merge global porque contém uma stack histórica diferente. A branch
  de estabilização não foi necessária para este delta exclusivamente visual e informacional.
- O shell passou para o padrão Wayflex Executive Light e o menu foi agrupado em Começo · captar,
  Meio · atender, Final · fechar e Administração. A antiga busca sem ação foi substituída por
  filtro funcional de telas e o indicador textual não comprovado “Ana está online” foi removido.
- O Dashboard ganhou sequência de trabalho com rotas reais e cartões de Ambiente Real, Z-API,
  entrada WhatsApp, Ana, worker e fontes calculados por `operational-diagnostics`.
- Configurações agora explica e separa Canais, APIs e Fontes. O teste direto da Z-API permanece
  somente em Canais > WhatsApp. Integração conectada mas desativada aparece como configurada e
  inativa, com teste de regressão dedicado.
- Type-check frontend/Edge, lint sem warnings, 14 arquivos de teste com 127 verificações e build
  de produção foram aprovados. O Computer Use não carregou por erro local de permissão no módulo
  do navegador, portanto a inspeção autenticada visual permanece pendente; nenhuma operação de
  banco, integração, lead ou mensagem foi executada neste lote.
- Implementação registrada no commit `83ffd1001f8c6777a85f3aec304e1434897d5d8e` e publicada
  com sucesso no Site oficial como versão 59, preservando a audiência customizada existente.

## 2026-09-10 — Recuperação da configuração pública do Supabase no Site

- A tela “Configuração necessária” foi reproduzida como falha de empacotamento, não de banco:
  os dois valores públicos estavam corretos no ambiente do Site e conferiam com o projeto
  `thgzrkppouoevapjquyu`, mas a exportação Vite anterior fora gerada sem eles.
- O artefato estático foi reconstruído com URL pública e chave publicável ativas obtidas pelo
  conector oficial. A URL e a chave foram verificadas no pacote sem serem registradas no Git,
  em arquivos `.env` ou em logs; nenhuma chave privada, dado operacional ou integração externa
  foi usada.
- Type-check frontend/Edge, lint sem warnings e 14 arquivos/127 testes passaram antes da
  publicação corretiva.
- Publicação corretiva concluída com sucesso no Site oficial como versão 61. A audiência
  customizada foi preservada; nenhuma variável sensível foi adicionada ao Site ou ao Git.

## 2026-09-10 — Clareza da publicação em Configurar a Ana

- A investigação autenticada confirmou que `ana-ia` está ativa e que a configuração v13 carrega.
  O botão da etapa final parecia inoperante porque estava corretamente bloqueado sem alteração
  pendente, mas conservava o rótulo genérico “Publicar configuração”.
- A interface agora informa que a versão atual já está publicada, explica que uma edição cria
  uma nova versão e passa a mostrar “Publicar alteração” somente quando há mudança pendente.
  Isso evita criar versões duplicadas e torna o estado acionável.
- Type-check frontend/Edge, lint, 15 arquivos/159 testes e build passaram. A reprodução no
  navegador confirmou o botão bloqueado no estado já publicado e habilitado após edição local;
  nenhuma publicação, mensagem, chamada de modelo ou alteração operacional foi disparada no teste.

## 2026-09-10 — Ana automática ativada por verificação operacional

- O Dashboard mostrava “Ana automática · Inativo” embora a política publicada, o WhatsApp, a
  entrada e o worker estivessem ativos. A causa comprovada era a validade expirada da última
  verificação da credencial de IA.
- A credencial do provedor principal foi revalidada pelo fluxo autenticado de Configurações.
  O teste consulta o provedor para validar acesso, não envia mensagem, não executa o modelo e
  não altera a configuração comercial.
- Depois da atualização, o Dashboard confirmou **Ana automática · Ativo** e Ambiente Real ativo,
  com IA, canal, entrada, worker e políticas confirmados. Nenhuma mensagem foi enviada.

## 2026-09-10 — Limpeza explícita de lead de teste

- O operador solicitou excluir o único cadastro associado ao telefone informado, para repetir
  um teste. A consulta prévia confirmou um único ID na organização Wayflex e a transação foi
  limitada exatamente a esse ID.
- O grafo operacional foi removido pela função transacional: cadastro, mensagens, filas,
  execuções, atendimento, Kanban, agenda, comercial e vínculos de canal/matching. A verificação
  posterior confirmou zero registros diretos em todas as tabelas relacionadas ao lead e nas
  dependências das execuções de automação.
- `audit_logs` e `domain_events` permanecem como evidência append-only da organização; a função
  implantada os retém deliberadamente. Eles não participam do matching, atendimento, fila ou
  automação e não impedem o novo cadastro do telefone. Nenhuma mensagem foi enviada e nenhuma
  integração, política da Ana ou `sandbox_mode` foi alterado.

## 2026-09-11 — Segunda limpeza explícita do lead Fabricio Gaspar

- O cadastro recriado com o telefone informado foi localizado de forma única e removido pela
  mesma transação oficial, restrita à organização Wayflex.
- Verificação posterior: zero lead, mensagem, item de fila, execução da Ana e vínculo de canal.
# 2026-09-11 — Refinamento visual executivo

- Interface refinada sem alterações operacionais. Dashboard usa as mesmas fontes remotas,
  gráficos de distribuição e status por conexão; configurações reorganizadas por responsabilidade.
- Type-check frontend/Edge, lint, 159 testes/15 arquivos, build Vite e Worker aprovados.
- Recuperado Git HTTPS usando helper já instalado e OpenSSL. Publicação no Site oficial autorizada.

# 2026-09-11 — Compactação do Dashboard

- O Dashboard foi tornado mais compacto apenas por classes de apresentação: menos padding,
  gaps e altura nos cards, barras e listas; nenhum dado, estado, regra ou integração mudou.
- Type-check frontend/Edge, lint sem warnings, 15 arquivos/159 testes e build do artefato
  do Site foram aprovados. QA visual autenticado não foi executado nesta rodada.

# 2026-09-11 — Correção da busca Apify

- Diagnóstico confirmado no banco: não havia `prospecting_runs` nem cache para as tentativas;
  a inserção era recusada porque a função omitira `estimated_records` e `quote_expires_at`,
  ambos obrigatórios no schema implantado.
- `prospectar-leads` v6 foi publicada com os campos obrigatórios. A tela deixou de avançar por
  temporizadores para uma revisão vazia e expõe erro/resultado vazio de forma distinta.
- Type-check frontend/Edge, lint, build e 160 testes em 15 arquivos passaram. Nenhuma busca
  externa foi disparada pelo agente.

# 2026-09-11 — Sincronização do heartbeat legado

- Causa confirmada: `automation-worker` atualiza a integração `scheduler`, que alimenta o diagnóstico operacional, mas o registro histórico `automation_heartbeats.automation_engine` não era atualizado desde agosto.
- Aplicada a migration `20260911110000_sync_legacy_scheduler_heartbeat`: trigger privado sincroniza o heartbeat legado a cada novo `last_success_at` do scheduler e faz backfill da última confirmação existente.
- Verificação no Supabase: trigger instalado; `automation_engine` em `success`, sem erro. Type-check frontend/Edge, lint e build passaram. O Vitest não iniciou neste worktree por limitação de resolução do esbuild através da dependência compartilhada; a migration foi verificada diretamente no banco.

# 2026-09-11 — Busca Apify assíncrona e revisão geográfica

- Foram encontrados dois `prospecting_runs` da organização Wayflex em `running`, com mais de
  cinco minutos e sem `provider_run_id`; a implementação anterior aguardava o Actor na mesma
  requisição. Os dois foram marcados como `legacy_provider_start_timeout`, sem apagar registros
  ou tocar em leads, cache, integração ou Vault.
- A Edge Function agora inicia a consulta, persiste a execução remota e permite polling
  autenticado até `SUCCEEDED`. A revisão recebe resultado/cache apenas no término; coordenadas
  válidas são mantidas para o mapa. Contratos cobrem início pendente, retomada concluída,
  coordenadas e fronteira do Vault ao reparar Actor.
- Validação: type-check frontend/Edge, lint, build e 15 arquivos/163 testes aprovados. Não foi
  executada busca real pelo agente; Computer Use não pôde carregar o navegador por falha local
  de permissão.

# 2026-09-11 — Canais e APIs compacto e binário

- O card do Dashboard foi reduzido para uma grade de nome + estado, sem provedor, horário ou
  estados operacionais intermediários. Não alterou integrações, Edge Functions, banco, rotas ou
  configuração.
- A fonte permanece `operational-diagnostics`: **Conectado** requer conexão habilitada, sem
  pausa/erro e validação dentro da janela do backend; os demais casos aparecem como
  **Desconectado**.
- Consulta somente-leitura confirmou o projeto Supabase oficial acessível pelo MCP. Foram
  aprovados type-check frontend/Edge, lint, 15 arquivos/163 testes, build Vite e artefato
  Worker. A publicação oficial da versão 73 foi confirmada, sem enviar mensagens nem alterar
  dados operacionais.

# 2026-09-11 — Gráfico Realtime de conversas no Dashboard

- Consulta no projeto Supabase oficial confirmou que `lead_messages` ainda não participava de
  `supabase_realtime`. A migration `20260911180000_enable_lead_messages_realtime` foi aplicada
  e a verificação posterior confirmou a tabela publicada.
- O Dashboard agora agrega mensagens operacionais da Central nas últimas 24 horas, separando
  recebidas/enviadas e excluindo notas internas. A faixa do gráfico é horizontalmente rolável e
  a assinatura Realtime é filtrada pela organização autenticada. O selo só diz Ao vivo após
  `SUBSCRIBED`.
- Type-check frontend/Edge, lint, 16 arquivos/165 testes, build Vite e artefato Worker passaram.
  O commit `1a2f0d1c40e20be475dd2eff34463228fe0a550e` foi publicado no Site oficial como versão
  74. Não houve envio de mensagem, alteração de lead, automação, integração ou configuração
  comercial. A validação visual autenticada ficou pendente porque Computer Use falhou por
  permissão antes de abrir a janela.

# 2026-09-14 — Criação direta de membro da equipe

- A Edge Function `team-members` foi publicada como v2 com a ação autenticada `create`. Apenas
  owner/admin da organização ativa pode criar um usuário confirmado e associá-lo como membro ativo.
- A interface de Equipe passou a separar **Criar acesso** de **Convidar membro**. A senha é enviada
  somente ao backend durante a requisição e não é persistida nos logs de auditoria nem no Git.
- Type-check frontend/Edge e lint passaram; build Vite e artefato do Site foram gerados. O Vitest
  não iniciou devido à resolução do esbuild para uma pasta compartilhada sem permissão de leitura.
  O Computer Use também não pôde abrir o navegador pelo erro local `EPERM`.

# 2026-09-16 — Governança da base, entrada do site e permissões individuais

- Migration `20260916205958_lead_governance_permissions_and_site_whatsapp` aplicada no Supabase
  oficial. Ela criou a matriz de permissões por membro, a configuração pública de entrada do site,
  RLS correspondente e a leitura/exclusão administrativa do grafo operacional de leads.
- Edge Functions publicadas: `team-members` v6, `lead-governance` v1,
  `site-whatsapp-entry` v1 e `webhook-whatsapp` v17. O webhook conserva bloqueio para matching
  ambíguo; não cria lead para mensagens desconhecidas sem o marcador de uma entrada ativa.
- Type-check frontend/Edge, lint e build passaram. O teste de contrato recebeu cenários para
  permissões e entrada do site, mas Vitest não iniciou por permissão negada no worktree ligado ao
  `node_modules`. Nenhum lead, mensagem, configuração Z-API ou chamada a provedor foi executado.

# 2026-09-17 — Reparo da confirmação da exclusão na Base de Leads

- A inspeção autenticada reproduziu o botão **Excluir selecionados** com um lead marcado, sem
  aceitar a exclusão. O console confirmou `prompt() is not supported`; portanto a falha ocorria
  no frontend antes de a Edge Function `lead-governance` receber a requisição.
- `LeadBaseManager` substituiu `window.prompt` por diálogo React acessível, com a mesma frase
  `EXCLUIR N LEADS` validada localmente e no backend. Nenhum lead foi excluído nesta correção.
- Há um painel legado independente em Configurações para candidatos marcados como teste. Ele usa
  `cleanup-test-leads` e a transação compartilhada; foi identificado como duplicidade de UI, mas
  mantido para não alterar a política específica de limpeza de testes sem decisão do operador.
- Type-check, lint, teste direto da frase de confirmação e build/artefato do Site passaram.
  Vitest não iniciou por permissão de leitura da junção de dependências.
- PUBLICADO: Site oficial versão 82, commit `0c63c294dc226beb4bdeaa2af26a9618785cf680`.
  A inspeção autenticada abriu o diálogo e o cancelou sem acionar exclusão.

# 2026-09-14 — Reparo do acesso de Juca e prevenção de onboarding paralelo

- O cadastro havia sido criado no Auth, mas o gatilho de novo usuário o associou a uma organização
  pessoal porque o vínculo WayFlex só era gravado depois de `createUser`.
- O fluxo agora cria a autorização em `organization_invites` antes do Auth e restaura esse registro
  em caso de falha. `team-members` v4 foi publicada com JWT obrigatório.
- Juca foi movido para a organização WayFlex como administrador ativo. O vínculo com a organização
  pessoal indevida foi removido após confirmar zero dados operacionais; a auditoria imutável foi
  preservada. A tela autenticada passou a listar Juca e fabricio.
- Type-check frontend/Edge, lint, build e 16 arquivos/172 testes passaram. Não houve leitura ou
  alteração de senha, mensagem, lead, integração comercial ou configuração da Ana.

## 2026-09-13 — Mapa visual de decisão da Ana

- A navegação dos seis passos de Configurar a Ana foi convertida em um mapa interativo responsivo.
  Os blocos reutilizam `setStep` e o formulário existente; save, publicação, repositório e payload
  não foram modificados.
- O diagrama representa a base aprovada por catálogos, segmentos e acessórios, o caminho de
  qualificação, as decisões de reunião/orçamento e cadência/handoff, a revisão final e o pipeline
  canônico. Estado publicado e alterações pendentes continuam derivados dos dados reais da tela.
- A ponta oficial da versão 74 foi integrada por merge, sem força ou rollback. O conjunto passou
  em type-check frontend/Edge, lint, 16 arquivos/165 testes e build. Não houve operação no
  Supabase, envio de mensagem, alteração de integração, segredo ou dado operacional.
- PUBLICADO: Site oficial versão 75, commit `0e8221bb4263d42c6c98652fcfb42d929ba09899`,
  com deploy `succeeded` e audiência owner-only preservada. A inspeção autenticada confirmou o
  mapa, a configuração v17 e a navegação até a etapa 6; nenhum campo foi alterado ou publicado.

## 2026-09-13 — Restauração do layout anterior da Ana

- O operador rejeitou o mapa visual da versão 75 e solicitou voltar ao formato anterior.
- Somente o JSX e o CSS introduzidos pelo mapa foram desfeitos. A comparação com a versão 74 ficou
  sem diferença nos dois arquivos; formulário, publicação, Supabase, Ana e demais módulos foram
  preservados.
- Type-check frontend/Edge, lint, 16 arquivos/165 testes e build passaram. Nenhum dado, mensagem,
  integração, segredo ou configuração operacional foi alterado.
- PUBLICADO: Site oficial versão 76, commit `0b7892bd048c47d37be1d7985b9cfafaa61d8d26`,
  com deploy `succeeded` e audiência owner-only preservada.

## 2026-09-13 — Segurança de contato, autonomia da Ana e mensageria reconciliável

- O projeto oficial e o Supabase `thgzrkppouoevapjquyu` foram confirmados antes do delta. O
  escopo existente foi reaproveitado; nenhum módulo paralelo, segredo ou Site adicional foi criado.
- A captura passou a separar aderência, contactabilidade e engajamento, preservando origem e
  identidade externa. Telefone deixou de ser presumido como WhatsApp; Busca, Leads, Kanban,
  mapper, `ana-run` e worker exigem aprovação de contato antes de uma saída automática.
- `ana-run` passou a usar recuperação híbrida da Base aprovada quando houver embedding e recebeu
  ação idempotente de agenda com verificação de disponibilidade. Conteúdo comercial sensível
  permanece sob handoff humano.
- O diagnóstico passou a listar fila e trilha de saída por mensagem. Seis jobs antigos já aceitos
  pela Z-API estavam presos porque as funções SQL qualificavam incorretamente `coalesce/nullif`.
  As funções atômicas foram corrigidas; os seis estados foram finalizados localmente, sem reenvio,
  e `automation-worker` v19 passou a executar essa reconciliação de forma recorrente.
- Testes SQL transacionais com rollback comprovaram fila idempotente, aceite, entrega, handoff e
  retorno para a Ana sem persistir dados ou chamar provedores. Type-check frontend/Edge, lint,
  16 arquivos/168 testes e build passaram. Busca Apify, modelo, Calendar e WhatsApp reais não
  foram acionados nesta rodada.

## 2026-09-13 — Operação automática e alertas comerciais

- Extensão aditiva sobre Apify, scheduler, `ana-run`, Leads, Kanban, Central, Dashboard e o kill
  switch existentes; nenhum segundo motor automático foi criado.
- Schema, RLS, Realtime, roteamento de eventos, preferências, fila de execução, limites e resumo
  diário foram aplicados no Supabase oficial. O primeiro teste transacional detectou o enum de
  papéis divergente; a função foi corrigida e o teste seguinte passou com rollback.
- Edge Functions publicadas: `ana-operations` v1, `ana-run` v24, `prospectar-leads` v11 e
  `automation-worker` v22. Chamadas sem autenticação foram recusadas.
- A operação permaneceu desativada e em Simulação; nenhum WhatsApp, Apify, modelo ou Calendar real
  foi chamado. A homologação externa continua sendo ação explícita do operador.

## 2026-09-14 — Exclusão definitiva em Equipe

- Confirmação: projeto Supabase `thgzrkppouoevapjquyu` (Sistema de Leads).
- Migration `20260914203238_member_identity_deletion` aplicada: 13 FKs para `auth.users` usam
  `ON DELETE SET NULL`; `prospecting_runs.requested_by` aceita nulo. Não houve exclusão de usuários.
- `team-members` v3 passou a usar `auth.admin.deleteUser` somente para membro não compartilhado,
  após bloquear autoexclusão, última administração e identidade ligada a outra organização.
- Histórico comercial é preservado sem responsável; dados de identidade e acesso são eliminados,
  permitindo recriar o mesmo e-mail posteriormente.
- Verificação local: type-check frontend/Edge, lint e build aprovados. Teste de regressão adicionado;
  Vitest bloqueado antes de iniciar por permissões do diretório de dependências compartilhado.

# 2026-09-17 — Cadastro manual sem bloqueio visual de autorização

- Causa: no modo Ana, `criarLead` exigia duas caixas de confirmação e uma origem de autorização
  no próprio navegador. Sem a origem, a função retornava antes de chamar o repositório ou o
  Supabase. A inspeção de dados confirmou ausência de duplicidade para o formulário analisado e
  permissão `leads.create` válida para a sessão autenticada.
- Correção: `pendingManualLeadContact` torna explícito o estado seguro de um cadastro manual:
  contato pendente, sem consentimento, sem WhatsApp e com canal apenas E-mail ou Telefone quando
  declarado. A criação não chama `runAna`; a validação comprovada segue obrigatória no backend
  antes de qualquer primeiro contato.
- Validação: contrato direto passou; type-check frontend/Edge, lint e build/artefato do Site
  passaram. Vitest foi bloqueado antes de iniciar pela junção local de `node_modules`. O modal
  autenticado foi aberto e cancelado sem inserir lead, mensagem ou dado externo.
- PUBLICADO: Site oficial versão 84, commit `ddc4beb3a7cf6a909ea6fd6ed154d8230a25498a`, deploy
  `succeeded`. A inspeção autenticada confirmou a remoção das caixas e do campo de origem; o
  diálogo foi cancelado sem criar qualquer registro.

# 2026-09-17 — Lead manual pendente visível no Kanban

- A consulta do registro relatado confirmou `contact_approval_status=pending`, automação pendente,
  zero mensagens, zero jobs e zero execuções da Ana. Não houve falha do provedor: o cadastro não
  deveria acionar `ana-run` antes da autorização, mas o filtro de `aguardandoAtivacao` também o
  escondia indevidamente do Kanban.
- A correção exibe a carteira atribuída no Kanban, conserva o cartão na etapa Novo e comunica o
  bloqueio de primeiro contato. O drawer remove ações que poderiam sugerir uma ativação manual
  prematura. O contrato de regressão cobre lead pendente atribuído e registro sem fluxo atribuído.
- A migration `20260917175303_fix_pending_manual_lead_phone_identity` foi aplicada no Supabase
  oficial: não há mais cópia de telefone para WhatsApp e somente o registro manual pendente exato
  foi corrigido. Nenhuma mensagem, job, execução da Ana ou chamada à Z-API foi criada.
- PUBLICADO: Site oficial versão 85, commit `48861eb7d79c8c5628f172f12d85c97f1b386c72`, deploy
  `succeeded`. A inspeção autenticada confirmou o lead no Kanban em Novo, com IA e autorização
  pendente. Um bundle antigo em cache precisou ser recarregado; após a recarga, não houve erro de
  rota nem ação externa.

# 2026-09-17 — Ativação WhatsApp e apresentação inicial da Ana

- Diagnóstico confirmado no lead relatado: a execução `lead.created` existia, mas estava `skipped`
  por `channel_not_allowed_by_ana_configuration`. O cadastro tinha WhatsApp e autorização válidos,
  porém `active_channel=email`; e-mail está desconectado e a configuração publicada da Ana permite
  somente WhatsApp. Não houve job, mensagem ou chamada ao worker/provedor.
- Correção: a ativação no Kanban passa a persistir WhatsApp como canal operacional quando Ana é
  autorizada, usa idempotência por canal e mostra falha ao operador. `ana-run` v25 trata o primeiro
  contato autorizado sem mensagens como apresentação institucional canônica, grava o estágio
  Apresentado e cria a fila auditável sem depender do modelo.
- O reparo de dados foi limitado ao lead relatado e alterou apenas `active_channel` para WhatsApp.
  O drawer autenticado mostrou canal preferencial WhatsApp, automação ativa e Rodar Ana disponível.
  O botão não foi acionado, portanto não há evidência de saída, aceite, entrega ou leitura.
- PUBLICADO: Site oficial versão 86, commit `7caa8903aa9c92b3d9ea5751ea50dd408e286374`, deploy
  `succeeded`. Type-check frontend/Edge, lint e build passaram; Vitest permaneceu bloqueado antes de
  iniciar por permissão na junção local de dependências.

# 2026-09-17 — Organização operacional, monitoramento e resumo diário opcional

- Configurações passou a separar Canais, APIs e Fontes. Registro do Sistema foi incorporado à
  seção de governança; a rota anterior apenas redireciona. Equipe e acessos foi renomeada para
  Usuários. A gestão da base de Leads agora está no Funil de Conversão e não permanece duplicada
  na tela de Leads.
- O Dashboard consulta o backend a cada minuto e apresenta cartões compactos separados por tipo
  de conexão. O monitor do WhatsApp usa estados e contagens reais persistidas de fila, callbacks,
  recibos, falhas e política de risco; não calcula saldo, crédito ou expiração quando o provedor
  não fornece esse dado público.
- Migration `20260917213000_daily_whatsapp_lead_reports` aplicada no Supabase oficial. O relatório
  diário por WhatsApp é configurável por usuário, fica desligado por padrão e é executado apenas
  pelo agendador server-side em Ambiente Real. O registro idempotente armazena hash do resumo,
  nunca mensagem ou telefone; a UI recebe somente os quatro últimos dígitos do destinatário.
- Edge Functions publicadas: `automation-worker` v23, `team-members` v7 e
  `operational-diagnostics` v14. A telemetria do worker passou a usar a origem permitida pelo
  schema (`derived`), em vez de um valor que o banco rejeitava silenciosamente.
- Type-check frontend/Edge, lint, build e contrato direto do resumo diário passaram. Vitest segue
  impedido de iniciar pelo destino sem permissão da junção de `node_modules`. Nenhum dado de lead,
  mensagem ou configuração de relatório foi ativado durante este lote.

# 2026-09-17 — Entrada WhatsApp: diagnóstico de ausência de callback e prevenção de rota obsoleta

- O lead relatado `Fabricio Gaspar · WF Digital` com final `1875` foi confirmado como autorizado,
  com WhatsApp normalizado, apresentação enviada pela Ana e aceite de saída registrado. A consulta
  de `channel_inbound_events` e `webhook_events` retornou zero callback recebido para esse lead
  após sua criação; portanto a mensagem relatada não chegou ao WayFlex, à Central ou ao `ana-run`.
- O cadastro de entrada da Z-API foi reenviado ao provedor com os três callbacks documentados
  (recebimento, entrega e status). A Z-API aceitou o recadastro. Nenhuma mensagem foi enviada por
  esta correção e a mensagem anterior não pode ser recuperada porque nunca alcançou o backend.
- `configurar-integracao` v18 agora preserva o token de callback e, se instância, token de rota ou
  URL-base da Z-API mudar, invalida explicitamente a homologação de entrada sem expor credenciais.
  `operational-diagnostics` v15 mostra esse estado como "credenciais alteradas" e orienta o
  recadastro antes de esperar respostas.
- A proteção tem contratos de regressão para a invalidação e para o diagnóstico. Type-check
  frontend/Edge e lint passaram; Vitest permanece bloqueado antes do início pela junção local de
  `node_modules` sem acesso do esbuild.
- Pendente externo: enviar uma nova mensagem individual do número já cadastrado após o recadastro
  e confirmar no banco o callback, a mensagem na Central e a resposta da Ana.

# 2026-09-18 — Callback Z-API não vinculado visível no diagnóstico

- Nova consulta no projeto oficial confirmou que o lead `Fabricio Gaspar · WF Digital` (final
  `1875`) segue com zero eventos de entrada, zero mensagens recebidas e zero execuções da Ana por
  `message.received`. A apresentação anterior permanece registrada como saída aceita.
- A Z-API está alcançando o WayFlex: eventos individuais recebidos após o recadastro vieram dos
  números finais `0307` e `8864`, todos com `lead_not_matched`. Eles não pertencem ao lead do
  teste, portanto a Central e a Ana os bloqueiam corretamente em vez de associá-los por aproximação.
- Causa do indicador enganoso: o diagnóstico consultava somente `channel_inbound_events`, tabela
  que existe apenas após um lead ser resolvido. Callbacks sem lead ficavam em `webhook_events` e o
  painel concluía falsamente que a Z-API não tinha chamado o sistema.
- Correção: `operational-diagnostics` v17 consulta os eventos auditados de webhook para o estado
  de entrada. A validação visual autenticada confirmou o texto correto: mensagem entregue, mas sem
  WhatsApp cadastrado correspondente. Type-check frontend/Edge e lint passaram; Vitest continua
  bloqueado pelo `node_modules` local antes de iniciar.
- Não houve envio, exclusão ou modificação de lead nesta etapa. Para concluir o fluxo real, a
  próxima mensagem precisa sair efetivamente do número final `1875`; mensagens de outro aparelho
  são, por projeto, recusadas para impedir mistura de conversas.

# 2026-09-18 — Proteção de persistência na ativação manual da Ana

- A leitura do Supabase para o lead recém-criado confirmou somente o `INSERT`: estava em Novo,
  pendente de autorização, sem WhatsApp operacional e sem `agent_runs`, `outreach_jobs` ou
  mensagens. Não houve chamada a `ana-run` e nenhuma tentativa de envio externo.
- A camada cliente antes engolia o erro assíncrono de persistência. A atualização agora solicita o
  `id` de retorno do Supabase e falha explicitamente caso a RLS ou qualquer condição impeça a linha
  de ser atualizada. O store reconcilia o estado otimista com o servidor e a tela não aciona Ana em
  caso de falha.
- Para reduzir o erro operacional, criar um lead em modo Ana passa diretamente ao diálogo de
  ativação do Kanban. O operador ainda precisa comprovar WhatsApp e autorização; o sistema não
  transforma telefone em consentimento nem envia mensagem automaticamente.
- Type-check frontend/Edge, lint e build passaram. O Vitest foi bloqueado antes de iniciar porque
  a junção compartilhada de `node_modules` não é legível pelo esbuild.

# 2026-09-18 — Central de Atendimento: atualização ao vivo e contexto comercial

- Escopo: melhoria visual e de operação da Central sem alterar a autoridade de `ana-run`, filas,
  regras de opt-out, contatos ou integrações.
- Leitura confirmada: o projeto Supabase `thgzrkppouoevapjquyu` está `ACTIVE_HEALTHY`; somente
  `public.lead_messages` está na publicação `supabase_realtime`. A Central assina exclusivamente
  essa tabela, filtrada por organização, e relê o repository autorizado após o evento.
- Implementado: caixa com filtros, chat com bolhas e compositor multi-linha, atalhos que apenas
  preenchem texto, painel de lead, criação de Agenda/Orçamento pré-selecionada por URL e retorno ao
  Kanban. Nenhuma ação externa é acionada por abrir esses atalhos.
- Validação: `tsc --noEmit --project tsconfig.app.json` e ESLint sem avisos passaram; Vite +
  `build-sites-artifact.mjs` passou. `vitest run --configLoader runner` executou 194 casos,
  com 193 aprovados e uma falha pré-existente no contrato de rota de callback Z-API.
- Publicação: Site oficial v91, deploy concluído. A inspeção autenticada da Central confirmou
  **Atualização ao vivo**, a conversa operacional de Fabricio Gaspar e o compositor sem realizar
  envio, alteração de lead ou mudança de configuração.

# 2026-09-18 — Ana: confirmação segura de pedido de reunião durante handoff

- A entrada do lead final `1875` chegou, foi associada corretamente e abriu `message.received`,
  mas a execução falhou ao inserir `domain_events.actor_type='agent'`. O schema aceita somente
  `user`, `ai`, `system` e `provider`.
- Publicado `ana-run` v28: grava eventos da Ana como `ai` e permite exclusivamente uma confirmação
  curta de pedido de reunião quando o handoff humano continua obrigatório. Cotação, preço, prazo,
  opt-out, conteúdo sensível e demais bloqueios permanecem sem despacho automático.
- Publicado `automation-worker` v27: reconhece somente o marcador interno
  `meeting_confirmation` nas duas leituras de segurança do job, sem liberar outros jobs em
  atendimento humano. Também evita que uma falha local anterior a uma chamada de provedor seja
  herdada por uma futura confirmação segura.
- Com confirmação explícita do operador, a mesma mensagem já gerada foi reenfileirada — sem
  gerar outra resposta — e a Z-API aceitou o envio. A Central autenticada mostrou a resposta da
  Ana como **aceita pelo provedor**. Não há recibo de entrega/leitura nesta evidência.
- Validação local: type-check frontend e Edge, lint e build Vite passaram. A validação visual
  autenticada confirmou a mensagem no histórico e o provider message id foi persistido.

# 2026-09-18 — Dashboard: atenção do vendedor compacta

- O painel agora mostra somente categorias com itens reais, reduz a lista visível a duas ações por
  categoria e reúne o restante no acesso à Central.
- Cada alerta pertence somente à sua prioridade mais alta, evitando a duplicação entre “Responder
  agora”, “Leads quentes” e “Reuniões e orçamentos”. Ícones identificam urgência, interesse,
  ação comercial, acompanhamento e atraso.
- Não houve alteração de fontes de dados, regras comerciais, filas, automações ou integrações.
- Validação: type-check frontend, lint e build Vite aprovados.

# 2026-09-18 — Política de transferência da Ana por lead

- Implementei a seleção persistida de vendedor responsável, etapa canônica de transferência e
  opt-in de aviso WhatsApp no fluxo **Leads > Enviar para Kanban**.
- O banco oficial recebeu a política, a fila privada de avisos e a RPC com validação de função do
  usuário alvo. A checagem confirmou que não existe escrita/leitura direta da fila pelo frontend.
- Publiquei `team-members` v8, `ana-run` v29 e `automation-worker` v28. Não havia item na fila e
  nenhum envio externo foi disparado durante a validação.
- Testes aprovados: Vitest (5), type-check frontend/Edge, lint e build Vite.

# 2026-09-18 — Base comercial inteligente para Ana e Central

- Reaproveitei `documents`, `knowledge_chunks`, `ana-run`, a fila humana e a Central existentes;
  não criei segundo motor de IA, outro WhatsApp ou catálogo local paralelo. O antigo catálogo de
  Configurações agora indica a base canônica em Empresa e conhecimento.
- A migration comercial cria fontes, itens tipados, relações, importações e eventos da conversa
  com RLS/RBAC; a segunda migration acrescenta índices de FKs sinalizados pelo advisor. O trigger
  privado materializa apenas itens ativos/aprovados na memória já consumida pela Ana.
- `catalog-knowledge` v3 aceita apenas as três URLs Wayflex previstas e persiste estado/erro de
  sincronização. `enviar-whatsapp` v7 vincula conteúdo ao job humano idempotente; `ana-run` v30
  recebe intenção comercial sem ampliar seu poder de despacho.
- Central permite pesquisar, pré-visualizar e preparar produto, serviço, catálogo ou arquivo em
  formatos rápido/comercial/técnico. Sem pipeline homologada de mídia, PDF/imagem sai como link
  auditável, não como anexo alegado.
- Validações: type-check frontend/Edge, lint, build/artefato e os 2 testes de formatter passaram.
  A suíte completa pelo runner teve 197/198 êxitos; a falha única é pré-existente no contrato de
  diagnóstico Z-API. Na publicação inicial não houve sincronização remota, mensagem, job, lead
  ou chamada de IA.
- A primeira sincronização autenticada expôs `DOMParser is not defined` no Edge Runtime. O parser
  foi substituído por extração HTML portátil em `catalog-knowledge` v4, com dois testes de
  regressão. A repetição sincronizou `/acessorios`, `/servicos` e `/catalogos`: três fontes
  saudáveis e três itens rastreáveis ativos para a Ana e a Central. Como a origem não expôs cards
  individuais ou PDFs no HTML retornado, cada página entrou como um item de origem; nenhum dado
  comercial foi inventado e nenhum WhatsApp, job ou execução nova da Ana foi disparado.

# 2026-09-18 — Revalidação da Central e da base comercial atual

- O checkout foi sincronizado por fast-forward com a versão oficial mais recente antes de qualquer
  alteração, preservando as evoluções já publicadas da Central em três áreas e do catálogo
  contextual.
- A Central já atende ao fluxo solicitado: filtros e pesquisa de conversas, atualização ao vivo,
  histórico auditável, handoff, opt-out, agenda/orçamento pré-selecionados e catálogo pesquisável
  que apenas prepara texto/link para a fila humana existente.
- A suíte completa revelou uma única asserção incompatível com o matcher de lista do Vitest. O
  contrato foi corrigido para localizar explicitamente a verificação de webhook inválido; runtime,
  Edge Functions, Supabase, Z-API e fluxos comerciais não foram modificados.
- Validação: type-check frontend/Edge, lint, 25 arquivos/200 testes e build/artefato do Site
  passaram. Nenhuma mensagem, job, lead, integração, configuração da Ana ou dado comercial foi
  criado ou alterado.

# 2026-09-19 — Refinamento visual da Central de Atendimento

- A composição foi alinhada à referência fornecida: inbox à esquerda, conversa central com faixa
  de ações e contexto comercial mais largo à direita. A mudança é exclusivamente de apresentação.
- Cards de conversa, contexto do lead, orçamento e itens de conhecimento deixam de truncar o
  conteúdo: nomes, mensagens e descrições agora quebram linha e preservam o texto disponível.
- Catálogo, orçamento, agenda, handoff, opt-out, fila auditável e Realtime mantêm os mesmos
  handlers e fontes operacionais. Nenhum registro ou provedor foi chamado.
- Validação: type-check, lint, 25 arquivos/200 testes e build/artefato do Site passaram.
# 2026-09-21 — Reparo pendente de publicação: ativação atômica da Ana

- Reproduzido no Supabase oficial: o diálogo de Kanban não persistiu canal/consentimento do lead
  de homologação; não houve `agent_run`, job ou mensagem.
- Preparada uma ação server-side única em `lead-workflow`: valida consentimento explícito, fixa
  WhatsApp, persiste a ativação e chama somente `ana-run` com o evento canônico `lead.created`.
- Type-check frontend/Edge, lint, build Vite e 10 testes direcionados concluídos sem erro com
  `--configLoader runner`. Não publicar nem declarar homologado antes da validação autenticada da
  UI e do aceite do provedor.

# 2026-09-21 — Correção do bloqueio de ativação sem transferência humana

- A opção **Ana conduz tudo** não chama mais a RPC opcional de transferência humana antes de
  `lead-workflow.start_ai`. A ativação usa diretamente o comando server-side e limpa uma regra
  anterior de transferência no mesmo comando auditável.
- `lead-workflow` v5 foi publicada com JWT obrigatório. Validação local: type-check, lint,
  build Vite e 86 testes direcionados passaram. O novo envio real ainda precisa ser verificado
  pela UI e pelo aceite do provedor; não foi declarado entregue apenas pela publicação.

- Teste controlado executado para o lead de homologação autorizado: a ativação persistiu
  `active_channel=whatsapp`, consentimento aprovado e a execução `lead.created` da Ana concluída.
  A apresentação foi criada e enfileirada; o worker a manteve na fila por
  `outside_business_hours`, sem chamada ao provedor. Esse bloqueio é a política publicada,
  não uma falha de identidade de canal.

# 2026-09-22 — Consolidação dos provedores da Busca de Leads

- A repetição visual de Apify — Google Maps e Google Places em **APIs** e **Fontes** foi
  analisada. Não havia duas integrações equivalentes: `integrations` guarda conexão/teste e
  `lead_source_configs` é a permissão operacional que `prospectar-leads` exige no servidor.
- A tela **Fontes** foi removida da navegação. Em **Configurações > APIs**, cada provedor agora
  reúne configurar, testar conexão e ativar/pausar na Busca de Leads. A URL legada
  `?tab=fontes` é redirecionada para APIs; o Dashboard continua somente como resumo de status.
- Type-check frontend/Edge, lint, 26 arquivos/203 testes e build/artefato Sites passaram. Não
  houve escrita no Supabase, envio de mensagem, execução de busca nem acesso a segredo.

- Publicação concluída no Site oficial como versão 103, a partir do commit
  `ed5632b2a64e8e154b99f0e9f09063d7f1532681`. A validação autenticada confirmou a ausência do
  menu Fontes, o cartão único de Apify com a busca ativa e a compatibilidade de `?tab=fontes`.
