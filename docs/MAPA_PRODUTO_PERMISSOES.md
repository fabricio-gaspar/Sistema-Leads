# Mapa de produto, perfis e permissões — WayFlex CRM

Data: 09/10/2026. Escopo: análise dirigida do código em `main`, base
`f46d61f02fd82bfbf91ef8895d65ccb23cef9f03`. Não é homologação de produção.
O link da Central redirecionou para login; nenhuma conversa autenticada foi inspecionada.

## 1. Fontes de verdade

- Papéis e rótulos: `src/lib/crm/teamMembersRepository.ts`.
- Capacidades e padrões por papel: `supabase/functions/_shared/permissionDefinitions.ts`.
- Navegação: `src/components/feature/DashboardLayout.tsx`.
- Organização de configurações: `src/pages/dashboard/configuracoes/page.tsx`.
- Central: `src/pages/dashboard/atendimento/page.tsx`.
- Autoatendimento e administração WA-AKG: `src/components/feature/WaAkgPanel.tsx`.

Este mapa orienta o produto; não é uma implementação alternativa de autorização.
Mudanças devem consultar também a rota, o repository, a Edge/RPC e as políticas
relevantes. Não houve teste de RLS, sessão, API ou isolamento entre empresas neste lote.

## 2. Perfis realmente encontrados

Os papéis versionados são `administrador`, `vendedor`, `sdr` e `cx`.
`cx` é apresentado como Atendimento. Não renomear papéis persistidos para adequá-los
à apresentação. A empresa que contrata o CRM não é o lead atendido por ela.

| Papel | Padrão observado no código | Organização de produto |
| --- | --- | --- |
| administrador | Todas as capacidades de organização catalogadas | Gestão da própria empresa, equipe, integrações e operação; não confundir com acesso global à plataforma |
| vendedor | Carteira atribuída, criação/edição de seus leads, resposta atribuída, orçamentos, próprio WhatsApp | Trabalho diário e autoatendimento do próprio canal |
| sdr | Leitura ampla de leads/conversas, edição de leads, resposta, prospecção e orçamentos | Prospecção e qualificação dentro do escopo autorizado |
| cx | Leitura de leads/conversas, edição atribuída e resposta | Atendimento no escopo autorizado |

São padrões de código, não uma leitura das permissões atuais dos usuários no banco.
Não reduzir nem ampliar capacidades durante um ajuste de layout. Uma administração
multiempresa separada não foi comprovada pelos arquivos inspecionados; não criar
`superadmin`, portal de cliente final ou acesso cruzado com base nesta proposta.

## 3. Recurso → superfície → capacidade

| Recurso | Superfície existente ou recomendada | Capacidade a preservar |
| --- | --- | --- |
| Buscar novas empresas | Busca de Leads | `prospecting.manage` |
| Consultar e trabalhar leads | Leads / Kanban | `leads.read_all` ou `leads.read_assigned`; escrita exige a capacidade específica |
| Responder e transferir atendimento | Central, na conversa | Capacidades de conversa e regras server-side de carteira, transferência e canal |
| Ver o próprio canal | Central → Meu WhatsApp | `channels.view_own` |
| Parear o próprio aparelho | Central → Meu WhatsApp | `channels.connect_own` e autorização efetiva retornada pelo backend |
| Gerir canais de terceiros | Configurações → Canais/Usuários conforme fluxo existente | `channels.manage_all` e gates administrativos aplicáveis |
| Cadastrar credenciais e políticas | Configurações → Canais, APIs e Ana | `configuration.manage` e regras específicas; segredos permanecem no backend |
| Gerir equipe | Configurações → Usuários | `team.manage`, respeitando também os gates de acesso ao módulo |
| Consultar auditoria | Configurações → Registro do Sistema | `audit.view`, respeitando também os gates do módulo |
| Consultar conhecimento aprovado durante uma conversa | Contexto da Central | Leitura autorizada existente; não conceder edição de catálogo |
| Editar conhecimento, catálogo e personalidade | Configurações → Empresa e conhecimento / Ana | Capacidades administrativas aplicáveis |
| Preparar orçamento | Orçamentos ou atalho contextual do lead | `proposals.manage`; preparação não equivale a aprovação ou envio |
| Próxima ação e reunião | Contexto do lead / Agenda | Handlers, escopo e confirmação existentes; atalho não cria evento sozinho |

O menu de Configurações atualmente usa `configuration.manage`. Antes de propor
acesso delegado apenas por `team.manage` ou `audit.view`, verificar e compatibilizar
menu, rota, aba e backend. Não liberar todo o módulo para resolver um bloqueio pontual.

## 4. Critério para escolher uma tela

Para cada mudança registrar: tarefa; usuário; empresa/carteira; capacidade de leitura;
capacidade de escrita; rota; superfície; fonte dos dados; estados; teste de aceite.
Manter operação diária distinta de gestão da empresa e de eventual operação global.
Uma função técnica não vira automaticamente recurso exclusivo do administrador:
parear o próprio WhatsApp é um contraexemplo já previsto neste CRM.

Usar o mesmo componente quando o fluxo é o mesmo. Não duplicar a Central para cada
papel nem usar apenas CSS para impedir acesso. Ocultar um botão não é autorização.

## 5. Critérios de aceite antes de publicação

- Cada perfil recebe menus e ações coerentes com suas capacidades efetivas.
- Acesso direto à rota/API permanece negado quando indevido; testar também troca de empresa.
- `leadId` e filtros de URL são preservados. Abrir um link de lead não implica acesso a ele.
- Próprio canal não revela QR, sessão, segredo ou histórico de terceiros.
- Falhas de rede, ausência de canal e ausência de dados não se tornam estados de sucesso.
- Nenhum ajuste visual ativa Ana, envio, produção ou callbacks.
- Sem nova aplicação, stack, Site, Supabase, gateway ou módulo de vendas/pagamentos.
