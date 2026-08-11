# Relatório de implementação omnicanal

Data da revisão: 10/08/2026

## Resultado entregue

O sistema passou a ter uma base comercial omnicanal, preservando o fluxo existente de prospecção, aprovação administrativa, primeiro contato da Ana e encaminhamento para vendedor.

### Seleção antes do contato

- Todo lead prospectado recebe um estado formal e um histórico imutável de aprovação.
- O administrador escolhe entre aprovação automática, por score ou manual. O padrão é automático ao enviar para Leads.
- Campanhas agendadas primeiro aplicam o score mínimo da campanha e depois obedecem ao modo global de aprovação.
- Somente administrador pode aprovar prospectos em lote.
- Ao aprovar para a Ana, o sistema cria o ticket, matricula na cadência configurada e executa o WhatsApp imediatamente.
- Duplicidade passa a ser bloqueada por identidade canônica da empresa dentro da organização e entre fontes diferentes, priorizando CNPJ, domínio, e-mail/telefone e empresa+cidade.
- Falha de integração e falha ao iniciar a cadência ficam gravadas no lead e aparecem no retorno da operação.
- Ordem padrão da cadência permanece configurável: WhatsApp, e-mail e telefone.

### Ana com múltiplos modelos

- Provedor principal selecionável entre OpenAI, Anthropic Claude e Google Gemini.
- Provedor de contingência opcional.
- A classificação de prospecção aceita uma ou mais IAs ao mesmo tempo, por consenso, ou em ordem de contingência.
- O score final combina sinais determinísticos verificados (60%) e parecer das IAs disponíveis (40%).
- A conversa, classificação, qualificação e decisão de encaminhamento usam o adaptador comum.
- O painel de integrações mostra a disponibilidade das chaves de cada provedor.
- Webhooks Z-API e Meta capturam imagem e áudio, guardam o arquivo em storage privado e vinculam o anexo à mensagem.
- Imagens entram na conversa após análise multimodal; áudios entram após transcrição pela OpenAI. Falha segura gera handoff.

### Base de conhecimento/RAG

- Upload e indexação de PDF, DOCX, XLSX, TXT, Markdown, CSV e JSON.
- Importação de páginas HTTPS por URL, com limite de tamanho, tempo de resposta e bloqueio básico de endereços privados.
- Hash, data de indexação, origem e erro de indexação armazenados por documento.
- Recuperação da base filtrada pela organização do lead e ranqueada lexicalmente pela pergunta; somente os trechos relevantes entram no prompt da Ana.

### Central de Atendimento

- Protocolo por atendimento.
- Departamentos, filas, prioridade, status e responsável.
- SLA de primeira resposta e resolução.
- Tags, notas internas e respostas rápidas.
- Histórico de tentativas, mensagens e chamadas.
- Falha da automação da Ana destacada no lead e na conversa, com o motivo técnico preservado.
- Vendedor vê apenas tickets atribuídos a ele ou ligados aos próprios leads; administrador vê toda a organização.
- A Central escolhe Instagram quando o lead veio desse canal e não possui WhatsApp/telefone.

### Instagram

- Webhook Meta com validação HMAC e deduplicação.
- Captura de Direct, resposta a Story e comentários.
- Direct/Story entra na conversa da Ana; comentário captura o lead sem publicar resposta automática.
- Envio de mensagem pela Meta Graph API.

### E-mail, telefone e agenda

- E-mail continua operando por Resend, com retorno de eventos pelo webhook existente.
- Chamadas usam um adaptador VoIP HTTP, com consentimento obrigatório quando a gravação é solicitada.
- Tentativas e identificadores externos das chamadas são registrados.
- Google Calendar ganhou consulta de disponibilidade antes do agendamento e sincronização automática após criar a reunião.

### Multiempresa e segurança

- Entidades operacionais recebem `organization_id`.
- RLS restritiva evita leitura cruzada entre organizações.
- Workers com `service_role` derivam a organização por lead, documento, sequência, agenda ou usuário.
- Notas e tags internas herdam o mesmo recorte de acesso do ticket.
- Pesos de classificação e cadência padrão são independentes por organização.
- Downloads validam cada redirecionamento; o token da Meta só é enviado a domínios pertencentes à Meta.

### Automação

- A cadência existente continua sendo o motor funcional de primeiro contato e fallback.
- Aprovação, resposta recebida, qualificação, encaminhamento e mudança de etapa já disparam as ações comerciais existentes.
- Foram criadas tabelas para workflows genéricos, passos e execuções, preparando gatilhos adicionais sem acoplar regras ao código.
- Um workflow do GitHub Actions chama os workers a cada cinco minutos. Heartbeats em banco alimentam o alerta de agendador parado nos Relatórios.
- A Server Function pode inserir apenas jobs de espera ligados a leads acessíveis; lock e processamento continuam exclusivos do worker.

## Configuração necessária para ativar em produção

1. Aplicar, em ordem, as migrations `20260810190000_omnichannel_commercial_automation.sql` e `20260810210000_prospecting_automation_completion.sql` no Supabase.
2. Configurar as variáveis descritas em `.env.example` no ambiente do Lovable.
3. Selecionar o provedor/modelo da Ana em **Configurações > IA**.
4. Reconectar cada vendedor ao Google Calendar para conceder também o escopo `calendar.freebusy`.
5. Configurar na Meta o webhook `/api/public/meta-webhook`, os eventos da conta profissional e o token da página.
6. Configurar no Z-API o webhook `/api/public/zapi-webhook` com o segredo correspondente.
7. Verificar domínio/remetente e webhook no Resend.
8. Adaptar o formato de requisição/resposta do provedor VoIP escolhido ao contrato do adaptador genérico.
9. Manter o modo sandbox ativo até concluir testes de ponta a ponta com números e e-mails controlados.
10. Em GitHub Actions, cadastrar `AUTOMATION_BASE_URL` e `OUTREACH_CRON_SECRET`, habilitar Actions e executar o workflow manualmente uma vez.
11. Em **Configurações > Prospecção**, revisar modo de aprovação, score, IAs e estratégia antes de liberar a operação.

## Itens que ainda dependem de decisão ou fornecedor

- **URA completa:** exige escolher o provedor (Twilio, Telnyx, Plivo, PABX SIP etc.) e mapear menus, filas, horários e regras de gravação.
- **Gravação e transcrição reais:** o banco e o consentimento estão preparados, mas a URL da gravação depende do callback do provedor VoIP escolhido.
- **Instagram em produção:** depende de conta profissional, Página vinculada, revisão/permissões do app Meta e política da janela de mensagens.
- **Variações futuras do payload Z-API:** imagem e áudio estão mapeados nos formatos documentados/usuais; novos formatos do fornecedor devem ser adicionados ao normalizador sem alterar a Ana.
- **Workflows genéricos editáveis:** as tabelas estão prontas; uma interface visual e um worker para todos os tipos de passo ainda podem ser construídos. A automação crítica de prospecção/contato/handoff já funciona pelo motor de cadências.
- **Servidor SMTP próprio:** a implementação usa Resend. Caso seja obrigatório usar SMTP do servidor da empresa, será necessário um conector SMTP separado; não é recomendável expor senha SMTP no navegador.
- **Hardening da importação por URL:** para ambientes de alta exigência, recomenda-se uma lista de domínios permitidos e validação DNS contra rebinding.
- **Testes integrados:** ainda precisam ser executados em um projeto Supabase de homologação com as migrations aplicadas e credenciais sandbox reais dos provedores.

## Validação técnica realizada

- Build de produção: aprovado.
- TypeScript (`tsc --noEmit`): aprovado.
- Diff: sem erros de whitespace.
- Lint dos novos módulos: aprovado.
- Lint global: a base anterior possui milhares de divergências de Prettier em arquivos não relacionados; isso não bloqueia build, mas merece uma tarefa separada para evitar um diff massivo nesta entrega.
