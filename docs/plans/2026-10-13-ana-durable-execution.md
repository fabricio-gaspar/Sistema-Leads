# Ana — execução durável e ordenada

## Contexto

O diagnóstico de `ana-run` confirmou que a entrada WA-AKG possui deduplicação
e que os efeitos comerciais têm proteções individuais. Ainda assim, uma
execução podia ficar em `running`, um segundo evento do mesmo lead podia usar
a mensagem de entrada mais recente em vez da mensagem que o disparou, e a
chamada direta do webhook não oferecia fila durável nem recuperação controlada.

## Decisões aprovadas neste lote

1. Registrar cada comando da Ana em uma fila server-side por organização e
   lead; somente o item mais antigo pendente de um lead pode receber lease.
2. Persistir lease, tentativa, próxima execução e estado terminal. Falhas sem
   efeito comercial confirmado podem receber retry limitado; resultados
   ambíguos vão para revisão, nunca para reenvio cego.
3. Fazer a execução trabalhar pela mensagem persistida (`lead_messages.id`),
   não por uma busca pela última mensagem recebida.
4. Registrar uma auditoria de efeito por ação comercial antes/depois da
   execução, para tornar retomadas e investigação rastreáveis.
5. Restringir fallback de FreeLLM para indisponibilidade transitória ou uma
   política explícita da organização; credencial/configuração inválida não
   deve acionar provedor pago silenciosamente.
6. Produzir explicitamente `stage.changed` e `meeting.done` onde a alteração
   ocorre, preservando `ana-run` como única autoridade de automação.

## Limites deste lote

- Sem publicação de Edge Functions, aplicação de migration, alteração de
  credenciais, QR, canal, dados de clientes ou mensagens reais.
- Processamento de mídia, modelos locais e resumos longos de conversa não
  pertencem a esta correção de execução; ficam como evolução separada depois
  de homologar a fila.

## Ordem de implementação

1. Migration: filas, leases, efeitos e funções atômicas de enfileirar,
   reclamar, concluir e falhar.
2. Funções compartilhadas: contrato interno de despacho para a fila.
3. `inboundWork`: persistir, enfileirar e acordar o worker, sem chamar a Ana
   de forma síncrona como confirmação de processamento.
4. `ana-worker`: reclamar o próximo job, invocar `ana-run` com o lease e
   concluir, reagendar ou mandar para revisão conforme a resposta.
5. `ana-run`: validar o job/lease, carregar a mensagem exata, registrar
   efeitos e marcar somente falhas seguramente retentáveis.
6. Testes unitários/contratuais e verificação estática; homologação com
   telefone próprio continua requisito externo.

## Aceite mínimo

| ID | Requisito | Evidência planejada | Situação |
|---|---|---|---|
| AC-ANA-01 | Uma mensagem gera um job idempotente | migration e teste de contrato criado | IMPLEMENTADO — requer aplicação/homologação do banco |
| AC-ANA-02 | Dois eventos do mesmo lead são processados em ordem | fila com barreira FIFO por lead | IMPLEMENTADO — requer teste SQL integrado |
| AC-ANA-03 | Lease vencido pode ser recuperado sem duplicar efeito | lease, reaper e efeito idempotente | IMPLEMENTADO — requer teste SQL integrado |
| AC-ANA-04 | Falha ambígua fica em revisão e não reenvia mensagem | teste de worker criado | IMPLEMENTADO — execução Vitest local bloqueada pelo Rollup |
| AC-ANA-05 | `ana-run` usa a mensagem indicada pelo job | teste handler criado | IMPLEMENTADO — execução Vitest local bloqueada pelo Rollup |
| AC-ANA-06 | Fallback de IA respeita política e erro transitório | regra de roteamento estática | IMPLEMENTADO — requer teste de integração de provedores |
| AC-ANA-07 | Contato protegido continua sem automação | gates existentes preservados | PENDENTE — requer regressão com banco aplicado |

## Política de eventos

`stage.changed` e `meeting.done` passam a ser produzidos como eventos de
auditoria no banco. Eles não iniciam mensagens automáticas: uma mudança de
Kanban ou a conclusão de reunião não equivale a consentimento para a Ana
contatar o lead. Qualquer automação futura a partir desses eventos deverá ter
uma política publicada e uma aprovação humana/organizacional explícita.
