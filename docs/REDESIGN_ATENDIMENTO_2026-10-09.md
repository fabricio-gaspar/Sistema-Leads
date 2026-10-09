# Central de Atendimento — proposta de redesenho

Data: 09/10/2026. Estado: PROPOSTA DOCUMENTADA; frontend não alterado/publicado.
Base de código: `f46d61f02fd82bfbf91ef8895d65ccb23cef9f03`.
A página remota exigiu login. A análise abaixo é do código, não de uma sessão autenticada.

## Diagnóstico verificável

1. `atendimento/page.tsx` monta `WaAkgPanel mode="self-service" surface="central"`
   acima da área de conversas. No `WaAkgPanel.tsx`, conforme o estado da conta, esse
   painel inclui conexão, monitoramento do gateway, sessão, QR, código e cadência.
   O autoatendimento pertence à Central; a sua apresentação extensa compete com o atendimento.
2. A grade declara 320 px para a lista e 390 px para o contexto em `xl`, além da
   conversa flexível. Há risco de compressão quando o menu lateral está aberto;
   dimensões efetivas e eventuais overrides CSS precisam de validação no navegador.
3. A área declara `min-h-[640px]` e altura baseada em `100vh-210px`, além do painel
   de canal acima. Verificar excesso de rolagem, viewport baixo e teclado móvel.
4. O contexto usa Lead, Qualificação, Conhecimento e Mais. Próxima ação, orçamentos,
   notas e atividades ficam em Mais. São recursos úteis, mas o próximo passo está distante.
5. Há uma boa base a preservar: filtros rápidos, histórico, mensagens auditadas,
   modo humano/Ana, contexto, conhecimento e links com `leadId` para os módulos existentes.

## Proposta visual

Manter o design system claro e a cor teal Wayflex. Não criar outra identidade.
O principal elemento é a conversa; a área não deve parecer um painel técnico do gateway.

### Cabeçalho e próprio WhatsApp

Título compacto: Central de Atendimento. Ao lado, um controle Meu WhatsApp abre a
superfície de conexão individual, com resumo fiel do backend. Manter erros e bloqueios
visíveis mesmo quando detalhes estiverem recolhidos. Não tratar conexão como liberação
para envio. Não gerar QR nem iniciar sessão apenas por abrir/fechar o novo painel.
Preservar o onboarding existente e verificar seus efeitos antes de mudar a montagem.

Separar visualmente: conexão do aparelho; autorização operacional; estado da Ana.
Gateway, IDs técnicos, cadência e diagnóstico ficam em expansão contextual; credenciais,
contas de terceiros e políticas permanecem na administração autorizada. Não retirar
informações necessárias a recuperação, nem esconder uma pendência impeditiva.

### Área de trabalho em desktop

Menu existente compacto; lista à esquerda; conversa ampla ao centro; contexto à direita.
A lista mantém busca e filtros Todas / Não lidas / Aguardando / Minhas.
No cabeçalho da conversa: contato, empresa, canal, responsável e modo de atendimento.
Dar destaque a Assumir atendimento somente quando aplicável. Em modo humano, a ação
primária do compositor é Enviar; transferência e ações secundárias ficam contextuais.
Nunca simular que uma mensagem foi enviada.

No contexto, mostrar Próxima ação na primeira área, seguida de resumo do lead e
qualificação. Dar nomes claros às abas: Resumo, Qualificação, Conhecimento, Histórico.
Concentrar notas e atividades em Histórico; preservar o acesso a todos os recursos atuais.
Orçamento e reunião são atalhos para os formulários existentes, não novas implementações.

O compositor diferencia Resposta de Nota interna, deixa explícito quando está bloqueado
e preserva envio seguro, opt-out, revisão de conteúdo e tratamento de resultado ambíguo.
Atalhos só preenchem o campo; conteúdo preparado nunca é enviado automaticamente.

### Dimensionamento inicial a validar

| Espaço útil da área de trabalho, após o menu | Composição proposta |
| --- | --- |
| 1120 px ou mais | Lista 288 px, conversa flexível (alvo mínimo 480 px), contexto 304 px |
| 800–1119 px | Lista 280 px, conversa flexível, contexto em drawer |
| Menos de 800 px | Um painel por vez: lista → conversa → contexto, com voltar e foco preservados |

Menu lateral sugerido: 208–224 px quando aberto. São metas de design, não CSS já aplicado.
Usar limites do contêiner ou comportamento equivalente no stack existente. Não forçar
três colunas em notebooks. Ajustar altura pela área disponível, considerar `dvh` e teclado,
e evitar mínimos rígidos que empurrem o compositor para fora da tela.

## Implementação incremental prevista

1. Confirmar checkout, diferenças locais, versão publicada e contratos do backend.
2. Medir a Central autenticada nos perfis existentes; registrar antes e depois sem PII.
3. Separar componentes de apresentação dentro do módulo, sem reescrever repositories.
4. Compactar o próprio canal preservando status, onboarding, autorização e recuperação.
5. Reorganizar contexto e grade, mantendo handlers e rotas existentes.
6. Executar verificações proporcionais e só então publicar no Site existente.

## Aceite e regressões a testar

- Desktop 1280×720 e 1440×900; mobile 390×844; zoom 200%; teclado aberto.
- Sem overflow horizontal geral; conversa legível e compositor alcançável.
- Entrar pelo `leadId` original abre o registro autorizado; filtros de URL sobrevivem.
- Alternar rapidamente entre leads não mistura histórico, destinatário ou rascunhos.
- Lista vazia, conversa indisponível, histórico longo, texto longo, falha e reconexão.
- Ana, humano, aguardando atendente, opt-out e envio pendente continuam distintos.
- Parear conta própria não altera política global; recolher painel não dispara ação.
- Só o backend confirma envio, autorização e estado de canal; sem contagens inventadas.
- Teclado, foco, nomes acessíveis, Escape e retorno ao acionador nos painéis.
- Typecheck, lint, testes focados, build e testes de autorização; registrar o que não rodou.

## Limites deste lote

Nenhum componente funcional, backend, banco, conta ou automação foi alterado.
A proposta não é captura da tela atual nem prova de testes ou publicação.
Imagens conceituais devem dizer “Conceito — dados ilustrativos”, sem reutilizar os dados
ou a conversa do lead indicado, que não foram acessados.
