# AGENT OS — WayFlex CRM
Código, migrations, testes e registros canônicos sustentam os fatos. Consulte as fontes por necessidade; uma lacuna local não obriga auditoria do sistema inteiro.

## Fontes
| Necessidade | Fonte em .agent/, salvo caminho indicado |
| --- | --- |
| Retomada/checkpoint | docs/CONTINUIDADE_WAYFLEX.md; modules/ |
| Comportamento do módulo | system-baseline.md; modules/ |
| Requisito ou problema | requirements-registry.json; known-issues.md |
| Dependência/contrato | architecture-map.md |
| Teste/evidência | test-baseline.json; campos pertinentes de audit-state.json |
| Decisão não esclarecida | execution-history.md |

## Invariantes
- Preserve Site, stack e projeto existentes. Supabase é a fonte operacional; RLS/RBAC preservam organização e carteira. Não use mocks, métricas fictícias ou estado local como verdade operacional; preferências e filtros podem ser locais.
- ana-run é a única autoridade automática da Ana, com Claude configurado por empresa. Assistências humanas não alteram CRM nem enviam fora do backend.
- Preserve Lead → Atendimento → Ana/Humano → Kanban → Tarefa/Reunião → Orçamento e o histórico cronológico.
- Eventos, filas e ações externas exigem idempotência, retry controlado, reconciliação e auditoria. Não reenvie resultado ambíguo às cegas.
- Não ative produção, envie mensagens reais ou reprocesse callbacks antigos em testes não homologados; respeite autorização específica.
- Orçamentos somente. Ana não confirma preço, desconto, prazo, estoque, frete, certificação ou compatibilidade sem fonte aprovada e revisão humana; não marca Ganho sozinha.
- Opt-out interrompe automação; handoff preserva histórico. Segredos ficam no backend, fora de navegador, documentos, logs e Git.
- Administrador empresarial não é administrador global. Use a definição canônica de permissões. Conectar o próprio WhatsApp é autoatendimento; canais de terceiros, credenciais e políticas exigem administração. Reorganização visual não amplia permissões.

## Evidência e continuidade
- Diferencie fato confirmado, hipótese e pendência. Não invente arquivos, APIs, dados, testes, commits ou deploys.
- Configuração não prova integração; sent não prova entrega/leitura; código/build não prova homologação.
- Valide fluxo, falhas, permissões e consumidores afetados, incluindo banco, filas e UI quando pertinentes. Respeite checks obrigatórios.
- Atualize somente os registros canônicos afetados, preservando IDs, requisitos e resultados anteriores. Um checkpoint breve basta; outros registros podem referenciá-lo.
- Complete trabalho independente em bloqueio externo; registre evidência, dependência e próxima ação. Preserve alterações concorrentes e sessões.
