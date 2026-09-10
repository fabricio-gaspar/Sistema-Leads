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
- Dados operacionais devem vir de repositories em `src/lib/crm/`; localStorage é permitido
  somente para filtros e preferências pessoais.
- Telas críticas: Dashboard, Leads, Kanban, Atendimento, Orçamentos, Agenda, Configurações e
  Registro do Sistema.
