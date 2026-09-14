# Mapa de arquitetura

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
   `notification_preferences` sem expor credenciais.
2. O cron existente chama `automation-worker`; o worker cria/retoma
   `prospecting_schedule_runs`, aplica limites e usa `prospectar-leads` para o Apify.
3. Leads aceitos entram em `leads` com origem, identidade e deduplicação. `ana-run` permanece a
   única autoridade para decidir mensagem, estágio, reunião, orçamento ou handoff.
4. `lead_qualifications` registra score, interesse, intenção, próxima ação e evidência. Eventos em
   `domain_events` roteiam notificações por responsável; `notifications` alimenta sino e Dashboard
   por Realtime. O worker cria o resumo diário restrito à carteira de cada vendedor.
5. Simulação não chama provedores; supervisão exige aprovação; automático exige prontidão completa,
   autorização do Apify, canal comprovado, score mínimo, limites e kill switch desligado.

## Equipe e identidade

1. A tela chama `team-members` com a sessão do administrador e a organização ativa do perfil.
2. A função grava uma autorização curta em `organization_invites` antes de criar ou convidar no
   Supabase Auth. O gatilho `private.handle_new_auth_user` consome essa autorização e cria perfil,
   `organization_members` e `user_roles` na organização correta.
3. O backend reforça papel/status, confirma o `active_organization_id` e audita a ação sem registrar
   senha. Falha do Auth restaura ou remove somente a autorização preparada pela tentativa.
