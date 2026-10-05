# Revisão independente final — R2

Data: 2026-10-05. Revisor: frente de segurança R1, distinta da autora R2. Modalidade: leitura do produto congelado, teste adversarial e evidências locais existentes; nenhum arquivo de produto alterado e nenhum teste remoto/SQL adicional executado nesta revisão.

## Conclusão

**Delta solicitado aprovado na revisão independente.** O problema apontado anteriormente no provisionamento manual WA-AKG foi corrigido: a sequência inteira deixou de compartilhar um único checkpoint e agora recebe `LifecycleStep`, revalidando autorização/revisão antes de create → configureSafety → registerWebhook → start, além das gravações subsequentes. Não encontrei novo bloqueio crítico nos componentes R2 inspecionados. Isso não constitui homologação global, de gateway ou liberação para produção.

| Verificação | Evidência examinada | Conclusão |
|---|---|---|
| Corte no meio do provisionamento | `supabase/functions/wa-akg/index.ts`, função `provision` e sua chamada em `runAccountLifecycle` | Cada nova etapa remota usa `step(..., true)`; configuração/secret/estado persistente também são cercados |
| Teste do contraexemplo original | `supabase/tests/evolutionGoHandler.test.ts`, `R2-HTTP-11` | Retém resposta do primeiro create, executa deactivate, libera resposta antiga; exige exatamente uma chamada remota, HTTP 409, conta desativada e needs_review |
| Resultado da suíte de handlers | `EVIDENCIA-R2-HANDLERS.txt` | Registro existente confirma 36/36; não foi reexecutado por este revisor e usa transporte DB/HTTP simulado |
| Permissões da migration | `20261005220138_audit_r2_account_lifecycle.sql` | RPCs invoker só para service_role; PUBLIC/anon/authenticated revogados; associação ativa, organização atual, proprietário/provedor/integração e tipo de ação revalidados; operações administrativas exigem manage também no checkpoint/conclusão |
| Resultado velho e falha de persistência | Migration e `_shared/accountLifecycle.ts` | Intenção corta flags antes do efeito; revisão+token cercam conclusão; resultado antigo não restaura enabled; erro de persistência final não vira retry do POST |
| Política global de emergência | `set_whatsapp_account_provider_controls` e handlers | Abertura exige ação administrativa explícita e conta pronta; activate não remove o kill switch global |
| Concorrência SQL | `EVIDENCIA-R2-POSTGRES.json` e `R2.md` | Registro existente: 28 sequenciais + seis disputas reais, 34/34. Espera por lock observada; snapshots antigos abortam com 40001. Não confundir com teste real de gateway |

## Limites confirmados, não resolvidos por R2

1. **Recuperação manual ainda não implementada:** needs_review e token in_flight órfão não possuem expiração/reset automático. `Atualizar` não reconcilia o gateway. A conta permanece bloqueada; a futura ação administrativa deve confirmar o resultado externo, usar CAS, manter flags desligadas e auditar. Não apagar token nem repetir POST incerto.
2. **Provisionamento automático pertence ao R6:** workers existentes não participam deste ledger. Competição manual × automático não está homologada. A correção aqui não autoriza operar esses caminhos paralelamente; exigem integração da autoridade/exclusão mútua e teste isolado posterior.
3. **Checkpoint não cancela efeito já enviado:** revalidação protege etapas seguintes e conclusão local. Um POST já despachado continua podendo terminar externamente; não há transação distribuída ou token de cercamento imposto pelo gateway. Resultado incerto permanece bloqueado/revisão, em vez de assumir rollback do provedor.
4. **Compatibilidade integrada:** publicação futura exige migration anterior aos handlers, consumidores que respeitem 202/409 e workers que não restaurem enabled/paused por callback antigo (delta R3). Schema sintético e transporte simulado não substituem clone completo, QR, reconciliação humana e homologação externa consentida.

Esses limites estão coerentes com `R2.md`. Mantém-se o parecer de remediação **local** dos riscos-alvo; não há GO comercial global, publicação, mensagem real ou alteração de cliente nesta revisão.
