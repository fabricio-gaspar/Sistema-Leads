# Wayflex — critérios para auditorias dirigidas

## Captação e CRM
- Importação/cadastro/manual, telefone padronizado (inclusive DDI), deduplicação, titularidade do lead, busca e filtros, atribuição de vendedor, origem, histórico e Kanban.
- Leads compartilhados x pertencimento, exclusão de usuário sem perda indevida de dados da empresa.

## Atendimento, automações e Ana
- Chat com contexto das últimas mensagens e base de conhecimento empresarial, handoff humano, status de atendimento, idempotência, falhas, templates e controle de ativação.
- Regras comerciais humanas: valores, prazo, descontos e ganho; não confundir confirmação de envio com entrega.

## WhatsApp
- Conta por vendedor, provedor ativo, disponibilidade real de QR, expiração/reconexão, webhook autenticado, deduplicação, atrasos, filas e observabilidade.
- Evolution GO/WA-AKG não são provas de que todos os caminhos estejam implantados; confirmar backend remoto/versão.

## SaaS/Operação
- RLS e tenant isolation, convites/cadastro/desativação/exclusão, trilha de auditoria, dashboards por perfil, backup/restore, configuração de integrações e testes sem envio externo.
