-- Evaluate auth.uid() once per policy statement instead of once per candidate
-- row. The policies stay semantically identical while avoiding repeated JWT
-- lookups on tenant-scoped queries.
do $$
declare
  policy_row record;
  policy_sql text;
  policy_roles text;
  optimized_qual text;
  optimized_check text;
begin
  for policy_row in
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.uid()%' or
        coalesce(with_check, '') like '%auth.uid()%'
      )
  loop
    select array_to_string(
      array(select quote_ident(role_name) from unnest(policy_row.roles) as role_name),
      ', '
    ) into policy_roles;

    optimized_qual := replace(policy_row.qual, 'auth.uid()', '(select auth.uid())');
    optimized_check := replace(policy_row.with_check, 'auth.uid()', '(select auth.uid())');

    execute format(
      'drop policy %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );

    policy_sql := format(
      'create policy %I on %I.%I as %s for %s to %s',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename,
      policy_row.permissive,
      policy_row.cmd,
      coalesce(nullif(policy_roles, ''), 'public')
    );

    if optimized_qual is not null then
      policy_sql := policy_sql || ' using (' || optimized_qual || ')';
    end if;

    if optimized_check is not null then
      policy_sql := policy_sql || ' with check (' || optimized_check || ')';
    end if;

    execute policy_sql;
  end loop;
end
$$;
