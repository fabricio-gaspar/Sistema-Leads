# Ativação WA-AKG orientada por permissões

## Objetivo

Quando a sessão WA-AKG privada de um usuário for confirmada como conectada, disponibilizar automaticamente o canal e as ferramentas que as permissões já existentes permitem, sem elevar permissões, alterar a política global da empresa ou habilitar a Ana por inferência.

## Contexto comprovado

- A conta individual e sua integração possuem estados próprios de conexão, habilitação e pausa.
- A política `messaging_provider_controls` é compartilhada por organização e provedor. Ela é um teto administrativo para entrada, respostas humanas e automação; não pode ser acionada por um pareamento individual.
- O CRM já autoriza canais por `channels.view_own` e `channels.connect_own`, e respostas por `conversations.reply_all` ou `conversations.reply_assigned`.
- O webhook de conexão pode não chegar na restauração de uma sessão; o worker já reconcilia o estado após confirmação direta do gateway.

## Decisão

1. O worker de conexão consultará a situação ativa do proprietário da conta e as permissões existentes dele.
2. Depois de confirmação direta de conexão, ele habilitará conta e integração somente se o proprietário estiver ativo e puder ver/conectar o próprio canal.
3. O acesso à Central e o envio humano continuarão sendo protegidos pela verificação de permissão já aplicada em cada ação. Parear um aparelho não cria, altera nem contorna permissões.
4. Os controles globais continuam como teto:
   - entrada só é processada se o administrador deixar a entrada global liberada;
   - resposta humana só é permitida se o usuário tiver permissão de resposta e o envio global estiver liberado;
   - Ana só pode operar se a política global e as regras da Ana forem explicitamente liberadas.
5. Uma conta sem proprietário ativo, sem permissão de canal, com sessão ambígua ou fora da organização permanece desabilitada e pausada.

## Fluxo

```
gateway confirma CONNECTED
  -> worker valida session_id isolado
  -> worker consulta proprietário ativo e permissões de canal
  -> elegível: conta/integracao habilitadas
  -> não elegível: conta/integracao permanecem bloqueadas
  -> Central e respostas avaliam RBAC atual em cada operação
  -> política global limita entrada, envio e Ana para toda a empresa
```

## Fora de escopo

- Não alterar papéis, overrides ou permissões de membros.
- Não ativar Ana automaticamente.
- Não modificar os controles globais ao conectar uma conta.
- Não gerar QR, conectar ou desconectar dispositivos automaticamente.
- Não enviar mensagens como efeito da ativação.

## Erros e reversão

- Falha para ler membro ou permissão deixa a conta bloqueada; nunca há liberação por falha.
- A desconexão segue desabilitando e pausando a conta.
- O administrador pode pausar o canal ou fechar o teto global imediatamente pelas ações existentes.
- Reverter a mudança remove apenas a promoção automática; não desconecta aparelhos nem apaga histórico.

## Critérios de aceite

1. Vendedor ativo com `channels.view_own` e `channels.connect_own` conecta a sessão e a conta/integracao ficam habilitadas automaticamente.
2. Usuário sem uma dessas permissões, inativo ou de outra organização não é habilitado.
3. A política global não é modificada pela conexão.
4. Usuário com permissão de resposta usa a Central somente quando o teto global de envio também permite; quem não tem essa permissão continua bloqueado.
5. A Ana permanece desligada sem liberação administrativa explícita.
6. O teste cobre webhook e reconciliação por leitura direta do gateway.

## Estado operacional atual

A sessão anteriormente ligada a um dispositivo com final diferente do número esperado foi desvinculada. A conta, histórico e configuração foram preservados; entrada, envio humano e Ana estão desligados. O próximo pareamento deve ser feito pelo telefone autorizado, e a confirmação do final do número deve preceder qualquer teste de entrada.
