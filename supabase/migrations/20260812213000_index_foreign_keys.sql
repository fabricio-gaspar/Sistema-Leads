-- Cover every public foreign key with an index when no existing index has the
-- foreign-key columns as its leading columns. This keeps tenant-scoped joins
-- and cascade operations predictable as the CRM grows.
do $$
declare
  fk record;
  index_name text;
begin
  for fk in
    select
      ns.nspname as schema_name,
      rel.relname as table_name,
      con.conname as constraint_name,
      array_agg(att.attname order by key_columns.ordinality) as column_names
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    join lateral unnest(con.conkey) with ordinality as key_columns(attnum, ordinality) on true
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = key_columns.attnum
    where con.contype = 'f'
      and ns.nspname = 'public'
      and not exists (
        select 1
        from pg_index idx
        where idx.indrelid = con.conrelid
          and idx.indisvalid
          and idx.indpred is null
          and (idx.indkey::smallint[])[0:array_length(con.conkey, 1) - 1] = con.conkey
      )
    group by ns.nspname, rel.relname, con.conname
  loop
    index_name := left(
      format('idx_%s_%s', fk.table_name, substr(md5(fk.constraint_name), 1, 12)),
      63
    );

    execute format(
      'create index if not exists %I on %I.%I (%s)',
      index_name,
      fk.schema_name,
      fk.table_name,
      array_to_string(array(select quote_ident(column_name) from unnest(fk.column_names) as column_name), ', ')
    );
  end loop;
end
$$;
