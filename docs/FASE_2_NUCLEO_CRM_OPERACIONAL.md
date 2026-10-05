# Fase 2 — Núcleo CRM operacional

Esta fase substitui, no fluxo prioritário do CRM, os blobs de dados por usuário
por registros relacionais protegidos por organização. Nenhuma integração de
WhatsApp, e-mail ou IA é ativada por esta entrega.

## Fonte de verdade por etapa

| Etapa | Fonte de verdade | Proteção |
| --- | --- | --- |
| Organização ativa | `profiles.active_organization_id` + associação ativa | RPC valida a associação antes de trocar a organização |
| Dados da empresa e regras | `organization_settings` | RLS para owner, admin e manager |
| Leads | `crm_leads` | `organization_id`, RLS, consentimento e arquivamento lógico |
| Atendimento | `crm_conversations` e `crm_messages` | Relação composta no mesmo tenant e mensagens internas separadas |
| Handoff e pendências | `crm_tasks` | Tenant, responsável e vínculo opcional com o lead |

## Aplicação

1. Aplique primeiro a migration da Fase 1.
2. Aplique `supabase/migrations/20260826195018_phase_2_crm_operational_core.sql`.
3. Entre com dois usuários em organizações diferentes e valide que não há
   leitura, atualização ou seleção cruzada de dados.
4. Importe dados legados somente por organização, com uma rotina específica e
   aprovada. A aplicação não faz seed automático de dados mock ou de blobs.

## Regras preservadas

- Ana é apresentada como assistente virtual; mensagens automáticas continuam
  dependentes do modo de execução e das regras comerciais configuradas.
- Opt-out se torna `consent_status = opted_out`, bloqueando o lead para contato
  operacional.
- Uma nota de sistema/handoff é persistida como mensagem `internal`, nunca
  como comunicação externa.
- Exclusão visual de lead vira arquivamento lógico; o histórico permanece
  auditável.

## Verificação local

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run type-check
npm run lint
npm test
npm run build
```

## Pré-requisito de produção

Antes do deploy, execute a migration no projeto Supabase de homologação e faça
os testes de RLS com duas organizações. A seleção de organização ativa é
persistida no perfil e validada contra `organization_members`; não aceite um
`organization_id` fornecido pelo navegador como autoridade.
