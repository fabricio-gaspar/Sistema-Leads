# Baseline do sistema

Base validada: `4d072280a09b3b8462f5bf0dfa701b314eca31bb`.

## Produto

CRM multiempresa WayFlex para prospecção, qualificação, atendimento, Kanban, agenda e
orçamentos. Não é sistema de venda, checkout, pedido ou recebimento.

## Stack confirmada

- React, TypeScript, Vite e Tailwind no frontend.
- Supabase Auth/Postgres/RLS/Storage/Edge Functions no backend.
- Site privado existente, com publicação vinculada ao repositório Git.

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
- Modo operacional vem de `company_settings.sandbox_mode`; Dashboard e Configurações exibem
  Ambiente de Demonstração/Ambiente Real, com pré-flight e auditoria no backend. Produção segue bloqueada.
- `integrations.category` separa persistentemente prospecção, comunicação, inteligência,
  agendamento e sistema. O painel não duplica o cofre nem a validação.
- Nove dados de teste confirmados foram removidos com suas dependências. Um lead com inbound e
  sem marcador explícito de teste permanece preservado para revisão humana.
- `operational-diagnostics` e `team-members` foram publicados.
- Build, lint, typecheck e 104 testes estavam aprovados no commit-base.
- A versão privada publicada correspondente ao último lote conhecido é a 48.

## Não declarar como concluído

- Homologação real WhatsApp/Claude e E2E autenticado.
- Worker 24/7 completo com lease/heartbeat/dead-letter/reconciliação.
- Pipeline multimídia completo (extração/OCR/transcrição/embeddings).
- Remoção integral de stores/mocks operacionais e funções legadas.
- Prontidão comercial sem nova auditoria final e piloto controlado.

Detalhes de continuidade e releases ficam em `docs/CONTINUIDADE_WAYFLEX.md`.
