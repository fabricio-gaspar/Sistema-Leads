# Problemas conhecidos

## Crítico

- Fluxo real WhatsApp → Ana → resposta não foi homologado ponta a ponta com número autorizado.
- A Central agora tenta despachar a mensagem humana imediatamente, mas a aceitação por uma
  instância Z-API real e a entrega ao número continuam dependendo do teste explícito do operador.
- O último teste recebido foi um callback de grupo e foi corretamente ignorado. A homologação
  segue aguardando uma mensagem individual enviada por um lead cadastrado.
- Um callback de entrega/leitura que chegue antes da persistência da aceitação do provedor pode
  ficar sem correspondência até o provedor repetir o callback. Não declarar entrega/leitura
  confiável antes de uma homologação específica.

## Alto

- Base multimídia registra arquivos, mas não extrai de forma completa PDF/DOCX/PPTX/XLSX,
  OCR de imagem, áudio ou vídeo.
- Testes E2E autenticados e roundtrips reais de WhatsApp/Claude/provedores opcionais faltam.
- RLS entre duas organizações e operações transacionais principais foram testadas; não substituir
  isso por uma afirmação de homologação externa.
- Os registros de auditoria históricos são append-only no banco. A limpeza proposta preserva
  esse histórico de governança e só remove os candidatos que o operador selecionar e confirmar;
  até essa confirmação, nenhum dado operacional é apagado automaticamente.
- A última revalidação do worker ocorre antes da chamada externa; uma tomada humana entre essa
  leitura e o provedor ainda é uma janela TOCTOU residual.
- Alterar a configuração publicada da Ana governa novas saídas; um timeout de ausência de
  resposta já agendado não é reavaliado/rearmado retroativamente.
- O novo modo Automático está implementado, porém permanece desativado e em Simulação até o
  operador salvar a rotina e comprovar o ciclo externo Apify → WhatsApp → resposta → Ana.
- Notificações imediatas no painel e resumo diário estão implementados; aviso opcional ao vendedor
  pelo próprio WhatsApp não foi ativado sem número de destino e homologação específica do canal.
- A entrada pelo site foi implantada, mas ainda não recebeu configuração de número e link por um
  administrador nem callback externo de validação. Ela não deve ser declarada homologada antes de
  um teste controlado com o marcador do link.

## Médio

- A limpeza de leads possui dois pontos de UI: a Base de Leads geral em **Leads** e o painel
  legado **Limpar leads de teste** em Configurações. Eles têm escopos diferentes, mas ambos
  chegam ao mesmo grafo de exclusão; o legado ainda usa `window.confirm`. Não removê-lo sem
  decisão explícita sobre manter a limpeza restrita de testes ou consolidá-la no gerenciador geral.
- Parte do painel ainda importa tipos e presets de `mocks`; é preciso separar tipo de dado
  simulado e remover qualquer seed do runtime de produção.
- Callbacks de entrega/leitura aguardam reconciliação específica.
- O módulo secundário de Equipe ainda não calcula tempo de resposta por timestamps; o painel
  agora informa a indisponibilidade em vez de exibir números simulados.
- O Auth do Supabase permanece com proteção contra senhas vazadas desativada.
- O advisor aponta 111 índices sem uso; aguardar janela representativa antes de remover qualquer um.
- Funções RPC de handoff usam `SECURITY DEFINER` intencionalmente para efetivar a operação
  transacional sob RLS, com validação de membro, organização e papel no corpo da função.
- O Vitest não consegue iniciar neste worktree por uma junção de `node_modules` que aponta para
  uma pasta sem permissão de leitura do esbuild. Type-check frontend/Edge, lint e build passaram,
  mas os novos testes de contrato aguardam correção desse ambiente local.

## Resolvido em 13/09/2026

- A falha posterior ao aceite Z-API foi localizada nas formas SQL especiais
  `pg_catalog.coalesce/nullif`. As funções atômicas foram corrigidas e a rotina
  `reconcile_provider_accepted_outreach` finaliza somente registros com identificador do
  provedor comprovado, sem fazer nova chamada externa. Seis jobs históricos foram conciliados.

## Resolvido em 14/09/2026

- A criação direta de membro chamava o Auth antes de preparar o vínculo com a organização. O
  gatilho de onboarding criava uma organização pessoal e o membro não aparecia na equipe WayFlex.
  `team-members` v4 inverteu a ordem, usa `organization_invites` e restaura a autorização em falha.
  O cadastro de Juca foi reparado e confirmado na lista autenticada.

## Resolvido em 17/09/2026

- O teste direto de WhatsApp falhava com `whatsapp_test_reservation_failed` depois de a instância
  Z-API já ter sido validada, mas antes da chamada ao provedor. A causa era a qualificação inválida
  de `coalesce` e `nullif` como se fossem funções `pg_catalog` na reserva idempotente.
- A migration `20260917150914_fix_whatsapp_direct_test_reservation_special_forms` usa as formas
  especiais corretas, preserva `security invoker` e o `EXECUTE` exclusivo de `service_role`.
  O teste transacional retornou `reserved`, foi revertido e não deixou auditoria nem disparou envio.
- Ainda falta o operador executar um teste externo controlado para comprovar o aceite da Z-API;
  a correção interna não é evidência de entrega ou leitura de WhatsApp.

- **Novo Lead** bloqueava a criação no navegador quando o modo Ana era selecionado, antes de
  alcançar o Supabase: exigia duas caixas de confirmação e uma origem de autorização. A consulta
  no projeto oficial confirmou que não havia duplicidade para o formulário analisado e que a
  permissão `leads.create` estava concedida. O formulário agora grava contato pendente, sem
  declarar telefone como WhatsApp e sem acionar a Ana. A aprovação comprovada continua obrigatória
  no backend antes do primeiro contato.

- Um lead manual pendente recebia corretamente o modo Ana e a responsabilidade, mas era ocultado
  do Kanban pelo filtro de `aguardandoAtivacao`; por consequência, não existia fila, execução da
  Ana ou mensagem para o registro analisado. O Kanban agora mostra o cartão em **Novo** com o
  estado explícito de autorização pendente e bloqueia os botões de execução até a aprovação.
  A migration `20260917175303_fix_pending_manual_lead_phone_identity` também remove a inferência
  incorreta de WhatsApp a partir de telefone e corrigiu somente o registro manual pendente afetado.

- Um lead já autorizado podia ser ativado para a Ana com `active_channel=email` quando o formulário
  também possuía e-mail. A versão anterior de `ana-run` registrou corretamente a execução como
  `skipped`, com motivo `channel_not_allowed_by_ana_configuration`: a configuração publicada só
  permite WhatsApp e a integração de e-mail está desconectada. A ativação agora fixa WhatsApp como
  canal operacional, usa uma idempotência por canal e reporta bloqueio de forma explícita. `ana-run`
  v25 produz a apresentação institucional canônica no primeiro contato e avança somente de Novo para
  Apresentado, antes de enfileirar a mensagem. O envio real permanece pendente de confirmação do
  operador e de aceite comprovado da Z-API.

## Sugestões, não bugs

- Ambiente de homologação isolado e piloto controlado antes de comercializar.
- Backup/restore ensaiado e runbook de incidentes.
