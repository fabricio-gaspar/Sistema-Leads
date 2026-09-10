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
6. Central de Atendimento lê `leads` + `lead_messages`; Kanban lê e grava o mesmo lead.
7. Registro do Sistema consolida auditoria, execuções, entrada, fila e riscos.

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
