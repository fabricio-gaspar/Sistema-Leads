# Arquitetura final do Sistema de Leads Wayflex

## Decisão

O sistema evolui sobre o runtime existente. Não haverá um segundo CRM, um segundo motor da Ana
ou uma nova fila paralela. `Supabase` é a fonte operacional, `leads` é o agregado comercial em uso,
`lead_messages` é o histórico cronológico e `ana-run` é a única autoridade automática.

As tabelas `crm_*` antigas permanecem compatíveis enquanto houver dependências históricas, mas
não recebem novos consumidores nem se tornam uma segunda fonte da verdade. Uma eventual migração
será incremental, com reconciliação por ID, contagem e rollback; nunca por substituição global.

## Modelo operacional canônico

| Conceito | Fonte atual | Regra |
|---|---|---|
| Empresa prospectada | `leads.company` e identidade de origem | Deduplicação por organização e origem verificável |
| Contato | campos de contato do `lead` e identidades de canal | Telefone não vira WhatsApp implicitamente; ambiguidade bloqueia |
| Oportunidade | `leads` + pipeline + `lead_qualifications` | Uma leitura comercial por lead; evidências ficam estruturadas |
| Conversa | `lead_messages` | Toda entrada e saída persiste no mesmo histórico |
| Execução da Ana | `agent_runs` | Chave idempotente por evento e lead |
| Saída | `outreach_jobs` + `lead_outreach` | Worker server-side, retry controlado e reconciliação |
| Decisão auditável | `domain_events` + `audit_logs` | Evidência, ator, entidade e chave idempotente |

## Três dimensões independentes

1. **Etapa comercial:** Novo → Apresentado → Qualificando → Reunião → Orçamento → Ganho/Perdido.
2. **Estado operacional:** pronto, agendado, processando, aguardando resposta, follow-up devido,
   revisão humana, atendimento humano, pausado, bloqueado ou encerrado.
3. **Responsabilidade:** Ana, vendedor definido ou rodízio limitado a membros ativos selecionados.

Uma dimensão não deve ser inferida da outra. Por exemplo, um lead em `Qualificando` pode estar
`aguardando resposta`, e um handoff humano não muda automaticamente a etapa comercial.

## Máquina de estados

- Automações avançam no máximo uma etapa por decisão persistida.
- Regressão automática é proibida.
- `Ganho` exige confirmação humana.
- `Perdido` exige confirmação humana, exceto opt-out inequívoco registrado como evento objetivo.
- `Ganho` e `Perdido` são terminais; reabertura futura exige operação administrativa específica,
  justificativa e auditoria, não uma transição comum do Kanban.
- Reunião exige horário explícito e disponibilidade confirmada.
- Orçamento automático é somente rascunho; preço, desconto, prazo final e ganho exigem humano.

## Autoridades

- `ana-run`: interpreta o contexto e decide ações automáticas permitidas.
- `automation-worker`: reivindica trabalho, revalida guardas e chama provedores.
- Webhooks: autenticam, deduplicam e registram fatos; não decidem o funil por conta própria.
- Frontend: coleta intenção humana e exibe estado real; não usa segredo nem envia direto.
- Postgres/RLS: organização, carteira, integridade, idempotência e isolamento.

## Concorrência, filas e idempotência

- Todo efeito externo nasce de um registro persistido com chave idempotente.
- Claims de worker precisam ser atômicos e condicionais ao estado atual.
- Retry só ocorre quando o resultado externo é comprovadamente não aceito.
- Resultado ambíguo entra em reconciliação; nunca é reenviado às cegas.
- Opt-out, handoff, pausa, kill switch, canal, conta e versão publicada da Ana são relidos antes
  do efeito externo.
- Eventos atrasados ou fora de ordem podem avançar um estado materializado, mas nunca regredi-lo.

## Segurança multiempresa

- Toda entidade operacional possui `organization_id` e RLS em schema exposto.
- Grants e policies são tratados separadamente; `authenticated` recebe apenas as operações usadas.
- Carteira limita vendedor a leads atribuídos; gestores usam permissões explícitas.
- Funções privilegiadas validam usuário, organização e papel no corpo, fixam `search_path` e
  revogam execução pública.
- `service_role`, tokens de provedores e segredos de IA permanecem no backend/Vault.

## Limite comercial da versão final

O produto termina em qualificação, reunião, rascunho/envio de orçamento e handoff comercial.
Pedido, venda, checkout e recebimentos não pertencem ao runtime oficial e não devem ganhar novas
telas, rotas ou automações.

## Gates das próximas etapas

1. Catálogo: somente conteúdo rastreável e aprovado.
2. Dossiê: campos técnicos obrigatórios por aplicação, sem conclusão inventada.
3. Prospecção: simulação → supervisionado → automático, com cotas e ICP.
4. Motor da Ana: concorrência, retry, pausa, retomada, opt-out e matching comprovados.
5. Canais: aceite, entrega e leitura são fatos distintos.
6. Liberação: somente após RLS cruzada, E2E controlado e piloto com critérios de parada.
