# Provedores, Ana e recuperação — auditoria V3

**Parecer desta frente: NO-GO para liberação comercial irrestrita de mensageria/Ana no escopo proposto.** A avaliação local reproduziu violações de emergência, transições concorrentes, retomada e recibos. A suíte normal não substitui esses cenários. Nenhuma ocorrência em cliente é inferida dos testes sintéticos. O fluxo real de QR → mensagem → resposta → Ana → recibo permanece BLOQUEADO por falta de ambiente externo isolado homologado; nenhum envio real ocorreu nesta auditoria.

Versão: checkout atual `main`, `847048429a86294aa10fa54ffdd750c04447d4fb`, em `/Users/fabriciogaspar/Documents/Codex/2026-10-04/c/Sistema-Leads-live`. Data: 05/10/2026, America/Sao_Paulo. Protocolo: `PROMPT_MESTRE_WAYFLEX_V3_AUDITORIA_COMPLETA.md`, Parte I invariantes 1–15, campanhas J05/J06/J07/J08/J09/J11/J12/J13 e Parte II 10–14/18/23. Modo AUDITORIA_E_TESTES. Os únicos arquivos criados nesta frente são este relatório, `CASOS_MENSAGERIA.csv` e evidências/testes em `EVIDENCIAS/mensageria`; nenhum produto, migration, checkpoint, credencial, serviço, branch, commit ou publicação foi alterado.

## 1. Evidência e limites

- EV-MSG-001: `EVIDENCIAS/mensageria/EV-MSG-001-vitest.txt`, execução de 12 casos, 11 falhas/1 aprovação, 18:24:54. É a versão anterior do conjunto, preservada.
- EV-MSG-002: `EVIDENCIAS/mensageria/EV-MSG-002-vitest-meta.txt`, execução final de 13 casos, **12 falhas/1 aprovação**, 18:26:19–18:26:20. Test runner Vitest 3.2.7. Código de saída 1 intencionalmente preservado.
- EV-MSG-003: `EVIDENCIAS/mensageria/EV-MSG-003-FONTES.md`, contratos oficiais e impedimentos de pesquisa.
- Matriz integrável: `CASOS_MENSAGERIA.csv`, 13 linhas, esperado/observado/modalidade/status/evidência/achado. EV-ENV-006 compartilhada: `EVIDENCIAS/EV-ENV-006-receipt-sql.json`.
- Fonte dos testes: `EVIDENCIAS/mensageria/audit.test.ts`, configuração isolada ao lado. Auth, banco e fetch são substituídos por fixtures em memória; o parser e os handlers do produto são importados sem alteração. Testes são de **unidade/contrato simulado/recuperação simulada**, nunca sandbox de provedor, Postgres real ou E2E.
- Estado remoto e comparação de bundles foram obtidos pela frente principal e devem ser lidos no EV-ENV-002. A frente principal confirmou entrypoints WA-AKG v1 e shared provider/parser idênticos aos locais, exceto shared CORS. Confirmou também worker Meta, auth, permissions, MetaCoexistenceProvider e messagingWindow equivalentes após normalização CRLF/trim; http.ts diverge. Essa ligação amplia a relevância do achado, mas não transforma simulação em incidente observado.
- O fato de não haver conta/evento WA-AKG no snapshot remoto não aprova um provedor desativado. Instalação do gateway, persistência de sessão, QR humano, TLS/rede, recuperação do processo e volume real continuam sem prova.

Comando reproduzível, executado na raiz do projeto:

```sh
/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run --config docs/auditoria/2026-10-05-v3/EVIDENCIAS/mensageria/vitest.config.ts --configLoader runner --reporter=verbose
```

A suíte isolada está fora do include da suíte padrão; a falha não foi escondida ou convertida em expectativa de sucesso. Uma primeira versão T-MSG-008 usou a tabela inexistente diretamente e exibiu `Target cannot be null or undefined`; ela foi tornada mais clara com `?? []` e verificações de `processed/duplicate_inbound` e zero chamada à Ana. A nova execução demonstrou zero mensagem após retry. Não houve ajuste de produto nem mudança do resultado esperado.

## 2. Inventário de capacidades e autoridades

| Recurso | Implementação/autoridade identificada | Capacidades locais | Implantação/homologação e lacunas |
|---|---|---|---|
| R-MSG-01 WA-AKG por vendedor | `wa-akg`, `WaAkgProvider`, `wa_akg_seller_provisioning_jobs`, `whatsapp_accounts`, Vault | Criar/provisionar, start/stop/restart/logout, QR, pairing, status, ativar/desativar; texto/imagem/áudio/vídeo/documento de saída | Functions confirmadas pela frente principal; gateway Node persistente, sessão, QR, transporte e mídia reais BLOQUEADOS. Controle administrativo mistura conta e empresa. |
| R-MSG-02 Entrada WA-AKG | `webhook-wa-akg` → `wa_akg_webhook_events` → `wa-akg-worker` → inbox/mensagem → `ana-run` | HMAC raw body, sessão exata, hash, persistência antes de 202, fila/5 tentativas, ligação por conta | Parser incompatível com recibo oficial; perda de mídia, retomada e lease; sem prova de gateway real. |
| R-MSG-03 Evolution GO | `evolution-go`, `EvolutionGoProvider`, webhook/worker, fila de provisionamento | API Go 0.7.2; QR/pair/status/texto/mídia; eventos normalizados; LID rejeitado | Contrato versionado consultado, testes normais cobrem mocks. Versão instalada não medida. Mesma intenção administrativa pode ser aberta pelo vendedor; recebimento histórico e retry com inbox existente têm lacunas equivalentes WA-AKG. |
| R-MSG-04 Z-API | `whatsapp-accounts`, `webhook-whatsapp`, `automation-worker`, `zapiInbound` | Conta corporativa/vendedor, callback autenticado, mensagens e recibos, fila canônica, reconciliação | Logs históricos não re-homologados. Webhook ignora tudo quando gate inbound fecha, inclusive recibo. Snapshot atual não prova sessão operacional. |
| R-MSG-05 Meta Cloud/Coexistence | onboarding/mensagens/worker/webhook, `messaging_outbox`, flags, controles | Embedded Signup, HMAC, texto/template/imagem/documento; janela de atendimento; templates aprovados | Onboarding real e revisão contrato atual BLOQUEADOS; worker repete resultado incerto. Código não suporta áudio/vídeo de saída por esse adaptador, limite explícito (não imputar capacidade inexistente). |
| R-MSG-06 Despacho automático | `ana-run` decide → `outreach_jobs` → `automation-worker`; RPC de roteamento e reserva | Revalida lead/handoff/supressão, versão publicada, horário, conta e controles; pós-aceite conserva reconciliação; atraso durável WA-AKG/limites | Mecanismo server-side existe; cron/heartbeat foi verificado pela frente principal. Interrupção completa com gateway e navegador fechado não homologada. |
| R-MSG-07 Ana | `ana-run`, `ai_agents/ai_agent_versions`, catálogo/chunks, `agent_runs`, políticas/handoff | Decisão estruturada, apresentação determinística, qualificação, rascunho, tarefa/handoff, fila, proposta pendente, Google Calendar com condições | Não é apenas chat: há efeitos implementados. Qualidade com modelo real, autorização tardia de toda ferramenta e recuperação entre efeitos não aprovadas integralmente. |
| R-MSG-08 E-mail | `enviar-email`, `automation-worker` e integração email | Enfileira saída manual, provedor resolvido no backend | Imports locais de enviar-email usam layout diferente do bundle remoto; reprodutibilidade tratada pela frente principal. Carteira/perm. específica não verificadas em E2E. Recepção e recibos não encontrados nos endpoints examinados. |
| R-MSG-09 Notificações internas | `daily_lead_report_deliveries`, `handoff_whatsapp_deliveries`, automation-worker | Reservas por dia/handoff, auditoria e marcação de resultado incerto após aceite | Destinos reais, cotas e entrega não acionados. Implementação é WhatsApp e compartilha infraestrutura; desligar escopo não deve paralisar outras empresas. |

Supabase é a fonte operacional local; não há chamada ao WhatsApp pelo browser nesta cadeia examinada. Meta usa outbox própria; não assumir que todos os gates e garantias do automation-worker também existem no meta-whatsapp-worker.

Versões externas: WA-AKG tag `v1.7.0-beta.1`/main = c7dd01a, package 1.6.4 no mesmo commit; Evolution GO 0.7.2 = 9337afc; Meta Graph é configurável no segredo (versão real não lida); Z-API é serviço gerenciado sem versão instalada atestada. Lista completa, URLs e consultas em EV-MSG-003.

## 3. Cenários executados, requisito e evidência

Todos usam organização/usuário sintéticos definidos no teste, sem vínculo com cliente. Perfil de T001–003/T012: proprietário da própria conta, somente `channels.view_own`/`channels.connect_own`, sem permissão administrativa. Demais: parser puro ou worker interno simulado. Dados são reiniciados antes de cada teste e descartados no fim do processo.

| Teste | Origem/requisito e recurso | Cenário / esperado | Observado | Modalidade / status | Achado |
|---|---|---|---|---|---|
| T-MSG-001 | I.E.2/4; CIC-11; R01 | Ativar conta própria com emergência administrativa deve preservar kill switch | Gate organizacional abriu inbound/send/automation e removeu kill switch | Contrato simulado / REPROVADO | ACH-MSG-001 |
| T-MSG-002 | I.E.5; CIC-03; R01 | Provedor indisponível no disconnect; bloquear local primeiro | Erro 400; conta permanece enabled=true | Contrato de falha / REPROVADO | ACH-MSG-002 |
| T-MSG-003 | I.E.13; R01 | Falha na gravação da conta não pode produzir sucesso da ativação | Handler retorna 200 apesar do erro do banco simulado | Contrato de falha / REPROVADO | ACH-MSG-003 |
| T-MSG-004 | II.10/13; EXT01; R02 | Recibo documentado `data.keyId` reconhecido | `ignored/receipt_message_id_missing` | Unidade/contrato externo / REPROVADO | ACH-MSG-004 |
| T-MSG-005 | I.E.7; CIC-08; R02 | delivered e read mesma mensagem são eventos distintos | Ambos ID `message.status:message-synthetic` | Unidade / REPROVADO | ACH-MSG-005 |
| T-MSG-006 | II.13 identidade; R02 | LID opaco exige mapeamento explícito | `1234567890123@lid` transformado em telefone e entrada aceita | Unidade / REPROVADO | ACH-MSG-006 |
| T-MSG-007 | J09; II.14 mídia; R02 | Áudio sem texto preserva referência e revisão humana | Sanitização mantém somente motivo ignored e perde fileUrl | Unidade / REPROVADO | ACH-MSG-007 |
| T-MSG-008 | I.E.11; II.13; R02 | Falha após inbox e antes de mensagem retoma etapa faltante | Retry encerra processed/duplicate_inbound; zero mensagem, zero chamada Ana | Recuperação simulada / REPROVADO | ACH-MSG-008 |
| T-MSG-009 | I.E.10; CIC-08; R02 | Recibo de mensagem antiga reconcilia após conta desativada | Marcado ignored; RPC de conciliação não chamada | Contrato simulado / REPROVADO | ACH-MSG-009 |
| T-MSG-010 | I.E.4; CIC-12; R02 | Conexão recuperada não reativa conta | connection_status=connected, enabled continua false | Contrato simulado / APROVADO | Sem achado |
| T-MSG-011 | J13/CIC-04; R02 | Evento processing antigo recuperado após interrupção | Consulta ignora processing; estado fica preso | Recuperação simulada / REPROVADO | ACH-MSG-010 |
| T-MSG-012 | I.E.5; CIC-05; R01 | Status de activate antigo responde após deactivate; intenção nova prevalece | Activate pendente volta a enabled=true | Concorrência simulada / REPROVADO | ACH-MSG-011 |
| T-MSG-013 | II.13 resultado incerto; R05 | Timeout após possível aceite exige conciliação, sem repetir POST | Primeiro vira failed; segunda execução chama provedor novamente | Recuperação simulada / REPROVADO | ACH-MSG-012 |

Métricas SOMENTE dos 13 casos adversariais selecionados: T=13, aprovados=1, reprovados=12, bloqueados=0, não testados=0; cobertura concluída=100%, aprovação comprovada=7,69%, aprovação entre concluídos=7,69%. **Não é taxa de qualidade de todo o produto**: seleção foi orientada aos riscos identificados. Por modalidade: unidade/contrato de parser T004–007 = 4 casos reprovados; handlers/recuperação/concorrência = 9 casos (1 aprovado/8 reprovados). Não somar os testes normais de outra frente ou jornadas reais a esse denominador.

## 4. Achados reproduzidos e plano específico

Cada conclusão abaixo refere-se ao fonte testado. Confiança alta significa reprodução local determinística, não ocorrência em produção. Critério de aceite: o teste associado passa com a proteção esperada, seguido por banco e sandbox/duas empresas quando indicado.

| Achado | Severidade/confiança | Fonte exata, causa e impacto | Remediação e regressão futura |
|---|---|---|---|
| ACH-MSG-001 | P1 / alta | `wa-akg/index.ts:344,406–422`: canConnect de dono permite activate e upsert organizacional kill_switch=false/automation=true. `evolution-go/index.ts:909–910` segue padrão equivalente. Escalada da capacidade de conectar para liberar empresa. | Separar intenção admin e conexão individual; ativar conta não escreve emergência/global. T001, CIC11 e dois vendedores/duas empresas. |
| ACH-MSG-002 | P1 / alta | `wa-akg/index.ts:397–405`: stop/logout externo ocorre antes de disabled local; falha impede ponto de corte. Evolution em 832–833 também chama externo primeiro. | Persistir intenção e bloquear local antes do externo; marcar desconexão pendente durável. T002, timeout e reconciliação com provedor recuperado. |
| ACH-MSG-003 | P1 / alta | `wa-akg/index.ts:409–425`: Promise.all retorna erros Supabase como valores e nenhum é checado, seguido de auditoria de ativação e 200. Estado parcial. | Transação local e verificar todos os resultados; não registrar sucesso em falha; compensação fail-closed. T003 por falha de cada gravação. |
| ACH-MSG-004 | P1 / alta | `_shared/waAkgInbound.ts:64–66`: não lê keyId, embora contrato oficial e upstream c7dd01a o usem. Recibos válidos ignorados. | Parsear esquema versionado, fixture oficial e recibos reais isolados. T004; preservar desconhecidos para revisão. |
| ACH-MSG-005 | P2 / alta | `_shared/waAkgInbound.ts:39–42`; `webhook-wa-akg/index.ts:74–85`: identidade ignora status e upsert ignoreDuplicates descarta evolução do mesmo ID. Aplica quando gateway usa variantes key.id/data.id suportadas. | ID inclui natureza/status/identidade canônica; status monotônico no destino. T005 + duplicata idêntica + read antes de delivered. |
| ACH-MSG-006 | P1 / alta local; ocorrência real não aferida | `_shared/waAkgInbound.ts:26–28,82–87`: retira caracteres do JID sem validar domínio; ID opaco pode localizar contato errado. | Rejeitar LID sem phone alternativo autenticado, guardar identidade opaca; T006 mais domain/device JIDs e duas carteiras. |
| ACH-MSG-007 | P1 / alta | `_shared/waAkgInbound.ts:88–112`: mídia sem texto é ignored e referência some. O worker não chega à salvaguarda media_requires_review. | Persistir metadado/anexo seguro e aviso/handoff transparente antes de tentar entendimento. T007 imagem/áudio/vídeo/documento, tamanho/URL/autorização. |
| ACH-MSG-008 | P1 / alta | `wa-akg-worker/index.ts:149–164,205–210`: inbox existente significa retorno processed mesmo se message/Ana falharam. Mesmo padrão em `evolution-go-worker/index.ts:188–195`. | Persistir etapas e retomar só faltantes; transação local para inbox+mensagem ou controle equivalente; T008 e falha após mensagem/antes/depois de Ana. |
| ACH-MSG-009 | P2 / alta | `wa-akg-worker/index.ts:95–96,229–233`: recibo exige rota de envio ativa e é descartado definitivamente. Evolution 134–136, Z-API webhook 245–253 também fecham caminho histórico. | Separar auth/ownership de recibo e admissão de envio; continuar conciliação sem Ana. T009 e recibo tardio durante troca. |
| ACH-MSG-010 | P1 / alta | `wa-akg-worker/index.ts:213–217,355–356`: claim muda processing; leitor só queued/failed; sem lease/recuperação encontrado em funções/migrations WA-AKG. Provisionamento também tem lock, mas nenhuma retomada expirada demonstrada. | Lease com expiração/claim atômico e trilha de estágio; interromper após claim em sandbox, sem reenviar resultado incerto. T011. |
| ACH-MSG-011 | P1 / alta | `wa-akg/index.ts:406–433`: não existe geração/CAS entre leitura remota e gravações; resposta antiga reativa após deactivate mais novo. | Revisão monotônica por escopo, validação antes de efeito e escrita condicional. T012 e duas abas/admin+vendedor. |
| ACH-MSG-012 | P1 / alta | `meta-whatsapp-worker/index.ts:123,162–178`: timeout é failed com retry; adaptador não transmite idempotencyKey como garantia remota. T013 fez 2 chamadas simuladas iguais. | Despacho iniciado/resultado incerto em reconciliação, sem retry cego. Separar rejeição definitiva e erro de rede; regressão pós-aceite/local-write. |

Nenhuma correção foi implementada. Toda remediação exige modo explicitamente autorizado pelo usuário e deve começar pelas invariantes de isolamento/emergência, depois retomada/contrato e apenas então homologação externa.

## 5. Achados estáticos adicionais — não contabilizados como teste executado

### ACH-MSG-013 — contrato de segurança do gateway incompatível

P1, confiança alta sobre incompatibilidade de enum, integração real pendente. `WaAkgProvider.ts:247–252` envia `autoReplyMode: DISABLED`; EXT01/03/04 aceitam AccessMode OWNER/SPECIFIC/BLACKLIST/ALL. O handler upstream passa diretamente ao Prisma. Provisionamento chama configureSafety antes do webhook/start (`wa-akg/index.ts:220–230`, worker:294–301), portanto a rejeição impede completar o fluxo. O teste normal apenas confere o payload que o próprio adapter envia; não valida aceitação upstream. Critério: fixture contra schema da tag instalada, chamada segura em gateway isolado e confirmação de bot/auto-reply realmente inativos. O package/tag divergente é documentado, não tratado sozinho como defeito.

### ACH-MSG-014 — repetir provisionamento pode duplicar webhook

P2, confiança alta na análise estática. `wa-akg/index.ts:221–229` e `wa-akg-worker/index.ts:293–301` sempre chamam registerWebhook; `WaAkgProvider.ts:267–281` faz POST sem guardar ID/listar/atualizar. EXT05 cria novo registro a cada POST. O campo remote_created evita nova sessão em parte dos retries, mas não evita novo webhook. Critério: provisionar duas vezes no mesmo gateway de sandbox, apenas um webhook ativo, idempotência mesmo entre POST aceito e persistência perdida.

### ACH-MSG-015 — namespace de sessão omite empresa

P1 condicional, confiança alta sobre colisão determinística; nenhum vazamento real demonstrado. `wa-akg/index.ts:27–29` e migration `20261005005823_wa_akg_provider_foundation.sql:175` usam apenas user UUID. Duas organizações da mesma identidade no mesmo gateway (fallback global autorizado em `corporateCredentials/globalCredentials`) produzem o mesmo sessionId. O 409 é tolerado e webhook é registrado sobre a sessão encontrada. Critério: duas organizações sintéticas com o mesmo usuário e gateway compartilhado recebem sessões e callbacks independentes; namespace incluir organização/conta, migração explícita e sem assumir que uma sessão já existente pertence à empresa.

### ACH-MSG-016 — tool de agenda executa antes da barreira tardia de handoff

P1, confiança média por inspeção, reprodução integrada pendente. `ana-run/index.ts:923–931` chama scheduleGoogleMeeting; essa função consulta/cria Google Calendar em 565–605. Só em 1056–1061 a gravação do lead exige ai_paused=false/modo IA/opt_out=false/contexto atual. Handoff ocorrido durante a resposta do modelo pode ser detectado tarde, após efeito externo. Gate global/versão de configuração também não é reconsultado dentro da função antes do POST. Critério: pausar/assumir/cancelar reunião enquanto modelo/freeBusy está suspenso em mock e provar zero POST subsequente, com efeitos já iniciados conciliados. Não houve chamada ao Google nesta auditoria.

### ACH-MSG-017 — qualificação schema de COALESCE na RPC de recibos

P1, confiança alta, **confirmado por diagnóstico remoto somente leitura da frente principal (EV-ENV-006)**. A migration WA-AKG substitui `public.reconcile_whatsapp_receipt(uuid,text[],integer,text,timestamptz)` e usa `pg_catalog.coalesce` na inicialização de v_at (linha 467), validação (470), filtros (481/489) e updates (520+). `pg_get_functiondef` confirmou a mesma expressão no corpo da RPC implantada; `select pg_catalog.coalesce(null::timestamptz, now())` retornou SQLSTATE 42883, função inexistente. COALESCE é forma SQL especial. A inicialização falha antes da conciliação; o contrato é compartilhado com Z-API/Evolution/WA-AKG. Nenhuma RPC operacional foi chamada. Aceite futuro: remover qualificação inválida em remediação, comparar corpo aplicado e executar recibo sintético sob rollback. Não somar esse diagnóstico remoto aos 13 mocks.

### Lacunas da Ana e consumo

- Políticas novas `commercial_catalog_policy` (catalogEnabled/productsForAna/servicesForAna/automaticSendEnabled) não são consumidas em `supabase/functions`; `ana-run` usa outra fonte (`company_settings.ui_settings.knowledge_usage`). Achado compartilhado com frente de produto para evitar contagem duplicada.
- `knowledgeUsage` controla catálogo/imagens/serviços, mas knowledge_chunks e semanticKnowledge são montados em 857–864 sem filtrar a política documents/sources; investigar retirada de fonte e chunks antigos com fixture. Inspeção indica possibilidade de conhecimento desativado ainda entrar no modelo, não prova resposta real.
- O prompt trata conteúdo recuperado como dado e parseDecision restringe ações/estágios; regras locais obrigam revisão humana para conteúdo comercial sensível. Proteções de prompt não equivalem à autorização de tools. Injeção direta, indireta em PDF e trocas de contexto reais de modelo estão BLOQUEADAS sem sandbox/cota.
- Não foi encontrada reserva de orçamento financeiro/token por empresa em `ana-run`; há max_tokens Claude e limites de contexto. Custo/justiça sob saturação permanece NÃO TESTADO. Presença de limites WA-AKG não limita cobrança de IA.
- `agent_runs` usa idempotência e rejeita execução running repetida; recuperação de running abandonado não foi demonstrada. Várias gravações após decisão são sequenciais e não há atomicidade entre qualificação/mensagem/outbox/tarefa. Falhas em cada fronteira exigem novos casos.

## 6. Jornadas e interrupções

| Jornada | Trilha examinada | Resultado com modalidade e limite |
|---|---|---|
| J05 | Conta individual → permissões → status/QR → activate | REPROVADO no contrato T001–003/T012; QR real, consentimento, pareamento e reinstalação BLOQUEADOS. Verificação de conta de outra empresa não executada aqui. |
| J06 | Webhook HMAC → ledger → inbox → mensagem → Ana → fila → recibo | REPROVADO localmente em T004–009; assinatura/campo sessão inspecionados. Caminho completo com ID remoto e resposta real BLOQUEADO. |
| J07 | Handoff → CAS do lead → worker final safety → retomada | PARCIAL de implementação; suíte normal cobre handoff pré-despacho. Interrupção antes da ferramenta de agenda identificada ACH016; corrida com mensagens humanas, transferência e dois workers NÃO TESTADA em banco. |
| J08 | E-mail e alertas internos → fila → dispatch | Inspeção estática parcial. Auth da carteira de enviar-email e import layout encaminhados à frente principal. Entrega/recepção/quotas reais BLOQUEADAS. |
| J09 | Base aprovada → contexto → mídia/catálogo → handoff | REPROVADO T007 para WA-AKG sem legenda; entendimento real de mídia/LLM BLOQUEADO. Evolution preserva aviso textual de revisão; arquivo completo permanece pendente. |
| J11 | Ativar/desativar/desconectar → intenção → recurso exclusivo | REPROVADO T002/T003/T012. `deactivate` preserva sessão explicitamente: equivale a pausa local, não desligamento integral pedido pelo protocolo. |
| J12 | Troca → corte → fila antiga → recibos → nova autoridade | REPROVADO T009/T012/T013 no nível local; ativação simultânea de dois provedores com o mesmo número e compensação remota NÃO TESTADAS. Sem plano durável de transição demonstrado. |
| J13 | Cron → worker → interrupção → retomada | REPROVADO T008/T011/T013. Heartbeat server-side é evidência da frente principal; operação ponta a ponta navegador fechado BLOQUEADA sem gateway/fixture sandbox. |

Interrupções realmente simuladas: após persistência da inbox antes de lead_messages; depois de claim processing; timeout depois de possível aceite Meta; status remoto pendente de ativação enquanto chega nova desativação. Em todos, nenhuma chamada real estava em andamento. “Possível aceite” é hipótese controlada da fixture; zero resultados externos reais incertos foram produzidos.

## 7. Matriz CIC desta frente

Não somar esta matriz aos 13 casos: CIC agrega requisitos e remete às mesmas provas. Status parcial é descrito em texto; status de cada teste segue APROVADO/REPROVADO/BLOQUEADO/NÃO TESTADO.

| CIC | Resultado de mensageria/Ana | Prova / lacuna |
|---|---|---|
| 01 | NÃO TESTADO end-to-end | Worker tem guardas; reserva WA-AKG já existente retorna antes de rever gates (migration:294–303). Medir corte atômico em SQL/dispatch futuro. |
| 02 | NÃO TESTADO dinâmico; risco estático ACH016 | Resposta tardia, handoff e ferramentas: testar CAS antes de agenda e demais efeitos. |
| 03 | REPROVADO | T002: conta fica ativa com provedor indisponível. |
| 04 | REPROVADO no consumidor | T011: processing não recupera. Restart do gateway real BLOQUEADO. |
| 05 | REPROVADO | T012: resposta antiga vence intenção nova. |
| 06 | NÃO TESTADO contra gateway; incompatibilidade estática | ACH013/014: enum inválido e POST de webhook repetível. |
| 07 | NÃO TESTADO | Interdependência de duas empresas/mesmo gateway e cascata de módulos exige sandbox. ACH015 identifica colisão. |
| 08 | REPROVADO | T004/T005/T009; RPC compartilhada ACH017. |
| 09 | NÃO TESTADO completo | Worker revalida lead/config, mas não há prova de política de idade/backlog para todos os caminhos. |
| 10 | NÃO TESTADO completo | APIs exigem permissões; flags comerciais e módulo ausente precisam matriz backend/dados, sob frente segurança/produto. |
| 11 | REPROVADO | T001. Atendente pode remover gate administrativo organizacional pela própria ativação. |
| 12 | APROVADO no handler WA-AKG simulado | T010. Não estender para todos os provedores nem para refresh_status concorrente. |
| 13 | NÃO TESTADO concorrência real | Contas possuem rota backend explícita; mesma identidade externa e transição entre provedores não homologadas. |
| 14 | BLOQUEADO | Logout remoto/consentimento revogado exige gateway/test account; UI/código distinguem QR e desconexão, sem prova operacional. |
| 15 | NÃO TESTADO dinâmico; lacuna estática | Políticas do catálogo divergentes e ferramenta de agenda sem revalidação tardia; teste de solicitação maliciosa do modelo pendente. |
| 16 | BLOQUEADO para ciclo integral | Opcionalidade geral dos módulos não possui ambiente isolado demonstrado. Demais frentes inventariam módulos fora da mensageria. |

## 8. Segunda passagem crítica e aceite

Foi realizada segunda passagem após os testes para excluir extrapolações: o package 1.6.4 e tag beta pertencem ao mesmo commit (não declarar erro somente pelo número); imports locais de enviar-email podem ser rearranjados no bundle remoto (não declarar função publicada indisponível); as 12 falhas são locais/simuladas; nenhuma prova de vazamento real, entrega duplicada real ou uso indevido real foi produzida.

Os testes existentes da Evolution aceitam expressamente que ativação do vendedor abra gate global. Isso é um conflito entre teste atual e requisito V3, não razão para alterar silenciosamente o requisito. Política de emergência precisa autoridade administrativa inequívoca antes de liberação.

Recursos preservados: histórico, Vault, contas, sessões e filas reais; nada foi desativado nem ativado. Limpeza: apenas memória do processo de teste, sem registros sintéticos remotos a remover. Os fixtures e saídas permanecem como evidência local. Nenhum processo ou disparo de teste ficou pendente.

Próxima etapa verificável, quando remediação for explicitamente autorizada: reparar gates e transições (001–003/011), contrato/identidades (004–007/013–015), inbox/leases e resultado incerto (008–010/012), revalidar ferramentas (016) e RPC de recibos (017). Rodar casos originais, regressão normal, transações rollback em banco isolado e então gateway sandbox, com empresa/conta/destino/cota declarados. Homologar cada provedor liberado; os demais permanecem fora do escopo comercial homologado. Nenhuma publicação é consequência automática deste relatório.

## 9. Revisão cruzada independente de segurança

Tentativa de refutação de dois achados relevantes de `SEGURANCA_E_ACESSOS.md`, por leitura de código e evidência já coletada, sem novo teste remoto: **ACH-SEC-001** — a hipótese de que as policies phase2 restringiriam a policy antiga não se sustenta. A migration `20260909232713_restore_message_proposal_rls_base.sql:1–16` declara `org_active_access` como permissive/ALL; o snapshot remoto EV-SEC-001 mantém essa regra em proposals ao lado das regras phase2. A prova isolada EV-SEC-004 T-SEC-002/003 reproduz leitura e DELETE entre carteiras da mesma empresa, enquanto T-SEC-007 nega outra empresa. Isso confirma o escopo intraempresa, não um vazamento entre empresas; não extrapolar para lead_messages, cuja política foi alterada depois. **ACH-SEC-006** — a hipótese de existir autorização global ou guarda multiorganização antes do reset também não se sustenta: `team-members/index.ts:472–476` exige apenas `team.manage` da empresa ativa, 647–650 verifica a associação local, e 708–712 altera a senha Auth global. A proteção de outra organização em 851–854 só é alcançada na remoção, após os retornos das ações de reset/update. EV-SEC-005 T-SEC-013 registra a chamada global e resposta 200 em fixture de duas empresas. Mantida severidade P1 condicional à identidade compartilhada, sem afirmar exploração real: inventário atual da outra frente não encontrou identidades multiorganização. Nenhum segredo foi lido, senha alterada ou registro de cliente consultado por esta revisão. Em sentido inverso, a frente de segurança confirmou independentemente ACH-MSG-001/015/017, com os mesmos limites, registrado em EV-SEC-008.
