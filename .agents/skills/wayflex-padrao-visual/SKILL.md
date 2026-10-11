---
name: wayflex-padrao-visual
description: Padronize visualmente os frames/telas do Wayflex em estilo SaaS empresarial clean, preservando componentes, fluxos e permissões existentes.
---
# Wayflex UI — padrão clean com continuidade
1. Leia `AGENTS.md`, `.agent/AGENT_OS.md` e documentação de continuidade antes de alterar componentes.
2. Acione `$design-system-guard` e, quando útil, `frontend-design`/`web-design-guidelines` para uma auditoria de consistência (não trocar stack).
3. Identifique componentes e tokens compartilhados reais; não presuma shadcn/ui, Material UI ou outro framework.
4. Escolha uma tela piloto e aprove direção visual antes de harmonizar sidebar, PageHeader, cards KPI, filtros, tabelas, modais, formulário e estados vazios/carregamento.
5. Verifique módulos Dashboard, Leads/Kanban, Central de Atendimento e Configurações, depois os demais por lotes.
6. CSS/Tailwind/layout não devem alterar Auth, Supabase, Webhooks, estado operacional, eventos, permissões nem comportamento da Ana.
7. Entregue evidências: arquivos alterados, componentes impactados, testes, comparação desktop/mobile, itens ainda divergentes.
Leia `references/TELAS.md` quando estiver executando auditoria de UI completa.
