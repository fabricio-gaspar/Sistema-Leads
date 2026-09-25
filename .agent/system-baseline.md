# Baseline do sistema

## Delta atual — etapa 3, importação da revisão para Leads

- A importação manual de resultados da Apify mantém a seleção explícita, a criação de leads
  sem envio externo e a navegação para Leads no sucesso. Agora aguarda também a persistência
  da lista e da atualização final antes de navegar.
- Falhas de gravação não são mais ocultadas: a lista é recarregada do Supabase, a tela mostra
  uma mensagem de resultado incerto e bloqueia nova submissão até o operador conferir Leads.
  Não há mudança em schema, RLS, Ana, Kanban, mensagens ou provedores.
- Type-check frontend/Edge, lint, 36 arquivos/245 testes e build/artefato passaram. Não houve
  importação real para homologação: a leitura do projeto oficial apontou zero leads.

## Referência atual — etapa 1 de 25/09/2026

Código `9bdd136eaa9c03a2eb1eca91f67e57d3dac88579`, tag
`baseline-wayflex-stage1-20260925`, com runtime idêntico ao Site v118 (`a55a0a2`).
Type-check frontend/Edge, lint, 35 arquivos/238 testes e build/artefato Sites aprovados.
Inventário sanitizado: `.agent/baselines/2026-09-25-stage-1.json`;
procedimento e limites: `docs/BASELINE_ETAPA_1_2026-09-25.md`.

O estado atual prevalece sobre snapshots históricos abaixo: Ana em modo automatic com
rotina desativada; Z-API e Meta com entrada/saída/automação desligadas; nenhuma conta Meta;
uma conta Z-API não arquivada e desabilitada; zero leads/mensagens/filas na Wayflex.
Cinco buscas Apify permanecem running. Nenhum estado remoto foi alterado nesta etapa.
GitHub main e repositório do Site têm raízes distintas; não sincronizar por substituição.

O operador exige troca manual de modelo e confirmação entre etapas. A próxima é a etapa 2,
Apify, com GPT-6 Sol Extra High. Não executar a próxima etapa automaticamente.

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
