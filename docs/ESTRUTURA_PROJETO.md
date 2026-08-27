# ESTRUTURA DO PROJETO — WF Digital CRM

```
WF_Digital_CRM/
├── .env.example                 # Modelo de variáveis (sem valores reais)
├── .env                         # NÃO exportado no backup (segurança)
├── index.html                   # Entry HTML (SEO + fontes + ícones CDN)
├── package.json                 # Dependências e scripts
├── vite.config.ts               # Configuração do Vite (alias @/, base path)
├── tsconfig.json                # Referências de tsconfig
├── tsconfig.app.json            # TS config da aplicação
├── tsconfig.node.json           # TS config do ambiente Node
├── tailwind.config.ts           # Tema (paleta StyleSystem oklch + fontes)
├── postcss.config.ts            # Tailwind + Autoprefixer
├── eslint.config.ts             # Regras ESLint
├── eslint-rules/
│   └── route-element-jsx.js     # Regra custom (rotas com JSX)
├── vite-env.d.ts
│
├── PRD.md                       # Product Requirements
├── SYSTEM_PROMPT.md             # Documentação de sistema
├── project_plan.md              # Plano do projeto
│
├── docs/                        # ← Documentação de backup (esta pasta)
│   ├── BACKUP_MANIFEST.md
│   ├── ESTRUTURA_PROJETO.md
│   ├── DEPENDENCIAS.md
│   └── INSTRUCOES_RESTAURACAO.md
│
└── src/
    ├── main.tsx                 # Entry da lógica
    ├── App.tsx                  # Root (BrowserRouter + __BASE_PATH__)
    ├── index.css                # Tailwind + variáveis de tema + estilos
    │
    ├── router/
    │   ├── index.ts             # AppRoutes + helpers de navegação
    │   └── config.tsx           # Definição das rotas (RouteObject[])
    │
    ├── components/
    │   ├── base/                # Componentes base (botões, inputs, cards...)
    │   └── feature/             # Componentes compartilhados
    │       ├── DashboardLayout.tsx
    │       ├── FilterChips.tsx
    │       └── SavedViewsControl.tsx
    │
    ├── hooks/                   # Stores, contextos e hooks de estado
    │   ├── useAuth.tsx
    │   ├── useLocalStorageState.ts
    │   ├── useLeadsStore.ts
    │   ├── usePropostasStore.ts
    │   ├── useVendasStore.ts
    │   ├── useConversasStore.ts
    │   ├── useTarefasStore.ts
    │   ├── useNotificacoesStore.ts
    │   ├── useConfiguracaoStore.ts
    │   ├── useSupressaoStore.ts
    │   ├── useSocialStore.ts
    │   ├── useAuditoriaStore.ts
    │   ├── useSavedViews.ts
    │   ├── useAnaResposta.ts
    │   └── useFluxoComercial.ts
    │
    ├── lib/                     # Lógica de negócio / utilitários
    │   ├── store.ts             # Factory de stores (createExternalStore)
    │   ├── selectors.ts
    │   ├── analise.ts
    │   ├── automacao.ts
    │   └── tipos.ts             # Tipos TypeScript
    │
    ├── mocks/                   # Dados de demonstração (todos)
    │   ├── leadsData.ts
    │   ├── propostasData.ts
    │   ├── atendimentoData.ts
    │   ├── dashboardData.ts
    │   ├── businessData.ts
    │   ├── comercialData.ts
    │   ├── canaisData.ts
    │   ├── fontesData.ts
    │   ├── conhecimentoData.ts
    │   ├── pipelineData.ts
    │   ├── produtosData.ts
    │   ├── templatesData.ts
    │   ├── automacaoData.ts
    │   ├── horariosData.ts
    │   ├── logsData.ts
    │   ├── midiaData.ts
    │   ├── socialData.ts
    │   ├── anaQualificacao.ts
    │   ├── anaComercial.ts
    │   ├── anaTemplates.ts
    │   ├── frontendAdvancedData.ts
    │   └── users.ts
    │
    ├── i18n/
    │   ├── index.ts
    │   └── local/               # Arquivos de tradução
    │       └── index.ts
    │
    └── pages/
        ├── NotFound.tsx
        ├── landing/page.tsx
        ├── home/page.tsx
        ├── login/page.tsx
        ├── register/page.tsx
        └── dashboard/
            ├── page.tsx                 # Dashboard
            ├── empresa/page.tsx
            ├── empresa/components/*     # Dados, Base de Conhecimento, Documentos
            ├── busca-leads/page.tsx
            ├── atendimento/page.tsx
            ├── atendimento/components/ConversaDrawer.tsx
            ├── leads/page.tsx
            ├── kanban/page.tsx
            ├── kanban/components/LeadDrawer.tsx
            ├── funil/page.tsx
            ├── midia-drive/page.tsx
            ├── relatorios/page.tsx
            ├── agenda/page.tsx
            ├── campanhas/
            │   ├── calendario/page.tsx
            │   ├── publicacao/page.tsx
            │   ├── contas/page.tsx
            │   └── socialMeta.ts
            ├── orcamentos/page.tsx
            └── configuracoes/
                ├── page.tsx
                └── components/*         # Abas do menu de configurações
```

---

## Convenções importantes

- **Alias `@/`** aponta para `src/` (configurado em `vite.config.ts` e `tsconfig.app.json`).
- **Auto-import**: `unplugin-auto-import` injeta automaticamente hooks do React, do React Router e do react-i18next — não é necessário importá-los explicitamente nos arquivos.
- **Ícones**: `font-awesome` e `remixicon` são carregados via CDN no `index.html` (não via npm).
- **Estilo**: TailwindCSS com paleta `oklch` (StyleSystem) — cores `background`, `primary`, `accent`, `secondary`, `foreground`.
- **Persistência**: stores usam `localStorage` (não há banco de dados real para o CRM).