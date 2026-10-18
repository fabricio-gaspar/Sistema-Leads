# Produto e interface — checkpoint incremental

## 18/10/2026 — Dashboard: central de comando visual (local)

- Composição visual reforçada no Dashboard existente: cabeçalho operacional escuro, ações e status agrupados, alertas priorizados, leitura mais nítida da faixa de indicadores, painel de próxima ação e controle da Ana destacados pelos estados já fornecidos pelo produto.
- Não foram alterados dados, regras, textos operacionais, permissões, rotas, handlers, frequência de atualização, componentes de métricas ou integrações. A mudança usa apenas classes locais e tokens visuais existentes.
- Validação: contrato visual em TDD, type-check, lint, Vitest completo (134 arquivos; 803 aprovados; 25 skips), build e diff check. A prévia local não autentica sem a configuração pública de Supabase deste checkout; homologação visual autenticada e publicação permanecem pendentes.

## 09/10/2026 — organização por perfil e conceito da Central

Pedido autorizado: analisar o link da Central, aplicar regras de organização para o
Codex e propor o redesenho de uma tela no mesmo projeto.
Base remota inspecionada: `f46d61f02fd82bfbf91ef8895d65ccb23cef9f03`, `main`.

### Evidências e escopo

- A inspeção de navegador terminou no login; não acessou conversas nem dados do lead.
- Leitura dirigida: AGENTS, AGENT OS, trechos do checkpoint/Frontend, design system,
  DashboardLayout, Central/ContextPanel, WaAkgPanel, papéis, capacidades e Configurações.
- Não houve auditoria completa do repositório nem acesso às skills globais do usuário.
- O mapa respeita os papéis reais: administrador, vendedor, sdr e cx.
- Problemas de composição encontrados no código: painel técnico do canal antes das
  conversas, grade lateral 320/390 px e próxima ação dentro da aba Mais.
  Responsividade efetiva e estados autenticados permanecem NÃO VERIFICADOS.

### Requisitos deste lote

| ID | Entrega | Estado |
| --- | --- | --- |
| UI-20261009-01 | Regras persistentes no AGENTS e mapa por recurso/permissão | CONCLUÍDO no conteúdo deste lote |
| UI-20261009-02 | Complemento do design system existente, sem criar outro padrão | CONCLUÍDO no conteúdo deste lote |
| UI-20261009-03 | Skill de projeto com procedimento e casos de avaliação | CONCLUÍDO no conteúdo deste lote; execução no Codex do usuário não verificada |
| UI-20261009-04 | Diagnóstico e especificação de uma tela | CONCLUÍDO no conteúdo deste lote |
| UI-20261009-05 | Redesenho funcional integrado e publicado | BLOQUEADO nesta sessão: sem checkout executável completo, login ou publicação do Site |

### Limites e próxima ação

Mudança documental apenas. Nenhum arquivo de `src/`, `supabase/`, infraestrutura,
configuração operacional, segredo, conta ou dado de cliente foi alterado neste lote.
Não atualizar os baselines globais como se testes operacionais tivessem sido executados.
A confirmação de commit deve ser feita pelo histórico Git; este arquivo não inventa
seu próprio hash futuro nem a versão do Site.

Próxima ação: no checkout original, reconciliar este lote com alterações locais sem
reset/force; usar a skill wayflex-product-ui, medir a Central autenticada e implementar
`docs/REDESIGN_ATENDIMENTO_2026-10-09.md` em pequenos deltas. Preservar backend e gates,
executar testes proporcionais e publicar apenas no Site existente após validação.

## 11/10/2026 — Central compacta publicada

### Escopo aplicado

- A área de conversa foi priorizada; Meu WhatsApp e a agenda passam a ocupar superfícies compactas e o contexto vira drawer no espaço intermediário ou mobile.
- O status de Gateway, Sessão, Canal, Ana e consulta foi separado visualmente e deriva dos gates existentes. Não há selo de disponibilidade quando envio, recebimento, integração ou proteção ainda bloqueiam a operação.
- Foram mantidos `leadId`, handlers, rascunhos, permissões, QR, agenda, conhecimento e os fluxos de Ana/humano. Não houve mudança de regra, banco, Edge, canal, segredo, QR, mensagem ou dado de cliente.

### Evidência

- GitHub `main`: `f88abf7` e `bc4eb75`.
- Validação: 10 arquivos/37 testes focados; Vitest completo 97 arquivos/664 testes; type-check, lint, build Vite e `git diff --check` aprovados.
- Site existente publicado: versão 188, fonte `d65f1db9be0142746debb6f13cb97fed7e43b55d`, deploy `appgdep_6acc30daf2788191957acf0b81625608` `succeeded`. A rota oficial e o módulo estático da Central foram conferidos por leitura HTTP contra o pacote produzido.

### Limite e próxima ação

O navegador autenticado já aberto não foi recarregado para não perder eventual rascunho do operador. Falta somente uma homologação visual em sessão limpa nos breakpoints definidos no redesenho; ela não é necessária para confirmar a publicação, mas continua necessária para declarar QA visual completo.
