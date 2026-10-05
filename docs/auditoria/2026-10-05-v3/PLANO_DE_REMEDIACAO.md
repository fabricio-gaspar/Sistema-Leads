# Plano de remediação — não executado

Estado: diagnóstico concluído no acesso seguro disponível; parecer NO-GO. Este plano não autoriza implementação, criação de infraestrutura nem produção. Dependências de teste em BLOQUEIOS_E_ACESSOS.md.

| Ordem / lote | Achados / tipo | Alteração precisa no componente existente | Dependência | Aceite e regressão |
|---|---|---|---|---|
| R1 Autorização de dados | SEC001–004, P1, implementação | Remover sobreposição permissiva de proposals/documents/suppression; Storage por objeto/carteira; invariante último admin atômica no banco | Regra explícita acervo compartilhado vs privado | T-SEC002–008 passam; CRUD negativo/positivo dois vendedores/duas empresas, permissões revogadas, concorrência último admin |
| R2 Emergência e transições | MSG001–003/011, P1, implementação | Conectar conta não altera gate global; persistir intenção local antes de externo; checar erros; revisão monotônica/CAS e reconciliação de resultado antigo | Semântica pausar/desativar/desconectar aprovada | T-MSG001/002/003/012; CIC03/05/11; timeout preserva bloqueio e não retorna sucesso |
| R3 Recibos | MSG004/005/009/017, P1/P2, implementação/migration | Corrigir COALESCE na RPC; keyId do contrato; eventos por status; conciliar recibo autenticado após corte sem abrir Ana/saída | Schema/tag do gateway de sandbox | T-MSG004/005/009 + SQL sob rollback; delivered/read duplicado/invertido e callbacks tardios sem reenvio |
| R4 Acesso/convites | SEC005/006/007/008/011/012, implementação | Unificar trigger/Edge/aceite; cancelamento; administração apenas vínculo, não identidade global; cache por contexto; política de papel/MFA real e matriz canônica | Definir autoridade sobre identidade global e MFA; e-mail sandbox | T-SEC010–015; novo/existente/cancelado/expirado, token antigo, duas abas, senha compartilhada e consentimento |
| R5 Estado frontend | UI003, P1, implementação | Particionar/invalidar stores e cache por usuário+empresa+geração; rejeitar respostas tardias; remover seed operacional de cache sem contexto | R4 e dados sintéticos isolados | T-UI006–008; logout/login A→B, troca de org, offline→online, duas abas |
| R6 Entrada/retomada | MSG006–008/010/012/014, P1/P2, implementação | JID/LID seguro; mídia preservada; ledger por etapa e transação local; lease expirável; resultado incerto sem POST cego; webhook registrado idempotente | R2/R3; gateway sandbox | T-MSG006/007/008/011/013; falha em cada fronteira, dois workers e reinício; exatamente uma consequência autorizada |
| R7 Contrato WA-AKG | MSG013/015, P1, contrato externo/infra | Payload de segurança compatível com enum upstream; namespace tenant+conta; validar sessão pré-existente e fallback global | Gateway persistente HTTPS, tag/digest fixados, contas consentidas | Teste de contrato real isolated; bot inativo; dois tenants no mesmo gateway; QR/logout/restart/pairing/recovery |
| R8 Autoridade Ana/catálogo | MSG016, UI005/010, P1, implementação/regra | Política canônica nos consumidores; revalidar ferramentas imediatamente antes de efeito; revogar fonte/chunks; separar preço aprovado/conhecimento | Definir oferta de catálogo e limites humanos | Pausar/handoff durante modelo/freeBusy → zero novo efeito; prompt injection direto/indireto; não inventar preço/prazo; sem Ganho automático |
| R9 Agenda/dados | UI001/002/004/007, P1/P2, implementação | Duração válida da próxima ação; parser CSV correto; exportador neutraliza fórmula; indicador coerente com período | Fixture lead sem envio | T-UI001/002/004/005/009/011; datas/fuso/DST, repetição/parcialidade CSV, conflito e comparação analítica |
| R10 Build/reprodutibilidade | ENV001, P2, implementação/teste | Cobrir todas Edge no typecheck; alinhar layout enviar-email e runtime EdgeRuntime; reconciliar shared http e migrations remotas | Nenhuma troca de stack necessária | Typecheck normal/integral, lint, 421 testes + novos casos, build e bundle verificável |
| R11 Operação/configuração | ENV002, SEC010, configuração | Cidade obrigatória antes de ativar agenda; erro acionável; política senhas vazadas; medir latência/erros/fila em vez de só heartbeat | Escolha de cidade pelo operador; plano Auth compatível | Scheduler sandbox produz run concluído; nova configuração inválida recusada; dashboard não confunde 200 com sucesso de negócio |
| R12 UX | UI006/008/009, P2, implementação | Tooltip hoverable/dismissible; modal acessível compartilhado; disabled/motivo iguais nos CTAs | R1–R11 prioritários, regra vigente preservada | Teclado/leitor de tela/reflow/zoom, foco/retorno, toque, contraste medido e erro acessível |
| R13 Oferta SaaS | SEC009, P1 para escopo V3, regra/implementação | Definir dono plataforma, planos/entitlements, suspensão/retomada, suporte temporário auditado, retenção/exportação/desligamento | Aprovação de negócio; piloto reduzido só por decisão expressa | J01/J02/J16 em tenant novo/reduzido/suspenso/reativado/cancelado; API bloqueada mesmo com menu antigo |
| R14 Homologação/liberação | Todas, teste/infra/documentação | Restaurar backup isolado; replay seguro sem negócio; matriz CIC de cada módulo; jornada real de cada provedor liberado | R1–R13 conforme oferta; staging/credenciais por canal protegido | CHECKLIST integral; evidência antes/depois; release seletiva revisada; zero P1 no escopo liberado |

Cada lote deve atualizar requisito→teste→evidência, executar os casos originais sem mudar a expectativa e manter “antes” desta auditoria. Não agrupar todos os defeitos em uma publicação indiscriminada. Não reprocessar eventos históricos em produção para testar correções.

## Publicação futura e recuperação

1. Preparar correções no checkout autorizado, sem criar worktree/branch contra a restrição do usuário.
2. Aplicar e validar migrations em ambiente isolado; comparar APIs públicas, grants e compatibilidade do frontend publicado.
3. Repetir suíte normal, suite adversarial corrigida e testes SQL/integração reais isolados.
4. Gerar manifesto de fontes do frontend/Edge/DB, migração e pontos de corte; conferir risco de versão antiga.
5. Só com autorização de publicação selecionar os commits/artefatos aprovados e publicar pelo Sites; GitHub é armazenamento de código, não liberação operacional.
6. Conferir versão/deploy real e smoke sem negócios; teste externo somente para destinos consentidos.
7. Rollback de UI usa versão anterior identificada; banco e efeitos externos não se desfazem cegamente. Definir compensação por migration e preservar histórico/outbox.

Sem correções, não existe “resultado depois” para preencher. Propostas de modernização devem priorizar transações/CAS/leases nos componentes atuais; não adicionar broker, serviço, AWS, design system ou billing para resolver um defeito local sem benefício medido.
