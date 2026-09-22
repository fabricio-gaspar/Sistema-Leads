# Integrações

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
