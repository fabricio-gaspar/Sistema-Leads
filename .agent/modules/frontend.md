# Frontend

- Dashboard: o gráfico de conversas usa somente o histórico operacional carregado da Central e
  mostra as últimas 24 horas em faixa horizontal rolável. Notas internas não entram na métrica;
  nenhuma mensagem no período produz estado vazio, nunca valores ou conteúdo simulados.
- O selo do gráfico declara “Ao vivo” somente após a assinatura Realtime estar `SUBSCRIBED`.
  A assinatura é limitada à `organization_id` da sessão; falha de conexão não é mascarada como
  atualização em tempo real.
- Refinamento visual de 11/09: Dashboard concentra métricas, distribuição Kanban e temperatura,
  status individual das integrações, atendimento humano e fila. Barras zero permanecem vazias.
- Compactação de 11/09: o mesmo Dashboard usa cards e listas mais densos, sem alterar fontes
  remotas, callbacks, estados, rotas ou regras de domínio.
- Canais e APIs, em 11/09, usa uma grade compacta com nome e somente Conectado/Desconectado.
  O selo vem de `operational-diagnostics`; não há estado inferido no navegador.
- Busca manual: a revisão só abre após retorno real do provedor. Falhas ficam visíveis nos
  filtros, e um retorno vazio real mostra estado vazio explícito. O adaptador reconhece os
  campos de empresa e localização devolvidos pela prospecção.
- Menu usa Prospecção, Atendimento e Comercial. Configurações agrupam conexões, empresa/IA,
  gestão comercial e segurança, preservando IDs, callbacks e componentes de formulário.

- React/TypeScript/Vite, rotas em `src/router/config.tsx`.
- Shell e menu em `src/components/feature/DashboardLayout.tsx`.
- Design atual segue tokens Wayflex Executive Light em `src/index.css`: branco e cinza
  claro, verde institucional, bordas finas, raios contidos e sombras discretas.
- O menu global está agrupado pelo fluxo Começo · captar, Meio · atender, Final · fechar
  e Administração. A busca lateral filtra somente telas existentes e cada resultado navega
  para uma rota real.
- O Dashboard mostra uma sequência de trabalho e cartões de recursos derivados do
  `operational-diagnostics`; nenhum estado ativo é inferido localmente.
- `src/lib/supabase.ts` prefere a configuração pública entregue pelo Worker em
  `/runtime-config.js` e preserva as variáveis `VITE_PUBLIC_SUPABASE_*` apenas como fallback
  local. O Worker lê URL e chave publicável do ambiente do Site a cada carregamento; não
  versionar valores reais em `.env` ou no Git.
- Dados operacionais devem vir de repositories em `src/lib/crm/`; localStorage é permitido
  somente para filtros e preferências pessoais.
- Telas críticas: Dashboard, Leads, Kanban, Atendimento, Orçamentos, Agenda, Configurações e
  Registro do Sistema.
- Em **Configurar a Ana**, a última etapa apresenta explicitamente a versão já publicada e o
  botão só fica habilitado após alteração pendente. O rótulo e a dica explicam esse estado para
  evitar a aparência de falha e impedir versões duplicadas sem mudança.

## Busca de Leads — 11/09/2026

- A busca manual usa Fonte → Filtros → Revisão → Importação. Fontes de prospecção ainda não
  validadas aparecem bloqueadas, em vez de desaparecerem do seletor.
- O retorno real pode ser assíncrono: enquanto a Apify processa, a tela consulta a mesma
  execução por `runId`; a revisão só aparece quando o backend entrega resultados finais.
- `ProspectingMap` desenha somente latitude/longitude devolvidos pela fonte, com tiles do
  OpenStreetMap e abertura do drawer ao clicar no marcador. Sem coordenadas, exibe estado
  transparente e mantém os leads na tabela.
- A última etapa exige seleção e leva ao módulo Leads após a persistência. Não há promessa nem
  disparo automático da Ana ou de WhatsApp nesse fluxo.
