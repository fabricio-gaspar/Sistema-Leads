# Plano de Reconstrução: Módulo de Leads

Reconstrução da tela de **Gestão de Leads** e **Detalhes do Lead** seguindo a referência visual "leads.png" e o padrão LeadAI (teal, dark sidebar, cards informativos).

## 1. Gestão de Leads (Kanban -> Tabela)
Transformar a visualização padrão de Kanban para a Tabela de Leads conforme a imagem.
- **Header**: Título "Gestão de Leads", contagem total, descrição e botão "+ Novo Lead" (teal).
- **Filtros**: Barra de busca, select de "Todas as etapas" e "Todos os segmentos".
- **Tabela**:
    - Colunas: Lead / Empresa, Segmento, Score (com ícone de chama), Etapa (Badge colorido), Responsável (Badge Ana IA ou Humano), Ações (Visualizar).
    - Design: Linhas com hover, ícones de score estilizados.
- **Funcionalidade**: Integração com `listLeads` e filtros em tempo real.

## 2. Detalhes do Lead (Refinamento Visual)
Ajustar a tela `src/routes/_authenticated/leads.$id.tsx` para manter a fidelidade visual.
- **Cabeçalho**: Breadcrumb estilizado, badge de temperatura/score.
- **Layout**: Grid 3 colunas (Info Contato, Conversa WhatsApp, Ações de Venda).
- **Canais**: Exibição clara de disponibilidade (Z-API, Resend).

## 3. Segurança e Acessos
- **RLS**: Garantir que o `organization_id` seja respeitado em todas as queries.
- **Redirecionamentos**: Manter a lógica de `_authenticated/route.tsx` onde SDRs acessam apenas Busca de Leads, Leads e Atendimento.
- **Permissões**: Botão de "Assumir manualmente" disponível apenas para papéis permitidos (Admin/Vendedor/SDR).

## 4. Qualidade Técnica
- Tipagem rigorosa com Supabase Types.
- Validação de build e lint.
- Reuso de componentes `StatCard` e `TempBadge` já existentes.

## Arquivos Relacionados
- `src/routes/_authenticated/leads.tsx` (Reescrita total para Tabela)
- `src/routes/_authenticated/leads.$id.tsx` (Ajustes de UI)
- `src/components/LeadTable.tsx` (Novo componente)
