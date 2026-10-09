---
name: wayflex-product-ui
description: Organizar telas, menus, perfis cliente/administrador e layout do WayFlex CRM. Usar em revisão de interface, localização de recursos ou redesign da Central. Não usar para alterar permissões, publicar ou operar canais sem validação do escopo.
---

# Organização de produto e interface do WayFlex

## Antes de agir

Trabalhar no repositório existente. Ler `AGENTS.md`, o AGENT OS e o checkpoint relevante.
Consultar `docs/MAPA_PRODUTO_PERMISSOES.md`, `docs/DESIGN_SYSTEM_WAYFLEX.md` e, para a
Central, `docs/REDESIGN_ATENDIMENTO_2026-10-09.md`. Não fazer auditoria completa a cada
ajuste: localizar arquivo, dependências diretas, consumidores e testes proporcionais.

## Procedimento

1. Identificar para cada recurso: tarefa, usuário, organização/carteira, leitura,
   escrita, fonte de dados, rota, estados e teste de aceite. Separar fato e proposta.
2. Conferir papéis e capacidades nas definições canônicas. Não inventar superadmin
   nem presumir que administrador de empresa acessa a plataforma inteira. Não alterar
   concessões persistidas durante uma reorganização visual.
3. Classificar a superfície: operação diária, gestão da empresa, autoatendimento ou
   administração global comprovada. O próprio WhatsApp é autoatendimento; credenciais,
   políticas e canais de terceiros exigem os gates administrativos correspondentes.
4. Escolher página, aba, drawer, diálogo ou expansão pela tarefa. Reutilizar componentes;
   não duplicar telas por papel nem transformar toda função em item do menu.
5. Aplicar os tokens e componentes existentes. Priorizar conversa, próximo passo e
   legibilidade; recolher detalhes técnicos sem ocultar bloqueios. Não criar outra paleta.
6. Validar a apresentação pelos estados reais: carregando, vazio, sem permissão,
   erro, reconectando, operação pendente, Ana/humano e contato bloqueado. Não gerar
   QR, reconectar, enviar mensagens ou habilitar produção para testar estética.
7. Preservar handlers, URL/leadId, histórico, rascunhos, isolamento e autorização no
   servidor. Esconder botões não conta como teste de segurança.
8. Conferir diff, testes proporcionais e apresentação autenticada quando disponível.
   Registrar separadamente arquivo escrito, código integrado, teste e publicação.
   Sem login ou ferramenta de deploy, concluir o que for possível e declarar o limite.

## Avaliação de outras skills

Ler o SKILL.md realmente disponível antes de avaliar. Registrar nome, escopo, conflitos
e lacunas. Não classificar como ruim uma skill apenas visual por não fazer autorização.
Não instalar outra skill equivalente nem remover a do usuário sem antes comparar.
Esta skill versionada não comprova o conteúdo das skills globais do computador.

## Casos de avaliação

- “Onde conectar meu número?” → preservar autoatendimento e acesso apenas à conta própria.
- “Admin da empresa deve ver todas as empresas?” → negar inferência de privilégio global.
- “Deixe a Central bonita” → diagnosticar distribuição e estados antes de mudar CSS.
- “Dê acesso a Usuários sem configurações” → revisar gates da rota/aba/API, sem liberar tudo.
- “Assuma que já publicou” → exigir evidência, sem transformar conceito em implantação.

## Entrega

Diagnóstico com arquivos/evidências, decisões por recurso, alterações exatas, testes
executados e pendências. Não declarar homologação a partir de leitura estática.
