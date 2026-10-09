# WA-AKG — vínculo de dispositivo do WhatsApp

## Objetivo

Permitir que um administrador desconecte somente o dispositivo WhatsApp de uma conta individual WA-AKG, preserve a conta e todo o histórico no CRM e conecte outro dispositivo por QR Code em seguida.

## Escopo aprovado

- A conta individual, os contatos, as conversas, as mensagens, as permissões e os limites do CRM permanecem preservados.
- A tela de Canais passa a apresentar as ações explícitas **Desconectar dispositivo** e **Conectar dispositivo**.
- O QR Code somente fica disponível depois de o gateway confirmar que a sessão está pronta para pareamento.
- Recebimento, respostas humanas e Ana permanecem bloqueados durante a troca de dispositivo. O fluxo não envia mensagens nem liga a Ana.

## Fora de escopo

- Excluir usuário, conta WA-AKG, histórico, contatos ou dados de CRM.
- Criar uma segunda conta ou sessão para o mesmo vendedor.
- Liberar automaticamente envio, recebimento ou Ana após pareamento.
- Repetir automaticamente logout, conexão ou QR diante de timeout/resultado ambíguo.

## Estado atual e risco tratado

O frontend tem comandos de sessão e QR, mas o estado atual pode entrar em revisão administrativa quando o gateway não responde. O gateway local está protegido por um túnel temporário e a origem anterior falhou. O novo fluxo deve tratar uma operação externa incerta como pendente de revisão, e não como desconectada ou conectada.

## Arquitetura proposta

```text
Administrador
  -> painel WA-AKG
  -> Edge Function wa-akg (autorização + lifecycle durável)
  -> gateway WA-AKG (logout/start/status/QR)
  -> Edge Function confirma e devolve estado público
  -> painel atualiza a conta, sem expor segredos
```

### Ação: Desconectar dispositivo

1. O administrador confirma a intenção na tela.
2. O backend inicia uma operação de lifecycle, fecha os gates locais de recebimento, envio e Ana e registra a intenção auditável antes da chamada remota.
3. O backend solicita logout da sessão ao gateway, sem excluir a conta WA-AKG ou seu histórico.
4. Se o gateway confirmar que a sessão não está conectada, o CRM remove somente o telefone exibido e deixa a conta em `Aguardando conexão`.
5. Se o resultado remoto for incerto, o CRM conserva os gates fechados e mostra `Requer revisão`; não tenta outro logout automaticamente.

### Ação: Conectar dispositivo

1. A ação só fica disponível para administrador e conta individual sem dispositivo confirmado.
2. O backend inicia a sessão apenas depois de validar a segurança do gateway e retorna o estado público de pareamento.
3. O painel habilita `Gerar QR Code` somente para sessão confirmada em estado de QR/pareamento.
4. A leitura do QR não abre gates de mensagens. A tela deve solicitar atualização de status e exibir o telefone confirmado antes de qualquer liberação administrativa posterior.

### Contrato e segurança

- O navegador nunca recebe URL interna, chave do gateway, segredo de webhook ou dados de outra organização.
- Todas as ações continuam vinculadas a organização, conta, proprietário e permissão administrativa existentes.
- A resposta pública diferencia `aguardando conexão`, `conectado`, `requer revisão` e `gateway indisponível`; não infere sucesso por clique ou HTTP aceito.
- O contrato mantém o lifecycle/revisão atual para operações externas incertas, com token/revisão para impedir conclusão concorrente.

## Interface

- Conta conectada: botão secundário `Desconectar dispositivo`; o texto explica que histórico e conta serão preservados.
- Conta aguardando conexão: botão primário `Conectar dispositivo`; `Gerar QR Code` fica inicialmente inativo.
- Sessão pronta para pareamento: `Gerar QR Code` fica ativo e exibe QR temporário na tela.
- Estado de revisão/indisponibilidade: ações mutáveis ficam bloqueadas; a tela oferece apenas diagnóstico seguro e uma mensagem de causa sem dados técnicos sensíveis.
- As ações atuais `Parar sessão` e `Reiniciar sessão` não devem ser expostas como substitutos de desconexão de dispositivo.

## Critérios de aceite

1. Desconectar não apaga conta, contatos, conversas, mensagens, permissões ou limites.
2. Antes do logout remoto, o canal fica localmente bloqueado para entrada, saída e Ana.
3. Após logout confirmado, não há número associado, o estado é `Aguardando conexão` e `Conectar dispositivo` está disponível.
4. `Gerar QR Code` só é habilitado após estado de pareamento confirmado pelo gateway.
5. Falha de rede ou timeout mantém o canal bloqueado e em revisão, sem nova chamada automática.
6. O novo pareamento não libera mensagens nem automação sem uma liberação explícita posterior.
7. Testes cobrem autorização, isolamento de organização, preservação do histórico, sucesso, falha/timeout e estados de UI.

## Validação e reversão

- Validar primeiro com testes unitários/contrato e gateway local, sem envio de mensagem.
- Validar o estado do gateway, da sessão e do CRM separadamente.
- A reversão de código restaura os nomes/controles anteriores; não deve desfazer um logout já confirmado no WhatsApp.
- Publicação e teste de QR no ambiente hospedado serão etapas separadas, somente após a configuração segura do gateway estar operacional.
