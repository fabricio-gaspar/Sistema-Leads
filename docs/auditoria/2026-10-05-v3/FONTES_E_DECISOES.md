# Fontes e decisões — consulta de 05/10/2026

Fontes orientam critérios; não certificam o produto. Nenhuma página externa autorizou ação, mudança de stack, envio ou publicação. Referências normativas/técnicas, recomendações e escolhas locais são distinguidas abaixo. S1–S9 e seus resultados de consulta detalhados em [FONTES_UI.md](FONTES_UI.md).

| Fonte primária | Versão/natureza | Decisão adaptada e teste |
|---|---|---|
| [S1 Carbon spacing](https://www.carbondesignsystem.com/building-blocks/foundations/spacing/overview) | Guia de design, sem versão numérica fixada | Escala local de espaçamento; não importar a marca/stack; medir densidade |
| [S2 Carbon shell](https://www.carbondesignsystem.com/building-blocks/core/components/ui-shell-header/guidelines) | Guia de navegação | Separar utilidades globais da tarefa; teste de encontrabilidade por papel |
| [S3 Carbon tables](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines) | Guia de componente | Tabela/toolbar para volume; cards para resumo, sem redesenho implementado |
| [S4 NN/g divulgação progressiva](https://www.nngroup.com/articles/progressive-disclosure/) | Orientação de usabilidade, não norma | Wizard essencial primeiro; critérios avançados quando necessários |
| [S5 NN/g IA/navegação](https://www.nngroup.com/articles/ia-vs-navigation/) | Orientação de arquitetura informação | Organizar tarefa/autoridade antes de fundir menus |
| [S6 W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Norma técnica escolhida como alvo AA | Não declarar conformidade; roteiro teclado/foco/reflow/erros/contraste |
| [S7 WAI tamanho alvo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | Explicação 2.5.8 | 24 CSS px e exceções devem ser avaliados; 44 não é mínimo universal AA |
| [S8 WAI hover/foco](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) | Explicação 1.4.13 | Ajuda deve poder ser dispensada e alcançada; ACH-UI-006 |
| [S9 WAI reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow) | Explicação WCAG21 confrontada ao alvo2.2 | Wizard medido em320 CSS px; não extrapolar para todas telas |
| [S10 OWASP ASVS](https://owasp.org/projects/asvs) | Página indica versão estável5.0.0; padrão de verificação | Autorização/sessão/validação por recurso; não foi auditoria integral ASVS nem certificação |
| [S11 AWS outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | Padrão arquitetural | Persistência+intenção durável e consumidor idempotente; MSG008/012; sem migrar para AWS |
| [S12 AWS saga](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html) | Padrão de coordenação/compensação | Revisão por escopo, etapas observáveis e recuperação; preferir transação local quando suficiente |
| [S13 Google SRE](https://sre.google/sre-book/monitoring-distributed-systems/) | Prática operacional | Latência/tráfego/erros/saturação; heartbeat200 não prova sucesso de negócio; ENV002 |
| [S14 OWASP LLM injection](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) | Orientação de defesa em camadas | Conteúdo é dado; validar ferramentas/autoridade antes de efeito; MSG016 e teste de fonte maliciosa isolada |
| [S15 Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) | Documentação oficial | Grants+políticas, testes sob papel real; presença de RLS não basta; SEC001–004 |
| [S16 OWASP autorização](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Orientação de menor privilégio | Revalidar cada ação/recurso; API direta e identidade global, SEC006/008 |

Outras fontes: [RFC4180](https://www.rfc-editor.org/info/rfc4180/) (CSV informativo), [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection), [Supabase sessões](https://supabase.com/docs/guides/auth/sessions), [segurança de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [changelog Postgres 15.19/17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). Patch review/backup é necessário antes de upgrade; nenhuma CVE específica do projeto foi afirmada nem atualização executada.

Contratos/versionamento WA-AKG, Evolution GO e limitações de Meta em [EV-MSG-003](EVIDENCIAS/mensageria/EV-MSG-003-FONTES.md). Versão upstream não prova instalação do servidor do usuário.

## Decisões locais e alternativas

- Preservar React/Vite/Supabase/ana-run. Transação/CAS/lease nos componentes existentes resolve primeiro os defeitos comprovados; novo broker/control plane ampliaria custo sem medição de necessidade.
- Não unificar Kanban e Funil apenas pela aparência: execução comercial e análise são tarefas diferentes.
- Não confundir catálogo de conhecimento com preço aprovado. Definir contrato antes de migrar dados ou fazer promessa comercial.
- Tokens de espaçamento/cores são escolhas do projeto; comparar legibilidade e número de ações visíveis, não alegar que uma referência exige uma paleta.
- Entitlements/suspensão/dono global dependem de oferta SaaS aprovada. Painel empresarial existente não foi renomeado como painel de plataforma.
- Proposta de teste futuro: tempo para achar QR próprio/próxima ação, número de erros de interpretação de estado, taxa de tarefas completas e contraste/reflow por perfil. Nenhuma medição com usuários foi inventada.
