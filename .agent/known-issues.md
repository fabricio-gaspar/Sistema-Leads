# Problemas conhecidos

## Wizard da Busca de Leads — QA autenticada pendente — 05/10/2026

- A fonte isolada `87b9b8309eb8fc0fa4d47611c7a1315598fc4f76`, contendo o Wizard e a conexão WA-AKG pela Central, foi publicada no Site oficial v168; o deploy `appgdep_6ac3d1bec3e48191ba29a2d5559426a8` foi confirmado como `succeeded`.
- Ainda não houve inspeção visual autenticada. A prévia local sem `runtime-config.js` público não é evidência dessa tela; também não deve receber credenciais apenas para o teste.
- Próxima ação: conferir Fonte → Região → Perfil → Critérios em sessão autenticada, sem pressionar o comando de busca externa.

## Agenda comercial — homologação pendente — 29/09/2026

- A nova leitura, a migration e as validações locais estão confirmadas, mas não foi criado, editado, reagendado ou cancelado um compromisso comercial para teste. A homologação autenticada deve usar um lead e um compromisso explicitamente autorizados e reversíveis.
- Google Calendar e Outlook não estão conectados na organização oficial. A Agenda oculta sincronização e não declara entrega de lembretes; a conexão externa só pode ser adicionada quando existir integração real, credenciais no backend e testes de webhooks/idempotência.

## Canais de WhatsApp — limitações de homologação — 28/09/2026

- A interface e o contrato de diagnóstico estão validados localmente e a Edge Function v6 está ativa, mas não foi feito envio externo, callback de teste, recibo de entrega/leitura ou conexão Meta durante esta alteração. Esses estados permanecem não comprovados até um teste operacional explicitamente autorizado.
- O histórico apresentado é o recorte auditável recente (até 50 eventos), suficiente para diagnóstico imediato. Paginação operacional poderá ser adicionada somente se o volume auditado justificar a ampliação do contrato, sem inventar registros locais.

## Kanban operacional — pendências de homologação — 28/09/2026

- O banco, RLS, RPCs e testes locais foram validados, mas o frontend do Kanban ainda não foi publicado porque o envio do código ao repositório de hospedagem exige autorização explícita. A versão pública continua 144.
- Não foi feita uma mutação sobre lead comercial para testar drag, desfazer, tarefa, alteração de responsável, arquivamento ou resultado. Isso evita alterar a carteira, enviar mensagem ou ativar automação para fins de teste. Após publicar, a homologação deve usar um lead autorizado e reversível.
- O painel de Automações mostra apenas fluxos/configuração e execuções existentes. Ele não expõe um botão de reprocessar falha porque o runtime atual não oferece um contrato seguro de retry individual; não foi simulado um retry.

## API ativa não aparecia como seletor na Busca — resolvido em 27/09/2026

- A tela filtrava explicitamente somente `apify` e substituía o seletor por um selo quando havia uma fonte ativa. Agora Apify e Google Places são derivados das configurações operacionais, o seletor permanece visível e a leitura é atualizada ao abrir/retomar a tela.
- Google Places continua ausente enquanto não estiver conectado e ativo; isso é um gate correto, não falha visual. Nenhum teste de provedor foi disparado para validar o layout.

## Cumprimento simples transferido ao humano — 27/09/2026

- Depois do E2E real, a entrada **“Boa tarde”** foi recebida e processada, mas a decisão da Ana marcou confiança de 15%, abaixo do mínimo publicado de 20%, e abriu handoff humano sem resposta automática.
- Não é falha de WhatsApp, fila ou webhook. Ajustar essa decisão exige revisar a política de cumprimentos/baixa informação sem reduzir os gates técnicos gerais; nenhuma regra foi alterada neste teste.

## Trigger de propostas interrompia aceite de mensagens comuns — resolvido em 27/09/2026

- `project_proposal_delivery_after_message` usava `outreach_jobs.created_at`, coluna inexistente, ao reagir a qualquer mensagem marcada como enviada. Resolvido pela migration `20260927195156_fix_proposal_delivery_outreach_ordering`, aplicada como `20260927195241`.
- O aceite real já confirmado foi reconciliado sem reenvio. Job, mensagem e outreach ficaram `processed/sent`; saída e entrada foram comprovadas.

## Resolvedor da conta WhatsApp bloqueava Novo → Apresentado — resolvido em 27/09/2026

- Resolvido pela migration `20260927193046_fix_whatsapp_account_resolver_ambiguity`, aplicada no projeto oficial. A função qualificou os campos que colidiam com os nomes de saída de `RETURNS TABLE` e voltou a resolver a conta corporativa em teste transacional.
- A prova foi revertida e deixou zero resíduos; não houve envio externo. Como o lead afetado já havia sido excluído e a base estava vazia, ainda falta homologar com um novo lead controlado a transição real, o recebimento, os recibos e a resposta da Ana.

## Operação automática não salvava sem transferência por etapa — 27/09/2026

- Resolvido em `ana-operations` v5 e Site v139: o campo obrigatório `handoff_notify_whatsapp` não recebe mais `null` quando a etapa de transferência está vazia.
- A regressão cobre ausência de etapa, aviso explícito, modo humano e falso. A persistência real que ativa a agenda não foi repetida pelo agente, pois também libera a operação automática; o operador deve confirmar essa ação no botão **Ativar Automático**.

## Z-API desativada com sessão conectada — 27/09/2026

- Resolvido o falso estado `error`: a pausa administrativa não é mais tratada como desconexão da instância. A conta corporativa está fisicamente conectada e agora pode ser apresentada como **Pronto para ativar**.
- O bloqueio administrativo foi removido posteriormente pelo operador: saída e entrada aparecem prontas para a operação automática. A ausência de E2E real continua sendo a limitação, não a conexão ou a ativação do provedor.
- Ainda pendente: comprovar envio, callback individual de entrada, entrega/leitura e resposta da Ana depois da ativação autorizada. Não declarar o WhatsApp homologado apenas pela consulta de status.

## Redesign 27/09 — limitações abertas

- QA visual autenticada das 11 telas, responsividade e WCAG integral não homologadas. Build não é prova visual.
- A suíte Vitest integrada mais recente encerrou normalmente: 49 arquivos/306 testes aprovados, além do smoke determinístico 17/17. A execução anterior do checkpoint visual que não encerrou foi superada por essa validação.
- Conversão histórica completa precisa de snapshots/entrada inicial; a UI só mostra avanço observado. Leitura multi-tabela não é transacional; carteira/propostas usam polling 60 s. Agregação remota necessária para volume acima de 50 mil linhas.
- Agenda mantém fuso local legado; analítico São Paulo. Migração de fuso organizacional não executada. Nenhum gate externo foi liberado.

## Paleta global — 27/09/2026

- Nenhum defeito funcional novo foi encontrado. Temas de documentos continuam configuráveis pelo usuário e ícones de WhatsApp, Meta, Apify e Google preservam a identidade do provedor; essas exceções são deliberadas e não quebram a paleta do produto.

## Importação em lote — 25/09/2026

- A falta de atomicidade da revisão foi corrigida com RPC transacional e retry idempotente; sucesso e rollback foram comprovados em transações revertidas. A importação humana ponta a ponta no navegador permanece adiada a pedido do operador.

## Usuários e responsáveis — 25/09/2026

- Resolvido e publicado v123: a importação humana não escolhe mais `u-2` fictício. Recarrega membros
  ativos e permissão de criação antes de gravar; o banco rejeita owner fora da organização,
  inativo ou atribuição cruzada sem permissão. Interface autenticada mostrou os três membros
  reais e recusou importação sem seleção; console sem erros.
- Ainda não homologado: fluxo completo de atribuição humana em navegador com importação de novo
  lead (não criamos outro cadastro de teste). A importação em lote segue não atômica.

## Homologação da Busca — 25/09/2026

- Primeiro teste autenticado passou: revisão recuperada, mapa, importação de um lead, lista e
  vínculo persistidos após recarga, zero mensagens/jobs. Antes da correção, defaults de segmento/
  porte contaminavam o cadastro; a lista perdia a fonte ao retomar e contava total histórico.
- Correção de metadados e contagem publicada v121 e repetida com segundo lead: fonte Apify,
  categoria real, SP e porte nulo persistidos. Dois duplicados bloqueados, lista antiga vazia com
  total zero e envio ao Kanban desabilitado. Estados vazios conferidos. Zero mensagens/jobs.
- Clique no mapa revelou zoom vertical calculado com unidade duplicada (pixels multiplicados
  novamente por tile size); marcadores ficavam sobrepostos. Correção publicada v122 e retestada:
  mouse abriu o lead correto para Via Varejo e Galpão. 252 testes aprovados.
- Próxima etapa ORIGINAL: Usuários e responsáveis. O seletor da Busca usa mockUsers (u-2 etc.);
  não homologar atribuição humana/distribuição até trocar por membros reais e validar UUID/RBAC.

## Importação Busca → Leads — etapa 3, 25/09/2026

- Corrigido: erro ao persistir `lead_lists`/`lead_list_members` não é mais engolido pela
  fila local nem tratado como importação concluída. A tela mostra falha e impede uma nova
  submissão cega quando o resultado no banco pode ser parcial.
- Pendente: inserir vários leads e seus vínculos de lista ainda envolve operações separadas,
  não uma transação única. Após falha, conferir Leads antes de repetir. Não criar uma RPC de
  importação ampla sem especificar idempotência, permissões e preservação das regras atuais.
- Inspeção autenticada e importação controlada concluídas posteriormente nesta data; ver seção
  de homologação acima. A leitura anterior com zero leads é histórica.

## Busca Apify — etapa 2, 25/09/2026

- A perda do ID da busca ao recarregar e o encerramento do polling após dois minutos foram
  corrigidos por histórico autenticado e retomada explícita. A proteção do banco que impedia
  `running` → `completed` com cache foi corrigida cirurgicamente. Cinco execuções antigas estão
  concluídas e ligadas a 45 resultados já existentes. Dois caches sem vínculo seguro contêm mais
  dez resultados e são apresentados como histórico, sem alterar runs falhos.
- Raio exato, porte e cargo não são filtros comprovados do Actor Google Maps atual. Permanecem
  fora do formulário em vez de sugerir filtragem inexistente. Implementá-los exige geolocalização
  e dados empresariais verificáveis, sem inventar atributos.
- Revisão autenticada recuperada e duas importações conferidas posteriormente nesta data.
  Nova busca paga continua não executada; não confundir recuperação com ponta a ponta do Actor.

## Baseline factual — 25/09/2026, etapa 1

- GitHub `main` (`c4733b6`) e histórico do Site (`9bdd136`) não possuem ancestral comum
  em um clone não shallow; 604 arquivos diferem. O remote local chamado `official` é do
  Site, não do GitHub. Preservar ambos até reconciliação seletiva revisada.
- Cinco buscas Apify da Wayflex estavam `running` com ID do provedor no baseline. A etapa 2
  encontrou os caches correspondentes e concluiu os cinco registros sem chamar a Apify.
- Z-API e Meta estão explicitamente desativadas. A rotina diária também está desativada.
  Esse estado é intencional e não deve ser interpretado como falha a reparar por ativação.
- Não houve homologação externa nesta etapa. Os 238 testes aprovados cobrem contratos locais.
- Os itens abaixo são históricos e precisam ser confrontados com o manifesto atual antes de
  agir. Referência: `docs/BASELINE_ETAPA_1_2026-09-25.md`.

## Crítico

- **Homologação externa permanece bloqueada:** a sessão Z-API responde como conectada, mas o provedor continua administrativamente desativado e a entrada está pausada. A fila e a projeção de proposta são auditáveis, mas isso não comprova envio, entrega, resposta da Ana ou recibos. Ativar conscientemente e executar somente um teste individual autorizado antes de qualquer liberação automática.
- **Auth:** a proteção contra senhas vazadas continua desativada no projeto Supabase e é gate para a liberação comercial automática.

- O fluxo real WhatsApp → Ana → resposta ainda precisa de uma mensagem nova, individual, enviada
  do número final `1875` após o recadastro da entrada Z-API. A Z-API já comprovou alcance do
  WayFlex por callbacks de outros números, mas não entregou callback desse lead; a mensagem
  relatada não pode ser reprocessada e não houve falha da Ana a partir dela.
- A Central agora tenta despachar a mensagem humana imediatamente, mas a aceitação por uma
  instância Z-API real e a entrega ao número continuam dependendo do teste explícito do operador.
- O último teste recebido foi um callback de grupo e foi corretamente ignorado. A homologação
  segue aguardando uma mensagem individual enviada por um lead cadastrado.
- Um callback de entrega/leitura que chegue antes da persistência da aceitação do provedor pode
  ficar sem correspondência até o provedor repetir o callback. Não declarar entrega/leitura
  confiável antes de uma homologação específica.

## Alto

- O controle compacto da Dashboard está implantado, mas a ativação automática permanece intencionalmente bloqueada enquanto `whatsapp` e `zapi_webhook` estiverem pausados. Não contornar o gate; preparar o canal e executar homologação individual antes de ativar.

- A operação automática só pode ser ativada quando o diagnóstico confirmar a entrada operacional
  `zapi_webhook`. O painel agora consulta esse identificador real, não o rótulo legado
  `whatsapp_webhook`; enquanto a entrada estiver pendente, o bloqueio é intencional e não deve ser
  contornado.

- Base multimídia registra arquivos, mas não extrai de forma completa PDF/DOCX/PPTX/XLSX,
  OCR de imagem, áudio ou vídeo.
- O catálogo comercial compartilha PDF e imagem como URL rastreável pela fila humana já
  homologada. Anexo binário direto só deve ser adicionado após existir pipeline de mídia,
  recebimento e recibo comprovados; não declarar o card de catálogo como envio de arquivo nativo.
- As três fontes Wayflex foram sincronizadas e estão saudáveis, com uma página rastreável por
  fonte disponível para Ana e Central. O HTML retornado não expôs cards individuais nem PDFs;
  ampliar o catálogo depende de a origem publicar esses itens no HTML ou de um adaptador futuro
  autorizado para a estrutura real da fonte. O sistema não preenche essa lacuna com dados
  inventados.
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

- A limpeza de leads possui dois pontos de UI: a gestão geral em **Funil → Gerenciar base** e o painel
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
- O Vitest deve ser executado com `--configLoader runner` quando o ambiente não consegue
  percorrer a junção local de `node_modules`. Nesta cópia do projeto, `npm test` executou a suíte
  completa: 25 arquivos e 200 casos passaram.
- O advisor de segurança informa que `daily_lead_report_deliveries` possui RLS sem policy. Isso é
  intencional: todo acesso de navegador foi revogado e somente `service_role` do backend possui
  privilégio na tabela. Não adicionar policy de cliente para silenciar o aviso.

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

## Resolvido em 18/09/2026

- O contrato de diagnóstico para uma rota de callback Z-API invalidada usava um matcher parcial
  incompatível com a lista de verificações. A asserção agora procura explicitamente o check
  `whatsapp_webhook` e confirma que ele fica bloqueado. Não houve alteração no diagnóstico,
  backend, Z-API ou fila de mensagens.

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

- A camada de persistência do cliente podia ocultar uma atualização de lead rejeitada ou sem linha
  retornada. Isso foi corrigido: toda atualização operacional agora exige o `id` retornado pelo
  Supabase e a tela bloqueia `ana-run` se a gravação não for confirmada. A limitação externa restante
  é apenas o Vitest local, que não inicia pela permissão do destino de `node_modules`.

## Sugestões, não bugs

- Ambiente de homologação isolado e piloto controlado antes de comercializar.
- Backup/restore ensaiado e runbook de incidentes.

## Limitações conhecidas em 23/09/2026 — conhecimento comercial

- A página pública de **Segmentos e aplicações** carrega os cards de forma dinâmica e não oferece
  ainda uma fonte estruturada estável para reimportação pelo Edge Runtime. O sistema registra um
  snapshot público datado e rastreável, em vez de inventar campos; quando a origem oferecer API,
  feed ou marcação estável, o adaptador deve ser substituído.
- As páginas públicas atuais não oferecem PDFs individuais para os 17 catálogos visuais. As imagens
  e links permanecem referenciados à origem oficial; não há cópia de mídia no Storage nem alegação
  de arquivo anexado. O envio segue como texto/link até a homologação de mídia.

## 2026-09-21 — Ativação sem handoff

- O caminho **Ana conduz tudo** agora evita uma dependência desnecessária da RPC de handoff.
  A política antiga é removida no comando autenticado `lead-workflow.start_ai`; o teste ponta a
  ponta do aceite da Z-API continua pendente até a ação controlada no painel.

- O teste controlado não alcançou a Z-API porque a configuração da Ana mantém
  `businessHoursOnly=true` e o worker registrou `outside_business_hours`. A fila está preservada
  para a próxima janela permitida; não foi burlada nem despachada fora da política.

## 2026-09-23 — Homologação pendente de WhatsApp individual

- O suporte técnico para conta Z-API por vendedor está publicado no backend e coberto por testes,
  mas o estado real auditado possui dois administradores e nenhum usuário vendedor. Portanto, não
  foi possível comprovar uma conexão individual por QR, envio, recebimento ou recibo de entrega.
- A primeira homologação exige um vendedor ativo, uma instância Z-API já contratada e as credenciais
  registradas pelo administrador no Vault. O próprio vendedor precisa concluir o QR/telefone no
  conector oficial. Essa pendência não afeta a conta corporativa existente nem o fluxo atual da Ana.
- Os avisos de performance remanescentes do advisor são anteriores e não pertencem às novas chaves
  de conta WhatsApp; os índices introduzidos nesta mudança eliminaram os avisos das novas FKs.

## 2026-09-24 — Gates externos pendentes para Meta Coexistence

- A fundação Meta está implantada, mas propositalmente inativa: não há Meta App/WABA/número
  conectado, credenciais oficiais configuradas, sincronização de histórico nem teste real de
  template, envio, recebimento ou recibo. Nada disso deve ser declarado homologado antes do Gate 3.
- A criação da branch remota `sync/site-production-2026-09-24` no GitHub continua pendente porque
  este host não possui credencial GitHub. A branch local
  `feat/meta-coexistence-foundation-2026-09-24` e seus commits foram preservados; `main` não foi
  alterada e não houve reset, rollback ou force push.
- O advisor ainda lista sete FKs antigas sem índice e achados antigos de segurança; nenhuma FK nova
  da fundação Meta aparece nesse grupo. A correção do legado deve ocorrer em lote próprio para não
  misturar risco com a integração.
# Resolvido em 27/09/2026 — orientação da Operação automática

- A ativação automática retornava uma mensagem genérica mesmo quando o backend conhecia quais gates estavam pendentes. A tela agora mostra cada requisito, o motivo e o destino exato de correção, sem afrouxar o bloqueio operacional.

## 2026-09-28 — Limitações honestas da Central operacional

- A implementação não expõe **Encerrar atendimento**, filtro por tags ou fila genérica: o modelo
  atual não tem contrato único auditável para encerramento, tags de lead ou distribuição por fila.
  Esses controles foram ocultados em vez de simular persistência.
- As três respostas rápidas são textos editáveis antes do envio, mas ainda não existe uma tabela
  administrativa de templates da Central. Não devem ser descritas como modelos configuráveis por
  empresa até que essa fonte governada exista.
- A homologação autenticada de concorrência, handoff, tarefa, bloqueio, entrega/falha de mensagem,
  RLS cruzada e mobile exige um lead de teste e operadores explicitamente autorizados. Nenhuma
  dessas ações foi feita sobre um lead comercial nesta etapa.
