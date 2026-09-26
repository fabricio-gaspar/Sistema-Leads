# Mapa de arquitetura

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
