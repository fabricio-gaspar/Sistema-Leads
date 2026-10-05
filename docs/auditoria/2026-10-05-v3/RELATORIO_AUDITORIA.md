# Auditoria executável WayFlex V3 — parecer NO-GO

**Não liberar comercialmente o escopo integral descrito no protocolo V3.** Foram encontrados bloqueadores reproduzidos de autorização por carteira, emergência administrativa, convites, retomada de eventos e recibos. A inspeção segura possível foi encerrada com evidências; **a homologação ponta a ponta permanece incompleta**. Nenhuma correção de produto, migração ou publicação em produção foi executada.

Auditoria `WAYFLEX-V3-20261005`, 05/10/2026, America/Sao_Paulo. Modo AUDITORIA_E_TESTES autorizado pela confirmação do usuário; arquivo de referência: PROMPT_MESTRE_WAYFLEX_V3_AUDITORIA_COMPLETA.md. Instruções operacionais do repositório lidas; a restrição direta de permanecer no checkout/main prevaleceu sobre a sugestão de branch do protocolo.

SHA-256 do protocolo lido: `e3fd8b2986a649db291e8e1dc7f01f369e3a6349b0aa7dbe020a7d8e6449f497`.

## 1. Versões e ambientes comprovados

| Camada | Estado observado |
|---|---|
| Checkout auditado | `main`, commit `847048429a86294aa10fa54ffdd750c04447d4fb` |
| GitHub no início | `fabricio-gaspar/Sistema-Leads/main`, `9fdfb554ed5e23b1edc5b7e5250bd8df84cbad7d` |
| Equivalência | Ambos os commits têm tree `324d69608bc780d7d4d8abffe1121767e04bbcb9`: arquivos versionados já estavam sincronizados, históricos diferentes |
| Site oficial | [WayFlex](https://leadai-crm-preview.fabricio926564.chatgpt.site), **v168**, ativo/público |
| Fonte publicada | `87b9b8309eb8fc0fa4d47611c7a1315598fc4f76`, release isolada, não o checkout integral |
| Deploy existente | `appgdep_6ac3d1bec3e48191ba29a2d5559426a8`, succeeded, 05/10 16:36:12 UTC |
| Supabase | `thgzrkppouoevapjquyu`, ACTIVE_HEALTHY, Postgres 17.6.1.155, 106 tabelas públicas com RLS, 171 migrations e 33 Edge Functions ativas |
| Homologação isolada | Não foi identificado projeto de staging independente; somente main no inventário |
| Provas locais | Contratos/handlers reais com transportes simulados e Postgres WASM/PGlite em memória; não são cópia integral de produção |

Evidência: EV-ENV-001/002/008. O inventário de branches mostra também rótulo histórico MIGRATIONS_FAILED, enquanto projeto e preview estão saudáveis: **não se infere falha atual de schema por esse rótulo**. A referência de publicação não mudou durante a auditoria. Novos commits de evidência/checkpoint, se gravados, não são uma nova versão do produto.

## 2. Resultado executivo dos testes

| Grupo | Resultado | O que prova / não prova |
|---|---|---|
| Suíte normal Vitest | **77 arquivos, 421 testes aprovados** | Regressão já codificada; muitos testes usam mocks |
| Tipos frontend + configuração Edge existente | Aprovados | O tsconfig Edge cobre uma seleção, não todas as funções |
| Lint, build, pacote Sites | Aprovados | Artefato local gerado; não enviado nem publicado |
| Smoke analítico | **17 verificações aprovadas** | Cálculos determinísticos, não dados externos |
| Novos casos de segurança | **16: 4 aprovados / 12 reprovados** | 12 SQL locais com políticas/corpos remotos; 4 contratos JS |
| Novos casos mensageria | **13: 1 aprovado / 12 reprovados** | Parsers, handlers, recuperação e concorrência simulados |
| Novos casos produto | **11: 2 aprovados / 9 reprovados** | CSV, estado, agenda e indicador, sem rede |
| Total novos casos adversariais | **40: 7 aprovados / 33 reprovados** | Amostra dirigida por risco, NÃO taxa de qualidade do sistema |
| Type-check expandido para todas as Edge | **Reprovado: 9 diagnósticos** | Lacuna real de verificação/reprodutibilidade local |
| SQL remoto não mutante de recibos | **Reprovado, SQLSTATE 42883** | Expressão inválida confirmada no corpo implantado |
| UI autenticada do Site | **5 casos aprovados** | Wizard, reflow, Central, ajuda por teclado e carteiras vazias, somente admin |
| QR/envio/entrega/resposta Ana reais | **Não executados / bloqueados** | Sem gateway/staging/destinos de teste autorizados |

Os 8 testes focais de segurança são subconjunto da suíte normal: não foram somados novamente. Os 40 casos novos são deliberadamente independentes do include normal; suas falhas não foram ocultadas ajustando a expectativa ao defeito. Mensageria/produto encerram com saída1; os instrumentos de segurança encerram com saída0 e registram as reprovações no JSON (não são gates de CI). Casos planejados, requisitos e jornadas agregadas não entram nesse denominador.

## 3. Bloqueadores prioritários e causa comprovada

| Prioridade | Evidência | Resultado e alcance |
|---|---|---|
| P1 | ACH-SEC-001/002/003; EV-SEC-004 | Políticas permissivas permitem ao vendedor ler/excluir propostas e documentos alheios na mesma empresa, listar mídia privada fora da carteira e remover supressão. Provas SQL locais; nenhum cliente real acessado |
| P1 | ACH-MSG-001/002/003/011; EV-MSG-002 | Ativação individual remove emergência da empresa; desconexão falha antes do corte local; erro de persistência vira sucesso; resposta antiga pode vencer desativação mais nova |
| P1 | ACH-MSG-017; EV-ENV-006 | RPC de recibos implantada inicializa variável com `pg_catalog.coalesce`, expressão inexistente; afeta caminho compartilhado Z-API/Evolution/WA-AKG |
| P1 | ACH-MSG-004/006/007/008/010/012 | Recibo oficial ignorado, LID opaco convertido em telefone, mídia sem legenda perdida, retry interrompido perdido, processing sem recuperação e timeout Meta com segunda tentativa cega |
| P1 | ACH-SEC-004/005 | Último admin protegível pela Edge, mas removível direto no banco; trigger Auth ignora cancelamento de convite e conflita com aceite posterior |
| P1 | ACH-UI-003; ACH-SEC-007 | Dados/cache de autorização sobrevivem à troca de identidade/empresa nos contratos locais; E2E de duas contas permanece pendente |
| P1 | ACH-UI-004/005 | Próxima ação da Agenda tem início=fim e é rejeitada pelo validador; interruptores comerciais persistidos não têm consumo nos caminhos encontrados |
| P1 / lacuna comercial | ACH-SEC-009 | Dono de plataforma, planos, suspensão do tenant e suporte contextual não encontrados; admin cliente não equivale a dono global |
| P2 | ACH-ENV-001/002 abaixo | Verificação Edge incompleta e rotina de prospecção ativa com seis falhas registradas |

Não foi observado incidente/exploração/duplicação de entrega em cliente. Os achados condicionais, estáticos e dinâmicos são diferenciados nos relatórios especializados. Reset global de identidade multiorg (ACH-SEC-006) é risco alto condicional; a consulta atual encontrou zero identidades com múltiplos vínculos. O relatório não o apresenta como conta já comprometida.

## 4. Achados adicionais da frente ambiente

### ACH-ENV-001 — Tipagem normal não inclui todas as Edge Functions

**P2, confiança alta, contrato local REPROVADO.** `tsconfig.edge.json` inclui somente parte dos entrypoints. T-ENV-004 executou a configuração ampliada em EVIDENCIAS/tsconfig-edge-all.json: 9 erros em cleanup-test-leads (2), enviar-email (2 imports), operational-diagnostics (4) e webhook-evolution-go (1 declaração EdgeRuntime). Esperado: todo fonte implantável verificável; observado: comando normal verde e comando integral vermelho.

O bundle remoto de enviar-email tem layout de index + _shared que resolve seus imports. Portanto **não se afirma indisponibilidade remota de e-mail apenas por falha de import local**. Declaração de EdgeRuntime também não prova erro de runtime. Correção futura: incluir todos os entrypoints, alinhar empacotamento/tipos ao runtime e repetir os dois type-checks. EV-ENV-005 registra comando/saída; EV-ENV-002 distingue fontes iguais e divergentes.

### ACH-ENV-002 — Prospecção agendada ativa sem cidade obrigatória

**P2, confiança alta, estado remoto REPROVADO.** Em 05/10 21:31 UTC, seis runs automáticos estavam failed, último em 12:00:04 UTC, erro `prospecting_city_required`. Agenda atual da organização operacional está active=true, filtros objeto sem chave cidade e sem cidade não vazia (EV-ENV-003/007).

O worker encaminha filtros da agenda ao prospectar-leads; este exige cidade. Esperado: configuração bloqueada antes de ativar ou erro acionável para operador, sem repetir rotina inválida. Não foi editada a agenda nem executada nova busca. Fonte: automation-worker:1716; prospectar-leads:357. Critério: reconciliar configuração sem inventar cidade, validar antes de ativar e provar execução em sandbox. Cron saudável não significa prospecção concluída.

## 5. Arquitetura e fontes de verdade

Frontend React/Vite/TypeScript → repositories/RPC/Edge → Supabase Postgres/Auth/Storage/Vault. `ana-run` é a autoridade automática; despacho externo usa filas/workers, não o navegador. Fonte operacional é Supabase. Meta possui outbox própria e não herda automaticamente garantias do worker geral.

Há divergências importantes: policies ALL sobrepostas, catálogo de conhecimento vs services/preços, política commercial_catalog_policy vs knowledge_usage, cache frontend sem contexto e trigger Auth remoto sem baseline local correspondente. Nenhuma foi “normalizada” nesta auditoria.

Inventário detalhado de 30 recursos e navegação em MODULOS_E_UX; tabelas/grants em EV-SEC-006; 9 recursos de mensageria e versões externas no relatório especializado. Dependências e ciclo estão na matriz própria. Fonte publicada do Site, fonte local e bundle Edge são camadas separadas.

## 6. Operação observada e limites

- WA-AKG, Evolution e Meta: gates fechados/kill switch ativo no snapshot; WA-AKG tem **zero contas, jobs de provisionamento e eventos**. Não significa implantação externa pronta.
- Empresa operacional: modo real/Ana automática habilitado e agenda de prospecção ativa já existiam. Z-API possui gates abertos, mas integração/entrada sem conexão validada atual. Não se declarou “todas as automações desligadas”.
- Cron de dispatch responde a cada minuto; na última hora observada, 60 respostas HTTP 200 e heartbeat recente. Há cron de lembretes e sweep. Nenhum job foi disparado manualmente.
- Zero leads e filas operacionais verificadas no snapshot; nenhuma execução da Ana registrada nos sete dias consultados. Ausência de carga não comprova sucesso de ponta a ponta.
- Google/Outlook/e-mail operacionais não homologados. Flags true em organizações sandbox sem validação não são prova de conexão.
- Banco, histórico, sessões, contas, credenciais e crons existentes foram preservados. Não houve callback antigo reprocessado, QR, envio ou ativação de integração.

## 7. UX, acessibilidade e jornadas

Wizard percorreu Fonte → Região → Perfil → Critérios sem consulta externa; reflow sem overflow horizontal global em 320/390/1024/1440 CSS px. Ajuda de Leads abriu com Enter e fechou com Escape. Central exibiu conta própria ainda não provisionada e zero conversas; Leads, Agenda e Orçamentos mostraram estados vazios. Capturas em EVIDENCIAS/ui e registro EV-LIVE-001.

Isso **não é certificação WCAG 2.2 AA**. Tooltip não hoverable e modal CSV sem contrato completo foram identificados estaticamente; contraste, leitor de tela, todos os perfis, zoom, volumes altos e loading/error de cada tela seguem pendentes. A especificação compacta é proposta, não redesign executado. Não existem capturas “depois da correção”, pois não houve correção.

J01–J16 e CIC-01–16 receberam prova parcial ou bloqueio explícito em JORNADAS_PONTA_A_PONTA e na matriz de rastreabilidade. Nenhuma jornada externa integral recebeu GO. O protocolo cobre o ciclo completo, não somente a primeira ativação.

## 8. Revisão crítica e documentos entregues

Revisões independentes das frentes segurança/mensageria confirmaram os achados prioritários. Foram refutados ou rebaixados: suposto update cross-org de documento (RLS negou); SECURITY DEFINER como falha automática; versão package/tag WA-AKG como incompatibilidade isolada; import local de e-mail como queda remota; tab antiga como prova de release errada. Somente evidência proporcional sustenta o parecer.

- [Rastreabilidade](MATRIZ_REQUISITOS_TESTES_EVIDENCIAS.csv), [cobertura](MATRIZ_DE_COBERTURA.csv) e [ciclo dos módulos](MATRIZ_CICLO_DE_VIDA_MODULOS.csv).
- [Segurança/acessos](SEGURANCA_E_ACESSOS.md), [provedores/Ana](PROVEDORES_ANA_E_RECUPERACAO.md), [produto/UX](MODULOS_E_UX.md).
- [Jornadas](JORNADAS_PONTA_A_PONTA.md), [bloqueios](BLOQUEIOS_E_ACESSOS.md), [checklist](CHECKLIST_DE_LIBERACAO.md).
- [Remediação](PLANO_DE_REMEDIACAO.md), [implementação/regressão](RELATORIO_IMPLEMENTACAO_E_REGRESSAO.md), [evidências](EVIDENCIAS/index.md).
- [Mapa de navegação](MAPA_NAVEGACAO_E_RECURSOS.md), [UI compacta](ESPECIFICACAO_UI_COMPACTA.md), [fontes/decisões](FONTES_E_DECISOES.md).

## 9. Estado final e próxima ação exata

Apenas documentos, instrumentos de teste e checkpoints foram adicionados. Fixtures locais foram descartadas pelos processos; não há dados de teste remotos a apagar. Override de viewport restaurado. Os arquivos pnpm preexistentes foram preservados. Nada foi ativado, pausado, desconectado ou restaurado em produção, e nenhuma chamada externa de negócio iniciada ficou incerta.

**Próxima etapa depende de autorização explícita de remediação:** corrigir primeiro autorização/emergência e a RPC de recibos, repetir os casos adversariais, depois convite/retomada e contratos de provedor. Homologação real exige ambiente isolado, gateway persistente compatível, duas organizações/perfis e destinos/cotas de teste. Não solicitar login/senha no chat. Publicação requer release revisada e autorização própria; não publicar todo checkout por consequência da auditoria.
