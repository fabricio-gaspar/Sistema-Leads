# Frontend

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
- **Configurar a Ana** também apresenta um mapa de decisão interativo sobre os mesmos seis passos.
  Os blocos apenas selecionam o formulário existente; não alteram payload, persistência nem a
  autoridade automática de `ana-run`. O mapa registra a base oficial em catálogos, segmentos e
  acessórios, as decisões de reunião/handoff e o pipeline canônico.
