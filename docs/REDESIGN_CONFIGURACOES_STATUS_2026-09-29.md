# Redesign de Configurações — Status operacional

## Escopo

A rota existente `Configuracoes?tab=operacao` foi reorganizada para funcionar como um
command center operacional, usando exclusivamente a resposta de
`operational-diagnostics`. Não foram criados endpoints, migrations, estados de demonstração ou
uma segunda autoridade de automação.

## Aplicado

- Cabeçalho curto com `Administração`, `Configurações`, `Registro de auditoria` e `Atualizar status`.
- Visão operacional com Ambiente real, proteção por validações e pausa global.
- Alerta de componentes pendentes com navegação para o diagnóstico.
- Tabela responsiva agrupada em Automação, Atendimento e Inteligência/prospecção.
- Saúde separada do status de uso: Validado, Validação pendente, Validação vencida, Falha,
  Não configurado; uso como Ativo, Desativado ou Bloqueado.
- Filtros Todos/Ativos/Com atenção/Desativados e busca local por componente.
- Pré-requisitos reais da Ana (WhatsApp, IA e worker), com bloqueio visual até que o servidor
  confirme todas as dependências.
- Menus de ação limitados às operações já suportadas: preparar worker, cadastrar callbacks da
  Z-API e abrir a configuração correspondente. Os segredos continuam apenas no Vault/backend.
- Auditoria resumida com link para o Registro do Sistema.
- Removido o painel de limpeza/exclusão de leads desta tela; ele permanece fora do command center,
  em área administrativa própria.

## Regras preservadas

- `ana-run` continua sendo a única autoridade automática da Ana.
- O kill switch continua sendo gravado e confirmado pela Edge Function existente.
- A ativação do Ambiente Real continua sujeita ao preflight server-side.
- Nenhuma integração é considerada online por texto local: saúde, última validação, erro e pausa
  vêm do diagnóstico do projeto/organização autenticados.
- Componentes sem integração persistida são exibidos como `Não configurado`, nunca como ativos.

## Validação

Type-check, lint, suíte Vitest completa (57 arquivos/329 testes), build Vite e `git diff --check`
passaram. A publicação e a inspeção visual autenticada devem ser registradas após o deploy final.
