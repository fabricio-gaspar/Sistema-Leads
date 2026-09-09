# Production Readiness — Sistema de Leads

Data do baseline: 09/09/2026

## Objetivo

Consolidar o sistema existente sem reescrita, eliminando divergências entre frontend, banco e automações e exigindo evidência de ponta a ponta antes da ativação do Ambiente Real.

## Autoridades canônicas

- **Modo operacional:** `company_settings.sandbox_mode`.
- **Decisão operacional da Ana:** Edge Function `ana-run`.
- **Entrada WhatsApp:** Edge Function `webhook-whatsapp` com callback real do provedor.
- **Envio automático:** fila `outreach_jobs` processada exclusivamente pelo `automation-worker` server-side.
- **Timeout sem resposta:** scheduler server-side / rotina transacional existente; não deve concorrer com decisões no navegador.
- **Pipeline comercial:** `pipeline_stage_id` + `pipeline_stages.ana_stage_key`, sincronizado com `ana_stage`/`ana_outcome` e com o enum legado apenas para compatibilidade.

## Funil comercial canônico

1. Novo
2. Apresentado
3. Qualificando
4. Reunião
5. Orçamento
6. Ganho
7. Perdido

A Ana não pode marcar Ganho autonomamente. Orçamento automático permanece rascunho e sujeito à política humana aprovada.

## Correções aplicadas nesta estabilização

- Runtime e backend passaram a compartilhar uma única fonte de verdade para Demo/Real.
- Ativação do Ambiente Real passou a ter trava no banco e é recusada enquanto houver dependência crítica não homologada.
- Pipeline da Ana e Kanban foram reconciliados.
- Escritas de clientes antigos (`Prospecção`, `Qualificado`, `Proposta`, etc.) são traduzidas para o funil canônico durante a transição.
- `lead-workflow` deixou de ser motor paralelo; virou ponte de compatibilidade para `ana-run`.
- `record_inbound` manual foi descontinuado: somente callback real do provedor pode comprovar entrada WhatsApp.
- Telefone ganhou identidade canônica sem alterar o valor de exibição.
- Conversas WhatsApp podem manter vínculo determinístico `identidade do contato → lead` após envio real.
- Resolução de inbound não escolhe o primeiro lead: usa vínculo ativo, identidade única ou, em caso de duplicidade, uma única conversa IA ativa; caso contrário bloqueia por ambiguidade.
- Diagnóstico operacional passou a informar bloqueadores concretos.
- RLS service-role-only ficou explícita nas filas/eventos internos.
- Foram corrigidas duplicidades determinísticas de policies/índices e FKs sem índice apontadas pelo advisor.
- CI adicionada com TypeScript e build de produção.

## Estado observado no baseline

Para a organização Wayflex, no momento da estabilização:

- IA: pronta.
- WhatsApp de saída: conexão validada.
- Scheduler server-side: ativo e com heartbeat.
- WhatsApp de entrada: ainda não homologado com uma resposta real de um lead correspondente.
- Ambiente: Demonstração (`sandbox_mode=true`).

Callbacks reais já chegaram ao webhook, porém os testes anteriores utilizaram números que não correspondiam ao lead de teste. O sistema não deve considerar isso homologação.

## Regra de evidência

Não considerar “enviado” apenas porque um job terminou como `processed`. Para prova de envio, exigir correlação consistente entre fila, mensagem, registro de outreach e identificador retornado pelo provedor. Para prova de inbound, exigir callback real do provedor persistido e associado ao lead.

## Critério obrigatório para GO

Antes de mudar para Ambiente Real, executar e comprovar o fluxo abaixo com um contato controlado e cadastrado:

`Lead → Ana → fila → Z-API → WhatsApp → resposta real → webhook → lead correto → mensagem persistida → Ana processa → CRM/Kanban consistente`

Além disso:

- nenhuma etapa crítica pode depender do navegador aberto;
- duplicidades/replays não podem gerar envio duplo;
- opt-out deve bloquear novos contatos;
- modo humano deve impedir resposta automática da Ana;
- handoff deve preservar histórico e responsável;
- Ambiente Real deve permanecer bloqueado se qualquer integração crítica ficar indisponível.

## Pendência externa conhecida

O Supabase Auth ainda reportava “Leaked Password Protection Disabled” no advisor de segurança. Essa opção deve ser habilitada no Auth antes do GO comercial.

## Itens deliberadamente não feitos sem evidência

- Não foram removidos em massa índices marcados apenas como “unused”; o volume de tráfego atual não permite concluir que são dispensáveis.
- Não foi ativado RAG semântico/embeddings sem definir e validar um provedor de embeddings adequado. A recuperação lexical existente continua preservada.
- O Ambiente Real não foi ativado artificialmente.
- Nenhum callback de WhatsApp foi fabricado para simular homologação.
