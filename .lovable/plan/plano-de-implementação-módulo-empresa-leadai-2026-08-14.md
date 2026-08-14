# Plano de Implementação — Módulo Empresa (LeadAI)

Reconstrução da tela de Empresa baseada nas referências `empresa1-4.png` com fidelidade visual ao design LeadAI e integração com as funcionalidades reais de multi-tenant e IA.

## Auditoria e Mapeamento

| Elemento da Referência | Existe no Sistema | Ação | Arquivo |
| :--- | :--- | :--- | :--- |
| Sidebar & Layout | Sim | Reestilizar para LeadAI | `src/components/AppShell.tsx` |
| Tabs (Dados, Abordagem, Apresentação, Documentos) | Não | Implementar navegação interna | `src/routes/_authenticated/empresa.tsx` |
| Aba "Dados" (empresa1.png) | Parcial | Reestilizar cards e campos | `src/routes/_authenticated/empresa.tsx` |
| Aba "Abordagem" (Sequências) | Parcial | Integrar com `outreach_sequences` e Z-API | `src/routes/_authenticated/empresa.tsx` |
| Aba "Apresentação" (IA) | Parcial | Integrar com `company_settings` e `retrainAna` | `src/routes/_authenticated/empresa.tsx` |
| Aba "Documentos" (RAG) | Sim | Reestilizar lista e upload scritp | `src/routes/_authenticated/empresa.tsx` |

## Etapas de Implementação

### 1. Reestruturação do Componente `Empresa`
- Adicionar estado de `activeTab` (Dados, Abordagem, Apresentação, Documentos).
- Implementar cabeçalho com título "Empresa" e descrição.
- Criar navegação por abas com estilo pílula (bg-light, active: white shadow).

### 2. Aba "Dados" (empresa1.png)
- **Ramo de atividade:** Campo select para segmento.
- **Produtos e serviços:** Tags interativas (badges) com input de adição.
- **Diferenciais competitivos:** Tags coloridas (teal light) com input.
- **Região e público-alvo:** Select para região e textarea para público.
- Integrar campos com as colunas reais de `company_settings`.

### 3. Aba "Abordagem" (empresa2.png)
- **Canais de abordagem:** Lista de canais (WhatsApp, E-mail, Telefone) com status de ativação.
- **Abordagem multicanal:** Toggle para ativar sequência automática.
- **Pré-visualização:** Card escuro simulando mensagem no celular com variáveis dinâmicas.
- **Mensagens personalizadas:** Editor de texto para cada canal com badges de variáveis.

### 4. Aba "Apresentação" (empresa3.png)
- **Material Institucional:** Card de status (IA treinada) com toggle de ativação.
- **Cards de Contexto:** Resumo de serviços, Benefícios (lista com checks), Cases de sucesso (cards com métricas).
- Integrar com o prompt da Ana e `company_settings.description`.

### 5. Aba "Documentos" (empresa4.png)
- **Tabela de Documentos:** Nome, Formato (PDF, XLSX, etc), Versão, Status (Badge: ativo, pronto, processando).
- **Ações:** Botão flutuante "Enviar documento".
- Manter lógica de upload para bucket `docs` com RLS por `organization_id`.

## Detalhes Técnicos
- Utilizar `useMutation` para salvamento em tempo real ou botão global de "Salvar".
- Aplicar tokens de cor teal (`oklch(70% 0.15 170)`) e backgrounds LeadAI.
- Garantir que as chamadas RPC (`current_org_id`) tratem erros corretamente conforme correção P0 anterior.
