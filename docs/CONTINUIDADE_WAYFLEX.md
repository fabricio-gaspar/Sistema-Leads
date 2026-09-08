# Checkpoint — WayFlex CRM

Última atualização: 2026-09-08. Pedido autorizado: implementar o plano da auditoria,
com checkpoints retomáveis e revisão final de layout/login. **Ainda não concluído.**

## Como retomar quando Fabricio disser "pode seguir"

1. Reabrir este mesmo projeto e ler este documento, `AGENTS.md` e o estado Git.
2. Conferir o último commit remoto antes de editar; preservar alterações locais.
3. Revalidar apenas os contratos necessários à tarefa seguinte. Não repetir toda a auditoria.
4. Executar a próxima tarefa aberta, testar, atualizar este documento e salvar no remoto.
5. Não ativar disparos reais, não limpar histórico e não recriar infraestrutura faturável sem resolver o escopo.

## Identidade e estado inicial observado

- Diretório: `/workspace/sites/leadai-crm-preview`.
- Site: `appgprj_6a905559159c8191a61fb776b9a4c531`.
- Supabase: `thgzrkppouoevapjquyu`.
- Git inicial: `19ea9c4a55b566ec804cd52b8b3b248907022891`.
- Última versão Sites consultada: 45, baseada em `51a7b2fad682e537df6246ee6cde738fe735b0d7`.
- Alterações herdadas não commitadas: biblioteca Ana (UI/repository/ingest/migration), ranking de conhecimento e navegação.
- Backend observado antes desta etapa: ana-run v12, ana-ia v8, base-ana-ingest v1.

## Retificações da auditoria (confirmadas no código/contratos)

- 52/100 não tem rubrica objetiva; não usar como certificação ou medida de cobertura.
- `draft` e ausência de `lead_outreach` NÃO provam que não houve envio: worker envia à Z-API e não reconcilia esses registros.
- `ana-run` atual não lê `sandbox_mode` nem enabled/connected da integração AI. Portanto estes campos, sozinhos, não explicam a ausência da resposta; a falta de enforcement é outro defeito.
- Falha confirmada: webhook escreve `processing` em channel_inbound_events e `unmatched` em webhook_events; CHECKs remotos só aceitam received/processed/ignored/failed. Erros não são verificados.
- Falha confirmada: webhook chama ana-run com segredo interno mas sem Authorization; deploy ana-run exige verify_jwt=true e bloqueia antes do handler.
- Import de `type` de mocks não é dado simulado no bundle. Presets e dados operacionais precisam ser classificados separadamente.
- Falta de embeddings não prova busca ineficaz; avaliar recuperação em perguntas reais antes de prometer ganho de qualidade.
- CRUD deve corresponder ao domínio: logs não devem ser editados/duplicados; leads não devem ser duplicados sem regras de identidade.

## Plano e critérios

| Etapa | Estado | Entrega/aceite |
|---|---|---|
| 0. Continuidade e baseline | EM ANDAMENTO | Preservar trabalho herdado, plano no Git e release rastreável |
| 1A. Segurança e contratos de entrada | PENDENTE | Autenticação interna, webhook válido/idempotente, mídia encaminhada sem inventar conteúdo |
| 1B. Timeout e saída | PENDENTE | Ocorrência única por deadline, pausa humana respeitada, modo seguro no backend |
| 1C. Worker independente | PENDENTE | Cron, lock, retry, dead-letter, heartbeat e teste com painel fechado |
| 1D. Modo/integrações | PENDENTE | Única configuração remota, pré-flight e saúde real no painel |
| 2. Stores e módulos | PENDENTE | Sem seed operacional fictício; salvar/erro/concorrência/permissões por módulo |
| 3. Base multimídia | PENDENTE | Extração/OCR/transcrição, revisão, vigência, recuperação avaliada e mídia segura |
| 4. Segurança/homologação | PENDENTE | Testes RLS/concorrência/E2E, advisors, piloto autorizado |
| 5. Design final | PENDENTE | Login sem números fictícios, painel elegante, legível, responsivo e consistente |

## Política de retomada e entrega

- Checkpoints devem registrar concluído, em andamento, bloqueios e próximo comando/tarefa.
- Cada etapa pequena é salva no Git remoto; salvar código não significa publicar o Site.
- Enquanto não homologado, preservar sandbox e bloquear saída; nunca usar leads reais como fixtures.
- Homologação separada ainda precisa ser provisionada com confirmação de eventual custo; não criar branch paga implicitamente.
- Nenhum processo continua rodando pelo agente depois do fim da conversa/créditos. Retomada acontece no próximo pedido.

## Próxima ação exata

Salvar baseline herdado e implementar/testar o primeiro lote de contratos e proteções do runtime.
Consultar índices/constraints antes de migração; usar fixtures sintéticas e não callbacks privados nos testes.
