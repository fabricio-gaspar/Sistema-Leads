# Evolution GO — operação segura

O Evolution GO é o **canal principal configurável** de WhatsApp. Z-API e Meta Cloud API permanecem disponíveis apenas como provedores legados/alternativos e o Evolution começa bloqueado por padrão.

## O que foi implementado

- Adaptador único para a API oficial v0.7.2: criar instância, conectar, consultar status, QR Code, pareamento, reconectar, desconectar, encerrar sessão e enviar texto, imagem, áudio, vídeo e documento.
- Configuração em **Configurações → Canais → Entradas do WhatsApp → Evolution GO → Servidor Evolution GO**. O administrador salva a URL HTTPS e a chave global e testa o acesso pela consulta administrativa `GET /instance/all`. A tela nunca lê uma chave já salva; ela recebe apenas estado e código de diagnóstico.
- O mesmo painel administrativo acompanha e habilita/desabilita conectores, mas não gera QR/código nem executa conexão ou encerramento de sessão. O vendedor usa **Central de Atendimento → Meu WhatsApp** para ver a conta e a instância não secreta vinculadas a ele e fazer o próprio pareamento, quando o servidor concluir o provisionamento.
- Credenciais em Vault por integração: URL base, chave global, token/ID/nome da instância e segredo individual do webhook.
- Webhook rápido, com segredo por integração, comparação em tempo constante, limite de corpo e fila idempotente. Segredos, QR Codes e pareamentos não são persistidos em diagnósticos ou logs.
- Worker assíncrono para mensagens recebidas, recibos e conexão. Ele grava mensagens, cancela automações pendentes após resposta do cliente, respeita handoff humano e chama a Ana apenas quando permitido.
- Retentativas com espera exponencial e `dead_letter` após cinco falhas; o agendador já existente também consome callbacks pendentes sem bloquear a operação comercial.
- Ao criar um acesso direto de vendedor, o servidor cria registros locais desativados e uma fila durável de provisionamento individual. Token, nome e ID da instância só são criados pelo worker, depois de a configuração global segura estar disponível; nenhum segredo é retornado ao navegador.
- Após a criação da instância, o vendedor autenticado vê apenas sua conta na **Central de Atendimento → Meu WhatsApp**, conecta por QR Code ou código e valida o estado. A chave global nunca é entregue ao vendedor. Conectar e habilitar sua conta não abrem sozinhos os controles administrativos de entrada, saída ou Ana.

## Pré-requisitos de publicação

1. As migrations de fundação, transferência atômica e provisionamento automático e as funções Evolution já foram verificadas no projeto Supabase oficial em 04/10/2026.
2. Definir `EVOLUTION_GO_ALLOWED_ORIGINS` como uma lista separada por vírgulas de origens HTTPS exatas. Não use IP privado, `localhost`, caminhos ou curingas.
3. No painel administrador, configurar o servidor corporativo com URL HTTPS e chave global, salvar no Vault e executar **Testar conexão**. O teste é de leitura, exige uma resposta compatível com Evolution GO e não cria instâncias ou mensagens. Uma chave trocada volta ao estado **Teste pendente**.
4. Aceitar/criar o vendedor para enfileirar sua instância individual. O worker bloqueia o provisionamento enquanto uma configuração nova estiver sem teste aprovado. Conferir o job e o estado da instância antes de pedir ao vendedor que conecte.
5. O vendedor entra na Central, lê o QR ou usa o código de pareamento e atualiza o status. Depois, a liberação administrativa separada de entrada, saída e Ana pode ser feita em homologação controlada.

Esta sequência está validada **localmente**. A Edge Function e o Site oficiais não foram publicados nesta etapa: a release coordenada continua NO-GO sem ambiente isolado e homologação integrada. Não inserir credenciais reais nem parear número de produção na prévia local como substituto dessa homologação.

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
