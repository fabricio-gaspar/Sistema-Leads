# Jornadas ponta a ponta e ciclo de vida

As jornadas abaixo são requisitos agregadores, não 16 testes aprovados. Nenhuma jornada externa integral foi homologada. REPROVADO identifica pelo menos um bloqueador sustentado; os passos externos continuam bloqueados. NÃO TESTADO identifica inspeção sem execução dinâmica suficiente. Todos os dados de prova são sintéticos locais; ambiente real foi somente lido.

## J01 — Nova empresa

- Fluxo exigido: Cadastro/provisionamento → responsável → convite/aceite → configuração → primeira operação.
- Resultado: **REPROVADO**. Trigger contradiz cancelamento/aceite; planos ausentes.
- Prova parcial: T-SEC-010/011; ACH-SEC-005/009/011; EV-SEC-002/004.
- Falta: Conta nova, confirmação e-mail, falha parcial, primeira operação; sem dados cruzados.
- Dependência: BL-01/03/04/05 em BLOQUEIOS_E_ACESSOS.md.

## J02 — Acessos

- Fluxo exigido: Dono/admin/vendedor/SDR/CX/suporte → rota → API → dados → token antigo → duas abas/troca empresa.
- Resultado: **REPROVADO**. Negativos de lead e membro desativado passaram; propostas/Storage/cache/identidade falharam.
- Prova parcial: T-SEC-001..016; T-UI-006..008; EV-SEC-004/005; EV-UI-001.
- Falta: Executar login/perfis reais e redução de acesso sob sessão antiga; RLS+Edge+UI coerentes.
- Dependência: BL-01/04/05 em BLOQUEIOS_E_ACESSOS.md.

## J03 — Entrada de lead

- Fluxo exigido: Busca/manual/CSV → validar → deduplicar → revisão → importar → retomar/repetir.
- Resultado: **REPROVADO**. Wizard sem chamada passou; CSV corrompe multiline/aspas; agenda sem cidade.
- Prova parcial: T-UI-001..005/010; T-LIVE-001; ACH-ENV-002; EV-UI-001; EV-LIVE-001; EV-ENV-003/007.
- Falta: Busca com cota, importação parcial/repetida e atribuição real em sandbox.
- Dependência: BL-01/03 em BLOQUEIOS_E_ACESSOS.md.

## J04 — Distribuição/pipeline

- Fluxo exigido: Carteira → responsável → IA/humano → limite diário → Kanban → avanço/retorno → resultado → histórico.
- Resultado: **BLOQUEADO**. Contratos existentes passaram; nenhum lead criado/movido/excluído nesta auditoria.
- Prova parcial: T-BASE-004; inspeção REC-UI-07..11; vitest-baseline.json; MODULOS_E_UX.md.
- Falta: Executar lead sintético por duas carteiras, perda/ganho humano, undo e histórico atômico.
- Dependência: BL-01/04 em BLOQUEIOS_E_ACESSOS.md.

## J05 — WhatsApp individual

- Fluxo exigido: Gateway → conta → sessão única → QR/consentimento → conexão → saúde → autorização.
- Resultado: **REPROVADO**. Gates/transições falham nos mocks; UI conta ainda não criada; nenhum QR real.
- Prova parcial: T-MSG-001..003/012; ACH-MSG-013..015; T-LIVE-003; EV-MSG-002; EV-LIVE-001.
- Falta: Parear somente conta de teste; tag fixada; duas orgs; limite global preservado.
- Dependência: BL-01/02/03 em BLOQUEIOS_E_ACESSOS.md.

## J06 — Mensagem completa

- Fluxo exigido: Saída autorizada → ID → resposta externa → inbox correta → Ana → dados → recibos.
- Resultado: **REPROVADO**. Perdas/duplicidade semântica/recibos e SQL falham; nenhum envio real.
- Prova parcial: T-MSG-004..009/013; T-ENV-005; EV-MSG-002; EV-ENV-006.
- Falta: Um destino consentido por provedor, recibo e resposta com correlação, sem reenviar incerto.
- Dependência: BL-01/02/03 em BLOQUEIOS_E_ACESSOS.md.

## J07 — Atendimento/handoff

- Fluxo exigido: Humano assume → transfere → devolve → resposta tardia → canal correto.
- Resultado: **NÃO TESTADO**. Inspeção e contratos existentes; ferramenta Calendar antes do gate tardio é risco estático.
- Prova parcial: T-BASE-004; ACH-MSG-016; EV-SEC-003; vitest-baseline.json; PROVEDORES_ANA_E_RECUPERACAO.md.
- Falta: Suspender modelo/freeBusy; assumir atendimento; provar zero efeito posterior e histórico preservado.
- Dependência: BL-01/03/04 em BLOQUEIOS_E_ACESSOS.md.

## J08 — Outros canais

- Fluxo exigido: E-mail/notificação → autenticar → fila → entrega/falha → recibo/entrada se previsto → quota.
- Resultado: **BLOQUEADO**. Sem envio/e-mail real; imports locais diferem de bundle; recepção não encontrada.
- Prova parcial: Inspeção R-MSG-08/09; T-ENV-004; EV-ENV-005; PROVEDORES_ANA_E_RECUPERACAO.md.
- Falta: Sandbox SMTP/API e destinatário próprio; não prometer recepção ausente.
- Dependência: BL-01/03 em BLOQUEIOS_E_ACESSOS.md.

## J09 — Conhecimento/mídia

- Fluxo exigido: Publicar fonte → buscar contexto → atualizar/excluir → mídia segura → compreensão/humano.
- Resultado: **REPROVADO**. Mídia sem legenda perdida; acesso sem carteira; políticas/catálogos divergentes.
- Prova parcial: T-MSG-007; T-SEC-004/005; ACH-UI-005/010; EV-MSG-002; EV-SEC-004; EV-UI-002.
- Falta: Áudio/imagem/vídeo/documento e injeção indireta; revogação de fonte e URL expirada.
- Dependência: BL-01/03/07 em BLOQUEIOS_E_ACESSOS.md.

## J10 — Reunião/orçamento

- Fluxo exigido: Qualificação → tarefa → agenda/conflito → catálogo → valores humanos → aprovação → documento → envio.
- Resultado: **REPROVADO**. Próxima ação duração zero; propostas sem carteira; aprovação e entrega externas não testadas.
- Prova parcial: T-UI-009; T-SEC-002/003; ACH-MSG-016; EV-UI-001; EV-SEC-004.
- Falta: Agenda/fuso/conflito; nenhuma decisão automática de preço/desconto/prazo/ganho.
- Dependência: BL-01/03/04 em BLOQUEIOS_E_ACESSOS.md.

## J11 — Ciclo dos módulos

- Fluxo exigido: Ativar → pausar → desativar → desconectar → retomar; dependências e filas.
- Resultado: **REPROVADO**. Corte local/conflito falham; flags sem efeito; ciclo integral ausente.
- Prova parcial: T-MSG-002/003/012; ACH-UI-005; EV-MSG-002; MATRIZ_CICLO_DE_VIDA_MODULOS.csv.
- Falta: Executar CIC-01..16 por módulo, preservar núcleo/histórico e provar recursos exclusivos encerrados.
- Dependência: BL-01/02/05 em BLOQUEIOS_E_ACESSOS.md.

## J12 — Troca de provedores

- Fluxo exigido: Validar novo → exclusividade → ponto de corte → in-flight → recibos → incerto/compensação.
- Resultado: **REPROVADO**. Recibo após pausa descartado, ativação velha vence e timeout pode repetir.
- Prova parcial: T-MSG-009/012/013; ACH-MSG-015; EV-MSG-002.
- Falta: Duas transições concorrentes e dependências compartilhadas; sem fallback silencioso.
- Dependência: BL-01/02/03 em BLOQUEIOS_E_ACESSOS.md.

## J13 — Operação autônoma

- Fluxo exigido: Cron sem browser → worker → timeout/interrupção → lease → retry/reconciliação.
- Resultado: **REPROVADO**. Cron e HTTP 200 confirmados; negócio falha/caso processing não retoma.
- Prova parcial: T-MSG-008/011/013; T-ENV-002/003; EV-MSG-002; EV-ENV-003/007.
- Falta: Restart seguro com jobs sintéticos; nenhum efeito duplicado ou backlog cego.
- Dependência: BL-01/02/03 em BLOQUEIOS_E_ACESSOS.md.

## J14 — Gestão/indicadores

- Fluxo exigido: Fonte operacional → filtros/período/carteira → agregação → atualização/erro/vazio.
- Resultado: **REPROVADO**. 17 cálculos passaram; Mensagens hoje soma período; estados vazios corretos.
- Prova parcial: T-UI-011; T-BASE-007; T-LIVE-005; EV-UI-001; T-BASE-007.log; EV-LIVE-001.
- Falta: Fixtures com dias/fuso/carteiras; fonte transacional; volume e erro parcial.
- Dependência: BL-01/04/07 em BLOQUEIOS_E_ACESSOS.md.

## J15 — Segurança/continuidade

- Fluxo exigido: RLS/arquivos/segredos → inputs → versões → backup/restore → migração/falha.
- Resultado: **REPROVADO**. RLS presente mas políticas falham; tipos completos falham; restore não testado.
- Prova parcial: T-SEC-001..016; T-ENV-004/005; T-BASE-001..006; EV-SEC-004/005/006; EV-ENV-005/006.
- Falta: RLS real isolada, backup restaurado, migrations compatíveis e dependências/custo.
- Dependência: BL-01/04/06/07 em BLOQUEIOS_E_ACESSOS.md.

## J16 — Liberação comercial

- Fluxo exigido: Implantação → plano reduzido → suspensão → reativação → desligamento → suporte/limites.
- Resultado: **REPROVADO**. Implementação de autoridade comercial/global não encontrada.
- Prova parcial: ACH-SEC-009; inventário REC-UI-29; SEGURANCA_E_ACESSOS.md; MODULOS_E_UX.md.
- Falta: Definir oferta; provas de entitlement/API mesmo com sessão antiga; suporte auditado.
- Dependência: BL-05 em BLOQUEIOS_E_ACESSOS.md.

## Cenários CIC obrigatórios

| Cenário | Requisito | Resultado | Evidência parcial | Limite / observado | Bloqueio |
|---|---|---|---|---|---|
| CIC-01 | Desativar com jobs na fila | NÃO TESTADO | T-BASE-004; MSG relatório §7 | Guardas existem; falta corte atômico em fila/dispatch real | BL-01/02 |
| CIC-02 | Desativar durante resposta da Ana | NÃO TESTADO | ACH-MSG-016 | Ferramenta de agenda antes do gate tardio; concorrência dinâmica pendente | BL-01/03 |
| CIC-03 | Desativar com provedor inacessível | REPROVADO | T-MSG-002 | Falha externa mantém enabled local | BL-02 |
| CIC-04 | Reiniciar durante transição | REPROVADO | T-MSG-011 | Evento processing antigo não é recuperado; restart real não feito | BL-01/02 |
| CIC-05 | Alternar ativar/desativar em duas abas | REPROVADO | T-MSG-012 | Resposta antiga reativa após desativação nova em fixture | BL-01/04 |
| CIC-06 | Repetir provisionamento/ativação | NÃO TESTADO | ACH-MSG-013/014 | Enum incompatível e webhook POST não idempotente na inspeção; gateway pendente | BL-02 |
| CIC-07 | Desativar recurso compartilhado/dependência | NÃO TESTADO | ACH-MSG-015; matriz módulos | Namespace sem org pode colidir; falta cascata e prova de independência | BL-01/02 |
| CIC-08 | Recibos tardios/fora de ordem | REPROVADO | T-MSG-004/005/009; T-ENV-005 | Parser, dedupe, gate e SQL impedem contrato de conciliação | BL-02/03 |
| CIC-09 | Reativar backlog antigo | NÃO TESTADO | PROVEDORES_ANA_E_RECUPERACAO.md §7 | Guardas parciais; não foi reprocessado callback histórico | BL-01/02 |
| CIC-10 | API direta com menu oculto/módulo off | REPROVADO | T-SEC-002..008; ACH-UI-005 | RLS direta permite ações indevidas; flags não governam consumidores | BL-01/04 |
| CIC-11 | Atendente tenta configuração global | REPROVADO | T-MSG-001 | connect_own remove kill_switch da empresa | BL-01/02 |
| CIC-12 | Provedor retorna após pausa | APROVADO | T-MSG-010 | Handler WA-AKG simulado mantém enabled=false; não homologado demais caminhos | BL-02 |
| CIC-13 | Um provedor ativo por escopo | NÃO TESTADO | T-MSG-012; matriz provedores | Corrida de intenção provada; exclusividade multiprovedor real ainda não testada | BL-01/02 |
| CIC-14 | Logout/consentimento revogado | BLOQUEADO | Matriz provedores | Não foi feito logout remoto, QR ou consentimento real | BL-02/03 |
| CIC-15 | Desativar função da Ana | REPROVADO | ACH-UI-005; ACH-MSG-016 | Política persistida sem consumo; tools precisam gate tardio; LLM real não testado | BL-01/03 |
| CIC-16 | Ciclo de todos módulos opcionais | BLOQUEADO | MATRIZ_CICLO_DE_VIDA_MODULOS.csv | 30 recursos inventariados; controlador contratual completo não encontrado | BL-01/05 |

CIC-12 é aprovação estritamente do handler simulado, não do ciclo real completo. Pausa local não foi tratada como logout físico. Nenhum resultado externo incerto foi produzido nesta auditoria; os timeouts/incertezas foram fixtures. Durante remediação, conservar resultados antes e acrescentar depois sem reescrever esta evidência.
