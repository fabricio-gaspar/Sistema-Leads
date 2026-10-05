# Evolution GO — operação segura

O Evolution GO é o **canal principal configurável** de WhatsApp. Z-API e Meta Cloud API permanecem disponíveis apenas como provedores legados/alternativos e o Evolution começa bloqueado por padrão.

## O que foi implementado

- Adaptador único para a API oficial v0.7.2: criar instância, conectar, consultar status, QR Code, pareamento, reconectar, desconectar, encerrar sessão e enviar texto, imagem, áudio, vídeo e documento.
- Configuração em **Configurações → Canais → Entradas do WhatsApp → Evolution GO**. A tela nunca lê uma chave já salva; ela apenas envia a alteração para uma Edge Function autenticada.
- Credenciais em Vault por integração: URL base, chave global, token/ID/nome da instância e segredo individual do webhook.
- Webhook rápido, com segredo por integração, comparação em tempo constante, limite de corpo e fila idempotente. Segredos, QR Codes e pareamentos não são persistidos em diagnósticos ou logs.
- Worker assíncrono para mensagens recebidas, recibos e conexão. Ele grava mensagens, cancela automações pendentes após resposta do cliente, respeita handoff humano e chama a Ana apenas quando permitido.
- Retentativas com espera exponencial e `dead_letter` após cinco falhas; o agendador já existente também consome callbacks pendentes sem bloquear a operação comercial.
- Ao criar um acesso direto de vendedor, o servidor cria registros locais desativados e uma fila durável de provisionamento individual. Token, nome e ID da instância só são criados pelo worker, depois de a configuração global segura estar disponível; nenhum segredo é retornado ao navegador.

## Pré-requisitos de publicação

1. As migrations de fundação, transferência atômica e provisionamento automático e as funções Evolution já foram verificadas no projeto Supabase oficial em 04/10/2026.
2. Definir `EVOLUTION_GO_ALLOWED_ORIGINS` como uma lista separada por vírgulas de origens HTTPS exatas. Não use IP privado, `localhost`, caminhos ou curingas.
3. Informar na tela a URL HTTPS da instância Evolution GO e as credenciais reais. Elas não entram no Git nem no frontend.
4. Criar ou vincular a instância; conectar por QR Code ou pareamento; atualizar status; só então clicar em **Ativar uso**.

Enquanto esses passos não forem concluídos, o controle de entrada, saída e automação permanece desligado. Nenhuma mensagem será enviada nem recebida pelo Evolution GO por engano.

## Homologação controlada

1. Use um número de teste cadastrado como lead e autorizado para contato.
2. Confirme `Conectada` na tela e ative o canal apenas para o teste.
3. Envie uma mensagem individual ao número corporativo; confirme uma única entrada na fila, no lead e na Central.
4. Faça um envio manual da Central e confirme o aceite; só marque como entregue/lida após recibo real do provedor.
5. Envie imagem, áudio, vídeo e documento de teste. O evento e seu tipo são registrados; mídia sem metadados seguros é marcada para revisão humana, em vez de ser baixada ou associada silenciosamente.
6. Teste reconexão, desconexão e logout. Desativar o uso deve preservar credenciais, sessão quando aplicável e histórico; logout exige novo pareamento.

## Limitações conscientes da API oficial

A integração trata apenas as famílias de eventos documentadas pelo Evolution GO: mensagens, envio/recibos, conexão e QR. Eventos não documentados (como edição ou exclusão de mensagem) não são inventados como evento comercial; ficam ignorados ou em revisão. Entrega e leitura dependem de recibo efetivamente recebido.

Referências: [repositório Evolution GO](https://github.com/evolution-foundation/evolution-go), [rotas oficiais v0.7.2](https://github.com/evolution-foundation/evolution-go/blob/0.7.2/docs/swagger.yaml), [conexão QR](https://github.com/evolution-foundation/evolution-go/blob/0.7.2/docs/wiki/recursos-avancados/qrcode-connection.md) e [sistema de eventos](https://github.com/evolution-foundation/evolution-go/blob/0.7.2/docs/wiki/recursos-avancados/events-system.md).
