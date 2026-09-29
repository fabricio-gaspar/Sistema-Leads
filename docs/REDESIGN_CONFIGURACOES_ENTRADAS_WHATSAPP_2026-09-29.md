# Configurações > Canais > Entradas do WhatsApp — 2026-09-29

## Entrega

`IntegracoesOperacaoTab` agora apresenta uma central única de Entradas do WhatsApp. A tela separa
Configuração, Diagnóstico e Histórico e usa somente os contratos reais já existentes: `site-whatsapp-entry`,
`whatsapp-accounts`, `operational-diagnostics` e `testar-integracao`.

## Comportamento real

- Entrada do site: nome, origem, telefone E.164, mensagem inicial, ativação, link público, cópia e
  rotação server-side do código. A desativação confirma a ação e preserva a configuração.
- Recebimento e roteamento: Webhook Z-API, identificação, Ana e fallback exibem a saúde retornada pelo
  backend. Controles sem endpoint individual não são falsamente editáveis; ficam bloqueados com o motivo.
- Pré-requisitos: número, callback vinculado e destino são derivados do status real. Ana só aparece
  configurada quando IA, WhatsApp, callback e worker estão validados.
- Diagnóstico: estado do último callback, lead de teste, sufixo normalizado, checagens da conta e
  entradas recentes. Reprocessamento e reenvio continuam fora desta tela para preservar idempotência.
- Histórico: eventos de canal e da entrada retornados pelo backend, com ator, data, resultado e motivo.
- A validação controlada chama apenas `testar-integracao` e não envia mensagem nem cria lead/conversa.

## Segurança e dados

Não houve migration ou exposição de segredo. A Edge Function existente recebeu somente a ação `rotate`,
que gera código aleatório, invalida o link anterior e registra `whatsapp.site_entry_rotated` com a permissão
`website_entry.manage`. Credenciais continuam no Vault/backend.

## Validação

`npm run type-check`, `npm run type-check:edge`, `npm run lint`, `npm test -- --run`, `npm run build` e
`git diff --check` devem permanecer verdes. A publicação deve ser feita no Site oficial existente após
inspeção autenticada da rota `/dashboard/configuracoes?tab=canais`.
