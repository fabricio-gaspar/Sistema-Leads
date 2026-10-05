# Auditoria de módulos, navegação e UX — WayFlex V3

Escopo: checkout `847048429a86294aa10fa54ffdd750c04447d4fb`, em 05/10/2026, fuso America/Sao_Paulo. Esta trilha examinou fontes e executou contratos isolados. O agente principal executa a suíte e a navegação do Site separadamente. Nenhuma evidência desta trilha é apresentada como teste com cliente, provedor real ou mutação de produção. Nenhum comportamento do produto foi corrigido.

Parecer desta trilha: **NO-GO para a oferta integral do protocolo V3**. Há falhas reproduzidas de isolamento do estado frontend, entrada/exportação CSV, criação de próxima ação e interpretação de indicador; há comandos comerciais com estado persistido sem consumo operacional encontrado. A ausência do painel de plataforma/planos no código examinado impede tratar o painel empresarial como os três níveis de acesso exigidos.

## Provas e método

- **EV-UI-001**: [saída JSON](EVIDENCIAS/produto/EV-UI-001-probes.json), produzida pelo [script executável](EVIDENCIAS/produto/probes-produto.mjs). TypeScript real transpilado e executado em VM; dependências de autenticação, React e persistência substituídas por fixtures sintéticas A/B. Nenhuma chamada de rede. SHA-256 das fontes registrado no JSON.
- **EV-UI-002**: [trechos estáticos com linhas](EVIDENCIAS/produto/EV-UI-002-fontes-estaticas.txt). As linhas sempre se referem ao checkout acima.
- **EV-UI-003**: fontes profissionais consultadas nesta execução, registradas ao final. Não são evidências de comportamento do produto.
- Comando de reprodução: `node docs/auditoria/2026-10-05-v3/EVIDENCIAS/produto/probes-produto.mjs`, usando o runtime instalado em `/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.
- Resultado: **11 cenários, 2 APROVADOS, 9 REPROVADOS**, saída de processo **1** deliberadamente preservada. Há agrupamentos de vários cenários no mesmo achado. Isto não é o denominador de cobertura do sistema nem substitui a suíte de regressão existente.
- Os testes T-UI-006/007 reproduzem a remontagem do consumidor da store após mudança de sessão; não usam um navegador autenticado. T-UI-008 captura a tentativa de escrita em stub, não afirma que essa escrita ocorreu remotamente.

## Inventário reconciliado por recurso

Legenda de perfil: **M** membro autenticado; **P** permissão indicada em `PermissionRoute`; **C** `configuration.manage`; **T** `team.manage`; **A** `audit.view`. A coluna de perfil descreve a guarda frontend observada, não homologa o backend/RLS. Fontes e comandos abaixo são os encontrados no código. “Sem ciclo” significa que não foi encontrado comando completo de ativar/desativar aquele módulo, não que o módulo deva ser desligável por natureza.

| Recurso | Localização e tarefa/perfil | Fonte e comando/API | Estado, dependências e infraestrutura | Efeito de ligar/desligar; ponto de teste |
|---|---|---|---|---|
| REC-UI-01 Acesso público | `/login`, `/register`, `/reset-password`, `/apresentacao`; autenticar/provisionar | `useAuth`, Supabase Auth, `bootstrapOrganization`, `company_settings` | Núcleo compartilhado; organização provisionada após autenticação | Não é módulo comercial desligável. J01/J02, confirmação de e-mail e falha de provisionamento: bloqueados para prova multiusuário real nesta trilha |
| REC-UI-02 Shell/menu | `/dashboard`; M; navegar e ver alertas/tarefas | `DashboardLayout`, `useCurrentAccess`, `notifications`, `lead_tasks`, diagnóstico | Menu por permissões; sidebar móvel com foco/Escape/inert; cache de notificações legado também consumido | Ocultar item não equivale a revogar API. T-UI-008; prova de teclado pelo agente principal |
| REC-UI-03 Dashboard | `/dashboard`; M; priorizar operação | `CommercialAnalytics`, leads/proposals/messages/stage_history, `operational-diagnostics` | Realtime de mensagens e polling 60 s; métricas sem snapshot usam traço | Toggle de atualização só governa diagnóstico local, não toda operação. T-UI-011 e ACH-UI-007 |
| REC-UI-04 Busca/Wizard | `/dashboard/busca-leads`; P `prospecting.manage` | `lead_source_configs`, `prospectar-leads`, execução por `runId`, `import_prospecting_batch` | Fonte/Região/Perfil/Critérios → amostra/revisão/importação; depende de modo real, fonte ativa e termos | Guardas antes da chamada; consulta só pelo comando. T-UI-010; J03 positivo real bloqueado por ausência de sandbox/cota |
| REC-UI-05 Busca histórica/mapa | mesma rota; reabrir resultados, classificar adequada/inadequada/duplicada | execuções reais e geocoordenadas do provedor; mapa OpenStreetMap | Sem coordenadas não cria marcadores fictícios; recuperação usa mesmo `runId` | Reabrir histórico não contrata nova busca. Testar resposta velha/concurrente e indisponibilidade de tiles em sandbox |
| REC-UI-06 Importação CSV de Leads | modal na carteira; perfil com criação; mapear arquivo/revisar | `CsvImportModal` → `parseCsv`; integração transacional de lote na carteira | Prévia local do arquivo, validação e confirmação; parse síncrono/FileReader sem limite de tamanho visível | Não há conexão exclusiva; fechamento não desfaz lote confirmado. T-UI-001/002/003, J03 duplicação/repetição remota bloqueada |
| REC-UI-07 Leads manual/carteira | `/dashboard/leads`; P read_all/read_assigned/create; CRUD, filtros, atribuição | `useLeadsStore`, `leadsRepository`, `leads`, handoff policies, qualificação/tarefas | Leitura paginada de servidor; preferências de colunas locais por usuário; estado de dados global em memória | Arquivar preserva histórico; não é apagar. T-UI-006; gravação remota por perfis não executada |
| REC-UI-08 Exportação de Leads | toolbar de selecionados; mesmo escopo da carteira | serialização CSV no navegador dos leads carregados | Usa seleção explícita; campos vêm do cadastro/importação | Download não muda banco, mas abre superfície de fórmula. T-UI-004 |
| REC-UI-09 Listas/distribuição | revisão/importação e carteira; lista nomeada com modo/responsável | `lead_lists`, `lead_list_members`, importação RPC; `lead-workflow` para ativação da Ana | Listas pendente/ativada/arquivada; store global; não é novo motor automático | Ativar lead é comando backend governado; T-UI-007; distribuição diária pertence à Ana/schedules, não ao menu |
| REC-UI-10 Exclusão governada | ações Leads e gerenciamento Funil | `lead-governance`; seleção/frase `EXCLUIR N LEADS`; backend RPC privada | Requer `leads.delete`; leitura ampla para gestão de base | Destrutiva, não executada. Contrato/positivos/recusas cobertos em testes existentes; retenção/provedor exige regra própria |
| REC-UI-11 Kanban quadro/lista | `/dashboard/kanban`; P read_all/read_assigned | `get_kanban_portfolio`, `transition_lead_stage`, desfazer, tasks/notes/history | Filtros/contagens/paginação pelo servidor; lista exporta e atribui; drawer contextual | Movimento não terminal pode desfazer; Ganho/Perdido exige causa. T-UI-005; teclado tem alternativa de select, mas há controles aninhados |
| REC-UI-12 Central e número próprio | `/dashboard/atendimento`; P conversations.read_all/reply_all/reply_assigned | conversas, messages, human-message, handoff, WA-AKG/account APIs | Layout inbox/conversa/contexto; histórico, conhecimento e lead comum; provedor por conta | Envio e conexão são ações externas; não executadas nesta trilha. J05–J09 na trilha de mensageria |
| REC-UI-13 Agenda | `/dashboard/agenda`; mesma guarda de conversas | `get_agenda_portfolio`, insert/update `appointments`, `updated_at`, `user_saved_views` | Dia/semana/mês/lista; timezone IANA, conflitos por responsável; núcleo DB compartilhado | Não encontrado desligamento completo do módulo; lembretes são metadados, executor não encontrado nesta trilha. T-UI-009 |
| REC-UI-14 Tarefas/próxima ação | Shell, Leads, Kanban, drawer de Agenda | `lead_tasks` e, na Agenda, outro `appointment` vinculado | Dois tipos de próxima ação, com responsabilidades diferentes; confirmar consumo entre telas | Sem comando de ciclo completo; criação isolada/renovação/recusa em sandbox pendentes; Agenda tem ACH-UI-004 |
| REC-UI-15 Orçamentos | `/dashboard/orcamentos`; P `proposals.manage` | `proposals`, `services`, templates, transição de resultado; Central para envio | Rascunho/preço confirmado/desconto/aprovação/versão/aceite; documento em navegador | Preparar envio navega à Central; não afirma entrega. Valores/ganho humanos. Catálogo e flags divergentes: ACH-UI-005/010 |
| REC-UI-16 Funil | `/dashboard/funil`; P read_all/read_assigned; analisar conversão/gerir base | `FunnelAnalytics`, mesma base operacional e histórico; `LeadBaseManager` | Tarefa gerencial diferente do Kanban operacional; filtros por período | Não há fonte paralela de leads; manter visões separadas é justificável. J14 depende de comparação por organização |
| REC-UI-17 Relatórios | `/dashboard/relatorios`; P read_all/read_assigned | `CommercialAnalytics`, leads/proposals/stages/contacts | Tabela alternativa aos gráficos, estados de falha parciais, CSV neutraliza fórmulas | Sem licença/ciclo específico encontrado; indicadores dependem de RLS. Não confundir métrica com entrega ou receita |
| REC-UI-18 Status operacional | Configurações `tab=operacao`; C | `operational-diagnostics`, modo operacional, checks/jobs/integrações | Painel administrativo; estado técnico vem do backend | Modo protegido/real e kill switch não equivalem a controlador de todos os módulos; sem ativação real no teste |
| REC-UI-19 APIs/fontes | Configurações `tab=apis`; C | integrações, Vault via backend, `lead_source_configs`, testar-integração | Apify/Google Places e provedores realmente registrados | Ativar/pausar fonte com dependências; buscar sem fonte ativa recusado. Contratos externos na trilha mensageria/backend |
| REC-UI-20 Canais | Configurações `tab=canais`; C | contas/provedores WA-AKG, Evolution GO, Z-API, Meta e entrada site | Conexão, autorização e saúde separadas em componentes; recursos partilhados por organização | Pausar/desconectar/ativar não foram executados. Atendente usa Central; painel global depende de C |
| REC-UI-21 Empresa/perfil | Configurações `tab=empresa&subtab=perfil`; C | `company_settings`, `organizationSettingsRepository` | Dados organizacionais reais; mesma empresa da sessão | Núcleo de configuração, sem exclusão total pela aba. J01/J16 com cadastro sintético externo bloqueado |
| REC-UI-22 Conhecimento/catálogo | Empresa `subtab=catalogo`; C; produtos/serviços/catálogos/documentos | `knowledge_catalog_items`, sources/relations, `catalog-knowledge`, `knowledge-publish` | CRUD, estado por item, `ana_enabled`, publicação; leitura limitada antes de filtro textual local | Flags por item têm consumidor; flags da aba Produtos são outra fonte. J09 atualização/exclusão real bloqueada |
| REC-UI-23 Biblioteca e mídia | Catálogo → Documentos e mídia; C; importar/gerir fonte aprovada | `AnaKnowledgeLibraryTab`, documents/chunks/storage; catálogos com URLs externas | Biblioteca atual diferente da página legada MidiaDrive | Não homologar upload/extração/áudio por mera existência. J09 na trilha mensageria; exclusão e URL expirada bloqueados |
| REC-UI-24 Política de Produtos/Orçamentos | Configurações `tab=produtos`; C | `commercial_catalog_policy` em organization_module_data, templates, audit_logs | Alterna catálogo/rascunho/automático/tabela/desconto/validade/default | Persiste flags, mas consumidores operacionais não encontrados: ACH-UI-005. “Revisado” é inferido de ativo + blocos |
| REC-UI-25 Ana/políticas | Configurações `tab=ana`; C | `AnaPolicyWorkspace`, personalization, policies, `ana-operations`, `ana-run` | Publicação, pré-requisitos, configuração/política/horário/handoff; uma autoridade automática | Ana desligada deve preservar humano; ciclo/retomada e ferramentas são tratados em relatório da mensageria |
| REC-UI-26 Equipe/acessos | Configurações `tab=usuarios` (C) e `/dashboard/equipe` (T) | `team-members`, `current_user_access`, permissions/roles | Gerenciamento, detalhes, status e permissões; caminhos duplicados com guardas distintas | Não removi usuário nem convidei. Verificar encontrabilidade de T sem C; sem inferir RBAC pela UI |
| REC-UI-27 Registro/auditoria | Configurações `tab=registro` (C) e `/dashboard/registro-sistema` (A) | diagnostics/audit logs, integração/fila/histórico | C e A têm caminhos diferentes; rota audit independente existe | Não desligável como módulo comercial; leitura e exportação por escopo na trilha segurança |
| REC-UI-28 Proteção de contatos | Configurações `tab=supressao`; C | `suppressionRepository`, contatos suprimidos/opt-out | Recurso transversal; conversa/Ana dependem da fonte backend | Excluir da proteção não equivale a consentimento automático; sem mutação real nesta auditoria |
| REC-UI-29 Plataforma/planos/suporte | Nenhuma rota/menu encontrado no router/shell atual | Busca dirigida por platform_owner/admin, super_admin, plans/licenses/entitlements e suporte | `organization_members.status=suspended` não é licença/suspensão da empresa; registros não provam painel global | BLOQUEADO para teste; lacuna de implementação do escopo V3, não inferir que admin cliente seja dono |
| REC-UI-30 Legado/alternativas | `/empresa`, `/midia-drive`, `/personalizacao-ana`, `/meu-whatsapp` redirecionam | `router/config.tsx:54–121`; aliases de tabs `configuracoes/page.tsx:61–85` | Antigas telas e stores permanecem no código; redirecionamentos preservam links | Orfandade não prova exposição atual. Testar caminho antigo para destino real, não contar antiga tela como módulo implantado |

## Achados reproduzíveis

### ACH-UI-001 — Parser CSV perde conteúdo e divide um registro em dois

**P2, confiança alta, REPROVADO, prova de contrato local.** Requisito V3 J03/cap.7: importar dados sem adulteração. `src/lib/csv.ts:21–51` divide por quebra de linha antes de interpretar aspas e apenas alterna estado em cada aspas. Em T-UI-001 um campo com CRLF vira duas linhas; em T-UI-002 `Peça "A" aprovada` vira `Peça A aprovada`. Modal atual reutiliza esse parser (`CsvImportModal.tsx:55–67`). Impacto: descrição cortada e linha fantasma que pode ser interpretada como outro lead; persistência real não testada. Aceite: parser compatível com campos multiline/aspas escapadas, contagem e rejeição clara de registros malformados, regressão de BOM/vírgula/ponto-e-vírgula. RFC 4180 seção 2 é referência informativa de interoperabilidade, não certificação normativa.

### ACH-UI-002 — Exportação Leads/Kanban preserva fórmulas de planilha

**P2, confiança alta, REPROVADO, contrato local.** V3 cap.23-D. `leads/page.tsx:728–738` e `kanban/page.tsx:420–427` escapam somente aspas. T-UI-004/005 com `=1+1` produz `"=1+1"`, ainda fórmula ao abrir em planilha que interprete esse conteúdo. Nenhuma planilha foi aberta, fórmula externa ou exfiltração foi usada. O exportador em `CommercialAnalytics.tsx:46–51` já possui neutralização; alternativa de menor risco é uma função compartilhada com testes de `= + - @` e controles iniciais. Não modificar valor canônico armazenado para resolver um problema do formato de exportação.

### ACH-UI-003 — Estado da empresa anterior sobrevive à troca de sessão

**P1 para priorização local; risco de confidencialidade alto; confiança alta no contrato, E2E multiusuário pendente.** V3 invariantes 1/14 e J02/J15. `useLeadsStore.ts:8–29`, `useListasStore.ts:25–40` mantêm `state/hydrated` em escopo do módulo; `useAuth.tsx:194–197` apenas signOut/setUser. T-UI-006/007: carregar A, trocar stub para B e remontar consumidor continua retornando A sem nova leitura. `backendStore.ts:12–28,41–96` lê chave local sem user/org e pode semear essa cópia no backend vazio da sessão atual; T-UI-008 registra tentativa `organization_id=B,data=A`. Consumidor atual: `useNotificacoesStore.ts:7–8`, Shell/Dashboard; não é apenas código órfão. Não há alegação de vazamento observado em produção. Remediação: stores particionadas/invalidadas por organização + usuário + geração, impedir resultados tardios, nunca semear dados operacionais de cache não vinculado; regressão logout/login A→B, dois usuários/duas abas, rede lenta e sessão revogada. Correlacionar com achados do agente de segurança.

### ACH-UI-004 — Agenda não consegue criar a próxima ação pelo drawer

**P1, confiança alta, REPROVADO, handler e validador reais em simulação.** V3 J10/fluxo próxima ação. `agenda/page.tsx:236` constrói `startsAt` e `endsAt` pelo mesmo `zonedUtc(data.date,data.time,...)`; `appointmentsRepository.ts:140–144` rejeita fim menor ou igual ao início. T-UI-009 produz `2026-10-06T13:00:00.000Z` nos dois campos e `appointment_datetime_invalid`; mensagem observada: “Não foi possível criar a próxima ação.” Nenhum registro remoto. Aceite: duração explícita válida, conflito/perfil/duplicação controlados e vínculo transacional ou recuperação de falha entre criação e atualização do compromisso anterior.

### ACH-UI-005 — Interruptores comerciais não governam os consumidores

**P1, confiança alta quanto à ausência de referência no escopo examinado, REPROVADO estático.** V3 J11/cap.12: desligamento tem efeito operacional. `ProductsOrcamentosWorkspace.tsx:65–78,103–111` promete impedir novas propostas e controlar fontes; `commercialCatalogPolicyRepository.ts:17–70` grava `commercial_catalog_policy`. Busca dirigida em todo `src` e `supabase` encontra `catalogEnabled/productsForAna/servicesForAna/draftEnabled/automaticSendEnabled` somente nessa UI e nesse repository. `ana-run` usa `company_settings.ui_settings.knowledge_usage` (linhas 260–270,779–784), e Orçamentos lê `services`/configuração legada. Portanto salvar “Desativado” nessa superfície não demonstra nem implementa o corte desejado nos consumidores encontrados. Não foi alternado interruptor real. Aceite: definir uma política canônica, backend/worker/tool e humanos conforme contrato devem consultá-la, testar trabalho preparado antes da mudança e retomada sem backlog cego. Não criar outro controlador paralelo.

### ACH-UI-006 — Tooltip não permite mover o ponteiro sobre a ajuda

**P2, confiança alta no código, REPROVADO estático; confirmação visual pertence ao agente principal.** V3 cap.17/WCAG 2.2 1.4.13. `InfoTooltip.tsx:21,34–41` posiciona conteúdo 8px abaixo do botão, fecha no mouseleave; portal tem `pointer-events:none` em `wayflex-visual.css:2`. A ajuda não é hoverable e o overflow de conteúdo longo não pode ser operado com ponteiro. Existem suporte a foco/Escape e nome acessível, pontos positivos que não substituem hoverable. Aceite: transitar trigger→conteúdo sem sumir, Escape sem mover foco, toque previsível, texto longo e ampliação. Não declarar conformidade WCAG integral.

### ACH-UI-007 — “Mensagens hoje” soma a janela inteira

**P2, confiança alta, REPROVADO, expressão real avaliada com fixture.** V3 J14/invariante 13. Dashboard usa modo padrão `CommercialAnalytics` (`dashboard/page.tsx:121`); `CommercialAnalytics.tsx:57` rotula “Mensagens hoje”, porém reduz todos os dias de `analytics.days`, cujo período selecionado é 30 dias inicialmente. T-UI-011: 5 mensagens ontem + 2 hoje exibe 7. Ajuda menciona recorte, contradiz o título principal. Aceite: rotular “Mensagens no período” ou calcular só hoje conforme decisão explícita; testar dias anteriores/fuso/error de contatos. Fonte da contagem é real, mas sua semântica visível está incorreta.

### ACH-UI-008 — Modal CSV não usa o contrato acessível já existente

**P2, confiança alta na inspeção; REPROVADO estático de semântica, foco dinâmico pendente.** `CsvImportModal.tsx:130–140` usa backdrop/div sem role dialog, aria-modal, nome associado, captura/restauração de foco ou handler Escape; seletores de coluna (`:220–234`) possuem label irmão sem htmlFor. Há `AccessibleDialog` nativo no projeto, aplicado a Agenda/Orçamentos/Kanban. Aceite: reutilizar contrato de diálogo, associar labels, confirmar foco contido/retorno/Escape/leitor de tela sem importar dados. Isto não prova uma violação de todos os critérios WCAG.

### ACH-UI-009 — Botões equivalentes do Wizard divergem no bloqueio

**P3, confiança alta, inspeção estática + observação visual do agente principal.** `busca-leads/page.tsx:1285` exige fonte/cidade/termos; `:1298–1299` só desabilita durante busca, embora tenha o mesmo rótulo na etapa Critérios. Sem termos, um botão está bloqueado e o outro parece pronto. **A guarda operacional funciona:** T-UI-010 retornou `prospecting_terms_required` e zero invocações de API. Aceite: uma definição de disponibilidade/explicação compartilhada pelos comandos; manter validação backend/frontend. Não classificar como busca paga indevida.

### ACH-UI-010 — Catálogo apresentado como único não alimenta o seletor dos orçamentos

**P2, confiança alta nas fontes; impacto final depende dos dados/fluxo homologado.** V3 J09/J10/cap.16. Aba comercial exibe `knowledge_catalog_items` (`ProductsOrcamentosWorkspace.tsx:49–58`) e encaminha edição para `EmpresaTabs`/`KnowledgeCatalogManagerTab`; Orçamentos usa `useCatalogoStore`→`loadOperationalCatalog`→`services` (`operationalEntitiesRepository.ts:293–302`, `orcamentos/page.tsx:129,143–148`). Editor antigo `ProdutosTab` possui CRUD de `services`, mas não há importador consumidor dele nas rotas atuais examinadas. `catalog-knowledge` upserta `knowledge_catalog_items`, não `services`. Não foi encontrada ponte atual entre essas bases nesta trilha. Consequência: criar produto no catálogo anunciado como operacional não comprova disponibilidade no seletor do orçamento; a tabela de preço pode exigir caminho não exposto. Aceite: explicitar responsabilidades das duas bases ou reutilizar uma fonte/ponte governada e testar item novo→preço humano→orçamento→snapshot. Não copiar preços inventados para conhecimento.

## Campanhas e testes faltantes explicitamente

| Jornada | Comprovado nesta trilha | Falha/pendência |
|---|---|---|
| J03 Entrada | CSV simples; guarda vazia antes de invocar fonte; inspeção da RPC atômica e recuperação por runId | CSV especial falha. Busca paga, importação duplicada/concorrente e recarga de sessão com lote incerto não executadas no backend real |
| J04 Pipeline | Inventário de responsável/modo/lista, RPC de etapas, archive/purge, alternativa a arrastar | Cache de A sobrevive a B. Ativar/distribuir/mover/ganho/perda/reverter por perfis bloqueado em produção sem sandbox |
| J09 Conhecimento | CRUD/source/status/publicação encontrados; prévia demonstrativa rotulada corretamente | Flag comercial sem consumidor, catálogos separados, upload/deleção/mídia real e efeito da pausa na recuperação não homologados |
| J10 Agenda/orçamento | Guardas de intervalo, controle por updated_at, preço unitário confirmado e outcome backend encontrados | Próxima ação reproduzida quebrada. Conflito concorrente/indisponibilidade entre 2 writes/entrega de documento/lembrete real bloqueados |
| J14 Gerencial | Fonte operacional única de analytics, leitura paginada, tabela alternativa, ausência de dados tratada | Título diário contradiz janela. Mesma coorte/contagens após mutação real entre módulos/perfis pendente |
| J16 Comercialização | Painel empresarial, cadastro/autenticação/configuração existentes | Não localizado painel global, entitlement por plano, suporte contextual e suspensão global de cliente. Testes de oferta reduzida/retomada não aplicáveis a interface implementada, mas requisito permanece lacuna |

Não foram executados envios, busca externa, convite, alteração de cliente, QR, ativação, pausa, desconexão, publish, migração ou commit. Nenhuma fixture remota exige limpeza. Somente artefatos de auditoria foram criados.

## Ciclo de vida por família de módulo

| Família | Estado/contrato encontrado | Ativação/desativação/reconexão testada | Limite e dependências |
|---|---|---|---|
| Auth/RBAC/auditoria | Núcleo essencial compartilhado; não deve ficar inacessível com desligamento opcional | NÃO TESTADO dinamicamente nesta trilha | Reset de cache/session fail-closed necessário; sem teste de identidade global real |
| Busca manual/CSV | Fonte ativa + modo real + permissão; CSV é operação pontual | Guarda sem termo APROVADA; fonte real NÃO TESTADA | Fonte/limite/créditos/backend; amostra não é homologação de fornecedor |
| Busca automática/Ana | Agendas e operação governadas no backend | BLOQUEADO para alternância real | Ver trilha mensageria; consumidor catálogo ainda diverge |
| Leads/listas/Kanban | Entidades têm estado ativo/arquivado; módulo não tem licença ou controlador próprio encontrado | BLOQUEADO em dados reais | Preservação de histórico; archive/opt-out não devem liberar contato |
| Central/WhatsApp | Canal/conta tem estado operacional; humano depende de permissão/contato | BLOQUEADO nesta trilha | Conexão remota, pausa e autorização são conceitos distintos |
| Agenda/tarefas | Status por compromisso/tarefa e metadata de lembrete | Sem ciclo completo implementado encontrado; NÃO TESTADO | Worker de lembretes não encontrado em functions examinadas; serviço externo não configurado não deve ser prometido |
| Catálogo/conhecimento | Estado de item/fonte, usage e publicação; política comercial duplicada | REPROVADO na consistência estática; alternância real BLOQUEADA | Documentos/chunks/serviços/preço/template e ferramentas Ana precisam concordar |
| Orçamentos/documentos | Rascunho/aguarda aprovação/enviado/aceito/etc.; snapshot e outcome humano | Sem ciclo de módulo encontrado; NÃO TESTADO | Histórico emitido deve sobreviver a catálogo desligado; envio não provado |
| Relatórios/Funil | Leitura de fontes partilhadas; preferências locais; sem provisionamento externo exclusivo | NÃO APLICÁVEL desconectar provedor próprio | Permissões/escopo e fonte íntegra continuam obrigatórios |
| Empresa/equipe/configurações | Gestão por organização e permissão; membro pode ficar ativo/inativo | BLOQUEADO para mutação real | Não confundir suspensão de membro com empresa/plano |
| Plataforma/plano/suporte | Não encontrado contrato completo no código alvo | BLOQUEADO | Lacuna de implementação/especificação para escopo V3; não criar por inferência nesta auditoria |

Em todas as linhas, “sem ciclo” é conclusão limitada ao código examinado e deve ser reconciliada com o inventário remoto. Nenhuma operação em andamento foi cancelada. Nenhuma conexão foi encerrada. Não há resultados externos incertos produzidos por estes testes.

## Arquitetura da informação e especificação compacta — propostas, não alterações

O menu real é: Visão geral → Dashboard; Prospecção → Busca/Leads; Atendimento → Kanban/Central/Agenda; Comercial → Orçamentos/Funil/Relatórios; Administração → Configurações. A Configuração tem Status operacional, Canais, APIs, Empresa/conhecimento, Ana, Produtos/orçamentos, Usuários, Registro e Proteção. Essa sequência é coerente com tarefas, mas catálogo de conteúdo e catálogo de preço parecem uma fonte só quando não são.

- **Usuário operacional:** conservar Carteira, Kanban, Central, Agenda e Orçamentos conforme permissão; QR próprio na Central. Atalhos de lead reutilizam os mesmos módulos. Teste de encontrabilidade: localizar conexão própria e próximo compromisso sem acesso a chaves empresariais.
- **Administrador cliente:** conservar áreas operacionais e agrupar configuração empresarial/coleta de conhecimento/política Ana/equipe/canais. Renomear ou ligar catálogos apenas após decidir o contrato do preço. Teste: produto novo aprovado deve ser encontrado pelo vendedor no contexto correto.
- **Plataforma:** o protocolo pede empresas/planos/módulos/saúde/suporte; não há implementação encontrada. Mapa futuro deve separar escopo global do cliente; não reutilizar `configuration.manage` como poder global. Implementação depende de fase autorizada e requisitos de licença.
- **Kanban versus Funil:** as tarefas encontradas são quadro de execução versus análise de conversão e governança; não há prova para fundir regras. Podem compartilhar rótulos/contexto e navegação sem criar outro banco.
- **Equipe e auditoria:** usuários com T/A mas sem C podem ter acesso às rotas diretas e não à Configuração onde o menu principal aponta. Verificar encontrabilidade por perfil antes de declarar as áreas indisponíveis; evitar duplicar telas.

Tokens atuais em `wayflex-visual.css:3–18`: ink `#14151a`, canvas `#f2f4f8`, superfície `#fff`, linha `#e3e7ed`, lima `#d9f66d`, verde `#168654`, erro `#bd3d32`, âmbar `#8c651d`, muted `#69717d`. Há overrides de títulos/células e classes de densidade, não uma medição completa de contraste. Preservar esses tokens; padronizar espaçamento 4–8/12–16/16–24px como proposta local do V3, não norma externa. Cards devem mostrar estado comprovado, período e próximo comando. Preview de modelo corretamente declara “Dados demonstrativos” e “não enviada”; não contar R$0 como métrica real.

Melhorias estáticas a validar: CSV usar o diálogo nativo compartilhado; tooltip hoverable; botões equivalentes com mesmo disabled/motivo; cards Kanban evitar `role=button` com `details/select/button` dentro (`kanban/page.tsx:575–580`), pois keydown do cartão pode capturar Enter/Espaço dos controles filhos; calendário mensal e lista devem manter alternativa acessível; tabs com `role=tab` devem validar navegação/foco/associação de painéis. Relatórios já expõem “Ver dados em tabela” e gráficos com `accessibilityLayer`. Não foram medidos alvos, contraste final, leitor de tela, reflow/zoom ou foco em browser por este agente.

Pontos adicionais não homologados: Agenda carrega até 200 itens para calendários (`agenda/page.tsx:126`) e só lista pagina; catálogo busca texto depois de limitar resultados (`catalogKnowledgeRepository.ts:184–211`). Necessário testar >200 compromissos/>120 itens para verificar omissão e feedback de limite; não há dados suficientes para alegar ocorrência real. `EmpresaTabs.HistoryTab` usa `.then(...).finally(...)` sem catch, podendo parecer vazio após erro; investigar com falha de API simulada antes de promoção a achado.

## Fontes e decisões profissionais (EV-UI-003)

Consulta em 05/10/2026. As referências foram abertas; não houve pesquisa com usuários, card sorting ou certificação.

| Fonte | Natureza/seção e aplicação | Decisão/aceite adaptado |
|---|---|---|
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Norma técnica adotada pelo V3 como alvo AA, não conformidade já demonstrada | Cobrir teclado, nome/foco/reflow, erro/status e alternativa a arrastar em todas as rotas/perfis |
| [WAI 1.4.13](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) | Explicação oficial: dismissible/hoverable/persistent | ACH-UI-006; manter ajuda enquanto usuário move ponteiro; custo pequeno reutilizando componente |
| [WAI 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Explicação oficial de alvo 24×24 CSS px e exceções | Medir alvo/spacing de ícones; não declarar 44px mínimo universal AA; preservar densidade operacional |
| [Carbon Data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) | Orientação de design system; tabelas, toolbar, expansão e seleção | Ações/filtros da carteira junto da tabela; cards apenas resumos. Reutilizar stack atual, sem instalar Carbon |
| [RFC 4180](https://www.rfc-editor.org/info/rfc4180/) | Referência informativa, seção 2 itens 6/7: CRLF/aspas em campos | ACH-UI-001; fidelidade de parser verificada com fixture; não exigir reescrever pipeline |
| [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection) | Orientação de segurança da exportação | ACH-UI-002; serializador compartilhado + testes de prefixos, sem abrir payload perigoso |

A tentativa de abrir `https://supabase.com/changelog.md` retornou erro interno da ferramenta; não se implementou atualização nem se inferiu mudança de API por isso. A trilha de segurança/backend verifica a documentação Supabase aplicável.

## Ordem de remediação proposta

1. Corrigir/invalidar cache de dados e permissões por identidade/organização e executar J02/J15 com duas organizações isoladas.
2. Tornar reais os controles comerciais existentes, sem duplicar autoridade; mapear efeitos de interrupção e retomada com a Ana e propostas.
3. Reparar próxima ação da Agenda e contrato CSV/exportação; repetir os mesmos cenários preservados aqui e regressões dos repositories.
4. Corrigir semântica do indicador e acessibilidade dos componentes compartilhados; validar UI autenticada/teclado/zoom por perfil.
5. Resolver a fonte do catálogo/preço e definir a oferta comercial (plataforma/planos/suporte) antes de exigir homologação J16. Não é autorização para construir esses módulos nesta auditoria.

Limite final: inspecionar fonte não aprova CRUD real, emissão externa, RLS ou independência de navegador. Os achados, inventário e testes acima devem ser cruzados com os relatórios de segurança/mensageria e com as evidências UI/remotas do agente principal.
