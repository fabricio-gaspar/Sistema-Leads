# Análise de regressão — referência de sábado

Data da análise: 13/09/2026. Fuso de referência: `America/Sao_Paulo`.

## Referência verificável

- Estado analisado antes deste delta: `019ffc874d54e2033ee8e73b456d5f14fda9fe8d` (`main`).
- Referência histórica mais próxima anterior ao fim de 05/09/2026 em São Paulo:
  `51a7b2fad682e537df6246ee6cde738fe735b0d7` — “feat: import approved Wayflex memory for Ana”.
- O commit está registrado como `2026-09-05T03:54:40+07:00`, equivalente a
  `2026-09-04T17:54:40-03:00`. Não existe outro commit verificável no repositório entre esse
  instante e o fim do sábado em São Paulo.
- Não foi localizado um identificador de deploy com horário suficiente para afirmar qual build
  esteve ativo durante todo o sábado. Portanto, o commit acima é a referência Git mais próxima,
  não uma alegação de deploy exato.

## Comparação seletiva e correções

| Área | Evidência atual | Regressão/risco | Correção aplicada | Teste |
|---|---|---|---|---|
| Identidade de canal | Captura tratava telefone móvel como WhatsApp | Contato automático em canal não comprovado | Telefone e WhatsApp foram separados; autorização passou a ser explícita | Contratos Edge e mapper |
| Importação/Leads/Kanban | UI podia marcar consentimento e ativar IA automaticamente | Ana ativa sem autorização verificável | Todos os pontos de entrada passam a exigir canal comprovado, autorização e motivo | Type-check, lint e testes |
| Ana | Base aprovada era lida apenas por correspondência lexical | Resposta técnica podia ignorar fonte semanticamente próxima | Busca híbrida preparada com `match_knowledge_chunks`, mantendo fallback lexical seguro | Contrato Edge; embeddings reais ainda pendentes |
| Reunião | A decisão podia transferir ao humano mesmo havendo agenda conectada | Automação interrompida antes de concluir uma ação permitida | Ação de agenda com horário explícito, verificação de disponibilidade, idempotência e fallback humano | Type-check Edge; sem evento real criado |
| Mensageria | Seis jobs tinham aceite Z-API, mas ficaram em `reconciliation_required` | Estado local divergente e risco de repetição manual | Corrigidas as funções atômicas SQL e criada reconciliação que nunca reenvia | Teste transacional com rollback; seis estados reconciliados |
| Diagnóstico | Contagens agregadas não mostravam cada job/saída | Operador não distinguia fila, aceite e entrega | Registro do Sistema mostra fila e trilha por mensagem, sem declarar entrega por aceite | Testes e build |
| Prospecção | Score misturava aderência e disponibilidade de contato | Priorização comercial imprecisa | Score separado em aderência, contactabilidade e engajamento; origem rastreável | Mapper e contrato do handler |
| Escopo de fontes | Conector legado Google Places aparecia no fluxo principal | Desvio do escopo Apify + manual | UI principal exibe somente Apify; backend legado foi preservado | Type-check e build |

## Componentes reaproveitados

Foram mantidos o Kanban, Leads, Central de Atendimento, `outreach_jobs`, `lead_outreach`,
`channel_inbound_events`, `ana-run`, `automation-worker`, configuração publicada da Ana,
Vault, RLS, agenda, Base da Ana e o Site existente. Não foi criado módulo paralelo.

## Riscos e pendências comprovadas

- Não houve envio WhatsApp, busca Apify paga, chamada de modelo ou criação de evento real nesta
  análise. A homologação externa continua exigindo teste explícito do operador.
- A Base da Ana possui 61 documentos/chunks ativos; os 61 ainda estão sem embedding. A busca
  híbrida funciona com fallback lexical até uma reindexação autorizada consumir o provedor de IA.
- Callback que chegue antes de existir qualquer vínculo com o identificador do provedor ainda
  depende de repetição do callback ou reconciliação específica do canal.
- Proteção contra senhas vazadas continua desativada no Auth do Supabase.

