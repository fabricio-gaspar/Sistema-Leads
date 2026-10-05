-- A Ana usa exclusivamente OpenAI no runtime. Remove o rótulo legado de outro provedor.

begin;

update public.integrations
set
  label = 'Ana (OpenAI)',
  provider = 'OpenAI',
  configuration = coalesce(configuration, '{}'::jsonb)
    - 'anthropic_key'
    - 'claude_model'
    || jsonb_build_object('runtime', 'ana-run', 'secret_name', 'OPENAI_API_KEY'),
  updated_at = now()
where key = 'ai'
  and (provider is distinct from 'OpenAI' or label is distinct from 'Ana (OpenAI)');

commit;
