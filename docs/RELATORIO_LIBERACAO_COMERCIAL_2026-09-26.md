# Relatório de liberação comercial — WayFlex CRM

Data: 26/09/2026  
Projeto Supabase: `thgzrkppouoevapjquyu`  
Site oficial: `https://leadai-crm-preview.fabricio926564.chatgpt.site`

## Parecer executivo

**Liberado para uso comercial supervisionado e piloto do CRM.**  
**Não liberado para operação 100% automática da Ana.**

O código, o banco, o isolamento de acesso, a interface e o artefato de produção passaram pelas
verificações disponíveis. A liberação automática seria insegura sem um canal real ativo e sem o
ciclo externo completo comprovado.

## Resultado dos testes

| Área | Resultado | Evidência |
| --- | --- | --- |
| TypeScript frontend | Aprovado | `npm run type-check` |
| TypeScript Edge Functions | Aprovado | `npm run type-check:edge` |
| Lint | Aprovado | zero warnings |
| Testes automatizados | Aprovado | 42 arquivos, 262 testes |
| Build e artefato Sites | Aprovado | build Vite e artefato concluídos |
| Site oficial | Aprovado | versão 125 preservada e acessível |
| RLS e isolamento | Aprovado | organização, carteira e tabelas internas validadas |
| Motor da Ana | Publicado, não homologado externamente | `ana-run` v36 |
| Worker | Publicado, não homologado externamente | `automation-worker` v33 |
| Proteção de endpoints | Aprovado | chamadas sem credencial recusadas: 401/400 |
| WhatsApp real | Bloqueado | Z-API pausada/desativada; zero conta Meta |
| Automação diária | Bloqueada | zero agenda ativa; fila pendente zerada |
| Auth contra senhas vazadas | Pendente | Leaked Password Protection desativada |

## Gate obrigatório para ativar o Automático

1. Habilitar Leaked Password Protection no painel Auth do Supabase e repetir o advisor.
2. Escolher e ativar um único canal homologado: Z-API ou Meta.
3. Fazer E2E controlado com número autorizado: saída, entrada, recibo, resposta da Ana e handoff.
4. Ativar uma única agenda em modo Supervisionado, observar limites, duplicidade e opt-out.
5. Somente após evidência estável, aprovar formalmente a mudança para Automático.

Nenhuma mensagem foi enviada, nenhum provedor foi executado e o modo Automático não foi ativado
durante esta homologação.
