# Integrações

- A Busca de Leads deriva o seletor das guardas já existentes: `integrations` confirma disponibilidade/credencial e `lead_source_configs` confirma o uso operacional. A interface não exibe IA ou fonte sem adaptador; hoje os adaptadores manuais permitidos são `apify` e `google_places`.

- Fonte de status: tabela `integrations`; segredo: cofre acessado por RPC no backend.
- Adaptadores implementados no painel: Z-API/WhatsApp, Claude/OpenAI da Ana, Apify e Google Places.
- `connected` só pode significar teste válido do adaptador; configurar credencial não basta.
- O painel distingue conexão validada de uso operacional: uma integração conectada porém
  desabilitada aparece como **Configurada · inativa**, nunca como offline nem ativa.
- Configurações usa dois blocos de integração sem repetição visual: **Canais** para conversas e
  Z-API, e **APIs** para IA e provedores de busca. Para Apify e Google Places, o mesmo cartão
  configura, testa e ativa/pausa o uso na Busca de Leads.
- `lead_source_configs` continua sendo a guarda operacional no backend: `prospectar-leads`
  exige tanto a integração validada quanto a fonte ativa. A tabela não é uma segunda credencial
  e não possui uma tela de configuração separada.
- O teste direto e a validação da Z-API aparecem somente em Canais > WhatsApp.
- Integração sem adaptador ou sem teste deve aparecer como não configurada, pendente, offline
  ou não verificada — nunca online por preset.
- Testes de provedor não devem enviar mensagens. Testes reais usam somente contas/números
  expressamente autorizados.
- No Dashboard, o resumo compacto intencionalmente reduz a leitura a **Conectado** ou
  **Desconectado**. O primeiro só é emitido pelo diagnóstico com `connected`, `enabled`, sem
  pausa/erro e teste fresco; os demais casos não recebem rótulo positivo.

## Seleção do provedor corporativo — 2026-09-25

- **Configurações > Canais > WhatsApp** apresenta Z-API e Meta WhatsApp Cloud API lado a lado.
  O administrador configura cada uma no próprio bloco e ativa somente um provedor corporativo por
  vez, evitando uma rota de saída ambígua.
- Desativar é reversível: bloqueia entrada, saída e automações da Ana no WayFlex, pausa as
  integrações daquela conta e registra auditoria; não apaga a sessão remota, o Vault nem o
  histórico. Um webhook de Z-API desativada recebe confirmação sem persistir, rotear ou reativar o
  canal.
- A decisão operacional está em `messaging_provider_controls`; o resolvedor server-side de conta
  também recusa provedor explicitamente desligado. A ausência de controle Z-API em organizações
  legadas mantém a compatibilidade até uma escolha explícita do administrador.
- Ativar uma conta corporativa também pausa as contas e integrações corporativas do outro
  provedor; a troca nunca deixa dois caminhos de saída ativos. Ao voltar à Z-API, o webhook interno
  é retomado, mas continua exigindo um callback real para que a entrada seja considerada homologada.
- O Dashboard usa as entradas sintéticas `whatsapp_zapi` e `whatsapp_meta`, calculadas no
  diagnóstico a partir de conta, integração e controle. Ele não deduz estado por texto histórico.

## 2026-09-11 — Apify Google Maps retomável

- `prospectar-leads` v8 não mantém a requisição do navegador aguardando o término do Actor.
  Ele grava o `provider_run_id`, devolve estado pendente e finaliza cache/resultados em uma
  consulta posterior autenticada do mesmo usuário e organização.
- Quando a origem devolve latitude/longitude (inclusive strings numéricas e variantes
  `lat`/`lng`), o normalizador preserva coordenadas válidas para o mapa da revisão.
- A ação de reparo para `apify_http_400` fica no backend `configurar-integracao` v16. Ela lê o
  segredo somente no Vault, troca o Actor de Google Maps, remove Task conflitante e mantém a
  fonte desativada/configurada até uma validação real. Nenhum token transita pelo navegador.
- Registros legados sem identificador remoto e vencidos são falha de execução, não resultado
  vazio; só os dois registros confirmados da organização ativa foram marcados como expirados.

## Meta WhatsApp Coexistence — 24/09/2026

- `whatsapp_accounts.provider` aceita `zapi` e `meta_cloud`; Z-API continua exigindo a integração
  atual, e ações Z-API rejeitam explicitamente contas Meta.
- O onboarding Meta usa Embedded Signup oficial. A UI é condicionada à flag por organização; não
  cria QR próprio e não recebe token permanente nem app secret.
- Webhook, envio e automação têm controles separados e kill switch. O estado real auditado é:
  duas contas Z-API conectadas, nenhuma conta Meta e todos os controles Meta fechados.
