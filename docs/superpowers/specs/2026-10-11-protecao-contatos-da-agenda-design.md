# Proteção de contatos da agenda no WhatsApp

## Objetivo

Impedir que um contato pessoal ou comercial salvo na agenda de um vendedor entre em prospecção, cadência ou atendimento automático da Ana sem uma decisão explícita. Esses contatos precisam continuar visíveis e atendíveis manualmente na Central de Atendimento, sem a criação de um lead artificial. Um número só passa a ser lead quando um operador autorizado escolher essa promoção.

## Escopo aprovado

- Um contato protegido conversa normalmente na Central, mas fica fora de funil, Kanban, campanhas, cadências, propostas e respostas automáticas.
- Um número desconhecido aparece como **A classificar** e também fica com a Ana desligada até decisão humana.
- A ação **Manter como contato** preserva a proteção. A ação **Tornar lead** solicita responsável e modo inicial (**Humano** por padrão ou **Ana**, sujeito às travas já existentes).
- A decisão é durável por conta WhatsApp, preservada em reconexões e auditável.
- Uma coincidência durante busca, importação ou prospecção exige decisão antes de criar/importar o lead ou enfileirar automação.

## Contexto comprovado

- A Central atual é orientada a `leadId`; suas RPCs, estado de leitura, mensagens humanas e handoff pressupõem um lead existente.
- `whatsapp_conversations.lead_id` aceita `NULL`, portanto existe base para uma thread de contato antes da promoção, mas a Central ainda não a expõe.
- `whatsapp_contact_directory` é um cache de nomes. O gateway também pode alimentar esse diretório com contatos observados em mensagens; presença, foto, `name` ou `agenda_name` não provam que o número está salvo na agenda.
- O fluxo atual de entrada pode aprovar o contato por receber uma mensagem, resolver/vincular um lead implicitamente e disparar Ana no evento `message.received`. Esses comportamentos entram em conflito com a proteção proposta.
- `contact_suppressions` não pode ser reutilizada: ela expressa opt-out/bloqueio total e impediria a resposta humana que este recurso deve permitir.

O contrato público atual do WA-AKG expõe contatos genéricos, mas não comprova um indicador estável de “salvo na agenda”. A implementação deve confirmar o contrato do gateway implantado antes de marcar qualquer contato como protegido automaticamente. Enquanto essa prova não existir, o estado seguro é **A classificar**, nunca “Contato da agenda”. [Rotas do WA-AKG](https://github.com/mrifqidaffaaditya/WA-AKG/blob/main/actual_routes.txt) e [implementação de contatos](https://github.com/mrifqidaffaaditya/WA-AKG/blob/main/src/app/api/contacts/%5BsessionId%5D/route.ts).

## Decisão de arquitetura

### 1. Identidade e classificação canônicas

Será criada uma classificação independente de `leads`, indexada por:

`organization_id + whatsapp_account_id + phone_identity`.

`phone_identity` é o telefone normalizado no formato canônico adotado pelo CRM. A conta WhatsApp faz parte da chave para preservar a privacidade entre dispositivos de vendedores diferentes.

Cada identidade terá:

| Campo | Finalidade |
| --- | --- |
| `state` | `agenda_protected`, `unclassified` ou `lead_authorized` |
| `evidence_state` | `provider_verified`, `unverified` ou `operator_confirmed` |
| `source_revision` | versão do dado observado no gateway, sem substituir decisão humana |
| `decision_revision`, `decision_by`, `decision_at`, `decision_reason` | decisão auditável e idempotente |
| `lead_id` opcional | somente preenchido depois de promoção explícita |

Nomes, fotos, presença no diretório e nomes fornecidos pelo WhatsApp não alteram `state`. Somente um atributo documentado e testado do provedor pode criar `agenda_protected` com `provider_verified`. Sem ele, a sincronização registra a evidência como `unverified` e mantém `unclassified`.

Um operador pode confirmar proteção manualmente. Nesse caso, **Manter como contato** grava `agenda_protected` com `operator_confirmed`. A sincronização posterior não pode reverter uma decisão manual ou uma promoção já concluída.

### 2. Conversa de contato sem lead

Contato protegido e contato a classificar usam uma conversa WhatsApp real com `lead_id = NULL`; não será criado um lead apenas para exibir mensagens.

Serão adicionados armazenamento de mensagens, outbox humano, estado de leitura e vínculo de histórico próprios para a conversa de contato. O navegador acessa esses dados apenas através de RPCs autorizadas; tabelas internas permanecem com RLS ativo e sem acesso direto de `anon` ou `authenticated`.

A Central passa a usar um contrato discriminado:

| `subjectKind` | Identificador da URL | Capacidades |
| --- | --- | --- |
| `lead` | `leadId` | fluxo comercial existente, sujeito às políticas atuais |
| `protected_contact` | `conversationId` | leitura e resposta humana autorizada; sem Ana, funil, campanha ou cadência |
| `unclassified` | `conversationId` | leitura e classificação; sem Ana, funil, campanha ou cadência |

O contrato impede que uma tela de contato chame por engano RPCs que exigem `leadId`. A conversa e seu histórico são preservados na promoção por uma ponte idempotente, e a mesma conversa passa a apontar para o lead resultante.

### 3. Política de proteção no servidor

Uma função de política única resolve a classificação e a versão atual da identidade antes de qualquer efeito. Ela é aplicada em profundidade nos pontos abaixo:

1. **Entrada:** persistir a mensagem do contato protegido/a classificar e torná-la visível na Central, sem criar lead, autoaprovar contato, obter segredo de Ana ou disparar atendimento automático.
2. **Dispatch de entrada:** somente `lead_authorized` pode chegar à etapa de Ana; a checagem acontece dentro da transação, não apenas na resposta anterior da persistência.
3. **Ana e efeitos:** Ana relê a classificação antes de montar resposta, criar job ou enfileirar efeito. O evento `message.received` não recebe exceção.
4. **Fila, cadência e worker:** a classificação é conferida ao reservar e imediatamente antes de chamar o provedor. Se a decisão mudou enquanto o job aguardava, o job automático é cancelado/finalizado com motivo de proteção; não é reenviado automaticamente.
5. **Busca, importação e prospecção:** com a conta escolhida, o telefone normalizado é comparado em transação. Coincidência protegida retorna `requires_contact_decision`; não cria lead parcial, não inicia cadência e não expõe dados de agenda de outro vendedor.
6. **Rotas legadas de webhook:** qualquer caminho que persista inbound ou acorde Ana usa o mesmo resolvedor de política ou é mantido inativo. Não haverá um segundo caminho que contorne a classificação.

`contact_suppressions` continua com seu significado atual de recusa/opt-out e bloqueia todo contato. A nova política não a altera.

### 4. Resposta humana e promoção explícita

A resposta de um contato protegido usa uma rota e outbox próprios, cujo destinatário é derivado no servidor a partir da conversa. Ela exige o proprietário autorizado da conta ou um administrador, é marcada como manual e não aceita Ana, campanha ou cadência.

**Tornar lead** é uma transação idempotente que:

1. bloqueia classificação e conversa;
2. confirma organização, conta, usuário e permissões;
3. cria um lead novo ou vincula um lead escolhido explicitamente pelo operador;
4. preserva e vincula o histórico da conversa;
5. grava `lead_authorized` e auditoria;
6. exige responsável e inicia em **Humano** por padrão;
7. só permite iniciar em **Ana** se o operador escolher isso e todos os gates existentes de Ana forem aprovados.

Não haverá associação automática a um lead por nome ou telefone parecido. Uma promoção repetida devolve o mesmo resultado, sem duplicar lead, mensagem ou histórico.

### 5. Experiência na Central e em Configurações

Em **Configurações → Proteção de contatos**, administradores veem a regra ativada por padrão:

> Contatos da minha agenda só entram na prospecção com minha autorização.

O toggle é administrativo e auditado. Desativá-lo não libera, altera ou apaga classificações explicitamente protegidas; essas continuam exigindo uma ação de promoção.

Na Central, contatos protegidos exibem um banner persistente entre o cabeçalho e os metadados:

- **Contato da agenda · protegido** quando a evidência é verificável ou confirmada por operador;
- **A classificar** quando a origem não é comprovada;
- explicação de que Ana, campanhas e cadências estão desligadas;
- ações idempotentes **Manter como contato** e **Tornar lead**.

Fechar um aviso transitório nunca altera a política. Para esses dois estados, a interface oculta Kanban, proposta, transferência para Ana, conhecimento comercial e demais ações próprias de lead. Depois de promoção, a tela recarrega no fluxo de lead com o modo escolhido.

O realtime da Central observa a mudança de conversa/classificação autorizada e atualiza o banner, as ações e a lista sem exigir recarga manual. Não haverá assinatura aberta que exponha contatos de outra conta.

### 6. Legado, reconexão e backfill

O sistema atual registra alguns contatos como aprovados por simplesmente receber uma mensagem. Essa condição histórica não será reinterpretada como autorização explícita.

- Nenhum backfill usa nome, foto ou diretório legado como prova de agenda.
- Um lead existente que receba evidência verificável de agenda é preservado, mas suas automações entram em revisão/pausa até decisão explícita; histórico e dados comerciais não são apagados.
- Identidades sem prova verificável permanecem no comportamento seguro `unclassified` quando forem encontradas por este novo fluxo.
- Reconectar a conta não remove `agenda_protected`, `lead_authorized` nem a decisão auditada.

## Autorização e isolamento

- Acesso à conversa sem lead segue o mesmo limite atual de administrador ou proprietário ativo da conta WA-AKG, combinado às permissões de canal e resposta existentes.
- Um vendedor não pode listar, ler, classificar ou responder contatos de outra conta.
- O administrador pode supervisionar dentro da organização conforme as permissões existentes; não recebe acesso por inferência a outra organização.
- Operações sensíveis de proteção/promoção são RPCs protegidas e registram ator, horário e motivo.

## Falhas, comportamento seguro e reversão

| Situação | Comportamento obrigatório |
| --- | --- |
| gateway não informa prova de agenda | `unclassified`, Central visível, Ana e automação bloqueadas |
| sync parcial, falho ou com versão desconhecida | não libera automação nem sobrescreve decisão humana |
| conta/canal não pertence ao usuário | negar leitura, classificação e envio |
| retry de webhook ou promoção | operação idempotente, sem duplicar conversa, mensagem ou lead |
| classificação muda com job automático na fila | cancelar/finalizar job com motivo, sem retry automático |
| falha ao promover | manter contato protegido/a classificar e histórico intacto |

Reverter a funcionalidade remove os novos caminhos de proteção e interface, mas não desconecta dispositivos, apaga mensagens, apaga leads ou envia mensagens. A reversão do banco será planejada por migration compatível e somente depois de preservar o histórico criado.

## Fora de escopo

- Gerar QR Code, reconectar/desconectar dispositivo ou alterar sessão WA-AKG.
- Enviar mensagens reais, ativar Ana, executar campanhas ou cadências como teste.
- Alterar `contact_suppressions`, permissões globais, domínios, credenciais ou configuração de produção.
- Inferir que uma mensagem ficou entregue ao destinatário apenas por estar registrada na fila ou aceita pelo canal.

## Critérios de aceite

1. Um contato com prova verificável de agenda entra como `agenda_protected`, aparece na Central e não cria lead nem chama Ana.
2. Um número sem prova aparece como `unclassified`; nome, foto e diretório não o promovem a protegido nem a lead.
3. Um usuário autorizado consegue responder manualmente a um contato protegido pela conta correta, sem criar lead ou job automático.
4. Ações de Ana, campanha, cadência, importação e prospecção recusam protegidos/a classificar tanto no início como imediatamente antes do efeito.
5. **Tornar lead** exige responsável e modo, preserva o histórico, é idempotente e libera Ana somente pela escolha explícita mais os gates existentes.
6. **Manter como contato** preserva a decisão em reconexão e em sincronizações posteriores.
7. Uma busca/importação que encontra identidade protegida retorna decisão requerida, sem importação parcial ou exposição de dados de outra conta.
8. RLS e RPCs impedem que vendedor A leia ou envie pela conta de vendedor B.
9. Testes controlados cobrem persistência, idempotência, RLS, transições, importação, fila, realtime e interface; não exigem QR, sessão ou mensagem real.

## Sequência de implantação

1. Confirmar o DDL e os contratos ativos do Supabase/gateway em leitura, inclusive a existência de sinal verificável de agenda.
2. Criar foundation de classificação, conversa de contato, outbox humano, estados de leitura, auditoria, índices, RLS e RPCs.
3. Aplicar os gates de entrada, Ana, workers, importação e caminhos legados.
4. Adicionar Central, Configurações, colisão de prospecção e realtime sobre os contratos novos.
5. Executar testes unitários, SQL/RLS e integração local controlada.
6. Só com autorização específica, publicar migration, Edge Functions e frontend como uma única liberação coordenada; validar primeiro com dados controlados, sem mensagem real.
