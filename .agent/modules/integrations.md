# Integrações

- Fonte de status: tabela `integrations`; segredo: cofre acessado por RPC no backend.
- Adaptadores implementados no painel: Z-API/WhatsApp, Claude/OpenAI da Ana, Apify e Google Places.
- `connected` só pode significar teste válido do adaptador; configurar credencial não basta.
- Integração sem adaptador ou sem teste deve aparecer como não configurada, pendente, offline
  ou não verificada — nunca online por preset.
- Testes de provedor não devem enviar mensagens. Testes reais usam somente contas/números
  expressamente autorizados.
