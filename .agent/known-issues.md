# Problemas conhecidos

## Crítico

- Fluxo real WhatsApp → Ana → resposta não foi homologado ponta a ponta com número autorizado.
- A Central agora tenta despachar a mensagem humana imediatamente, mas a aceitação por uma
  instância Z-API real e a entrega ao número continuam dependendo do teste explícito do operador.
- O último teste recebido foi um callback de grupo e foi corretamente ignorado. A homologação
  segue aguardando uma mensagem individual enviada por um lead cadastrado.
- Um callback de entrega/leitura que chegue antes da persistência da aceitação do provedor pode
  ficar sem correspondência até o provedor repetir o callback. Não declarar entrega/leitura
  confiável antes de uma homologação específica.

## Alto

- Base multimídia registra arquivos, mas não extrai de forma completa PDF/DOCX/PPTX/XLSX,
  OCR de imagem, áudio ou vídeo.
- Testes E2E autenticados e roundtrips reais de WhatsApp/Claude/provedores opcionais faltam.
- RLS entre duas organizações e operações transacionais principais foram testadas; não substituir
  isso por uma afirmação de homologação externa.
- Os registros de auditoria históricos são append-only no banco. A limpeza proposta preserva
  esse histórico de governança e só remove os candidatos que o operador selecionar e confirmar;
  até essa confirmação, nenhum dado operacional é apagado automaticamente.
- A última revalidação do worker ocorre antes da chamada externa; uma tomada humana entre essa
  leitura e o provedor ainda é uma janela TOCTOU residual.
- Alterar a configuração publicada da Ana governa novas saídas; um timeout de ausência de
  resposta já agendado não é reavaliado/rearmado retroativamente.
- O novo modo Automático está implementado, porém permanece desativado e em Simulação até o
  operador salvar a rotina e comprovar o ciclo externo Apify → WhatsApp → resposta → Ana.
- Notificações imediatas no painel e resumo diário estão implementados; aviso opcional ao vendedor
  pelo próprio WhatsApp não foi ativado sem número de destino e homologação específica do canal.

## Médio

- Parte do painel ainda importa tipos e presets de `mocks`; é preciso separar tipo de dado
  simulado e remover qualquer seed do runtime de produção.
- Callbacks de entrega/leitura aguardam reconciliação específica.
- O módulo secundário de Equipe ainda não calcula tempo de resposta por timestamps; o painel
  agora informa a indisponibilidade em vez de exibir números simulados.
- O Auth do Supabase permanece com proteção contra senhas vazadas desativada.
- O advisor aponta 111 índices sem uso; aguardar janela representativa antes de remover qualquer um.
- Funções RPC de handoff usam `SECURITY DEFINER` intencionalmente para efetivar a operação
  transacional sob RLS, com validação de membro, organização e papel no corpo da função.

## Resolvido em 13/09/2026

- A falha posterior ao aceite Z-API foi localizada nas formas SQL especiais
  `pg_catalog.coalesce/nullif`. As funções atômicas foram corrigidas e a rotina
  `reconcile_provider_accepted_outreach` finaliza somente registros com identificador do
  provedor comprovado, sem fazer nova chamada externa. Seis jobs históricos foram conciliados.

## Sugestões, não bugs

- Ambiente de homologação isolado e piloto controlado antes de comercializar.
- Backup/restore ensaiado e runbook de incidentes.
