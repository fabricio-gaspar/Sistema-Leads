# Histórico resumido de execução

## 2026-09-09 — Baseline de Configurações

- Configurações passaram a usar status, equipe, integrações, fontes e supressões remotos.
- Funções `operational-diagnostics` e `team-members` publicadas; `ana-run` e worker reforçados.
- 104 testes, lint, typecheck e build aprovados; commit `4d072280a09b3b8462f5bf0dfa701b314eca31bb`.
- Site privado publicado como versão 48. Produção e envios não foram ativados.

## 2026-09-09 — Lote atual (em validação)

- Solicitação: concluir os 13 requisitos e instalar o protocolo de memória técnica incremental.
- Aplicados: Registro do Sistema separado, marca textual WAYFLEX, Dashboard remoto,
  Central sem simulação e saída humana pela fila segura.
- `.agent/` criado e conectado ao `AGENTS.md`.
- Quatro templates industriais sem preço/prazo inventado foram gravados na fonte operacional.
- Modo real ganhou pré-flight no backend e permanece bloqueado com Claude, webhook e scheduler offline.
- Equipe e responsáveis agora usam membros reais; gráficos e tempos estimados foram removidos.
- Typecheck frontend/Edge, lint, 107 testes e build aprovados. Commit e publicação ainda pendentes.
- Implementação salva no commit `7c0e02c9a62c2716de408aed6818cb27dec01c33`.
- Prévia privada publicada como Site versão 49 a partir do checkpoint documental
  `947cf10d18e921e4250e5878b0a7ea43dedb3a6b`; publicação concluída com sucesso.

## 2026-09-09 — Correção Z-API: salvamento de credenciais

- Causa confirmada: `configurar-integracao` misturava a gravação no cofre com
  uma tentativa automática de registrar webhook em `update-every-webhooks`.
  A resposta HTTP 400 desse endpoint fazia a interface informar que as chaves
  não haviam sido salvas, embora já estivessem no cofre.
- O salvamento e o teste de conexão agora não alteram webhook. Eles validam
  somente a instância, token e conexão do aparelho, sem enviar mensagem.
- A homologação do webhook segue pendente e mantém o modo real bloqueado até
  existir callback controlado com contrato confirmado.
- Publicadas: `configurar-integracao` v12 e `testar-integracao` v10. Testes:
  typecheck Edge e 108 testes aprovados.

## 2026-09-09 — Correção Z-API: contrato de status

- A documentação oficial atual foi confrontada com o teste: `GET /status` usa
  somente `Client-Token` e `Content-Type: application/json`.
- O header extra `Accept` foi removido; o teste automatizado protege esse
  contrato e confirma que a validação não envia mensagem.
- Publicada `testar-integracao` v11. Typecheck Edge e 109 testes aprovados.

## 2026-09-09 — Ambientes, limpeza segura e categorias de integração

- Dashboard ganhou controle real de Ambiente de Demonstração/Ambiente Real. A fonte continua
  em `company_settings.sandbox_mode`; a Edge Function faz o pré-flight e audita a alteração.
  A versão atual mantém Ambiente Real bloqueado por IA, webhook e worker 24/7 não homologados.
- `integrations.category` foi aplicado e indexado. Comunicação, Prospecção e Inteligência da
  Ana usam a categoria persistida, sem duplicar credenciais ou testes.
- Nove leads com marcadores objetivos de demonstração foram removidos com mensagens, tarefas,
  execuções, filas, agenda, propostas, contatos e contas exclusivas. Um lead com inbound e
  sem marcador de teste ficou preservado para revisão; não foram encontrados órfãos nas tabelas
  verificadas. O audit log append-only preservou o histórico de governança.
- Publicadas: `operational-diagnostics` v4 e `configurar-integracao` v13.
- Typecheck frontend/Edge, lint, 110 testes e build aprovados. Site privado publicado como
  versão 50 a partir do commit `1e2f3f406e0406c3c081d447ebbbb23510690045`.

## 2026-09-09 — Assistente de entrada Z-API e Worker 24/7

- Confirmado no banco: WhatsApp/Z-API de saída e Claude estavam validados; o item pendente
  era a entrada de mensagens, não uma nova validação de credenciais.
- O assistente agora cadastra somente o webhook oficial `PUT /update-webhook-received` pelo
  backend, sem expor URL/token. A entrada só fica homologada após callback real vinculado
  ao lead e processado pela Ana.
- Migration `20260909182343_add_server_side_automation_dispatch` instalou o cron
  `leadai-automation-worker-dispatch` por minuto. O botão prepara token por organização
  no Vault; o worker aceita apenas esse token interno ou usuário administrador e grava
  heartbeat sem liberar saída em Demo.
- Publicadas: `automation-worker` v11 (`verify_jwt=false` com autenticação interna),
  `operational-diagnostics` v5 e `webhook-whatsapp` v8.
- Typecheck frontend/Edge, lint, 112 testes e build aprovados. O cron foi confirmado ativo;
  como a integração scheduler da WayFlex segue desativada, a execução controlada retornou
  zero despachos e nenhuma mensagem foi enviada.
