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
- Como este Site é uma exportação estática Vite, `VITE_PUBLIC_SUPABASE_URL` e
  `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` são incorporadas no build. O ambiente do Site é a
  fonte dos valores, mas uma publicação exige reconstruir o artefato com ambos; eles nunca
  são gravados no repositório e somente a chave publicável pode ir ao navegador.

## Fontes operacionais principais

- `leads`: identidade, carteira, canal, estágio e estado de automação.
- `lead_messages`: histórico cronológico usado pela Central e pela Ana.
- `agent_runs`: decisões e erros da Ana.
- `outreach_jobs` e `lead_outreach`: fila e rastreio de saída.
- `channel_inbound_events` e `webhook_events`: entrada e callbacks.
- `company_settings`, `integrations` e `organization_module_data`: configuração operacional.
- `knowledge_documents`/`knowledge_chunks`: base aprovada consultável pela Ana.

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

Detalhes de continuidade e releases ficam em `docs/CONTINUIDADE_WAYFLEX.md`.
