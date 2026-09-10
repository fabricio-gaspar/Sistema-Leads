# Integrações

- Fonte de status: tabela `integrations`; segredo: cofre acessado por RPC no backend.
- Adaptadores implementados no painel: Z-API/WhatsApp, Claude/OpenAI da Ana, Apify e Google Places.
- `connected` só pode significar teste válido do adaptador; configurar credencial não basta.
- O painel distingue conexão validada de uso operacional: uma integração conectada porém
  desabilitada aparece como **Configurada · inativa**, nunca como offline nem ativa.
- Configurações usa três blocos sem sobreposição: **Canais** para conversas e Z-API,
  **APIs** para IA/prospecção e **Fontes** para ativar ou pausar origens na Busca de Leads.
- O teste direto e a validação da Z-API aparecem somente em Canais > WhatsApp.
- Integração sem adaptador ou sem teste deve aparecer como não configurada, pendente, offline
  ou não verificada — nunca online por preset.
- Testes de provedor não devem enviar mensagens. Testes reais usam somente contas/números
  expressamente autorizados.
