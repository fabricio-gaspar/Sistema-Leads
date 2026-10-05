# Mapa de arquitetura

## Continuação R4–R12 — 05/10/2026 — LOCAL, não implantada

Auth/convite → vínculo canônico explícito → contexto frontend por user/org/generation → OrganizationGate → stores cercados e sem cache operacional compartilhado. Administração empresarial não gerencia senha/identidade Auth global.

WA/Evolution: ações manuais e provisionamento automático → mesmo ledger/token/revisão → cutoff persistido → etapa externa cercada → conclusão CAS. Diagnóstico administrativo só consulta; encerra operação read-only comprovada mantendo disabled/gates. Entrada → transação local única (mensagem/mídia/projeções) → lease de consequência → Ana; falha incerta vai para revisão, sem POST repetido. Contrato upstream WA-AKG não homologado mantém bloqueio.

Ana: política comercial + fontes/documentos/chunks canônicos → snapshot de IDs/digest → decisão → revalidação de lead/política/fontes antes de efeito e pós-freeBusy → worker revalida snapshot antes de dispatch. Catálogo de conhecimento permanece distinto da tabela de preços. Sem autoridade automática para aprovação/envio final de orçamento.

Agenda: próxima ação → RPC invoker/RLS → pai bloqueado + barreira física privada por org/responsável → filho/link atômicos + UUID estável. Conflito limitado à carteira visível; não é calendário global exclusivo. Rotina de prospecção → cidade/UF/termo obrigatórios no handler e guards SQL. Código remoto permanece anterior; ver `docs/remediacao/2026-10-05-r4-r14/` para limites/evidência.

## Remediação R1/R2/R3 — 05/10/2026 — LOCAL, não implantada

R1 mantém as tabelas existentes: helpers privados e policies aplicam organização/carteira/proprietário ao acesso; trigger de último administrador serializa por escrita MVCC na organização. R2 acrescenta somente ledger privado de orquestração: UI → handlers WA/Evolution → intenção/corte local → etapas remotas cercadas por revisão/token → conclusão CAS. Flags canônicas em conta/integração continuam a autoridade; conectar conta não abre o gate global. R3 separa recibo autenticado do gate de entrada: identidade organização/conta/provedor → RPC monotônica → projeções locais, sem disparar Ana/saída. `ana-run` permanece a única autoridade automática.

Limite: workers de provisionamento automático ainda não participam do ledger; reconciliação humana de resultado incerto permanece pendente R6. Relatório e manifestos em `docs/remediacao/2026-10-05-r1-r3/RESULTADO_FINAL.md`. Não existe implantação remota deste delta.

## Wizard da Busca de Leads — 05/10/2026

`BuscaLeads` → `prospectingWizard` (validação local de Fonte, Região, Perfil e Critérios) → intenção humana ainda não persistida. Somente o clique final **Testar com 10 empresas** chama `executarBusca` → `prospectar-leads` → provedor real. A fonte chega de `useFontesStore` e continua elegível apenas quando o adaptador existe e a configuração está conectada/ativa. A resposta mantém o caminho já existente de revisão → `prospectingBatchRepository` → `import_prospecting_batch`; o Wizard não cria tabela, Edge Function, fila ou fonte paralela.

## Kanban operacional — 28/09/2026

`KanbanPage` → `kanbanRepository.loadKanbanPortfolio` → `get_kanban_portfolio` (SECURITY INVOKER/RLS) → `leads` + tarefas + qualificação + listas + histórico. O contrato retorna uma página e os contadores no mesmo snapshot lógico; não há leitura por cartão. `user_saved_views` guarda apenas a preferência do usuário/organização. Mudanças de etapa continuam em `transition_lead_stage`; o undo estreito usa `undo_recent_lead_stage_transition`. O drawer só lê `lead_stage_history`, `lead_messages`, `lead_notes` e tarefas; automações permanecem com `ana-run` e o worker existentes.

## Análise comercial — 27/09/2026

`CommercialAnalytics` → `useCommercialAnalytics` → repositories paginados/tabelas existentes. `commercialAnalytics.ts` calcula a leitura compartilhada e o predicado do Kanban; `proposalPricing.ts` valida preços humanos em Orçamentos/Central. `AccessibleDialog` compartilha comportamento de foco. Nenhuma tabela ou Edge Function nova.

## Contrato final — 26/09/2026

O detalhamento normativo está em `docs/ARQUITETURA_FINAL_WAYFLEX.md`. O runtime oficial continua
em `leads`/`lead_messages`/`agent_runs`/`outreach_jobs`; estruturas `crm_*` antigas não recebem
novos consumidores. Etapa comercial, estado operacional e responsabilidade são dimensões
independentes. Automações avançam uma etapa por vez e não reabrem estados terminais.

## Busca → Leads (etapa 4)

Revisão selecionada → `prospectingBatchRepository` → RPC `import_prospecting_batch` (SECURITY INVOKER/RLS) → `leads` + `lead_lists` + `lead_list_members` na mesma transação. O mesmo ID/payload pode ser repetido após resposta incerta. A navegação só ocorre após confirmação e atualização dos stores.

## Fluxo comercial crítico

1. Canal/formulário/importação cria ou identifica `leads`.
2. Entrada do WhatsApp passa por `webhook-whatsapp`, deduplicação e
   `channel_inbound_events`/`lead_messages`.
3. `ana-run` lê empresa, lead, histórico, catálogo, agenda, base aprovada e a versão ativa da
   configuração da Ana. Essa versão define canais, conteúdo, cadência e handoff; não há outro
   motor automático autorizado.
4. A decisão atualiza lead/estágio, cria tarefa/handoff/orçamento rascunho e, quando permitido,
   cria uma mensagem e `outreach_jobs`.
5. A Central registra uma mensagem humana em `outreach_jobs` e chama `automation-worker` para
   despachar somente esse job imediatamente. Em paralelo, `private.dispatch_automation_workers`
   chama o worker a cada minuto para empresas que ativaram o processamento 24/7; um token por
   organização no Vault autentica a chamada. O worker registra heartbeat e valida novamente
  políticas e provedor antes da saída.

Antes de chamar o provedor, o worker reserva a política de cadência por lead e registra a
aceitação separadamente do recibo de entrega/leitura. A reserva impede extrapolar o limite
diário em concorrência; recibos antecipados ainda dependem de nova reconciliação do callback.
6. Central de Atendimento lê `leads` + `lead_messages`; Kanban lê e grava o mesmo lead. O
   Dashboard deriva o gráfico de conversas dessa mesma leitura e assina alterações autorizadas
   de `lead_messages` por organização no Supabase Realtime.
7. Registro do Sistema consolida auditoria, execuções, entrada, fila e riscos.

## Guardas de contato e inteligência

- `phone` é telefone; somente `whatsapp` comprovado identifica o canal WhatsApp.
- `leads.contact_approval_status = approved` e `contact_approved_at` são pré-condições para
  qualquer saída automática. A aprovação pode ser registrada pelo operador com motivo ou por
  uma mensagem individual iniciada pelo próprio lead.
- O score operacional mantém três eixos: aderência ao ICP, contactabilidade e engajamento. A
  origem externa fica em `source_record_id`, `source_url` e `deduplication_key`.
- `ana-run` combina a leitura lexical da Base aprovada com `match_knowledge_chunks` quando o
  embedding existe. Sem vetor/provedor, permanece no fallback lexical e não inventa conteúdo.
- Reunião só é criada após horário explícito, disponibilidade Google Calendar e idempotência.
  Falha ou ambiguidade gera handoff, não confirmação fictícia.
- `record_outreach_provider_acceptance` grava aceite; `reconcile_whatsapp_receipt` promove para
  entregue/lida; `reconcile_provider_accepted_outreach` corrige persistência local após aceite
  comprovado e nunca reenvia.

## Limites de responsabilidade

| Camada | Responsabilidade |
|---|---|
| Frontend | Exibir, coletar intenção humana, chamar serviços e mostrar estados reais |
| Edge Functions | Autenticar, autorizar, validar políticas, integrar provedores e auditar |
| Postgres/RLS | Fonte da verdade, isolamento, integridade, idempotência e fila |
| Storage/Base Ana | Arquivos privados, revisão e conteúdo aprovado por organização |
| Site | Entrega privada do painel; não é motor de automação 24/7 |

## Dependências de maior risco

- `webhook-whatsapp` → `lead_messages` → `ana-run` → `outreach_jobs`.
- `cron`/`pg_net` → `automation-worker` → Z-API → reconciliação de recibos.
- `company_settings.sandbox_mode` e kill switch → todas as saídas automáticas. O painel
  apresenta somente Ambiente Real; a proteção interna e a transição são validadas no backend.
- `integrations.category` → classificação persistida entre prospecção, comunicação,
  inteligência, agendamento e sistema; não contém segredos.
- `organization_members`/RLS → qualquer leitura ou escrita multiempresa.

## Operação automática e alertas comerciais

1. Configurações chama `ana-operations`, que grava `company_settings`, `prospecting_schedules` e
   `notification_preferences` sem expor credenciais. A agenda guarda a rota inicial explícita:
   Ana, um vendedor ativo ou rodízio exclusivamente dos usuários selecionados.
2. O cron existente chama `automation-worker`; o worker cria/retoma
   `prospecting_schedule_runs`, aplica limites e usa `prospectar-leads` para o Apify.
3. Leads aceitos entram em `leads` com origem, identidade e deduplicação. No modo Ana, o worker
   aplica opcionalmente a mesma `lead_handoff_policies` já usada pelo Kanban; nos modos humanos,
   pausa a Ana e cria tarefa ao responsável. `ana-run` permanece a única autoridade para decidir
   mensagem, estágio, reunião, orçamento ou handoff.
4. `lead_qualifications` registra score, interesse, intenção, próxima ação e evidência. Eventos em
   `domain_events` roteiam notificações por responsável; `notifications` alimenta sino e Dashboard
   por Realtime. O worker cria o resumo diário restrito à carteira de cada vendedor.
5. Simulação não chama provedores; supervisão exige aprovação; automático exige prontidão completa,
   autorização do Apify, canal comprovado, score mínimo, limites, destinatários aptos e kill switch
   desligado. A simulação gera somente uma execução/auditoria interna, sem Apify, IA ou WhatsApp.

## Governança da base e entrada do site

1. Um administrador configura uma entrada de site com o número público já conectado à Z-API.
2. O link `wa.me` inclui um marcador público. Mensagem desconhecida sem marcador continua não
   vinculada; matching ambíguo continua bloqueado sem escolher um lead arbitrariamente.
3. Marcador ativo cria o primeiro lead, registra o inbound e delega qualquer decisão automática
   exclusivamente a `ana-run`.
4. A Base de Leads lista ciclo de atividade e responsável. `lead-governance` exige a permissão de
   exclusão e confirmação explícita antes de reaproveitar o purge transacional completo.

## Equipe e identidade

1. A tela chama `team-members` com a sessão do administrador e a organização ativa do perfil.
2. A função grava uma autorização curta em `organization_invites` antes de criar ou convidar no
   Supabase Auth. O gatilho `private.handle_new_auth_user` consome essa autorização e cria perfil,
   `organization_members` e `user_roles` na organização correta.
3. O backend reforça papel/status, confirma o `active_organization_id` e audita a ação sem registrar
   senha. Falha do Auth restaura ou remove somente a autorização preparada pela tentativa.

## Conhecimento comercial estruturado

1. `catalog-knowledge` aceita somente adaptadores explícitos das três páginas Wayflex iniciais e
   grava `knowledge_sources` + `knowledge_source_imports`; falhas são persistidas sem fallback
   fictício.
2. Produtos, serviços, catálogos e documentos vivem em `knowledge_catalog_items`; relações
   tipadas vivem em `knowledge_item_relations`. Triggers privados geram o documento/chunk derivado
   da mesma base aprovada já usada por `ana-run`.
3. A Central busca apenas itens ativos por RLS, prepara o texto verificável e chama o gateway
   humano existente. `queue_human_whatsapp_catalog_message` associa conteúdo ao mesmo job/mensagem
   idempotente e grava `conversation_knowledge_events`.
4. PDF/imagem não abre rota própria de envio: enquanto mídia não for homologada, o conteúdo sai
   como URL rastreável via texto. A Ana recebe intenção comercial e chunks aprovados, nunca uma
   permissão adicional de despacho.

### Atualização de 23/09/2026

- O adaptador `catalog-knowledge` v6 tem três formas explícitas de extração: `spa_bundle` para
  Produtos e Catálogos, `public_snapshot` para Segmentos e `html_card/page_fallback` somente como
  contingência verificável. Nenhuma delas cria conteúdo quando a origem falha.
- O item persiste a página canônica em `website_url` e o payload de origem; `source_url` recebe
  um fragmento determinístico por card apenas para o trigger de `documents` manter um documento
  exclusivo. `knowledge_chunks` continua sendo a única fonte recuperada pela Ana.

### Atualização de 26/09/2026

- `knowledge_catalog_items.qualification_questions` guarda até oito perguntas internas por item.
  A coluna participa do documento/chunk derivado, para que a recuperação existente da Ana trate
  a descoberta como orientação de conversa e não como fato publicado. Não há segundo índice,
  motor de decisão ou caminho de envio.

## Dossiê técnico de qualificação

1. `lead_qualifications` é o dossiê único por lead. `technical_context` contém somente
   necessidade, aplicação, medida/desenho, material/condição, quantidade e prazo; `missing_fields`
   torna a ausência explícita.
2. `ana-run` é a única autoridade que atualiza o dossiê por IA. Política, apresentação e
   simulação registram objeto vazio; nenhuma delas deduz especificação ou compromisso comercial.
3. Central e Kanban leem a mesma linha sob a RLS existente. Esses painéis não gravam dossiê nem
   criam mensagens, jobs, handoffs ou novas fontes de verdade.

## Contas WhatsApp por vendedor

1. `whatsapp_accounts` guarda somente metadados operacionais por organização: conta corporativa
   padrão ou conta de vendedor, proprietário, integração vinculada, estado e sufixo do telefone.
   Instance ID, token e client-token permanecem exclusivamente no Vault pela integração associada.
2. O número corporativo existente continua sendo o fallback e a conta padrão. Um lead novo pode
   resolver a conta do vendedor responsável; depois de vinculado, não troca silenciosamente de
   número em uma reatribuição.
3. Toda mensagem, job, outreach e evento de webhook registra `whatsapp_account_id`. O webhook
   procura identidade dentro da conta receptora, impedindo que o mesmo telefone em contas distintas
   seja associado por engano.
4. `ana-run` continua sendo a única autoridade automática. Ela resolve e fixa a conta imediatamente
   antes de uma operação real; simulações e bloqueios não alteram o vínculo. O worker revalida a
   relação conta/integração/organização antes de chamar a Z-API.
5. O administrador usa **Usuários > WhatsApp operacional** para cadastrar uma instância Z-API já
   existente. O vendedor usa **Meu WhatsApp** para abrir o conector oficial por QR ou telefone com
   token descartável; nenhum segredo permanente chega ao navegador.
6. `current_user_access` e as permissões `channels.view_own`, `channels.connect_own` e
   `channels.manage_all` filtram rotas e navegação. O administrador mantém a visão global; o
   vendedor vê somente módulos permitidos e sua própria conta operacional.

## Meta WhatsApp Coexistence por gates

1. `MessagingProvider` separa o contrato do provedor; a implementação Meta não substitui Z-API.
2. Embedded Signup troca o código somente no backend, grava o token no Vault e persiste na conta
   apenas WABA ID, phone number ID, nome/número exibido e metadados não secretos.
3. `webhook-meta-whatsapp` valida HMAC antes de parsear, deduplica por evento externo e reconhece
   mensagem, status, eco do aplicativo, histórico e sincronização sem guardar o payload integral.
4. Entrada resolve conta e lead dentro da organização; ambiguidade falha fechada. Saída entra no
   `messaging_outbox` transacional e o worker reconcilia aceite, entrega, leitura, falha e eventos
   fora de ordem sem reenvio cego.
5. Feature flag, controles de entrada/saída/automação e kill switch são revalidados no backend.
   Todos permanecem desligados até a homologação staged; `ana-run` continua a única autoridade.

## Central de Atendimento operacional

1. `central_list_conversations` e `central_get_inbox_counts` fazem busca normalizada, filtros,
   totais e paginação dentro do Postgres, sob sessão e RLS; a interface não calcula contagens a
   partir de uma única página.
2. `central_get_conversation_detail` retorna uma janela de mensagens e o contexto lateral em uma
   única leitura: dossiê, tarefas, notas, atividades, anexos e fontes de conhecimento vinculadas.
3. `conversation_read_states` é isolada por organização, usuário e lead. Marcar lida/não lida é
   uma RPC invocadora que confirma acesso ao lead antes de atualizar a leitura.
4. O Realtime escuta mensagens, leads, handoffs, tarefas e qualificação; polling de 60 s é só
   contingência. Falha de assinatura reduz o intervalo de recuperação e deixa o status explícito.
5. A Central só consulta `central_get_conversation_channel_provider` no instante do envio humano.
   A função retorna `zapi` ou `meta_cloud` já fixado ao lead, nunca credenciais, e não permite
   trocar conta pelo navegador.
