# Importação CSV direta e carteira existente da Ana

## Objetivo

Reduzir a fricção para importar uma lista CSV na Busca de Leads e permitir que
a Ana trabalhe, em modo automático, uma carteira já existente de leads
explicitamente elegíveis. As duas capacidades não podem criar prospecção paga,
liberar contatos pessoais, inferir autorização ou enviar mensagens fora das
políticas já aprovadas do WayFlex.

Esta especificação usa o banco e as Edge Functions como autoridades para dados
operacionais. O navegador apenas solicita ações autorizadas e apresenta seus
resultados.

## Contexto confirmado

- A tela de importação CSV abre primeiro um modal e, dentro dele, um input
  nativo oculto. O usuário precisa de dois cliques para chegar ao seletor de
  arquivos.
- A importação já é atômica por `import_prospecting_batch`, atualiza as stores
  de Leads/Listas e cria os registros com aprovação de contato `pending`.
  Nenhuma automação é iniciada por esse caminho.
- O modal de sucesso mostra apenas **Importar outro** e **Concluir**, apesar de
  os leads já existirem no módulo Leads.
- `ana-run`, `ana_jobs`, leases, idempotência, retries limitados e effect
  fences já oferecem uma base de execução durável para eventos permitidos.
- A automação atual consulta a agenda de prospecção/Apify; não existe um
  seletor de até dez leads CRM existentes.
- As proteções de agenda, `unclassified`, aprovação de contato, opt-out,
  handoff e modo humano devem prevalecer também sobre qualquer seleção de
  carteira existente.

## Fora de escopo

- Buscar novos leads, executar Apify ou consumir crédito de fonte externa.
- Fazer backfill de aprovação, mudar contatos pendentes para aprovados ou
  promover contatos de agenda para leads.
- Enviar mensagem real, gerar QR, reconectar canal, alterar credenciais ou
  ativar a Ana em produção durante os testes.
- Reutilizar `lead.created`, `manual.run`, `lead-workflow` ou uma agenda de
  prospecção paga como atalho para o lote de carteira.
- Substituir uma conversa/handoff humano pela automação da Ana.

## Decisão de arquitetura

### 1. Importação CSV: escolha direta e conclusão verificável

O botão visível **Selecionar arquivo CSV** na Busca de Leads passa a acionar o
input nativo de arquivo na mesma interação do usuário. Depois que o navegador
entregar o arquivo, o modal abre já com a prévia e o mapeamento carregados.
Isso preserva compatibilidade com navegadores que bloqueiam a abertura do
seletor de arquivos fora do gesto original.

O modal continua responsável por:

1. validar tamanho e formato;
2. detectar/montar o mapeamento;
3. mostrar prévia;
4. confirmar o lote atômico no banco;
5. manter o mesmo lote disponível para confirmação segura quando a resposta
   do banco for incerta.

Depois de uma confirmação bem-sucedida **e do refresh de Leads/Listas**, o
resultado inclui a identidade da lista criada. O modal mostra **Ver leads
importados** somente se ao menos um lead foi persistido. A ação fecha o modal e
navega pelo UUID autoritativo da lista (nomes podem se repetir e memberships
são N:N):

```text
/dashboard/leads?origem=Importação%20CSV&listaId=<uuid-da-lista>
```

Não haverá navegação antes da confirmação do RPC/refresh, nem em erro, nem em
replay pendente. Se RPC confirmar e o refresh local falhar, o modal mostra
estado de recuperação, sem navegar com stores obsoletos. Usuários sem
`leads.create` recebem erro antes de escolher/mapear um arquivo e não iniciam
leitura ou importação operacional; a permissão é carregada antes do clique para
não quebrar o gesto nativo do navegador.

### 2. Carteira existente: uma fonte interna separada

Será criada a operação **Trabalhar carteira existente (até 10 por rodada)**.
Ela é distinta de Busca de Leads, Apify e de toda agenda de prospecção externa.
Seu propósito é fazer a Ana analisar somente leads já existentes na organização
quando o modo automático estiver habilitado para essa política.

O navegador não seleciona IDs autoritativos e não chama `ana-run` diretamente.
Um administrador autorizado solicita ou agenda uma rodada; o servidor reserva
até dez candidatos elegíveis em uma única transação, cria jobs duráveis e
registra todos os motivos de seleção, exclusão e resultado.

```text
configuração aprovada/agenda interna
  → reserva transacional de até 10 leads
  → ledger e jobs com evento existing_lead.selected
  → worker cadenciado, depois de inbound/recovery prioritário
  → ana-run relê política, histórico e contexto
  → effect fence/outbox ou needs_review
  → auditoria de execução e próximo passo
```

O evento novo evita fingir que um lead existente acabou de ser criado ou que
enviou uma mensagem. `ana-run` continua sendo a única autoridade de decisão e
efeito automático.

### 3. Política de elegibilidade — fail closed

Um lead só pode ser reservado quando todas as condições abaixo forem verdade:

- pertence à mesma organização;
- está ativo e não está em estado comercial terminal/arquivado;
- possui responsável/atribuição ativa e canal WA-AKG autorizado, com telefone
  normalizado, conta/integration conectadas e controles de envio/automação
  habilitados;
- está em modo IA e não está pausado;
- não possui opt-out, supressão, handoff humano ou takeover ativo;
- possui `contact_approval_status = approved` e prova de autorização válida;
- não corresponde a identidade `agenda_protected` ou `unclassified` no
  diretório de contatos WA-AKG, inclusive aliases/colisões normalizadas;
- não possui job Ana, saída, cadência ou rodada ainda aberta;
- respeita horário, frequência e limites de contato definidos pela política;
- tem uma intenção segura para trabalho proativo: na primeira versão,
  candidatos sem histórico ou sem política explícita de próximo contato vão
  para `needs_review`, e não para envio automático.

Dados ausentes nunca contam como autorização. Uma mudança de opt-out, handoff,
modo humano, pausa, proteção, conta/canal ou inbound depois da reserva
cancela/finaliza o job antes de qualquer efeito. A proteção e o snapshot de
inbound são relidos antes de modelo e na última fronteira de efeito/outbox.

### 4. Prioridade e cadência

Mensagens recebidas e handoffs humanos têm prioridade sobre a carteira. Uma
entrada nova cancela atomicamente o trabalho de carteira queued/retry do mesmo
lead, em vez de apenas depender de ordenação global. A rodada não poderá
iniciar dez chamadas síncronas de `ana-run` nem monopolizar o worker: itens
recebem `run_at` espaçado e o worker promove no máximo um item de carteira por
invocação, depois de inbound/recovery.

O limite rígido de cada rodada é dez. A ordem é determinística e auditável:

1. próximo passo vencido autorizado;
2. lead com melhor adequação/atividade, sem contato recente;
3. data de criação/última ação mais antiga.

Empates usam `lead_id`. A seleção não altera estágio do Kanban por si só. Só
uma ação concretamente validada pela Ana, com efeito idempotente, pode atualizar
lead, tarefa, reunião, proposta ou estágio.

### 5. Persistência e contratos server-side

Uma migration aditiva cria:

| Objeto | Finalidade |
| --- | --- |
| `ana_existing_lead_policies` | política própria, desativada por padrão, modo `review_only`, limite/cadência, versão, lease e agenda interna |
| `ana_existing_lead_batches` | rodada, organização, solicitante/origem, política congelada, chave idempotente, estado e timestamps |
| `ana_existing_lead_batch_items` | lead reservado, posição, snapshot de inbound/canal/política, decisão/motivo, job associado, estado e auditoria de transição |
| `reserve_existing_leads_for_ana` | RPC server-only transacional com limite máximo de dez, lock por organização e `FOR UPDATE SKIP LOCKED` |
| `claim_due_existing_lead_policy` e guarda estreita | lease idempotente de agenda e retorno somente de allow/reason para revalidar proteção/canal |

As tabelas ficam sem acesso direto de `anon`/`authenticated`; somente funções
server-side/RPCs com checagem de organização e papel podem solicitá-las ou
consultar agregados. O trigger de proteção de contato já existente continua
como segunda barreira e será ampliado apenas se o novo evento precisar de
cancelamento explícito.

`ana_jobs` e `agent_runs` recebem o evento interno `existing_lead.selected`.
Cada job tem vínculo FK/único com o item de rodada, e os estados de item/job
transitam em funções transacionais de claim/finish/fail/lease/cancelamento. O
contrato carrega apenas snapshots mínimos de `batch_id`, `batch_item_id`, versão
da política, inbound e canal — sem segredos, texto de conversa desnecessário ou
PII adicional.

Não será feito um backfill automático de dados nem uma atualização em massa de
modo de atendimento.

### 6. Autorização e interface

- Criar/configurar/iniciar rodada exige `configuration.manage` e visão de
  carteira da organização; vendedor, SDR ou navegador não podem criar lote
  global por conta própria.
- A regra de proprietário/responsável é revalidada antes de qualquer ação
  individual.
- O fluxo individual de `lead-workflow` passa a aplicar a mesma verificação
  ator-versus-`owner_id`/`assigned_to` que já existe na autoridade `ana-run`.
  Papel administrativo elevado pode atuar dentro da sua organização; os demais
  só operam lead próprio/atribuído.
- O painel mostra apenas agregados e motivos legíveis: selecionados, em
  processamento, em revisão, bloqueados e próximo ciclo. Não exibe tokens,
  números completos, conteúdo de mensagem ou prompt interno.
- A configuração fica explicitamente separada de **Buscar novos leads** e de
  Apify/localização. A busca externa não começa quando existir carteira
  disponível, a menos que a política externa também esteja habilitada de modo
  independente.

### 7. Ativação segura

A capacidade nasce desabilitada. Antes de qualquer ativação online, o
pré-flight somente de leitura confirma que as migrations de fila durável e de
proteção de contatos estão aplicadas, que os grants/RLS esperados existem e que
o canal/configuração real permite operação. Se não houver essa prova, a rodada
permanece bloqueada com diagnóstico acionável.

## Arquivos e áreas previstas

| Área | Mudança prevista |
| --- | --- |
| `src/pages/dashboard/busca-leads/page.tsx` | input direto, pré-carregamento do modal e navegação pós-confirmação |
| `src/components/feature/CsvImportModal.tsx` | receber arquivo inicial/resultado com lista e mostrar ação para Leads |
| repositório de lote de prospecção | retornar identidade segura da lista confirmada |
| `supabase/migrations/*` | ledger/RPC/índices/grants/RLS/evento aditivos |
| `supabase/functions/ana-run` | aceitar/revalidar evento novo sem confundir com inbound ou lead recém-criado |
| `supabase/functions/automation-worker` | reservar/drenar a carteira com prioridade e cadência |
| `supabase/functions/lead-workflow` | corrigir a autorização de proprietário/atribuição |
| `runtimeSafety`, `anaEffectFence`, `anaQueue` | reconhecer a política/metadata da carteira e manter bloqueio fail-closed |
| configurações/diagnósticos da Ana | configuração e agregados administrativos da carteira |

## Critérios de aceite

### CSV

1. Um clique no botão principal abre o seletor nativo de CSV.
2. Arquivo selecionado abre prévia/mapeamento sem perder as validações atuais.
3. Importação bem-sucedida mostra **Ver leads importados** e abre Leads
   filtrado pela lista/origem confirmada.
4. Falha de RPC, replay pendente, arquivo inválido e falta de `leads.create`
   não navegam, não gravam parcialmente e não iniciam Ana.
5. CSV mantém todos os contatos `pending` até aprovação explícita.

### Carteira existente

1. Uma rodada reserva no máximo dez leads elegíveis da organização correta,
   mesmo sob duas solicitações concorrentes.
2. Leads protegidos, não classificados, pendentes/rejeitados, em humano,
   pausados, opt-out, handoff, terminal, sem responsável ou com job ativo não
   são selecionados.
3. Uma mudança de proteção, canal/conta, inbound ou takeover após a reserva
   impede modelo/efeito/outbox.
4. Inbound preempta carteira pendente do mesmo lead; a carteira é processada cadenciadamente e não cria
   dez chamadas simultâneas.
5. Retry/reexecução não cria item, job, efeito ou mensagem duplicados.
6. A seleção não chama Apify, não pesquisa novos leads e não envia mensagem
   durante testes controlados.
7. RLS/RBAC impedem acesso ou ação entre organizações e impedem que perfis sem
   privilégio criem lote global.
8. O fluxo individual respeita dono/atribuição depois da correção de
   autorização.

## Plano de testes

1. Testes de componente para escolha direta de arquivo, CSV vazio/inválido,
   sucesso, falha e ação **Ver leads importados**.
2. Testes de repositório/RPC para lista confirmada, replay idempotente e
   permissão `leads.create`.
3. Testes SQL/RLS/concorrência em banco local descartável para reserva de até
   dez, isolamento por organização, locks, grants, triggers, duplicidade e
   estados recusados; testes mock/estáticos são somente complemento.
4. Testes de fila para prioridade inbound, lease, retry, `needs_review` e
   efeito/outbox idempotente.
5. Testes de `ana-run` para evento novo, contexto/histórico, mudança de policy
   após a reserva e ausência de envio real.
6. Testes do `lead-workflow` com usuário de outra atribuição, proprietário,
   administrador e outra organização.
7. Lint, type-check, build e suite existente; nenhuma aprovação será declarada
   apenas pela leitura do código.

## Implantação e reversão

1. Implementar e validar localmente sem segredos ou chamadas externas.
2. Fazer pré-flight remoto somente de leitura quando houver autorização de
   deploy.
3. Publicar migration antes das Edge Functions compatíveis; confirmar schema e
   grants publicados.
4. Publicar funções, depois frontend, e validar com execução controlada sem
   envio real.
5. Habilitar a política somente após evidência de filas/proteções operantes e
   aprovação administrativa explícita.

Em qualquer erro, pausar a carteira existente e manter leads disponíveis para
atendimento humano. Nenhuma reversão apaga histórico, lista CSV, auditoria ou
conversa, nem reconecta canal ou reenvia mensagens.
