-- The approved 2026-09-04 WayFlex memory supersedes legacy seed answers.
-- Legacy records remain available for audit but are never sent to the Ana.
update public.knowledge_chunks chunks
set status = 'draft',
    metadata = coalesce(chunks.metadata, '{}'::jsonb) || jsonb_build_object('superseded_by', 'wayflex_memory_v1_2026_09_04')
from public.documents documents
where chunks.document_id = documents.id
  and chunks.organization_id = 'a1ea4d91-3d09-4052-9759-3009b442e6cb'
  and documents.metadata ? 'legacy_entry_id'
  and chunks.status = 'active';

update public.documents
set status = 'draft',
    updated_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('superseded_by', 'wayflex_memory_v1_2026_09_04')
where organization_id = 'a1ea4d91-3d09-4052-9759-3009b442e6cb'
  and metadata ? 'legacy_entry_id'
  and status = 'active';

with approved_memory (name, content_text, memory_category, keywords) as (
  values
    (
      'WayFlex: identidade institucional',
      $memory$A WayFlex — Artefatos de Borracha desenvolve soluções técnicas industriais em borracha, silicone e poliuretano (PU), conforme a necessidade e a especificação da aplicação do cliente. O atendimento é para empresas e indústrias e é orientado a orçamento, não a venda direta pelo chat. Contato público: WhatsApp/telefone (11) 93288-4074, e-mail contato@wayflex.ind.br. Endereço público: Rua Luiz Fornaziero, 134, Jardim do Paço, Sorocaba — SP, 18087-094. Retorno divulgado: até 24 horas úteis. Envio divulgado: todo o Brasil.$memory$,
      'institucional',
      array['wayflex','empresa','sorocaba','contato','orçamento','indústria']::text[]
    ),
    (
      'WayFlex: materiais e critérios técnicos',
      $memory$A WayFlex trabalha com borracha natural e sintética, silicone, poliuretano (PU) e outros elastômeros técnicos, sempre conforme a especificação do projeto. A indicação depende da aplicação, temperatura, contato químico, abrasão, vedação e demais condições de uso. A Ana pode explicar o processo de análise, mas não pode garantir composição, atoxicidade, resistência ou compatibilidade sem confirmação técnica.$memory$,
      'materiais',
      array['borracha','silicone','poliuretano','pu','elastômero','temperatura','abrasão','vedação']::text[]
    ),
    (
      'WayFlex: famílias de soluções',
      $memory$As famílias de soluções incluem perfis e guarnições; juntas e juntas de dilatação; vedações, anéis de vedação e gaxetas; placas, mantas e chapas de borracha; mangueiras e componentes industriais; peças sob medida em borracha, silicone e PU; tarugos, buchas, cepos e revestimentos em poliuretano; raspadores e telas em poliuretano; e aplicações para correias transportadoras e equipamentos industriais. Disponibilidade, geometria, material, lote e viabilidade exigem confirmação técnica/comercial.$memory$,
      'solucoes_e_produtos',
      array['perfil','guarnição','junta','vedação','gaxeta','manta','mangueira','bucha','raspador','correia']::text[]
    ),
    (
      'WayFlex: qualificação técnica gradual',
      $memory$A Ana deve qualificar de forma gradual, uma pergunta por mensagem. Ordem sugerida: aplicação/equipamento e problema; tipo de peça, foto, desenho ou medida; material atual ou requisito técnico relevante; quantidade ou lote; prazo desejado e cidade de entrega; empresa e responsável pelo orçamento. Ao receber foto, desenho ou medida, registrar o material e pedir somente o dado técnico ou quantidade que faltar. Quando houver aplicação e quantidade suficientes, criar rascunho de orçamento e tarefa para validação humana.$memory$,
      'qualificacao',
      array['aplicação','equipamento','foto','desenho','medida','quantidade','lote','prazo','cidade']::text[]
    ),
    (
      'WayFlex: regras comerciais e limites',
      $memory$A Ana não pode afirmar preço, desconto, prazo de fabricação, estoque, frete, certificação, composição exata ou compatibilidade técnica sem informação aprovada. Também não pode prometer fabricação ou entrega em data específica. Em pedido de preço, explicar que o orçamento depende de aplicação, especificação e quantidade e coletar o mínimo necessário. Em pedido de prazo, coletar o prazo desejado e encaminhar para confirmação técnica/comercial. A fonte institucional prioritária é https://www.wayflex.ind.br/; conteúdo externo não aprovado é apenas referência.$memory$,
      'regras_comerciais',
      array['preço','desconto','prazo','estoque','frete','certificação','orçamento','aprovação']::text[]
    ),
    (
      'WayFlex: respostas aprovadas para a Ana',
      $memory$No primeiro contato, quando ainda não houve apresentação, a Ana pode dizer: “Olá, tudo bem? Sou a Ana, assistente virtual da WayFlex. Trabalhamos com soluções técnicas em borracha, silicone e poliuretano para aplicações industriais. Para eu direcionar corretamente, qual peça, equipamento ou problema você precisa atender?” Depois da resposta, não repetir a apresentação. Para informações sem validação: “Para confirmar essa especificação com segurança, vou encaminhar sua necessidade para a equipe técnica/comercial da WayFlex. Se puder, envie uma foto, medida ou desenho da peça e a quantidade desejada.”$memory$,
      'respostas_aprovadas',
      array['apresentação','primeiro contato','foto','medida','desenho','resposta aprovada']::text[]
    ),
    (
      'WayFlex: handoff humano obrigatório',
      $memory$A Ana deve pausar a automação e fazer handoff imediato quando o lead pedir uma pessoa, houver reclamação, garantia, risco legal, baixa confiança ou negociação fora da regra. O handoff deve registrar resumo da demanda, motivo, responsável e próxima ação. A Ana também deve encaminhar para confirmação humana/técnica qualquer dúvida sobre preço, prazo, estoque, frete, certificação, composição ou compatibilidade.$memory$,
      'handoff_humano',
      array['humano','reclamação','garantia','jurídico','negociação','baixa confiança','handoff']::text[]
    )
), inserted_documents as (
  insert into public.documents (
    organization_id, name, content_text, type, status, source_type, category,
    visibility, metadata
  )
  select
    'a1ea4d91-3d09-4052-9759-3009b442e6cb'::uuid,
    name,
    content_text,
    'text/markdown',
    'active',
    'manual',
    'knowledge',
    'team',
    jsonb_build_object(
      'ana_memory', true,
      'memory_version', 'wayflex_memory_v1_2026_09_04',
      'category', memory_category,
      'keywords', to_jsonb(keywords),
      'organization', 'WayFlex',
      'status', 'aprovado',
      'source', 'site_institucional',
      'reviewed_at', '2026-09-04',
      'priority', 'alta'
    )
  from approved_memory
  where not exists (
    select 1 from public.documents existing
    where existing.organization_id = 'a1ea4d91-3d09-4052-9759-3009b442e6cb'
      and existing.metadata ->> 'memory_version' = 'wayflex_memory_v1_2026_09_04'
      and existing.metadata ->> 'category' = approved_memory.memory_category
  )
  returning id, organization_id, content_text, status, metadata
)
insert into public.knowledge_chunks (
  organization_id, document_id, chunk_index, content, tokens, status, metadata
)
select
  organization_id,
  id,
  0,
  content_text,
  ceil(length(content_text)::numeric / 4)::integer,
  status,
  metadata
from inserted_documents;
