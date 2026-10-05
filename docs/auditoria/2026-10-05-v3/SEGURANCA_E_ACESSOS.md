# Segurança e acessos — auditoria V3

Parecer desta frente: **NO-GO para comercialização irrestrita multiempresa**. A existência de RLS foi confirmada nas 106 tabelas públicas, mas políticas permissivas permitem ações fora da carteira em propostas, documentos e mídia. O ciclo de convites diverge entre trigger remoto e Edge Function. Há caminhos diretos que contornam a preservação do último administrador e a proteção de supressões. O plano, a suspensão da empresa e o dono da plataforma separado não foram encontrados no escopo pesquisado. São bloqueadores específicos; não é uma alegação de exploração do ambiente real.

## Escopo e modalidade

- Repositório atual, `main`, HEAD `847048429a86294aa10fa54ffdd750c04447d4fb`; sem branch/worktree novo.
- Inspeção e provas em 05/10/2026, aproximadamente 18:22–18:30 America/Sao_Paulo / 21:22–21:30 UTC.
- Projeto remoto `thgzrkppouoevapjquyu`: somente consultas `SELECT` de catálogo/configuração não secreta e contagem agregada; nenhuma escrita de dados, função de negócio, convite, mensagem, QR ou provedor real.
- Políticas e corpos de funções reais do catálogo foram carregados em PostgreSQL WASM/PGlite 0.3.14, em memória, com duas organizações e quatro identidades sintéticas. O schema de prova contém as colunas necessárias à autorização; não é cópia integral de produção, PostgREST ou GoTrue.
- O handler `team-members` e o repositório `currentAccessRepository` foram transpilados diretamente do código auditado e executados com transportes simulados. Autenticação do ator foi fixture autorizada de administrador A; não houve bypass de login real.
- Resultado de 16 cenários novos: **4 APROVADOS e 12 REPROVADOS**. Suíte preexistente focal: **4 arquivos / 8 testes aprovados**. Os cenários novos são escolhidos por risco e não representam uma taxa global de segurança do produto.

Origem de requisitos: prompt V3 Parte I C–F, invariantes 1/2/4/14/15; Parte II capítulos 8, 9, 15, 19 e 23. A proibição de mutação real e de mensagens da conversa foi mantida. `AGENTS.md` e `.agent/AGENT_OS.md` foram respeitados no diagnóstico; produto e checkpoints ficaram sob coordenação do agente principal.

## Inventário reconciliado

| Recurso encontrado | Fonte / API / persistência | Uso e acesso | Estado / ciclo / cobertura |
|---|---|---|---|
| Cadastro, login, logout, recuperação | `src/hooks/useAuth.tsx:120`; Supabase Auth; `/register`, `/login`, `/reset-password` | Identidade única; metadata usada para apresentação/dados iniciais, não para papel | Inspeção; reset administrativo simulado; fluxo real bloqueado para não enviar e-mail |
| Provisionamento inicial | `src/lib/organization.ts:12`; `create_organization`; trigger remoto `private.handle_new_auth_user` | Cria organização, administrador cliente, settings/pipeline | Contratos divergentes; trigger provisiona por Auth, RPC `create_organization` não consta no catálogo remoto atual |
| Organização ativa | `src/lib/organizationSession.ts:9`; `set_active_organization`; `profiles.active_organization_id`; `current_org_id` | Contexto compartilhado no perfil, validado por vínculo ativo | Troca em duas abas real não testada; parâmetro de fallback difere do remoto; ACH-SEC-011 |
| Membros | `organization_members`; `team-members` | Administrador cliente / delegação `team.manage`; papéis `administrador`, `vendedor`, `sdr`, `cx` | Criar, convidar, editar, bloquear, reativar, remover; provas identificam lacunas de convite/admin final |
| Papel legado | `user_roles`, `has_role` | Registro paralelo; `has_role` remoto revalida perfil/vínculo de administrador | Nenhum dono global encontrado; reconciliação integral dos dois registros pendente |
| Permissões granulares | `_shared/permissions.ts:3`; `team_member_permissions`; `private.has_org_permission`; `current_user_access` | 19 permissões; administrador sempre permitido; demais defaults + overrides | Helpers revalidam vínculo ativo; cache frontend não invalida; políticas paralelas não usam todas as permissões |
| Equipe e acessos UI | `UsersAccessWorkspace.tsx`; `/dashboard/equipe`, configurações | Lista, criar, editar, papel, senha temporária, permissões, convites, política | MFA/papéis disponíveis não são aplicados pelo handler; prévia de papéis difere do backend |
| Proteção de rotas | `src/router/config.tsx:59`; `PermissionRoute.tsx` | Busca, Central, Leads, Kanban, Funil, Equipe, Relatórios, Agenda, Orçamentos, Auditoria, Configurações, Meu WhatsApp | Gating frontend por RPC; Empresa/Mídia dependem do wrapper autenticado e proteção de dados; não substitui backend |
| Carteira | `leads`, `lead_messages`, helpers `can_access_lead/can_manage_lead/can_reply_to_lead` | Leitura/edição por empresa e dono/responsável | Lead alheio negado na prova SQL; propostas/documentos/mídia não acompanham a mesma restrição |
| Propostas, documentos, tarefas e agenda | `proposals`, `documents`, `lead_tasks`, `appointments` | Operação comercial ligada a carteira | `org_active_access FOR ALL` encontrado; propostas/documentos reproduzidos; tarefas/agenda inspeção estática |
| Supressões e consentimentos | `contact_suppressions`, `consent_events` | Opt-out/supressão necessários ao gate de envio | Vendedor remove supressão via política ALL; não foi feita chamada de envio subsequente |
| Storage | buckets `docs` 25 MiB, `message-media` 50 MiB, `ana-knowledge` 100 MiB; todos privados | Prefixo de pasta igual à organização ativa; MIME allowlists | Isolamento entre organizações no predicado; sem escopo carteira/visibilidade para conteúdo privado |
| Credenciais | `store/read/delete_integration_secret`, Vault; `createAdminClient` | Segredos server-side; funções de segredo sem EXECUTE anon/authenticated | GRANTs remotos confirmados; busca por padrões de chave no frontend não encontrou hits |
| Sessões | `revoke_user_auth_sessions`; `auth.sessions`; `requireUser` | Revogação de refresh sessions no bloqueio/reset/delete | Helper service-only; JWT antigo depende de validade e revalidação de vínculo; não verifica `session_id` em cada ação sensível |
| Exclusão de identidade | `team-members:849`; `list_user_owned_storage`; Storage API | Bloqueia exclusão se outro vínculo encontrado; remove dados privados/credenciais | Inspeção; sem teste destrutivo remoto; senha/e-mail global não têm o mesmo bloqueio multiorg |
| Auditoria | `audit_logs`, `private.audit_business_change`, logs de `team-members` | Rastro por org/ator; maioria de ações sensíveis registrada | Triggers catálogo examinados; integridade/ator falsificado por INSERT direto não testados nesta frente |
| SECURITY DEFINER exposto | Seis RPCs públicas executáveis por authenticated: `current_user_access`, `configure_lead_handoff_policy`, `central_list_transfer_targets`, `assign_human_handoff`, `request_human_handoff`, `return_handoff_to_ana` | Helpers controlados de contexto/handoff | `auth.uid` e contexto em todos; inspeção dos corpos, sem execução real de handoff; revogação fina de overrides ainda requer teste |
| View | `operational_readiness` | Indicadores consultados pela UI | `security_invoker=true` confirmado, não prova exatidão dos indicadores |
| Dono plataforma / suporte contextual | Pesquisa em `src`, funções/migrations, enum remoto | Exigido pelo V3 para nível global e suporte auditado | Não encontrado; sem role/rota/controlador separado comprovado |
| Planos/licenças/módulos/suspensão | Pesquisa de plan/subscription/platform/suspension; colunas `organizations` | Requisito comercial J16 | `organizations` remoto tem somente id/name/slug/created_at/updated_at; falta autoridade contratual encontrada |
| Backup, restauração, migração interrompida | Fora do acesso operacional seguro deste lote | Continuidade J15 | BLOQUEADO; ausência de homologação isolada/restauração demonstrada, não falha comprovada do backup |

O inventário completo das **106 tabelas**, GRANTs authenticated e quantidade de políticas por tabela está em [EV-SEC-006](EVIDENCIAS/seguranca/EV-SEC-006-inventario-remoto.json). Todas as políticas públicas/Storage retornadas foram preservadas em [EV-SEC-001](EVIDENCIAS/seguranca/EV-SEC-001-politicas-remotas.json). Isso não significa CRUD de 106 tabelas homologado: o campo de modalidade da matriz distingue catálogo, prova local e bloqueio.

## Matriz efetiva de perfis

| Perfil | Escopo padrão implementado no helper | Limite comprovado / lacuna |
|---|---|---|
| Administrador cliente | Todas as 19 permissões na própria organização ativa/membership | Não é dono plataforma; `team.manage` alcança alteração global de senha/e-mail do membro |
| Vendedor | Leads atribuídos, criar/editar atribuídos, responder atribuídos, orçamentos, canal próprio | Leads alheios negados; propostas/documentos/mídia/supressões escapam por outras políticas |
| SDR | Leads todos/atribuídos, criar/editar todos/atribuídos, conversas todas, responder todas, busca, propostas | UI de prévia mostra menos que backend; overrides de handoff não homologados |
| CX | Leads todos/atribuídos, editar atribuídos, conversas todas/responder todas | UI diz conversas atribuídas; alcance backend mais amplo |
| IA legado | Enum `ia` existe; helper granular não concede defaults, algumas RPCs antigas usam role `ia` | Não é login humano novo disponibilizado pela UI; revisar governança na remediação |
| Usuário desativado | Membership deixa de ser ativo | Provas SQL negaram proposals/Storage com identidade antiga; sessão real/refresh não executados |
| Dono plataforma / suporte | Não encontrados | Requisitos comerciais não homologados |

`user_metadata` não determina papel em `useAuth.tsx:52–62` nem no helper de permissão. Nome/empresa são dados editáveis e não devem virar fonte de autoridade. `current_user_access` remoto busca membership ativo a cada chamada; o problema de atualização está no cache do navegador, não nessa RPC.

## Achados reproduzíveis

### ACH-SEC-001 — Política genérica libera propostas e documentos de colegas

- **P1, confiança alta; REPROVADO.** Origem: V3 carteira/permissão por recurso, cap. 8/9. Recursos: propostas/documentos.
- Remoto: `org_active_access FOR ALL TO authenticated` é permissiva e só exige membro ativo. Em `proposals` faz OR com `phase2_proposals_*`; em `documents` faz OR com regras uploader/admin. O GRANT remoto permite SELECT/INSERT/UPDATE/DELETE.
- Fonte local relacionada: `supabase/migrations/20260909232713_restore_message_proposal_rls_base.sql:1`; snapshot EV-SEC-001. Não inferir o mesmo problema em `lead_messages`: as políticas atuais dessa tabela foram substituídas posteriormente.
- Reprodução: fixture vendedor A2 sem propriedade do lead/proposta A3. `SELECT proposals` retorna A3 e `DELETE ... RETURNING` exclui A3; documento enviado por A3 também excluído. Esperado: negar/zero linhas. T-SEC-002/003/004, EV-SEC-004.
- Impacto: quebra de carteira e exclusão por papel sem privilégio administrativo; nenhum registro real foi modificado. Para tarefas/agenda existe sinal estático equivalente, mas não se estende a aprovação/reprovação dinâmica sem casos próprios.
- Remediação proposta: remover/restringir políticas ALL sobrepostas, alinhar cada ação à regra canônica; regressão com dois vendedores, duas empresas, permissões false e CRUD negativo. Sem correção neste lote.

### ACH-SEC-002 — Arquivos privados da carteira não têm autorização por objeto

- **P1, confiança alta; REPROVADO.** Origem: V3 invariante de carteira/arquivos e cap. 9.
- Storage tem buckets privados e allowlists, mas `storage_active_org_*` e `storage_ana_knowledge_*` só validam `bucket_id` e primeira pasta = `current_org_id`. O significado de `documents.visibility='restricted'` não aparece no predicado de Storage.
- Fonte: EV-SEC-001 políticas `storage.objects`; `20260906133000_ana_approved_knowledge_library.sql:29–58`.
- T-SEC-005: vendedor A2 lista mídia do colega A3 fora da carteira. Esperado: negar leitura privada por objeto. Observado: caminho sintético visível. Prova local SQL, não obtenção de arquivo real.
- Correção: vincular objeto ao recurso/lead/visibilidade e verificar dono/permissão por operação; manter acervo compartilhado explicitamente autorizado. Testar listagem, assinatura de URL, upload, overwrite, delete, expiração e tentativa cross-org.

### ACH-SEC-003 — Supressão removível por qualquer membro ativo

- **P1, confiança alta; REPROVADO.** Origem: V3 invariante 4/23D e proteção opt-out.
- `contact_suppressions` remoto tem ALL org_active_access e GRANT de DELETE; único trigger de negócio encontrado é auditoria. T-SEC-006 remove supressão A como vendedor em PostgreSQL isolado.
- Isso contorna a intenção de helper `clear_contact_suppressions` ser service-only. Não prova que um envio subsequente passaria: opt_out e outros gates são controles adicionais.
- Correção: retirar escrita direta ampla e exigir ação autorizada/auditada específica, preservando razões/consentimento e sem reativar backlog. Aceite: DELETE direto negado e retomada autorizada revalidada.

### ACH-SEC-004 — Último administrador protegido somente na Edge

- **P1, confiança alta; REPROVADO.** Origem: V3 cap. 8 preservação último admin.
- `ensureAnotherAdministrator` em `team-members/index.ts:278` faz SELECT e valida antes da alteração. Porém `organization_members_admin_delete/update` e GRANTs permitem acesso direto; no catálogo só há trigger de auditoria.
- T-SEC-008: último admin A remove o próprio vínculo por SQL sob authenticated. Nenhum erro, uma linha removida. A API de equipe recusaria autoexclusão; o backend de dados permite.
- Há ainda janela de concorrência entre check/update da Edge, não reproduzida aqui. Corrigir invariante no banco/transação e restringir escrita; testar exclusão direta, rebaixamento, desativação e duas operações concorrentes.

### ACH-SEC-005 — Trigger Auth incompatível com ciclo de convite

- **P1, confiança alta; REPROVADO.** Origem: J01/J02; convite cancelado não autoriza, acesso só após aceite.
- Corpo remoto `private.handle_new_auth_user` (EV-SEC-002) seleciona convite não aceito/não expirado, **sem cancelled_at**, cria membro active e grava accepted_at. A Edge `team-members/index.ts:604–619` posteriormente grava invited; `activate_invite:451–470` exige accepted_at null.
- T-SEC-010: convite sintético cancelado, ainda válido, cuja identidade ainda não existe → insert Auth → membership active/accepted=true/cancelled=true. Condição de ocorrência está explicitada; não é evidência de exploração de convites reais.
- T-SEC-011: convite novo → trigger Auth → upsert invited do handler → consulta de ativação no login: membro invited e **0 candidatos**. A homologação GoTrue/e-mail real permanece bloqueada, mas incompatibilidade persistente foi reproduzida em SQL com corpo remoto exato.
- Correção: uma autoridade transacional para reserva/convite/aceite, filtro de cancelamento, idempotência e recuperação parcial; definir suporte a conta já existente sem apagar identidade externa.

### ACH-SEC-006 — Administrador de empresa pode alterar identidade global compartilhada

- **P1 para a oferta atual; impacto potencial P0 se identidades multiorg forem habilitadas; confiança alta no caminho de código. REPROVADO em contrato simulado.** Origem: V3 identidade única, isolamento de organizações e invariante 14.
- `team-members/index.ts:647–650` só confirma alvo membro da empresa A; `reset_password:708–715` chama `auth.admin.updateUserById(target,{password})` e revoga todas sessões; `update_member:664–692` muda e-mail global com email_confirm. A checagem de outros vínculos existe somente para `remove:851–854`.
- T-SEC-013: administrador A e usuário alvo com vínculos A/B sintéticos. Handler real retorna 200 e registra AUTH_GLOBAL_UPDATE(password), sem consultar outros vínculos. Com uma senha escolhida por A, a identidade poderia alcançar B.
- Consulta agregada remota: **0 identidades com múltiplas organizações** no momento; não afirmar comprometimento atual. Prova não efetua login externo e não usa senha real.
- Correção: separar gestão de vínculo empresarial da gestão global de identidade; fluxo pelo próprio titular ou autoridade plataforma, evitando que admin cliente redefina identidade compartilhada. Testar reset/e-mail/desativação/exclusão com múltiplos vínculos.

### ACH-SEC-007 — Cache de autorização não acompanha mudança de empresa/papel

- **P2, confiança alta; REPROVADO.** Fonte: `currentAccessRepository.ts:10,27–37`; `useCurrentAccess.ts:22`; `useAuth.tsx:193` logout; busca não encontrou chamada de `clearCurrentAccess` em produção.
- T-SEC-012: primeira consulta org A/admin; resposta backend passa a B/vendedor; segunda chamada mesmo userId retorna A/admin, RPC chamada só uma vez. Não há TTL/chave organização/revisão nem invalidação por logout/org/papel.
- Impacto comprovado: menus/ações/UI exibem permissão/contexto antigo. Não prova escalada backend, cujos helpers revalidam membership. Correlacionar com ACH-UI-003 (stores de dados), sem contar a mesma evidência como prova do cache de dados.
- Corrigir chave/invalidação/revalidação e tratar duas abas; teste de token antigo, redução/aumento de papel, logout/login mesmo usuário e troca de empresa.

### ACH-SEC-008 — Política MFA e papéis disponíveis são informativos no backend

- **P2, confiança alta; REPROVADO contra o comportamento anunciado pela tela.** UI `UsersAccessWorkspace.tsx:252` diz “Exigir MFA”/“Membros devem usar segundo fator”; `availableRoles` afeta selects. Backend guarda os flags em `organization_module_data` mas `memberRole:15` só valida conjunto fixo; handlers create/invite/update_role não consultam disponibilidade.
- T-SEC-014: papel vendedor unavailable=false na fixture → update_role retorna 200. T-SEC-015: reset administrativo com aal1 e requireMfa=true → 200, nenhuma leitura da política. Não significa MFA do Supabase quebrado: enforcement/enrollment não foi implementado nesse controle do app.
- A confirmação UI explica “marcar ... para revisão”; isso é diferente de exigir segundo fator. Não foi encontrado agendamento de revisão trimestral ou fila de revisão MFA; classificado como inspeção estática.
- Correção: definir contrato do controle e aplicar no backend/fluxo MFA ou rotular explicitamente como registro de intenção. Testar bypass direto, sessão antiga e usuário sem enrollment.

### ACH-SEC-009 — Três níveis, suporte e entitlement comercial não encontrados

- **P1, confiança alta na ausência no escopo pesquisado; REPROVADO para J16 amplo.** Pesquisa em `src`, funções, migrations e enum/tabela remotos.
- Papéis remotos: administrador, vendedor, ia, sdr, cx. Não foram encontrados role/controlador/rota de dono plataforma distinto, suporte contextual temporário, planos/licenças ou autoridade de suspensão do tenant. `organizations` só contém id/name/slug/timestamps.
- Isso não acusa administrador cliente de se promover a dono: tal papel sequer foi comprovado. Ausência é lacuna do contrato comercial V3. Ofertar piloto de escopo reduzido exige decisão identificada, não aceitação pelo auditor.
- Remediação: definir autoridade/plano/suporte e testes antes da implementação. Não adicionar cobrança/checkout sem escopo aprovado.

### ACH-SEC-010 — Auth permite senhas vazadas segundo advisor

- **P2, confiança alta; REPROVADO no critério técnico de endurecimento.** Advisor remoto `auth_leaked_password_protection`, WARN. Nenhuma senha foi consultada ou testada.
- Definir política e habilitar proteção compatível com o plano em fase autorizada. [Orientação oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Não é prova de conta comprometida.

### ACH-SEC-011 — Contrato de recuperação de contexto difere do remoto

- **P2, confiança alta estática; REPROVADO no contrato.** `organizationSession.ts:34` envia `target_organization_id` para `set_active_organization`, enquanto a assinatura remota usa `_organization_id` (EV-SEC-001). Erro RPC é ignorado.
- Condição: perfil sem active_organization_id, mas com membership; função retorna contexto ao caller sem persistir contexto corretamente. Caminho de duas abas/login real não executado. `create_organization` local também está ausente no catálogo, mas trigger de Auth pode provisionar sem esse caminho; não classificar todo cadastro como indisponível por esse motivo.
- Corrigir contrato/falha e reconciliar migrations/estado remoto; testar perfil sem contexto, empresa removida, membro convidado e token válido com contexto inválido.

### ACH-SEC-012 — Prévia visual de papéis diverge das permissões efetivas

- **P2, confiança alta estática.** `UsersAccessWorkspace.tsx:43–47` monta matriz própria: CX é descrito como conversas atribuídas, SDR mostra resposta atribuída e não inclui proposals.manage; helper `_shared/permissions.ts:16–28` e SQL remoto dão conversas todas a CX/SDR e propostas a SDR. A prévia usa ainda `conversations.read_assigned`, que não integra as 19 permissões canônicas.
- O cliente pode aprovar acesso acreditando em escopo inferior ao real. Reusar a fonte canônica de permissões e comparar UI/RPC/Edge/RLS com testes de matriz. Não inferir novo privilégio a partir dessa prévia.

## Resultados e limites por jornada

| Jornada | Estado da frente | Comprovado | Pendente concreto |
|---|---|---|---|
| J01 Nova empresa | REPROVADO / parcial | Trigger e ciclo invite inconsistente; schema e defaults inspecionados | Conta nova real + confirmação e-mail + módulos contratados + primeira operação em ambiente isolado |
| J02 Acessos | REPROVADO | Carteira leads negada; propostas/Storage ampliam escopo; admin final contornável; cache/política falham | Perfis reais dono/admin/vendedor/SDR/CX/suporte; sessões antigas, duas abas e troca org E2E |
| J15 Continuidade/segurança | REPROVADO / BLOQUEADO | RLS habilitada, view invoker, segredos RPC protegidos; desvios de políticas reproduzidos | Restore verificado, migração interrompida, frontend antigo, dependências e sessão roubada/revogada em sandbox |
| J16 Liberação comercial | REPROVADO | Ausência encontrada de entitlement/suspensão/dono suporte; identidade compartilhada insegura no handler | Regra comercial, tenant reduzido/suspenso/reativado/cancelado em homologação |

Ciclo de vida do acesso: criar/convidar → ativar/aceitar → mudar papel/permissão → suspender → renovar sessão → reativar → remover vínculo/identidade. A prova isolada cobre os desvios descritos e bloqueio por membership disabled, não logout remoto real. Revogar refresh sessions não torna JWT já emitido instantaneamente inválido; membership disabled protege os caminhos que revalidam vínculo. `reset_password` mantém membership ativo e não consulta session_id em cada ação.

Ciclo de Storage: upload → vínculo ao recurso → ler/assinar URL → trocar conteúdo → revogar/excluir. Buckets/tamanho/MIME e políticas foram inspecionados; leitura indevida intraempresa reproduzida; upload real/URL assinada expirada/remoção física não testados. Remoção de usuário usa API Storage e RPC service-only, mas purge não foi executado.

Ciclo de tenant/plano/suporte: não há implementação encontrada suficiente para ativar/suspender/retomar/excluir módulos por contrato ou suporte com duração. Classificar como lacuna de implementação, não teste impossível “NÃO APLICÁVEL”.

## Revisão adversarial e falsificações evitadas

1. **Hipótese refutada:** update de documento próprio para organização alheia foi negado por RLS no PostgreSQL local (T-SEC-016). Não se relata vulnerabilidade cross-org com base só na expressão UPDATE isolada.
2. SECURITY DEFINER executável por authenticated é aviso de revisão, não defeito automático. Todos os seis corpos públicos encontrados verificam identidade/contexto; handoff real não foi chamado. Alguns usam papel/ownership em vez dos overrides finos, o que segue NÃO TESTADO no caso de revogação fina.
3. Cinco tabelas sem política têm RLS habilitada e finalidade backend; isso corresponde a negar cliente por padrão. O INFO do advisor não é P0.
4. Nenhuma política sem RLS foi encontrada. Isso não absolve políticas permissivas; provas mostram a diferença entre RLS habilitada e regra correta.
5. Nenhuma alteração cruzada de cliente real, senha real, e-mail ou arquivo privado foi usada para confirmar bugs. Defeito com fixture é separado de exploração e estado de produção.
6. A quantidade de identidades reais multiorg é zero; ACH-SEC-006 registra condição futura/permitida pelo modelo, sem inventar cliente afetado.
7. Não houve correção do produto nem publicação. Primeira execução do harness PGlite falhou por nome de parâmetro reservado `audit.user`; o harness foi corrigido para `audit.user_id`. Primeira prova JS falhou por caminho de fixture; corrigido o caminho. Essas falhas de instrumento não foram ocultadas como falhas do produto nem consideradas testes de segurança.

## Fontes profissionais consultadas

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), consulta 05/10/2026: grants + políticas, defesa por tabela/objeto, view invoker e testes positivos/negativos. Aplicada ao inventário e às provas; não foi usada para certificar isolamento sem execução.
- [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html), consulta 05/10/2026: autorização por requisição, menor privilégio e testes. Referência técnica para bypass de API direta e identidade global; não inventa regra comercial do CRM.
- [OWASP ASVS](https://owasp.org/projects/asvs), consulta 05/10/2026: referência de verificação; nenhuma certificação ASVS ou número de requisito não verificado alegado.
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions), consulta 05/10/2026: distinguir access token de sessão renovável e exigir prova de revogação adequada ao caso.
- [Changelog Supabase](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes), 25/09/2026, consultado 05/10: atualização menor PostgreSQL anuncia correções de segurança e cuidados com extensões. A análise de upgrade/backup é encaminhada à frente geral; nenhuma atualização executada.

## Evidências, reprodução e limpeza

| Evidência | Conteúdo |
|---|---|
| EV-SEC-001 | Políticas públicas/Storage + helpers atuais do catálogo |
| EV-SEC-002 | Trigger Auth e helpers de papel/propriedade atuais |
| EV-SEC-003 | Corpos das cinco RPCs de handoff públicas auditadas estaticamente |
| EV-SEC-004 | Saída de 12 cenários SQL/PGlite, incluindo hipótese refutada |
| EV-SEC-005 | Saída de quatro cenários do código real com transportes simulados |
| EV-SEC-006 | 106 tabelas, grants, política por tabela, enum, triggers e contagem multiorg |
| EV-SEC-007 | Catálogo de SECURITY DEFINER/view/buckets e advisor de segurança com timestamp |
| EV-SEC-008 | Comandos, resultados da suíte focal e limitações do harness |

Scripts: [provas-rls.mjs](EVIDENCIAS/seguranca/provas-rls.mjs) e [provas-codigo.mjs](EVIDENCIAS/seguranca/provas-codigo.mjs). Matriz: [matriz-seguranca.csv](EVIDENCIAS/seguranca/matriz-seguranca.csv).

Dados de prova existiram somente em bancos WASM em memória, fechados ao final, e objetos JS sintéticos. Não há dados remotos para limpar. PGlite foi instalado com scripts desabilitados em `/tmp/wayflex-security-audit.vU7Foe`, fora do projeto; nenhum package/lock do produto foi alterado. Dependência temporária pode ser reutilizada para a repetição documentada. Os arquivos pnpm preexistentes do checkout foram preservados.
