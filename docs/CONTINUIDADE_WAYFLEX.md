# Checkpoint — WayFlex CRM

## 27/09/2026 — Correção do bloqueio `whatsapp_provider_disabled`

- Diagnóstico no projeto oficial: a consulta real da Z-API confirmou a instância conectada, mas o controle administrativo permanecia desativado desde 25/09. O teste validava a sessão e depois era recusado corretamente pelo gate de envio.
- Havia um segundo defeito: o gatilho de sincronização confundia `paused` com erro de conexão. Assim, a conta aparecia como `error` e o cartão não oferecia **Ativar**, embora `integrations.connected=true`.
- A migration `20260927160000_preserve_whatsapp_connection_state_when_provider_paused` separa conexão física de habilitação operacional e reconciliou a conta como `connected`, ainda `enabled=false`.
- `testar-integracao` v16 devolve o bloqueio operacional de forma explícita; `whatsapp-accounts` v5 apresenta a conexão física sem transformar canal desativado em desconectado. A interface orienta para **Ativar Z-API acima** e não tenta o envio quando o gate está fechado.
- Segurança preservada: entrada, saída e automações permanecem desligadas, `kill_switch=true`; não houve mensagem, callback, job, lead ou execução da Ana. Type-check frontend/Edge, lint, **46 arquivos / 284 testes** e build passaram.
- Próximo teste permitido: o administrador deve clicar **Ativar** no cartão Z-API e autorizar um único envio real. A homologação só pode ser concluída depois de comprovar saída, entrada individual e recibos.

## 27/09/2026 — Pendências explícitas na ativação automática da Ana

- **Configurações > Ana > Operação automática** deixou de responder apenas com a mensagem genérica de pré-requisitos. A tela agora conta as pendências, identifica cada requisito por nome, explica o que falta e oferece um atalho para o campo ou módulo responsável.
- Ao tentar ativar o modo Automático, a interface leva o operador à primeira pendência. Configuração publicada, IA, Apify, agendador, WhatsApp de saída, WhatsApp de entrada, Ambiente Real e pausa global possuem destinos específicos; a pausa pode ser removida na própria lista.
- A regra de ativação, o cálculo server-side de prontidão, `ana-run`, as integrações e os dados operacionais não foram modificados. Type-check, lint, **46 arquivos / 282 testes** e build/artefato Sites passaram.
- Publicado no Site oficial como versão **136**, commit `de6d902`, deploy `appgdep_6ab93acb92208191a9c9603c7a2be576`, preservando a URL oficial.

## 27/09/2026 — Paleta da Dashboard aplicada ao CRM

- A paleta da Dashboard passou a ser a fonte visual única do sistema: grafite para ações, cinza frio para superfícies, verde Wayflex para sucesso, lima para seleção, âmbar para atenção e coral somente para erro ou urgência.
- Tokens globais, componentes compartilhados e exceções de Busca, Leads, Kanban, Central, Meu WhatsApp, Agenda, Orçamentos, Funil, Relatórios, Ana, Empresa, Equipe e Configurações foram harmonizados. Cores de marca permanecem apenas nos ícones dos provedores externos.
- Não houve alteração em regra, rota, permissão, banco, automação, integração ou dado operacional. Type-check, lint, **46 arquivos / 282 testes** e build/artefato Sites passaram.
- Publicado no Site oficial como versão **135**, commit `8a48ea4`, deploy `appgdep_6ab9381b70f4819191c320dd3baff9aa`, preservando a URL oficial.

## 27/09/2026 — Controle compacto da Ana automática na Dashboard

- A Dashboard recebeu um único controle **Ana automática**. Ele usa a configuração existente da operação diária e permite ativar ou pausar sem duplicar agenda, motor, fila ou política.
- A ativação passa por `ana-operations` e por uma operação transacional exclusiva do backend. O servidor revalida organização, permissão, configuração publicada, IA, Apify, agendador, WhatsApp de entrada/saída, pausa global, autorização paga, rota de atendimento e execução concorrente antes de gravar.
- Pausar desativa a agenda e cancela somente execuções ainda não iniciadas. A configuração permanece salva e auditável; uma execução externa já iniciada não é declarada cancelada de forma falsa.
- Migration `20260927130054_dashboard_ana_automatic_control` aplicada no Supabase oficial e `ana-operations` publicada na versão 4 com JWT obrigatório. A RPC não pode ser chamada por `authenticated`; somente `service_role` possui `EXECUTE`.
- Type-check frontend/Edge, lint, **46 arquivos / 282 testes**, build e artefato Sites aprovados. O estado remoto permaneceu desativado: WhatsApp e entrada Z-API estão pausados, portanto o controle deve mostrar **Preparação necessária** e não ativa a Ana.
- Publicado no Site oficial como versão **134**, commit `2b6cb64`, deploy `appgdep_6ab9161b2234819199337ff87272565c`, preservando a URL oficial.
- Limite: não houve envio, busca paga nem E2E externo. A ativação real permanece bloqueada até WhatsApp e entrada Z-API estarem saudáveis e o teste individual ser autorizado.

## 27/09/2026 — Homologação dos fluxos comerciais operacionais

- O pipeline passou a usar a sequência canônica **Novo → Apresentado → Qualificando → Reunião → Orçamento → Ganho → Perdido** em Leads, Kanban, Agenda, Funil, Relatórios e indicadores. Valores legados permanecem somente como leitura de compatibilidade; Ganho e Perdido não podem ser reabertos pelo navegador.
- A mudança de etapa deixou de ser êxito visual: a RPC `transition_lead_stage` valida sessão, carteira, permissão, ordem, mensagem persistida, qualificação, orçamento enviado e motivo de resultado. Cada mudança confirmada grava `lead_stage_history`.
- Orçamentos agora concluem Ganho/Perdido em uma única operação do servidor. A Central vincula uma proposta somente quando o operador a prepara; ela fica **Enviada** e avança para Orçamento somente depois de aceite comprovado pelo provedor. Fila, falha e reconciliação não são exibidas como envio.
- Arquivamento de lead é reversível e preserva o histórico. A tela não exclui lead comercial pelo Kanban. A Central bloqueia saída externa sem conversa WhatsApp e contato válido.
- Homologação técnica aprovada: type-check frontend/Edge, lint sem warnings, **46 arquivos / 281 testes**, build e artefato Sites. Migrações de transição/histórico, arquivamento, projeção de proposta e índice foram aplicadas no Supabase oficial; `enviar-whatsapp` foi publicado na versão 10 com JWT obrigatório.
- Provas remotas sem disparo externo: zero mensagens, jobs WhatsApp, histórico de estágio ou leads arquivados adicionados; a fila vinculada à proposta é exclusiva do backend (`authenticated=false`, `service_role=true`).
- A versão homologada foi publicada no Site oficial na versão **133** a partir do commit `a7e7fae`.
- Limite de homologação: **não houve E2E externo**. A Z-API continua desconectada/bloqueada, portanto não declarar WhatsApp, Ana ou a projeção pós-provedor como comprovados até executar um teste individual autorizado. A proteção de senhas vazadas do Auth também continua pendente.

## 26/09/2026 — Dashboard comercial compacta

- A Dashboard foi reduzida à leitura necessária para decisão rápida: quatro indicadores compactos,
  uma única fila Ações agora, pipeline canônico, atividade de contato e saúde operacional.
- A fila combina notificações abertas e transferências para humano que ainda não tinham notificação,
  deduplica por lead e mostra no máximo cinco decisões. É apenas uma seleção visual: não cria
  tarefa, mensagem, lead, alteração de etapa ou efeito em automação.
- Foram removidas da página as repetições de cartões de WhatsApp, conexões, fontes, fila, valor e
  temperatura. Os detalhes continuam nos módulos originais de Central, Configurações e Registros.
- Type-check, lint, 43 arquivos / 265 testes e build aprovaram. Publicado no Site oficial como
  versão 131, commit a3d29da, deploy appgdep_6ab842c3d2188191b755513ce09cc832. Revisão visual
  em desktop e 390×844 confirmou os cards compactos, as quebras de texto e o console sem avisos.
  Nenhuma regra, rota, automação, dado Supabase ou mensagem externa foi alterada.

## 26/09/2026 — Guia visual grafite/lima

- Reconciliado o código remoto da versão 128 com o checkpoint local da versão 127, preservando os dois históricos no commit 44a11a8.
- Aplicado o guia aprovado: trilho grafite recolhido por padrão, seleção lima, superfícies frias, cartões compactos e hierarquia de prioridade. Refinados Dashboard, telas operacionais, Ana, Configurações, Catálogo e Equipe por CSS limitado ao shell do CRM.
- Descrições de Busca, Leads, Kanban e Central foram movidas para balões acessíveis. Dados, rotas, contratos, permissões e automações existentes permanecem preservados.
- Type-check, lint, 42 arquivos / 262 testes e build aprovados. Publicado como versão 130, commit 563d00a, deploy appgdep_6ab839bd1b28819191be7f2974dead06. Revisão visual de Dashboard, Busca, Leads, Kanban, Central e Ana; Dashboard e Ana também em 390×844. Balões em portal corrigem recorte no cabeçalho; títulos das listas quebram linha. Console observado sem erros/warnings. Nenhum envio real ou alteração operacional foi executado.


## 26/09/2026 — WayFlex Command Center: redesign visual do CRM

- Publicado no Site oficial como versão **127**, commit `8848a5d`, preservando o endereço
  `https://leadai-crm-preview.fabricio926564.chatgpt.site`. Revisão autenticada aprovada em
  desktop, menu expandido e viewport móvel; console sem erros ou warnings.
- O shell global adotou a linguagem visual da referência: marca WayFlex CRM, navegação principal
  em cápsula, superfícies amplas, cartões com hierarquia, fundo luminoso e coral restrito a
  prioridade. Formulários, tabelas, botões, menus e módulos existentes herdam os mesmos tokens.
- O Dashboard foi reorganizado como centro de comando usando somente dados operacionais reais:
  KPIs, atenção comercial, pipeline, orçamentos abertos, prioridade, atividade das conversas,
  WhatsApp, serviços, canais, APIs e fontes. Nenhum valor demonstrativo ou integração foi criado.
- Explicações do novo painel aparecem em balões acessíveis por mouse e teclado. Estados online só
  usam Realtime ou diagnóstico do backend; pendente, bloqueado e indisponível permanecem explícitos.
- Type-check frontend/Edge, lint sem warnings, **42 arquivos / 262 testes** e build/artefato Sites
  passaram. A lógica comercial, Supabase, Ana, WhatsApp, filas e rotas não foram alterados.

## 26/09/2026 — Plano comercial, etapa 12: liberação comercial

- Homologação final local aprovada: type-check frontend e Edge Functions, lint sem warnings,
  **42 arquivos / 262 testes** e build/artefato Sites. O Site oficial permanece na versão **125**:
  `https://leadai-crm-preview.fabricio926564.chatgpt.site`.
- As alterações do motor crítico foram publicadas no Supabase oficial: `ana-run` **v36** e
  `automation-worker` **v33**. Probes sem credenciais foram recusados (`401` e `400`), sem chamada
  a provedor, mensagem ou execução comercial.
- Parecer: o CRM está liberado para **uso comercial supervisionado/piloto**. A operação 100%
  automática da Ana **não está liberada**: Z-API está pausada/desativada, não há conta Meta nem
  agenda automática ativa, e falta homologação externa ponta a ponta com número autorizado.
- Antes do Automático, também é obrigatório habilitar **Leaked Password Protection** no Auth,
  validar saída, entrada, recibos, resposta da Ana e handoff e iniciar uma agenda em modo
  Supervisionado. Relatório: `docs/RELATORIO_LIBERACAO_COMERCIAL_2026-09-26.md`.

## 26/09/2026 — Plano comercial, etapa 11: acabamento e publicação

- Publicado exclusivamente no Site oficial existente, versão **125**, a partir do commit
  `23fbb4b3a9adb1402dbc68a9c29f8379c8550de3`. URL preservada:
  `https://leadai-crm-preview.fabricio926564.chatgpt.site`.
- O artefato de produção foi reconstruído no fluxo oficial antes do deploy. A versão inclui os
  ajustes de atenção do vendedor, recebimentos antecipados e toda a documentação de homologação
  anterior; não criou Site, domínio, projeto ou canal novo.
- Nenhuma Edge Function, configuração Supabase, canal, mensagem ou execução da Ana foi publicada
  ou ativada. A pendência de proteção de senhas vazadas continua sendo gate da etapa 12.
- Próxima etapa: **Liberação comercial**, requer Sol XHigh.

## 26/09/2026 — Plano comercial, etapa 10: segurança e homologação

- Supabase oficial saudável e isolamento RLS comprovado com sessões `authenticated`: administrador
  viu somente WayFlex; vendedor sem carteira viu zero leads/notificações; tabelas internas recusaram
  leitura. Handoff transacional foi executado e revertido, com zero resíduos confirmados.
- Advisors foram classificados: tabelas sem policy estão fechadas a `anon/authenticated`; cinco
  RPCs privilegiadas possuem validações explícitas; avisos de índices não justificam remoção cega.
- Varredura do Git não encontrou chave privada. Nenhum provedor, worker, automação ou publicação foi
  acionado. Evidências: `docs/HOMOLOGACAO_SEGURANCA_ETAPA_10_2026-09-26.md`.
- Pendência administrativa real: **Leaked Password Protection** está desativada no Auth e precisa
  ser habilitada no painel antes da liberação comercial; o MCP disponível não altera esse controle.
- Próxima etapa: **Acabamento e publicação**, requer Terra High.

## 26/09/2026 — Plano comercial, etapa 9: testes e correções comuns

- A validação consolidada cobriu TypeScript do frontend e de todas as Edge Functions, lint sem
  warnings, **42 arquivos / 262 testes**, build Vite e geração do artefato Sites.
- A regressão nova cobre classificação semântica e deduplicação dos cards; o layout usa quebra de
  texto, limites responsivos e links para a Central sem alterar rotas ou estado operacional.
- O aviso conhecido do Vite sobre `runtime-config.js` permanece informativo: o script público é
  carregado em runtime pelo Site e deliberadamente não entra no bundle com segredos.
- Nenhum erro de código ficou aberto nesta etapa. Validação visual autenticada, segurança remota e
  E2E real controlado pertencem à etapa 10; publicação permanece na etapa 11.
- Próxima etapa: **Segurança e homologação**, requer Sol XHigh.

## 26/09/2026 — Plano comercial, etapa 8: alertas e Dashboard

- Corrigida a classificação da área **Atenção do vendedor**: reunião, orçamento e lead quente
  permanecem em seus grupos sem serem absorvidos pela marca genérica de ação necessária.
- Um lead com notificação aberta não reaparece simultaneamente em acompanhamento ou sem resposta;
  acompanhamento do dia também prevalece sobre atraso. Os cards passaram a mostrar título, resumo
  e próxima ação sem truncar o conteúdo principal.
- A infraestrutura existente foi preservada: eventos objetivos geram notificações por responsável,
  sino usa Realtime, resumo diário é idempotente e restrito à carteira, e WhatsApp do resumo segue
  opt-in individual com ledger próprio.
- Type-check frontend/Edge, lint, Vitest completo **42 arquivos / 262 testes** e build/artefato
  Sites passaram. Nenhum alerta externo foi enviado e o Site não foi publicado.
- Próxima etapa: **Testes e correções comuns**, ainda com Terra High.

## 26/09/2026 — Plano comercial, etapa 7: WhatsApp e recebimentos

- O worker agora reconcilia recibos Z-API que chegaram antes da persistência do ID aceito pelo
  provedor. Após registrar o aceite, ele procura somente callbacks falhos dos últimos sete dias,
  normaliza o payload pelo mesmo parser do webhook e reaplica a RPC canônica de recibos.
- A reconciliação não reenvia a mensagem, não consulta credenciais e preserva lotes parciais como
  pendentes. Sucesso e falha ficam em auditoria; uma falha nessa rotina não apaga o aceite já
  confirmado pelo provedor.
- Entrada idempotente, bloqueio de matching ambíguo, cancelamento da cadência por resposta humana,
  aceite atômico e progressão monotônica enviado/entregue/lido continuam no mesmo fluxo existente.
- Type-check frontend/Edge, lint, Vitest completo **41 arquivos / 260 testes** e build/artefato
  Sites passaram. Nenhuma função foi publicada, nenhum canal foi ativado e nenhuma mensagem real
  foi enviada. O E2E externo controlado permanece reservado à homologação.
- Próxima etapa: **Alertas e Dashboard**, requer Terra High.

## 26/09/2026 — Plano comercial, etapa 6: motor crítico da Ana

- `ana-run` reconcilia colisões de criação pela chave idempotente: uma segunda chamada recebe a
  execução já existente e não inicia outro processamento, modelo ou efeito comercial.
- O worker da prospecção deixou de reivindicar indiscriminadamente qualquer execução `running`.
  A reivindicação agora é atômica por estado e lock: fila nova, polling sem lock ou recuperação
  de lock vencido há dez minutos. Locks ativos não podem chamar o provedor em concorrência.
- As guardas existentes permanecem obrigatórias antes da saída: empresa/ambiente, kill switch,
  versão publicada, canal/conta, opt-out/supressão, autorização, modo humano, handoff e limites.
- Type-check frontend/Edge, lint, Vitest completo **41 arquivos / 259 testes** e build/artefato
  Sites passaram. Nenhuma função foi publicada, nenhum provedor foi chamado e nenhuma automação
  foi ativada; publicação e E2E ficam para as etapas finais.
- Próxima etapa: **WhatsApp e recebimentos**, ainda com Sol High.

## 26/09/2026 — Plano comercial, etapa 5: prospecção diária auditada

- A implementação existente de **Configurações > Ana > Operação automática** já cobre agenda,
  dias/fuso, ICP, regiões, segmentos, palavras-chave, critérios de contato, cotas, distribuição
  Ana/vendedor/rodízio, handoff, alertas, resumo diário e pausa global.
- Os três modos são distintos no servidor: simulação não chama Apify/IA/canais; supervisionado
  cria execução auditável para aprovação; automático exige pré-requisitos reais e autorização
  explícita de uso do Apify. O worker usa idempotência por agenda/data e respeita cotas.
- Não foi criada outra agenda ou fonte de busca e não foi executada busca paga, simulação nem
  ativação. A validação local da etapa 4 (41 arquivos/258 testes, type-check, lint e build) ainda
  cobre os contratos consultados; a homologação operacional dessa rotina permanece para a etapa 10.
- Próxima etapa: **Motor crítico da Ana**, requer Sol High.

## 26/09/2026 — Plano comercial, etapa 4: dossiê e qualificação

- O dossiê usa a própria `lead_qualifications`: necessidade, aplicação/equipamento, medida ou
  desenho, material/condição, quantidade, prazo, decisor, objeções e dados ainda faltantes.
  Não foi criada uma conversa, fila, lead ou CRM paralelo.
- A Ana recebe um contrato de resposta opcional e estrito: só registra fato declarado pelo lead;
  quando não há evidência, mantém `null` e lista a confirmação pendente. Os caminhos de
  simulação, apresentação e handoff gravam dossiê vazio e não inferem dados.
- Central e Kanban exibem o mesmo dossiê somente leitura, com prontidão, encaminhamento e a
  próxima ação. A edição comercial/negociação permanece humana e os controles de Ana existentes
  não foram alterados.
- A migration `20260926123000_lead_technical_dossier` foi aplicada ao projeto oficial e as duas
  novas colunas foram verificadas. Type-check frontend/Edge, lint, Vitest completo **41 arquivos /
  258 testes** e build/artefato Sites passaram. Não houve envio, ativação de canal ou chamada de
  provedor. A publicação do Site segue reservada à etapa 11.
- Próxima etapa: **Prospecção diária**, ainda com Terra High.

## 26/09/2026 — Plano comercial, etapa 3: catálogo Wayflex rastreável

- A base canônica recebeu perguntas internas de qualificação por item, visíveis e editáveis em
  **Configurações > Empresa e conhecimento**. Elas orientam a conversa sem serem apresentadas
  como especificação, preço, compatibilidade ou promessa comercial.
- A migration `20260926085704_catalog_qualification_guides` foi aplicada ao projeto oficial:
  os 56 itens ativos da Wayflex (19 produtos, 19 serviços e 18 catálogos) têm de uma a oito
  perguntas internas. A atualização recompôs os documentos/chunks derivados usados pela
  recuperação existente da Ana, sem criar uma nova fonte de conhecimento ou uma nova fila.
- O editor, a busca e os formatos de catálogo preservam as fontes, URLs e imagens oficiais;
  anexos/PDFs continuam somente como links oficiais enquanto não houver arquivo publicado e
  aprovado. Não foram inventadas aplicações, dados técnicos ou campanhas.
- Aprovaram: type-check frontend e Edge, lint sem warnings, Vitest completo **40 arquivos / 257
  testes**, build/artefato Sites e conferência SQL do banco. Não houve envio, chamada a provedor,
  ativação da Ana ou mudança de canal. A publicação do Site fica para a etapa 11.
- Próxima etapa: **Dossiê e qualificação**, ainda com Terra High.

## 26/09/2026 — Plano comercial, etapa 2: arquitetura final

- A versão 124 foi auditada contra o plano final. `leads`, `lead_messages`, `agent_runs` e
  `outreach_jobs` permanecem como runtime oficial; `ana-run` continua a única autoridade
  automática. O modelo `crm_*` antigo não foi promovido a segunda fonte nem removido.
- `docs/ARQUITETURA_FINAL_WAYFLEX.md` fixa entidades, etapas comerciais, estados operacionais,
  responsabilidade, RLS, concorrência, filas, idempotência e limites comerciais.
- O contrato de pipeline agora recusa saltos de mais de uma etapa por automação e recusa a
  reabertura comum de Ganho/Perdido. Ganho segue humano; Perdido automático exige opt-out objetivo.
- Aprovaram: type-check frontend e Edge, lint sem warnings, Vitest completo **40 arquivos / 257
  testes** e build/artefato Sites. Não houve escrita remota nem envio externo.
- Próxima etapa: **Catálogo Wayflex**, com Terra High. Completar apenas dados comprováveis,
  aplicações, campanhas, perguntas, anexos/fontes e edição, sem inventar especificações.

## 25/09/2026 — Etapa 4: importação em lote atômica

- A revisão da Busca agora envia o lote selecionado em uma única RPC `import_prospecting_batch`. A função, com permissões de invocador, valida organização e `leads.create`, insere leads, lista e vínculos na mesma transação e rejeita atribuição humana inválida pelas regras existentes. O identificador e o payload do lote são preservados na página para repetição idempotente após resposta incerta; nenhuma gravação parcial é aceita.
- Migration oficial `20260925194854_import_prospecting_batch_atomic` aplicada ao projeto `thgzrkppouoevapjquyu`. Provas em transações revertidas: dois leads e dois vínculos inseridos uma vez mesmo com repetição; falha de identidade duplicada deixou zero lead, lista e membro; vendedor sem permissão de atribuir ao admin foi recusado sem gravação. Estado após os testes: dois leads e três listas anteriores, zero mensagens e zero lead sintético persistido.
- Type-check frontend/Edge, lint sem alertas, 40 arquivos/255 testes e build/artefato Sites aprovados. Não houve busca paga, envio de WhatsApp ou ativação da Ana. A importação humana ponta a ponta com lead novo foi adiada pelo operador e continua pendente.

## 25/09/2026 — Usuários e responsáveis (etapa 3 original)

- A Busca oferecia `mockUsers` (`u-2`) como responsáveis. A importação descartava esse ID
  inválido e podia criar o lead sem o vendedor escolhido. O seletor agora carrega os membros
  ativos reais da organização, exige seleção explícita e reconfirma permissão/equipe antes de
  importar. CSV continua no modo Ana, sem herdar a seleção do formulário manual.
- No Supabase oficial, três membros estão ativos: dois administradores e um vendedor. A RLS
  existente limitava leitura/carteira, mas não impedia integralmente que um vendedor gravasse
  outro `owner_id` ao manter `assigned_to` próprio. Trigger privado agora exige responsável
  ativo da mesma organização e permissão `leads.edit_all` para atribuir outra pessoa. O teste
  transacional com rollback rejeitou atribuição cruzada e ID inválido; admin pôde selecionar
  membro ativo. Nenhum lead permaneceu alterado, e não houve mensagem ou chamada a provedor.
- Checagens locais: type-check frontend e Edge, lint sem alertas, 39 arquivos/253 testes e
  build/artefato aprovados. Site oficial publicado como v123 (`5ac4a6b`) em 19:30:04Z.
  Após recarga, a revisão autenticada exibiu Flavio, Juca e fabricio como membros reais;
  sem selecionar responsável, **Adicionar aos Leads** foi bloqueado com erro explícito.
  Console sem erros. Nenhum terceiro lead foi criado nesta etapa.
- Não alteramos Ana, WhatsApp, canais nem o fluxo funcional de prospecção da etapa 2. A
  importação em lote continua sem atomicidade única e não foi executada nova busca paga.

## 25/09/2026 — Homologação autenticada da Busca (fechamento da etapa 2 original)

- O teste autenticado abriu os cinco resultados da busca de 23/09, exibiu cinco marcadores e
  importou um único resultado para uma lista nomeada de homologação. Lead e vínculo persistiram
  após recarga. Supabase confirmou um lead, um membro na lista, zero mensagens e zero jobs.
- O teste revelou classificação e porte derivados de defaults do formulário, fonte incorreta da
  lista reaberta, UF legada truncada e contagem histórica em lista sem membros. Correção local:
  metadados passam a vir do resultado da fonte; UF só é normalizada de estado/endereço explícito;
  listas contam vínculos reais e listas vazias não habilitam envio ao Kanban.
- Correção publicada v121 (`5e5d57c`) e segundo lead importado com categoria/fonte/SP corretos,
  porte nulo e persistência após recarga. Dois duplicados bloqueados; lista antiga vazia mostra
  zero e não permite envio ao Kanban. Estado vazio e viewport estreito conferidos.
- Último clique no mapa revelou zoom vertical incorreto (fator de tile duplicado); corrigido
  com helper geométrico e três regressões. Type-check frontend/Edge, lint, 38 arquivos/252 testes
  e build/artefato passaram. Publicado v122 (`03b7c7c`), deploy concluído em 19:01:49Z;
  reteste com mouse abriu corretamente Via Varejo e Galpão a partir dos respectivos marcadores.
- Numeração: o checkpoint anterior chamado etapa 3 é complemento da Busca. A etapa 3 do plano
  original é Usuários e responsáveis e ainda não foi executada. O seletor desta importação ainda
  contém responsáveis de exemplo; sua substituição pertence à próxima etapa já planejada.
- Relatório reproduzível e limites: `docs/HOMOLOGACAO_BUSCA_2026-09-25.md`. Duas importações de
  homologação permanecem na base, sem autorização de contato, mensagens ou jobs. Nenhuma nova
  busca paga, ativação de canal ou Ana foi feita. Próxima etapa: GPT-6 Sol High, após confirmação.

## 25/09/2026 — Etapa 3: confirmação da importação Busca → Leads

- Causa no caminho de falha: a Busca aguardava a gravação dos leads, mas a fila de listas
  engolia erros de `lead_lists`/`lead_list_members`; a tela navegava para Leads mesmo sem
  comprovar a lista. Uma rejeição na gravação dos leads também não era apresentada ao usuário.
- A Busca agora só navega após confirmar leads, lista e atualização final. Enquanto salva, o
  botão fica desabilitado. Se qualquer etapa falhar, informa o resultado incerto, bloqueia
  repetição cega e oferece **Ver Leads** para conferência. O estado de listas é reconciliado
  com o servidor após falha. O caminho bem-sucedido de seleção → Leads permanece igual.
- Regressão local simula falha de lista, confirma o erro e a releitura do servidor, e valida
  uma gravação posterior. Type-check frontend/Edge, lint, 36 arquivos/245 testes, build Vite
  e artefato Sites aprovados. Nenhuma busca Apify, lead, lista, mensagem, Ana ou canal foi
  acionado para esta correção. No projeto oficial, a leitura mostrou zero leads, uma lista
  pendente sem membros, cinco buscas concluídas e cinco falhas históricas.
- Limite: gravações de múltiplos leads e vínculos de lista ainda não são uma transação única.
  Em falha parcial, conferir o módulo Leads antes de repetir. A validação visual autenticada
  e uma importação controlada continuam pendentes; teste local não as substitui.

## 25/09/2026 — Etapa 2: retomada e revisão da Busca Apify

- Causa raiz comprovada: o navegador só acompanhava a execução por cerca de dois minutos e perdia
  seu ID após recarga. Mais importante, a proteção `private.protect_prospecting_run` recusava
  `result_cache_id` em buscas sem cotação; a função antiga ignorava o erro da atualização. Havia
  cinco caches correspondentes aos cinco runs `running`, apesar de `result_cache_id` vazio.
- A Busca manual agora lista as execuções do usuário autenticado. **Retomar busca** consulta o
  mesmo ID no provedor; **Abrir revisão** lê apenas o cache de uma execução concluída. Nenhuma
  dessas ações inicia um novo Actor. Resultados continuam exigindo seleção explícita antes de
  entrar em Leads. As cinco execuções antigas não foram reprocessadas automaticamente.
- Migrations `20260925160000_prospecting_resume_atomic_results` e
  `20260925162000_prospecting_cache_transition_recovery` criam finalização atômica e idempotente,
  exclusiva do `service_role`, e permitem apenas o vínculo inicial do cache próprio na transição
  `running` → `completed`. Os cinco vínculos antigos foram recuperados por correspondência única
  de organização, usuário, filtros, fonte e horário. Resultado verificado: **5 runs concluídos,
  45 leads em revisão e zero leads importados**. Outros dois caches históricos com **10 resultados**
  não tinham vínculo inequívoco; aparecem separadamente sem alterar runs falhos.
- A função `prospectar-leads` v15 expõe listagem e abertura autenticada desses resultados,
  mostrando toda a organização para administrador e somente resultados próprios para vendedor,
  autenticada e preserva a execução em erros transitórios de consulta, sem derrubar a conexão
  da fonte. Falha terminal do Actor é registrada na execução.
- O limite solicitado é repartido entre termos, pois `maxCrawledPlacesPerSearch` da Apify é
  **por termo**. Cidade/UF e termos vão à fonte; site, WhatsApp explicitamente informado e e-mail
  são filtrados após retorno. Raio preciso, porte e cargo foram retirados do formulário enquanto
  não forem comprovadamente suportados. Nome, local, categoria e coordenadas ausentes não são
  fabricados. Telefone comum não é tratado como WhatsApp verificado.
- Validação: type-check frontend/Edge, lint sem warnings, 35 arquivos/244 testes, build Vite e
  artefato Sites aprovados. As migrations foram aplicadas no Supabase oficial, com `EXECUTE` negado a
  `anon`/`authenticated` e permitido somente a `service_role`. Não houve busca paga nova,
  importação de lead, envio de mensagem nem ativação de Z-API/Meta/Ana/rotina diária.
- Homologação visual pendente: usuário autenticado deve abrir Busca manual, clicar **Abrir revisão**
  em uma execução concluída ou resultado histórico e confirmar a lista e o mapa. O vínculo no
  banco está comprovado; testes locais não comprovam uma nova execução Apify nem importação.

## Checkpoint histórico — etapa 1 concluída, 25/09/2026

- Baseline de código: `9bdd136eaa9c03a2eb1eca91f67e57d3dac88579`, tag
  `baseline-wayflex-stage1-20260925`. Branch isolada:
  `chore/wayflex-stage-1-baseline-2026-09-25`. Runtime idêntico à versão 118 publicada.
- Site oficial v118 com deploy succeeded e projeto Supabase `thgzrkppouoevapjquyu` saudável
  confirmados pelos conectores oficiais. Nenhuma nova publicação, migration ou mutação operacional.
- Type-check frontend/Edge, lint, 35 arquivos/238 testes, build e artefato Sites aprovados.
- A main do GitHub `c4733b6` e o histórico do Site não têm ancestral comum. Preservar ambos;
  não confundir o remote local `official` (Site) com GitHub nem fazer substituição integral.
- Documento de retomada: `docs/BASELINE_ETAPA_1_2026-09-25.md`; inventário sanitizado de
  25 funções/133 migrations e estado operacional em `.agent/baselines/2026-09-25-stage-1.json`.
- Na época, a próxima etapa prevista era **2 — Busca Apify**, condicionada à confirmação da troca
  de agente. O usuário confirmou e a etapa 2 está documentada acima. Z-API, Meta e rotina diária
  permaneceram desativadas.
- Os checkpoints seguintes são históricos; utilizar o manifesto mais recente para estado atual.

## Correção do handoff da Ana — 19/09/2026

- A investigação do atendimento reportado comprovou que **Retornar Ana** funcionou: o handoff foi
  devolvido à Ana e a mensagem posterior chegou ao backend. A interrupção ocorria exclusivamente
  ao registrar o evento `lead.handoff.requested`, pois a tabela exige `idempotency_key`.
- `ana-run` v31 registra agora uma chave idempotente derivada da execução. A correção é limitada à
  auditoria do handoff; não muda catálogo, política de reunião/orçamento, conteúdo, fila ou envio
  externo.
- A política atual continua encaminhando ao humano solicitações de reunião abertas e pedidos
  comerciais repetidos. Portanto, uma nova mensagem desse lead ainda pode ser transferida por essa
  regra, sem que isso represente falha do botão.
- Validação: `npm run type-check`, `npm run type-check:edge`, `npm run lint`, `npm test` (25
  arquivos/200 testes) e `npm run build` passaram. A mensagem já recebida não foi repetida para
  não criar contato duplicado; uma nova homologação requer retorno explícito à Ana e nova entrada
  controlada.

## Refinamento visual da Central de Atendimento — 19/09/2026

- A Central preserva os fluxos homologados e passa a seguir a composição visual de três áreas da
  referência: lista de conversas à esquerda, chat central com ações organizadas e painel comercial
  mais amplo à direita. A alteração não toca em Ana, Supabase, Edge Functions, filas ou integrações.
- Os cards de conversas, dados do lead, orçamentos e produtos/catálogos não usam mais truncamento
  para conteúdo operacional. Textos disponíveis quebram linha e a lista rola quando necessário,
  sem ocultar o restante da mensagem ou descrição.
- Os botões de catálogo, orçamento, reunião, assumir/devolver Ana, transferência e opt-out foram
  apenas reorganizados visualmente; todos continuam chamando os handlers existentes. O catálogo
  ainda somente prepara texto/link revisável para a fila auditável.
- Validação local: `npm run type-check`, `npm run lint`, `npm test` (25 arquivos/200 testes) e
  `npm run build` passaram. A publicação deste checkpoint deve preservar a audiência pública do
  Site oficial. Não houve envio de WhatsApp, alteração de lead ou execução da Ana.

## Revalidação da Central e catálogo contextual — 18/09/2026

- A versão oficial atual já contém a Central em três áreas: conversas, chat operacional e contexto
  comercial do lead. Mantém filtros, atualização ao vivo, handoff humano/Ana, opt-out, fila humana
  auditável, Agenda, Orçamentos e Kanban sem criar caminhos paralelos.
- O painel de conhecimento usa a base comercial canônica: produtos, serviços, catálogos e arquivos
  são pesquisáveis, mostram origem rastreável e apenas preenchem uma mensagem revisável. O envio
  continua exclusivamente na fila homologada; PDF e imagem seguem como link até existir mídia
  homologada.
- Uma asserção de teste para callback Z-API invalidado foi ajustada sem mudar backend ou regra de
  negócio. Validação local: type-check frontend/Edge, lint, 25 arquivos/200 testes e build passaram.
- Nenhuma mensagem, job, lead, integração ou configuração da Ana foi alterado. A publicação deste
  checkpoint deve preservar a audiência pública já existente do Site.

## Base comercial inteligente — 18/09/2026

- Implementada uma única base operacional de conhecimento em **Configurações > Empresa e
  conhecimento**, com as abas Visão geral, Produtos e acessórios, Serviços, Catálogos e
  documentos, Documentos e mídia, Fontes de conhecimento e Configurações da Ana. O catálogo
  visual/local anterior deixou de ser uma segunda fonte de verdade e direciona para essa base.
- As fontes iniciais são específicas por adaptador: `/acessorios` cria itens de produto,
  `/servicos` cria serviços e `/catalogos` procura somente PDFs/catálogos. Cada item retém a URL
  de origem e só armazena conteúdo efetivamente encontrado; uma falha de download fica registrada
  na fonte e na execução de importação, sem criar informação inventada.
- As migrations `commercial_knowledge_catalog`, `index_commercial_knowledge_foreign_keys` e
  `consolidate_commercial_knowledge_policies` foram aplicadas no Supabase oficial. Elas adicionam
  fontes, itens, relacionamentos e eventos da conversa, com RLS/RBAC por organização, uma política
  por ação e índices de FKs. Itens aprovados para a Ana geram
  `documents`/`knowledge_chunks` derivados na mesma base já consultada por `ana-run`.
- A Central ganhou pesquisa lateral de Produtos, Serviços, Catálogos e Arquivos, prévia de origem
  e formatos rápido, comercial e técnico. Ao enviar, ela conserva o caminho comprovado
  `enviar-whatsapp` → fila → `automation-worker`, com idempotência e evento no histórico. Arquivo
  ou imagem é enviado como **link rastreável**, pois não existe pipeline de mídia homologado e o
  sistema não afirma anexos inexistentes.
- `ana-run` v30 classifica a intenção como produto, serviço, catálogo, dúvida técnica, orçamento
  ou geral e usa somente o conteúdo aprovado. Sem resposta suficiente, ela pergunta pelo dado
  técnico ou faz handoff; não confirma preço, prazo ou especificação sem fonte.
- Funções publicadas: `catalog-knowledge` v4, `enviar-whatsapp` v7 e `ana-run` v30, todas com
  JWT obrigatório. Nenhuma mensagem, job, execução automática ou dado de lead foi criado nesta
  implementação.
- A primeira execução autenticada revelou que `DOMParser` não existe no runtime da Edge Function.
  A correção foi publicada em `catalog-knowledge` v4 com parser HTML portátil, coberta por dois
  testes de regressão. As três fontes oficiais foram sincronizadas com sucesso e disponibilizam
  3 itens ativos para Ana e Central (um por página). O site de origem não expôs cards individuais
  ou PDFs no HTML retornado, então a importação manteve somente as páginas rastreáveis e não
  inventou catálogo adicional.
- Validação: type-check frontend/Edge, lint, build e artefato do Site passaram. A suíte Vitest
  executou 200 verificações: 199 passaram; a única falha é o contrato pré-existente de diagnóstico
  Z-API sobre rota de callback, fora deste lote. A sincronização autenticada das fontes e o envio
  externo de um conteúdo ficam para validação controlada, sem declarar sucesso antecipadamente.
- Publicado no Site oficial: versão 94, commit `e9c2ccff212ed349c6f4b102643a9444aeb47416`,
  deploy confirmado como `succeeded` em `https://leadai-crm-preview.fabricio926564.chatgpt.site`.
  A verificação autenticada confirmou as sete abas de Empresa e conhecimento, o painel lateral da
  Central e nenhum erro de console. A primeira sincronização foi concluída; atualizações futuras
  continuam disponíveis em **Fontes de conhecimento**.

## Organização operacional, monitoramento e resumo diário — 17/09/2026

- **Configurações** agora separa Canais, APIs e Fontes em itens próprios. Os links legados
  continuam redirecionando para a seção equivalente; **Registro do Sistema** fica em
  Configurações > Acesso e governança e a rota antiga redireciona para lá. **Equipe e acessos**
  passa a se chamar **Usuários**.
- A gestão de status e limpeza definitiva foi movida de **Leads** para **Funil de Conversão**;
  não existe uma segunda cópia dessa gestão na tela de Leads.
- O Dashboard apresenta Canais, APIs e Fontes em cartões compactos e separados, com estado de
  conexão validado pelo backend. Saldo/crédito ou expiração só aparece quando o provedor expõe
  esse dado público na configuração; o painel não estima nem inventa saldo.
- O novo monitor do WhatsApp usa contagens reais de jobs aceitos, callbacks de entrada,
  recibos de entrega, falhas e eventos de política nas últimas 1h/24h. O painel atualiza a
  leitura a cada minuto e mostra pausa/atenção somente a partir do estado persistido no servidor.
- Foi aplicado o relatório diário opcional por WhatsApp em **Usuários**. O administrador define
  destinatário, horário e fuso para cada membro. A configuração fica desligada por padrão; o
  worker só considera envios em Ambiente Real, por agendador server-side, canal saudável e sem
  política de pausa. O resumo contém somente totais agregados do funil, nunca nomes, telefones
  de leads ou conteúdo de conversas. O telefone é mascarado nas leituras da interface e a tabela
  de entregas guarda hash do conteúdo, não o conteúdo nem o número.
- Migration aplicada: `20260917213000_daily_whatsapp_lead_reports`. RLS está ligado na nova
  tabela e o acesso é exclusivo do backend `service_role`; nenhuma política de leitura de cliente
  foi criada intencionalmente.
- Funções implantadas no projeto `thgzrkppouoevapjquyu`: `automation-worker` v23,
  `team-members` v7 e `operational-diagnostics` v14. O worker também corrige a origem do sample
  de saúde do canal para o valor permitido pelo schema, permitindo que a telemetria persista.
- Validação antes da publicação do Site: type-check frontend e Edge, lint e build/artefato
  passaram. O contrato direto de resumo diário passou, incluindo telefone normalizado/mascarado,
  horário válido, etapas canônicas e ausência de dado individual de lead. Vitest continua
  bloqueado antes de iniciar pela junção local de `node_modules` sem permissão para o esbuild.
- Nenhum lead foi alterado, nenhuma mensagem foi criada/enviada e nenhuma configuração de relatório
  foi ativada nesta implementação.

## Refinamento visual executivo — 11/09/2026

- PUBLICADO: Site oficial versão 69, commit `5893352d252c61fb03dcc35b005757c3f4d6995c`,
  deploy confirmado como succeeded. Audiência privada preservada.

- Dashboard apresenta indicadores da carteira, barras proporcionais por etapa do Kanban,
  temperatura de leads abertos, conexões com estado individual e acompanhamento humano.
  Não exibe atalhos de começo/meio/fim nem gráficos de evolução sem dados históricos.
- Configurações agrupadas em Operação e conexões, Empresa e inteligência, Gestão comercial
  e Segurança e controle. Canais, APIs e fontes preservam seus componentes e ações existentes.
- Refinamento compartilhado de superfícies, espaçamento, tipografia, foco e menu lateral.
  Nenhuma alteração em hooks, repositórios, regras de domínio, Edge Functions ou dados.
- Validação: type-check frontend/Edge, lint e 159 testes em 15 arquivos passaram. Build Vite
  e artefato Worker concluídos. Sem QA visual autenticado nesta rodada.
- Git HTTPS recuperado com o helper existente em mingw64/bin e TLS OpenSSL por comando;
  credenciais temporárias não foram persistidas.

Última atualização: 2026-09-10. Este documento permite retomar o trabalho quando
Fabricio disser **“pode seguir”**, sem depender do histórico da conversa.

## Como retomar

1. Ler `AGENTS.md`, `.agent/AGENT_OS.md`, `.agent/audit-state.json` e este arquivo.
2. Conferir `git status`, o commit remoto e a versão privada do Site.
3. Revalidar somente o delta e o fluxo afetado; não repetir a auditoria inteira.
4. Preservar o modo protegido. Não enviar mensagens, ativar produção ou criar recurso
   faturável sem autorização específica.
5. Depois de cada lote: testar, atualizar `.agent/`, criar checkpoint Git e publicar apenas
   quando a versão estiver validada.

## Identidade e baseline validado

- Repositório: `/workspace/sites/leadai-crm-preview`.
- Supabase: `thgzrkppouoevapjquyu`.
- Site privado: `appgprj_6a905559159c8191a61fb776b9a4c531`.
- URL privada: `https://leadai-crm-preview.fabricio926564.chatgpt.site`.
- Commit funcional validado: `7c0e02c9a62c2716de408aed6818cb27dec01c33`.
- Baseline visual anterior: tag `baseline-pre-apple-mac-light-20260908` e Site versão 46.
- Antes da nova publicação, o Site ativo era a versão 48 no commit
  `4d072280a09b3b8462f5bf0dfa701b314eca31bb`.
- Prévia atual: Site versão 49, publicada com sucesso a partir do commit
  `947cf10d18e921e4250e5878b0a7ea43dedb3a6b`.

## Entregas deste checkpoint

- Protocolo persistente `.agent/` conectado ao `AGENTS.md`.
- Menu Configurações consolidado por responsabilidade. Diagnóstico, auditoria e registros
  estão no menu independente **Registro do Sistema**.
- Marca do shell mostra apenas **WAYFLEX**; sem círculos decorativos de janela.
- Dashboard consulta métricas e alertas operacionais reais.
- Central e Kanban compartilham lead e histórico em `lead_messages`; mensagens humanas usam
  a fila de saída e não são simuladas no navegador.
- Envio de orçamento agora prepara a mensagem para revisão; não altera status nem inventa
  validade antes da confirmação real.
- Quatro templates industriais persistidos, sem preço, prazo ou condição inventada.
- Integrações não comprovadas aparecem offline. Teste de IA valida credencial sem enviar
  mensagem. Cards diferenciam online, offline e teste vencido.
- Mudança para modo real ocorre no backend, é auditada e exige pré-flight. O modo real está
  corretamente bloqueado enquanto Claude, webhook de entrada e scheduler estão offline.
- Formulários de empresa só confirmam sucesso depois da persistência. Presets comerciais
  não comprovados foram retirados da tela; o catálogo real é a fonte indicada.
- Equipe e responsáveis usam membros remotos. Tempos e gráficos simulados foram removidos.
- Conteúdo operacional do frontend não exibe a antiga marca. Backup histórico permanece
  restrito em `docs/backup_wayflex_2026-08-26.sql` e não é carregado pelo runtime.

## Backend sincronizado

- `operational-diagnostics` v3, JWT obrigatório.
- `automation-worker` v10, JWT obrigatório.
- `enviar-whatsapp` v4, JWT obrigatório.
- `testar-integracao` v9, JWT obrigatório.
- `configurar-integracao` v11, JWT obrigatório.
- `ana-run` v14 e `webhook-whatsapp` v7 permanecem ativos.
- Correção posterior: `configurar-integracao` v12 e `testar-integracao` v10
  separam salvamento/validação da configuração de webhook Z-API.
- Correção posterior: `testar-integracao` v11 usa o contrato oficial de status
  Z-API sem header extra; validação sem envio, protegida por teste de contrato.
- Lote posterior: `operational-diagnostics` v4 e `configurar-integracao` v13.
  O Dashboard controla Ambiente de Demonstração/Ambiente Real com pré-flight persistido;
  as integrações passaram a ter categoria persistida entre comunicação, prospecção e IA.

Nenhuma mensagem real foi enviada e `sandbox_mode` não foi alterado.

## Validação

- `npm run type-check`: aprovado.
- `npm run type-check:edge`: aprovado.
- `npm run lint`: aprovado, sem warnings.
- `npm run test`: 13 arquivos, 107 testes aprovados.
- `npm run build`: aprovado.

Isso ainda não substitui teste E2E autenticado, WhatsApp/Claude real, concorrência Postgres,
RLS entre duas empresas e QA mobile autenticado.

## Bloqueios verdadeiros restantes

1. Criar scheduler server-side com segredo interno, lease, heartbeat, retry, dead-letter e
   alerta. Não existe credencial segura disponível para concluir isso automaticamente.
2. Homologar o webhook Z-API de entrada e recibos de entrega/leitura com número autorizado.
3. Validar a credencial Claude e o fluxo completo WhatsApp → Ana → fila → provedor.
4. Consolidar funções/stores legados que ainda oferecem caminhos paralelos a `ana-run`.
5. Concluir extração de PDF/DOCX/PPTX/XLSX, OCR, transcrição e busca híbrida. Hoje a Ana usa
   somente texto aprovado e transcrições fornecidas/revisadas.
6. Substituir os presets/localStorage restantes de módulos secundários e executar E2E/RLS.

## Lote mais recente, ainda sem nova publicação

- Commit validado e publicado: `1e2f3f406e0406c3c081d447ebbbb23510690045`.
- Prévia privada atual: Site versão 50.
- Ambiente de Demonstração segue ativo no banco. O Ambiente Real continua bloqueado até a
  pré-verificação aprovar empresa, Ana, kill switch, IA, WhatsApp, webhook e scheduler.
- Nove leads de demonstração confirmados e seus vínculos operacionais foram removidos. O lead
  “Lavanderia / Fabricio Gaspar” foi preservado para **REVISÃO NECESSÁRIA** por ter inbound sem
  marcador explícito de teste. Não há órfãos nas tabelas de lead verificadas.
- Histórico de auditoria é append-only e foi preservado por governança; ele não volta a aparecer
  como lead, conversa, tarefa, execução, proposta ou fila operacional.

O sistema continua **não liberado para comercialização autônoma** enquanto os itens 1 a 3
não forem homologados. Para retomar, começar pelo scheduler seguro ou pela homologação do
webhook em ambiente controlado.

## Lote atual — assistente de ativação de canal e worker

## Lote atual — envio controlado pela Central

- A causa da falha de envio manual em Demonstração foi corrigida no backend: o bloqueio
  ocorria antes da criação do job, o que impedia qualquer teste real de saída.
- A Central agora permite "Enviar teste controlado" após confirmação explícita. A mensagem
  escolhida é a única liberada, fica auditada e expira em cinco minutos; Ana, cadências e
  Ambiente Real permanecem bloqueados.
- Funções implantadas: `enviar-whatsapp` v5 e `automation-worker` v14. A integração de
  saída passa a ser selecionada por `key = whatsapp`, sem risco de usar o registro do webhook.
- Próximo passo humano: em uma conversa individual com lead cadastrado, escrever "Oi",
  usar **Enviar teste controlado**, confirmar e aguardar o processamento do worker. Depois o
  lead deve responder pela conversa individual para concluir a homologação de entrada.

## Lote atual — ativação inteligente

- O Dashboard mantém os botões Demonstração e Ambiente Real, mas o Ambiente Real agora chama
  um orquestrador autenticado no backend em vez de apenas bloquear o clique.
- O orquestrador prepara worker e entrada do WhatsApp quando aplicável, desliga a pausa global
  somente no momento seguro e grava `sandbox_mode=false` apenas após a checagem final completa.
- Quando uma confirmação externa ainda é indispensável, o sistema permanece em Demonstração
  e apresenta uma única próxima ação. Nenhuma ativação ou mensagem externa ocorreu na publicação.

- Commit de implementação: `357bdb98adad24a2eaf2feb0ab75a083b8f1c1a8`.
- A conexão de saída Z-API da WayFlex está confirmada no banco. O antigo aviso foi
  reescrito: ele não pede novamente a credencial; pede a **homologação da entrada de
  respostas**, indispensável para que a Ana reaja ao lead.
- Em **Configurações > Status operacional**, o assistente agora oferece:
  1. **Cadastrar entrada na Z-API**: chama no backend o endpoint oficial
     `PUT /update-webhook-received`, com URL e token protegidos no cofre. Depois, enviar
     mensagem controlada a partir de um número já cadastrado como lead; o callback deve
     aparecer como homologado somente depois de Ana processá-lo.
  2. **Preparar worker 24/7**: não pede chave. Cria token interno por empresa no Vault e
     habilita o cron do servidor. Em até um minuto, o card deve registrar heartbeat. No
     Ambiente de Demonstração, essa verificação não envia mensagens.
- Migration aplicada: `20260909182343_add_server_side_automation_dispatch`; cron ativo:
  `leadai-automation-worker-dispatch` a cada minuto. O dispatcher retornou `0` enquanto
  a WayFlex não ativa a integração scheduler, portanto nenhum efeito externo ocorreu.
- Funções publicadas: `operational-diagnostics` v5, `automation-worker` v11 e
  `webhook-whatsapp` v8. `automation-worker` só aceita sessão administrativa ou token
  interno por organização; o acesso anônimo ao dispatcher de banco foi verificado como
  negado.
- Validação do lote: typecheck frontend/Edge, lint, 112 testes e build aprovados. Restam
  a ação controlada do usuário no novo assistente, o callback Z-API e o primeiro heartbeat
  para evidência de produção. O modo real continua bloqueado até isso ocorrer.
- Prévia privada publicada com sucesso como Site versão 51 a partir do commit
  `a202a3fb9c0c8c33b179d82b377bc9395d42b6ef`.

## Lote atual — diagnóstico objetivo da homologação de respostas

- Evidência consultada após o relato do usuário: a Z-API aceitou o cadastro da entrada às
  `2026-09-09T18:32:29.026Z`, mas não há `webhook_events`, `channel_inbound_events`,
  mensagens nem `agent_runs` novos após esse momento. Portanto, a mensagem de teste ainda
  **não chegou ao endpoint do WayFlex**; não é falha da Ana, do modo Demo ou uma nova
  exigência de credencial Z-API.
- `operational-diagnostics` v6 adiciona diagnóstico de entrada baseado no servidor: sem
  callback após o cadastro, callback sem lead correspondente, callback não suportado,
  processamento pendente ou homologado. O pré-flight usa esse diagnóstico em vez de uma
  frase genérica.
- A interface mostra apenas o lead real disponível para teste, mascarando o telefone para os
  quatro últimos dígitos, e separa “Atualizar diagnóstico” de “Recadastrar entrada”. Nenhum
  lead fictício é criado e o Ambiente Real continua bloqueado até uma resposta efetivamente
  recebida, vinculada e analisada.
- Validação local: type-check frontend/Edge, lint, build e 113 testes aprovados. A função
  publicada foi confirmada como `operational-diagnostics` v6, JWT obrigatório.

## Consolidação oficial seletiva — 09/09/2026

- O projeto atual do Work é a versão principal. A branch
  `stabilize/production-readiness-2026-09-09` foi comparada por módulo e não foi aplicada por
  cima do projeto.
- Foram incorporados somente contratos comprovados: fontes das funções já implantadas,
  migrations ausentes no repositório, pipeline canônico, matching de WhatsApp, handoff atômico,
  RLS de mensagens/propostas e contrato de orçamentos.
- `company_settings.sandbox_mode` permaneceu `true`; o gate de Ambiente Real recusou a mudança
  em teste controlado porque a entrada WhatsApp ainda não está homologada.
- O worker não é mais pendência: cron e heartbeat server-side estão ativos. O último callback
  de teste foi de grupo e foi corretamente classificado como `non_direct_conversation`.
- Evidência consolidada: typecheck frontend/Edge, lint sem warnings, 115 testes, build, criação
  transacional de lead, telefone, pipeline, handoff, agenda, orçamento, ambiguidade WhatsApp,
  bloqueio Demo/Real e RLS multiempresa aprovados.
- Relatório completo: `docs/AUDITORIA_CONSOLIDACAO_2026-09-09.md`.
- Próxima ação segura: publicar este checkpoint e, em Demo, receber uma mensagem individual de
  um lead cadastrado para validar webhook → matching → histórico → `ana-run` exatamente uma vez.

## Ambiente Real único e limpeza segura — 10/09/2026

- O painel não oferece mais modo ou botão de Demonstração. `company_settings.sandbox_mode`
  continua apenas como proteção interna: enquanto estiver ligado, o painel informa que o
  Ambiente Real está em preparação e o backend bloqueia saídas automáticas.
- A validação bem-sucedida da Z-API registra a integração como pronta e, com empresa ativa e
  fila sem itens antigos, grava `sandbox_mode=false`. Assim a Central de Atendimento pode operar
  no Ambiente Real sem depender de localStorage. A tela diferencia claramente comunicação manual
  liberada de automações da Ana ainda pendentes.
- A ação **Verificar preparação** permanece útil depois da ativação do canal: ela continua
  tentando configurar o webhook de entrada e o worker 24/7, em vez de parar por o Ambiente Real
  já estar habilitado para comunicação.
- A migration `20260910134209_purge_selected_test_leads` e a função autenticada
  `cleanup-test-leads` removem, dentro de uma transação, o grafo completo de leads de teste
  previamente selecionados. O painel mostra os candidatos, exige seleção e confirmação e nunca
  apaga dados ambíguos automaticamente.
- Funções implantadas: `testar-integracao` v13, `operational-diagnostics` v11 e
  `cleanup-test-leads` v1, todas com JWT obrigatório. Nenhuma mensagem foi enviada e nenhuma
  exclusão foi disparada durante este lote.

## Teste simples de saída WhatsApp — 10/09/2026

- O teste da Z-API não depende mais de criar lead, preparar worker ou esperar a fila. Em
  **Configurações > Canais, APIs e fontes > WhatsApp > Testar envio**, informar um número sob
  controle do operador e uma mensagem. O backend confirma a instância e envia uma mensagem real
  diretamente; a confirmação do provedor e apenas os quatro últimos dígitos ficam auditados.
- Para uma mensagem manual da Central, o job continua sendo criado e auditado primeiro, mas a
  Central solicita o despacho do job específico imediatamente. O cron continua como recuperação
  segura caso essa tentativa não termine.
- Isto homologa somente a saída do WhatsApp. Para a Ana receber e responder, ainda é necessário
  cadastrar um lead com o mesmo número e enviar uma resposta individual para o webhook.

## Configuração publicada da Ana e cadência segura — 10/09/2026

- A tela **Configurar a Ana** agora publica uma versão ativa por organização. Essa versão é a
  fonte de instruções, tom, canais permitidos, horários, cadência, limite diário por lead e
  limiar de transferência. Publicar não liga canais, não libera o Ambiente Real e não envia
  mensagens.
- `ana-run` é a única autoridade automática. Os caminhos legados no navegador deixaram de
  disparar respostas ou follow-ups automáticos; a configuração não tem fallback para saudação
  genérica. Cada saída automática guarda a versão que a gerou e é bloqueada se essa versão
  deixar de ser a ativa. Orçamentos, preço, prazo, desconto e negociação exigem revisão humana.
- Foram aplicadas no projeto Supabase oficial as migrations de reconciliação de handoff e
  mensagens humanas, reserva de política de cadência e reserva idempotente de teste direto
  WhatsApp. As funções de configuração, Ana, worker, integração e webhook foram publicadas
  nas versões correspondentes deste checkpoint.
- As chaves de IA continuam no Vault: a interface só lê provedor, modelo e estado público.
  Selecionar ou salvar um modelo não comprova uma chamada real ao provedor.
- Validação local deste checkpoint: type-check do frontend e das Edge Functions, lint, 157
  testes e build aprovados. Não foi feito envio real, teste de modelo, mudança de
  `sandbox_mode` ou exclusão de dados.
- Limites conhecidos: recibo de entrega/leitura que chegar antes da persistência da aceitação
  do provedor pode exigir callback repetido para reconciliação; há uma janela residual entre a
  última revalidação do worker e a chamada ao provedor; e timeout já agendado não é rearmado
  retroativamente quando a configuração da Ana muda. Se a aceitação remota ocorrer e a
  persistência local falhar, o job fica em reconciliação até tratamento operacional. Esses
  pontos não autorizam afirmar homologação externa ponta a ponta.

## Layout Wayflex Executive Light — 10/09/2026

- A linguagem visual do Site foi alinhada à referência fornecida: base branca/cinza muito clara,
  verde institucional, bordas finas, sombras discretas e densidade de dashboard executivo. A
  mudança reaproveita componentes, rotas e regras existentes; não houve redesenho de domínio.
- O menu global agora comunica o fluxo comercial: **Começo · captar** (Busca e Leads),
  **Meio · atender** (Kanban, Central e Agenda), **Final · fechar** (Orçamentos, Funil e
  Relatórios) e Administração. A busca lateral filtra telas reais e o topo usa breadcrumb.
- O Dashboard ganhou atalhos de começo/meio/final e cartões de recursos que consultam
  `operational-diagnostics`: Ambiente Real, WhatsApp Z-API, entrada, Ana, worker e fontes. O
  rótulo Ativo nunca é decorativo; durante consulta aparece “Consultando”.
- Configurações inicia em Status operacional e separa **Canais** (WhatsApp/Z-API), **APIs**
  (IA e prospecção) e **Fontes** (ativação na Busca de Leads). O teste Z-API permanece somente
  no cartão WhatsApp. Conexão validada e uso ativo são exibidos como fatos diferentes.
- Regressão adicionada para impedir que integração conectada porém desativada apareça ativa.
  Type-check frontend/Edge, lint, 14 arquivos de teste/127 verificações e build passaram.
- Nenhum dado do Supabase, segredo, lead ou mensagem foi alterado durante este lote. A inspeção
  visual autenticada por Computer Use ficou pendente por falha local de permissão ao carregar o
  módulo do navegador; a referência foi analisada pela imagem pública da página compartilhada.
- O código foi registrado no commit `83ffd1001f8c6777a85f3aec304e1434897d5d8e` e publicado
  com sucesso no Site oficial como versão 59, sem mudar a audiência existente.

## Recuperação do Supabase no Site estático — 10/09/2026

- A mensagem “Configuração necessária” não indicava credencial ausente no Site nem erro do
  projeto Supabase. A URL pública e a chave publicável existentes foram confirmadas contra
  `thgzrkppouoevapjquyu`; o problema era que a versão estática anterior havia sido gerada sem
  essas variáveis no processo Vite.
- O artefato corretivo é construído com os valores públicos do ambiente do Site. Eles entram
  somente no bundle de navegador, como exige o cliente Supabase, e não em arquivos `.env`, Git,
  respostas, logs, Vault de frontend ou qualquer chave privada.
- Antes de publicar, foram aprovados type-check frontend/Edge, lint, 14 arquivos/127 testes,
  o build e a verificação de presença da URL/chave publicável no artefato. Nenhuma tabela,
  mensagem, lead, integração ou segredo foi alterado.
- A correção foi publicada com sucesso no Site oficial como versão 61. A próxima validação é
  somente atualizar a página autenticada e confirmar a abertura normal do CRM.

## Configuração pública resiliente e catálogo oficial da Ana — 10/09/2026

- A nova ocorrência de “Configuração necessária” foi confirmada como falha de empacotamento:
  as duas variáveis públicas do ambiente do Site correspondiam ao projeto Supabase
  `thgzrkppouoevapjquyu`, mas o bundle estático ainda podia nascer sem elas. O Worker agora
  entrega `/runtime-config.js` com cache `no-store`; o navegador lê URL e chave publicável em
  tempo de execução. O manifesto de hosting foi convertido de estático para Worker para que a
  rota dinâmica seja atendida em produção. O pacote foi verificado sem URL real nem chave
  publicável gravadas.
- A migration `20260910195000_refresh_wayflex_official_ana_catalog` foi aplicada ao projeto
  oficial. Ela aposentou as 7 memórias gerais v1 e ativou 61 fontes rastreáveis da Wayflex:
  17 catálogos, 18 segmentos, 18 famílias de acessórios e 8 fontes institucionais, de
  qualificação, respostas e limites. Cada item guarda a página oficial de origem e, nos
  catálogos, a referência visual por texto alternativo; nenhuma imagem externa foi baixada.
- `ana-run` v21 foi publicado. A recuperação lexical agora inclui URL-fonte e referência visual
  no contexto, e perguntas sobre catálogos, acessórios e componentes falham para revisão quando
  não houver fonte correspondente. Preço, prazo, estoque, certificação, laudo, composição e
  compatibilidade continuam bloqueados para confirmação humana/técnica.
- Validação local: type-check frontend/Edge, lint sem warnings, 15 arquivos/159 testes, build
  e smoke test do Worker com valores públicos simulados passaram. Não houve envio de WhatsApp,
  chamada a modelo, alteração de `sandbox_mode`, exclusão de lead nem download de mídia.
- A publicação final foi concluída no Site oficial como versão 65. A verificação no navegador
  confirmou que a rota inicial agora abre a tela de login, em vez de “Configuração necessária”.
  Não foi feito login, envio, execução de modelo ou interação comercial durante essa checagem.
- Pela tela autenticada **Configurar a Ana**, a versão ativa foi publicada como v13 com sete
  itens de resumo: site oficial, 17 catálogos, 18 segmentos, 18 famílias de acessórios,
  materiais/qualificação/limites, páginas-fonte e a regra de validação humana/técnica. A
  conferência no banco confirmou a versão ativa e manteve somente WhatsApp como canal permitido;
  publicar a configuração não habilitou o canal nem enviou mensagens.

## Clareza do botão Publicar configuração da Ana — 10/09/2026

- A investigação autenticada confirmou que a configuração v13 é carregada e que `ana-ia` está
  ativa. O botão da etapa 6 aparecia bloqueado porque não havia alteração pendente, mas o rótulo
  “Publicar configuração” não explicava a condição e fazia o fluxo parecer com defeito.
- A etapa agora informa a versão já publicada, mostra “Altere algum campo para publicar” no
  estado sem mudança e muda para “Publicar alteração” somente após uma edição. Assim o operador
  sabe exatamente como criar a próxima versão sem gerar versões duplicadas no banco.
- Foram aprovados type-check frontend/Edge, lint sem warnings, 15 arquivos/159 testes e build.
  A reprodução visual confirmou o estado bloqueado sem edição e o botão habilitado após alteração
  local; nenhum dado, mensagem, provedor IA ou modo operacional foi alterado durante o teste.
- A correção foi publicada no Site oficial como versão 68, preservando a audiência privada.

## Ana automática ativa após revalidação da IA — 10/09/2026

- A tela de Dashboard mostrava **Ana automática · Inativo** apesar de Ambiente Real, WhatsApp,
  entrada, worker e política publicada estarem ativos. A inspeção confirmou que a verificação
  da credencial do provedor de IA havia vencido, o que mantém a automação bloqueada por segurança.
- Foi executada a validação autenticada da credencial de IA. Ela confirmou acesso ao provedor sem
  enviar mensagem, executar o modelo, alterar a configuração comercial ou disparar a fila.
- Após recarregar o Dashboard, o backend confirmou **Ana automática · Ativo**: IA, canal,
  entrada, worker e políticas foram confirmados. Isso não substitui homologação de uma resposta
  real de modelo ou de entrega/leitura externa.

## Limpeza explícita de lead para novo teste — 10/09/2026

- Mediante solicitação explícita do operador, foi identificado um único lead associado ao
  telefone fornecido e a exclusão foi executada pela transação de limpeza, delimitada à empresa
  Wayflex e ao ID confirmado.
- A validação posterior confirmou ausência do lead e de seus vínculos operacionais: mensagens,
  filas, execuções da Ana, automações, Central, Kanban, agenda, comercial e identidades de
  canal/matching. O telefone pode ser cadastrado novamente para um teste limpo.
- `audit_logs` e `domain_events` são append-only no ambiente implantado e foram preservados como
  evidência de governança. Essas retenções não são usadas por matching, atendimento, fila ou
  automação. Não houve envio de mensagem, alteração da Ana, integração ou `sandbox_mode`.

## Segunda limpeza do lead Fabricio Gaspar — 11/09/2026

- O cadastro recriado com o telefone informado foi localizado de forma única e excluído pela
  transação operacional oficial, limitada à organização Wayflex.
- A verificação confirmou zero lead, mensagem, fila, execução da Ana e vínculo de canal restantes.

## Sincronização do heartbeat legado — 11/09/2026

- A telemetria operacional atual já usa a integração `scheduler`, atualizada pelo worker server-side. A tabela histórica `automation_heartbeats`, porém, permanecia em `never` desde agosto e podia induzir relatórios legados a indicar uma falha inexistente.
- A migration `20260911110000_sync_legacy_scheduler_heartbeat` instala um trigger que espelha toda nova confirmação de `integrations.last_success_at` do scheduler para `automation_heartbeats.automation_engine`. O registro existente foi preenchido com a última execução confirmada.
- A verificação posterior confirmou trigger instalado e `automation_engine` em `success`, sem erro. Nenhuma mensagem, lead, configuração da Ana ou modo operacional foi alterado.

## Dashboard operacional sem atalhos redundantes — 11/09/2026

- O Dashboard deixou de repetir a navegação do menu. A área principal agora prioriza indicadores de leads, handoffs, orçamentos, estado real de APIs/canais, fila, Kanban e alertas operacionais.
- Os agrupamentos do menu foram renomeados para Prospecção, Atendimento e Comercial. Não há mais rótulos de começo, meio ou fim no layout.

## Dashboard compacto — 11/09/2026

- Somente a apresentação visual do Dashboard foi reduzida: cards, barras, listas e blocos de status usam menos altura e espaçamento, preservando os mesmos dados, estados, filtros, rotas e regras.
- Validação local: type-check do frontend e Edge Functions, lint sem warnings, 15 arquivos/159 testes e build do artefato do Site passaram.
- Nenhum dado do Supabase, configuração, integração, mensagem, fila ou automação foi alterado. A inspeção visual autenticada permanece pendente nesta rodada.
- PUBLICADO: Site oficial versão 70, commit `3862ca243a5be0645e8dbfacb4b45c6282a7f2c2`, com deploy confirmado como succeeded e audiência existente preservada.

## Busca Apify — execução real e revisão fiel — 11/09/2026

- Causa confirmada: `prospectar-leads` tentava inserir em `prospecting_runs` sem os campos obrigatórios `estimated_records` e `quote_expires_at`. O banco recusava a criação antes de qualquer chamada à Apify; por isso não havia execução, cache ou lead para exibir.
- A função publicada `prospectar-leads` v6 agora grava esses campos com o volume solicitado e o instante da execução, mantendo a consulta direta sem confirmação/cobrança inventada.
- A Busca manual não simula mais enriquecimento, Ana ou remoção de duplicados por temporizadores. Em falha, ela permanece nos filtros e mostra o erro; em retorno vazio real, a revisão mostra a ausência de resultados sem tabela enganosa. O mapeamento também reconhece os campos reais retornados pelo provedor.
- Validação local: type-check frontend/Edge, lint, 15 arquivos/160 testes e build passaram. Nenhuma nova busca Apify foi disparada durante a correção.
- PUBLICADO: Site oficial versão 71, commit `e551635f180c4606ccedf27dac70393b443eb4b6`, com deploy confirmado como succeeded e audiência existente preservada.

## Busca de Leads — mapa, revisão e execução retomável — 11/09/2026

- A busca manual agora usa quatro etapas reais: **Fonte**, **Filtros**, **Revisão** e **Importação**. O seletor mantém fontes de prospecção não validadas visíveis, mas bloqueadas com orientação; cidade, UF, raio de cobertura, tipo/nicho, porte, contatos e quantidade são definidos antes da consulta.
- A revisão só abre depois de uma resposta final do provedor. Ela mostra lista selecionável, duplicados, contatos, contagem real de WhatsApp/e-mail e mapa OpenStreetMap dos resultados que vierem com latitude e longitude. Resultado sem coordenada continua na lista; nenhum marcador ou localização é inventado.
- A importação exige seleção explícita e só então cria a lista e navega para **Leads**. Ela não envia apresentação, não aciona a Ana e não dispara WhatsApp.
- Causa adicional confirmada: o endpoint anterior esperava a finalização da Apify na mesma requisição. Duas execuções ficaram sem `provider_run_id` e não podiam ser retomadas. Esses dois registros específicos foram preservados e marcados como `legacy_provider_start_timeout`; nenhum lead, cache ou dado comercial foi removido.
- `prospectar-leads` v8 agora inicia a execução rapidamente, grava o identificador do provedor e é consultado pelo painel até a conclusão. Somente após `SUCCEEDED` a função lê o dataset, grava o cache e conclui a execução. Falha/cancelamento do provedor não é apresentado como resultado vazio.
- A configuração pública atual da fonte indica Actor Google Maps e nenhuma Task. Se um `apify_http_400` voltar a ocorrer, o cartão da Apify apresenta **Corrigir Actor Google Maps**: a ação server-side preserva o token no Vault, troca somente o Actor e pede uma nova validação antes de habilitar a fonte. `configurar-integracao` v16 e `prospectar-leads` v8 estão ativos, ambos com JWT obrigatório.
- Validação local: type-check frontend/Edge, lint, build e 15 arquivos/163 testes passaram. Não foi iniciada nova busca externa pelo agente, não houve importação de leads, mensagem, alteração da Ana ou exposição de segredo. A validação visual autenticada por Computer Use ficou pendente porque o módulo local do navegador recusou carregamento por permissão.
- PUBLICADO: Site oficial versão 72, commit `78f41985b5c38b799849b503800cb7c4d0c293ad`, com deploy confirmado como `succeeded` e audiência customizada preservada.

## Dashboard — Canais e APIs compacto — 11/09/2026

- O card **Canais e APIs** foi reduzido a uma grade compacta com o nome de cada conexão e um
  único estado: **Conectado** ou **Desconectado**. Foram removidos provedor, data de teste e
  estados intermediários apenas dessa apresentação.
- O dado não é local nem decorativo: o Dashboard continua a consumir `operational-diagnostics`
  autenticado. O backend só entrega `online` quando a integração está conectada, habilitada,
  sem pausa/erro e com validação dentro de 24 horas. O card traduz qualquer outro estado para
  **Desconectado**.
- A consulta somente-leitura ao projeto Supabase oficial foi concluída pelo MCP. Nenhuma
  integração, dado, segredo, mensagem, fila ou automação foi alterado nesta rodada.
- Validação: type-check frontend/Edge, lint sem warnings, 15 arquivos/163 testes, build Vite e
  artefato Worker aprovados. QA visual autenticado não foi executado nesta rodada.
- PUBLICADO: Site oficial versão 73, commit `fb8fce803d77ac3235e75f22f9d82586786bc5a1`, com
  deploy confirmado como `succeeded` e audiência customizada preservada.

## Dashboard — conversas reais em tempo real — 11/09/2026

- O Dashboard passou a exibir um gráfico horizontalmente rolável das últimas 24 horas de
  conversas. Ele agrega exclusivamente `lead_messages` carregadas pela Central: separa
  recebidas de enviadas, exclui notas internas e mostra estado vazio quando não houver mensagem
  operacional no período. Não há seed, estimativa ou série de conteúdo inventado.
- A migration `20260911180000_enable_lead_messages_realtime` foi aplicada no projeto Supabase
  oficial. A verificação posterior confirmou `public.lead_messages` na publicação
  `supabase_realtime`; o assinante do Dashboard é filtrado por `organization_id` e recarrega a
  fonte operacional ao receber INSERT, UPDATE ou DELETE autorizado por RLS.
- O selo “Ao vivo” só é apresentado depois de `SUBSCRIBED`. Falha, timeout ou ausência de sessão
  deixam explícito que a consulta permanece real, mas que a página deve ser atualizada até a
  conexão em tempo real voltar.
- Validação local: type-check frontend/Edge, lint sem warnings, 16 arquivos/165 testes, build
  Vite e artefato do Site aprovados. O teste novo cobre a janela de 24 horas, direção das
  mensagens e exclusão de nota interna. Não houve envio de mensagem, mudança de integração,
  lead, automação ou configuração comercial.
- PUBLICADO: Site oficial versão 74, commit `1a2f0d1c40e20be475dd2eff34463228fe0a550e`, com
  deploy confirmado como `succeeded` e audiência customizada preservada. A inspeção visual
  autenticada não foi possível porque o runtime local de Computer Use falhou antes de acessar a
  janela por permissão; não declarar essa checagem como concluída.

## Equipe — criação direta de acesso administrativo — 14/09/2026

- A aba **Configurações > Equipe** passou a oferecer **Criar acesso** além do convite por e-mail.
  A ação usa a Edge Function `team-members` v2, que exige sessão autenticada e papel de
  administrador/owner na organização ativa.
- O backend valida nome, e-mail, papel e comprimento da senha, cria o usuário por
  `auth.admin.createUser` somente no servidor, confirma o e-mail e registra o membro ativo na
  mesma organização. A senha não é incluída em audit logs, eventos, respostas ou repositório.
- Se a associação organizacional falhar, o usuário recém-criado é removido para evitar uma conta
  órfã. E-mails já cadastrados retornam um erro específico, sem alterar permissões existentes.
- Validação local: type-check do frontend e das Edge Functions, lint e build Vite aprovados. O
  Vitest não inicializou neste worktree porque o esbuild resolve a dependência compartilhada em
  uma pasta sem permissão de leitura. A validação visual autenticada permanece pendente: o runtime
  de Computer Use falhou por permissão antes de abrir o navegador.

## Equipe — correção do vínculo organizacional de Juca — 14/09/2026

- Causa comprovada: `auth.admin.createUser` acionava `private.handle_new_auth_user` antes de existir
  um `organization_invites` para a WayFlex. O gatilho tratava o cadastro como onboarding comum,
  criava uma organização pessoal chamada Juca e por isso o membro não aparecia na equipe WayFlex.
- `team-members` v4 prepara o convite organizacional antes de criar ou convidar o usuário, bloqueia
  convites simultâneos para outra organização e restaura o estado anterior quando o Auth recusa a
  criação. A função preserva as proteções de autoexclusão presentes na v3.
- O cadastro real `juca@wayflex.ind.br` foi reparado de forma delimitada: usuário confirmado,
  perfil ativo na WayFlex, papel `administrador`, status `active` e um único vínculo organizacional.
  A organização de onboarding incorreta tinha zero leads, mensagens ou eventos; seu vínculo foi
  removido. O registro de auditoria imutável e os defaults inacessíveis foram preservados.
- A inspeção autenticada confirmou Juca e fabricio na lista de **Equipe e Acessos**. Type-check
  frontend/Edge, lint, 16 arquivos/172 testes e build passaram. A senha não foi consultada,
  registrada nem alterada; o login de Juca permanece para confirmação pelo próprio usuário.

## Mapa visual interativo de Configurar a Ana — 13/09/2026

- A navegação linear de **Configurar a Ana** foi reorganizada como um mapa de decisão moderno,
  mantendo os seis formulários, estados e ações existentes. Cada bloco seleciona sua etapa; não
  houve alteração no payload, na persistência, no botão de publicação ou na autoridade de
  `ana-run`.
- O mapa mostra Ana como IA sob controle humano, empresa/público, oferta permitida e Base
  aprovada, os grupos oficiais de 17 catálogos, 18 segmentos e 18 famílias de acessórios,
  conversa/qualificação, as decisões de reunião/orçamento e cadência/handoff, e a revisão final
  de canais/publicação.
- O pipeline canônico é exibido como orientação: Novo → Apresentado → Qualificando → Reunião →
  Orçamento → Ganho/Perdido. O estado visual usa somente a versão carregada e alterações locais
  pendentes; não declara canal, automação ou envio como ativo.
- A ponta oficial da versão 74 foi integrada por merge, sem força ou rollback. Type-check frontend
  e Edge Functions, lint sem warnings, 16 arquivos/165 testes e build de produção passaram no
  conjunto final. Nenhuma mensagem, lead, tabela, integração, segredo ou configuração da Ana foi
  alterada durante este delta exclusivamente visual.
- PUBLICADO: Site oficial versão 75, commit `0e8221bb4263d42c6c98652fcfb42d929ba09899`,
  com deploy confirmado como `succeeded` e audiência owner-only preservada. A inspeção visual
  autenticada confirmou o mapa, a configuração v17 e a navegação dos blocos até a etapa 6, sem
  editar ou publicar qualquer campo operacional.

## Restauração do layout anterior de Configurar a Ana — 13/09/2026

- O mapa visual da versão 75 foi removido após rejeição explícita do operador. A tela voltou à
  navegação compacta anterior de seis etapas.
- A restauração foi limitada ao JSX e CSS introduzidos pelo mapa. A comparação desses dois
  arquivos com a versão 74 ficou sem diferença; formulário, persistência, publicação, Supabase,
  `ana-run`, Dashboard, Busca/Apify e Realtime foram preservados.
- Type-check frontend/Edge, lint sem warnings, 16 arquivos/165 testes e build de produção
  passaram. Nenhum dado, mensagem, integração, segredo ou configuração da Ana foi alterado.
- PUBLICADO: Site oficial versão 76, commit `0b7892bd048c47d37be1d7985b9cfafaa61d8d26`,
  com deploy confirmado como `succeeded` e audiência owner-only preservada.

## Segurança de contato e autonomia controlada da Ana — 13/09/2026

- O fluxo principal de prospecção expõe somente **Apify** e as entradas manuais existentes. O
  backend legado foi preservado, sem criar fonte nova nem apagar configuração.
- A pontuação de captura foi separada em **aderência**, **contactabilidade** e **engajamento**;
  a origem do registro e a explicação do score passam até `leads`. Um telefone móvel não é mais
  considerado WhatsApp por formato.
- Busca, cadastro manual, importação, Leads e Kanban só ativam a Ana quando o canal foi confirmado,
  a autorização foi marcada e a origem dessa autorização foi registrada. O backend repete essa
  guarda em `ana-run`, `automation-worker` e no retorno do handoff.
- Mensagem individual recebida do próprio lead registra autorização de contato por iniciativa
  do destinatário. Grupo, ambiguidade ou direção inválida continuam bloqueados.
- `ana-run` combina conteúdo lexical aprovado e `match_knowledge_chunks` quando existir embedding.
  A instalação tem 61 documentos/chunks ativos e zero embeddings na verificação desta rodada;
  nenhuma reindexação paga foi iniciada sem autorização do operador.
- A ação `agendar_reuniao` exige horário explícito com offset, intervalo futuro válido,
  disponibilidade do Google Calendar e chave de idempotência. A Ana só confirma depois do evento;
  qualquer falha transfere para humano.
- O Registro do Sistema mostra jobs e saídas recentes por mensagem. Aceite, entrega e leitura não
  são tratados como sinônimos.
- Seis jobs históricos continham `provider_message_id` da Z-API e erro
  `provider_accepted_reconciliation_required`. A causa foi corrigida nas funções SQL atômicas;
  os seis foram reconciliados para `processed/sent` sem chamada ao provedor. A verificação posterior
  encontrou zero jobs em reconciliação. `automation-worker` v19 repete a rotina sem reenvio.
- Migrations aplicadas: `20260913173405`, `20260913174113`, `20260913174227`, `20260913174320`,
  `20260913174711` e `20260913174751`. As duas correções intermediárias de reconciliação foram
  preservadas porque já fazem parte do histórico aplicado; a última contém a definição válida.
- Validação: type-check frontend/Edge, lint sem warnings, 16 arquivos/168 testes, build e testes
  SQL transacionais com rollback para fila idempotente, aceite, entrega, handoff e retorno à Ana.
  Não houve busca Apify, mensagem, chamada de IA ou evento Calendar real nesta rodada.
- Referências operacionais: `docs/audit/saturday-regression-analysis.md`,
  `docs/DIAGNOSTICO_MENSAGENS.md` e `docs/RELATORIO_PRONTIDAO_2026-09-13.md`.

## Operação automática e Central de Alertas Comerciais — 13/09/2026

- **Configurações → Ana → Operação automática** agora governa a rotina existente em três modos:
  Simulação, Supervisionado e Automático. O estado inicial aplicado no banco é desativado e em
  Simulação; nenhum provedor foi chamado durante a implantação.
- A configuração persiste agenda, fuso, dias, ICP, regiões, canais mínimos, score, limites diário
  e mensal, distribuição, alertas, resumo diário e autorização explícita para prospecção paga.
  O botão **Pausar tudo** reutiliza o kill switch operacional já existente.
- `automation-worker` mantém uma fila idempotente em `prospecting_schedule_runs`, respeita limites,
  inicia/retoma o Apify, deduplica importações e distribui em rodízio quando configurado. No modo
  supervisionado, a busca e a resposta da Ana permanecem em aprovação; no automático, somente
  canal explicitamente informado pela fonte e score aprovado podem seguir para `ana-run`.
- `ana-run` continua como única autoridade de decisão e passou a persistir a qualificação comercial
  estruturada. Reunião, orçamento, lead quente, interesse, pedido humano e falha geram eventos
  objetivos e notificações auditáveis para o responsável.
- O sino usa `notifications` com Realtime e o Dashboard ganhou **Atenção do vendedor** com Responder
  agora, Leads quentes, Reuniões e orçamentos, Acompanhamentos de hoje e Sem resposta há muito tempo.
  O worker produz um resumo diário por carteira do vendedor no horário configurado.
- Migrations aplicadas no projeto oficial: `ana_autonomous_operation_and_commercial_alerts`,
  `commercial_alert_preferences`, `fix_commercial_alert_app_roles` e
  `index_ana_operation_foreign_keys`. Edge Functions publicadas: `ana-operations` v1, `ana-run` v24,
  `prospectar-leads` v11 e `automation-worker` v22.
- Validação sem efeitos externos: teste SQL transacional com rollback confirmou evento → notificação;
  endpoints rejeitaram chamadas sem autenticação; type-check frontend/Edge, lint, testes de contrato
  e build foram executados. WhatsApp, Apify, modelo de IA e Calendar reais não foram chamados.

## 2026-09-14 — Exclusão definitiva de membro da equipe

- **Configurações → Equipe e responsáveis → Excluir** agora remove definitivamente a identidade
  não compartilhada: credenciais, sessões, perfil, papéis, preferências, notificações e associação
  à organização deixam de existir. O mesmo e-mail pode ser criado novamente depois.
- Registros comerciais da empresa não são apagados. Leads, tarefas, propostas, handoffs, auditorias
  e históricos de prospecção antes associados ao membro permanecem na organização com a referência
  de responsável vazia, prontos para redistribuição.
- A remoção recusa a própria conta do operador, preserva a regra de que deve existir outro
  administrador e bloqueia a exclusão se a identidade também pertence a outra organização.
- Migration aplicada no Supabase oficial: `20260914203238_member_identity_deletion`.
  Ela tornou anuláveis as 13 referências de identidade que antes bloqueavam a exclusão e não removeu
  nenhum usuário ou dado comercial nesta implantação.
- Edge Function publicada: `team-members` v3. Foram adicionados testes de regressão para exclusão
  de identidade não compartilhada e bloqueio de conta compartilhada. Type-check frontend/Edge,
  lint e build passaram; o Vitest não iniciou por erro local de permissão no diretório compartilhado
  de dependências, antes da execução de qualquer caso de teste.

## 2026-09-16 — Base de Leads, site/WhatsApp e permissões por usuário

- **Leads** recebeu uma Base de Leads administrativa com filtros de status de atividade,
  responsável e busca. A exclusão é definitiva apenas para itens selecionados depois que o
  administrador digita `EXCLUIR N LEADS`; o backend reaproveita a transação já aprovada para
  remover mensagens, filas, execuções, vínculos de canal, Kanban, propostas e demais conexões
  operacionais. Nenhum registro foi removido durante a implantação.
- **Canais > WhatsApp** agora contém a Entrada do site. O administrador informa somente o número
  público já conectado à Z-API, rótulo/origem e mensagem inicial; o sistema produz um link
  `wa.me`. O marcador público no texto permite que o webhook crie o primeiro lead do visitante,
  registre a mensagem na Central e use exclusivamente `ana-run`. Sem marcador válido, ou em caso
  de identidade ambígua, o matching continua bloqueado e nenhum lead é criado.
- **Equipe e responsáveis** ganhou matriz de permissões individuais. Ela cobre Leads, conversas,
  prospecção, propostas, configurações, entrada do site, equipe e auditoria; o backend, RLS e UI
  usam a mesma matriz. Administradores preservam acesso completo. Não há chave Z-API, service
  role, token de IA nem qualquer outro segredo nessas telas ou no Git.
- Supabase oficial: migration `20260916205958_lead_governance_permissions_and_site_whatsapp`;
  Edge Functions `team-members` v6, `lead-governance` v1, `site-whatsapp-entry` v1 e
  `webhook-whatsapp` v17, todas ativas. A consulta administrativa retornou zero fora do contexto
  de backend e duas linhas para a organização com dados quando avaliada como service_role.
- Validação: type-check frontend/Edge, lint sem warnings e build/artefato do Site passaram. Foram
  acrescentados contratos para matriz de permissões e entrada pelo site. O Vitest permanece
  bloqueado antes de iniciar pelo `node_modules` ligado a diretório sem permissão local. Não houve
  envio/recebimento real de WhatsApp, chamada de IA, mudança de Z-API ou ação sobre leads.

## 2026-09-17 — Exclusão definitiva de Leads: confirmação compatível com o Site

- Causa confirmada no Site autenticado: o botão de **Gestão da base** chamava `window.prompt`;
  o runtime de hospedagem bloqueia essa API com `prompt() is not supported`, antes de qualquer
  chamada a `lead-governance` ou alteração no Supabase.
- A confirmação agora é um diálogo interno. Ele exige exatamente `EXCLUIR N LEADS`, mantém o
  botão definitivo desabilitado até a frase conferir e envia a mesma frase à validação server-side.
  Nenhum lead foi removido durante diagnóstico, implementação ou validação.
- Foram identificados dois pontos de limpeza: o gerenciador geral em **Leads** e o painel legado
  **Limpar leads de teste** em Configurações. O segundo é restrito a candidatos de teste, usa
  `cleanup-test-leads` e a transação compartilhada; foi mantido para evitar mudar a política de
  limpeza de testes sem autorização. Recomenda-se consolidar a UI em uma decisão futura.
- Validação local: type-check frontend, lint, teste direto da frase de confirmação e build do
  artefato do Site aprovados. Vitest não iniciou porque a junção local de `node_modules` aponta
  para uma pasta sem permissão de leitura. Falta publicar e validar visualmente o diálogo sem
  confirmar uma exclusão.

- PUBLICADO: Site oficial versão 82, commit `0c63c294dc226beb4bdeaa2af26a9618785cf680`, com
  deploy confirmado como `succeeded` e audiência pública existente preservada. A inspeção
  autenticada abriu o diálogo para um lead selecionado, exibiu a frase exigida e manteve a ação
  definitiva desabilitada; o diálogo foi cancelado sem remover dados.

## 2026-09-17 — Reserva do teste direto Z-API

- Causa confirmada para `whatsapp_test_reservation_failed`: depois de validar a instância, a Edge
  Function chamava a reserva idempotente e o PostgreSQL recusava `pg_catalog.coalesce/nullif`.
  Portanto, o fluxo falhava antes de criar a auditoria de reserva e antes de chamar `/send-text`.
- A migration aplicada no Supabase oficial é
  `20260917150914_fix_whatsapp_direct_test_reservation_special_forms`. Ela usa `coalesce` e
  `nullif` como formas especiais do PostgreSQL, mantendo locks, idempotência, `security invoker`
  e o grant apenas para `service_role`.
- A prova transacional devolveu `reserved` e foi revertida; a consulta posterior retornou zero
  registros de auditoria para o request de prova. Nenhuma mensagem, fila, lead, segredo ou chamada
  Z-API foi gerada nesta correção.
- Validação local: type-check frontend/Edge, lint, contrato de migration e build/artefato do Site
  aprovados. O Vitest não iniciou porque a junção local de `node_modules` leva a um diretório sem
  permissão de leitura pelo esbuild. Falta somente o teste externo controlado, no painel
  **Configurações > Canais > WhatsApp**, para comprovar aceite/entrega do provedor.
- PUBLICADO: Site oficial versão 83, commit `0f567b4836d6f5338873dd2605f648564db2ce57`, deploy
  `succeeded` e acesso público existente preservado.

## 2026-09-17 — Novo Lead: persistir como contato pendente

- O problema era exclusivamente anterior ao Supabase: no modo Ana, o formulário exigia duas
  confirmações e uma origem de autorização. Sem preencher a origem, `criarLead` retornava e o
  registro não era criado. Não havia duplicidade para os valores analisados e a sessão tinha
  `leads.create`.
- As confirmações foram removidas da tela. Ao salvar, o contato fica explicitamente pendente:
  telefone não é WhatsApp, não há consentimento declarado, a automação fica pausada e a Ana não
  é disparada. A guarda no mapper, Kanban, `ana-run` e worker permanece: canal comprovado e
  autorização são necessários antes do primeiro contato.
- Validação local: contrato de regressão direto, type-check frontend/Edge, lint e build passaram.
  Vitest não iniciou por restrição de leitura da junção `node_modules`; nenhum teste Vitest rodou.
  O formulário autenticado anterior foi fechado sem criar lead.
- PUBLICADO: Site oficial versão 84, commit `ddc4beb3a7cf6a909ea6fd6ed154d8230a25498a`, deploy
  `succeeded`. A sessão autenticada exibiu apenas o aviso de contato pendente; não havia caixas de
  confirmação nem campo de origem. O diálogo foi cancelado sem inserir um lead.

## 2026-09-17 — Lead manual com Ana: visibilidade correta no Kanban

- Diagnóstico do cadastro relatado: ele foi persistido com modo Ana, responsável atribuído e
  `contact_approval_status=pending`. O filtro do Kanban removia qualquer lead com
  `aguardandoAtivacao`, portanto o cartão não aparecia. Como o primeiro contato ainda não estava
  autorizado, o frontend também não chamou `ana-run`; banco confirmou zero mensagens, jobs e
  execuções. Não foi falha da Z-API ou do worker.
- O Kanban agora mostra esse lead em **Novo**, com aviso e selo de autorização pendente. O drawer
  explica o bloqueio e não permite Rodar, Retomar ou Devolver para Ana antes de comprovação de canal
  e autorização. A regra de bloqueio server-side continua igual.
- A migration `20260917175303_fix_pending_manual_lead_phone_identity` evita que um telefone seja
  copiado implicitamente para `whatsapp` e corrigiu somente o registro manual pendente afetado.
  Nenhum envio, job, execução, integração ou segredo foi acionado durante a correção.
- Validação pré-publicação: type-check frontend/Edge, lint, contrato direto de Kanban/migration e
  build/artefato do Site aprovados. Vitest não iniciou devido à permissão de leitura no destino da
  junção local de `node_modules`; nenhum caso Vitest foi executado.
- PUBLICADO: Site oficial versão 85, commit `48861eb7d79c8c5628f172f12d85c97f1b386c72`, com
  deploy `succeeded`. A inspeção autenticada confirmou Fabricio Gaspar / WF Digital em **Novo**,
  com IA, responsável atribuído, selo **Autorização pendente** e aviso de bloqueio do primeiro
  contato. Nenhum botão de Ana, mensagem ou job foi acionado.

## 2026-09-17 — Ana: apresentação inicial após envio ao Kanban

- O lead relatado não ficou parado por Z-API ou worker. O banco confirmou uma execução `lead.created`
  como `skipped` por `channel_not_allowed_by_ana_configuration`: tinha `active_channel=email`, e-mail
  desconectado e a versão ativa da Ana aceita somente WhatsApp. Por isso não havia mensagem nem job.
- Ao enviar um lead autorizado para o Kanban com Ana, o frontend agora promove explicitamente o
  telefone comprovado a WhatsApp como canal operacional; não infere autorização no cadastro manual.
  A mesma ação envia uma chave idempotente vinculada ao canal e informa bloqueio de modo explícito.
- `ana-run` v25 preserva todas as guardas existentes e, no primeiro contato autorizado em Novo sem
  histórico, usa a apresentação canônica da Wayflex, progride para Apresentado e cria a fila
  auditável. Não depende de modelo de IA para esse texto fixo.
- O reparo de dados alterou somente o canal do lead relatado para WhatsApp. O drawer do Kanban
  confirmou WhatsApp, automação ativa e Rodar Ana disponível. Nenhuma mensagem foi disparada nesta
  rodada: aguarda confirmação do operador imediatamente antes da ação externa.
- PUBLICADO: Site oficial versão 86, commit `7caa8903aa9c92b3d9ea5751ea50dd408e286374`, deploy
  confirmado como `succeeded`. Type-check frontend/Edge, lint e build passaram; Vitest não iniciou
  devido à permissão da junção local de `node_modules`.

## 2026-09-17 — Resposta recebida não chegou à Central

- O banco confirmou que o lead `Fabricio Gaspar · WF Digital` (final `1875`) tinha WhatsApp
  normalizado, autorização válida, apresentação enviada pela Ana e aceite de saída pela Z-API.
  Porém, após a criação do lead, não existia evento em `channel_inbound_events` nem
  `webhook_events` associado ao contato. A resposta informada pelo operador não atingiu o backend;
  por consequência, não havia mensagem para exibir na Central e o `ana-run` não foi chamado.
- O recadastro da entrada foi aceito pela Z-API para recebimento, entrega e status. Ele não enviou
  mensagem ao contato e não expôs segredo. A mensagem anterior não é recuperável, pois não foi
  entregue ao WayFlex.
- Publicadas no Supabase oficial: `configurar-integracao` v18 e
  `operational-diagnostics` v15, ambas com JWT obrigatório. Ao salvar uma rota Z-API diferente, o
  sistema preserva o token de callback, invalida a homologação anterior de forma auditável e exige
  recadastro. A tela passa a diferenciar esse caso de uma Ana ou lead com falha.
- Contratos de regressão foram adicionados para a mudança de rota e para o diagnóstico de
  credenciais alteradas. Type-check frontend/Edge e lint passaram; Vitest não pôde iniciar pela
  junção local de `node_modules` que o esbuild não consegue ler.
- Próxima prova necessária: enviar uma mensagem nova, individual, do WhatsApp final `1875` ao
  número da instância; então confirmar callback recebido, mensagem na Central e resposta da Ana.

## 2026-09-18 — Z-API chama o backend, mas de números diferentes do lead de teste

- Após o recadastro, a consulta confirmou que o lead final `1875` possui zero evento de entrada,
  zero mensagem recebida e zero execução `message.received` da Ana. Logo, não houve dado que a
  Central pudesse exibir nem pergunta que a Ana pudesse responder.
- O provedor, porém, está entregando callbacks: entradas individuais reais chegaram dos finais
  `0307` e `8864`, todas bloqueadas como `lead_not_matched`. A associação aproximada não foi
  habilitada; ela violaria a regra de identidade e poderia entregar uma conversa ao lead errado.
- A inconsistência visual foi corrigida em `operational-diagnostics` v17. Antes, ele só consultava
  `channel_inbound_events`, que só nasce depois do matching; agora consulta o evento auditado em
  `webhook_events` e informa que a mensagem chegou sem lead correspondente. A página autenticada
  confirmou esse estado após atualizar o diagnóstico.
- Type-check frontend/Edge e lint passaram. O Vitest segue impedido antes de iniciar pela junção
  local de `node_modules` sem acesso do esbuild. Nenhuma mensagem, exclusão ou edição de lead foi
  executada nesta correção.
- A única prova externa restante é enviar uma mensagem nova usando o WhatsApp final `1875`, em
  conversa individual para a instância Z-API. Ao chegar, o evento deverá criar a mensagem na
  Central e acionar `ana-run`; confirmar essas três evidências antes de considerar o fluxo pronto.

## 2026-09-18 — Ativação da Ana após cadastro manual: falha persistida agora é visível

- O cadastro relatado de `Fabricio Gaspar · WF Digital` foi criado no Supabase em **Novo**, com
  modo Ana, mas continuou com `contact_approval_status=pending`, sem WhatsApp operacional e sem
  qualquer atualização posterior. Banco confirmou zero `agent_runs`, `outreach_jobs` e mensagens:
  portanto a Ana não recusou o contato; ela jamais foi chamada.
- A origem da confusão era o fluxo em duas telas: Novo Lead cria um contato deliberadamente
  pendente, e a ativação precisa confirmar canal WhatsApp e autorização no diálogo **Enviar para
  Kanban**. O modal de criação agora abre esse diálogo de ativação imediatamente após a persistência
  bem-sucedida de um lead em modo Ana. A ação externa continua exigindo a confirmação factual do
  operador e uma origem de autorização; ela não é inferida do telefone.
- O repositório de leads agora confirma que o `UPDATE` atingiu exatamente o registro esperado.
  Atualização bloqueada por RLS ou que não retornar linha gera `lead_update_not_persisted`; a UI
  desfaz o estado otimista, informa que a Ana não foi acionada e não chama `ana-run`. Isso elimina
  o falso sucesso que deixava o lead visualmente ativado sem persistência no servidor.
- Regressão incluída para o contrato de confirmação de atualização. Type-check frontend/Edge,
  lint e build do Site passaram. O Vitest não iniciou porque o esbuild não tem permissão para ler o
  destino da junção local de `node_modules`; nenhum teste Vitest foi contabilizado como aprovado.
- PUBLICADO: Site oficial versão 90, commit `255217ca478e68eec3cadfbcfa1a6fd10cb4f010`, com
  deploy `succeeded` em `2026-09-18T13:36:04Z`. O acesso público existente foi preservado.

## 2026-09-18 — Central de Atendimento: Realtime, contexto comercial e visual de conversa

- A Central recebeu uma superfície de atendimento em três áreas: caixa de conversas com filtros,
  chat com composição inspirada no WhatsApp e contexto comercial do lead. Notas internas,
  handoff humano/Ana, opt-out, fila humana auditável e a trilha de entrega existentes foram
  preservados.
- A atualização de novas mensagens não depende mais de F5: a tela assina `lead_messages` pelo
  Realtime do Supabase com filtro da organização autenticada e relê a fonte operacional após cada
  evento. O selo só mostra **Atualização ao vivo** depois de `SUBSCRIBED`; se o WebSocket estiver
  indisponível, uma atualização automática de recuperação permanece ativa e é exibida como tal.
- O painel contextual liga o mesmo lead à Agenda e aos Orçamentos. Ambos recebem o identificador
  no endereço e abrem somente o formulário pré-selecionado; compromisso, proposta e mensagem não
  são criados automaticamente. O envio de orçamento continua passando pela preparação e pela fila
  segura da Central.
- Validação local: type-check frontend e Edge, lint e build/artefato do Site aprovados. A suíte Vitest
  foi executada com `--configLoader runner`: 193 de 194 testes passaram. A única falha é o contrato
  pré-existente de diagnóstico Z-API `requires a fresh callback registration after the Z-API
  callback route changes`, fora dos arquivos deste lote. Não houve mensagem externa, alteração de
  lead, execução da Ana nem mudança de integração nesta alteração.
- PUBLICADO: Site oficial versão 91, commit `14468b0998a455a8220ae9200ea4d428b35fa894`, deploy
  `succeeded` em `2026-09-18T14:43:16Z`. A inspeção autenticada confirmou o selo **Atualização ao
  vivo**, o histórico operacional existente e os controles da Central, sem enviar mensagem ou
  alterar registro.

## 2026-09-18 — Ana responde pedido de reunião com handoff humano aberto

- A mensagem do lead final `1875` foi recebida, exibida na Central e acionou a Ana. A primeira
  execução falhava na auditoria porque `ana-run` usava `domain_events.actor_type='agent'`, valor
  rejeitado pelo check do banco. A função publicada `ana-run` v28 usa `ai`.
- Para pedido de reunião sem data e horário, a Ana não agenda nem promete disponibilidade: envia
  uma confirmação curta e mantém o handoff humano aberto para o consultor confirmar horários.
  Esta exceção é limitada a jobs internos `meeting_confirmation`; opt-out, conteúdo comercial
  sensível, orçamento, preço, prazo e demais guardas continuam bloqueando o envio automático.
- `automation-worker` v27 reconhece esse marcador nas verificações inicial e final. A resposta
  foi aceita pela Z-API e aparece na Central como **aceita pelo provedor**. Ainda não há prova de
  entrega ou leitura; não afirmar além do aceite do provedor.
- Validação: type-check frontend/Edge, lint e build passaram; Computer Use autenticado confirmou
  a conversa, a nova resposta da Ana e o estado transferido para humano. Nenhuma credencial foi
  exposta.

## 2026-09-18 — Dashboard: painel de atenção do vendedor compacto

- O card foi reorganizado como uma fila comercial compacta: somente categorias com itens reais
  ficam visíveis, com até duas ações por categoria e um acesso claro para ver o restante na
  Central de Atendimento.
- A prioridade é exclusiva: um mesmo alerta aparece apenas na categoria mais importante, evitando
  repetições entre urgência, lead quente e reunião/orçamento. Os ícones identificam responder,
  interesse, ação comercial, acompanhamento e atraso.
- A origem dos dados e os comportamentos operacionais foram preservados; não foram alteradas
  filas, automações, regras da Ana, integrações ou registros.
- Validação local: type-check frontend, lint e build Vite aprovados.

## 2026-09-18 — Transferência programada da Ana para um vendedor

- O envio ao Kanban agora grava uma política operacional real, e não apenas uma seleção visual:
  o administrador define o usuário humano de destino e a etapa canônica em que a Ana deve
  transferir o atendimento (**Novo**, **Apresentado**, **Qualificando**, **Reunião** ou
  **Orçamento**). A política é persistida por lead e aparece em leituras posteriores.
- Ao atingir a etapa configurada, `ana-run` v29 pausa a Ana, cria o handoff e a tarefa para o
  usuário escolhido e registra o evento que alimenta a notificação interna. Não é criado novo
  envio ao lead por essa configuração.
- Em **Configurações > Usuários**, cada administrador pode habilitar opcionalmente o aviso de
  transferência por WhatsApp e registrar o telefone do próprio usuário. O aviso é enfileirado de
  forma auditável e só o `automation-worker` v28 pode despachá-lo após as verificações existentes
  de Ambiente Real, integração Z-API e política de risco. O telefone não é exposto à interface
  depois de salvo.
- Migration oficial `20260918185000_handoff_assignee_and_whatsapp_alerts` aplicada no Supabase
  `thgzrkppouoevapjquyu`. A verificação de privilégios confirmou que usuários autenticados podem
  chamar apenas a RPC controlada; não podem ler nem inserir na fila de avisos. A fila estava vazia
  durante a validação, portanto nenhum WhatsApp foi enviado.
- Regressão: 5 testes Vitest passaram com `--configLoader runner`; type-check frontend/Edge, lint
  e build Vite também passaram. Edge Functions publicadas: `team-members` v8, `ana-run` v29 e
  `automation-worker` v28. O teste de envio real permanece pendente de confirmação específica do
  operador, pois ele geraria uma mensagem externa.
## 2026-09-21 — Ativação da Ana no Kanban: persistência atômica

- Diagnóstico reproduzido em um lead de homologação autorizado: depois de confirmar WhatsApp e
  origem no diálogo **Enviar para o Kanban**, a linha permanecia com `active_channel=voice`,
  `contact_approval_status=pending`, sem `agent_runs`, `outreach_jobs` ou mensagens. Portanto a
  Ana não era chamada e nenhum envio chegava ao provedor.
- Causa: a tela atualizava o estado local e dependia de uma segunda persistência do navegador antes
  de chamar `ana-run`. Quando essa persistência não se confirmava, o fluxo ficava parado entre o
  Kanban e a automação, embora os controles do modal estivessem preenchidos.
- Correção preparada: `lead-workflow.start_ai` passa a validar a autorização explícita, normalizar
  o WhatsApp, gravar canal, consentimento, dono, modo e etapa **Novo** no servidor e só então
  delegar a execução canônica `lead.created` para `ana-run`. A tela usa esse único comando e relê
  a fonte operacional; não há inferência de consentimento nem automação paralela.
- Validações locais: type-check frontend e Edge, lint, build Vite e 10 testes direcionados passaram
  com `--configLoader runner`. Falta publicar a tela, testar a ação na UI e obter nova confirmação
  imediatamente antes de qualquer apresentação real ao número autorizado.

## 2026-09-21 — Ativação sem handoff: correção complementar

- Evidência no diálogo de Kanban: o acionamento de **Ana conduz tudo** podia aguardar a RPC de
  política de transferência, embora não existisse etapa nem vendedor humano a configurar. O botão
  permanecia aberto e nenhuma chamada de ativação chegava ao Supabase.
- A tela agora só grava política quando há etapa e vendedor selecionados. Quando a Ana conduz todo
  o funil, `lead-workflow.start_ai` v5 remove no backend uma política antiga e continua a mesma
  ativação canônica para `ana-run`, com auditoria.
- Regressão: type-check, lint, build Vite e 86 testes direcionados passaram. A prova de entrega
  continua sendo o aceite da Z-API; a função publicada não é uma alegação de mensagem entregue.

- Homologação autenticada executada: a tela ativou o lead com `active_channel=whatsapp`,
  `contact_approval_status=approved` e a Ana concluiu `lead.created`, criando o rascunho e o job
  WhatsApp. O worker não enviou ao provedor porque registrou `outside_business_hours` conforme a
  política `businessHoursOnly=true`. A fila permanece aguardando a próxima janela permitida.

## 2026-09-22 — Provedores da Busca de Leads sem duplicidade visual

- A repetição de **Apify — Google Maps** e **Google Places** em **APIs** e **Fontes** não era
  duplicidade de dados: `integrations` registra credencial, teste e disponibilidade do provedor;
  `lead_source_configs` é a trava operacional adicional que `prospectar-leads` exige antes de
  consultar uma fonte. Remover a segunda guarda do banco enfraqueceria a proteção da busca.
- A duplicidade de interface foi removida. **Configurações > APIs > IA e provedores de busca** é
  agora o único local para configurar, testar e ativar/pausar cada provedor na Busca de Leads.
  O item de menu **Fontes** foi retirado; `?tab=fontes` continua abrindo APIs para preservar links
  existentes. O card **Fontes** do Dashboard é apenas leitura de status e aponta para APIs.
- Nenhuma credencial, configuração remota, regra de busca, Edge Function, lead, mensagem ou fila
  foi alterada. Validação local: type-check frontend/Edge, lint, suíte Vitest completa (26
  arquivos/203 testes) e build/artefato Sites aprovados. **Publicado** no Site oficial como
  versão 103, commit `ed5632b2a64e8e154b99f0e9f09063d7f1532681`; a inspeção autenticada
  confirmou o menu consolidado, o estado ativo da Apify e a compatibilidade de `?tab=fontes`.

## 2026-09-22 — Operação automática da Ana: agenda, destino e validação

- **Configurações > Ana > Operação automática** passou a explicitar o destino de cada lead
  encontrado: a própria Ana, um vendedor humano específico ou rodízio apenas entre usuários ativos
  selecionados. A distribuição genérica pela organização não é mais usada pela rotina nova.
- No modo Ana, o administrador pode escolher a etapa canônica de transferência e o vendedor que
  assumirá. O worker cria a mesma política de handoff por lead que o Kanban já utiliza; o aviso por
  WhatsApp só é permitido quando o número do usuário já estiver configurado e habilitado.
- A ativação valida agenda, limites, autorização do Apify, usuários e transferência antes de
  enviar a configuração. O backend repete essas validações e a checagem de permissões: o frontend
  não é a fonte de autoridade.
- O indicador de entrada foi corrigido para consultar a integração operacional `zapi_webhook`.
  Portanto, a tela não vai mais mostrar WhatsApp de entrada saudável com base no identificador
  legado. Se ele permanecer pendente, o modo Automático fica bloqueado de forma segura.
- A ação **Simular sem enviar** registra apenas uma execução/auditoria interna: não consulta Apify,
  não chama IA e não envia WhatsApp. Ela serve para validar a agenda e a trilha de execução antes
  da ativação externa.
- Migrations oficiais `20260922113000_ana_automatic_routing_and_validation` e
  `20260922120000_prospecting_schedule_assignment_fk_indexes` adicionaram os campos de rota e
  handoff a `prospecting_schedules` e os índices completos de suas chaves estrangeiras, sem tabela
  pública nova. Funções publicadas: `ana-operations` v2 e `automation-worker` v29.
- Validações locais aprovadas: type-check frontend/Edge, lint, 27 arquivos/206 testes Vitest,
  build Vite e artefato Sites. **Publicado** no Site oficial como versão 104, commit
  `cdccad27ee9940a7e99a829ac38e87652c2ee693`. A inspeção autenticada confirmou agenda, roteamento,
  transferência, estados reais dos pré-requisitos e uma execução `simulated` com zero candidatos e
  zero importados. Nenhum provedor externo foi chamado nesta implementação.

## 2026-09-22 — Estado factual de Canais, APIs e Fontes de busca

- O diagnóstico do Supabase confirmou estados distintos que a interface resumida antes misturava:
  saída WhatsApp e Apify possuem configuração salva, mas a validação de 24 horas venceu; a IA da
  Ana e o agendador possuem confirmação recente; Google Places não está configurado; a entrada
  Z-API recebeu callback, porém sem lead WhatsApp correspondente (`lead_not_matched`).
- O frontend agora reaproveita a regra de frescor de 24 horas já usada por
  `operational-diagnostics`. Dashboard e Configurações exibem **Validada**, **Validação vencida**,
  **Entrada pendente**, **Pausada**, **Erro de conexão** ou **Não configurada**, sem reduzir tudo
  para “Conectado/Desconectado”.
- O resumo do Dashboard é filtrado pelos únicos caminhos disponíveis no CRM atual: saída e entrada
  WhatsApp; IA, Apify e Google Places; Apify, cadastro manual e CSV. Linhas legadas preservadas no
  banco não aparecem como integrações operacionais ou fontes utilizáveis.
- Em **Configurações > Canais**, o novo cartão de entrada Z-API é somente leitura e aponta para o
  diagnóstico completo. O teste real continua exclusivamente no cartão de saída WhatsApp, portanto
  esta melhoria não faz chamada ao provedor, não recadastra webhook e não envia mensagem.
- Validação local: type-check frontend/Edge, lint, 28 arquivos/210 testes Vitest e build/artefato
  Sites aprovados. Nenhuma credencial, configuração, lead, fila, execução da Ana ou mensagem foi
  alterada por este lote. A versão publicada e a inspeção autenticada devem ser anexadas após o
  deploy oficial.

## 2026-09-22 — Estados de canais, APIs e fontes sem informação histórica enganosa

- A camada visual passou a usar a mesma janela de validação de 24 horas do diagnóstico server-side.
  Uma credencial persistida não é mais chamada de válida apenas porque houve um teste antigo.
- No momento da auditoria: saída WhatsApp e Apify tinham **validação vencida**; IA da Ana estava
  **validada**; Google Places estava **não configurada**; a entrada Z-API estava **pendente** porque
  recebeu callback sem encontrar um WhatsApp cadastrado (`lead_not_matched`). Esses estados foram
  lidos; nenhum provedor foi chamado para confirmá-los novamente.
- Dashboard mostra somente caminhos atuais: WhatsApp saída/entrada, IA, Apify, Google Places,
  Apify como fonte, cadastro manual e CSV. Linhas legadas continuam preservadas no banco sem
  aparecer como integração ou fonte operacional ativa.
- Canais ganhou leitura específica de entrada Z-API; APIs mantém editar, testar e ativar/pausar
  somente onde existe operação server-side. Não foi adicionado botão de exclusão para credenciais
  pois não há endpoint de ciclo de vida seguro nem confirmação explícita do operador.
- A descrição dos cartões agora respeita o selo factual. Por exemplo, um retorno antigo de teste
  Z-API não pode dizer que o canal está validado quando a validação já venceu.
- Verificação concluída: type-check frontend/Edge, lint, Vitest completo (28 arquivos/211 testes),
  build/artefato Sites, Dashboard/Canais/APIs em desktop e mobile e console sem warnings/errors.
  Nenhum lead, mensagem, fila, credencial, configuração remota ou execução da Ana foi modificado.

## 2026-09-23 — Reparo do despachante server-side de apresentações da Ana

- A causa da apresentação permanecer em fila foi comprovada no banco: o cron era disparado a
  cada minuto, mas a requisição HTTP recebia `401 UNAUTHORIZED_NO_AUTH_HEADER` antes de entrar
  em `automation-worker`. O cron não possui sessão de usuário; a versão publicada mantinha a
  checagem de JWT do gateway ligada, apesar de o handler já validar o token rotativo por
  organização guardado no Vault.
- `automation-worker` foi republicada como v30 com `verify_jwt=false`, conforme
  `supabase/config.toml`. A função não se tornou pública: chamadas do cron continuam exigindo o
  token rotativo do Vault, e chamadas manuais continuam exigindo sessão autenticada e papel
  administrativo no próprio handler.
- Homologação controlada: o job WhatsApp pendente foi consumido uma única vez; a Z-API aceitou
  a mensagem, o histórico foi marcado como enviado e o lead foi associado ao estágio canônico
  **Apresentado**. Não houve evidência de callback de entrega/leitura neste teste, portanto o
  aceite do provedor não é apresentado como confirmação de entrega.
- Validações locais: type-check frontend/Edge, lint, Vitest completo (28 arquivos/211 testes)
  e build/artefato Sites aprovados. O carregador padrão de Vite/Vitest encontrou limitação de
  permissões do Windows neste checkout; a execução com `--configLoader runner` foi aprovada.

## 2026-09-23 — Catálogo visual de produtos, segmentos e catálogos

- As três fontes públicas oficiais foram tratadas separadamente. A página de acessórios forneceu
  18 produtos e a de catálogos forneceu 17 cards visuais pelos módulos publicados da SPA. A página
  de serviços é apresentada pela origem como segmentos/aplicações e seus 18 cards foram
  registrados como snapshot público rastreável, pois não há feed estruturado publicado para a
  atualização automática desses cards.
- `catalog-knowledge` v6 preserva a URL canônica, imagem e payload de origem em cada item e usa
  uma referência derivada determinística por card para que o trigger gere documentos/chunks sem
  conflitar com a unicidade de `documents.source_url`. A sincronização oficial concluiu com 56
  documentos/chunks ativos para a Ana.
- O painel Empresa e conhecimento agora exibe cards responsivos com imagem, categoria, origem e
  estado da Ana; a Central continua preparando conteúdo pela fila homologada e mostra a mesma
  imagem/categoria. Formatos rápido, comercial e técnico passam a incluir nome e resumo antes do
  link oficial. `ana-run` v32 usa a mesma política/autoridade, com recuperação lexical de plurais
  e orientação para citar até três exemplos verificáveis antes de uma URL.
- Não existem PDFs individuais publicados nas páginas atuais. Imagens e catálogos permanecem
  links rastreáveis à origem; não foi criada uma cópia de mídia nem prometido envio de anexo.
- Validação: type-check frontend/Edge, lint sem warnings, Vitest completo (28 arquivos/214
  testes), build Vite e artefato Sites aprovados. Não foram enviados WhatsApps, nem alterados
  leads, filas, canais, credenciais ou regras operacionais de automação.

## 2026-09-23 — Imagem oficial de catálogo pela Z-API

- O envio de mídia foi incorporado ao caminho já homologado de texto, sem atalho no frontend:
  **Central → enviar-whatsapp → outreach_jobs → automation-worker → Z-API**. A UI só envia o ID
  do item e a escolha explícita; o worker consulta novamente a base de conhecimento no momento do
  despacho.
- A migration `20260923133000_catalog_media_whatsapp_queue` foi aplicada no projeto oficial
  `thgzrkppouoevapjquyu`. Ela registra a imagem no anexo da mensagem, preserva a rastreabilidade e
  impede anexo duplicado para a mesma mensagem. Não alterou leads, filas existentes ou credenciais.
- A Central permite incluir imagem de produto, serviço ou catálogo ao preparar a mensagem. A Ana
  só pode anexar uma imagem em resposta recebida via WhatsApp quando houver correspondência lexical
  forte, item ativo aprovado, ausência de orçamento/handoff/risco e a nova opção estiver habilitada
  em **Configurar a Ana**. A opção nasce desabilitada; a apresentação institucional inicial segue
  texto.
- `ana-ia` v10, `enviar-whatsapp` v8, `ana-run` v33 e `automation-worker` v31 estão ativos. O
  worker usa o endpoint oficial `send-image` somente após revalidar canal, aprovação, item, anexo
  e URL HTTPS pública. Se a imagem mudou ou não for segura, o job falha antes do provedor; ele não
  troca a mídia nem a envia como texto sem revisão.
- Validação local: type-check frontend/Edge, lint, 29 arquivos/221 testes Vitest, build Vite com
  `--configLoader runner` e artefato Sites aprovados. A build padrão encontrou apenas a limitação
  de permissão conhecida do Windows no cache `.vite-temp`; o runner resolveu sem alterar código.
  Nenhum WhatsApp de mídia foi enviado. Falta a homologação controlada para comprovar aceite,
  entrega e leitura no provedor.

## 2026-09-23 — Correção da seleção condicional de imagem pela Ana

- Fato comprovado: depois de habilitar imagens na versão publicada da Ana, uma pergunta explícita
  sobre **Fita PTFE expandido auto-adesivo** produziu resposta textual, mas não produziu anexo ou
  job de mídia. O item estava ativo, com imagem HTTPS pública, rastreabilidade e aprovação da Ana;
  não houve requisição de mídia à Z-API para ela aceitar ou rejeitar.
- `ana-run` v34 mantém a política conservadora e acrescenta somente uma contingência para encontrar
  pelo nome explícito o mesmo item já aprovado no catálogo. O candidato ainda precisa passar pela
  seleção determinística existente. A imagem não é enviada em toda resposta e continua bloqueada
  em saudação, ambiguidade, orçamento, handoff humano, canal fora do WhatsApp ou URL insegura.
- Cada execução passa a gravar `result.catalog_media` com a elegibilidade, seleção e origem
  (`context` ou `exact_name_fallback`), permitindo diferenciar ausência de correspondência de
  falha posterior de fila/provedor sem registrar mensagem do cliente ou URL de mídia no log.
- Validações aprovadas: type-check frontend/Edge, lint, Vitest completo (29 arquivos/222 testes),
  build Vite e artefato Sites. Nenhuma mensagem, callback, job ou lead existente foi reprocessado.
  Próxima homologação: enviar uma nova pergunta explícita, confirmar o anexo e o aceite da Z-API;
  entrega/leitura só devem ser afirmadas se o provedor devolver esses eventos.

## 2026-09-23 — Consolidação visual da Central de Atendimento

- A Central deixou de manter o mesmo contexto comercial em vários cards e botões. O desktop usa
  um painel direito único, com abas **Lead**, **Conhecimento**, **Orçamentos** e **Agenda**; o chat
  ficou mais largo e a barra superior conserva apenas ações da conversa (assumir/devolver Ana e
  transferir).
- Conhecimento, orçamento e agenda continuam usando exatamente os mesmos handlers: o catálogo
  somente prepara conteúdo revisável para a fila, orçamento mantém o modal existente e agenda
  abre a rota do lead selecionado. Não houve mudança em Supabase, Ana, mensagens, fila ou regras.
- Em tablet/mobile, o painel é aberto como drawer e inclui as mesmas abas mais **Histórico**.
  Se o usuário alternar de mobile para desktop com Histórico selecionado, o painel desktop volta ao
  resumo do lead para não exibir uma área vazia.
- Validações locais: type-check frontend, lint da Central, Vitest completo (29 arquivos/222
  testes), build Vite e artefato Sites aprovados. A validação publicada confirmou o drawer
  responsivo com as abas e o carregamento do conhecimento comercial real, sem envio ou alteração
  operacional para este lote.

## 2026-09-23 — Confiabilidade operacional da Central de Atendimento

- O compositor passou a validar explicitamente mensagem vazia, ausência de lead, canal diferente
  de WhatsApp e destinatário inválido antes de acionar `enviar-whatsapp`. O botão permanece
  desabilitado sem texto e a interface informa se a mensagem foi aceita, enfileirada para
  reconciliação ou rejeitada. O caminho operacional não mudou: **Central → fila auditável → worker
  → Z-API**.
- `Assumir` deixou de reutilizar um destino implícito do lead. A migration
  `20260923170000_explicit_central_handoff_assignee` acrescenta a RPC
  `assign_human_handoff`, que usa o usuário autenticado para assumir e exige a escolha explícita
  de um membro ativo com permissão de responder para transferir. Ela preserva o handoff canônico,
  pausa a Ana e mantém o histórico do lead; não altera leads ou filas existentes até uma ação do
  operador. Foi confirmada no projeto `thgzrkppouoevapjquyu` como `SECURITY DEFINER`, sem execução
  para `anon` e com execução somente para `authenticated`.
- O painel lateral foi simplificado para **Conhecimento da empresa**: abas horizontais compactas,
  detalhe na própria coluna, formatos rápido/comercial/técnico de produto e preparação revisável.
  Sugestões automáticas usam somente a última pergunta recebida do cliente, requerem
  correspondência verificável e não apresentam páginas institucionais genéricas como recomendação.
  Arquivos só aparecem quando houver documentos reais.
- Validações locais aprovadas: type-check frontend e Edge, lint, Vitest completo (30 arquivos/225
  testes), Vite build com `--configLoader runner` e artefato Sites. A build padrão permanece
  limitada apenas pela permissão conhecida do Windows em `.vite-temp`. Nenhum WhatsApp, lead,
  handoff, transferência, orçamento ou opt-out foi disparado nesta correção.
- Publicação oficial: versão **113** do Site. A validação visual autenticada confirmou o envio
  desabilitado sem texto, o painel de conhecimento carregando 56 itens reais sem sugestões
  genéricas e a transferência com destinatário vazio por padrão e confirmação desabilitada até a
  escolha explícita. O console da Central não registrou erros. Essa validação não enviou mensagem,
  não transferiu atendimento e não alterou dados operacionais.

## 2026-09-23 — WhatsApp corporativo e contas operacionais por vendedor

- A conta Z-API corporativa existente permanece padrão e fallback; nenhum fluxo homologado foi
  substituído. `whatsapp_accounts` guarda apenas metadados e referencia a integração cujos segredos
  continuam no Vault. Leads e todos os registros do ciclo de mensagem carregam a conta usada.
- O administrador configura uma instância Z-API já existente em **Configurações > Usuários >
  WhatsApp operacional** e mantém visão global. O vendedor com permissões explícitas acessa **Meu
  WhatsApp** para conectar apenas sua conta com o SDK oficial, QR/telefone e token descartável.
- A resolução de conta é server-side: responsável com conta saudável, senão corporativa. Depois do
  primeiro vínculo, a conversa não troca de remetente silenciosamente. Entrada usa matching limitado
  à conta receptora e bloqueia ambiguidade; saída valida conta, integração e organização no worker.
- `ana-run` permanece a única autoridade automática. Simulação ou bloqueio não fixa conta; uma
  execução real fixa a conta imediatamente antes da mutação e a inclui na fila auditável.
- Produção Supabase: migrations `20260923193000_multi_whatsapp_seller_accounts` e
  `20260923214500_multi_whatsapp_fk_indexes`; versões `whatsapp-accounts` v1, `team-members` v9,
  `enviar-whatsapp` v9, `ana-run` v35, `automation-worker` v32 e `webhook-whatsapp` v18.
- Verificação aprovada: type-check frontend/Edge, lint, build Vite, artefato Sites e Vitest completo
  (31 arquivos/227 testes). Não houve envio, webhook artificial, alteração de lead nem criação de
  instância/plano. O estado auditado não possui vendedor ou instância individual; a primeira conexão
  QR e o fluxo ponta a ponta individual continuam como homologação externa obrigatória.
- Publicado no Site oficial como versão **115**, commit
  `a5f2dcf04d72ba2fe26ff7812650dd0dc672b6fc`. A inspeção autenticada validou a conta corporativa
  conectada, o acesso administrativo global, **Meu WhatsApp**, o cadastro por usuário, o formulário
  sem criação de plano/envio e a Central identificando o canal corporativo. Em largura móvel, a
  tabela permanece contida por rolagem horizontal sem overflow global. Console sem warning/error.
  Nenhuma configuração foi salva, QR aberto, mensagem enviada ou dado operacional alterado.

## 2026-09-24 — Fundação Meta WhatsApp Coexistence com rollout fechado

- O fluxo em produção continua nas duas contas Z-API conectadas. A nova integração Meta Cloud foi
  adicionada por `MessagingProvider`, sem substituir fila, webhook, worker ou credenciais Z-API.
- Banco oficial: migrations `20260924160000_meta_coexistence_foundation`,
  `20260924161500_meta_coexistence_hardening` e
  `20260924163000_meta_coexistence_message_integrity`. Elas criam onboarding, conversas, ledger
  sanitizado, recibos fora de ordem, outbox idempotente, sincronização, templates, rate cards,
  roteamento e gates independentes por organização/provedor.
- Edge Functions ativas: `webhook-meta-whatsapp` v2, `meta-whatsapp-onboarding` v1,
  `meta-whatsapp-messages` v1, `meta-whatsapp-worker` v2 e `whatsapp-accounts` v2. O webhook exige
  HMAC; onboarding/mensagens exigem JWT; worker exige token interno. Segredos ficam no Vault.
- Estado comprovado após a implantação: projeto `thgzrkppouoevapjquyu` ativo e saudável, duas
  contas Z-API conectadas, zero conta Meta, zero onboarding, zero evento Meta, zero outbox; três
  flags Meta desligadas e três controles com entrada/saída/automação desligadas e kill switch ligado.
- Validação local aprovada no commit `02052abc235ef211787f713a5185d4203fe7a491`: type-check
  frontend/Edge, lint sem warnings, Vitest 35 arquivos/237 testes, build Vite e artefato Sites.
  Probes públicos recusaram webhook sem assinatura, rotas sem JWT e worker sem token.
- Próximo gate: configurar Meta App/WABA em ambiente de teste, escolher um número autorizado que
  não seja simultaneamente remetente/destinatário, homologar Embedded Signup, histórico, eco do app,
  entrada, saída, status e templates. Nenhuma mensagem real foi enviada nesta etapa.
- A sincronização para a branch remota `sync/site-production-2026-09-24` ainda depende de autenticar
  o GitHub neste host. A branch local foi preservada e `main` não sofreu reset, rollback ou troca.
- Publicação oficial concluída: commit `cdc7317afca23dbdd7d941fab5f82ac8cc60dcbe`, Site versão
  **116**, deploy `succeeded` no projeto existente `appgprj_6a905559159c8191a61fb776b9a4c531`.
  A URL pública foi preservada e o título do projeto passou a **Sistema de Leads**.

## 2026-09-25 — Exposição segura da configuração Meta

- A organização **WayFlex** recebeu `meta_coexistence=true` exclusivamente para mostrar o painel
  de cadastro oficial da Meta em **Configurações > Canais > WhatsApp**.
- Comprovação posterior: `meta_accounts=0`, `inbound_enabled=false`, `send_enabled=false`,
  `automation_enabled=false` e `kill_switch=true`. Não houve envio, entrada, execução da Ana,
  alteração de conta Z-API ou exposição de segredo.
- Para o teste real, o administrador deve concluir o Embedded Signup no painel com App Meta, WABA
  e número empresarial autorizado. Depois será necessária homologação controlada antes de liberar
  qualquer um dos três controles operacionais.

## 2026-09-25 — Painel Meta no módulo correto

- Causa confirmada para o painel invisível: `MetaCoexistencePanel` existia, mas era renderizado
  somente em **Meu WhatsApp** e no modal de usuário. **Canais > WhatsApp** não o montava.
- Correção publicada em preparação: `IntegracoesOperacaoTab` reutiliza
  `WhatsappAccountPanel mode="meta"`, exibindo a configuração corporativa Meta em
  **Configurações > Canais > WhatsApp e atendimento**. As telas de usuário conservam o painel
  completo, sem duplicar Z-API ou criar nova rota.
- Validações: type-check frontend, lint sem warnings, Vitest 35/237, build Vite e artefato Sites.
  A configuração Meta permanece sem conta conectada e com controles operacionais fechados.

## 2026-09-25 — Alternância explícita Z-API / Meta no WayFlex

- **Configurações > Canais > WhatsApp e atendimento** passou a exibir **Z-API** e **Meta WhatsApp
  Cloud API** lado a lado, cada qual com status, caminho de configuração e ação administrativa de
  ativar/desativar. Apenas um provedor corporativo pode ficar operacional por vez para não haver
  roteamento ambíguo.
- A decisão é server-side: `messaging_provider_controls` bloqueia entrada, saída e Ana; a RPC
  `resolve_lead_whatsapp_account` agora recusa contas e provedores desligados. O webhook Z-API
  confirma callbacks desativados sem gravar, encaminhar ou reativar a conta. Teste direto e teste
  de conexão preservam o estado desativado.
- Por solicitação explícita do administrador, a **Z-API foi desativada somente no WayFlex**: uma
  conta corporativa, a integração de saída e a integração de webhook foram pausadas; não havia
  jobs pendentes. Instância remota, credenciais Vault e histórico foram preservados. Meta continua
  sem conta conectada e com seus controles fechados; o próximo passo é concluir Embedded Signup e
  homologar entrada antes de ativá-la.
- Supabase oficial: migration `20260925150000_whatsapp_provider_activation_controls`; funções
  `whatsapp-accounts` v4, `webhook-whatsapp` v19, `enviar-teste-whatsapp` v3,
  `testar-integracao` v15 e `operational-diagnostics` v18. Nenhuma mensagem foi enviada.
- A ativação de um provedor também desativa e pausa as contas e integrações corporativas do outro;
  a troca não deixa dois canais de saída concorrentes. Ao reativar Z-API, o webhook interno é
  retomado sem considerar a entrada homologada até um callback real.
- Validações locais: type-check frontend/Edge, lint sem warnings, Vitest completo **35 arquivos /
  238 testes**, build Vite e artefato Sites. Inclui regressão que garante que o teste direto não
  chama a Z-API quando o administrador a desativa.

## 2026-09-26 — WayFlex Command Center multitelas

- Aplicada hierarquia visual consistente a Dashboard, Busca, Leads, Kanban, Central, Catálogo, Ana, Configurações, Orçamentos, Agenda, Relatórios e Equipe. O Dashboard apresenta quatro KPIs, prioridade comercial sem somar duas vezes o mesmo lead, sete etapas do pipeline, até cinco próximas ações e seis leituras operacionais.
- Estados de carga/erro impedem que zeros e selos positivos sejam mostrados como dados confirmados antes de consultar a fonte; detalhes ficam em ícones de informação acessíveis por teclado e toque. O Catálogo usa itens reais, com edição existente e rótulo Rascunho para item ainda não ativo.
- Sem alteração de regras de negócio, rotas, integrações, dados remotos, automação ou envio. Type-check frontend/Edge e build/Sites passaram. Oito asserções relevantes apareceram como aprovadas, mas o Vitest não encerrou; o processo foi interrompido, sem afirmar aprovação da suíte completa. Inspeção visual autenticada depende da versão publicada e da sessão do cliente.
- Checkpoint de código `2e8452ea7d021a83faa8bf45284963d3eaeb54d9`; publicação pendente no momento deste registro.

## 2026-09-26 — Busca de Leads: revisão compacta e proteção de repetição

- A tela **Busca de Leads** foi compactada para o fluxo direto: fonte Apify ativa, localidade,
  termos explícitos, volume, revisão por filtros e importação. Não foram alteradas rotas, regras
  de pipeline, autoridade da Ana, canais ou automações. Um rascunho de prompt permanece somente
  rascunho e não inicia busca.
- A busca nova exige cidade e ao menos um termo, limita termos únicos a dez e normaliza a chave de
  filtros. Antes de chamar o provedor, a função reserva uma execução por organização, fonte,
  modo, escopo e idempotência. Estados ambíguos permanecem como não confirmados e nunca autorizam
  um segundo POST ao Apify.
- Banco oficial: migrations `20260926130000_prospecting_run_idempotency` e
  `20260926131000_prospecting_legacy_recovery` aplicadas. A Edge Function
  `prospectar-leads` está na versão **16**, ativa e com JWT obrigatório. A leitura imediatamente
  anterior à publicação encontrou zero execução Apify em andamento.
- O CSV usa a RPC atômica já existente. Linhas inválidas interrompem o lote; contatos entram com
  aprovação pendente, sem inferir WhatsApp e sem iniciar a Ana. Dados de contato do CSV não são
  mantidos em `sessionStorage`: uma resposta incerta pode ser confirmada pelo mesmo payload
  enquanto a página estiver aberta; após recarga, o mesmo arquivo gera a mesma chave do lote e
  bloqueia uma segunda gravação automática se houver divergência, exigindo reconciliação.
- A revisão visual ficou mais objetiva e acessível: seletor em lote respeita o filtro visível,
  telefone não é apresentado como WhatsApp, o drawer tem Escape, foco inicial e contenção de Tab,
  e os textos descrevem somente evidências efetivamente retornadas pela fonte.
- Validação local aprovada: type-check frontend/Edge, lint sem warnings, Vitest completo
  **44 arquivos / 278 testes**, build Vite e artefato Sites. Não foram executadas busca Apify,
  importação CSV, criação de lead, automação Ana ou mensagem WhatsApp durante esta etapa.
- Publicação oficial concluída no Site existente: versão **132**, commit
  `5fe475de2c6cb1eb34cf581fddee5a0364f0ecdb`, deploy `succeeded`. A verificação autenticada
  confirmou a tela publicada com fonte conectada, localidade, termos vazios por padrão e botão de
  busca bloqueado até critérios mínimos; o console não apresentou warning ou erro. Nenhuma ação
  operacional foi executada nessa validação.
