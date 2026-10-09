# Problemas conhecidos

## 09/10/2026 — WA-AKG: pareamento ainda depende da leitura do titular

- A recuperação segura foi concluída e manteve bloqueios: a conta está em `qr`, a integração permanece desabilitada/pausada, a Ana está protegida e o gateway informa `SCAN_QR`. O QR não foi gerado nem exposto, nenhum telefone foi pareado e nenhuma mensagem foi enviada.
- Não tratar o status de sessão como entrega ponta a ponta. Após a leitura do QR pelo número pretendido, é obrigatório atualizar o status e confirmar o número antes de considerar um teste de entrada controlado. Saída humana e Ana seguem fora de escopo até liberação explícita.

## 07/10/2026 — Causa atual do QR: limite de conexões PostgreSQL na Evolution GO

**CONFIRMADO:** `Failed to create container ... pq: sorry, too many clients already` nos logs da instância atual `bfdf104f-c113-4530-bd73-4e5e83cc00fb`, reprodução final 18:07:27 BRT. Edge v25 já elimina connect redundante e retries do QR, sem corrigir a saturação externa. É necessário acesso ao painel de hospedagem/SSH para tratar pools/conexões/limites e recuperar o serviço. API Tester não administra o banco. O ID antigo do job diverge do Vault correto; essa divergência explica logs vazios do ID antigo, mas não o HTTP 400 com token aceito. Nenhuma instância foi substituída.


## 07/10/2026 — Exclusão total de usuário ainda não definida nem aplicada

O pedido atual substitui o convite por cadastro direto e quer liberar o e-mail após excluir o usuário. A interface local de Usuários não mostra mais abas/filtros de convites, mas o backend oficial ainda não suporta o cadastro direto coordenado. A remoção oficial v3 conserva a identidade Auth, por isso o e-mail de Flavio continua ocupado. Há referências comerciais e de autoria em tabelas com `ON DELETE SET NULL`/`CASCADE`; apagar Auth pode afetar dados históricos ou compartilhados. Foi solicitada escolha explícita sobre o alcance da purga e sobre agir agora na identidade Flavio. Sem essa definição, não apagar Auth, conversas, contatos ou leads, nem publicar fluxo de exclusão que prometa esse resultado.

## 07/10/2026 — Recuperação de Flavio bloqueada pelo contrato remoto de acesso

Leitura atual: Auth global confirmado e login com a credencial fornecida funcionou; não há vínculo em `organization_members`, conta individual nem job Evolution GO. A reivindicação de remoção consta `finalized`; o Manager recarregado mostrou zero instâncias. A tela local de login cai em Convites pendentes, mas `team-members` remoto v20 não oferece `pending_invites`, e as RPCs R4 `team_invite_prepare`/`team_invite_accept` não estão aplicadas. O convite remoto antigo usa compensação `admin.auth.admin.deleteUser` após falha de vínculo/provisionamento, perigosa para identidade preexistente. Nenhum convite, vínculo, nova instância ou alteração de senha foi realizado nesta tentativa. Não usar a ação remota `invite` para recuperar a conta; exige contrato coordenado e homologado antes da operação real.

## 07/10/2026 — Cadastro direto e provisionamento por vendedor ausentes no remoto

No Supabase oficial, `team-members` v20 ainda não implementa a criação direta segura do checkout; `organization_members` só tem gatilho de auditoria; o gatilho Auth não trata o marcador de bootstrap do novo usuário. A correção local e a migration `20261007160000_team_direct_create.sql` foram validadas sinteticamente, mas não aplicadas. Publicar somente a tela causaria falha ao criar; publicar somente a Edge poderia gerar identidade parcial. Exige staging e release coordenada de R4, lifecycle Evolution GO, contrato de criação e frontend; o QR real ainda falha no provedor.

## Evolution GO — API remota em timeout durante consulta de logs — 07/10/2026

- O Manager carregou a casca estática, mas o API Tester expirou ao buscar `/swagger/doc.json` e a tela de instâncias registrou timeout de 30 segundos no console. O detalhe da instância também falhou por rede; a mensagem de ausência não é evidência de exclusão. Logs do runtime e causa exata do QR HTTP 400 seguem não verificados.
- Nenhuma ação mutante foi feita. Requer disponibilidade do serviço/proxy Evolution GO antes de consultar os logs e prosseguir com QR; não recriar instância por timeout.

## Evolution GO — runtime remoto ainda não produz QR — 07/10/2026

- O servidor mantém uma instância individual desconectada; a Edge oficial `evolution-go` v24 registra `/instance/qr` HTTP 400. Sem o log específico da instância, o motivo interno do WhatsApp runtime permanece não confirmado. Não recriar instância por esse sintoma nem declarar QR/pareamento concluído.
- `1bd2786` corrige somente o caminho local: QR é uma leitura após conexão já registrada, não outra mutação de lifecycle; erros oficiais do QR são classificados sem expor detalhes. A Edge v24 remota não recebeu esse patch. Trigger multi-tenant e `team-members` ainda exigem release coordenada; Site e mensageria continuam inalterados.

## Evolution GO — QR continua falhando após substituição válida da instância — 06/10/2026

- A instância antiga do vendedor foi excluída e substituída com autorização; o novo ID `77c6344c-23d0-48a9-81e6-9c0a5177b2f8` consta no provedor e seu token guardado é aceito. A conta permanece desativada e a conexão iniciada apenas aguarda QR.
- Logs reais de `evolution-go` v22: `/instance/qr` 400 seguido da recuperação automática `/instance/reconnect` 500 com sinal de sessão. Não é mais uma falha de credencial/ausência da instância. O bundle remoto da Edge diverge do checkout local; não publicar o arquivo local inteiro nem recriar outra instância às cegas. Exige diagnóstico do runtime do servidor e patch coordenado da estratégia de QR, seguido de homologação. As entradas históricas abaixo descrevem estados anteriores superados.
- O monitor com autorrecriação geral continua **não instalado**. Só a recuperação administrativa manual e delimitada foi implantada; distinguir instância realmente ausente de falha de QR/timeout antes de qualquer automação multi-tenant.

## Evolution GO — instância remota existe, mas vínculo/token divergentes — 06/10/2026

- O Manager agora lista `wf-a1ea4d913d09-86457c84639c` desconectada. O ID remoto e o token não coincidem com o Vault do WayFlex (comparação por hash, sem divulgar segredo); `Validar status` permanece em HTTP 401. O registro anterior de instância ausente é histórico e foi superado por essa leitura posterior.
- A criação/removal automática está bloqueada para este conflito: não há reconciliação idempotente implantada, e excluir a instância atual pode apagar uma sessão recuperável. Conta e integração continuam desligadas; nenhuma mensagem foi enviada. É necessária escolha explícita sobre preservar a instância e adotá-la com segurança ou descartá-la, seguida de implementação/homologação do monitor e novo pareamento pelo vendedor.

## Evolution GO — QR do vendedor bloqueado por instância ausente — 06/10/2026

- Job `wf-a1ea4d913d09-86457c84639c` consta `awaiting_qr` desde 04/10 no Supabase, mas Manager autenticado mostra zero instâncias; `qr` falha em `GET /instance/status` com HTTP 401. URL do segredo individual coincide com a URL corporativa; ambos têm material de chave no Vault. A causa histórica do desaparecimento não pode ser afirmada sem logs antigos.
- O trigger remoto de `organization_members` para Evolution GO não está implantado e `team-members` v19 ainda acorda o worker WA-AKG na criação de vendedor. O código local de lifecycle multi-tenant não equivale à operação remota. Não forçar `POST /instance/create` ou redefinir segredo/job sem consulta administrativa e reconciliação de resultado incerto.
- A prévia local agora apresenta o erro específico e impede repetição de QR nessa sessão. A correção operacional ainda exige release coordenada e recriação única auditada quando a ausência for comprovada; Site oficial inalterado.

## Evolution GO — configuração do servidor restaurada; QR ainda não homologado — 06/10/2026

- `evolution-go` v22 e `evolution-go-worker` v5 substituem o contrato remoto incompatível descrito nos registros históricos abaixo. A prévia local abre o formulário administrativo e o teste real do servidor passou com segredo já no Vault; o canal continua desativado e pausado. A ausência de `save_server`/`test_server` não é mais bloqueio atual.
- Persistem fora deste escopo o drift do lifecycle multi-tenant, a homologação de QR/pareamento com identidade e número consentidos e a publicação do Site. Autenticar o servidor não comprova instância provisionada, celular pareado ou mensageria pronta.

## Evolution GO multi-tenant — release bloqueada por drift e homologação coordenada — 06/10/2026

- O lifecycle local foi validado com trigger de vínculo, job único por organização/vendedor, worker durável, self-service restrito ao titular e preservação de histórico após desconexão. Foram aprovados 769 Vitest/93 arquivos, type-check app/Edge, lint, build/artefato, PGlite 6/6 e PostgreSQL nativo 2/2.
- Isso não foi aplicado ao Supabase/migrations, Edge, Site ou GitHub; não houve QR real, mensagem, automação ou alteração de dado de cliente. O estado não deve ser declarado publicado ou homologado externamente.
- Bloqueio real: drift entre schema/bundles/Edges remotos e o checkout, ausência de staging/identidades/números consentidos para uma homologação coordenada e gateway Evolution retornando QR 400/500. A política de proteção contra senhas vazadas/Auth também permanece pendente e fora deste lote. Não fazer deploy parcial, replay amplo de migrations ou retry cego de QR.

## Evolution GO — função remota não reconhece salvar/testar servidor — confirmado em 06/10/2026

- A Edge Function oficial `evolution-go` v21 não inclui `save_server` nem `test_server`, embora o frontend local já envie esses comandos. Os logs registraram `unsupported_action` para `save_server`; o provedor Evolution GO não foi consultado nessa tentativa. O frontend local agora bloqueia os controles quando o contrato remoto está ausente e explica o descompasso sem pedir repetição cega da chave.
- A função `evolution-go-worker` ativa v4 ainda não usa `server_validation` como bloqueio de provisionamento. Não publicar apenas o endpoint de gravação/teste nem tratar a URL/chave como inválidas sem resposta do provedor. Requer homologação integrada e aplicação seletiva coordenada; Site oficial permanece inalterado.

## Evolution GO — homologação integrada pendente em 06/10/2026

- A separação visual entre administrador e vendedor foi validada localmente, mas a tela do vendedor ainda requer inspeção com identidade de vendedor e o teste do servidor depende de uma instância isolada. O Site oficial permanece inalterado por NO-GO de produção.
- A suíte Vitest completa encontra importações `npm:` do Supabase não resolvidas nos testes de Edge neste ambiente. Os 325 testes do frontend, incluindo cinco focados, passaram; não atribuir esta falha ao ajuste de interface nem declarar suíte completa aprovada.

## Configurações — provedores legados e contingência ocultos ou comprimidos — resolvido localmente em 06/10/2026

- WA-AKG, Z-API e Meta ficavam dentro de um painel recolhido por padrão. Os atalhos corporativos não tinham destino correspondente e a combinação da barra lateral com grades aninhadas reduzia alguns cards a uma coluna estreita.
- `26c1626` deixa a área aberta, em três estágios claros: escolha do canal corporativo, configuração/validação e contingência individual. Z-API e Meta têm destinos reais; WA-AKG ganha largura integral; Meta exibe indisponibilidade explícita quando seu gate ainda não está homologado. Nada foi ativado nem teve o gate alterado.
- A prévia autenticada foi conferida em desktop e 390x844, sem cards ocultos ou overflow horizontal. O atalho da Z-API alcançou a configuração; não houve conexão, validação, mensagem, automação, alteração de cliente, migration, Edge ou publicação do Site.

## Configurações — cards de Canais e Status operacional difíceis de usar — resolvido localmente em 06/10/2026

- A área Canais misturava configuração, diagnóstico e auditoria em uma única sequência, enquanto as ações globais duplicavam as ações do próprio canal. No mobile, a tabela de Status operacional mantinha uma largura mínima e cortava informações e menus.
- `2b7ddd9` organiza Canais em **Configuração**, **Diagnóstico** e **Histórico**, deixa contingência legada recolhida e preserva cada ação no seu contexto. A tabela de Status passa a cards rotulados no mobile; nenhuma regra, rota, chamada, banco ou estado operacional foi alterado.
- A prévia autenticada foi revisada em mobile e desktop; não houve overflow horizontal, envio, automação, mensagem, escrita de cliente, migration, Edge ou publicação do Site.

## Configurações — ativação de provedor sem configuração — resolvido localmente em 06/10/2026

- O controle de uso operacional ficava desabilitado quando o provedor ainda não tinha credencial, portanto não podia abrir o fluxo de configuração. Um provedor validado, porém pausado, também era recusado pelo backend na reativação.
- `a7bba77` abre o modal de configuração sem persistir nada quando faltar configuração; após configuração/teste válidos, a ativação limpa somente a pausa operacional. A desativação continua a salvar o uso como inativo sem tocar credenciais.
- A prévia autenticada confirmou a abertura e o cancelamento de **Configurar Google Places** sem escrita. Os contratos locais cobrem ativar/desativar, a sincronização de fontes de busca e a preservação do cofre. Edge e Site não foram publicados.

## Leads — Ana importada não aparecia no Kanban — resolvido localmente em 06/10/2026

- O filtro da RPC do Kanban exige modo de atendimento e responsável técnico. A Busca importava **Ana (IA)** sem `owner_id`/`assigned_to`; o diálogo tentava ativar a Ana para preencher essa condição, misturando o simples envio ao Kanban com automação e consentimento.
- `3665f52` atualiza somente o vínculo técnico do mesmo lead quando ele é Ana e ainda não tem rota. Não cria cartão/lead separado, não inicia Ana ou WhatsApp e não muda score, origem, modo ou etapa. Humano sem responsável recebe bloqueio explícito; reenvio mostra que o lead já está no Kanban.
- O fluxo autenticado enviou um lead existente e, após recarregar, confirmou um único cartão em **Novo**, com score 43/100 e origem preservada. A segunda tentativa não duplicou. Site oficial permanece inalterado.

## Leads — ação Enviar para o Kanban ausente — resolvido localmente em 05/10/2026

- O diálogo e o comando já existiam, mas não havia um botão na barra dos leads selecionados para alcançá-los. O acionador foi restaurado em `a20a420` e a validação autenticada confirmou abertura e cancelamento sem disparar o fluxo.
- O seletor agora revela as sete etapas canônicas. Ganho e Perdido são resultados finais e continuam bloqueados para mudança em massa ou automática pelo contrato do orçamento; isso evita um falso avanço sem aceite/motivo. Site oficial permanece inalterado.

## Busca de Leads — importação recusada por UF — resolvido em 06/10/2026

- A RPC tratava `uf` como campo não permitido, apesar de o mapeador legítimo enviar o estado. A migration `20261006011920_fix_prospecting_batch_state` corrigiu exclusivamente a allowlist e a persistência de `uf`.
- A repetição autenticada do lote do operador concluiu e abriu Leads com 20 registros. O Site oficial não foi publicado nesta correção de banco.

## Busca de Leads — regressão Critérios/quantidade resolvida — 05/10/2026

- O bloqueio CORS remoto e o limite visual fixo de 10 foram corrigidos no escopo do Wizard. A função `prospectar-leads` v17 aceitou a origem homologada e uma busca real com limite 20 retornou 20 resultados para revisão.
- O Site oficial permanece em v168 e não contém este ajuste de frontend. Não publicar a aplicação inteira como consequência desta correção; uma publicação isolada continua exigindo autorização e validação próprias.

## 05/10/2026 — Status operacional indisponível na prévia local — resolvido

- O preflight da origem `http://127.0.0.1:4173` era rejeitado quando a configuração remota tinha `ALLOWED_ORIGINS` explícito. O helper agora mantém as origens homologadas estritas ao combinar a configuração; `operational-diagnostics` v19 foi aplicado.
- A validação autenticada exibiu o diagnóstico e a atualização manual sem acionar qualquer operação. Os componentes pendentes continuaram pendentes; não representam uma falha da tela.

## 05/10/2026 — Evolution GO principal ainda sem release

- A nova seleção de Evolution GO está validada somente localmente. Catálogo remoto confirma RPC e funções compatíveis, mas não comprova o contrato externo, segredo, QR, callback, entrega ou operação da Ana em ambiente isolado.
- Não aplicar a migration nem publicar `team-members`/frontend isoladamente enquanto R1–R12 não forem reconciliados com os bundles e migrations reais. O NO-GO global permanece; ver `docs/remediacao/2026-10-05-evolution-go-primary/RESULTADO_FINAL.md`.
- WA-AKG permanece como contingência para vínculos existentes e intervenção administrativa; seu bloqueio de gateway descrito abaixo não foi removido.


## 05/10/2026 — Pendências atuais após R4–R14 local

As notas históricas abaixo permanecem como evidência, mas o checkpoint atual é `docs/remediacao/2026-10-05-r4-r14/RESULTADO_FINAL.md`. R6 já integrou provisionamento automático e recuperação por GET + CAS; não continuam ausentes no código local. Nenhum desses deltas foi aplicado em produção.

### Bloqueios de implantação e produto

- WA-AKG upstream v1.7.0-beta.1 examinado cria bot habilitado e ignora enabled:false no update. O adaptador local exige confirmação de bot desligado e bloqueia conexão/QR/ativação caso contrário. Precisa de versão corrigida e homologada; apenas fornecer VPS/HTTPS não resolve.
- Falta staging compatível com Auth/REST/Storage/SMTP, duas identidades/organizações e destinos/gateway de teste consentidos. Testes locais não homologam efeitos externos nem restauram integralmente o catálogo real.
- Histórico de migrations e bundles divergente: inventário não equivale a plano de replay. Não executar db push, repair/reset ou deploy frontend desacoplado de R4/R5/R6/R8/R9.
- R13 depende de escolha explícita CRM interno versus SaaS, planos/autoridade/suporte/ciclo de clientes. R4 não implementou enrollment/challenge/AAL de MFA: interface não promete exigência real. Advisor remoto ainda reporta proteção de senhas vazadas desabilitada; não alterada pelo agente.

### Limites residuais da implementação validada

- Fonte importada sem relação canônica comprovável falha fechada; não se inventou vínculo/backfill em dados reais.
- Guardas da Ana/worker diminuem TOCTOU, não cancelam efeito externo já em voo. Recuperação Calendar entre aceite remoto e persistência local ainda exige prova integrada.
- Agenda limita conflitos às linhas visíveis por RLS; não oferece exclusividade global em outros fluxos nem refaz timezone de todos os formulários.
- R12 tem 11 provas Chrome no harness sintético; leitores de tela, contraste e todas as jornadas continuam fora do aceite. Métricas R11 são amostra dos últimos 50 registros, não SLA nem prova de entrega.
- NO-GO global mantido apesar de 732 testes e 21 comandos aprovados. Nenhuma mensagem real, automação, cliente ou produção alterado neste lote.

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

## Wizard da Busca de Leads — QA autenticada limitada concluída — 05/10/2026

- A fonte isolada `87b9b8309eb8fc0fa4d47611c7a1315598fc4f76`, contendo o Wizard e a conexão WA-AKG pela Central, foi publicada no Site oficial v168; o deploy `appgdep_6ac3d1bec3e48191ba29a2d5559426a8` foi confirmado como `succeeded`.
- Inspeção autenticada na auditoria V3 confirmou Fonte → Região → Perfil → Critérios, Central e reflow do Wizard em320/390/1024/1440, sem busca externa. EV-LIVE-001 e capturas preservados.
- E2E de busca/importação e perfis adicionais não homologados; divergência dos dois botões de teste é ACH-UI-009 (guarda operacional preservada).

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
## 05/10/2026 — Classificação duplicada no envio ao Kanban — resolvido localmente

- O diálogo de envio oferecia Ana/Humano depois de a Busca de Leads já ter persistido modo e responsável. Isso poderia trocar a classificação ou o responsável por efeito do encaminhamento.
- `968a753` passou a preservar a definição por lead e limita a configuração opcional de transferência ao subconjunto Ana. A correção está validada localmente; Site oficial permanece inalterado.

## 07/10/2026 — Bloqueio externo: runtime da instância Evolution GO não produz QR

- A instância individual vinculada ao vendedor existe e a credencial é aceita, mas o Manager mostra
  estado `close`. Na função `evolution-go` v24, o fluxo autenticado iniciou a conexão e realizou
  cinco leituras de QR durante aproximadamente 35 segundos; o provedor respondeu HTTP 400 em todas.
- O endpoint remoto `/instance/reconnect` responde HTTP 500 durante a inicialização e foi removido
  da recuperação automática. Não recriar ou excluir a instância novamente até que o administrador
  do servidor Evolution GO recupere o runtime e confirme que `/instance/qr` devolve um QR válido.

## 07/10/2026 — Evolution GO exclusivo; pareamento continua dependente do runtime remoto

- Z-API, Meta Cloud e WA-AKG foram retirados dos caminhos operacionais: os controles foram desabilitados, as contas legadas deixaram de ser padrão/habilitadas e a API de contas passou a rejeitar ações legadas. Os registros históricos foram preservados.
- Evolution GO não foi ativado como compensação: as duas contas Evolution continuam desativadas até o servidor remoto voltar a produzir um QR válido. O bloqueio de QR descrito acima permanece a única pendência para pareamento.
