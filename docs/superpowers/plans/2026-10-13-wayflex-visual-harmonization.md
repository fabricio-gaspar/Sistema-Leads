# Harmonização visual e de experiência — WayFlex

## Objetivo

Consolidar o sistema visual do CRM sem alterar regras comerciais, Supabase,
RLS, integrações, rotas ou permissões. A entrega torna as áreas operacionais
mais compactas, legíveis e responsivas, preservando dados reais e estados
operacionais.

## Limites preservados

- Nenhuma publicação, deploy ou alteração de ambiente.
- Nenhuma mudança em banco, RLS, dados de clientes ou integrações.
- Nenhuma métrica, lead ou estado demonstrativo apresentado como real.
- URLs existentes, proteções de rota e capability checks permanecem iguais.

## Implementação

1. Consolidar tokens de tipografia, espaçamento, superfícies, foco e status;
   eliminar tamanhos auxiliares inferiores a 12 px nas áreas operacionais.
2. Corrigir a linguagem e a hierarquia do Dashboard: polling explicitamente
   nomeado, ação de personalização honesta e áreas de atenção compactas.
3. Compactar filtros e manter tabelas legíveis em Leads; em telas estreitas,
   preservar acesso às colunas por rolagem clara e controles que não escapam.
4. Ajustar Kanban para quadro de sete etapas, inclusive Perdido, com largura
   responsiva e alternativa de lista preservada.
5. Reorganizar a Central para priorizar conversa/contexto, compactando o
   resumo do canal e os indicadores secundários sem alterar estados WA-AKG.
6. Harmonizar Configurações: tipografia, cards, tabela operacional e grupos;
   manter Canais e APIs como destinos independentes dentro da mesma categoria.
7. Adicionar/atualizar contratos visuais e executar lint, type-check, testes e
   build; revisar desktop, tablet e celular em ambiente autenticado.

## Critérios de aceite

- Navegação, status e indicadores refinados usam metadados de ao menos 12 px;
  componentes preexistentes fora do escopo mantêm sua tipografia até uma rodada
  dedicada de consolidação.
- Dashboard não chama polling de tempo real nem promete preferência persistida.
- Kanban expõe as sete etapas no quadro quando a largura permitir e preserva
  a navegação horizontal/lista nas demais larguras.
- Nenhuma alteração de rota, capability ou integração.
- Estados vazio, carregando, erro e sucesso continuam explícitos e acessíveis.
