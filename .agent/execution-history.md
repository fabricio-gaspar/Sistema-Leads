# Histórico resumido de execução

## 09/10/2026 — Ativação WA-AKG por permissões existentes

- Implementada e publicada a Edge wa-akg-worker v10 com ativação automática de conta individual somente após confirmação direta da sessão e validação do proprietário ativo com channels.view_own e channels.connect_own. A transição reutiliza o lifecycle durável; falhas de permissão, membro ou lifecycle mantêm a conta bloqueada.
- A mudança não grava nem flexibiliza messaging_provider_controls. Entrada, resposta humana e Ana continuam condicionadas ao teto administrativo global e às autorizações de cada ação.
- Teste red/green, 32 testes focados, 643/643 Vitest, type-check Edge, lint dirigido e diff check passaram. Não foi feita ativação E2E com telefone porque o dispositivo de final divergente foi desvinculado; estado final seguro: conta/integracão desabilitadas/pausadas, controles falsos e kill switch ativo.

## 09/10/2026 — Reconciliação automática de CONNECTED do WA-AKG

- Causa comprovada: após o pareamento, o gateway confirmava a sessão individual conectada, mas não emitia connection.update utilizável durante o replay de histórico; por isso o CRM continuava em qr e sem final de número.
- A fonte remota ativa do worker foi usada como base para evitar regressão no processamento de histórico. A Edge wa-akg-worker v9 acrescenta uma reconciliação monotônica: consulta apenas contas WA-AKG locais inativas, valida o session id determinístico, exige confirmação direta do gateway e grava somente connected e o final normalizado do número.
- Verificação: teste red/green novo; 30 testes focados e 641/641 Vitest passaram; Edge type-check, lint dirigido e diff check passaram. A execução automática persistiu a conexão e a tela publicada mostrou **Conectado**, connected e **Final 1875**.
- Segurança: conta e integração seguem desabilitadas/pausadas; Ana protegida. Não houve QR, novo pareamento, envio, automação ou mudança de dados de clientes.

## 09/10/2026 — WA-AKG: recuperação segura publicada e confirmada

- Commit `83b5335` foi validado localmente (43 testes focados, type-check app/Edge, lint, build e diff check), enviado ao GitHub e sincronizado na fonte isolada do Site. O Site público existente foi preservado e a versão 180 publicou com sucesso.
- A migration de recuperação restrita e a Edge `wa-akg` foram aplicadas. O diagnóstico consultou o gateway sem iniciar sessão, gerar QR ou enviar mensagens e confirmou sessão desconectada pronta para QR, webhook e proteções. A reconciliação auditada levou somente a conta para `qr` e preservou conta, histórico, integração desligada/pausada e Ana protegida.
- Consulta posterior confirmou lifecycle `completed` na revisão 22; painel mostrou gateway acessível e `SCAN_QR`. Não houve QR, pareamento, mensagem, ativação da Ana ou teste de entrega. Próxima ação é exclusiva do titular: gerar QR, escanear no telefone pretendido e atualizar o status antes de um teste controlado de entrada.

## 07/10/2026 — Versionamento/publicação: validação concluída

- Checkout e `main` preservados, HEAD `574c930`. GitHub `main` conferido por connector/fetch: `7a3a6c0b1b6330e89ef547a33363789cbfb63399`; histórico sem ancestral comum, `origin` é Sites. Nenhum remote alterado, branch criado ou force push.
- 198 testes focados, SQL 11+9, type-check app/Edge, lint, build Vite/artefato Sites e diff check passaram. Após alinhar duas expectativas obsoletas de `DashboardLayout.test.ts` ao destino/menu unificado da Central, a suíte completa passou: 800/800 testes em 97 arquivos.
- Manifesto e consulta confirmam Site real ativo/público, versão 168 e URL oficial. O commit/push e a publicação deste lote seguem para a etapa seguinte; permanece o bloqueio de publicação isolada do frontend de cadastro direto com backend incompatível. Sem credenciais no delta verificado; pnpm alternativo/provisório permaneceu fora do staging.


## 07/10/2026 — QR Flavio diagnosticado; mitigação Edge v25

Capturada resposta dos logs apesar de falha visual do API Tester. O ID do Vault é o atual e difere do job histórico. Logs atuais confirmam saturação PostgreSQL, inclusive após teste final como Flavio. Removidos retries no checkout; publicado delta v24→v25 apenas no QR/classificação de erros. 67 testes locais + 8 do bundle remoto, tipos Edge e diff check passaram; fonte remota relida. QR real FALHOU. Acesso ao painel da hospedagem/SSH solicitado; API Tester fornecido não administra PostgreSQL. Sem mensagem, automação, cliente ou instância alterada.


## 07/10/2026 — Remoção do convite administrativo e pré-flight de exclusão total

No checkout atual, Configurações → Usuários foi simplificado para o cadastro direto existente e as abas/filtros/consulta de convites foram removidos apenas da prévia local. Teste de regressão novo: 1; suíte focada: 10/10; type-check, lint direcionado, Vite build, diff check e inspeção autenticada passaram. O banco oficial foi consultado somente para contagens e FKs: Flavio ainda tem Auth, sessão, perfil, convite antigo aceito e reivindicação finalizada, mas nenhum vínculo ou job/conta Evolution GO. A exclusão de Auth e de registros comerciais aguarda resposta sobre escopo e alvo; nada foi apagado, criado ou publicado. O bundle de cadastro direto continua não aplicado no backend oficial.

## 07/10/2026 — Teste de recuperação do vendedor Flavio interrompido com segurança

O mesmo e-mail já tinha identidade Auth confirmada, sem vínculo organizacional nem conta/job Evolution GO. A senha informada autenticou em navegador separado, mas a UI parou em Convites pendentes. Após atualização, o Manager Evolution GO mostrou zero instâncias; a reivindicação da remoção anterior está `finalized`. Inspeção do Supabase oficial: `team-members` v20 não tem `pending_invites`; as RPCs R4 não estão aplicadas; o caminho remoto de convite possui compensação que pode excluir uma identidade Auth existente. Um botão local de recuperação foi preparado, porém retirado antes do envio ao descobrir o risco. Nenhum convite, senha, vínculo, instância, mensagem ou dado de cliente foi alterado. Próxima ação: homologar um contrato de recuperação de identidade existente sem exclusão compensatória e o lifecycle Evolution GO, depois repetir o teste; QR remoto ainda requer diagnóstico próprio.

## 07/10/2026 — Painel administrativo Evolution GO sem duplicidade em Usuários

`UsersAccessWorkspace` e `WhatsAppEntriesTab` montavam o mesmo `EvolutionGoPanel` administrativo. A pedido do usuário, a montagem foi removida somente de Configurações → Usuários; Configurações → Canais mantém servidor e conectores, e a Central conserva o pareamento individual do vendedor. Dois testes focados, type-check, lint direcionado, build Vite, diff check e inspeção autenticada da prévia local passaram. Apenas frontend local: sem alteração de banco, Edge, Site, instância, mensagens ou clientes.

## 07/10/2026 — Exclusão segura de membro e instância Evolution GO

Falha real identificada: `team-members` v19 atualizava `audit_logs` imutável após purgar parte dos dados do vendedor. Fluxo isolado implantado: migrations `20261007181410_team_member_evolution_removal` e `20261007182226_team_member_evolution_removal_metadata`, Edge `team-member-evolution-removal` v3 e proxy de `remove` em `team-members` v20; histórico, contatos e tombstone da conta são preservados. O segundo ajuste aceita metadado ainda vazio em contas não pareadas; v3 valida exclusividade do conector antes de desativá-lo. Vitest focado, type-check, lint, build, privilégios e prévia do diálogo aprovados. Flavio não foi excluído no teste: Auth/membership ainda 1/1, leads 20, remoção reivindicada 0. Login global não é apagado neste contrato; aguarda decisão explícita. Site oficial não recebeu frontend novo; nenhuma mensagem ou automação foi disparada.

## 07/10/2026 — Cadastro direto em Usuários (local)

Comparado `225a379` com HEAD `52ac6fe`: a remoção do formulário com senha e o bloqueio `create` explicam a regressão. Implementação local restrita ao fluxo Usuários/Auth/vínculo vendedor, com RPC transacional e preflight que impede criação parcial por backend incompatível. Supabase oficial consultado somente para leitura: sem gatilho Evolution GO, sem bootstrap Auth compatível e `team-members` v19. Testes focados e PGlite passaram; prévia mostrou campos sem submissão. Nenhum deploy ou dado real alterado. Próxima etapa: homologação isolada/release coordenada depois do diagnóstico QR.

## 2026-10-07 — Tentativa autorizada de ler logs Evolution GO

- A consulta aos logs da instância vinculada foi autorizada. O Manager mostrou apenas sua interface estática; `/swagger/doc.json` e a busca de instâncias expiraram em 30 segundos, e o detalhe exibiu ausência após erro de rede. Consulta HTTPS independente também expirou sem status. Nenhum log da instância pôde ser lido; ausência remota não foi confirmada.
- Sem alteração de instância, token, banco, Edge, Site, clientes, mensagens ou automações. Próximo passo: recuperar a API Evolution GO na hospedagem e então consultar os logs da instância antes de qualquer nova tentativa de QR.

## 2026-10-07 — Falha do QR Evolution GO, correção local isolada

- Foi confirmada na Edge oficial v24 a recusa HTTP 400 de `/instance/qr`; o Manager mostra a única instância do vendedor em `close`. O código local tinha outro defeito: fazia `POST /instance/connect` na ação de QR, então uma falha posterior do QR podia virar `needs_review` e esconder a causa. A fonte Go 0.7.2 mostra erros distintos e que a própria rota QR inicia a instância quando falta cliente.
- `1bd2786` separa o QR temporário da intenção mutante, preserva isolamento/guarda administrativa e mostra erro seguro e específico. 99 testes focados/9 arquivos, type-check app/Edge, lint, build, PGlite 6/6 e diff check passaram. A sessão local aberta é administrativa; login/scan do vendedor e QR real não foram homologados.
- Não houve deploy de Edge/migration/Site, envio, automação ou alteração de dados de clientes. Próximo: diagnóstico dos logs do runtime remoto, staging coordenado e E2E com vendedor/celular consentidos; não ativar canal com base apenas nos testes locais.

## 2026-10-07 — Navegação Evolution GO unificada na Central de Atendimento

- O menu lateral passou a expor uma única entrada: **Central de Atendimento**. A entrada **Meu WhatsApp** deixou de ser exibida, mas sua URL antiga continua compatível e redireciona para a Central.
- A nova porta `AtendimentoEntry` mantém a separação de RBAC: quem tem permissão de conversas monta a Central completa, com histórico, handoff humano e Ana; quem tem apenas permissão do próprio canal monta somente o painel individual Evolution GO. Nenhuma permissão de conversa foi ampliada.
- O onboarding após login também passa a abrir a Central. Foram atualizados os textos administrativos para não orientar vendedores a um item de menu inexistente. Não houve alteração de banco, Edge Function, QR, instância, Ana, mensagens, automação, dado de cliente ou Site.
- Validação: type-check do app, ESLint direcionado, Vitest focado (3 arquivos / 10 testes), build/artefato e `git diff --check` aprovados. A prévia autenticada confirmou um único item no menu, o painel Evolution GO dentro da Central, Central/Ana preservadas e o redirecionamento legado. Código local: `3d68349`.

## 2026-10-06 — Substituição autorizada da instância Evolution GO individual

- A Edge administrativa isolada `evolution-go-recovery` v2 confirmou organização, vendedor, servidor, estado desativado, nome/ID remoto e token recusado; excluiu a instância desconectada antiga `949dfffe-00d5-4110-bf64-85f107a8bb24` e criou uma nova `77c6344c-23d0-48a9-81e6-9c0a5177b2f8` para a mesma conta. Novo token e segredo de webhook foram guardados no Vault, sem expor os valores. Início e conclusão auditados.
- A leitura posterior confirmou ID novo e token aceito; vendedor iniciou conexão e webhook foi registrado. QR falhou: logs da Edge `evolution-go` v22 mostram `/instance/qr` 400 e `/instance/reconnect` 500 (sinal de sessão). Conector, saída, entrada e Ana permanecem bloqueados; nenhum celular pareado e nenhuma mensagem real enviada. Não repetir exclusão/criação para tratar erro de runtime do QR.
- 41 testes focados, type-check app/Edge, lint, build e diff check passaram. A suíte geral ficou 521 aprovados / 249 falhas por resolução local de `npm:` nos testes Edge. Site oficial inalterado. Próxima ação: diagnosticar o runtime remoto do QR e reconciliar o bundle `evolution-go` v22 divergente antes de um hotfix cirúrgico; não ligar autorrecriação automática até existir monitor multi-tenant idempotente homologado.

## 2026-10-06 — Revalidação do vínculo individual Evolution GO

- O Manager autenticado passou a exibir uma instância desconectada com o nome reservado do vendedor, mas ID e impressão digital do token diferentes dos guardados no Vault. `Validar status` ainda retornou HTTP 401; o vínculo do vendedor permanece ativo e a conta/canal continuam desligados. Nenhuma instância, segredo, job ou conversa foi alterada.
- A exclusão/recriação e o monitor de autorreparo não foram executados porque há agora uma instância remota com o mesmo nome: um POST ou DELETE cego pode apagar sessão ou duplicar vínculo. Escolha do titular entre preservar/reconciliar e excluir/recriar foi solicitada. Depois, implementar recuperação idempotente e homologar antes de agendar a verificação automática; novo QR exigirá leitura pelo vendedor.

## 2026-10-06 — Diagnóstico do QR Evolution GO do vendedor

- Consulta ao job/conta/segredo (somente presença e igualdade, sem ler valores) e logs remotos confirmou `awaiting_qr` antigo e HTTP 401 do token individual em `/instance/status`. Manager autenticado está vazio; a chave global autentica `/instance/all`. Trigger Evolution GO remoto ausente e `team-members` v19 ainda usa wake-up WA-AKG.
- Frontend local passou a mostrar o erro real, rotular o nome como reservado e impedir QR/pareamento repetidos após 401. Prévia autenticada, 39 testes focados, type-check e diff check aprovados. Nenhuma instância, QR, mensagem, automação, migration, Edge ou Site foi aplicada neste lote.
- Próxima ação: release coordenada de lifecycle e reconciliação administrativa do job/servidor antes de uma única tentativa de criação.

## 2026-10-06 — Botões administrativos do servidor Evolution GO restaurados

- Comparação dirigida da Edge remota v21 com o contrato local identificou `save_server`/`test_server` ausentes. Implantação seletiva preservou a função remota e adicionou as ações e metadados públicos em `evolution-go` v22; o worker v5 recebeu gate de validação corporativa aprovada e removeu o fallback de ambiente.
- A prévia autenticada abriu os campos URL HTTPS/chave global e executou teste real `GET /instance/all` com a credencial já no Vault. Resultado: servidor autenticado, estado persistente após atualizar, integração ainda desativada/desconectada/pausada. 59 testes focados, type-check Edge e diff check aprovados; sem QR, mensagem, automação, migration ou Site.
- Próxima ação: homologar separadamente lifecycle multi-tenant e QR antes de qualquer liberação operacional ou publicação do frontend no Site.

## 2026-10-06 — Checkpoint local do lifecycle multi-tenant Evolution GO

- O ciclo de vendedor foi consolidado no checkout: o trigger do vínculo cria/reconcilia somente a conta privada, integração desabilitada e **job único por organização/usuário**; o worker é acordado a partir do job já durável. O vendedor tem self-service exclusivamente para a própria conta/pareamento, sem segredos. Histórico de conversa e mensagens permanece preservado após desconexão ou desativação.
- Validação consolidada: **769 Vitest/93 arquivos**, type-check app e Edge, lint, build/artefato, PGlite **6/6**, PostgreSQL nativo **2/2** e diff check aprovados. Nenhum QR real, chamada a provedor, mensagem, automação ou dado de cliente foi criado/alterado.
- Não houve aplicação ao Supabase, Edge, Site ou GitHub. O bloqueio não é de UI local: há drift remoto de schema/bundles/Edge e é necessária homologação coordenada em staging com identidades/números consentidos. O gateway Evolution ainda retorna QR 400/500 e a política de proteção contra senhas vazadas/Auth permanece pendente; não publicar lote isolado.

## 2026-10-06 — Diagnóstico de `save_server` Evolution GO

- Leitura da função oficial v21 confirmou ausência de `save_server`/`test_server`; logs remotos confirmaram `unsupported_action` para duas tentativas `save_server`. A recusa ocorre antes do contato com o provedor e foi escondida pela mensagem genérica do frontend. O worker remoto v4 não aplica o novo gate `server_validation`, impedindo publicação isolada segura do endpoint.
- O código local detecta a falta do contrato no estado remoto, bloqueia configuração/teste e mostra aviso específico; se ainda receber `unsupported_action`, não repete a solicitação. A prévia autenticada mostrou **Backend incompatível** e ambos os botões desabilitados. 29 testes focados, 329 testes frontend, type-check, lint, build e diff check aprovados. Nenhuma credencial foi reenviada pelo agente; nenhuma Edge Function, worker, Site, mensagem, QR, automação ou dado de cliente foi alterado.
- Próxima ação: homologação isolada da função e do worker com gate de validação, aplicação coordenada e teste real de `save_server`/`test_server` antes de afirmar conexão.

## 2026-10-06 — Evolution GO: servidor no administrador, pareamento no vendedor

- O painel compartilhado passou a separar por modo: Configurações → Canais mostra configuração/teste do servidor corporativo e estado/controle dos conectores; Central → Meu WhatsApp mostra conta, instância não secreta, orientação e ações de pareamento somente para o próprio vendedor. Não houve modificação de API, banco ou contratos de permissão.
- Prévia autenticada de Configurações confirmou o cartão do servidor acima dos conectores e ausência de QR e ações de pareamento administrativo. Type-check, lint, build, 325 testes frontend e cinco focados passaram. A suíte completa foi bloqueada em testes Edge preexistentes pela importação `npm:@supabase/supabase-js@2.57.4` não resolvida pelo Vitest local. Site/Edge inalterados; nenhuma conexão, mensagem, automação ou escrita de cliente.
- Próxima ação: homologar a tela com sessão de vendedor e servidor Evolution GO isolado, depois coordenar release de frontend/backend conforme o NO-GO de produção vigente.

## 2026-10-06 — Evolution GO visível em Configurações → Usuários

- `7f95c82` reutiliza o gerenciador administrativo existente na aba Membros; nenhum fluxo, permissão, segredo ou regra de mensageria foi duplicado.
- A prévia autenticada revelou preflight 403 nas funções remotas `evolution-go` e `team-members`, apesar do helper local já corrigido. Ambas receberam somente o `_shared/http.ts` já publicado em `operational-diagnostics` v19: `evolution-go` v21 e `team-members` v19, com JWT preservado. Após recarga, a tela exibiu contas reais e quatro membros.
- Type-check frontend/Edge, lint direcionado, build Vite, 48 testes focados e diff check aprovados. Site oficial permanece inalterado; QR, pareamento, mensagens, automações e dados de cliente não foram acionados. Homologação integrada continua pendente.

## 2026-10-06 — Conceito visual de referência aplicado localmente

- A referência foi consultada somente para hierarquia, ordem visual e estilo. `48478de` adapta o shell já existente: sidebar clara agrupada, topbar compacto, cards e superfícies mais leves, chamadas primárias verdes com contraste validado e navegação de telas já existente reposicionada no cabeçalho.
- Não foram criados nem renomeados módulos, telas, rotas, permissões, dados ou ações. **Dashboard, Busca de Leads, Leads, Kanban, Central de Atendimento, Agenda, Orçamentos, Funil, Relatórios e Configurações** mantêm exatamente a taxonomia atual; Configurações preserva os nomes e usa o seletor compacto até 2xl para não disputar largura com a barra lateral global.
- Validação: type-check frontend, lint, Vitest completo 93 arquivos/746 testes, Vite build/artefato Sites e `git diff --check` aprovados. Prévia local de Configurações e Dashboard conferida no desktop; busca de telas confirmou resultado e estado vazio sem alterar o breadcrumb. Sem banco, Edge, mensagens, automações, dados de cliente ou publicação do Site.

## 2026-10-06 — Configurações: contingência de provedores reorganizada localmente

- O defeito foi isolado em **Canais > Provedores legados e contingência**: um `details` fechado escondia toda a área; Z-API e Meta apontavam para âncoras sem alvo; os breakpoints de grades aninhadas comprimiam cards ao lado da barra lateral.
- `26c1626` converte a área em três estágios sempre visíveis, cria os destinos reais de configuração, preserva todos os handlers existentes, evita coluna estreita para Z-API e coloca WA-AKG como contingência individual em largura integral. Meta passa a informar claramente que está aguardando homologação quando o gate estiver desabilitado; nenhuma regra ou gate foi alterado.
- Validação: Vitest completo 93 arquivos/743 testes, type-check frontend, lint dos arquivos afetados, Vite build/artefato Sites e `git diff --check` aprovados. Prévia autenticada conferida em desktop e 390x844, sem overflow horizontal; o atalho Z-API navegou ao card. Sem conexão, validação, mensagem, automação, dado de cliente, migration, Edge ou publicação do Site.

## 2026-10-06 — Configurações: disposição responsiva dos cards corrigida localmente

- A intervenção ficou limitada ao frontend de Configurações. Canais acumulava configuração, diagnóstico, histórico e contingências na mesma sequência; a ação do cabeçalho era repetida. Em Status operacional, a tabela preservava largura mínima e extrapolava a viewport mobile.
- `2b7ddd9` divide Canais em **Configuração**, **Diagnóstico** e **Histórico**, deixa a contingência recolhida e mantém as ações no contexto correto. A tabela operacional passa a cartões com rótulos e menu de ações preservado no mobile. O estado gravado **Não configurada** é separado visualmente do rascunho **Ativa ao salvar**.
- Validação: Vitest completo 93 arquivos/743 testes, type-check frontend, lint do módulo, Vite build/artefato Sites e `git diff --check` aprovados. Prévia autenticada conferida em Canais (mobile e desktop), Diagnóstico (mobile) e Status operacional (mobile), sem overflow horizontal. Nenhum dado, regra, integração, backend, automação, mensagem, migration, Edge ou Site foi alterado.

## 2026-10-06 — Configurações: uso operacional de provedores corrigido localmente

- A causa ficou restrita ao cartão de APIs: o switch era desabilitado antes de poder abrir o modal quando não existia configuração. Paralelamente, `configurar-integracao set_usage` rejeitava um provedor validado apenas por estar pausado.
- `a7bba77` adiciona o indicador público de configuração, abre o modal sem escrita no primeiro caso e, no backend, permite a reativação limpando somente `paused`. A desativação mantém credenciais e propaga o uso para `lead_source_configs` quando aplicável.
- Validação: Vitest completo 93 arquivos/743 testes, type-check frontend e Edge, lint, build/artefato Sites e `git diff --check` aprovados. Na prévia autenticada, Google Places abriu a configuração e foi cancelado, sem erros no console. Nenhuma mensagem, automação, dado de cliente, migration, Edge ou publicação do Site.

## 2026-10-06 — Leads → Kanban: vínculo técnico sem ativação da Ana

- O diagnóstico foi limitado ao caminho **Busca de Leads → Leads → Kanban**. A RPC `get_kanban_portfolio` já é a fonte do quadro e filtra pelo mesmo registro de `leads` quando `modo_atendimento` e `owner_id`/`assigned_to` estão definidos; não havia necessidade de criar cartão ou endpoint novo.
- `3665f52` substitui a ativação `lead-workflow/start_ai` durante o envio por uma persistência mínima do usuário técnico de rota, somente para leads Ana sem vínculo. A ação por linha foi adicionada ao menu existente; humanos sem responsável e leads sem modo seguem bloqueados. O reenvio é idempotente no frontend e informa que o registro já está no Kanban.
- Validação autenticada em ambiente real: um lead existente entrou em **Novo** e continuou com **Busca de leads** e **43/100** após reload; a segunda confirmação criou zero duplicados. Console sem erros. Vitest completo 93/741, type-check, lint, build/artefato e diff check aprovados. Nenhuma mensagem, automação, migration, Edge ou publicação do Site; a única escrita foi `owner_id`/`assigned_to` do lead autorizado.

## 05/10/2026 — Ação de Kanban e etapas da carteira de Leads restauradas

- A análise dirigida encontrou `enviarParaKanban` e seu modal ativos, porém sem acionador na barra de seleção. `a20a420` adicionou o botão **Enviar para o Kanban** e reutilizou o fluxo existente, conferindo a permissão de edição da seleção antes de abrir o modal.
- A lista canônica agora alimenta filtro, alteração de etapa e transferência. As sete etapas ficam visíveis; Ganho/Perdido continuam explícitos como término governado pelo orçamento, não uma atualização em massa ou automática.
- Validação sem escrita comercial: 92 arquivos/736 testes, type-check frontend, lint, build/artefato Sites, diff check e inspeção autenticada local. O modal foi aberto com um lead selecionado e cancelado; não houve envio, ativação da Ana, mensagem nem mudança de estágio.

## 06/10/2026 — Importação da Busca para Leads corrigida

- Logs do banco confirmaram `prospecting_import_invalid_lead_fields`: a RPC de lote rejeitava `uf`, embora `leadToCrmRow` a gere para a localidade. Não era falha de RBAC.
- `b2da2ad` adiciona a migration `20261006011920_fix_prospecting_batch_state`, aplicada ao Supabase oficial. Apenas `uf` passou a ser aceito/persistido; transação, RLS invocadora, grants e idempotência foram preservados.
- Repetido o mesmo lote de 20 selecionado pelo operador: importação navegou para Leads, que exibiu 20 registros e uma lista aguardando revisão, todos com São Paulo/SP. Não houve mensagem, automação ou alteração fora do lote selecionado.

## 05/10/2026 — Correção cirúrgica da Busca de Leads

- Causa reproduzida no caminho Critérios → Edge: `prospectar-leads` v16 devolvia preflight 403 para `http://127.0.0.1:4173`; a tela mostrava erro genérico. A quantidade existia apenas como estado e o botão chamava uma constante de 10.
- `86cd668` expõe e valida quantidade 1–100, encaminha-a por `filters.volumeMaximo` e usa o valor no comando do Passo 4. Publicada somente `prospectar-leads` v17, com JWT mantido; não houve migration ou Site deploy.
- Fluxo autenticado completo com Apify/Google Maps, termo de critério e quantidade 20: OPTIONS 204, POST/polling 202 e resposta 200; revisão exibiu 20 encontrados, 20 elegíveis e 0 duplicados. A recarga recuperou a revisão salva. Sem importação de CRM, mensagem ou automação.

## 05/10/2026 — Correção isolada do Status operacional

- Diagnóstico reproduzido: o preflight de `operational-diagnostics` para a origem local retornava 403 porque `ALLOWED_ORIGINS` substituía, em vez de complementar, as origens homologadas. Alterado somente `_shared/http.ts` e publicado `operational-diagnostics` v19 com JWT preservado.
- Provas: preflight 204 com origem exata, type-check frontend/Edge, lint, build e diff check aprovados; tela autenticada e o botão **Atualizar status** carregaram a visão operacional. Não houve escrita de negócio.
- Limite: a leitura apresenta 10 componentes que exigem atenção; isso é estado real das integrações e não foi alterado nem usado para ativar a Ana ou mensageria.

## 05/10/2026 — Evolution GO principal, delta local validado; produção NO-GO

- Produto `5671f44` no checkout existente; snapshot GitHub `a22ee34896d67c08794f1d7eded0302af9f0be53` com pai remoto preservado e árvore local/remota igual. Convite de vendedor → RPC/worker Evolution GO; primeiro acesso/QR pela Central; preferência SQL para novos vínculos e transferência; status específico sem check genérico. WA-AKG preservado para contingência, vínculos existentes não migrados.
- Validação: 733 Vitest/91 arquivos, sete verificações SQL PGlite, type-check frontend/Edge, lint, build/artefato Sites e diff check. Metadados de assinatura/grants/Edge conferidos no Supabase, sem segredos ou dados de cliente.
- Banco, Edge e Site não receberam este lote. Sem mensagem real, QR, automação, callback ou mutação de cliente. Próxima ação: homologação isolada e release coordenada após reconciliar os deltas R1–R12. Relatório: `docs/remediacao/2026-10-05-evolution-go-primary/RESULTADO_FINAL.md`.


## 05/10/2026 — R4–R14: remediação local validada e GitHub atualizado; produção NO-GO

- Produto local `225a379e096efa4eb3fb543759edd71ad50ef581`; snapshot GitHub `4f7f4514613ca64461cda3d1ffcf004ac1c79d4f`, filho do remoto `118b131b47d56cda8615f24b00c332eabe3d2805`. Push não forçado e árvore igual `804172b06e122a8e9ec41374c21151c4f3b98f4c` confirmados. Checkpoint documental final identificado no histórico/entrega; nenhum branch/worktree/projeto novo.
- Concluídos localmente: convites e vínculos empresariais R4, contexto/filas de stores R5, recuperação/provisionamento/entrada R6, guardas de contrato R7, política e autoridade Ana R8, CSV/Agenda R9, reprodução R10, cidade/diagnóstico R11 e interações R12. Estado completo por requisito e limites em `docs/remediacao/2026-10-05-r4-r14/RESULTADO_FINAL.md`; não equivale a todos R4–R14 concluídos em produção.
- Validação final: 21/21 comandos, 732 testes/91 arquivos, 17 smoke, 245 SQL sequenciais únicos + 54 disputas nativas, 11 Chrome. 579 hashes estáveis, também conferidos contra o index antes do commit. Primeira rodada com duas expectativas antigas reprovadas preservada; correção e rodada completa final aprovadas. Sem duplicar contagem PGlite/PostgreSQL.
- LOCAL validado / GITHUB salvo / banco, Edge e Site NÃO implantados. Última inspeção histórica do Site v168; não reinspecionado neste lote. Nenhuma mensagem, QR, evento Calendar, automação, busca paga ou cliente alterado; não se desligou silenciosamente operação previamente habilitada.
- Bloqueios reais: gateway WA-AKG examinado não desliga o bot pelo contrato usado; exige versão corrigida/homologada além de VPS/HTTPS. Staging/identidades/destinos protegidos indisponíveis, escolha CRM interno/SaaS e autoridade/MFA não definida, bundles/histórico de migrations divergentes. MFA obrigatório e WCAG integral não implementados/certificados.
- Próxima ação: obter essas dependências, comparar definições reais e preparar aplicação seletiva coordenada banco/Edge/frontend com compensação; executar homologação integrada antes de liberar. Não repetir remediação/auditoria já concluída, não executar db push/replay/repair integral e não publicar frontend isoladamente. Arquivos pnpm preexistentes preservados fora do Git.

## 05/10/2026 — R1/R2/R3 locais validados e salvos no GitHub; produção preservada

- Autorização de remediação recebida; substitui a antiga espera por autorização abaixo. Produto local `2a48e6546bcbeef3b935fc5d77cd81c5ac65900d`; snapshot GitHub `a07409610e2cac48882f6c6975ed3d516a0a615b`, árvore igual e push sem force confirmado. Commit documental final identificado no histórico/entrega.
- R1: carteira/Storage/documentos/supressão/último admin. R2: corte local antes do gateway, revisão/token/CAS, gate global separado, provisionamento manual por etapa e UI sem falso sucesso. R3: SQL/escopo/ordem de recibos e callbacks tardios sem reabrir saída. Subconjunto R10: todas as Edge Functions cobertas pelo type-check; nove diagnósticos corrigidos.
- Aceite local: 13 comandos, 500 testes/79 arquivos, 17 smoke, tipos/lint/build/artefato Sites; SQL com 107 casos sequenciais + 24 concorrentes reais. Manifesto de 534 fontes sem alteração durante a rodada. Relatório: `docs/remediacao/2026-10-05-r1-r3/RESULTADO_FINAL.md`.
- LOCAL validado; GITHUB salvo; banco/Edge/Site NÃO aplicados/publicados neste lote. Última versão verificada do Site: v168 (não reinspecionada neste lote). Nenhuma mensagem, QR, automação, busca paga ou alteração de cliente. Não se alterou a operação anteriormente habilitada.
- NO-GO global mantido: recuperação de resultado incerto e provisionamento automático fora do ledger permanecem R6; demais R4–R14, salvo subconjunto de tipos, e homologação integrada/externa continuam pendentes. Próxima etapa R4/R5, depois R6 com ambiente isolado; não repetir auditoria completa nem publicar/ativar automaticamente. Evidências V3 históricas preservadas; pnpm preexistente fora dos commits.

## 05/10/2026 — Auditoria V3 — NO-GO; produto/produção preservados

- Diagnóstico e provas no checkout `847048429a86294aa10fa54ffdd750c04447d4fb`, árvore inicialmente igual ao GitHub `9fdfb554ed5e23b1edc5b7e5250bd8df84cbad7d`. Site oficial v168 permanece fonte isolada87b9b83, sem nova publicação.
- 421 testes existentes e17 smoke aprovados; 40 assertivas adversariais novas (7 aprovadas/33 reprovadas); type-check ampliado Edge com9 diagnósticos; RPC de recibos implantada contém pg_catalog.coalesce inválido (SQLSTATE42883 em SELECT não mutante).
- Inspeção autenticada limitada: Wizard Fonte→Região→Perfil→Critérios, reflow320/390/1024/1440, Central sem conta WA-AKG, ajuda por teclado e carteiras vazias. Não houve busca, QR, envio, convite ou alteração de cliente.
- RLS habilitada106/106 não equivale a autorização correta: carteira/Storage/supressão e último admin reprovados em PostgreSQL sintético com políticas remotas. Convites, gates/transições, retry e caches também possuem bloqueadores. Nenhuma exploração real alegada.
- Documentos/provas/matrizes em `docs/auditoria/2026-10-05-v3/RELATORIO_AUDITORIA.md`. Artefatos de auditoria e checkpoints apenas; produto, banco, Edge, crons e configurações remotas intactos.
- Próxima ação exata: obter autorização de remediação e executar R1/R2/R3 do plano, repetir as provas antes de ampliar. E2E depende de staging/gateway/perfis/destinos isolados (BL-01..08). Não repetir auditoria integral nem publicar automaticamente.
- Observações antigas abaixo são históricas e podem ter sido superadas por este checkpoint. Auditoria segura encerrada; homologação externa/comercial integral permanece incompleta.

## 2026-10-05 — Sincronização integral do checkout no GitHub

- O `main` de [fabricio-gaspar/Sistema-Leads](https://github.com/fabricio-gaspar/Sistema-Leads) foi atualizado para o snapshot `5db2d95ba6080e446cbf669c68a011ff8afc282a`. Como o histórico local e o remoto não tinham ancestral comum, o snapshot preserva o commit remoto anterior `c4733b65c552d53be40c78f0350396432e163609` como pai e contém a árvore completa do checkout atual.
- A sincronização inclui os recursos desenvolvidos em 04 e 05/10, inclusive WA-AKG, a Ana, o QR/pareamento e o Wizard da Busca. Arquivos não rastreados preexistentes (`pnpm-lock.yaml` e `pnpm-workspace.yaml`) foram preservados localmente e não entraram no envio.
- Type-check do frontend e Edge, lint, Vitest completo (**77 arquivos / 421 testes**), build de produção, artefato Sites e `git diff --check` passaram. O ref remoto foi conferido com `git ls-remote`.
- Isto não altera a publicação oficial: o Site continua na versão isolada **168**, sem migrations adicionais, Edge Functions, mensagens reais, automações, QR real ou alterações de dados de clientes.

## 2026-10-05 — Publicação isolada do Wizard e da Central WA-AKG

- Publicado o Site oficial v168, deploy `appgdep_6ac3d1bec3e48191ba29a2d5559426a8`, a partir da fonte isolada `87b9b8309eb8fc0fa4d47611c7a1315598fc4f76` sobre a base pública v167.
- A fonte contém somente o Wizard da Busca, a conexão WA-AKG pela Central e os adaptadores frontend diretos exigidos. Não incluiu migrations, Edge Functions, exclusão de leads, automações nem os demais deltas locais.
- Passaram Vitest focado (6 arquivos/11 testes), type-check, lint, build, artefato Sites, `git diff --check` e confirmação remota `succeeded`. Nenhuma operação comercial ou integração externa foi acionada.
- Pendente: revisão visual autenticada, sem gerar QR, busca, importação, mensagem ou ativação de canal.

## 2026-10-05 — QR do vendedor na Central de Atendimento

- A Central passou a montar o painel individual WA-AKG com QR Code, código de pareamento, status, reconexão e ativação do canal. O menu **Meu WhatsApp** foi removido da navegação e sua rota redireciona para a Central, preservando links salvos.
- O guard de primeiro acesso agora consulta `loadMyWaAkgAccount` e encaminha vendedor com sessão pendente para `/dashboard/atendimento`; não altera permissões de conversa, carteira ou administração.
- Vitest focado (**4 arquivos / 6 testes**), type-check, lint, build/artefato Sites e `git diff --check` aprovaram. Não houve chamada a gateway, QR real, mensagem, automação ou alteração remota.
- Publicado posteriormente no Site oficial v168 pela fonte isolada registrada acima.

## 2026-10-05 — Wizard guiado da Busca de Leads

- A configuração da busca foi dividida em quatro passos explícitos: fonte ativa, região, perfil ideal e critérios/termos. O fluxo conserva os dados ao avançar ou voltar e mostra um resumo antes da amostra.
- A execução continua protegida: a seleção da fonte não chama o provedor e somente **Testar com 10 empresas** alcança `executarBusca`. As guardas existentes de fonte ativa, modo real, cidade, termos, revisão e importação foram preservadas.
- Validação local: Vitest focado **3 arquivos / 12 testes**, type-check, lint sem warnings, build/artefato Sites e `git diff --check` aprovados. Nenhum provedor, lead, importação, mensagem ou automação foi acionado.
- Código no commit `b01f6001d42123e049f9568ec851b49bb2c4ce08`, publicado posteriormente no Site oficial v168. A inspeção visual autenticada continua pendente.

## 2026-10-04 — WA-AKG como transporte principal por vendedor

- Implementado um adaptador WA-AKG isolado por sessão, sem incorporar o bot, o agendador ou o
  broadcast do gateway. A Ana permanece responsável por decisão, resposta, cadência, handoff e
  estado do lead; o provedor executa somente conexão, entrada, saída e recibos.
- As migrations `wa_akg_provider_foundation` e `wa_akg_security_indexes` foram aplicadas no projeto
  oficial. Filas internas usam RLS/revogação para clientes, webhook HMAC/idempotente e índices de
  chaves estrangeiras. O envio reserva no banco um intervalo aleatório de 10–30 segundos por sessão,
  janela padrão de 3/60 s e limite diário de 100, sem prometer proteção absoluta contra bloqueio.
- Publicadas `wa-akg` v1, `webhook-wa-akg` v1 e `wa-akg-worker` v1, além de `automation-worker` v38,
  `team-members` v18, `ana-run` v39, `enviar-whatsapp` v12 e `whatsapp-accounts` v8. Usuário novo
  agenda sua sessão; vendedor conecta pelo Meu WhatsApp; administrador configura gateway e limites.
- Validação: type-check frontend/Edge, lint, build/artefato Sites, `git diff --check` e Vitest completo
  **72 arquivos / 411 testes**. O banco confirmou zero evento, zero reserva e zero conta WA-AKG ativa.
  Nenhuma mensagem foi enviada. QR/entrada/saída reais aguardam servidor WA-AKG persistente, HTTPS,
  `WA_AKG_ALLOWED_ORIGINS` e chave do gateway.

## 2026-10-04 — Correção da revogação de sessões no gerenciamento de usuários

- Logs do projeto oficial apontaram que `team-members` chamava o logout administrativo com o UUID do membro, embora o endpoint espere um JWT. A tentativa de remover Flavio Gaspar falhava com 400 antes da exclusão da identidade.
- Foi aplicada a migration `revoke_member_auth_sessions` e publicada `team-members` v14. A função SQL nova elimina somente sessões renováveis do usuário indicado, com execução limitada a `service_role`; a Edge Function passa a usá-la para exclusão, desativação e redefinição de senha.
- Foram aprovados type-check frontend/Edge, lint e 105 testes do runtime. A função foi exercitada com UUID sem sessão e retornou zero; nenhuma conta, dado comercial, canal ou credencial foi removido nesta validação.

## 2026-09-29 — Carteira de Orçamentos alinhada ao mockup

- Aplicado o redesign da rota `/dashboard/orcamentos` sobre `usePropostasStore` e a tabela `proposals` já existentes: cabeçalho, abas com contagens, busca por número/empresa/contato/item, responsável, filtros, ordenação, colunas essenciais/opcionais, estado vazio e ações preservadas.
- Não foram criados mocks, dados demonstrativos, endpoints, migrations ou integrações paralelas. O modelo existente ainda não oferece versões imutáveis, PDF privado/hash, token público de aceite, eventos de entrega ou busca server-side; a UI não simula esses recursos.
- Type-check, lint, Vitest 56 arquivos/328 testes, build/artefato Sites e `git diff --check` passaram. Commit `bde2ef80ddd502310822d462ec89ccf231a30e9b`; publicação oficial pendente.

## 2026-09-28 — Canais de WhatsApp por evidência

- Reformulada a rota existente Meu WhatsApp como **Canais de WhatsApp**, com abas URL para canal, diagnóstico e histórico. A tela usa a Edge Function existente e não cria uma camada de dados ou conexão alternativa.
- Publicada `whatsapp-accounts` v6 no Supabase oficial. A resposta é derivada server-side de `whatsapp_accounts`, `integrations`, `messaging_provider_controls`, `audit_logs` e `channel_inbound_events`, dentro da autorização organizacional existente e sem devolver segredos.
- O contrato explicita que aceite do provedor não prova entrega, leitura ou processamento. Meta permanece desabilitada até habilitação operacional real. Nenhuma mensagem, conexão, callback ou teste externo foi executado nesta alteração.
- Type-check frontend/Edge, lint, Vitest focado (103 testes), build/artefato Sites e diff check passaram. Commits `f270b05` e `ed19d8a`; publicado no Site oficial como versão 146, deploy `appgdep_6abaf640b1748191ac2b83948e6a35f8`, concluído com sucesso.

## 2026-09-28 — Central de Atendimento operacional

- Reconstruída a rota em três áreas responsivas: inbox com busca/filtros/paginação/totais reais,
  conversa paginada e contexto de lead, qualificação, conhecimento, orçamentos, notas, atividades
  e próxima ação persistida.
- Aplicadas no projeto oficial as migrations de leitura individual, contratos de inbox,
  publicação Realtime, índices de FKs, resolução segura de provedor e totais de filtro. RLS e
  privilégios de execução foram conferidos: `authenticated` pode executar as RPCs; `anon` não.
- Assunção, transferência, retorno à Ana, bloqueio e saída humana reutilizam os contratos
  existentes. A saída recebe a conta já fixada ao lead e mantém uma chave idempotente enquanto a
  fila estiver pendente ou em reconciliação.
- Type-check frontend/Edge, lint, Vitest 56 arquivos/326 testes, build/artefato Sites e
  `git diff --check` passaram. O servidor local bloqueou corretamente a rota sem configuração
  pública do Supabase. Nenhuma mensagem, tarefa, handoff, bloqueio ou automação foi disparado.
- Commit `2740934`. A publicação permanece pendente de autorização explícita para enviar o código
  ao repositório de hospedagem do Site oficial.

## 2026-09-28 — Kanban operacional

- Reconstruído Kanban com pesquisa/filtros/contagens no servidor, quadro e lista no mesmo estado de URL, colunas canônicas, cartões com dados persistidos, drawer operacional e visões pessoais protegidas por RLS.
- Aplicadas no projeto oficial as migrations `kanban_operational_portfolio` e `kanban_saved_views_fk_index`; conferidos RPCs, RLS, privilégios e índice. O auditor não reportou alerta novo da mudança.
- Type-check, lint, 55 arquivos/323 testes, build/artefato Sites e `git diff --check` passaram. Nenhum lead, tarefa, mensagem, automação, provedor ou estado comercial foi alterado como teste.
- Commit `fcb2c75`. Publicação do Site aguardando autorização explícita para enviar esse commit ao repositório de hospedagem; Site oficial ainda v144.

## 2026-09-28 — Carteira operacional de Leads

- Reconstruída a tela **Leads** sobre os contratos operacionais existentes: filtro e busca completos, abas de prioridade, ordenação, colunas personalizáveis, ações em lote, etapa canônica, responsável, atividade, próxima ação e ações por registro.
- Leituras de qualificação e tarefas respeitam a sessão/RLS já existente. Visões e colunas são preferências locais isoladas por usuário; a exclusão definitiva permanece somente no fluxo governado do Funil.
- Type-check, lint, 54 arquivos/321 testes, build/artefato Sites e `git diff --check` passaram. Site oficial v144 publicado pelo commit `5fc98085b308372d0a9813a1c8db8cac0ed23596`, deploy `appgdep_6aba88b5e1c8819186977c232d9b2c24`; a conferência autenticada desktop não acionou nenhuma escrita ou provedor.

## 2026-09-28 — Assistente de termos por segmento

- Mantida a digitação manual em **Busca de Leads** e acrescentada uma seleção assistida para Borracha, Silicone, Poliuretano, Vedação industrial, Manutenção industrial e Aplicações e mercados.
- Os termos escolhidos alimentam o mesmo filtro existente, com remoção individual, deduplicação e máximo de dez. Nenhuma busca, integração, lead ou automação é acionada ao selecionar opções.
- Type-check frontend/Edge, lint, 52 arquivos/315 testes, build e `git diff --check` passaram. Publicado no Site oficial v142, commit `58143d5`, deploy `appgdep_6aba6c17ebc48191aa5dd1a125be55bb`.

## 2026-09-27 — Seletor dinâmico das APIs de prospecção

- Removido o rótulo fixo do Apify em **Busca de Leads**. O seletor agora é alimentado pelas fontes de prospecção conectadas e ativas em Configurações e identifica a API escolhida também no botão de busca.
- A interface recarrega `lead_source_configs` ao montar e ao recuperar o foco. Somente adaptadores reais do backend (`apify` e `google_places`) são exibidos; IA, CSV e integrações sem executor não aparecem como opção falsa.
- Type-check frontend/Edge, lint, 52 arquivos/313 testes, build e 17 smoke checks passaram. Nenhuma busca paga, integração, segredo, lead ou automação foi acionada.
- Publicado no Site oficial como versão 141, commit `0841dcc`, deploy `appgdep_6ab9807bd10881919c17c9078d40842a`. A inspeção autenticada mostrou **API da busca → Apify — Google Maps**, botão coerente e console sem warning/error; o botão de busca permaneceu desabilitado e nenhuma consulta foi iniciada.

## 2026-09-27 — Teste real da apresentação e reconciliação Z-API

- Confirmado que o envio original estava apenas adiado para segunda-feira por horário comercial. O administrador autorizou um único teste fora do horário; só havia esse job na fila e a política foi restaurada imediatamente depois.
- Z-API aceitou a apresentação e o webhook recebeu **“Boa tarde”**. O aceite ficou seguro em `reconciliation_required` porque um trigger usava `outreach_jobs.created_at` inexistente; não houve reenvio.
- Migration `20260927195156_fix_proposal_delivery_outreach_ordering` aplicada como `20260927195241`. A reconciliação concluiu job, mensagem e outreach como enviados.
- A Ana entregou a entrada ao humano por confiança 15% menor que o mínimo 20%. Type-check frontend/Edge, lint, 51 arquivos/311 testes, build e 17 smoke checks passaram. Commit `fdc3d74`; Site v140 mantido.

## 2026-09-27 — Fluxo Novo → Apresentado restaurado

- Logs do Supabase mostraram que o Kanban persistia o lead, mas `resolve_lead_whatsapp_account` falhava por ambiguidade de `owner_user_id`, impedindo a primeira execução da Ana.
- Aplicada a migration `20260927193046_fix_whatsapp_account_resolver_ambiguity` no projeto oficial, qualificando também `connection_status` e `is_default` sem alterar o pipeline ou criar motor paralelo.
- Teste transacional resolveu a conta/integração corporativa e foi integralmente revertido: zero lead, mensagem ou job de prova. Type-check frontend/Edge, lint, 51 arquivos/310 testes, build e 17 smoke checks passaram.
- Commit de código `4fd878f`. Sem publicação de Site e sem mensagem real; o E2E controlado depende de um novo lead, pois a base estava vazia após a exclusão do registro afetado.

## 2026-09-27 — Gestão da base restaurada no Funil

- Restaurado o consumidor de `LeadBaseManager` em **Funil → Gerenciar base**, com atalho no cabeçalho e sem duplicar a superfície em Leads.
- Visibilidade limitada a `leads.read_all`; exclusão continua dependente de `leads.delete`, seleção e frase exata, usando a Edge Function e a procedure transacional existentes.
- Projeto Supabase e privilégios confirmados em leitura. Type-check frontend/Edge, lint, 51 arquivos/309 testes, build e 17 smoke checks passaram.
- Site oficial v140 publicado pelo commit `2ef48dd`, deploy `appgdep_6ab96a8aa7288191966c72f5501afdd4`. A tela autenticada mostrou três registros e nenhuma seleção; nenhum lead foi excluído.

## 2026-09-27 — Pendências acionáveis da Ana automática

- Substituída a resposta genérica da ativação por uma lista com contagem, requisito, explicação e atalho para o local exato da correção.
- A tentativa de ativar leva à primeira pendência; a pausa global pode ser retomada no próprio cartão e a navegação profunda abre a etapa correta da configuração da Ana.
- Nenhum gate operacional ou backend foi alterado. Type-check, lint, 46 arquivos/282 testes e build passaram. Publicado no Site oficial v136 pelo commit `de6d902`.

## 2026-09-27 — Paleta única do CRM

- Consolidada a paleta da Dashboard nos tokens globais, componentes compartilhados e exceções das telas operacionais e administrativas.
- Preservadas as distinções de sucesso, atenção e falha e mantidas cores proprietárias somente em ícones de provedores. Nenhuma regra, rota, persistência ou automação foi alterada.
- Type-check, lint, 46 arquivos/282 testes e build/artefato Sites passaram. Publicado no Site oficial v135 pelo commit `8a48ea4`.

## 2026-09-27 — Controle da Ana automática na Dashboard

- Adicionado controle compacto para ativar/pausar a configuração operacional já salva, sem criar motor ou agenda paralela.
- O backend revalida prontidão, permissão, rota, autorização paga e concorrência; a transação persiste agenda, modo e auditoria em conjunto. Pausa cancela apenas filas ainda não iniciadas.
- Migration aplicada no projeto oficial; `ana-operations` v4 publicada com JWT obrigatório. A permissão direta segue negada a usuários autenticados.
- Controle publicado no Site oficial v134 pelo commit `2b6cb64`; o estado operacional permaneceu desativado e nenhum provedor externo foi chamado.
- Type-check frontend/Edge, lint, 46 arquivos/282 testes e build passaram. Nenhuma automação, busca ou mensagem foi executada; o estado continua bloqueado por WhatsApp/Z-API pausados.

## 2026-09-26 — Dashboard comercial compacta

- Consolidada a leitura da Dashboard em quatro indicadores, Ações agora, pipeline canônico,
  atividade de contato e saúde operacional. Cartões duplicados de conexão, WhatsApp, fontes,
  fila, valor e temperatura saíram somente desta visão; seus módulos de origem foram preservados.
- A lista de decisões reúne eventos abertos e handoffs humanos sem notificação, deduplica por lead
  e não produz efeito operacional. Três regressões novas cobrem prioridade, deduplicação e limite.
- Type-check, lint, 43 arquivos/265 testes e build passaram. Site oficial v131 (a3d29da) foi
  revisado em desktop e 390×844; console sem erros ou warnings. Nenhuma rota, regra, automação,
  dado remoto ou mensagem foi modificada.

## 2026-09-26 — WayFlex Command Center

- Redesenhado o shell e o Dashboard a partir da referência, preservando domínio, rotas e efeitos.
- Criado tooltip acessível reutilizável; indicadores e monitoramento exibem somente dados reais.
- Type-check frontend/Edge, lint, 42 arquivos/262 testes e build/artefato Sites aprovados.
- Site oficial v127 publicado e revisado em desktop e celular; ajuste final removeu truncamento dos
  títulos dos cartões. Console sem erros ou warnings.

## 2026-09-26 — Etapa 11, acabamento e publicação

- Site oficial existente publicado com sucesso como versão 125, commit `23fbb4b`, no endereço
  público preservado. O fluxo oficial recompilou e empacotou o artefato; nenhum projeto/site novo
  foi criado e nenhuma integração operacional foi ativada.

## 2026-09-26 — Etapa 10, segurança e homologação

- MCP confirmou projeto oficial saudável. RLS foi exercitado como administrador e vendedor;
  organização estrangeira ficou invisível e tabelas internas recusaram acesso autenticado.
  Handoff foi executado em transação, revertido e conferido sem resíduos.
- Advisors e funções `SECURITY DEFINER` foram revisados individualmente. Nenhuma chave privada foi
  encontrada no Git. Pendência para a etapa 12: habilitar proteção de senhas vazadas no Auth e
  repetir o advisor. Nenhum provedor, automação ou deploy foi acionado.

## 2026-09-26 — Etapa 9, testes e correções comuns

- Consolidada a validação pós-etapas 6–8: frontend/Edge type-safe, lint sem warnings, 42 arquivos/
  262 testes e build/artefato Sites aprovados. A composição responsiva dos cards foi revisada com
  texto integral e sem nova rota, fonte de dados ou efeito externo.
- A próxima etapa é segurança e homologação com Sol XHigh. Site, Edge Functions e canais não foram
  publicados/ativados nesta etapa.

## 2026-09-26 — Etapa 8, alertas e Dashboard

- Corrigida a distribuição semântica dos cinco grupos de atenção: eventos de reunião/orçamento e
  leads quentes não caem mais em Responder agora só por exigirem ação. Leads notificados não se
  repetem nas listas derivadas de acompanhamento/atraso e os textos dos cards ficaram integrais.
- Duas regressões novas cobrem classificação e deduplicação. Type-check frontend/Edge, lint,
  42 arquivos/262 testes e build/artefato Sites passaram; nenhum aviso externo foi disparado.

## 2026-09-26 — Etapa 7, WhatsApp e recebimentos

- Fechada a corrida de recibo antecipado: depois do aceite do provedor, o worker reutiliza o
  parser Z-API e a RPC canônica para reconciliar callbacks ainda sem correspondência, sem novo
  envio. Lotes parciais permanecem pendentes e a trilha é auditável.
- Type-check frontend/Edge, lint, 41 arquivos/260 testes e build/artefato Sites passaram. Não houve
  chamada real, ativação, publicação de função ou alteração de segredo.

## 2026-09-26 — Etapa 6, motor crítico da Ana

- Corrigida a corrida de idempotência de `agent_runs`: colisão única agora é reconciliada como
  execução duplicada/em andamento, sem segundo processamento. Regressão específica adicionada.
- Corrigido o claim de `prospecting_schedule_runs`: `running` com lock ativo não é retomado; o
  worker só reivindica fila, polling liberado ou lock vencido em dez minutos, antes de calcular
  cotas e chamar a fonte. 259 testes, type-check frontend/Edge, lint e build passaram.

## 2026-09-26 — Etapa 5, prospecção diária auditada

- Confirmado que `ana-operations`, `prospecting_schedules`, `prospecting_schedule_runs` e
  `automation-worker` já formam uma única rotina diária: ICP, cotas, modos, aprovações,
  atribuição, handoff, alertas, resumo e pausa global. Nenhuma duplicação foi introduzida.
- Não foi executada busca paga, simulação, fila operacional ou ativação. A próxima etapa requer
  Sol High para revisar o motor crítico da Ana.

## 2026-09-26 — Etapa 4, dossiê e qualificação

- Extendida a qualificação existente com contexto técnico estruturado e campos faltantes. A Ana
  recebe schema estrito opcional e só persiste informação declarada; simulação, apresentação e
  handoff usam o dossiê vazio. A migration foi aplicada e as duas colunas foram verificadas.
- Central e Kanban passaram a mostrar o mesmo dossiê somente leitura. Type-check frontend/Edge,
  lint, 41 arquivos/258 testes e build/artefato Sites passaram; nenhum provedor ou canal foi usado.

## 2026-09-26 — Etapa 3, catálogo Wayflex rastreável

- Adicionada a curadoria de perguntas internas por item na base canônica, com editor, busca e
  formatos comerciais/técnicos. A migration aplicada ao projeto oficial atualizou 56 itens ativos
  da Wayflex e recompôs os documentos/chunks existentes; nenhuma aplicação ou especificação foi
  inventada e nenhum anexo foi fabricado.
- Conferência SQL confirmou 19 produtos, 19 serviços e 18 catálogos com perguntas dentro do
  limite. Type-check frontend/Edge, lint, 40 arquivos/257 testes e build/artefato Sites passaram.
  Não houve mensagem externa, chamada a provedor ou ativação operacional.

## 2026-09-25 — Etapa 4, lote atômico

- Substituídas gravações sequenciais da revisão por uma RPC invocadora; adicionado retry idempotente e reconciliação dos stores. Aplicada migration oficial. Transações revertidas comprovaram lote único, deduplicação, rollback total e RBAC. Zero leads/mensagens de teste persistidos. Type-check frontend/Edge, lint, 255 testes e build/artefato aprovados.

## 2026-09-25 — Usuários e responsáveis, etapa 3 original

- Substituído `mockUsers` da revisão/importação por `organization_members` ativos; seleção
  humana agora é explícita e validada novamente antes da gravação. CSV permanece atribuído à
  Ana. Removido fixture sem uso.
- Atribuição validada também no banco por trigger privado. Transações com rollback confirmaram
  rejeição de owner inválido e de reatribuição por vendedor sem `leads.edit_all`, sem persistir
  mudanças. 253 testes, type-check frontend/Edge, lint e build passaram.
- Publicado Site v123 (`5ac4a6b`), deploy concluído em 19:30:04Z. Após recarga, modo Humano
  mostrou Flavio, Juca e fabricio; tentativa sem selecionar responsável ficou bloqueada e
  mostrou erro, com console limpo. Não foi importado lead novo nem enviada mensagem.

## 2026-09-25 — Homologação autenticada Busca → Leads

- Usuário autenticou a aba oficial. A revisão exibiu cinco resultados e cinco marcadores; um lead
  foi importado para a lista de homologação e continuou visível após recarregar. Banco: um membro
  na lista de teste, zero mensagens e zero jobs. Não houve nova execução paga da Apify.
- Encontrados e corrigidos localmente defaults indevidos de segmento/porte, fonte da lista ao
  retomar, UF legada truncada e contagem histórica de lista vazia. Type-check, lint, 249 testes e
  build passaram. Publicado v121 (`5e5d57c`) e repetido com segundo lead: categoria/fonte/SP
  corretos, porte nulo, lista persistida, dois duplicados bloqueados e estado vazio funcional.
- Verificação de clique no mapa revelou zoom incorreto; geometria extraída e corrigida com três
  regressões. Novo total 252 testes. Publicado v122 (`03b7c7c`), deploy succeeded em 19:01:49Z;
  cliques com mouse em Via Varejo e Galpão abriram os nomes correspondentes após reload.
- O fechamento é da etapa 2 original, Busca; a próxima é Usuários e responsáveis (etapa 3
  original), após confirmação e troca manual para GPT-6 Sol High. Não ativar Ana/WhatsApp.

## 2026-09-22 — Estados operacionais coerentes em Canais, APIs e Dashboard

- A auditoria do projeto oficial confirmou que a saída WhatsApp e a Apify tinham credenciais
  registradas, porém validações com mais de 24 horas. A entrada Z-API tinha callback recebido sem
  lead correspondente. Esses fatos passaram a ser exibidos como **Validação vencida** e
  **Entrada pendente**, sem chamar provedor, reenviar mensagem ou alterar a configuração remota.
- O Dashboard não apresenta mais e-mail, calendário, webhooks legados, CNPJ, Instagram, LinkedIn
  ou fontes parceiras como integrações vivas. Ele mostra somente os caminhos existentes no CRM:
  saída/entrada WhatsApp, IA/Apify/Google Places e Apify/cadastro manual/CSV.
- Canais ganhou um diagnóstico de entrada Z-API somente-leitura; APIs e Canais ganharam leitura
  segura de status e rótulo **Editar configuração** para conexões já salvas. Não foi criada ação
  de exclusão ou pausa direta para canal produtivo sem um endpoint server-side e confirmação
  explícita.
- Type-check frontend/Edge, lint, 28 arquivos/210 testes Vitest e build/artefato Sites passaram.
  A publicação e a inspeção visual autenticada ficam registradas ao final deste lote.

## 2026-09-22 — Operação automática da Ana com roteamento explícito

- A agenda agora permite escolher Ana, vendedor específico ou equipe selecionada. A validação
  aponta o campo ausente antes da ativação e o `ana-operations` repete a autorização no servidor.
- As migrations `20260922113000_ana_automatic_routing_and_validation` e
  `20260922120000_prospecting_schedule_assignment_fk_indexes` foram aplicadas no Supabase
  oficial. `ana-operations` v2 e `automation-worker` v29 preservam o Kanban manual e só usam
  `ana-run` para decisões automáticas; a simulação não chama fornecedor nem canal externo.
- Type-check frontend/Edge, lint, 27 arquivos/206 testes e build/artefato Sites passaram. A versão
  104 foi publicada a partir de `cdccad27ee9940a7e99a829ac38e87652c2ee693`; a inspeção autenticada
  confirmou todos os campos, a entrada `zapi_webhook` corretamente pendente e uma simulação
  `simulated` com zero candidatos/importações. Nenhum lead, mensagem, busca Apify ou chamada de IA
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

## Delta de estado factual de integrações — 22/09/2026

- A inspeção autenticada do Site oficial confirmou a separação entre configuração persistida,
  validação recente, uso operacional e diagnóstico de entrada. WhatsApp de saída e Apify estavam
  com validação vencida; IA estava validada; Google Places não estava configurado; a entrada Z-API
  estava pendente por `lead_not_matched`.
- O Dashboard apresenta apenas os caminhos realmente disponíveis no CRM atual. Canais mostra
  saída e entrada WhatsApp; APIs mostra IA, Apify e Google Places; Fontes de busca mostra Apify,
  cadastro manual e CSV. Conectores legados não foram apagados do banco, apenas deixaram de ser
  mostrados como caminho operacional atual.
- A leitura de um detalhe histórico de sucesso agora respeita o estado factual: quando a validação
  vence, o cartão informa que nova validação é necessária, em vez de afirmar que a integração está
  validada no presente.
- A validação visual cobriu Dashboard, Canais e APIs em desktop e mobile. Não houve overflow de
  página no breakpoint móvel e o console do navegador não registrou warning ou error. Nenhum
  teste de provedor, envio, lead, mensagem, fila ou configuração remota foi acionado.

# 2026-09-23 — Reparo da fila WhatsApp da Ana

- Diagnóstico do envio pendente: o lead estava aprovado, em canal `whatsapp`, a Ana havia
  concluído o evento canônico e o job permanecia `queued` sem tentativa. O `pg_cron` executava,
  porém cada chamada de `pg_net` ao worker era bloqueada pelo gateway com 401 por ausência de
  cabeçalho de autorização.
- A configuração local já declarava `automation-worker` sem verificação de JWT no gateway porque
  o endpoint aceita cron sem sessão e verifica um token rotativo mantido no Vault. A versão
  remota estava divergente. Foi publicada `automation-worker` v30 com essa configuração; a
  autenticação customizada do cron e a autenticação de usuários do painel permanecem no handler.
- Verificação pós-publicação: o próximo cron retornou 200, consumiu um único job, recebeu aceite
  do provedor, gravou o identificador do provedor no histórico e colocou o lead em
  `ana_stage=apresentado`. Nenhuma credencial foi lida, gravada ou exposta.
- Regressão: type-check frontend/Edge, lint, Vitest completo (28 arquivos/211 testes) e build
  com artefato Sites passaram usando `--configLoader runner` no Windows.

# 2026-09-23 — Catálogo visual rastreável da Wayflex

- Confirmado que `/acessorios`, `/servicos` e `/catalogos` são páginas SPA. O adaptador passou a
  ler apenas os módulos públicos publicados para produtos e catálogos e usa snapshot público
  explícito para segmentos carregados dinamicamente; não houve scraping de dado privado nem
  criação de conteúdo ausente.
- A sincronização autenticada oficial concluiu sem erro: 18 produtos, 18 segmentos e 17 catálogos
  visuais. A primeira tentativa revelou a restrição única de `documents.source_url`; o reparo usa
  um fragmento determinístico por card e preserva a página canônica no payload/website. Há 56
  documentos e chunks ativos aprovados para a Ana.
- `catalog-knowledge` v6 e `ana-run` v32 foram publicados no Supabase. A Ana mantém as mesmas
  guardas, mas pode reconhecer plurais e citar conteúdo concreto antes do link; Central e Empresa
  exibem imagem, categoria e resumo sem novo caminho de envio.
- Validação local aprovada: type-check frontend/Edge, lint sem warnings, Vitest 28 arquivos/214
  testes, build Vite e artefato Sites. Não houve envio WhatsApp, chamada ao provedor, alteração de
  lead, fila, canal ou execução operacional da Ana.

# 2026-09-23 — Mídia de catálogo pela fila WhatsApp existente

- A necessidade foi limitada ao envio de uma imagem oficial com a legenda já revisada, sem criar
  outro bot, fila ou integração. A Central agora permite selecionar **Incluir imagem oficial** ao
  preparar um item; sem essa seleção, o comportamento continua texto/link.
- A migration oficial `20260923133000_catalog_media_whatsapp_queue` foi aplicada após confirmar
  que não havia anexos duplicados. Ela adiciona o marcador idempotente de mídia, registra o anexo
  em `message_attachments` e vincula o evento de conhecimento ao mesmo `lead_message`.
- Funções publicadas: `ana-ia` v10, `enviar-whatsapp` v8, `ana-run` v33 e
  `automation-worker` v31. A configuração de imagens automáticas começa desativada; se ela for
  desligada depois de um job da Ana entrar na fila, o worker bloqueia o despacho. Nenhuma função
  nova foi criada e nenhum segredo foi exposto ao navegador.
- Validação local aprovada: type-check frontend/Edge, lint sem warnings, Vitest completo
  (29 arquivos/221 testes), build Vite com `--configLoader runner` e artefato Sites. Não houve
  mensagem real, job de teste, alteração de lead ou chamada à Z-API. A homologação externa de
  imagem permanece obrigatória antes de declarar aceite/entrega.

# 2026-09-23 — Seleção de imagem oficial da Ana

- Uma execução posterior à publicação da configuração de mídia foi auditada: a Ana respondeu à
  pergunta explícita sobre **Fita PTFE expandido auto-adesivo**, porém não criou anexo nem job de
  mídia. O item ativo, aprovado para a Ana e com imagem HTTPS pública já existia; a configuração
  publicada de mídia estava habilitada. Portanto, não foi falha ou rejeição da Z-API.
- `ana-run` v34 preserva a seleção contextual existente e adiciona uma busca de contingência,
  limitada a termos explícitos do nome do produto e submetida à mesma pontuação determinística.
  Ela não se aplica a saudações, intenção ambígua, orçamento, handoff humano ou item sem imagem
  segura. A execução passa a registrar apenas os metadados `catalog_media` (habilitada, elegível,
  selecionada e origem), sem texto do cliente nem URL.
- Type-check frontend/Edge, lint, Vitest completo (29 arquivos/222 testes), build Vite e artefato
  Sites passaram. Nenhuma mensagem foi repetida, nenhum job foi criado e nenhum provedor foi
  chamado. A nova pergunta controlada continua necessária para confirmar aceite do provedor.

# 2026-09-23 — Central com painel contextual único

- A Central mantinha dados do lead, produtos, orçamentos e agenda simultaneamente no chat, no
  painel lateral, em cards empilhados e em drawers. A consolidação preserva os handlers existentes,
  mas remove os atalhos comerciais duplicados da barra do chat.
- O painel direito desktop agora usa uma única superfície com abas **Lead**, **Conhecimento**,
  **Orçamentos** e **Agenda**. Em telas menores, o drawer apresenta as mesmas abas e adiciona o
  histórico da conversa; a área principal do chat permanece disponível sem painel lateral fixo.
- Type-check frontend, lint da Central, testes direcionados, Vitest completo (29 arquivos/222
  testes), build Vite e artefato Sites passaram. A inspeção publicada confirmou o drawer responsivo
  com as cinco abas e o carregamento da base real de conhecimento, sem escrita operacional, envio
  de mensagem, alteração de lead ou chamada a provedor.

# 2026-09-23 — Contas WhatsApp operacionais por vendedor

- O número corporativo foi preservado como padrão. Foi adicionada uma camada de metadados por conta
  e vínculo explícito em leads, mensagens, fila, outreach e webhooks, sem armazenar segredo fora do
  Vault e sem criar instância ou plano Z-API.
- O administrador recebeu visão global e configuração por usuário em **Usuários**; o vendedor recebe
  **Meu WhatsApp**, somente com suas permissões e sua conta. A conexão usa o SDK oficial Z-API com
  token descartável gerado no Edge Function `whatsapp-accounts`.
- Entrada e saída foram isoladas por conta. `ana-run` continua sendo a autoridade automática;
  `automation-worker` e `webhook-whatsapp` revalidam organização, integração e conta para impedir
  cruzamento entre vendedores.
- Projeto oficial atualizado: migrations `20260923193000_multi_whatsapp_seller_accounts` e
  `20260923214500_multi_whatsapp_fk_indexes`; Edge Functions `whatsapp-accounts` v1,
  `team-members` v9, `enviar-whatsapp` v9, `ana-run` v35, `automation-worker` v32 e
  `webhook-whatsapp` v18.
- Type-check frontend/Edge, lint, build, artefato Sites e 31 arquivos/227 testes passaram. O advisor
  confirmou cobertura das novas FKs. Nenhuma mensagem foi enviada e a conexão QR individual segue
  pendente porque não há vendedor/instância individual no estado real auditado.
- Commit `a5f2dcf04d72ba2fe26ff7812650dd0dc672b6fc` foi enviado à `main` oficial e publicado no Site
  existente como versão 115. A inspeção autenticada confirmou Dashboard, **Meu WhatsApp**,
  **Usuários > WhatsApp operacional**, formulário de instância existente, layout móvel sem overflow
  global e identificação da conta corporativa na Central. Console sem warnings/errors; nenhum botão
  de validação, salvamento, conexão, envio ou alteração operacional foi acionado.

# 2026-09-24 — Fundação protegida para Meta WhatsApp Coexistence

- O fluxo Z-API homologado foi preservado. A nova abstração `MessagingProvider` acrescenta o
  provedor `meta_cloud` sem mudar a resolução, fila ou worker usados pelas duas contas Z-API atuais.
- Três migrations criaram gates por organização/provedor, onboarding, conversas, ledger sanitizado
  de webhook, recibos fora de ordem, outbox idempotente, sincronização, templates, rate cards e
  roteamento. Todas foram aplicadas no projeto oficial `thgzrkppouoevapjquyu` com RLS e índices.
- Foram publicadas `webhook-meta-whatsapp` v2, `meta-whatsapp-onboarding` v1,
  `meta-whatsapp-messages` v1, `meta-whatsapp-worker` v2 e `whatsapp-accounts` v2. Assinatura HMAC,
  JWT/token interno, idempotência, retry/DLQ e ausência de payload integral são obrigatórios.
- O painel de Embedded Signup usa somente o SDK oficial da Meta e fica invisível enquanto a flag
  `meta_coexistence` estiver desligada. Não existe QR próprio nem segredo Meta no navegador.
- Verificação final: projeto oficial ativo, duas contas Z-API conectadas, zero conta Meta, zero
  sessão de onboarding, zero evento Meta e zero item no outbox. Os três flags estão desligados e
  os três controles mantêm entrada/saída/automação desligadas com kill switch ligado.
- Type-check frontend/Edge, lint sem warnings, 35 arquivos/237 testes, build Vite e artefato Sites
  passaram. Nenhuma mensagem, lead, fila Z-API ou credencial operacional foi alterada.
- O commit de publicação `cdc7317afca23dbdd7d941fab5f82ac8cc60dcbe` foi salvo no Site oficial
  existente como versão **116** e o deploy concluiu com `succeeded`. O título do projeto Sites foi
  normalizado para **Sistema de Leads**; audiência pública e URL existente foram preservadas.

# 2026-09-25 — Liberação controlada do cadastro Meta para WayFlex

- A flag `meta_coexistence` foi habilitada somente para a organização **WayFlex**, liberando a
  superfície de Embedded Signup em **Configurações > Canais > WhatsApp**.
- O teste posterior confirmou zero conta Meta conectada e manteve entrada, saída e automação
  desligadas, com kill switch ligado. A Z-API e suas duas contas conectadas não foram alteradas.
- Esta mudança não habilita mensagens reais: a conexão oficial do App/WABA/número e a homologação
  staged continuam obrigatórias antes de abrir qualquer controle operacional.

# 2026-09-25 — Correção da superfície Meta em Canais

- A flag estava correta, mas o painel `MetaCoexistencePanel` só era montado em **Meu WhatsApp** e no
  modal de **Usuários**. Por isso ele não aparecia em **Configurações > Canais**, que é o local
  administrativo correto para uma conta corporativa Meta.
- `WhatsappAccountPanel` ganhou o modo reutilizável `meta`, que conserva o painel completo nas
  telas antigas e mostra somente a configuração Meta em **Canais > WhatsApp e atendimento**. Não
  houve segundo conector, duplicação de dados ou alteração no cartão/fluxo Z-API.
- Type-check, lint, Vitest completo (35 arquivos/237 testes), build Vite e artefato Sites passaram.
  O gate Meta de WayFlex permanece liberado apenas para configuração; entrada, saída e Ana seguem
  bloqueadas até a conexão e homologação oficial.

# 2026-09-25 — Escolha auditável do provedor corporativo

- Z-API e Meta WhatsApp Cloud API ganharam cartões paralelos em **Configurações > Canais**, com
  estado calculado no backend, configuração no próprio bloco e alternância administrativa
  reversível. O Dashboard passou a mostrar uma linha factual para cada provedor.
- A migration `20260925150000_whatsapp_provider_activation_controls` impede que o resolvedor de
  saída escolha uma conta/provedor desligado. O webhook Z-API e os testes mantêm a desativação em
  vez de reativar a integração por efeito colateral.
- A alternância também pausa as contas e integrações corporativas do outro provedor. Assim, a
  próxima ativação Meta ou Z-API não pode manter um segundo caminho de envio concorrente.
- O administrador autorizou desligar Z-API no WayFlex. A operação preservou sessão externa,
  cofre e histórico, encontrou zero jobs pendentes e registrou auditoria. Meta não foi ativada:
  ainda não existe conta conectada, entrada, saída ou automação Meta.
- Verificado localmente: type-check frontend/Edge, lint, 35 arquivos/238 testes Vitest, build Vite
  e artefato Sites. Nenhum provedor recebeu mensagem durante a implementação.
## 2026-09-25 — Etapa 1: proteção e baseline

- Código `9bdd136` preservado na tag
  `baseline-wayflex-stage1-20260925` e branch `chore/wayflex-stage-1-baseline-2026-09-25`.
  Site v118 confirmado; Supabase oficial consultado sem escrita. Type-check frontend/Edge,
  lint, 35 arquivos/238 testes, build e artefato Sites passaram. GitHub main e Site possuem
  raízes distintas; nenhuma main foi substituída. Relatório em
  `docs/BASELINE_ETAPA_1_2026-09-25.md`. Aguardar troca manual para Sol Extra High antes de Apify.

## 2026-09-25 — Etapa 2: Busca Apify retomável

- Causa reproduzida no código e banco: polling só no navegador por aproximadamente dois minutos;
  a proteção de `result_cache_id` recusava a finalização sem cotação e o erro era ignorado.
  Cinco execuções tinham cache real não vinculado. A tela não listava nem retomava após recarga.
- A UI lista apenas execuções do usuário autenticado, retoma pelo mesmo ID e abre o cache de uma
  execução já concluída. Não lança automaticamente buscas antigas ou importa resultados.
- `prospectar-leads` v15 mantém falha transitória recuperável, grava resultado/cache na RPC
  atômica restrita a `service_role` e não desliga a integração por falha de uma busca. Contratos
  de identidade, coordenadas, limite por termo e filtros foram corrigidos sem tocar em canais.
- Migrations `20260925160000_prospecting_resume_atomic_results` e
  `20260925162000_prospecting_cache_transition_recovery` aplicadas no projeto oficial.
  Cinco runs vinculados a caches existentes: 45 resultados, zero leads importados. Dois caches
  históricos com dez resultados adicionais são exibidos sem associação arriscada a runs falhos.
  Type-check frontend/Edge, lint, 35 arquivos/244 testes, build e artefato Sites aprovados.
  Homologação visual da revisão ainda depende de usuário autenticado.

## 2026-09-25 — Etapa 3: erro de persistência visível na importação

- Na Busca, o erro de gravação de leads não tinha tratamento na ação final; a fila de listas
  engolia o erro e permitia navegação antes de confirmar `lead_lists` e seus membros.
- O caminho de sucesso foi preservado. A ação aguarda as filas, informa falha parcial/ambígua,
  reconcilia a lista com o Supabase e não permite importar novamente sem conferir Leads.
- Regressão simulou falha e recuperação da lista. Type-check frontend/Edge, lint, 36 arquivos/
  245 testes, build Vite e artefato Sites aprovados. Leitura remota: zero leads, uma lista
  pendente sem membros, cinco runs concluídos e cinco falhos. Nenhum dado foi importado e
  nenhum provedor ou Ana foi acionado nesta etapa.
- Pendem validação visual autenticada e teste controlado de importação. Escritas de lote e
  vínculos não são transacionais; uma falha parcial exige conferência humana antes de repetir.
## 2026-09-26 — Plano comercial, etapa 2: arquitetura final

- Auditadas as fontes operacionais, migrations, autoridade da Ana, RLS, idempotência, filas e
  modelo `crm_*` legado. Foi confirmado que o fluxo atual usa `leads`; nenhuma consolidação
  destrutiva ou segundo motor foi criada.
- Criado `docs/ARQUITETURA_FINAL_WAYFLEX.md` e endurecido o contrato de pipeline: automação não
  salta etapas e transições comuns não reabrem Ganho/Perdido.
- Aprovaram: contrato específico 6/6, type-check frontend/Edge, lint, Vitest 40 arquivos/257 testes
  e build. Nenhum provedor, banco remoto, canal, lead ou configuração foi acionado.

## 2026-09-26 — Plano comercial, etapa 12

- Publicados no Supabase oficial `ana-run` v36 e `automation-worker` v33.
- Probes sem credencial recusados com HTTP 401/400; nenhum provedor foi chamado.
- Gate operacional: IA e Apify conectadas; Z-API pausada/desativada; zero conta Meta, zero agenda
  ativa e zero job pendente. Leaked Password Protection continua desativada.
- Validação final: frontend/Edge type-check, lint, 42 arquivos/262 testes e build aprovados.
- Decisão: liberar CRM somente para uso supervisionado/piloto; não ativar Automático sem E2E real.

## 2026-09-26 — WayFlex Command Center multitelas

- Aplicada hierarquia visual consistente a Dashboard, Busca, Leads, Kanban, Central, Catálogo, Ana, Configurações, Orçamentos, Agenda, Relatórios e Equipe. O Dashboard apresenta quatro KPIs, prioridade comercial sem somar duas vezes o mesmo lead, sete etapas do pipeline, até cinco próximas ações e seis leituras operacionais.
- Estados de carga/erro impedem que zeros e selos positivos sejam mostrados como dados confirmados antes de consultar a fonte; detalhes ficam em ícones de informação acessíveis por teclado e toque. O Catálogo usa itens reais, com edição existente e rótulo Rascunho para item ainda não ativo.
- Sem alteração de regras de negócio, rotas, integrações, dados remotos, automação ou envio. Type-check frontend/Edge e build/Sites passaram. Oito asserções relevantes apareceram como aprovadas, mas o Vitest não encerrou; o processo foi interrompido, sem afirmar aprovação da suíte completa. Inspeção visual autenticada depende da versão publicada e da sessão do cliente.
- Checkpoint de código `2e8452ea7d021a83faa8bf45284963d3eaeb54d9`; publicação pendente no momento deste registro.
## 2026-09-26 — Guia visual grafite/lima

- Base remota abba1ed reconciliada com documentação local sem perder histórico.
- Refinamento visual compartilhado e balões explicativos; nenhuma mutação de dados operacionais.
- Type-check, lint, 42 arquivos / 262 testes e build passaram. Site v130 publicado (563d00a); revisão visual amostrada desktop/móvel e tooltip confirmado. Nenhum envio ou alteração operacional.

## 2026-09-26 — Busca de Leads: idempotência e revisão compacta

- Aplicadas as migrations `20260926130000_prospecting_run_idempotency` e
  `20260926131000_prospecting_legacy_recovery` no Supabase oficial. A função
  `prospectar-leads` foi atualizada para v16 com JWT obrigatório; zero execução Apify estava em
  andamento na checagem pré-deploy.
- A interface passou a exigir filtros delimitados para uma busca nova, apresenta revisão compacta
  e não trata telefone como WhatsApp validado. Não houve alteração de rota, pipeline, Ana,
  WhatsApp ou execução de provedor.
- CSV continua atômico. A recuperação em memória permite repetir o lote original na mesma página,
  enquanto o navegador não persiste PII do arquivo. O arquivo canônico recebe uma chave estável
  por organização para impedir lote duplicado após recarga.
- Verificado: `npm run type-check`, `npm run type-check:edge`, `npm run lint`, `npm test`
  (44 arquivos/278 testes), `npm run build` e `git diff --check` passaram. Nenhuma busca externa,
  importação, criação de lead, automação ou envio foi disparado.
- Publicação oficial: Site v132, commit `5fe475de2c6cb1eb34cf581fddee5a0364f0ecdb`, deploy
  concluído. A verificação autenticada da página publicada não acionou fluxo operacional e não
  encontrou warning ou erro de console.
## 2026-09-27 — Estado conectado da Z-API separado da ativação

- O erro `whatsapp_provider_disabled` foi reproduzido nos logs: `testar-integracao` v15 confirmou
  a instância com HTTP 200 e, em seguida, `enviar-teste-whatsapp` v3 recusou o envio com HTTP 400
  porque o administrador havia desativado o provedor.
- Um gatilho antigo convertia qualquer integração pausada em `connection_status=error`, ocultando
  o botão de ativação apesar da sessão válida. A migration
  `20260927160000_preserve_whatsapp_connection_state_when_provider_paused` passou a manter
  `connected` separado de `enabled/paused` e reconciliou a conta oficial sem ligar o canal.
- Publicados `testar-integracao` v16 e `whatsapp-accounts` v5. A interface passa a orientar a
  ativação antes do teste e traduz o código técnico. O bloqueio server-side de envio permanece.
- Type-check frontend/Edge, lint, 49 arquivos/306 testes, smoke determinístico 17/17 e build passaram. Nenhuma mensagem,
  callback, job, lead, ativação da Ana ou chamada de envio foi criada.
- Publicado no Site oficial v138 pelo commit `dcc2fea`, deploy
  `appgdep_6ab95cdb9e2081919066cb38e9eedca4`. A inspeção autenticada confirmou a sessão
  **Conectada**, o provedor **Pronto para ativar**, o botão **Ativar**, a integração ainda
  **Pausada** e ausência de erros/warnings no console.

## Redesign comercial — 27/09/2026 (checkpoint anterior à publicação)

- Implementado no Site existente: nova análise comum a Dashboard/Funil/Relatórios, refinamento das 11 rotas e componentes compartilhados. Carteira atribuída separada de autorização de contato; arquivados fora; percentuais sem base indisponíveis; propostas líquidas sem rascunhos; preço desconhecido exige confirmação humana.
- Mensagens assinam Realtime confirmado; carteira/propostas consultam a cada 60 s. Paginação, timestamps originais, contexto de organização e erro explícito. Nenhuma alteração em configuração/banco remoto, ativação ou envio.
- Type-check frontend/Edge, lint e build passaram. Smoke determinístico 17/17. Vitest emitiu passes, mas não encerrou; suíte completa NÃO aprovada. Revisão independente estática de UX, design e dados realizada e principais achados corrigidos. QA visual autenticada NÃO realizada.
- Especificação: `docs/REDESIGN_WAYFLEX_2026-09-27.md`. Próxima ação: confirmar deploy, depois homologação autenticada a 1440/1024/390 px e regressão CI sem executar provedores reais.

## 2026-09-27 — Correção da gravação da Operação automática

- A tentativa real foi localizada nos logs às 18:23 UTC: todos os checks estavam prontos, mas o update de `prospecting_schedules` tentou gravar `handoff_notify_whatsapp=null` quando não havia transferência por etapa; o banco recusou com `23502`.
- A normalização foi fechada em booleano, ganhou teste unitário e falhas futuras de gravação usam o código seguro `schedule_not_saved`. `ana-operations` v5 publicada com JWT obrigatório.
- Type-check frontend/Edge, lint, 50 arquivos/308 testes, build e smoke 17/17 passaram. Site v139 publicado pelo commit `75ea569`, deploy `appgdep_6ab960d08f5c8191b3ebde0460d4cf99`; tela autenticada mostrou nove checks OK e console limpo.
- A operação permaneceu inativa; nenhuma busca, mensagem, fila, lead ou execução da Ana foi disparada.

## 2026-09-28 — Redesign da Busca de Leads com amostra controlada

- Implementado no Site existente o fluxo Perfil ideal → Testar amostra → Revisar leads → Importar.
  O formulário usa somente filtros que o conector atual aplica: cidade, UF, país, termos e
  presença de site/telefone/e-mail. Raio não foi apresentado como filtro efetivo.
- O perfil Wayflex gera sugestões locais e editáveis; termos não são enviados automaticamente.
  A consulta externa é feita somente por **Testar com 10 empresas**, com a fonte ativa já
  configurada. Não houve chamada a Apify, criação de lead, importação ou automação.
- A revisão mantém o cruzamento existente e permite classificar cada resultado; apenas
  **Adequada** pode seguir para a importação. Resultado duplicado continua bloqueado.
- Evidência: type-check, lint, Vitest 53 arquivos/318 testes, build e artefato Sites passaram.
  Site oficial v143 publicado pelo commit `d86fc663bde1d68873a29e23e66c0c40fe995ae4`, deploy
  `appgdep_6aba75ae52e48191ae129154a2876976`; inspeção desktop confirmou a tela renderizada.
## 2026-09-29 — Agenda comercial operacional

- Reutilizada a rota `/dashboard/agenda`, a tabela `appointments`, a relação com `leads`, a RLS organizacional e a Central. Não foi criado calendário paralelo, integração externa ou automação da Ana.
- Aplicada no Supabase oficial a migration `agenda_operational_workspace`. A primeira tentativa foi recusada pelo PostgreSQL porque `OFFSET` não aceita variável direta nesta função SQL; a transação foi revertida sem dados. A consulta foi corrigida com subconsultas escalares e a segunda aplicação foi confirmada. Constraint de visões e triggers de auditoria/updated_at foram conferidos.
- Testes aprovados: `npm run type-check`, `npm run lint`, `npm test -- --run` (56 arquivos/328 testes), `npm run build` e `git diff --check`. Nenhuma mutação comercial ou chamada externa durante os testes. Publicação e homologação visual autenticada ainda pendentes neste checkpoint.

## 2026-09-29 — Funil de inteligência comercial

- Implementado `FunnelAnalytics` sobre as consultas existentes; sem migration, mocks, endpoint ou
  alteração de regra. A rota remove `LeadBaseManager` e mantém gestão de base fora da inteligência.
- Type-check, lint, Vitest 57/329, build e diff check aprovados. Nenhum dado comercial ou provedor
  externo foi acionado. Site oficial v149 publicado pelo commit `efee41a01ec698feee5e033b45807cce5f7724a5`,
  deploy concluído; inspeção autenticada confirmou a rota e os estados reais sem erro de console.

## 2026-09-29 — Configurações > Status operacional

- Reformulado `OperationalStatusTab` no SiteSource, sem migration, endpoint, regra de negócio ou
  automação nova. A tela agora usa os diagnósticos reais para a visão operacional, filtros,
  tabela por grupos, saúde/uso, pré-requisitos da Ana, pausa global e auditoria.
- Removido o painel de limpeza de leads desta tela. As ações de preparar worker, cadastrar callbacks
  Z-API, atualizar status e preparar Ambiente Real continuam nas funções server-side existentes.
- `npm run type-check`, `npm run lint`, `npm test -- --run` (57 arquivos/329 testes), `npm run build`
  e `git diff --check` passaram. Nenhuma mensagem, busca, automação ou mutação comercial foi executada.
- Site oficial v151 publicado pelo commit `609477f9457ca9801a1c99c2fdb9c98a935f032e`, deploy
  `appgdep_6abbc514cc1c8191aef1b8e24f4a4c19` com sucesso. Inspeção autenticada confirmou a tela
  publicada e não observou erro de console.

## 2026-09-29 — Configurações > Entradas do WhatsApp

- Implementada a central de Entradas do WhatsApp com Configuração, Diagnóstico e Histórico sobre os
  contratos backend existentes. A entrada do site tem validação E.164, ativação/pausa confirmada,
  cópia e rotação real de link; roteamento e Ana mostram somente estados comprovados ou bloqueados.
- A Edge Function `site-whatsapp-entry` foi publicada no Supabase oficial com a ação `rotate` e
  auditoria `whatsapp.site_entry_rotated`. Nenhum segredo foi exposto e nenhuma migration foi criada.
- `npm run type-check`, `npm run type-check:edge`, `npm run lint`, Vitest 57/329, `npm run build` e
  `git diff --check` passaram. Site oficial v153 publicado pelo commit
  `ad2b8c5cce6c6b4bcf76af6dbf8e38c3b9e8178b`, deploy `appgdep_6abbcd277b4881918b0b961cde8148d7`
  com sucesso; inspeção autenticada da rota confirmou os dados reais e nenhum erro de runtime.

## 2026-10-03 — Evolution GO multi-canal e transferência por atendente

- Evoluído o adaptador existente, sem criar fluxo paralelo: cada canal Evolution GO é corporativo compartilhado ou privado de vendedor (`owner_user_id`), com metadados e permissões por conta. Segredos e QR não entram na listagem; QR/código são temporários, `no-store` e revalidados no backend.
- A migration `20261003223000_transfer_whatsapp_channel_with_assignee` torna a transferência humana atômica: `assigned_to`, `owner_id` e `whatsapp_account_id` trocam juntos após verificar a conta privada do novo atendente, a integração e os controles. O número antigo fica só como identidade histórica de entrada; respostas tardias não desfazem a conta ativa.
- Todo callback Evolution agora também exige conta habilitada e integração conectada/habilitada/não pausada, mesmo quando outra conta da organização mantém o gate global aberto.
- Validação local concluída: type-check frontend/Edge, lint, build/artefato Sites, `git diff --check` e Vitest **63 arquivos / 371 testes**. Nenhuma instância, QR, mensagem, callback, lead, transferência, automação ou credencial real foi acionada. Próxima ação: aplicação remota e homologação visual segura.

## 2026-10-04 — Sincronização do canal principal Evolution GO

- Confirmada a origem editável do Site e conferido o Supabase oficial: migrations de Evolution, provisionamento individual e as funções `evolution-go`, `webhook-evolution-go`, `evolution-go-worker` e `team-members` já estavam ativas. Os fontes de `team-members` e `evolution-go-worker` foram sincronizados com as versões ativas para não deixar o repositório defasado.
- A tela efetiva de Usuários passou a criar acesso direto com nome, e-mail, senha temporária e papel. A criação agenda a instância individual Evolution GO no servidor; token, nome e ID não transitam pelo frontend. O painel operacional e os atalhos agora apresentam Evolution GO como canal principal, sem disparar o callback legado de Z-API.
- Validação local: type-check frontend/Edge, lint, build/artefato Sites, `git diff --check` e Vitest **63 arquivos / 372 testes**. Não houve criação de instância, QR, mensagem, callback, lead ou automação real. A configuração real ainda exige a URL HTTPS e a chave global da Evolution GO.
- Publicado o Site oficial **v163** a partir do commit `3e61c7730542b12b2eee164155bef8977155434c` (deploy `appgdep_6ac289e4343c8191a29c2bbf96e6185f`). A inspeção autenticada confirmou os campos URL HTTPS, chave global, token/nome/ID da instância e o formulário de usuário com nome, e-mail e senha temporária, sem submissão de qualquer credencial.

## 2026-10-04 — Validação segura do provisionamento Evolution GO

- A conta corporativa Evolution GO foi conferida sem expor segredos: URL HTTPS, chave global, token da instância e segredo de webhook estão presentes no cofre. A auditoria confirma que o provedor aceitou a criação da instância e a solicitação de conexão. O estado atual é `qr`: a leitura do QR Code ou o pareamento ainda é necessária; envio, entrada e automação permanecem corretamente desativados.
- Corrigido o worker de provisionamento individual: ele usa exclusivamente a credencial global da conta corporativa da mesma organização no cofre (com fallback legado somente quando o par de variáveis estiver completo), envia à Evolution somente `{ name, token }` e grava o identificador confirmado pelo provedor antes de finalizar a fila. Resultado incerto ou falha ao gravar o identificador termina em revisão, sem repetir uma criação remota.
- O endpoint de Evolution ganhou a leitura `my_account`; a rota Meu WhatsApp passa a mostrar somente a conta individual pertencente ao usuário autenticado, com Conectar, validar status, QR temporário e código de pareamento. Não entrega conta corporativa, conta de terceiros, URL, chave, token ou configuração administrativa.
- Publicadas no Supabase oficial `evolution-go-worker` v3 e `evolution-go` v6. Validação local: type-check frontend/Edge, lint direcionado, build/artefato Sites, 37 testes focados Evolution/Meu WhatsApp e 106 testes de handlers aprovados; `git diff --check` aprovado. Nenhuma instância individual real foi criada neste lote.
- A publicação do frontend está pendente de concluir o canal seguro de gravação da origem do Site. Próxima homologação: criar, com confirmação explícita, um usuário de papel **Vendedor**, observar a fila chegar a `awaiting_qr` e parear sua própria conta na rota Meu WhatsApp.
## 2026-10-05 — Kanban preserva Ana/Humano e responsável vindos da importação

- O diálogo aberto em **Leads → Enviar para o Kanban** deixava o operador escolher Ana/Humano uma segunda vez e podia sobrescrever a classificação persistida pela Busca de Leads. O fluxo agora usa a configuração de cada lead como fonte de verdade.
- A seleção mista é particionada sem duplicar ativação: leads Ana preservam os gates de autorização/canal e podem receber transferência automática opcional; leads humanos mantêm modo e responsável. Sem modo definido, o envio é bloqueado com mensagem explícita.
- Testes: 93 arquivos/739 testes Vitest, type-check frontend, lint, build/artefato Sites e diff check aprovados. Na prévia autenticada, um lead Ana exibiu o resumo preservado e os controles de segurança, sem botões de reclassificação; a ação foi cancelada. Não houve envio, automação, alteração de lead, migration, Edge ou publicação do Site.

## 2026-10-07 — QR individual Evolution GO: validação remota interrompida pelo runtime

- Publicadas `evolution-go` v24 e `whatsapp-accounts` v9. A primeira passou a iniciar a conexão
  com `immediate: true` e a tratar a primeira resposta 400 do QR apenas com novas leituras seguras;
  a segunda passou a aceitar a origem local homologada exata, sem wildcard.
- Validação local: type-check Edge e 62 testes focados (Evolution GO, CORS e handler) passaram;
  `git diff --check` passou. Validação autenticada: a sessão do vendedor chamou `qr`; o backend
  tentou cinco leituras em cerca de 35 s e recebeu HTTP 400 em todas. O endpoint remoto
  `/instance/reconnect` já havia retornado HTTP 500 e não é mais usado nesse caminho.
- Nenhuma mensagem, automação, lead, dado de cliente, QR válido ou pareamento foi criado. A causa
  pendente é o runtime remoto Evolution GO em estado `close`, que requer intervenção no servidor.

## 07/10/2026 — Evolution GO como único canal operacional

- Escopo: remover os canais legados da área Configurações → Canais e bloquear suas rotas operacionais, sem apagar histórico, credenciais protegidas ou conversas persistidas.
- UI: `WhatsAppEntriesTab` agora apresenta somente o painel `EvolutionGoPanel`, com a política de canal exclusivo e a preservação explícita de registros históricos.
- Supabase: aplicada `20261007193000_evolution_go_exclusive_channels`; pós-validação: 2 contas legadas com 0 habilitadas e 0 padrão, 7 controles legados com 0 roteáveis e 4 integrações legadas com 0 operacionais. As 2 contas Evolution GO foram preservadas e seguem desativadas.
- Edge: `whatsapp-accounts` v10 foi publicada preservando o contrato de autenticação existente, listando somente Evolution GO e recusando as ações legadas de configuração, token, atualização e ativação.
- Validação local: 5 arquivos/198 testes focados, type-check frontend/Edge, lint direcionado, build e `git diff --check`. Prévia autenticada de Configurações → Canais confirmou ausência de cartões e ações Z-API, Meta, WA-AKG e entrada pública. Nenhuma mensagem, automação ou dado de cliente foi alterado. O Site oficial não foi publicado neste lote.

## 07/10/2026 — Ajuste visual factual do painel Evolution GO

- Escopo estrito: somente a apresentação administrativa de Evolution GO em Configurações → Canais. Não houve mudança de API, banco, permissões, regras de provisão, QR, automação ou canais.
- A tela ganhou resumo operacional alimentado pelo estado real (servidor, instâncias individuais, conexões confirmadas e última validação), cartão de servidor com ações existentes, checklist factual e cartões de instâncias vinculadas em largura total.
- Não foram criados campos como porta, segredo de webhook, totais de vendedores, URLs expostas ou indicadores sem fonte no contrato atual. A prévia autenticada mostrou: acesso validado, uma instância individual vinculada e zero conexões confirmadas.
- Validação: type-check frontend, lint direcionado, 53 testes focados e diff check aprovados; inspeção visual da prévia local confirmada. Site oficial inalterado.

## 07/10/2026 — Layout de conexão Evolution GO na Central de Atendimento

- Escopo estrito: apenas a apresentação do painel individual no topo da Central de Atendimento. A página passa `surface="central"` ao mesmo `EvolutionGoPanel`; não foi criado outro fluxo, endpoint, estado ou credencial.
- Para a conta individual autenticada, o painel separa QR/código e ações existentes à esquerda de cartões reais de validação, instruções de pareamento e dados da própria conexão à direita. QR, token, chave global e informações de outras contas continuam protegidos.
- A inspeção autenticada atual foi feita com o administrador `fabricio`, que não possui conta individual, portanto exibiu corretamente o estado vazio e não foi possível observar QR de vendedor sem usar credenciais de outra pessoa. Nenhuma conexão, QR, código ou mensagem foi gerada.
