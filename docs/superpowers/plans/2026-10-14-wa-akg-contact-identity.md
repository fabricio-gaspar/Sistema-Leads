# Plano — identidade de contatos WA-AKG na Central

## Objetivo

Eliminar o placeholder de contato na origem do fluxo: evento WA-AKG, resolução
canônica de identidade, persistência de mensagem/conversa, política de contato,
decisão humana e apresentação na Central.

## Decisão de compatibilidade

`lead_messages` e a Central atual exigem `lead_id`. Enquanto o modelo de
conversa não for separado em uma entidade de contato própria, contatos de agenda
protegidos terão um registro técnico marcado `wa_akg_contact_only`. Esse registro:

- preserva a mesma conversa e o histórico;
- fica fora de Leads, Kanban, campanhas, cadências e da Ana;
- só vira lead comercial por decisão explícita e auditada.

## Sequência

1. Criar migration aditiva com política canônica por organização, canal e telefone;
   não usar JID bruto como identidade comercial.
2. Atualizar o resolvedor inbound para preferir lead existente, depois agenda
   sincronizada, e por fim contato externo factual; tratar 8º/9º dígito somente
   quando houver candidato único e nunca inferir telefone de `@lid`.
3. Persistir/reutilizar a conversa antes do fence da Ana e bloquear a automação
   novamente no fence e na fila para políticas protegidas ou não classificadas.
4. Criar RPCs autorizadas para prompt pendente, dismiss persistido e decisão com
   revisão/idempotência, responsável e modo humano como padrão.
5. Trocar a Central para usar as RPCs como autoridade, com modal acessível e
   atualização em foco/realtime sem `localStorage`.
6. Aplicar o fallback factual de telefone em todas as variações de placeholder e
   filtrar registros técnicos da área comercial.
7. Cobrir contratos unitários/estáticos, typecheck, build e testes de Edge. Marcar
   explicitamente o que requer banco homologado, RLS real e E2E autenticado.

## Critérios de aceite

- Agenda conhecida mantém nome e abre decisão persistente.
- “Manter” bloqueia Ana/fluxos comerciais; “Converter” exige responsável e modo.
- Lead existente reutiliza conversa/histórico; webhook duplicado não cria outro.
- Externo mostra telefone factual e “Novo contato”, sem nome inventado.
- Isolamento ocorre no banco por organização/canal/usuário; a interface não é a
  autoridade de segurança.
- Nenhuma mensagem real, QR, reconexão ou alteração remota será feita nesta etapa.
