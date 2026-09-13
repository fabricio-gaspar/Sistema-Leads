# Diagnóstico de mensagens

O local oficial é **Registro do Sistema → Diagnóstico**. A tela consulta o backend autenticado e
não presume funcionamento pela existência de uma configuração.

## Como interpretar

- **Fila**: `queued` aguarda o worker; `processing` está bloqueado por uma execução;
  `reconciliation_required` significa que não é seguro reenviar automaticamente.
- **Saída**: `pending` ainda não tem aceite; `sent` significa aceite do provedor; `delivered` e
  `read` só aparecem após callback correspondente; `failed` registra falha comprovada.
- **Entrada**: o último callback mostra se a mensagem foi aceita, ignorada ou falhou. Entrada de
  grupo, direção inválida ou contato ambíguo não aciona a Ana.
- **Ana**: a execução só é automática quando configuração publicada, empresa, IA, canal, worker,
  responsabilidade e autorização do contato estão válidos.

## Teste seguro

1. Em **Configurações → Canais, APIs e fontes → WhatsApp**, use **Testar envio**.
2. Informe somente um número controlado pelo operador e uma mensagem identificável.
3. Confirme no diagnóstico o aceite do provedor. Não trate aceite como entrega.
4. Para testar entrada/Ana, cadastre previamente o número como lead, confirme o canal e a
   autorização, envie uma mensagem individual do número e acompanhe entrada, `agent_runs`, fila
   e saída.
5. Interrompa se houver ambiguidade de matching, `reconciliation_required`, opt-out ou handoff.

O teste direto do canal não cria lead, não movimenta Kanban e não prova o fluxo de entrada/Ana.

## Recuperação

- Jobs com identificador do provedor e erro `provider_accepted_reconciliation_required` são
  finalizados localmente pelo worker; a rotina não chama a Z-API e não reenvia conteúdo.
- Estados sem identificador externo permanecem bloqueados para investigação manual.
- Segredos, headers e payloads sensíveis nunca são exibidos no diagnóstico.

