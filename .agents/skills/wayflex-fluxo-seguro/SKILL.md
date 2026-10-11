---
name: wayflex-fluxo-seguro
description: Use em alterações do Sistema de Leads Wayflex relacionadas a CRM, Supabase, Ana, Kanban, organizações, vendedores, WhatsApp, Evolution GO ou WA-AKG.
---
# Wayflex: preservar continuidade do sistema real
Prioridade: `AGENTS.md`, `.agent/AGENT_OS.md`, `docs/CONTINUIDADE_WAYFLEX.md` existentes no checkout. Não replique nem reescreva esse protocolo.
1. Siga BASELINE → DELTA → IMPACTO; leia os artefatos de memória técnica que o protocolo existente exige. Reutilize a auditoria incremental.
2. Stack verificada no repositório: React/Vite/TypeScript, Tailwind, Supabase; confirme alterações recentes antes de agir.
3. Preserve isolamento por empresa/carteira; validação de RLS, Auth, Storage, Edge, filas e convenções de migrations.
4. Ana e provedores WhatsApp: não misture inteligência comercial, estado CRM e transporte. Confirme provedor ativo em runtime; não presuma migração concluída.
5. Preserve site/CRM no destino atual. Gateway WA-AKG em infraestrutura separada não autoriza mover CRM, banco de negócio ou Ana.
6. Não envie WhatsApp real, não reprocesse callbacks antigos e não ative automações de produção em testes.
7. Use, quando aplicável, `npm run type-check`, `npm run type-check:edge`, `npm run lint`, `npm test` e `npm run build`. Reporte exatamente o que foi rodado.
8. Não mude Git remote, reescreva histórico, publique ou aplique migrations remotas sem autorização e plano de reversão.
9. Resultados comerciais sensíveis (preço, descontos, prazos e fechamento) respeitam aprovação humana definida no projeto.
