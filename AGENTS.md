# Continuidade do WayFlex CRM

Antes de qualquer solicitação de desenvolvimento, ler `.agent/AGENT_OS.md` e seguir o
protocolo BASELINE → DELTA → IMPACTO. Antes de implementar ou responder a "pode seguir",
ler também `docs/CONTINUIDADE_WAYFLEX.md`.
Este é o projeto existente; não criar outro Site nem substituir a stack.

- Preservar alterações em andamento. Salvar etapas pequenas no Git remoto antes de encerrar.
- Atualizar o checkpoint com testes, estado LOCAL/APLICADO/PUBLICADO e próxima ação exata.
- Não afirmar prontidão completa sem homologação; diferenciar evidência de hipótese.
- Ana automática tem como alvo `ana-run`, com Claude configurado por empresa.
- Não ativar produção nem enviar mensagens reais para terceiros durante testes.
- Não reprocessar callbacks antigos automaticamente; podem disparar respostas atrasadas.
- Orçamentos somente: preço, desconto, prazo final e ganho exigem humano.
- Preservar isolamento por empresa/carteira, segredos e auditoria.
- Layout/login empresarial elegante é a etapa final, após estabilizar fluxos.
- Documentos de continuidade fazem parte deste repositório; não duplicar o código em outro armazenamento.
- Atualizar a memória técnica em `.agent/` ao concluir e validar cada lote. Não registrar
  commit, teste, integração ou publicação sem evidência real.

## Organização de produto e interface

- Antes de criar ou mover telas, consultar `docs/MAPA_PRODUTO_PERMISSOES.md` e
  `docs/DESIGN_SYSTEM_WAYFLEX.md`: tarefa → perfil → escopo → permissão → superfície.
- Em tarefas de organização visual, usar `.agents/skills/wayflex-product-ui/SKILL.md`.
  Ela complementa o AGENT OS; não substitui regras de segurança ou skills locais não inspecionadas.
- `administrador` é papel da empresa; não conceder administração global por inferência.
  Consultar a definição canônica de permissões, sem duplicar sua lógica em documentos ou CSS.
- Conectar o próprio WhatsApp é autoatendimento autorizado. Gerir canais de terceiros,
  credenciais e políticas é administração. Reorganizar a interface não amplia permissões.
- Na Central, priorizar conversa e próximo passo; consultar
  `docs/REDESIGN_ATENDIMENTO_2026-10-09.md` antes de implementar o redesenho proposto.
- Distinguir documentação aplicada, código implementado, testes executados e Site publicado.
  Checkpoint deste lote: `.agent/modules/product-ui.md`.
