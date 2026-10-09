# Baseline do sistema

## 09/10/2026 — WA-AKG: recuperação segura para novo pareamento

- O ciclo de `provision` de `fabricio` estava em revisão após a conclusão remota incerta. O novo contrato só libera a recuperação quando a leitura independente confirma gateway acessível, sessão desconectada em `SCAN_QR`/`QR`, webhook próprio e proteções ativas. Não reinicia o gateway, não gera QR, não conecta telefone e não libera mensagens ou Ana.
- A migration `20261009123000_wa_akg_provision_recovery.sql`, a Edge `wa-akg` e o Site v180 estão publicados. A leitura pós-recuperação confirmou `connection_status=qr`, conta e integração desabilitadas, integração pausada e lifecycle `completed` na revisão 22. O gateway está acessível e a sessão em `SCAN_QR`.
- QR, pareamento, mensagem de entrada/saída e Ana continuam deliberadamente não testados/ativados. Próxima ação: o titular gera QR no painel, lê com o telefone pretendido e atualiza o status antes de qualquer teste controlado de entrada.

## 07/10/2026 — QR: saturação PostgreSQL e mitigação remota

Logs da instância atual do Flavio confirmam `pq: sorry, too many clients already` ao criar o cliente WhatsApp. Edge v25 aplicada isoladamente sobre v24: uma chamada QR, sem connect redundante/retries, erro sanitizado. 67 testes locais + 8 do bundle remoto, tipos Edge e diff check passaram. E2E como Flavio retorna erro específico e nenhum QR, com saturação confirmada às 18:07 BRT. Cofre aponta ID atual; job guarda ID histórico. Falta acesso de hospedagem para corrigir PostgreSQL/pools. Não houve mensagem, recriação ou publicação do Site.


## Evolution GO administrativo somente em Canais — 07/10/2026

O mesmo `EvolutionGoPanel` administrativo era montado em Canais e Usuários. A montagem em Usuários foi removida no checkout local, preservando o painel de servidor/conectores em Canais, a gestão de equipe em Usuários e o pareamento individual na Central. A prévia autenticada e testes focados confirmaram a separação; Site oficial não foi publicado neste ajuste.

## Usuários: criação direta restaurada no checkout — 07/10/2026

O formulário local voltou a criar identidade nova com nome/e-mail, papel e senha inicial. `team-members#create` verifica backend e só então cria Auth; a RPC `team_direct_create_attach` registra perfil/vínculo e deixa o gatilho Evolution GO enfileirar o vendedor na mesma transação. Contas globais já existentes não são alteradas. O banco oficial ainda não possui o bootstrap Auth compatível nem o gatilho de vendedor; `team-members` v19 e o Site oficial continuam no fluxo anterior. Não houve usuário/instância/QR real criado; senha inicial não tem troca obrigatória automática.

## Evolution GO: QR local seguro, runtime remoto pendente — 07/10/2026

- A conta individual e a instância do vendedor existem, mas o gateway remoto segue em `close` e `/instance/qr` falha com HTTP 400. O diagnóstico exato de inicialização depende do log da instância. O trigger multi-tenant ainda não foi aplicado ao Supabase oficial.
- O código local `1bd2786` lê QR sem reiniciar a conexão nem criar outra intenção de lifecycle, classifica erros oficiais sem vazar resposta bruta e preserva o bloqueio após desativação. Isso não está publicado na Edge, no Site nem homologado por scan. Mensageria permanece desligada.

## Evolution GO como canal exclusivo — 07/10/2026

- A migração `20261007193000_evolution_go_exclusive_channels` foi aplicada ao Supabase oficial. Ela desabilita entrada, saída e automação de Z-API, Meta e WA-AKG, remove seu status padrão e pausa as integrações; não exclui contas, credenciais, conversas, mensagens, recibos ou auditoria.
- `whatsapp-accounts` v10 lista somente Evolution GO e recusa as ações legadas. Configurações > Canais passou a exibir apenas o servidor e os conectores Evolution GO. A prévia autenticada confirmou a remoção visual; 198 testes focados, type-check do app/Edge e diff check passaram.
- O Evolution GO continua desativado e o pareamento não foi alterado: o runtime remoto da instância individual ainda retorna QR HTTP 400 no estado `close`. Não houve mensagem, automação, lead ou dado de cliente alterado. O Site oficial não foi publicado neste lote.

## Evolution GO: instância individual substituída, QR pendente — 06/10/2026

A recuperação `evolution-go-recovery` v2, com JWT e guarda administrativa/tenant, substituiu somente a instância desconectada do vendedor autorizado. O novo ID `77c6344c-23d0-48a9-81e6-9c0a5177b2f8` é reconhecido com o token do Vault; a conta permanece desativada, integração pausada e job `awaiting_qr`. O vendedor iniciou conexão, mas o runtime Evolution GO retornou QR 400 e reconnect 500; nenhum QR útil ou pareamento foi confirmado. A função `evolution-go` v22 não foi alterada devido a drift remoto/local. O Site oficial permanece inalterado; monitoramento automático ainda não foi ligado.

## Evolution GO: nome local não garante instância remota — 06/10/2026

A conta individual do vendedor pode preservar `instance_name`, token e estado `awaiting_qr` no Supabase quando a instância não está mais no Evolution GO. Caso observado: Manager vazio e `GET /instance/status` com HTTP 401. A validação da chave global não confirma sessões individuais. A prévia local identifica o nome como reservado e bloqueia novo QR após 401; o lifecycle remoto de criação por vínculo ainda não foi aplicado.

## Evolution GO: servidor corporativo autenticado, canal inativo — 06/10/2026

O contrato administrativo `save_server`/`test_server` está ativo em `evolution-go` v22, com URL/chave guardadas no Vault; `evolution-go-worker` v5 exige validação corporativa aprovada antes de provisionar. O painel local abre os campos protegidos e autenticou o servidor remoto com a credencial já salva. Banco: `server_validation=passed`, `enabled=false`, `connected=false`, `paused=true`. O Site oficial não recebeu o frontend deste lote; lifecycle multi-tenant e QR seguem sem homologação/deploy coordenado. Nenhum WhatsApp foi conectado ou mensagem enviada.

## Evolution GO multi-tenant: checkpoint local — 06/10/2026

- O lifecycle local usa trigger de vínculo para manter uma conta privada/integracão desabilitada e **um job durável por organização/vendedor**; o worker processa esse job e o vendedor só consulta/pareia a própria conta. Desconectar ou desativar o vínculo não exclui conversas, mensagens ou histórico.
- Aceite local: **769 Vitest/93 arquivos**, type-check app e Edge, lint, build/artefato, PGlite **6/6** e PostgreSQL nativo **2/2** aprovados. Nenhum QR, chamada a provedor, mensagem, automação ou dado de cliente foi usado.
- Estado de entrega: não aplicado ao Supabase, Edge, Site ou GitHub. Drift remoto e a homologação coordenada/staging continuam bloqueios; o gateway Evolution apresenta QR 400/500 e requer correção/homologação antes de qualquer release. A política de proteção contra senhas vazadas/Auth permanece pendente.

## Casca visual do CRM alinhada à referência — 06/10/2026

- `48478de` aplica somente a composição visual observada na referência: sidebar clara e agrupada, topbar compacto, superfícies brancas com bordas discretas, cards de métricas uniformes e chamadas primárias verdes com contraste AA. Não incorpora módulos, métricas, nomes, rotas ou comportamentos que não existiam no WayFlex.
- A busca de telas já existente permanece limitada às rotas permitidas ao usuário e ganhou apresentação textual no cabeçalho; resultado vazio não muda o breadcrumb. A taxonomia canônica e os gates de permissão continuam iguais. Em Configurações, o seletor continua ativo abaixo de 2xl para impedir duas barras laterais de comprimirem o conteúdo.
- Aceite local: type-check frontend, lint, Vitest 93 arquivos/746 testes, build Vite/artefato Sites e `git diff --check` aprovados; Configurações e Dashboard revistos no desktop. Banco, Edge, Site, mensagens, automações e dados de cliente permanecem inalterados.

## Leads → Kanban: roteamento sem ativação da Ana — 06/10/2026

- A causa da ausência de leads importados da Ana no Kanban era objetiva: `get_kanban_portfolio` exige `modo_atendimento` e `owner_id`/`assigned_to`, enquanto a importação conserva **Ana (IA)** sem um usuário técnico de rota. O fluxo anterior tentava suprir isso acionando `lead-workflow/start_ai`, que também podia alterar consentimento, automação e canal.
- `3665f52` mantém o Kanban como visão do mesmo `lead_id`: para Ana sem rota, `assignKanbanRoutingUser` muda somente `responsavelId`, que o repositório traduz para `owner_id` e `assigned_to`; métricas, origem, etapa, modo e dados da busca não são alterados. Lead humano sem responsável fica bloqueado; um lead já roteado informa que já está no Kanban, sem novo cartão. A ação também está disponível no menu da linha.
- Aceite autenticado: um lead existente da Busca entrou em **Kanban > Novo**, manteve **Busca de leads** e **43/100** após recarga. A segunda tentativa não criou duplicidade; console limpo. Vitest 93/741, type-check frontend, lint, build/artefato Sites e `git diff --check` passaram. Não houve mensagem, automação, migration, Edge ou publicação do Site; a única escrita foi o vínculo técnico do lead autorizado.

## Leads → Kanban: classificação de atendimento preservada — 05/10/2026

- A opção repetida de **Ana (IA)/Humano** no diálogo de envio ao Kanban podia sobrescrever o modo e o responsável persistidos no passo de importação da Busca de Leads. O lote `968a753` remove essa reclassificação do diálogo.
- A seleção agora é separada pelo modo já salvo: cada lead Ana pode passar pela confirmação de canal/autorização e receber, opcionalmente, uma regra de transferência automática; cada lead humano mantém seu responsável e é encaminhado sem troca de modo. Lead sem classificação fica bloqueado com motivo explícito.
- Aceite local: 93 arquivos/739 testes Vitest, type-check frontend, lint, build/artefato Sites e `git diff --check`. A prévia autenticada confirmou o resumo de configuração preservada para um lead Ana e foi cancelada antes de qualquer escrita. Banco, Edge e Site não foram alterados.

## Leads → Kanban e pipeline comercial — 05/10/2026

- A ação em massa para abrir o fluxo existente de Kanban estava ausente da carteira de Leads, embora `enviarParaKanban` e seu diálogo já estivessem implementados. `a20a420` restaura somente o acionador, com checagem de que os leads selecionados pertencem à carteira editável do operador.
- `leadStageRepository` passou a publicar a lista canônica de sete etapas para Leads e para a política de transferência. Ganho e Perdido são visíveis no seletor, mas seguem resultados terminais: o frontend os identifica e o servidor conserva a conclusão individual por orçamento, motivo e aceite.
- Aceite local: Vitest completo 92/736, type-check frontend, lint, build/artefato Sites e `git diff --check`; inspeção autenticada abriu e cancelou o diálogo sem envio, automação ou mudança de dados. Banco, Edge e Site não foram alterados.

## Importação Busca → Leads — 06/10/2026

- A RPC `import_prospecting_batch` recusava toda importação da Busca porque o mapeador inclui `uf` e a allowlist da função não. O erro era `prospecting_import_invalid_lead_fields`/22023, não uma ausência de permissão.
- `b2da2ad` e a migration oficial `20261006011920_fix_prospecting_batch_state` aceitam e persistem somente `uf`, preservando a transação atômica, `SECURITY INVOKER`, RBAC e idempotência.
- O mesmo lote de 20 leads escolhido pelo operador foi confirmado em Leads com São Paulo/SP. Nenhuma mensagem ou automação ocorreu; somente a lista e os 20 leads selecionados foram criados. Site oficial inalterado.

## Busca de Leads — Critérios e quantidade — 05/10/2026

- A regressão foi limitada ao Wizard: o preflight remoto de `prospectar-leads` v16 recusava a origem local e a interface mantinha a consulta em 10 fixos sem expor a quantidade. O fluxo de importação e as demais áreas não foram modificados.
- `86cd668` restaura quantidade de 1–100 e a passa por `executarBusca(leadsDia)` ao contrato já existente `filters.volumeMaximo`. A única aplicação remota foi `prospectar-leads` v17; não houve migration nem deploy do Site.
- E2E autenticado solicitou 20 por Apify/Google Maps e a revisão recebeu 20; preflight 204, execução assíncrona 202 e resultado 200. Nenhum lead foi importado ao CRM, mensagem enviada ou automação acionada.

## 05/10/2026 — Diagnóstico operacional: CORS de homologação restaurado

- `operational-diagnostics` v19 está ativo no projeto Supabase. O helper CORS preserva a origem local homologada exata mesmo quando `ALLOWED_ORIGINS` contém uma lista explícita; não foi usado curinga nem liberada outra origem.
- A rota autenticada de Status operacional carregou com dados reais em `http://127.0.0.1:4173/dashboard/configuracoes?tab=operacao`; consulta manual repetida permaneceu estável. Type-check frontend/Edge, lint, build e diff check aprovados.
- Escopo: somente leitura de diagnóstico e CORS. Nenhuma migration, Site, mensagem, QR, automação, fila ou dado de cliente foi alterado. O NO-GO dos demais fluxos permanece.

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

## Auditoria V3 — 05/10/2026 — NO-GO, sem remediação

- Código auditado `847048429a86294aa10fa54ffdd750c04447d4fb`; GitHub inicial `9fdfb554ed5e23b1edc5b7e5250bd8df84cbad7d` com a mesma árvore. Site oficial v168, fonte isolada `87b9b8309eb8fc0fa4d47611c7a1315598fc4f76`, não alterado.
- Auditoria no acesso seguro disponível: 421 testes existentes e17 smoke passaram; 40 assertivas novas tiveram 7 aprovações/33 reprovações; typecheck integral Edge encontrou9 diagnósticos. UI autenticada Wizard/Central/estados vazios e reflow320/390/1024/1440 conferidos sem negócios.
- Bloqueadores: policies de carteira/Storage/supressão, último admin/convites, gate global por vendedor, concorrência/retomada, SQL de recibos inválido remoto, caches de sessão, flags comerciais sem consumo e próxima ação de Agenda. Relatório e evidências em `docs/auditoria/2026-10-05-v3/RELATORIO_AUDITORIA.md`.
- Apenas docs/testes/checkpoint alterados. Nenhuma mensagem, cliente, busca paga, integração, cron, migration ou publicação alterado pelo agente. A operação real previamente habilitada não foi desligada silenciosamente.
- Homologação externa permanece incompleta. Próxima ação: autorização explícita de remediação dos lotes R1/R2/R3 do plano; depois sandbox/gateway/perfis/destinos para E2E. Não repetir auditoria completa nem publicar todo checkout.

## Wizard da Busca de Leads — 05/10/2026 — LOCAL VALIDADO, SITE PENDENTE

- A entrada manual passou a seguir **Fonte → Região → Perfil → Critérios**, com validação somente do passo atual, resumo do que já foi escolhido e retorno linear. A fonte é escolhida uma vez no primeiro passo; o seletor duplicado foi removido da configuração.
- A consulta continua limitada ao comando explícito **Testar com 10 empresas**. `executarBusca` ainda revalida modo operacional, fonte conectada/ativa, cidade e termos; revisão, classificação, importação atômica e histórico preservam os contratos anteriores.
- Código no commit `b01f600`. Vitest focado (**3 arquivos / 12 testes**), type-check, lint sem warnings, build/artefato Sites e `git diff --check` passaram. Nenhum provedor, lead, importação, mensagem ou automação foi acionado.
- O Site oficial segue na última versão publicada porque a origem protegida do Sites ainda não aceita escrita por este canal. Falta publicar e inspecionar o fluxo autenticado; a prévia nova sem runtime-config público não é usada como prova de UI autenticada.

## Agenda comercial operacional — 29/09/2026

- `/dashboard/agenda` passou a consultar o portfólio paginado em `get_agenda_portfolio`, uma RPC `SECURITY INVOKER` que preserva a RLS e aplica texto normalizado, telefone, responsável, tipo, status, origem, segmento, confirmação, próxima ação, atalhos e período no servidor.
- `appointments` permanece a única entidade operacional. A migration `agenda_operational_workspace` adicionou índices de leitura, `updated_at` consistente e auditoria de inserção/edição/exclusão. `user_saved_views` agora aceita `agenda` e continua isolada por usuário e organização.
- Não há integração Google Calendar/Outlook cadastrada no estado oficial; por isso a Agenda não afirma sincronização externa. Lembretes mostram somente estado persistido, sem alegar entrega.
- Evidência atual: migration aplicada e trigger/constraint conferidos no projeto `thgzrkppouoevapjquyu`; type-check, lint, Vitest 56/328, build e diff check aprovados. Falta homologação autenticada de criação/edição/reagendamento com um compromisso autorizado e reversível.

## Canais de WhatsApp orientados por evidência — 28/09/2026

- `/dashboard/meu-whatsapp` recebeu a superfície **Canais de WhatsApp** com abas Canais, Diagnóstico e Histórico, responsiva e acessível. O painel mantém Z-API como canal em uso e apresenta Meta somente sob seu gate de homologação; não troca provedor nem simula conexão.
- `whatsapp-accounts` v6 deriva estado somente de conta, integração, controles, auditoria e eventos de entrada da própria organização. Credenciais não entram no contrato. Aceite, entrega, leitura e entrada são estados separados; um aceite isolado não eleva o canal a operacional.
- Não houve migration: fontes canônicas e RLS existentes foram reutilizados. Type-check frontend/Edge, lint, `runtimeHandlers` (103 testes), build e diff check passaram. Nenhuma mensagem, teste de provedor, conexão Meta ou alteração operacional foi disparada.

## Kanban operacional — 28/09/2026

- `get_kanban_portfolio` é a leitura única, `SECURITY INVOKER`, que aplica a busca e os filtros no servidor e devolve itens paginados, contagens por etapa e prioridades no mesmo contrato sob a RLS existente.
- `user_saved_views` é a preferência pessoal persistida do Kanban: RLS exige sessão, organização atual, membro ativo e o próprio usuário. Não se tornou uma fonte operacional paralela.
- `undo_recent_lead_stage_transition` restringe a reversão ao último movimento humano do mesmo usuário dentro de 30 segundos, bloqueia estados terminais e registra a trilha pelo gatilho canônico. `update_kanban_stage_alert_threshold` exige `configuration.manage`.
- Migrações remotas: `kanban_operational_portfolio` e `kanban_saved_views_fk_index`, projeto `thgzrkppouoevapjquyu`. Commit local `fcb2c75`; frontend ainda aguarda publicação oficial. Type-check, lint, 55 arquivos/323 testes e build passaram sem chamadas a provedores.

## Assistente de termos por segmento — 28/09/2026

- A etapa **Termos de busca** mantém entrada manual e oferece grupos selecionáveis alinhados à Wayflex: Borracha, Silicone, Poliuretano, Vedação industrial, Manutenção industrial e Aplicações e mercados.
- As escolhas usam o mesmo estado e o mesmo limite de dez termos da busca existente. Não há segunda fonte de dados, execução automática de provedor ou preenchimento silencioso.
- Site oficial v142, commit `58143d5`; type-check frontend/Edge, lint, 52 arquivos/315 testes e build aprovados.

## Seletor dinâmico de APIs na Busca de Leads — 27/09/2026

- **Busca de Leads** consulta novamente as fontes operacionais ao abrir e quando a aba do navegador volta ao foco. O seletor mostra somente APIs com adaptador real no backend, conexão validada e uso ativado em Configurações.
- Apify — Google Maps e Google Places compartilham o mesmo contrato `prospectar-leads`; IA, CSV e integrações sem adaptador não entram falsamente no seletor. Mesmo com uma única API ativa, o controle continua visível e o botão identifica a fonte escolhida.
- Nenhuma tabela, credencial, Edge Function ou regra da busca foi alterada. Type-check frontend/Edge, lint, 52 arquivos/313 testes, build e 17 verificações determinísticas passaram sem chamar provedor externo.

## Envio real e reconciliação do aceite Z-API — 27/09/2026

- O primeiro contato ficou em fila por `outside_business_hours`, comportamento coerente com domingo inativo e `businessHoursOnly=true`. Com autorização explícita, somente esse job foi liberado; a política foi restaurada imediatamente e a exceção auditada.
- A Z-API aceitou uma apresentação às 16:49 e o webhook registrou a resposta **“Boa tarde”** às 16:51. Saída e entrada foram comprovadas sem envio duplicado.
- Corrigido `private.project_proposal_delivery_after_message`, que referenciava `outreach_jobs.created_at` inexistente e quebrava a persistência após o aceite externo. Migration local `20260927195156`, remota `20260927195241`; reconciliação concluída como `processed/sent`.
- A Ana processou a entrada, mas transferiu ao humano por confiança 15% abaixo do mínimo 20%. Transporte está comprovado; continuidade automática desse cumprimento continua bloqueada pela política vigente.
- Commit `fdc3d74`; type-check frontend/Edge, lint, 51 arquivos/311 testes, build e 17 smoke checks aprovados. Site v140 e horário comercial original preservados.

## Fluxo da Ana no Kanban restaurado — 27/09/2026

- Logs do projeto oficial localizaram a interrupção na RPC `resolve_lead_whatsapp_account`: nomes de saída de `RETURNS TABLE` colidiam com colunas não qualificadas e produziam `owner_user_id is ambiguous` antes da apresentação.
- A migration `20260927193046_fix_whatsapp_account_resolver_ambiguity` foi aplicada no Supabase oficial (registro remoto `20260927193211`) e preserva seleção de conta, controles do provedor, `SECURITY DEFINER` com `search_path` fixo e `EXECUTE` somente para `service_role`.
- Prova transacional com lead sintético aprovado resolveu a conta corporativa e foi revertida; zero resíduos em leads, mensagens e jobs e nenhuma chamada externa. Type-check frontend/Edge, lint, 51 arquivos/310 testes, build e 17 smoke checks passaram.
- Código no commit `4fd878f`; Site v140 permanece vigente porque não houve alteração de frontend. O E2E externo com um novo lead controlado continua necessário para comprovar mensagem recebida e transição real para **Apresentado**.

## Gestão definitiva da base no Funil — 27/09/2026

- `LeadBaseManager` voltou a ser montado em **Funil → Gerenciar base**. O redesenho anterior havia preservado o componente e o backend, mas removido seu único ponto de acesso.
- A superfície só aparece para `leads.read_all`; a ação definitiva exige também `leads.delete`, seleção explícita e confirmação textual. O purge transacional e auditável continua exclusivamente no backend.
- Supabase oficial saudável: `lead-governance` v1 ativa com JWT; `lead_governance_snapshot` e `purge_selected_operational_leads` executáveis por `service_role` e negadas a `authenticated`.
- Site v140 publicado pelo commit `2ef48dd`. Type-check frontend/Edge, lint, 51 arquivos/309 testes, build e 17 smoke checks passaram; inspeção autenticada confirmou a gestão sem executar exclusão.

## Gravação da Operação automática — 27/09/2026

- Confirmado em logs do Supabase: a tentativa real falhou antes de ativar porque `handoff_notify_whatsapp` recebeu `null` quando a transferência por etapa estava vazia, violando o `NOT NULL` de `prospecting_schedules`.
- `ana-operations` v5 normaliza esse campo como booleano total e responde `schedule_not_saved` para falhas futuras de persistência. Site v139 publicado pelo commit `75ea569`.
- Os nove checks de prontidão estão verdadeiros, mas a operação e a agenda permanecem inativas. Type-check frontend/Edge, lint, 50 arquivos/308 testes, smoke 17/17, build e inspeção autenticada sem console errors aprovados.
- A ativação real e qualquer execução externa não foram usadas como teste. O administrador deve repetir **Ativar Automático** conscientemente.

## Estado físico e ativação da Z-API — 27/09/2026

- A validação real de status confirmou a sessão corporativa da Z-API conectada. Depois da ação administrativa do operador, `whatsapp` e `zapi_webhook` aparecem conectados, habilitados e não pausados; o `killSwitchGlobal` está desligado. Isso satisfaz a prontidão, mas ainda não comprova o E2E de mensagem.
- Corrigida a mistura entre sessão remota e uso operacional. Uma integração pausada não transforma mais a conta conectada em `error`; o cartão passa a mostrar **Pronto para ativar** e mantém a ativação como ação explícita do administrador.
- O teste de saída não tenta enviar enquanto o provedor estiver desativado e apresenta orientação legível em vez de `whatsapp_provider_disabled`. O backend continua bloqueando qualquer envio fora desse gate.
- Migration `20260927160000_preserve_whatsapp_connection_state_when_provider_paused` aplicada. `testar-integracao` v16 e `whatsapp-accounts` v5 publicados. Nenhuma mensagem, callback, job ou execução da Ana foi criada nesta correção.
- Validação integrada: type-check frontend/Edge, lint, 49 arquivos/306 testes, 17 smoke checks e build aprovados. Site oficial v138 publicado pelo commit `dcc2fea`; inspeção autenticada confirmou **Conectada**, **Pronto para ativar**, botão **Ativar**, estado **Pausada** e console sem erros. A homologação externa ainda exige ativação consciente, teste individual autorizado e comprovação de entrada/recibos.

## Redesign comercial — 27/09/2026

- Fonte única `commercialAnalytics.ts` para Dashboard, Funil, Relatórios e predicado do Kanban. Atribuição comercial não é autorização de contato. Carteira/propostas paginadas, timestamps preservados, valores líquidos e estados sem base explícitos.
- Shell responsivo, composição analítica, diálogos nativos, fontes operacionais preservadas. Nenhuma nova tabela, migração, Edge Function ou alteração de configuração remota.
- Type-check frontend/Edge, lint, build, smoke determinístico 17/17 e suíte Vitest integrada 49 arquivos/306 testes aprovados. A tela de Canais foi validada autenticada após v138; a homologação visual completa das demais rotas e breakpoints continua pendente. Especificação e limites em `docs/REDESIGN_WAYFLEX_2026-09-27.md`.

## Orientação de pendências da Ana automática — 27/09/2026

- O painel de Operação automática apresenta a prontidão devolvida por `ana-operations` como itens acionáveis: requisito, motivo da pendência e destino exato para correção.
- A tentativa de ativação leva ao primeiro requisito pendente; a navegação direta reconhece a área e a etapa da configuração da Ana. A pausa global continua sendo alterada pelo fluxo operacional existente.
- Mudança somente de orientação e navegação no frontend. Nenhuma regra de prontidão, tabela, função, integração ou estado remoto foi alterado. Site oficial v136 publicado pelo commit `de6d902`; type-check, lint, 46 arquivos/282 testes e build aprovados.

## Paleta única da Dashboard — 27/09/2026

- O shell `wf-app` concentra a paleta oficial e os tokens Tailwind de background, foreground, primary, secondary e accent. Telas operacionais e administrativas reutilizam esses valores em vez das antigas paletas teal, Apple e Tailwind padrão.
- Estados continuam semanticamente distintos: verde para sucesso, âmbar para atenção e coral para erro/urgência. Grafite e lima permanecem ações e seleção; cores proprietárias ficam restritas aos ícones de provedores.
- Alteração exclusivamente visual, sem impacto em rotas, domínio, Supabase, Ana, filas ou integrações. Type-check, lint, 46 arquivos/282 testes e build aprovados; Site oficial v135 publicado pelo commit `8a48ea4`.

## Controle da Ana automática na Dashboard — 27/09/2026

- A Dashboard reutiliza `ana-operations`, `company_settings` e o último `prospecting_schedules`; não cria fonte de configuração paralela.
- A ação de ativar/pausar é atômica no banco, exclusiva do backend, auditada e condicionada aos mesmos gates da operação automática. `ana-run` continua sendo a única autoridade de conversa e decisão da Ana.
- A instalação oficial está configurada para modo automático, porém desativada. IA, Apify e agendador estão disponíveis; WhatsApp de saída e `zapi_webhook` permanecem pausados, então a ativação continua bloqueada por segurança.
- Validação local: type-check frontend/Edge, lint, 46 arquivos/282 testes e build aprovados. Migration aplicada, Edge Function `ana-operations` v4 publicada e frontend publicado no Site oficial v134 pelo commit `2b6cb64`.

## Etapa 4 do plano comercial — dossiê técnico de qualificação, 26/09/2026

- `lead_qualifications` permanece o único registro de qualificação. `technical_context` e
  `missing_fields` guardam o dossiê estruturado sem criar outra conversa, fila ou agregado.
- A Ana só preenche valores explicitamente informados pelo lead; campos ausentes ficam nulos e
  aparecem como confirmação pendente. Caminhos de política não inferem contexto técnico.
- Central e Kanban leem o mesmo registro com RLS existente, exibindo prontidão, interesse,
  encaminhamento, dados técnicos e próxima ação. O vendedor não ganha uma rota de envio nova.
- Migration oficial `20260926123000_lead_technical_dossier` e sua estrutura foram verificadas.
  Type-check frontend/Edge, lint, 41 arquivos/258 testes e build passaram; provedores e canais
  permaneceram inalterados.

## Etapa 3 do plano comercial — catálogo Wayflex rastreável, 26/09/2026

- `knowledge_catalog_items.qualification_questions` guarda de uma a oito perguntas internas por
  item. Elas são guias de descoberta comercial, não fatos técnicos e não substituem uma fonte
  oficial da Wayflex.
- A migration oficial `20260926085704_catalog_qualification_guides` preencheu 56 itens ativos
  da organização Wayflex (19 produtos, 19 serviços e 18 catálogos) e recompôs documentos/chunks
  derivados pelo trigger existente. Não houve nova tabela, integração ou caminho de despacho.
- A interface de Empresa e conhecimento permite revisar, editar e pesquisar as perguntas; os
  formatos comercial/técnico as identificam como orientação de qualificação. Dados de aplicação,
  anexos e especificações continuam condicionados à fonte publicada.
- Validação local: type-check frontend/Edge, lint, 40 arquivos/257 testes e build aprovados.
  Verificação SQL confirmou 56/56 itens com perguntas dentro do limite; nenhum provedor, lead ou
  configuração operacional foi alterado.

## Etapa 2 do plano comercial — arquitetura final, 26/09/2026

- O contrato final está em `docs/ARQUITETURA_FINAL_WAYFLEX.md`: `leads` continua como agregado
  operacional, `lead_messages` como histórico e `ana-run` como única autoridade automática.
- As tabelas `crm_*` antigas permanecem apenas por compatibilidade. Não foi criado um segundo CRM,
  fila ou motor, nem executada migração destrutiva.
- A máquina compartilhada bloqueia salto automático de etapas e transições comuns para fora de
  Ganho/Perdido. Ganho exige humano; Perdido automático continua restrito a opt-out inequívoco.
- Validação local: type-check frontend/Edge, lint, 40 arquivos/257 testes e build aprovados.
  Nenhum banco, lead, canal, provedor ou configuração operacional foi alterado.

## Etapa 4 — importação em lote atômica, 25/09/2026

- `import_prospecting_batch` é o único caminho da revisão Busca → Leads/lista: uma transação, mesma organização, permissão de criação e atribuição validada. Retry com mesmo ID e conteúdo não duplica; conteúdo divergente com mesmo ID falha. Lista e membros não permanecem em falha.
- Migration aplicada ao Supabase oficial; transações de sucesso, rollback e RBAC passaram sem dados de teste persistidos. 255 testes, type-check, lint e build passaram. A validação humana ponta a ponta foi adiada pelo operador.

## Etapa 3 original — Usuários e responsáveis, 25/09/2026

- A Busca usa a equipe ativa real da organização para atribuição humana, exige um responsável
  explícito e reconfirma acesso antes de importar. O Supabase valida membro ativo e permissão
  de atribuição também no banco. CSV não herda o modo humano.
- Três membros ativos foram confirmados; teste de RBAC em transação revertida, sem alterar leads.
  Ana, canais e buscas pagas não foram acionados. 39 arquivos/253 testes, type-check, lint e
  build passaram. Site v123 (`5ac4a6b`) publicado e seletor real validado após recarga;
  submissão sem responsável foi bloqueada antes de criar lead.

## Estado atual — fechamento da Busca, etapa 2 original, 25/09/2026

- Site v121 (`5e5d57c`): duas importações autenticadas conferidas após recarga e no Supabase.
  Dois leads de homologação, duas listas com um membro cada e uma lista antiga sem membros.
  Fonte, categoria e UF são dados da resposta; porte ausente permanece nulo. Dois duplicados
  desabilitados na revisão. Nenhuma mensagem/job ou execução paga criada.
- Cinco buscas concluídas e cinco falhas históricas; não há as cinco buscas running do snapshot
  antigo. Z-API/Meta continuam com entrada, saída e automação desligadas/kill switch ativo.
- Geometria do mapa publicada v122 (`03b7c7c`) após clique revelar marcadores sobrepostos por
  zoom incorreto. Reteste com mouse abriu corretamente Via Varejo e Galpão nos respectivos
  marcadores. 38 arquivos/252 testes, frontend/Edge typecheck, lint e build aprovados.
- Próxima etapa ORIGINAL: Usuários e responsáveis, GPT-6 Sol High, após confirmação do operador.
  O seletor da importação ainda usa mockUsers; não homologar atribuição humana/distribuição.
- Relatório: `docs/HOMOLOGACAO_BUSCA_2026-09-25.md`. Histórico abaixo não substitui este estado.

## Histórico — correção complementar de importação (antes denominada etapa 3)

- A importação manual de resultados da Apify mantém a seleção explícita, a criação de leads
  sem envio externo e a navegação para Leads no sucesso. Agora aguarda também a persistência
  da lista e da atualização final antes de navegar.
- Falhas de gravação não são mais ocultadas: a lista é recarregada do Supabase, a tela mostra
  uma mensagem de resultado incerto e bloqueia nova submissão até o operador conferir Leads.
  Não há mudança em schema, RLS, Ana, Kanban, mensagens ou provedores.
- Type-check frontend/Edge, lint, 36 arquivos/245 testes e build/artefato passaram. Não houve
  importação real para homologação: a leitura do projeto oficial apontou zero leads.

## Referência histórica — etapa 1 de 25/09/2026

Código `9bdd136eaa9c03a2eb1eca91f67e57d3dac88579`, tag
`baseline-wayflex-stage1-20260925`, com runtime idêntico ao Site v118 (`a55a0a2`).
Type-check frontend/Edge, lint, 35 arquivos/238 testes e build/artefato Sites aprovados.
Inventário sanitizado: `.agent/baselines/2026-09-25-stage-1.json`;
procedimento e limites: `docs/BASELINE_ETAPA_1_2026-09-25.md`.

Na captura da etapa 1 (estado histórico, não atual): Ana em modo automatic com
rotina desativada; Z-API e Meta com entrada/saída/automação desligadas; nenhuma conta Meta;
uma conta Z-API não arquivada e desabilitada; zero leads/mensagens/filas na Wayflex.
Cinco buscas Apify permanecem running. Nenhum estado remoto foi alterado nesta etapa.
GitHub main e repositório do Site têm raízes distintas; não sincronizar por substituição.

O operador exige troca manual de modelo e confirmação entre etapas. Na captura da etapa 1,
a próxima era Busca/Apify. Usar a próxima ação do estado atual acima; não avançar automaticamente.

Base validada: `4d072280a09b3b8462f5bf0dfa701b314eca31bb`.

## Produto

CRM multiempresa WayFlex para prospecção, qualificação, atendimento, Kanban, agenda e
orçamentos. Não é sistema de venda, checkout, pedido ou recebimento.

## Stack confirmada

- React, TypeScript, Vite e Tailwind no frontend.
- Supabase Auth/Postgres/RLS/Storage/Edge Functions no backend.
- Site privado existente, com publicação vinculada ao repositório Git.
- O design global segue o padrão **Wayflex Executive Light**: superfícies claras, contraste
  neutro, verde institucional, bordas finas e navegação orientada ao processo comercial.
- Como este Site é uma exportação estática Vite, o Worker do Site entrega
  `/runtime-config.js` com `VITE_PUBLIC_SUPABASE_URL` e a chave publicável. O ambiente do Site
  é a fonte desses valores; o artefato e o Git não guardam nenhum valor real. O endpoint tem
  `no-store`, portanto a alteração de ambiente não exige recompilar a chave no bundle.

## Fontes operacionais principais

- `leads`: identidade, carteira, canal, estágio e estado de automação.
- `lead_messages`: histórico cronológico usado pela Central e pela Ana.
- `agent_runs`: decisões e erros da Ana.
- `outreach_jobs` e `lead_outreach`: fila e rastreio de saída.
- `channel_inbound_events` e `webhook_events`: entrada e callbacks.
- `company_settings`, `integrations` e `organization_module_data`: configuração operacional.
- `documents`/`knowledge_chunks`: base aprovada consultável pela Ana. A curadoria
  pública Wayflex v2 contém 61 fontes ativas (catálogos, segmentos, acessórios e políticas),
  cada uma com a página oficial de origem.

## Estado validado antes do delta atual

- `ana-run` é a autoridade automática pretendida e aplica bloqueios de segurança.
- Configurações principais passaram a consultar fontes remotas.
- O painel expõe somente **Ambiente Real**. `company_settings.sandbox_mode` permanece como
  guarda interna de segurança: enquanto verdadeiro, o painel informa “configuração pendente”
  e o backend bloqueia saídas automáticas. Após validar a Z-API sem itens antigos na fila,
  `testar-integracao` grava o Ambiente Real e audita a ativação. Comunicação manual e
  automação da Ana têm sinais de prontidão separados.
- `integrations.category` separa persistentemente prospecção, comunicação, inteligência,
  agendamento e sistema. O painel não duplica o cofre nem a validação.
- A saída Z-API é validada separadamente da entrada. O assistente cadastra o endpoint
  oficial `update-webhook-received` no backend sem expor URL/token e só considera a
  entrada homologada após callback real associado a um lead e processado pela Ana.
- Configurações > Canais oferece um teste direto de WhatsApp: o operador informa um número
  controlado, o backend valida a instância e envia uma única mensagem real sem criar lead,
  conversa ou automação. Esse teste não comprova a entrada nem a Ana.
- A Central cria o registro e o job auditável antes de chamar o worker para despachar somente
  aquela mensagem humana. Se a tentativa imediata não fechar, o job permanece na fila
  server-side para recuperação segura.
- O cron `leadai-automation-worker-dispatch` está instalado no banco e chama o worker
  com token por empresa do Vault após o administrador preparar o Worker 24/7. A proteção
  interna de `sandbox_mode` continua bloqueando saídas automáticas até a preparação real.
- A limpeza de teste agora é transacional e exige seleção explícita: candidatos identificados
  por marcadores objetivos são exibidos antes de remover mensagens, filas, execuções, Kanban,
  agenda, atendimento, orçamentos e identidades de canal. Nenhum candidato é apagado automaticamente.
- `operational-diagnostics` e `team-members` foram publicados.
- O Dashboard concentra indicadores comerciais, a atividade real de conversas e cartões compactos
  de Canais, APIs e Fontes de busca. Cada cartão usa o diagnóstico do backend e distingue
  **Validada**, **Validação vencida**, **Entrada pendente**, **Pausada**, **Erro de conexão** e
  **Não configurada**; não há indicador decorativo de online.
- O Dashboard também consolida a atividade das conversas a partir de `lead_messages` reais.
  A assinatura Realtime é restrita à organização autenticada e o selo de atualização ao vivo só
  é exposto após a confirmação de inscrição pelo Supabase.
- Configurações separa responsabilidades em **Canais** e **APIs**. A validação e o teste direto
  da Z-API ficam exclusivamente no bloco Canais > WhatsApp; a entrada é mostrada ali apenas como
  diagnóstico de callback, sem disparar nova validação ou mensagem.
- Build, lint, typecheck e 104 testes estavam aprovados no commit-base.
- A versão privada publicada correspondente ao último lote conhecido é a 48.

## Não declarar como concluído

- Homologação real WhatsApp/Claude e E2E autenticado.
- Homologação do Worker 24/7 da WayFlex: a infraestrutura e o heartbeat existem, mas a
  empresa ainda precisa ativá-lo no assistente e comprovar a primeira execução.
- Pipeline multimídia completo (extração/OCR/transcrição/embeddings).
- Remoção integral de stores/mocks operacionais e funções legadas.
- Prontidão comercial sem nova auditoria final e piloto controlado.

## Delta atual — configuração da Ana

- A versão ativa de `ai_agents`/`ai_agent_versions` é a fonte de comportamento da Ana:
  conteúdo, canais, cadência, horário comercial, limite diário por lead e handoff.
- `ana-run` é a única autoridade automática; a interface não envia automaticamente nem
  conserva um fallback textual genérico. Conteúdo comercial sensível é encaminhado para
  revisão humana. Uma saída automática traz a versão que a gerou e é recusada se a versão
  publicada tiver mudado.
- `automation-worker` revalida proteção interna, canal, handoff, configuração e lead antes
  do provedor. Isso reduz, mas não elimina, a corrida entre uma tomada humana e a chamada
  externa.
- A seleção de provedor/modelo não expõe chaves nem é evidência de execução do modelo.

Detalhes de continuidade e releases ficam em `docs/CONTINUIDADE_WAYFLEX.md`.

## Delta de segurança e autonomia — 13/09/2026

- O fluxo principal mantém somente Apify e entrada manual; conectores legados não foram
  apagados, mas não aparecem na busca principal.
- Telefone não é mais promovido implicitamente a WhatsApp. A Ana e o worker exigem aprovação
  explícita de contato para qualquer ação proativa.
- A Base aprovada entra na decisão por recuperação híbrida quando houver embedding; a instalação
  atual tem 61 chunks ativos ainda sem vetor, portanto usa fallback lexical.
- A Ana pode agendar reunião apenas com horário explícito e disponibilidade confirmada; não cria
  orçamento com valor/prazo nem passa do limite comercial de orçamento.
- O diagnóstico lista fila e saída por mensagem. Aceite do provedor, entrega e leitura são
  estados distintos.
- A reconciliação server-side encerra aceite comprovado sem reenvio. Seis registros históricos
  foram corrigidos e `automation-worker` v19 contém a rotina recorrente.

## Delta de operação automática e alertas — 13/09/2026

- A operação diária da Ana reutiliza `prospecting_schedules`, `prospecting_schedule_runs`, Apify,
  `automation-worker` e `ana-run`. Três modos governam a execução: simulação sem provedor,
  supervisionado com aprovação e automático sujeito à prontidão e limites.
- `lead_qualifications` é a leitura estruturada de interesse/intenção/evidência. `domain_events`
  aciona notificações auditáveis; `notifications` é fonte do sino e da Atenção do vendedor.
- O estado de implantação é `ana_operation_enabled=false` e `ana_operation_mode=simulation`.
  Código e schema não equivalem à homologação de Apify, WhatsApp, IA ou Calendar reais.

## Delta de governança e entrada do site — 16/09/2026

- `team_member_permissions` representa exceções individuais sobre o perfil padrão. A matriz é
  aplicada pela função privada de autorização, pelas políticas RLS e pelas Edge Functions.
- `whatsapp_site_entries` guarda apenas o número público e o marcador do link de entrada. Nenhum
  token Z-API, service role ou segredo de IA entra nessa tabela, no frontend ou no Git.
- A Base de Leads administrativa recebe dados do backend e só exclui selecionados após confirmação
  textual. A rotina transacional remove o grafo operacional, preservando os registros de auditoria
  imutáveis por governança.

## Delta de equipe e acesso — 14/09/2026

- Criação e convite de membros preparam `organization_invites` antes do Supabase Auth. Assim,
  `private.handle_new_auth_user` associa a identidade diretamente à organização ativa e não cria
  um onboarding paralelo.
- Juca está confirmado, ativo e com papel de administrador na WayFlex. O login com a senha definida
  pelo operador não foi executado pelo agente e continua sendo a validação humana restante.

## Delta de teste direto Z-API — 17/09/2026

- `enviar-teste-whatsapp` estava correto ao interromper o fluxo antes de `/send-text` quando a
  reserva idempotente retornava erro. A falha SQL foi localizada em
  `reserve_whatsapp_direct_test`, não na credencial ou na instância Z-API.
- A migration `20260917150914_fix_whatsapp_direct_test_reservation_special_forms` troca somente
  `pg_catalog.coalesce/nullif` pelas formas especiais válidas, mantendo validação, locks,
  idempotência, auditoria, `security invoker` e grants existentes.
- Em transação revertida como `service_role`, a reserva retornou `reserved`; a checagem posterior
  encontrou zero auditorias persistidas para a prova. Nenhum lead, fila, mensagem ou provedor foi
  alterado. O próximo teste externo fica exclusivamente sob comando do operador.

## Delta de cadastro manual de leads — 17/09/2026

- O formulário **Novo Lead** não pede mais confirmação manual de WhatsApp, autorização ou origem
  para salvar o registro. Essa trava era somente de interface e interrompia o fluxo antes do
  repositório de Leads.
- O cadastro resultante usa `contact_approval_status = pending`, não declara WhatsApp, não concede
  consentimento e mantém a automação pausada/aguardando ativação. Portanto, remover as marcações
  não amplia a permissão de contato nem contorna `ana-run`.
- A prova local do contrato confirmou a classificação de telefone como Telefone e de e-mail como
  E-mail. Nenhum lead ou mensagem foi criado para validar esta alteração.
- PUBLICADO: Site oficial versão 84, commit `ddc4beb3a7cf6a909ea6fd6ed154d8230a25498a`, com
  deploy confirmado como `succeeded`. A inspeção autenticada confirmou o aviso de contato pendente
  e a ausência das caixas; o diálogo foi cancelado sem inserir dados.

## Delta de visibilidade do Kanban e identidade de contato — 17/09/2026

- O Kanban passou a representar a carteira atribuída mesmo quando o primeiro contato ainda está
  pendente. Esse cartão fica em **Novo**, com aviso e selo de autorização pendente; a Ana não pode
  ser executada, retomada ou receber devolução antes de canal e autorização comprovados.
- A normalização de `leads.whatsapp` preserva apenas uma identidade WhatsApp explicitamente
  informada. Um telefone genérico vazio não é mais copiado para esse campo. O ajuste de dados foi
  limitado aos cadastros manuais pendentes criados pela regra anterior.
- PUBLICADO: Site oficial versão 85, commit `48861eb7d79c8c5628f172f12d85c97f1b386c72`, deploy
  confirmado como `succeeded`. A inspeção autenticada confirmou o cartão no Kanban em Novo com
  autorização pendente, sem executar Ana ou enviar mensagem.

## Delta de ativação e apresentação da Ana — 17/09/2026

- O estado pendente do cadastro manual continua seguro: telefone isolado não é promovido a WhatsApp
  durante a criação. A promoção ocorre apenas quando o operador autoriza Ana no Kanban e há um
  contato WhatsApp informado, gravando `active_channel=whatsapp` antes de chamar `ana-run`.
- A primeira execução autorizada em `novo` e sem histórico usa a apresentação institucional canônica
  dentro de `ana-run`; ela avança somente para `apresentado` e insere a mensagem na fila idempotente.
  As políticas de empresa, sandbox, kill switch, canal, opt-out, responsável e autorização seguem
  sendo verificadas antes desse ponto.
- `ana-run` v25 e o Site oficial versão 86 foram publicados. O lead relatado foi reparado somente no
  campo de canal e o drawer confirma WhatsApp/automação ativa. Nenhuma ação externa foi acionada;
  o primeiro envio ainda requer confirmação específica do operador e comprovação posterior de aceite.

## Delta de conhecimento comercial — 18/09/2026

- Produtos, serviços, catálogos e documentos agora pertencem a uma única base rastreável por
  organização. `knowledge_catalog_items` e relações aprovadas geram documentos/chunks derivados
  para a mesma recuperação já usada por `ana-run`.
- As três páginas Wayflex iniciais são tratadas por adaptadores separados em `catalog-knowledge`;
  um erro de fetch é visível no estado da fonte/importação, sem criar conteúdo fictício.
- A Central prepara formatos rápido/comercial/técnico e mantém o caminho humano de fila existente.
  Arquivos seguem como link rastreável até a homologação de uma pipeline de mídia própria.
- Migrations, RLS e índices de FKs foram aplicados no projeto oficial. `catalog-knowledge` v3,
  `enviar-whatsapp` v7 e `ana-run` v30 estão ativos e exigem JWT. Nenhuma mensagem ou lead foi
  criado como parte desta implementação.

## Delta de WhatsApp por vendedor — 23/09/2026

- A operação corporativa existente foi preservada como conta padrão e fallback. A nova tabela
  `whatsapp_accounts` não armazena credenciais; ela relaciona vendedor, integração e estado dentro
  da organização. As seis entidades de mensageria passaram a registrar a conta utilizada.
- Administradores podem configurar uma instância Z-API existente para um usuário e acompanhar
  todas as contas. Vendedores com permissão usam **Meu WhatsApp** para conectar apenas sua conta
  por QR/telefone usando o SDK oficial e um token de uso único gerado no backend.
- A resolução do número ocorre no backend. Matching de entrada e despacho de saída são isolados por
  conta, e uma conversa já vinculada não migra silenciosamente para outro remetente.
- Migrations `20260923193000_multi_whatsapp_seller_accounts` e
  `20260923214500_multi_whatsapp_fk_indexes` foram aplicadas no projeto oficial. Funções ativas:
  `whatsapp-accounts` v1, `team-members` v9, `enviar-whatsapp` v9, `ana-run` v35,
  `automation-worker` v32 e `webhook-whatsapp` v18.
- Validação local aprovada: type-check frontend/Edge, lint, build/artefato Sites e Vitest completo
  com 31 arquivos e 227 testes. Não houve criação de plano/instância, envio de mensagem ou leitura
  de segredo. Ainda não existe vendedor nem instância individual no estado real auditado.

## Delta de Meta WhatsApp Coexistence — 24/09/2026

- A operação continua em Z-API. `meta_cloud` é uma fundação paralela protegida por flag, controles
  independentes de entrada/saída/automação e kill switch; todos começam fechados.
- Tokens e app secret Meta ficam no Vault/backend. O navegador recebe apenas IDs públicos para o
  Embedded Signup oficial; o webhook exige assinatura HMAC e persiste somente hash/metadados
  sanitizados.
- `ana-run` continua sendo a única autoridade automática. Um inbound Meta só pode acioná-la depois
  de conta, organização, feature flag, controle de automação, identidade do lead e elegibilidade
  serem comprovados.
- O projeto oficial está saudável com duas contas Z-API conectadas e nenhuma conta/evento/fila Meta.
  Gate 3 só pode começar com configuração oficial da Meta e número de teste explicitamente
  autorizado; até lá, nenhuma tela ou processo Meta fica operacional.

## Delta da Central operacional — 28/09/2026

- A Central passou a ler a mesma base operacional de leads, mensagens, handoffs, tarefas,
  qualificação, notas e auditoria por contratos RPC paginados. Não foi criada uma tabela de
  conversa paralela nem uma segunda autoridade para a Ana.
- `conversation_read_states` guarda somente leitura individual por organização, usuário e lead.
  A tabela possui RLS, não recebe acesso anônimo e suas FKs têm índices de cobertura.
- A assunção, a transferência e a devolução à Ana continuam nas operações server-side já
  auditadas. O compositor só libera saída humana depois de `modo_atendimento=humano` confirmado
  pelo servidor; a saída preserva a conta WhatsApp fixada ao lead e a fila idempotente existente.
