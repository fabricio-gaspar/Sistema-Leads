# AGENT OS — WayFlex CRM

Memória técnica do projeto. Código, migrations, testes e registros canônicos sustentam os fatos; este roteiro não exige carregar nem atualizar todo o acervo em cada pedido.

## Entrada proporcional
1. Leia este roteiro ao entrar no projeto; reutilize-o enquanto não mudar. Localize o checkpoint atual e os requisitos do pedido por título/ID/módulo.
2. Consulte apenas os campos de estado e commit pertinentes em audit-state.json e o delta de Git/working tree que afeta o trabalho. Preserve alterações concorrentes.
3. Leia somente os trechos necessários das fontes abaixo; amplie por dependência ou evidência nova. Não carregue documentos completos de histórico por rotina.
4. Defina aceite, impacto e risco. Ajuste simples: resumo curto, execução e verificação. Decisão aberta ou mudança ampla: plano proporcional. Autorização existente cobre etapas normais; não a peça novamente.

| Fonte | Quando consultar |
| --- | --- |
| docs/CONTINUIDADE_WAYFLEX.md | Checkpoint atual ou retomada; localizar o trecho pertinente |
| system-baseline.md e modules/ | Comportamento e estado do módulo afetado |
| requirements-registry.json e known-issues.md | IDs/requisitos/problemas relacionados ao pedido |
| architecture-map.md | Dependência, contrato ou arquitetura que realmente afete a mudança |
| test-baseline.json | Evidência e seleção de testes pertinentes |
| execution-history.md | Recuperar uma decisão/resultado que o checkpoint não esclareça |

Auditoria completa exige escopo explícito ou evidência de baseline inválido, mudança estrutural, divergência de release ou risco crítico. Comece delimitando o impacto; um baseline ausente no módulo não obriga varrer todo o sistema.
Unidade de análise: arquivo alterado + dependências diretas + consumidores + módulo.

## Execução
- Reutilize, corrija e estenda antes de refatorar/criar. Preserve funções e complete o fluxo autorizado de ponta a ponta, na ordem técnica necessária.
- Cada tentativa testa hipótese baseada em evidência; falha comum pede correção e teste relacionado. Em bloqueio externo, conclua o restante e registre evidência, dependência e próxima ação.
- Modelo/provedor/esforço são escolha do usuário. Não imponha troca ou roteamento por nomes fixos de modelos. Delegue apenas tarefa independente com contexto mínimo; não simule troca nem revisão independente.
- Não use mocks, métricas fictícias ou estado local como verdade operacional. Preferências pessoais e filtros podem ser locais.

## Invariantes do produto
- Preserve o Site, a stack e o projeto existentes. Supabase é a fonte operacional; RLS/RBAC preservam organização e carteira.
- ana-run é a única autoridade automática da Ana. Assistências humanas não alteram CRM nem enviam fora do backend.
- Preserve Lead → Atendimento → Ana/Humano → Kanban → Tarefa/Reunião → Orçamento e o histórico cronológico de entradas e saídas.
- Eventos, filas e ações externas exigem idempotência, retry controlado, reconciliação e auditoria. Nunca reenvie resultado ambíguo às cegas.
- Produção, mensagens reais e reprocessamento de callbacks antigos continuam bloqueados em testes não homologados; respeite autorização específica.
- Ana não confirma preço, desconto, prazo, estoque, frete, certificação ou compatibilidade sem fonte aprovada e revisão humana; não marca Ganho sozinha.
- Opt-out interrompe automação; handoff preserva histórico. Segredos ficam no backend, fora de navegador, documentos, logs e Git.

## Evidência e fechamento
- Diferencie CONFIRMADO, PARCIAL, INFERIDO, NÃO VERIFICADO e AUSENTE. Quando uma matriz for necessária, use CONCLUÍDO, PARCIAL, BLOQUEADO ou NÃO APLICÁVEL.
- Não invente arquivos, APIs, dados, testes, commits ou deploys. Código/build não prova homologação; configuração não prova integração; sent não prova entrega/leitura.
- Execute testes proporcionais de fluxo, falhas, permissões e consumidores, incluindo banco, integração, filas e UI quando afetados; preserve checks obrigatórios.
- Compare aceite, diff e evidência. Verifique lacunas e regressões no escopo; não reabra auditorias genéricas para encerrar.
- Após mudança relevante, atualize somente o registro canônico afetado: requisito, problema, teste, arquitetura ou módulo. Preserve IDs, requisitos anteriores e resultados reais.
- Deixe um checkpoint breve com versão/working tree, verificação, LOCAL/APLICADO/PUBLICADO, pendência e próxima ação. Não replique o mesmo relato em continuidade, histórico e todos os baselines; os demais registros podem referenciá-lo.
- Pergunta, status ou leitura sem mudança não exige reescrever baselines. Não encerre sessões nem prometa processo em segundo plano.
