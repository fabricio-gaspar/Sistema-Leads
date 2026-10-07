# Mapa de navegação e recursos

Versão examinada: `847048429a86294aa10fa54ffdd750c04447d4fb`. Mapa obtido de `src/router/config.tsx`, `DashboardLayout.tsx`, `configuracoes/page.tsx` e `EmpresaTabs.tsx`. Inventário completo por recurso/API/perfil/ciclo está em [MODULOS_E_UX.md](MODULOS_E_UX.md). Esta é uma análise de arquitetura da informação; nenhuma rota ou menu foi alterado.

## Navegação atual

```text
Acesso
  /login · /register · /reset-password
  / → /login; /apresentacao → página pública
Dashboard autenticado
  Visão geral: Dashboard
  Prospecção: Busca de Leads · Leads (manual, CSV, listas, distribuição)
  Atendimento: Kanban · Central de Atendimento (inclui número próprio) · Agenda
  Comercial: Orçamentos · Funil · Relatórios
  Administração: Configurações
    Operação: Status operacional
    Canais e integrações: Canais · APIs
    Empresa e inteligência: Empresa e conhecimento · Configurar a Ana
    Gestão comercial: Produtos e orçamentos
    Acesso e governança: Usuários · Registro do Sistema · Proteção de contatos
Empresa e conhecimento
  Visão geral · Perfil · Catálogo · Fontes · Ana · Histórico
  Catálogo: Produtos/acessórios · Serviços · Catálogos · Documentos e mídia
Rotas de acesso direto adicionais
  /dashboard/equipe (team.manage)
  /dashboard/registro-sistema (audit.view)
```

O menu exige permissões além da sessão. Configurações exige `configuration.manage`; Equipe e Registro têm rotas independentes. Um usuário com `team.manage`/`audit.view` sem `configuration.manage` precisa de caminho visível correspondente; a disponibilidade do endpoint não prova encontrabilidade. Esse caso por perfil permanece sem navegação real nesta trilha.

## Compatibilidade de endereços

| Endereço antigo | Destino atual | Avaliação |
|---|---|---|
| `/dashboard/empresa` | Configurações `tab=empresa` | Mesma área administrativa |
| `/dashboard/midia-drive` | Empresa `subtab=fontes` | A antiga página de arquivos não é a tela atual; rótulo/destino devem ser revistos para usuário que busca documentos |
| `/dashboard/personalizacao-ana` | Configurações `tab=ana` | Configuração consolidada |
| `/dashboard/meu-whatsapp` | Central | Número próprio fica no contexto de atendimento |
| `tab=fontes` ou `integracoes` | APIs | Fontes de captação permanecem diferentes de fontes de conhecimento |
| `tab=equipe` | Usuários | Mantém URL antiga |
| `tab=templates-proposta`/`templates-documento` | Produtos e orçamentos | Verificar gestão completa; preview não equivale a editor |
| `tab=horarios`/`automacoes`/`pipeline` | Ana | Não contar componentes antigos sem consumidor como UI ativa |

## Mapa proposto por acesso

| Acesso/tarefa | Destino principal proposto | Base da decisão e trade-off |
|---|---|---|
| Dono da plataforma | Área global de empresas, planos/módulos, provedores permitidos, saúde, suporte auditado | Exigência V3, não implementada nas rotas examinadas. Requer autorização/escopo próprio; não promover administrador cliente |
| Administrador cliente | Operação normal + Configurações da própria organização | Mantém estrutura atual e backend. Consolidar política duplicada antes de simplificar visualmente os controles |
| Vendedor/SDR/CX | Carteira → Kanban → Central → Agenda/Orçamentos, conforme permissões | Preservar atalho contextual por lead; não duplicar o mesmo CRUD em outro painel |
| Usuário conectando seu número | Central → conexão própria | Conexão técnica não deve conceder política global/cota/kill switch |
| Usuário consultando produto | Catálogo contextual da Central/Orçamento; gestão no administrador | Separar claramente conteúdo aprovado de tabela de preço; ACH-UI-010 mostra fontes diferentes |
| Gestor analisando conversão | Funil/Relatórios | Quadro Kanban serve execução; Funil análise. Não há necessidade demonstrada de fundir regras |
| Equipe e auditoria com permissão própria | Links próprios no grupo Administração quando autorizados | Custo baixo: reutiliza rotas; evita depender de permissão de configuração só para localizar uma tarefa |

Propostas baseadas em S2–S5, listadas em [FONTES_UI.md](FONTES_UI.md); não são posições universais exigidas por norma.

## Casos de encontrabilidade a homologar

| Tarefa | Caminho-alvo | Aceite |
|---|---|---|
| Encontrar QR próprio | Central → conexão própria | Vendedor autorizado chega sem administração de chaves; registra passos/tempo real |
| Pausar Ana | Dashboard → controle Ana ou Configurações → Ana | Mesmo estado backend nos dois caminhos; erro explicável; nenhuma falsa pausa |
| Entender canal bloqueado | Configurações → Canais → diagnóstico | Motivo e dependência identificados; estados conexão/autorização separados |
| Gerir vendedor | Configurações → Usuários ou rota Equipe com T | Mesmo vínculo/escopo; sem elevação ou caminho invisível por C ausente |
| Preparar orçamento de lead | Central/contexto → Orçamentos com leadId | Preserva identidade e rascunho; criação e envio humanos explícitos |
| Retomar busca | Busca → histórico/runId | Recupera execução existente sem criar busca cobrada duplicada |

Não se mediu tempo de tarefa nem se fez pesquisa com participantes. Capturas renderizadas e resultados de viewport desta auditoria são de responsabilidade do agente principal em `EVIDENCIAS/ui`; não há mockups apresentados como captura.
