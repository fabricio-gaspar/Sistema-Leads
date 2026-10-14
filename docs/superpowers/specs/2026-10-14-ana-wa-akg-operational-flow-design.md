# Fluxo operacional da Ana com WA-AKG

## Objetivo

Tornar o fluxo operacional do WayFlex previsível, seguro e observável usando
somente WA-AKG para novos eventos de WhatsApp. A Ana deve processar somente
leads explicitamente autorizados, uma vez por evento, por uma fila durável e
auditável. Contatos protegidos, não classificados ou sem prova suficiente
continuam visíveis na Central para atendimento humano, mas não podem acionar
automação.

Esta especificação não altera o significado de histórico existente nem autoriza
envios reais durante os testes.

## Contexto confirmado

- O caminho pretendido é `webhook-wa-akg` → `wa-akg-worker` → persistência de
  inbound → fila da Ana → `ana-run` → outbox/worker de saída.
- A migração local `20261013213000_ana_durable_execution_queue.sql` já define
  `ana_jobs`, `ana_effects`, leases, retry limitado, idempotência e grants
  exclusivos de servidor, mas a presença desses objetos ainda precisa ser
  confirmada no banco publicado antes do deploy dos workers.
- O código atual pode dispensar a exigência de aprovação para
  `message.received`. Isso conflita com a proteção de contatos da agenda.
- Há uma agenda de prospecção ativa com filtros sem cidade válida. Ela falha
  depois de iniciar o ciclo; nenhuma cidade, UF ou termo será inferido a partir
  do endereço cadastrado.
- Z-API e Evolution GO estão bloqueados em dados/controles, mas ainda existem
  funções e caminhos legados implantados. Histórico, migrations já aplicadas,
  auditoria e recibos não serão apagados.

## Escopo aprovado

1. Fazer WA-AKG ser o único provedor selecionável para novos eventos,
   atendimentos e saídas.
2. Aplicar a fila durável antes de qualquer função que dependa dela.
3. Impedir, no servidor, que mensagem recebida autorize Ana por si só.
4. Preservar mensagens de contatos protegidos e não classificados na Central,
   em modo humano e sem job automático.
5. Corrigir a execução de agenda inválida para falhar uma vez, de forma
   acionável e sem chamada a Apify, criação de lead ou gasto externo.
6. Tornar a rota real de IA explícita: FreeLLMAPI primário; fallback pago
   desligado até autorização administrativa auditável.
7. Expor saúde operacional agregada da fila, dos gates e da agenda, sem
   segredos, conteúdo de mensagens ou telefones.
8. Aposentar Z-API e Evolution GO de forma reversível e preservando dados.

## Fora de escopo

- Gerar QR, reconectar ou desconectar um dispositivo WA-AKG.
- Enviar mensagens reais, reprocessar callbacks antigos ou ativar campanhas
  como teste.
- Promover contatos existentes em massa, alterar aprovações históricas ou
  criar leads por inferência.
- Apagar migrations históricas, conversas, recibos, auditoria, integrações ou
  funções remotas sem uma janela posterior de retenção aprovada.
- Definir cidade, UF, termo comercial ou orçamento de prospecção sem uma
  decisão explícita do administrador.

## Decisão de arquitetura

### 1. Canal único e resolução de conta

Todos os novos caminhos de inbound, resposta humana, Ana e worker de saída
aceitam somente `wa_akg`. A resolução server-side identifica a conta WA-AKG
autorizada para o lead e para o proprietário do canal; ela não exige uma conta
corporativa quando o canal conectado for individual e autorizado.

Antes de enfileirar uma saída, o servidor confirma organização, conta,
proprietário, integração, conexão, controles de entrada/saída/automação e
kill-switch. Uma resposta aceita pela fila não é exibida como entregue até um
recibo do provedor confirmar esse estado.

Z-API e Evolution GO deixam de ser rotas operacionais:

- os controles e integrações legados ficam permanentemente fail-closed;
- as funções legadas retornam resposta de aposentadoria sem acessar dados,
  acionar gateway ou criar jobs;
- o frontend e diagnósticos deixam de oferecer ações ou status desses
  provedores;
- dados e logs históricos permanecem somente para leitura e auditoria.

### 2. Política única de contato antes da automação

Uma política server-side única será consultada no mesmo fluxo transacional que
persiste o inbound e decide o dispatch. Ela combina a classificação da agenda,
o vínculo WA-AKG, o estado de aprovação e o modo de atendimento do lead.

| Estado | Mensagem na Central | Ana / cadência / saída automática |
| --- | --- | --- |
| `agenda_protected` | Persistida; atendimento humano | Bloqueada |
| `unclassified` ou diretório ausente | Persistida; requer decisão humana | Bloqueada |
| `lead_authorized` + aprovação registrada + modo IA | Persistida | Elegível, após todos os demais gates |
| lead sem vínculo de agenda, mas não aprovado | Persistida | Bloqueada |

Receber uma mensagem nunca muda a classificação para `approved`. A promoção
continua explícita: **Tornar lead** autoriza o contato, inicia em modo humano e
só permite Ana após nova ativação autorizada. Handoff, retorno ao modo IA,
cadência, catálogo e qualquer efeito da Ana relêem esta política imediatamente
antes do efeito.

### 3. Fila durável e efeitos idempotentes

O contrato operacional é:

```text
Webhook WA-AKG assinado
  → persistir mensagem e decisão de contato
  → elegível? enqueue_ana_job idempotente : registrar motivo e parar
  → worker reivindica lease por lead
  → ana-run relê política, contexto e histórico
  → efeito fence + outbox idempotente
  → recibo do canal atualiza status de entrega
```

`ana_jobs` é a unidade de execução. Cada job tem chave idempotente por evento e
mensagem de origem, FIFO por lead, lease recuperável, no máximo três tentativas
seguras e terminação explícita em `needs_review` ou `dead_letter`. Resposta
ambígua do provedor não provoca reenvio cego. `ana_effects` impede duplicar
qualificação, transição, handoff, proposta, reunião ou outbox.

O banco é aplicado antes das Edge Functions que usam esses objetos. Não haverá
janela em que o worker publicado espere tabelas/RPCs inexistentes.

### 4. Ana e roteamento de IA

`ana-run` continua como única autoridade automática. Para todo evento, inclusive
`message.received`, ele exige:

- empresa ativa e ambiente real autorizado;
- IA configurada e disponível;
- política de contato aprovada;
- modo IA e lead não pausado;
- canal WA-AKG saudável e permitido;
- ausência de opt-out, handoff humano ou kill-switch.

A política de IA será armazenada em configuração publicada da Ana:

- primário: FreeLLMAPI;
- fallback pago: desabilitado por padrão;
- OpenAI ou Claude: somente quando o administrador habilitar fallback pago de
  maneira explícita e auditável.

A interface não mostrará um provedor como saudável apenas porque existe uma
integração genérica. Ela mostrará a rota configurada e a última execução
confirmada, sem expor chave, URL privada, prompt interno ou conteúdo sensível.

### 5. Agenda de prospecção

O worker valida cidade, UF única e termos antes de criar uma execução ou chamar
Apify. Uma agenda legada inválida gera uma única falha terminal de configuração
com orientação de correção, libera lock e interrompe a repetição até que um
administrador salve filtros válidos.

O sistema não infere `Sorocaba`, outra cidade, UF ou termo a partir do endereço
da empresa. Enquanto a configuração permanecer incompleta, a busca automática
fica bloqueada de modo seguro; nenhum crédito, lead ou campanha é criado.

### 6. Diagnóstico e auditoria

`operational-diagnostics` será estendido, preservando seu controle de acesso
administrativo, para retornar apenas agregados por organização:

- quantidade e idade de jobs `queued`, `running`, `retry`, `needs_review` e
  `dead_letter`;
- última execução da Ana, provedor efetivamente usado, erro normalizado e
  motivo de gate;
- saúde da agenda, última falha, próxima execução válida e bloqueio atual;
- backlog de base de conhecimento/embeddings, quando aplicável;
- estado efetivo de WA-AKG, sem QR, telefone completo, tokens ou payloads.

Os eventos existentes e registros de auditoria preservam transições relevantes.
Não será criada uma RPC pública privilegiada nem tabela de métricas paralela.

## Mudanças de banco previstas

1. Confirmar e aplicar exatamente uma vez a migração de fila durável já
   versionada.
2. Criar uma migration aditiva de proteção operacional que substitui somente os
   contratos de persistência/dispatch inbound necessários para:
   - resolver política de contato com telefone normalizado e conta WA-AKG;
   - preservar a mensagem em todos os estados;
   - impedir autoaprovação por inbound;
   - exigir `contact_approval_status = approved`, data de aprovação e política
     `lead_authorized` antes de dispatch;
   - forçar humano/pausa quando a política bloquear;
   - manter a trigger de cancelamento de `outreach_jobs` como segunda barreira.
3. Criar índices somente depois de confirmar a ausência de equivalentes ativos.
4. Criar uma migration aditiva de aposentadoria para manter linhas legadas
   desabilitadas, auditadas e sem roteamento novo; sem apagar histórico.
5. Corrigir a configuração de runtime que ainda referencia provedor legado para
   `wa_akg`, com registro de auditoria e sem tocar em segredos.

Nenhuma migration fará backfill de autorização, troca em massa de modo de
atendimento ou mudança de dados comerciais existentes.

## Funções e módulos afetados

| Área | Mudança |
| --- | --- |
| `ana-run` | Exigir aprovação/política em todos os eventos e registrar resultado de rota IA. |
| `wa-akg-worker` e `inboundWork` | Persistir diretório antes do inbound, enfileirar somente quando permitido e registrar bloqueio seguro. |
| `automation-worker` | Reclamar/drenar fila durável; validar agenda antes de criação/Apify; não chamar workers legados. |
| `whatsapp-accounts` | Expor e operar apenas contas WA-AKG autorizadas. |
| `webhook-whatsapp` e funções legadas | Responder aposentado/fail-closed; sem persistência, encaminhamento ou chamada externa. |
| `operational-diagnostics` | Expor agregados de fila, política, IA e agenda sem PII/segredos. |
| `runtimeSafety` e tipos de mensageria | Remover seletores legados ativos e tornar WA-AKG a única opção operacional. |
| Configurações/Central | Mostrar motivo factual de bloqueio e nunca chaves ou dados técnicos sensíveis. |

## Critérios de aceite

1. Um callback WA-AKG válido persiste uma entrada uma única vez e não duplica
   `ana_job` quando é repetido.
2. Contato protegido, não classificado ou sem diretório tem mensagem visível,
   modo humano/pausado e zero `ana_jobs`/`outreach_jobs` automáticos.
3. Lead explicitamente autorizado, aprovado e em modo IA cria exatamente um
   job para a mensagem de origem.
4. Handoff/retomada não reativa Ana para contato bloqueado.
5. FIFO, lease expirado, retry, dead-letter e erro ambíguo não duplicam efeito
   nem tentativa de envio.
6. Agenda inválida não chama Apify, cria uma falha terminal clara e não se
   repete até configuração válida.
7. FreeLLMAPI é a rota primária efetiva; fallback pago não ocorre sem política
   explícita e auditoria.
8. Diagnóstico respeita organização/papel e não expõe segredos, PII desnecessária
   ou payloads de mensagem.
9. Z-API e Evolution não são selecionáveis nem processam callback, fila ou novo
   envio; histórico antigo continua legível.
10. Todos os testes usam dados sintéticos ou ambiente controlado, sem QR,
    reconexão, envio real ou reprocessamento de callback histórico.

## Sequência de implantação

1. Pré-flight de schema, grants, funções ativas, estado de filas e resolução de
   conta WA-AKG, somente em leitura.
2. Migration de fila e migration de proteção/aposentadoria.
3. Testes de schema, RLS, idempotência, concorrência e contratos de Edge.
4. Deploy coordenado das funções compatíveis; releitura da fonte publicada.
5. Validação controlada com saída externa desabilitada e sem destinatário real.
6. Commit lógico, push do `main` existente e publicação somente no Site existente
   após build e validações bem-sucedidos.
7. Confirmação independente de banco, GitHub, Edge Functions, Site e rota
   publicada. Nenhum desses estados será declarado pelo êxito de outro.

## Reversão

Uma falha na nova fila ou nos gates interrompe a automação e deixa a mensagem
na Central para atendimento humano; não reconecta canal, não faz retry de
mensagem externa e não desfaz decisão de contato. A reversão de código ocorre
por release coordenado de versão anterior compatível; dados de fila, auditoria
e histórico são preservados para investigação.
