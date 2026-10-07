# Integrações

## 07/10/2026 — QR: erro PostgreSQL comprovado no gateway

Flavio chega ao provedor, mas seu cliente não inicia: `pq: sorry, too many clients already`. GET QR pode iniciar runtime; não repetir automaticamente. Edge v25 usa uma chamada QR sem connect redundante, mantendo JWT/tenant/owner e erro sanitizado. 67 testes locais, oito do bundle publicado, type-check e E2E de erro conferidos. QR real ainda FALHOU e depende de acesso à hospedagem. Vault contém ID atual, job contém ID histórico; nenhum segredo/job/instância alterado.


## 07/10/2026 — Gatilho por cadastro direto de vendedor

O fluxo local de criação direta insere `organization_members` como vendedor na RPC transacional; o trigger multi-tenant existente cria conta individual/integracão desabilitada e job único na mesma transação. A Edge só consulta/acorda esse job, nunca cria instância sem registro. Pré-flight exige gatilho ativo. Supabase oficial continua sem o trigger, e a Edge `team-members` v19 é anterior; não há vínculo automático na criação remota até release coordenada.

## 06/10/2026 — Instância remota reapareceu; credenciais divergentes

Uma leitura autenticada posterior mostrou uma instância desconectada com o nome do vendedor, mas ID e token diferentes dos guardados no Vault. O status individual ainda retorna HTTP 401. A constatação antiga de "zero instâncias" abaixo é histórica, não o estado atual. Não excluir nem criar cegamente: primeiro decidir preservação/reconciliação versus descarte, com verificação exata e auditoria. O monitor automático precisa distinguir ausência real de credencial divergente e resposta ambígua; sem isso não deve recriar.

## 06/10/2026 — QR Evolution GO: divergência entre job e servidor

O job individual observado está `awaiting_qr`, mas o Manager do servidor autenticado não lista instâncias. O token individual recebe HTTP 401 em `/instance/status`; QR não cria instâncias. A chave global e a URL corporativa foram validadas, sem exposição de segredos. `organization_members` remoto não possui trigger Evolution GO, e o `team-members` v19 ainda acorda WA-AKG ao criar vendedor. UI local informa a falha e impede retries da sessão; provisionamento/recriação permanece bloqueado por reconciliação e release coordenada.

## 06/10/2026 — Servidor Evolution GO corporativo validado

`evolution-go` v22 expõe estado público sem segredo e aceita somente admin para `save_server`/`test_server`; a URL/chave persistem no Vault, e a gravação conserva a integração inativa/pausada. O teste real autenticou `GET /instance/all` usando segredo preexistente, sem instância, QR ou mensagem. `evolution-go-worker` v5 só provisiona com `server_validation=passed` e credenciais corporativas completas no Vault; fallback de ambiente foi removido. Painel local validado; Site oficial e lifecycle/QR não publicados neste lote.

## 06/10/2026 — Evolution GO multi-tenant: job durável e pareamento do titular

O checkout local vincula cada vendedor ativo a uma conta privada e a **um job Evolution GO único por organização/usuário**; o worker só é acordado para job já persistido. O vendedor consulta e pareia somente a própria conta, enquanto URL/chaves permanecem fora do navegador. Desconexão/desativação preserva histórico de conversas e mensagens. Validação consolidada: 769 Vitest/93 arquivos, type-check app/Edge, lint, build/artefato, PGlite 6/6 e PostgreSQL nativo 2/2. Nada foi aplicado a Supabase, Edge, Site ou GitHub; sem QR, chamada a provedor, mensagem ou dado de cliente. Bloqueios: drift remoto, staging/homologação coordenada, gateway QR Evolution 400/500 e política de senha/Auth pendente.

## 06/10/2026 — Evolution GO: contrato de servidor remoto defasado

Frontend local usa `save_server` e `test_server`; a Edge Function oficial `evolution-go` v21 não implementa esses comandos e registrou `unsupported_action`. O worker oficial v4 ainda não confere `server_validation` para provisionamento. Apenas a mensagem local foi corrigida; nenhum deploy foi feito.

## 06/10/2026 — CORS de leitura Evolution GO e equipe na prévia local

`evolution-go` v21 e `team-members` v19 receberam somente o `_shared/http.ts` já ativo em `operational-diagnostics` v19, liberando a origem exata `http://127.0.0.1:4173` sem wildcard e mantendo JWT. Após a publicação cirúrgica das funções, a prévia autenticada carregou contas e membros reais. Não houve migration, alteração de payload/regra, ativação, QR, mensagem ou automação; Site inalterado.

## 06/10/2026 — Estado de uso operacional de APIs restaurado localmente

`a7bba77` mantém o estado em `integrations.enabled` e a fonte de busca em `lead_source_configs.enabled`. Na reativação de provedor conectado, validado e pausado, `configurar-integracao` limpa somente `paused`; na desativação não acessa nem remove segredo do cofre. Um provedor ainda não configurado abre o fluxo de credencial sem salvar falso estado. Edge e Site não foram publicados.

## 05/10/2026 — Evolution GO principal no código local

O aceite de vendedor passou a provisionar Evolution GO por RPC/fila; onboarding privado e QR estão na Central. A preferência SQL só afeta novos vínculos e destinos de transferência, preservando números já fixados. Adaptador, webhook, worker e despacho da Ana já existiam; controles do provedor, opt-out, handoff e pausa global continuam obrigatórios. Testes locais aprovados, nenhum gateway/QR/mensagem real chamado. A migration e as Edge Functions não foram aplicadas em produção; Site não publicado. Ver `docs/remediacao/2026-10-05-evolution-go-primary/RESULTADO_FINAL.md`.


## 05/10/2026 — R6/R7 locais; gateway WA-AKG bloqueado

Workers automáticos agora compartilham ledger com ações manuais; entrada tem persistência local atômica/lease e resultado Ana incerto fica em revisão. A UI oferece diagnóstico administrativo e conclusão somente para consulta comprovada; nunca replay cego de POST. Upstream WA-AKG examinado cria bot habilitado e ignora enabled:false no update; adaptador exige GET confirmando bot desligado antes de start/connect/QR. Não remover esse bloqueio. Falta versão corrigida/homologada e servidor persistente HTTPS. Nenhum QR, sessão ou mensagem real foi usado. Ver R6/R7/revisão na pasta atual.

## 05/10/2026 — Conta não é autorização global; delta local

WA-AKG/Evolution: habilitar conta não libera gates globais; abertura de controles depende de ação administrativa explícita e readiness canônica. UI distingue pendente/revisão/estado não confirmado, limpa QR anterior e atualiza por leitura após resultado ambíguo, sem retry de mutação. Desligamento local antecede chamadas ao gateway; cada nova etapa manual revalida intenção. Gateway real, contrato/tag, QR e provisionamento automático concorrente não homologados. Produção e credenciais não alteradas; ver `docs/remediacao/2026-10-05-r1-r3/RESULTADO_FINAL.md`.

- A Busca de Leads deriva o seletor das guardas já existentes: `integrations` confirma disponibilidade/credencial e `lead_source_configs` confirma o uso operacional. A interface não exibe IA ou fonte sem adaptador; hoje os adaptadores manuais permitidos são `apify` e `google_places`.

- Fonte de status: tabela `integrations`; segredo: cofre acessado por RPC no backend.
- Adaptadores implementados no painel: Z-API/WhatsApp, Claude/OpenAI da Ana, Apify e Google Places.
- `connected` só pode significar teste válido do adaptador; configurar credencial não basta.
- O painel distingue conexão validada de uso operacional: uma integração conectada porém
  desabilitada aparece como **Configurada · inativa**, nunca como offline nem ativa.
- Configurações usa dois blocos de integração sem repetição visual: **Canais** para conversas e
  Z-API, e **APIs** para IA e provedores de busca. Para Apify e Google Places, o mesmo cartão
  configura, testa e ativa/pausa o uso na Busca de Leads.
- `lead_source_configs` continua sendo a guarda operacional no backend: `prospectar-leads`
  exige tanto a integração validada quanto a fonte ativa. A tabela não é uma segunda credencial
  e não possui uma tela de configuração separada.
- O teste direto e a validação da Z-API aparecem somente em Canais > WhatsApp.
- Integração sem adaptador ou sem teste deve aparecer como não configurada, pendente, offline
  ou não verificada — nunca online por preset.
- Testes de provedor não devem enviar mensagens. Testes reais usam somente contas/números
  expressamente autorizados.
- No Dashboard, o resumo compacto intencionalmente reduz a leitura a **Conectado** ou
  **Desconectado**. O primeiro só é emitido pelo diagnóstico com `connected`, `enabled`, sem
  pausa/erro e teste fresco; os demais casos não recebem rótulo positivo.

## Seleção do provedor corporativo — 2026-09-25

- **Configurações > Canais > WhatsApp** apresenta Z-API e Meta WhatsApp Cloud API lado a lado.
  O administrador configura cada uma no próprio bloco e ativa somente um provedor corporativo por
  vez, evitando uma rota de saída ambígua.
- Desativar é reversível: bloqueia entrada, saída e automações da Ana no WayFlex, pausa as
  integrações daquela conta e registra auditoria; não apaga a sessão remota, o Vault nem o
  histórico. Um webhook de Z-API desativada recebe confirmação sem persistir, rotear ou reativar o
  canal.
- A decisão operacional está em `messaging_provider_controls`; o resolvedor server-side de conta
  também recusa provedor explicitamente desligado. A ausência de controle Z-API em organizações
  legadas mantém a compatibilidade até uma escolha explícita do administrador.
- Ativar uma conta corporativa também pausa as contas e integrações corporativas do outro
  provedor; a troca nunca deixa dois caminhos de saída ativos. Ao voltar à Z-API, o webhook interno
  é retomado, mas continua exigindo um callback real para que a entrada seja considerada homologada.
- O Dashboard usa as entradas sintéticas `whatsapp_zapi` e `whatsapp_meta`, calculadas no
  diagnóstico a partir de conta, integração e controle. Ele não deduz estado por texto histórico.

## 2026-09-11 — Apify Google Maps retomável

- `prospectar-leads` v8 não mantém a requisição do navegador aguardando o término do Actor.
  Ele grava o `provider_run_id`, devolve estado pendente e finaliza cache/resultados em uma
  consulta posterior autenticada do mesmo usuário e organização.
- Quando a origem devolve latitude/longitude (inclusive strings numéricas e variantes
  `lat`/`lng`), o normalizador preserva coordenadas válidas para o mapa da revisão.
- A ação de reparo para `apify_http_400` fica no backend `configurar-integracao` v16. Ela lê o
  segredo somente no Vault, troca o Actor de Google Maps, remove Task conflitante e mantém a
  fonte desativada/configurada até uma validação real. Nenhum token transita pelo navegador.
- Registros legados sem identificador remoto e vencidos são falha de execução, não resultado
  vazio; só os dois registros confirmados da organização ativa foram marcados como expirados.

## Meta WhatsApp Coexistence — 24/09/2026

- `whatsapp_accounts.provider` aceita `zapi` e `meta_cloud`; Z-API continua exigindo a integração
  atual, e ações Z-API rejeitam explicitamente contas Meta.
- O onboarding Meta usa Embedded Signup oficial. A UI é condicionada à flag por organização; não
  cria QR próprio e não recebe token permanente nem app secret.
- Webhook, envio e automação têm controles separados e kill switch. O estado real auditado é:
  duas contas Z-API conectadas, nenhuma conta Meta e todos os controles Meta fechados.
