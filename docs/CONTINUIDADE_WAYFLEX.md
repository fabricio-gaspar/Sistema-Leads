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
| 0. Continuidade e baseline | CONCLUÍDO | Baseline herdado + plano salvos no remoto em 901d128 |
| 1A. Segurança e contratos de entrada | PARCIAL — APLICADO | Parser/contratos/autenticação corrigidos; fila transacional/retry ainda pendentes |
| 1B. Timeout e saída | PARCIAL — APLICADO | Bloqueios, claim de saída e rastreio; homologação concorrente real ainda pendente |
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

## Checkpoint do lote de proteção do runtime

Estado: **APLICADO no Supabase; commit 72b3fd7 salvo no Git remoto.**
Funções confirmadas ACTIVE: `ana-run` v13 (verify_jwt=true), `automation-worker` v7
(verify_jwt=true), `webhook-whatsapp` v7 (verify_jwt=false, autenticação própria preservada).
O Site ainda está na versão 45 até a publicação do lote visual abaixo.

- `ana-run`: respeita sandbox, empresa ativa, ações IA, integração AI, kill switch remoto,
  modo humano, opt-out e pausa; vendedor limitado à carteira. Credenciais pertencem à organização.
- Simulação só registra a execução; não altera lead, tarefas, propostas, mensagens nem saída.
- Identidade de mensagem estável; execução anteriormente falha responde falha/409.
  Timeouts deixam de usar janela de dois minutos e de competir com o cron já existente.
- O proprietário temporário do timeout é `private.process_no_reply_deadlines`, cron já ativo
  a cada 15 minutos, com transação/lock. Não foi criado cron novo. A unificação definitiva
  com o núcleo de decisões e os gates de empresa desse cron ainda precisa de migração.
- Webhook: tipos Z-API explícitos; ecos do próprio número/grupos/notificações não acionam Ana;
  estados válidos; erros de escrita verificados; JWT interno no gateway preservando verify_jwt.
- Telefone comparado por identidade internacional completa; conflito entre leads é sinalizado.
  Compatibilidade provisória com registros brasileiros formatados; normalização/indexação ainda pendente.
- Eventos duplicados não reaplicam ações. O payload permanece guardado, porém a ingestão ainda
  não é uma transação única: queda entre gravações exige reconciliação. NÃO anunciar exactly-once completo.
- Fotos/áudios/documentos/vídeos recebidos ganham marcador de conteúdo não extraído e revisão humana.
  Isso não implementa extração/OCR/transcrição nem a biblioteca multimídia.
- Worker: claim condicional queued→processing; revalidação de bloqueios antes de cada envio;
  exige mensagem vinculada a uma execução concluída; rejeita contexto desatualizado e URL não oficial.
- Saída confirmada pelo provedor atualiza mensagem, outreach e ID do provedor. `sent` não é prova
  de entrega/leitura. Recibos de status recebidos ainda aguardam reconciliação específica.
- Resultado de envio ambíguo vai para `reconciliation_required`, sem reenvio automático.
  Queda após claim pode deixar `processing`: lease/heartbeat/alerta/reconciliação ainda pendentes.
- Jobs antigos sem vínculo de mensagem/contexto não são enviados automaticamente.
- Funções legadas enviar-whatsapp/enviar-email/ana-ia/lead-workflow ainda precisam ser consolidadas.
  Portanto estes gates não equivalem a proteção global comprovada de todos os caminhos.

Verificação local: 57 testes de políticas/contratos + 20 de handlers com persistência/provedor
simulados, além dos 27 testes anteriores. Type-check dos três handlers com tipos Supabase locais
e declaração mínima de Deno. Não é execução de Deno, teste Postgres/RLS nem WhatsApp/Claude real.
Nenhuma mensagem real enviada; nenhuma configuração de produção ativada.

## Login e indicação do modo — lote visual

LOCAL TESTADO, pronto para publicação no mesmo Site e audiência privada existente.

- Login WayFlex CRM com composição sóbria, campos acessíveis, autocomplete, mensagens de erro
  identificadas e sem métricas fictícias. Funções de autenticação existentes preservadas.
- Indicador do topo consulta `company_settings.sandbox_mode` com sessão/organização ativa,
  atualiza ao focar a janela e mostra falha de leitura. Não ativa integrações nem grava localStorage.
- A antiga alternância local Demo/Real foi retirada porque anunciava uma ativação inexistente.
  A transição real auditada/pré-flight é parte ainda pendente da etapa 1D.
- Type-check frontend/Edge e lint aprovados. Build Vite/artefato Sites aprovado.
- Inspeção do login por DOM e captura desktop 1363×936: sem rolagem horizontal, campos com
  rótulos associados e interface renderizada. Não houve login, redefinição de senha nem envio de e-mail.
- A revisão completa das telas autenticadas e a homologação mobile continuam pendentes.

Bloqueio de ferramenta: instalação via `npm exec --package=supabase` retornou
`network approval was cancelled before a decision was returned`. Não contornar nem repetir
instalação sem resolver autorização. A skill Supabase pede CLI para nomear migrações.
Testes usam ferramentas Node já instaladas, sem instalar dependências.

## Próxima ação exata

1. Salvar o lote visual no Git, empacotar build, salvar versão Sites e publicar na audiência privada já existente.
2. Registrar versão/commit da publicação e salvar este checkpoint no remoto.
3. Resolver bloqueio de ferramenta para novas migrações; implementar ingestão/filas transacionais,
   worker server-side com heartbeat e modo único com pré-flight.
4. Prosseguir consolidação dos caminhos legados, módulos/base/homologação e revisão visual completa.
