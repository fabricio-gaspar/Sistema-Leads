# Homologação — recuperação da Busca e importação para Leads

## Escopo e resultado

Etapa 2 do plano original: recuperar resultados existentes, revisar e importar conscientemente
para Leads/listas. Não corresponde à etapa 3 original (Usuários e responsáveis).
Site oficial existente, Supabase `thgzrkppouoevapjquyu`, organização WayFlex.
v121 / `5e5d57c`: metadados e contagens publicados e testados com sessão autenticada do admin.
Delta final de geometria publicado v122 / `03b7c7c`, deploy concluído em 19:01:49Z.
Reteste com mouse após reload abriu Via Varejo e Galpão nos marcadores correspondentes.

## Evidências

| Validação | Resultado |
| --- | --- |
| Abrir revisão da busca de 23/09/2026 15:22:53 | Cinco resultados recuperados, sem novo Actor |
| Importar Via Varejo sem autorizar contato | Lead e lista persistiram após reload e consulta ao banco |
| Repetir após v121 com Galpão Atacado e Varejo | Categoria/fonte/SP corretos, porte nulo, lista persistida |
| Reabrir revisão | Dois duplicados desabilitados, três novos elegíveis |
| Lista antiga sem membros | Zero leads; envio ao Kanban desabilitado |
| Revisão vazia de 16/09/2026 17:31:24 | Aviso claro, mapa vazio, importação sem seleção desabilitada |
| Desktop e viewport estreito | Sem overflow horizontal de página; cards empilhados e menu móvel fechável |
| Console autenticado | Sem novos erros durante importações/reloads; dois authentication_required anteriores ao login |
| Mouse no mapa | Falha de sobreposição reproduzida v121; corrigida v122, dois marcadores abriram os respectivos leads |
| Type-check frontend e Edge; lint; build Sites | Aprovados |
| Vitest | 38 arquivos, 252 testes aprovados |

IDs para rastreio (não são credenciais):

- Run: `c962aee9-b70f-4874-bb8a-d341a56be3c5`.
- Via Varejo: `5cca3491-042f-42ff-8556-dd03bba85aad`.
- Galpão Atacado e Varejo: `6cc3a2f9-96ce-44a7-88e2-168644f33e8a`.
- Lista inicial: `da687a68-bd38-4905-94c5-0867dcf9d610`, um membro.
- Lista pós-correção: `002c2f17-4901-4efe-9398-985f664662eb`, um membro.
- Lista antiga: `548b9b39-6e50-48b7-bed2-70609c241655`, zero membros.

Os dois leads permanecem para conferência. Sem autorização de contato, sem mensagens/jobs.
No primeiro cadastro foram reparados somente categoria/porte/UF e metadados da lista de teste
contra a resposta salva. Não houve alteração de política, canal, pipeline ou dados de terceiros.

## Causas corrigidas

1. Defaults de formulário atribuíam Tecnologia/Pequeno a resultados sem essa informação.
2. Ao retomar a revisão, a fonte da lista podia virar Busca manual.
3. UF legada truncada era mostrada sem normalização; agora apenas estado/endereço explícito
   inequívoco permite normalização. Dado ausente não é inventado.
4. Contagem de lista usava total histórico e não vínculos reais.
5. Zoom do mapa multiplicava o span vertical (já em pixels) por 256 novamente. Geometria
   usa a mesma unidade nos dois eixos, centro dos limites projetados e tiles conforme largura.

Código: prospectingImportDetails + testes; ProspectingMap + prospectingMapGeometry + testes;
busca-leads/page; PreviewLead; operationalEntitiesRepository + testes; leads/page.
Nenhuma migration ou Edge Function nova neste fechamento.

## Como reproduzir sem custo nem mensagens

1. Entrar no Site oficial → Busca de Leads → Busca manual.
2. Na execução de 23/09/2026 15:22:53, clicar Abrir revisão (não iniciar nova busca).
3. Conferir cinco resultados, UF SP e dois duplicados indisponíveis para seleção.
4. Abrir detalhes pelo marcador e conferir o mesmo nome/cidade da lista.
5. Ir a Leads → listas; localizar as duas listas Homologação de 25/09/2026, cada uma com um
   membro. Recarregar e conferir novamente. Não enviar ao Kanban nem autorizar contato.
6. Reabrir a execução vazia de 16/09/2026 17:31:24 para conferir estado sem resultados.

Para testar nova importação, é necessária seleção consciente de outro resultado; não repetir
os dois já importados. A evidência desta rodada dispensa criar mais leads para conferência.

## Limites e próxima etapa

- Não foi executada nova busca paga, envio/recebimento WhatsApp ou chamada da Ana.
- Não foi feita auditoria de todos os módulos, dispositivos físicos ou contas de vendedor.
- Importação em lote ainda não é transação única; erro parcial exige conferir Leads antes de
  repetir. Regressão local cobre erro de lista/reconciliação, não falha real forçada em produção.
- Raio/porte/cargo não são filtros comprovados do Actor atual; não oferecidos como funcionais.
- Responsáveis de exemplo (`mockUsers`) ainda existem na importação; não escolher vendedor
  fictício. Substituir por membros reais e validar organização/carteira na etapa 3 original.
- Z-API e Meta permanecem desativadas neste checkpoint; não ativar para testar importação.
- Próxima ação, somente após aprovação: Usuários e responsáveis, GPT-6 Sol High.
