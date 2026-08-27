# DEPENDÊNCIAS — WF Digital CRM

## Runtime (`dependencies`)

| Pacote | Versão | Finalidade |
|---|---|---|
| `react` | ^19.1.2 | Biblioteca UI |
| `react-dom` | ^19.1.2 | Renderer DOM |
| `react-router-dom` | ^7.6.3 | Roteamento SPA |
| `i18next` | ^25.3.2 | Internacionalização |
| `react-i18next` | ^15.6.0 | Binding i18n para React |
| `i18next-browser-languagedetector` | ^8.2.0 | Detecção de idioma |
| `@supabase/supabase-js` | 2.57.4 | Cliente backend (instalado; CRM não o usa atualmente) |
| `firebase` | 12.0.0 | Instalado (não utilizado no fluxo atual) |
| `@stripe/react-stripe-js` | 4.0.2 | Instalado (pagamentos — não conectado) |
| `recharts` | 3.2.0 | Gráficos (Relatórios/Dashboard) |
| `lucide-react` | ^0.469.0 | Ícones |

## Desenvolvimento (`devDependencies`)

| Pacote | Versão | Finalidade |
|---|---|---|
| `vite` | ^8.0.1 | Build/dev server |
| `@vitejs/plugin-react` | ^6.0.1 | Suporte React no Vite |
| `typescript` | ~5.8.3 | Linguagem |
| `tailwindcss` | ^3.4.17 | Framework CSS |
| `postcss` | ^8.5.6 | Processador CSS |
| `autoprefixer` | ^10.4.21 | Prefixos CSS |
| `eslint` | ^9.30.1 | Linter |
| `@eslint/js` | ^9.30.1 | Config ESLint |
| `typescript-eslint` | ^8.35.1 | ESLint para TS |
| `eslint-plugin-react-hooks` | ^5.2.0 | Regras de hooks |
| `eslint-plugin-react-refresh` | ^0.4.20 | HMR |
| `globals` | ^16.3.0 | Globals ESLint |
| `unplugin-auto-import` | ^19.3.0 | Auto-import de APIs |
| `@types/react` | ^19.1.8 | Tipos React |
| `@types/react-dom` | ^19.1.6 | Tipos React DOM |
| `source-map` | ^0.7.6 | Source maps |
| `jiti` | ^2.6.1 | Carregamento de config TS |

---

## Scripts disponíveis (`package.json`)

| Script | Comando |
|---|---|
| `dev` | `vite` |
| `build` | `vite build` |
| `preview` | `vite preview` |
| `lint` | `eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0` |
| `type-check` | `tsc --noEmit --project tsconfig.app.json` |

---

## Observações

- **Sem lockfile**: o projeto não inclui `package-lock.json`, `pnpm-lock.yaml` ou `yarn.lock`. Ao restaurar, rode `npm install` (ou o gerenciador de sua preferência) para gerar o lockfile e baixar as dependências.
- **Ícones e fontes**: `font-awesome`, `remixicon` e Google Fonts (`Plus Jakarta Sans`, `Inter`) são carregados por CDN no `index.html`.