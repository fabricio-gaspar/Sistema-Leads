# Auditoria e consolidação — Sistema de Leads Wayflex

Data: 09/09/2026  
Projeto canônico: projeto aberto no ChatGPT Work  
Comparação: `fabricio-gaspar/Sistema-Leads`, branch `stabilize/production-readiness-2026-09-09`  
Backend: Supabase `Sistema de Leads`  

## Parecer executivo

O projeto atual foi preservado como fonte principal. A branch de estabilização foi tratada
somente como referência: não houve merge global, substituição da árvore ou rollback do
frontend atual. Foram recuperados apenas contratos já comprovados no backend e correções
necessárias para eliminar regressões identificadas por testes.

Resultado geral estimado: **86/100**.

Decisão: **NO-GO para comercialização autônoma em Ambiente Real** e **GO para homologação
controlada em Ambiente de Demonstração**. O bloqueio não é mais o cadastro da Z-API nem o
worker: o scheduler está ativo e a saída Z-API está validada. Falta receber e processar uma
mensagem direta real de um lead cadastrado; o último callback observado foi de grupo e foi
corretamente ignorado. Também permanecem incompletos o processamento multimídia da base da
Ana e testes reais das integrações externas opcionais.

## Método de consolidação

1. Inventário do Git atual, alterações em andamento e versão publicada.
2. Fetch somente leitura da branch de estabilização.
3. Comparação módulo a módulo, sem preferência estética ou refatoração ampla.
4. Confronto com schema, migrations, Edge Functions e dados operacionais implantados.
5. Correções cirúrgicas acompanhadas por testes automatizados e transações com rollback.
6. Manutenção obrigatória de `company_settings.sandbox_mode = true` durante a auditoria.

## Classificação dos 36 módulos

| # | Módulo | Classificação | Nota | Evidência e decisão |
|---:|---|---|---:|---|
| 1 | Login e autenticação | ✅ ESTÁVEL | 88 | Autenticação Supabase real preservada. Aviso externo de proteção contra senhas vazadas permanece. |
| 2 | Dashboard | ⬆️ MELHORIA COMPROVADA | 90 | Métricas remotas, diagnóstico operacional e pipeline canônico de sete etapas. |
| 3 | Leads | ✅ ESTÁVEL | 88 | Persistência por organização e carteira preservada; criação transacional testada. |
| 4 | Cadastro/importação | ✅ ESTÁVEL | 82 | Criação real comprovada; importação não foi executada contra fonte externa neste lote. |
| 5 | Normalização de telefone | ✅ ESTÁVEL | 95 | Trigger/RPC canônicos e identidade brasileira testados. |
| 6 | Prospecção | ⚠️ NÃO CONFIRMADO | 72 | Código usa integrações e segredos da organização; provedores estão offline e não foram chamados. |
| 7 | Kanban/Pipeline | 🔧 REGRESSÃO CORRIGIDA | 92 | Frontend voltou ao fluxo Novo → Apresentado → Qualificando → Reunião → Orçamento → Ganho/Perdido. |
| 8 | Central de Atendimento | ✅ ESTÁVEL | 91 | Conversa usa lead e mensagens reais; saída humana permanece na fila segura. |
| 9 | Histórico de conversas | ✅ ESTÁVEL | 92 | Histórico cronológico real e RLS restaurada; sem conversa simulada. |
| 10 | Ana | ✅ ESTÁVEL | 88 | Regras de não invenção e handoff preservadas; limitações documentais continuam. |
| 11 | `ana-run` | ✅ ESTÁVEL | 90 | Autoridade automática canônica; consulta contexto, histórico, regras e supressões. |
| 12 | `lead-workflow` | ⬆️ MELHORIA COMPROVADA | 84 | Fonte local reconciliada com a ponte de compatibilidade implantada, delegando a `ana-run`. |
| 13 | `automation-worker` | ⬆️ MELHORIA COMPROVADA | 93 | Fonte reconciliada com backend v13; execução server-side e heartbeat confirmados. |
| 14 | Z-API envio | ✅ ESTÁVEL | 82 | Instância e saída validadas sem envio real neste lote. |
| 15 | Z-API webhook | 🔧 REGRESSÃO CORRIGIDA | 72 | Diagnóstico agora distingue grupo, direção de saída, ausência de callback, sem lead e falha. Falta teste direto real. |
| 16 | Identificação WhatsApp → lead | ⬆️ MELHORIA COMPROVADA | 95 | Prioridade por vínculo/identidade/conversa IA; ambiguidade bloqueada em teste transacional. |
| 17 | Follow-ups | ✅ ESTÁVEL | 82 | Worker e handlers preservados; sem disparo real durante a auditoria. |
| 18 | Scheduler server-side | ✅ ESTÁVEL | 96 | `pg_cron` ativo por minuto e heartbeat atual comprovado; independe do navegador. |
| 19 | Handoff humano | 🔧 REGRESSÃO CORRIGIDA | 94 | UI usava estado inválido. Operações agora são RPCs atômicas e foram testadas ida/volta. |
| 20 | Agenda | ✅ ESTÁVEL | 91 | Agendamento interno funciona sem Google e foi testado em transação. |
| 21 | Google Calendar | ⚠️ NÃO CONFIRMADO | 60 | Integração opcional está offline; não afeta agenda interna. |
| 22 | Orçamentos | 🔧 REGRESSÃO CORRIGIDA | 92 | Contrato JSON/status alinhado ao runtime e ciclo de estados testado; não há Pedido/Venda. |
| 23 | Base de conhecimento da Ana | ✅ ESTÁVEL COM LIMITAÇÃO | 75 | Busca textual preservada; híbrida só entra quando embeddings existem. |
| 24 | Documentos e anexos | ⚠️ NÃO CONFIRMADO | 48 | Registro existe; extração completa, OCR e transcrição ainda não estão implantados de ponta a ponta. |
| 25 | Integrações | ✅ ESTÁVEL | 90 | Categorias persistidas separam comunicação, prospecção, inteligência e agendamento. |
| 26 | E-mail/Resend | ⚠️ NÃO CONFIRMADO | 55 | Função reconciliada, mas integração opcional está offline e não foi chamada. |
| 27 | Relatórios | ✅ ESTÁVEL | 72 | Fonte preservada; não houve E2E autenticado de todas as combinações. |
| 28 | Configurações | ✅ ESTÁVEL | 88 | Organização por efeito e persistência remota mantidas; stores legados secundários ainda existem. |
| 29 | Ambiente Demo/Real | ✅ ESTÁVEL | 96 | Autoridade única no banco e pre-flight bloqueiam produção incompleta; teste negativo passou. |
| 30 | RLS/RBAC | 🔧 REGRESSÃO CORRIGIDA | 91 | Políticas permissivas-base de mensagens/propostas restauradas sem remover restrições. |
| 31 | Multiempresa | ✅ ESTÁVEL | 95 | Teste com segunda organização comprovou isolamento de lead, mensagem e proposta. |
| 32 | LGPD/opt-out | ✅ ESTÁVEL | 86 | Supressões, bloqueios e auditoria preservados; sem envio real. |
| 33 | Auditoria/logs | 🔧 REGRESSÃO CORRIGIDA | 90 | RPC de handoff agora grava `actor_name` obrigatório e mantém trilha append-only. |
| 34 | Testes | ⬆️ MELHORIA COMPROVADA | 88 | 115 testes verdes, incluindo resolver ambíguo e callback de grupo. Falta E2E autenticado/provedor real. |
| 35 | CI/build | ⬆️ MELHORIA COMPROVADA | 94 | CI passa a executar typecheck das Edge Functions; validação local equivalente ficou verde. |
| 36 | Preview/deploy | ⬆️ MELHORIA COMPROVADA | 92 | Artefato de produção aprovado; publicação desta consolidação deve apontar para o commit registrado no release. |

## Correções aplicadas

- Pipeline frontend e Dashboard alinhados às sete etapas canônicas, com Ganho e Perdido
  separados. A Ana continua proibida de marcar Ganho automaticamente.
- Handoff humano convertido em duas operações transacionais no banco: solicitar e devolver
  para a Ana. A pausa e a criação/fechamento do handoff não podem mais divergir.
- RLS de `lead_messages` e `proposals` corrigida após teste revelar default deny causado por
  políticas apenas restritivas.
- Contrato de orçamento alinhado ao runtime atual: itens podem usar a estrutura versionada
  do frontend e os estados usados pela aplicação foram permitidos.
- Diagnóstico Z-API refinado: callbacks de grupo/lista/canal não homologam entrada; mensagens
  enviadas pelo próprio número não são confundidas com respostas do lead.
- CI ampliado para verificar TypeScript das Edge Functions.
- Código-fonte local reconciliado com funções e migrations que já estavam implantadas no
  Supabase, restaurando reprodutibilidade sem alterar o comportamento validado do backend.

## Reconciliado com o backend já implantado

Foram trazidas ao repositório as fontes implantadas de `lead-workflow`, `webhook-whatsapp`,
`automation-worker`, `base-ana-ingest`, `prospectar-leads`, `enviar-email` e
`testar-integracao`. Também foram recuperadas 16 migrations de prontidão que já constavam no
histórico remoto do Supabase. Isso não representa reaplicação nem rollback do banco: corrige a
divergência entre fonte e ambiente.

## Novas migrations aplicadas e testadas

- `20260909231814_atomic_handoff_operations.sql`
- `20260909232209_fix_atomic_handoff_audit_actor.sql`
- `20260909232713_restore_message_proposal_rls_base.sql`
- `20260909233057_align_proposal_runtime_contract.sql`

O primeiro teste de handoff identificou a obrigatoriedade de `audit_logs.actor_name`; a
transação falhou e foi revertida integralmente. A migration seguinte corrigiu o contrato e o
teste completo passou, sem deixar dados sintéticos.

## Evidências de teste

| Verificação | Resultado |
|---|---|
| TypeScript frontend | Aprovado |
| TypeScript Edge Functions | Aprovado |
| ESLint | Aprovado, zero warnings |
| Testes automatizados | 13 arquivos, 115 testes aprovados |
| Build de produção | Aprovado, 430 módulos |
| Criação transacional de lead | Aprovada e revertida |
| Normalização de telefone | Aprovada |
| Pipeline inicial | `novo`, aprovado |
| Mensagem/histórico | Aprovado |
| Handoff ida e volta | Aprovado atomicamente |
| Agenda interna | Aprovada sem Google |
| Orçamento e ciclo de status | Aprovado e revertido |
| Idempotência/matching ambíguo | Ambiguidade bloqueada, aprovado |
| Bloqueio Demo/Real | Produção recusada enquanto readiness incompleto |
| Worker server-side | Cron e heartbeat confirmados |
| RLS multiempresa | Zero registros cruzados para lead, mensagem e proposta |
| Limpeza dos dados sintéticos da auditoria | Confirmada, zero resíduos |

Não foram executados: envio real de WhatsApp, callback direto fabricado, chamada a Claude,
Google Calendar, Resend, Apify, Google Places ou CNPJ. Portanto, este relatório não afirma que
esses roundtrips externos estejam homologados.

## Estado real do teste WhatsApp

- A conexão de saída Z-API está configurada e validada.
- O cadastro do webhook de entrada existe.
- O scheduler server-side está ativo.
- O callback mais recente ligado ao teste foi uma conversa de grupo (`isGroup=true`) e o
  backend a ignorou corretamente como `non_direct_conversation`.
- Existem dois registros históricos com o mesmo sufixo de telefone. O resolver escolhe a
  única conversa IA ativa; se duas candidatas igualmente válidas existirem, ele bloqueia em
  vez de selecionar o primeiro lead.

Para homologar entrada, o lead deve enviar uma mensagem em conversa individual, do telefone
cadastrado, para o número conectado à instância Z-API. Não é necessário salvar novamente ID,
Token ou Client Token, nem preparar novamente o worker.

## Pendências reais

1. Homologar uma mensagem direta WhatsApp → webhook → lead → histórico → `ana-run` em
   Ambiente de Demonstração e comprovar o evento de ponta a ponta.
2. Concluir extração de PDF/DOCX/PPTX/XLSX, OCR de imagens e transcrição de áudio/vídeo antes
   de prometer memória multimídia completa.
3. Executar E2E autenticado das telas e roundtrips dos provedores opcionais que forem vendidos.
4. Ativar proteção contra senhas vazadas no Auth do Supabase. Referência oficial:
   <https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection>.
5. Observar índices por uma janela real de tráfego antes de avaliar os 111 avisos de índices
   sem uso; eles não devem ser removidos automaticamente.

## Decisão final

**NO-GO para liberar Ambiente Real e comercialização autônoma neste momento.**

**GO para o próximo teste controlado em Ambiente de Demonstração:** enviar uma mensagem direta
de um lead cadastrado e acompanhar o diagnóstico. Após esse único fluxo passar exatamente uma
vez, deve-se reavaliar o gate operacional. A incompletude multimídia precisa permanecer clara
no escopo comercial até sua implementação e homologação.
