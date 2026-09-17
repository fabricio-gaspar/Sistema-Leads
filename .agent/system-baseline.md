# Baseline do sistema

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
- O Dashboard organiza o processo em **Começo · captar**, **Meio · atender** e
  **Final · fechar**. Os cartões Ambiente Real, Z-API, entrada WhatsApp, Ana, worker e
  fontes são calculados pelo diagnóstico do backend; não há indicador decorativo de online.
- O Dashboard também consolida a atividade das conversas a partir de `lead_messages` reais.
  A assinatura Realtime é restrita à organização autenticada e o selo de atualização ao vivo só
  é exposto após a confirmação de inscrição pelo Supabase.
- Configurações separa responsabilidades em **Canais**, **APIs** e **Fontes**. A validação
  e o teste direto da Z-API ficam exclusivamente no bloco Canais > WhatsApp.
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
