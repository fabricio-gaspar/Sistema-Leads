# WA-AKG — sincronização privada de contatos

## Objetivo

Ao confirmar o pareamento de uma conta WA-AKG, importar a agenda daquela sessão para o diretório privado da própria conta. O titular lê somente o próprio diretório; a gestão administrativa pode selecionar uma conta para revisão. A Central continua sem expor uma conta de vendedor a outro vendedor.

## Contrato confirmado

- O gateway disponibiliza `GET /api/sessions/{session}/crm-sync` pelo guard autenticado.
- A resposta contém `contacts` com `agendaName`, `whatsappName`, `publicName` e `remoteJid`; a leitura é limitada pelo próprio gateway e não envia mensagens.
- O CRM já possui `whatsapp_contact_directory`, `whatsapp_sync_state` e `apply_whatsapp_directory_name`.

## Sequência

1. Adicionar leitura tipada e limitada de `crm-sync` ao adaptador WA-AKG.
2. Persistir somente contatos pessoais válidos, por organização e conta, com estado/auditoria de sincronização sem payload integral.
3. Executar sincronização após confirmação de conexão e permitir atualização explícita pelo titular ou administrador.
4. Expor o diretório por RPC com autorização: conta própria + `channels.view_own`, ou administração de canais/configuração. Sem acesso direto da tabela para o browser.
5. Exibir o diretório na Central; administração escolhe a conta, vendedor não escolhe outra conta.
6. Cobrir parser, autorização, isolamento e estados de erro; validar Edge, frontend e migration antes de deploy.

## Não objetivos

- Não sincronizar grupos, histórico completo, mídia, mensagens ou contatos de outras contas.
- Não expor segredos, QR, JIDs brutos ou a agenda no browser além da conta autorizada.
- Não enviar mensagens, ativar Ana ou modificar a sessão durante a sincronização.
