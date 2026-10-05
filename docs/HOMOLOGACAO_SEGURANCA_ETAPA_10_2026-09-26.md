# Homologação de segurança — etapa 10 — 26/09/2026

## Escopo comprovado

- Projeto Supabase autenticado: `Sistema de Leads` (`thgzrkppouoevapjquyu`), saudável.
- Administrador autenticado: uma organização visível, dois leads da WayFlex e zero leads de outra
  organização.
- Vendedor sem carteira atribuída: zero leads e zero notificações visíveis; `leads.read_all=false`.
- `daily_lead_report_deliveries` e `handoff_whatsapp_deliveries` recusam leitura a
  `authenticated`; somente `postgres` e `service_role` possuem privilégios.
- Handoff real executado dentro de transação e revertido. Verificação posterior: zero handoffs e
  zero auditorias de homologação persistidos. Nenhum worker ou provedor foi chamado.
- Varredura do Git: nenhum arquivo de chave/PEM e nenhuma chave privada detectada; somente
  `.env.example` está versionado.

## Advisors

- Duas tabelas internas aparecem como `RLS enabled no policy`. É defesa fechada intencional:
  `anon` e `authenticated` não possuem privilégio de tabela; não se deve criar policy pública.
- Cinco RPCs `SECURITY DEFINER` são intencionalmente acessíveis a `authenticated`. Todas fixam o
  `search_path`, exigem `auth.uid()`, organização ativa e autorização por papel/permissão/lead.
  Elas permanecem endpoints de negócio auditáveis; não são rotinas administrativas irrestritas.
- Sete índices de FK são recomendações de desempenho, não falhas de isolamento. Devem ser
  acompanhados com volume real antes de adicionar índices indiscriminadamente.
- Índices sem uso não foram removidos: estatística curta ou baixo tráfego não prova redundância.

## Pendência antes da liberação comercial

- **Leaked Password Protection** do Supabase Auth está desativada. O MCP autenticado disponível
  nesta sessão não expõe alteração da configuração Auth. A proteção deve ser habilitada no painel
  oficial e o advisor de segurança deve ser executado novamente na etapa 12.

## Limite da homologação

Esta etapa não enviou WhatsApp, não chamou IA/Apify, não ativou a Ana e não publicou Site ou Edge
Functions. O ciclo externo real continua condicionado a canal conectado, destinatário autorizado
e aceite explícito do operador.
