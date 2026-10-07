# Especificação UI compacta — proposta não implementada

Alvo: manter marca pt-BR, React/Tailwind e os componentes atuais. Fonte examinada `847048429a86294aa10fa54ffdd750c04447d4fb`. As propostas abaixo derivam do protocolo V3 e dos achados da auditoria; não são afirmações de conformidade ou alterações publicadas.

| Elemento | Padrão recomendado | Verificação de aceite |
|---|---|---|
| Identidade | Grafite `#14151a`, canvas `#f2f4f8`, superfície branca, lima `#d9f66d`, sucesso `#168654`, atenção `#8c651d`, erro `#bd3d32` existentes | Medir contraste dos pares efetivamente renderizados, inclusive hover/disabled; não aprovar só pelo hex |
| Espaço interno | Tokens equivalentes a 4–8px entre itens correlatos | Texto pt-BR extenso/erro não sobrepõe campos |
| Agrupamento | 12–16px entre cards relacionados, 16px de padding, 16–24px entre seções como ponto de partida | Ajustar em 320/390/1024/1440px e zoom; valores são decisão local, não obrigação WCAG/Carbon |
| Card de resumo | Título curto, estado/medida com período, contexto essencial e ação principal | Estado/contagem corresponde a fonte e período; pendência importante não fica só em tooltip |
| Carteira/tabela | Busca/filtro/ordenar/seleção/exportação junto à tabela; detalhe por drawer | Mesma seleção/filtros preservados e total honesto; rolagem bidimensional restrita ao conteúdo que exige |
| Comando operacional | Estado idle/pending/success/error com confirmação do backend | Clique duplo, falha de rede e resposta tardia não mostram falso sucesso; motivo visível quando bloqueado |
| Desativação | Mostrar efeito e dependentes; “desativando”/“pendência remota” quando aplicável | O texto representa o ponto de corte confirmado e não apaga história |
| Diálogo | Reutilizar `AccessibleDialog` ou contrato equivalente validado | Nome, entrada/contenção/restauração de foco, Escape e recusa de ação durante envio; corrigir modal CSV |
| Tooltip | Trigger foco/ponteiro/toque; conteúdo hoverable e persistente; dispensa por Escape | Trigger → tooltip não fecha; texto extenso pode ser percebido; ACH-UI-006 |
| Kanban | Alternativa a arrastar; alvo claro de abrir cartão separado das ações | Enter/Espaço em select/menu não abrem drawer acidentalmente; seguir foco após transição |
| Gráficos | Período/escopo visíveis, zero/indisponível distintos e tabela equivalente | “Mensagens hoje” só dia atual ou rótulo corrigido para período; ACH-UI-007 |
| Ícones/alvos | Nome acessível; alvo AA 24×24 CSS px ou exceção válida; área maior quando útil | Medição renderizada e teste teclado/toque; 44px não é declarado mínimo universal AA |
| Navegação | Hierarquia por tarefa e perfil, rótulos consistentes, estados estáveis | Rota autorizada encontrável; não esconder gestão permitida atrás de C se só T/A for exigida |

WCAG 2.2 AA é o alvo escolhido pelo protocolo. Verificar especialmente 1.3.1, 1.4.3, 1.4.4, 1.4.10, 1.4.11, 1.4.13, 2.1.1, 2.4.3, 2.4.7, 2.4.11, 2.5.7, 2.5.8, 3.3.1/2 e 4.1.2/3, conforme aplicabilidade. Enumerar critérios não prova aprovação. As páginas explicativas WAI são orientação; a recomendação normativa é S6 em [FONTES_UI.md](FONTES_UI.md).

Conteúdo para teste isolado: empresa de 100 caracteres, telefone ausente, orçamento com valor alto, moeda/percentual pt-BR, alerta de rede, zero registros, mais de 200 compromissos e 120 itens de catálogo. Testar reflow equivalente a 320 CSS px, 200% texto e 400% zoom conforme cenário, foco não encoberto e estado anunciado. Tabelas/calendários podem precisar de duas dimensões; isso não autoriza overflow da página inteira.

Não existem capturas “depois” de implementação porque nenhuma implementação visual foi autorizada/executada. A evidência visual corrente coletada pelo agente principal deve ser usada como “antes” para remediação futura. A próxima rodada precisa repetir os mesmos caminhos e viewports, sem ativar provedores ou usar dados reais para testar aparência.
