# Histórico resumido de execução

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

## 2026-09-13 — Mapa visual de decisão da Ana

- A navegação dos seis passos de Configurar a Ana foi convertida em um mapa interativo responsivo.
  Os blocos reutilizam `setStep` e o formulário existente; save, publicação, repositório e payload
  não foram modificados.
- O diagrama representa a base aprovada por catálogos, segmentos e acessórios, o caminho de
  qualificação, as decisões de reunião/orçamento e cadência/handoff, a revisão final e o pipeline
  canônico. Estado publicado e alterações pendentes continuam derivados dos dados reais da tela.
- Type-check frontend/Edge, lint, 15 arquivos/159 testes e build passaram. Não houve operação no
  Supabase, envio de mensagem, alteração de integração, segredo ou dado operacional.
