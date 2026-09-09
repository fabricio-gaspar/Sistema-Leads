# Problemas conhecidos

## Crítico

- Worker de saída ainda não possui execução server-side completa com lease, heartbeat,
  dead-letter e reconciliação automatizada.
- Fluxo real WhatsApp → Ana → resposta não foi homologado ponta a ponta com número autorizado.

## Alto

- Funções e stores legados ainda oferecem caminhos paralelos a `ana-run` e às tabelas reais.
- Base multimídia registra arquivos, mas não extrai de forma completa PDF/DOCX/PPTX/XLSX,
  OCR de imagem, áudio ou vídeo.
- Testes E2E autenticados, webhook real, concorrência e RLS entre duas organizações faltam.
- Claude está configurado como provedor pretendido, mas permanece desabilitado e sem teste válido.

## Médio

- Parte do painel ainda importa tipos e presets de `mocks`; é preciso separar tipo de dado
  simulado e remover qualquer seed do runtime de produção.
- Callbacks de entrega/leitura aguardam reconciliação específica.
- O módulo secundário de Equipe ainda não calcula tempo de resposta por timestamps; o painel
  agora informa a indisponibilidade em vez de exibir números simulados.

## Sugestões, não bugs

- Ambiente de homologação isolado e piloto controlado antes de comercializar.
- Backup/restore ensaiado e runbook de incidentes.
