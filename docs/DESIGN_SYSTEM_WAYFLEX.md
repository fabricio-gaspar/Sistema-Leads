# Design System Wayflex Leads

## Direção

O produto usa uma linguagem de trabalho empresarial: superfícies claras, alta legibilidade, densidade controlada e uma única cor de marca. A referência é 70% Stripe/Attio, 20% Linear e 10% identidade Wayflex.

## Fundamentos

- Tipografia: Inter para interface e Plus Jakarta Sans para títulos.
- Cor primária: teal Wayflex, reservada para foco, seleção e ação principal.
- Neutros: escala fria para fundos, divisores e texto.
- Semântica: verde/primária para sucesso, âmbar para atenção e vermelho apenas para erro ou ação destrutiva.
- Espaçamento: unidade base de 4 px; páginas usam 16–32 px conforme viewport.
- Raios: 8 px em controles, 12 px em superfícies e modais.
- Sombra: somente níveis sutis; hierarquia vem primeiro de espaço, tipografia e borda.
- Foco: anel visível de 2 px em todos os controles interativos.

## Componentes globais

- `wf-page`: largura, margens e respiro consistentes.
- `wf-page-header`: título, descrição e ações de página.
- `wf-surface`: superfície padrão para conteúdo agrupado.
- `wf-toolbar`: busca, filtros e ações compactas.
- `wf-btn-primary`, `wf-btn-secondary`, `wf-icon-button`: hierarquia de ações.
- `wf-metric-strip` e `wf-kpi`: indicadores executivos sem excesso de cards.
- `wf-badge`: status e metadados de baixa ênfase.
- `wf-tabs`: navegação local compacta.
- `wf-table-shell`: tabela com borda e superfície consistentes.
- `wf-empty-state`: ausência de conteúdo com orientação clara.
- `wf-skeleton`: carregamento sem salto de layout.

## Regras de uso

1. Uma ação primária por contexto visual.
2. Não usar cor para decoração; somente marca, seleção ou semântica.
3. Tabelas concentram dados; cards são usados apenas para agrupamento ou destaque.
4. Filtros avançados começam recolhidos quando não são necessários para a tarefa principal.
5. Kanban usa colunas neutras e identifica etapa com um pequeno marcador.
6. Modais preservam título, corpo e rodapé de ações na mesma ordem.
7. Todas as páginas administrativas herdam o mesmo shell, cabeçalho e comportamento responsivo.
