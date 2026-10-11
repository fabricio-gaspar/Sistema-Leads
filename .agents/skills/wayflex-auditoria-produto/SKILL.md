---
name: wayflex-auditoria-produto
description: Quando pedirem auditoria do CRM Wayflex, identifique lacunas reais entre módulos, processos comerciais e integrações sem duplicar a memória técnica BASELINE/DELTA/IMPACTO.
---
# Wayflex — lacunas de produto e prontidão
1. Comece por `AGENTS.md`, `.agent/AGENT_OS.md`, `docs/CONTINUIDADE_WAYFLEX.md`, baseline e módulos pertinentes. Essas instruções prevalecem.
2. Use `$project-gap-auditor` e `$acceptance-test-architect` apenas no módulo afetado. Auditoria completa somente com baseline ausente/inválido ou aprovação explícita.
3. Escopo atual conhecido: Dashboard, Busca de Leads, Leads, Kanban, Agenda, Orçamentos, Central de Atendimento, Meu WhatsApp, Funil, Relatórios, Configurações e Ana. CONFIRMAR cada tela/fluxo na versão real antes de marcar implementado.
4. Verifique isolamento por organização e vendedor, papéis e permissões, RLS/Edge/Auth e observabilidade; verifique também lead → canal → mensagem → CRM → Ana → fila → provedor → recibo → histórico.
5. Audite provedores WA-AKG/Evolution GO como transportes e Ana como inteligência do CRM. Não presuma que integração esteja ativa, nem declare conexão com base em QR/endpoint somente.
6. Ana: verificar memória e contexto, políticas de resposta, handoff, fila, idempotência e avaliação de qualidade. Preços, descontos, prazos finais e ganho exigem humano conforme contrato atual.
7. Distinguir `CONFIRMADO`, `PARCIAL`, `INFERIDO`, `NÃO VERIFICADO` e `AUSENTE` do protocolo Wayflex. Achados novos não substituem o registro de problemas existentes.
8. Nada de mensagens reais, reprocessamento de eventos antigos, migrations em produção, reconfiguração de domínio ou alteração da hospedagem sem consentimento.
9. Use checklist de `references/CRITERIOS.md` somente quando relevante. Resposta com top 10 gaps, justificativa e evidências; não reporte catálogo genérico de funcionalidades.
