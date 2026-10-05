-- Perguntas internas de qualificação por conteúdo comercial.
-- Não representam especificações técnicas, preço, prazo ou compatibilidade.

begin;

alter table public.knowledge_catalog_items
  add column if not exists qualification_questions text[] not null default '{}'::text[],
  add constraint knowledge_catalog_items_qualification_questions_limit
    check (cardinality(qualification_questions) <= 8);

update public.knowledge_catalog_items
set qualification_questions = case item_type
  when 'product' then array[
    'Em qual equipamento ou aplicação o item será utilizado?',
    'Você possui medida, perfil, desenho ou especificação disponível?',
    'Há condição de uso relevante, como temperatura, fluido, ambiente ou carga?'
  ]
  when 'service' then array[
    'Qual segmento, equipamento ou aplicação precisa da solução?',
    'Qual componente precisa ser vedado, protegido ou substituído?',
    'Há medida, desenho ou condição de operação que a equipe técnica deva avaliar?'
  ]
  when 'catalog' then array[
    'Qual aplicação ou segmento você deseja consultar?',
    'Qual produto, componente ou equipamento está avaliando?',
    'Você precisa de orientação técnica antes de solicitar orçamento?'
  ]
  else array[
    'Qual aplicação este material deve atender?',
    'Há especificação ou documento técnico que possamos analisar?'
  ]
end
where cardinality(qualification_questions) = 0;

create or replace function private.commercial_knowledge_text(p_item public.knowledge_catalog_items)
returns text
language sql
stable
set search_path = pg_catalog, public, private
as $function$
  select pg_catalog.left(pg_catalog.concat_ws(E'\n\n',
    'Tipo: ' || case p_item.item_type
      when 'product' then 'Produto ou acessório'
      when 'service' then 'Serviço'
      when 'catalog' then 'Catálogo'
      else 'Documento'
    end,
    'Nome: ' || p_item.name,
    case when nullif(pg_catalog.btrim(coalesce(p_item.code, '')), '') is not null then 'Código: ' || p_item.code end,
    case when nullif(pg_catalog.btrim(coalesce(p_item.category, '')), '') is not null then 'Categoria: ' || p_item.category end,
    case when nullif(pg_catalog.btrim(coalesce(p_item.material, '')), '') is not null then 'Material: ' || p_item.material end,
    case when nullif(pg_catalog.btrim(coalesce(p_item.short_description, '')), '') is not null then 'Resumo: ' || p_item.short_description end,
    case when nullif(pg_catalog.btrim(coalesce(p_item.technical_description, '')), '') is not null then 'Detalhes: ' || p_item.technical_description end,
    case when pg_catalog.cardinality(p_item.applications) > 0 then 'Aplicações: ' || pg_catalog.array_to_string(p_item.applications, ', ') end,
    case when pg_catalog.cardinality(p_item.qualification_questions) > 0 then 'Perguntas internas de qualificação: ' || pg_catalog.array_to_string(p_item.qualification_questions, ' | ') end,
    case when pg_catalog.cardinality(p_item.keywords) > 0 then 'Palavras-chave: ' || pg_catalog.array_to_string(p_item.keywords, ', ') end,
    case when nullif(pg_catalog.btrim(coalesce(p_item.attachment_url, '')), '') is not null then 'Arquivo: ' || p_item.attachment_url end,
    'Fonte: ' || p_item.source_url
  ), 12000)
$function$;

-- Regera somente os documentos derivados dos itens que receberam o roteiro.
update public.knowledge_catalog_items
set updated_at = now()
where cardinality(qualification_questions) > 0;

commit;
