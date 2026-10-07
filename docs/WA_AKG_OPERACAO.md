# WA-AKG — operação do canal principal

## Objetivo

O WA-AKG é o canal principal por vendedor. Cada vendedor possui uma sessão
isolada, conecta o próprio WhatsApp em **Meu WhatsApp** e usa a Central de
Atendimento existente. A Ana continua sendo a única autoridade de automação:
o WA-AKG transporta mensagens, mas não decide resposta, cadência, lead,
transferência ou etapa do funil.

## O que acontece automaticamente

1. Ao criar um vendedor, o backend cria a conta e a integração individuais e
   coloca o provisionamento em uma fila idempotente.
2. O worker cria a sessão no servidor WA-AKG, desliga o bot interno do gateway,
   registra o webhook assinado e inicia a sessão.
3. O vendedor abre **Meu WhatsApp**, lê o QR Code ou usa o código de pareamento
   e valida a conexão.
4. Somente depois de o provedor confirmar a sessão é possível ativar o canal.
5. Com canal e Ana ativos, entradas chegam à Central; a Ana responde apenas
   quando as políticas publicadas permitem. Atendimento humano, opt-out, pausa,
   horário comercial e limites continuam prevalecendo.

## Configuração do administrador

Em **Configurações > Canais > WA-AKG**, informar:

- nome do canal;
- URL HTTPS do servidor WA-AKG;
- chave de API global.

A URL deve estar previamente incluída no segredo de ambiente
`WA_AKG_ALLOWED_ORIGINS`. A chave global, o identificador da sessão e o segredo
do webhook ficam somente no Vault/backend; nunca são devolvidos ao navegador.

O servidor WA-AKG é um serviço Node.js persistente, com banco próprio e sessão
Baileys. Ele não pode ser executado dentro de uma Edge Function de curta duração.
É necessário hospedá-lo separadamente com HTTPS estável antes da homologação
de QR, entrada e saída reais.

## Gerenciamento simples

- **Meu WhatsApp**: provisionar, conectar, atualizar status, reconectar,
  desconectar, pausar e ativar a conta do próprio vendedor.
- **Configurações > Canais**: configurar o gateway e ajustar ritmo da organização.
- **Central de Atendimento**: visualizar conversas, assumir atendimento e enviar
  respostas humanas pelo número vinculado ao vendedor.
- **Botão de emergência**: desativar o canal fecha entrada, saída e automação.

## Proteções aplicadas

- atraso persistido e aleatório entre 10 e 30 segundos por sessão;
- limite padrão de 3 mensagens por janela de 60 segundos e 100 por dia;
- idempotência e reserva antes do envio;
- nenhum retry cego de `POST` quando o resultado remoto for incerto;
- webhook com HMAC SHA-256 sobre o corpo bruto, limite de tamanho e deduplicação;
- isolamento por organização, vendedor, conta e sessão;
- grupos, broadcasts e eco da própria sessão são ignorados;
- bot, agendador e broadcast nativos do WA-AKG ficam desativados;
- segredos restritos ao backend e tabelas de fila inacessíveis ao navegador.

Esses mecanismos reduzem risco operacional, mas não garantem que uma conta não
será restringida pelo WhatsApp. O uso deve respeitar consentimento, opt-out e as
políticas da plataforma.

## Homologação necessária

O código e o banco podem ser publicados com tudo desligado. Para declarar o
fluxo real homologado ainda é necessário:

1. implantar o servidor WA-AKG persistente;
2. configurar `WA_AKG_ALLOWED_ORIGINS` no Supabase;
3. salvar URL e chave pelo painel administrativo;
4. provisionar um vendedor e parear o QR;
5. ativar o canal e executar uma conversa controlada de saída e retorno;
6. confirmar mensagem, recibo, Central, Ana e transferência humana sem duplicação.
