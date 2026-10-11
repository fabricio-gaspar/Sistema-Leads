# Produto e interface — checkpoint incremental

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
