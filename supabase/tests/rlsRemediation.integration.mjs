import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Isolated PostgreSQL integration, never a Supabase connection. Pass a locally installed PGlite.
// node supabase/tests/rlsRemediation.integration.mjs /tmp/.../pglite/dist/index.js
export const root = new URL('../../', import.meta.url);
export const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const admin = '11111111-1111-4111-8111-111111111111';
export const seller = '22222222-2222-4222-8222-222222222222';
export const peer = '33333333-3333-4333-8333-333333333333';
export const outsider = '44444444-4444-4444-8444-444444444444';
export const id = (n) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const migration = 'supabase/migrations/20261005220137_audit_r1_access_hardening.sql';

export async function fixtureSql() {
  const base = new URL('docs/auditoria/2026-10-05-v3/EVIDENCIAS/seguranca/', root);
  const catalog = JSON.parse(await readFile(new URL('EV-SEC-001-politicas-remotas.json', base), 'utf8'));
  const triggerCatalog = JSON.parse(await readFile(new URL('EV-SEC-002-trigger-remoto.json', base), 'utf8'));
  const names = ['is_org_member', 'is_active_org_member', 'is_org_admin', 'has_org_role', 'has_org_permission', 'can_access_lead', 'can_manage_lead', 'can_access_owned_record'];
  const definitions = names.map(name => [...catalog.definitions, ...triggerCatalog.definitions].find(d => (d.proname ?? d.name) === name).definition).join(';\n') + ';';
  const tables = ['leads', 'proposals', 'documents', 'knowledge_chunks', 'contact_suppressions', 'organization_members', 'objects'];
  const policies = catalog.policies.filter(p => tables.includes(p.tablename)).map(p =>
    `create policy "${p.policyname}" on ${p.schemaname}.${p.tablename} for ${p.cmd} to ${p.roles.slice(1, -1)} ${p.qual ? `using (${p.qual})` : ''} ${p.with_check ? `with check (${p.with_check})` : ''};`).join('\n');
  return `
create role authenticated; create role anon; create role service_role bypassrls;
create schema auth; create schema private; create schema storage;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('audit.user_id',true),'')::uuid $$;
create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
create type public.app_role as enum ('administrador','vendedor','sdr','cx','ia');
create table public.organizations(id uuid primary key, updated_at timestamptz default now());
create table public.profiles(id uuid primary key,active_organization_id uuid);
create table public.organization_members(organization_id uuid references public.organizations(id) on delete cascade,user_id uuid,role public.app_role,status text, primary key(organization_id,user_id));
create table public.team_member_permissions(organization_id uuid,user_id uuid,permission text,allowed boolean);
create table public.leads(id uuid primary key,organization_id uuid,owner_id uuid,assigned_to uuid);
create table public.proposals(id uuid primary key,organization_id uuid,owner_id uuid,lead_id uuid);
create table public.documents(id uuid primary key,organization_id uuid,uploaded_by uuid,visibility text default 'restricted',storage_path text,content_text text);
create table public.knowledge_chunks(id uuid primary key,organization_id uuid,document_id uuid,content text);
create table public.contact_suppressions(id uuid primary key default gen_random_uuid(),organization_id uuid,lead_id uuid,contact text,contact_hash text,channel text,reason text,unique(organization_id,contact_hash));
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,unique(bucket_id,name));
insert into public.organizations(id) values ('${A}'),('${B}');
insert into public.organization_members values ('${A}','${admin}','administrador','active'),('${A}','${seller}','vendedor','active'),('${A}','${peer}','vendedor','active'),('${B}','${outsider}','administrador','active');
insert into public.profiles values ('${admin}','${A}'),('${seller}','${A}'),('${peer}','${A}'),('${outsider}','${B}');
insert into public.leads values ('${id(1)}','${A}','${seller}','${seller}'),('${id(2)}','${A}','${peer}','${peer}'),('${id(3)}','${B}','${outsider}','${outsider}');
insert into public.proposals values ('${id(1)}','${A}','${seller}','${id(1)}'),('${id(2)}','${A}','${peer}','${id(2)}'),('${id(3)}','${B}','${outsider}','${id(3)}');
insert into public.documents values
('${id(1)}','${A}','${seller}','restricted','${A}/own.pdf','own'),
('${id(2)}','${A}','${peer}','restricted','${A}/peer.pdf','private'),
('${id(3)}','${A}','${peer}','team','${A}/team.pdf','shared'),
('${id(4)}','${A}','${peer}','sellers','${A}/sellers.pdf','sales'),
('${id(5)}','${A}','${peer}','ai','${A}/ai.pdf','ai-only'),
('${id(6)}','${B}','${outsider}','team','${B}/team.pdf','other org'),
('${id(7)}','${A}','${seller}','team','${A}/peer.pdf','forged pointer');
insert into public.knowledge_chunks select id,organization_id,id,content_text from public.documents;
insert into public.contact_suppressions(id,organization_id,lead_id,contact,contact_hash,channel,reason) values
('${id(1)}','${A}','${id(1)}','synthetic-own','hash-own','all','opt-out'),
('${id(2)}','${A}','${id(2)}','synthetic-peer','hash-peer','whatsapp','opt-out');
insert into storage.objects(id,bucket_id,name,owner_id) values
('${id(1)}','docs','${A}/own.pdf','${seller}'),
('${id(2)}','docs','${A}/peer.pdf','${peer}'),
('${id(3)}','docs','${A}/team.pdf','${peer}'),
('${id(4)}','docs','${A}/sellers.pdf','${peer}'),
('${id(5)}','ana-knowledge','${A}/ai.pdf','${peer}'),
('${id(6)}','docs','${B}/team.pdf','${outsider}'),
('${id(7)}','message-media','${A}/peer-legacy.pdf','${peer}'),
('${id(8)}','message-media','${A}/leads/${id(1)}/media.pdf',null),
('${id(9)}','message-media','${A}/leads/${id(2)}/media.pdf',null),
('${id(10)}','docs','${A}/service-orphan.pdf',null),
('${id(11)}','message-media','${A}/leads/not-a-uuid/x.pdf',null);
insert into storage.objects(id,bucket_id,name,owner) values ('${id(12)}','docs','${A}/legacy-own.pdf','${seller}');
${definitions}
create function public.current_org_id() returns uuid language sql stable as $$ select p.active_organization_id from public.profiles p where p.id=auth.uid() and private.is_org_member(p.active_organization_id,auth.uid()) limit 1 $$;
${tables.map(t => `alter table ${t === 'objects' ? 'storage' : 'public'}.${t} enable row level security;`).join('\n')}
${policies}
grant usage on schema public,private,auth,storage to authenticated,anon,service_role;
grant select,insert,update,delete on all tables in schema public,storage to authenticated,service_role;
`;
}

export async function runTests(db) {
  const results = [];
  async function test(name, user, sql, expected, options = {}) {
    await db.exec('begin;');
    try {
      if (options.setup) await db.exec(options.setup);
      await db.exec(`set local role ${options.role ?? 'authenticated'}; set local audit.user_id='${user}';`);
      let observed;
      for (const statement of Array.isArray(sql) ? sql : [sql]) observed = (await db.query(statement)).rows;
      const ok = typeof expected === 'function' ? expected(observed) : JSON.stringify(observed) === JSON.stringify(expected);
      results.push({ id: `T-R1-${String(results.length + 1).padStart(3, '0')}`, name, result: ok ? 'APROVADO' : 'REPROVADO', observed });
    } catch (e) {
      results.push({ id: `T-R1-${String(results.length + 1).padStart(3, '0')}`, name, result: options.error === e.code ? 'APROVADO' : 'REPROVADO', observed: { code: e.code, error: e.message } });
    } finally { await db.exec('rollback;'); }
  }
  await db.exec(await fixtureSql());
  const before = [];
  for (const [resource, sql] of [
    ['proposal peer read', `select id from public.proposals where id='${id(2)}'`],
    ['proposal peer delete', `delete from public.proposals where id='${id(2)}' returning id`],
    ['document peer delete', `delete from public.documents where id='${id(2)}' returning id`],
    ['storage peer read', `select id from storage.objects where id='${id(7)}'`],
    ['suppression peer delete', `delete from public.contact_suppressions where id='${id(2)}' returning id`],
  ]) {
    await db.exec(`begin; set local role authenticated; set local audit.user_id='${seller}';`);
    before.push({ resource, unauthorizedRows: (await db.query(sql)).rows.length });
    await db.exec('rollback;');
  }
  await db.exec(`begin; set local role authenticated; set local audit.user_id='${admin}';`);
  before.push({ resource: 'last admin delete', unauthorizedRows: (await db.query(`delete from public.organization_members where user_id='${admin}' returning user_id`)).rows.length });
  await db.exec('rollback;');
  await db.exec(await readFile(new URL(migration, root), 'utf8'));
  const count = n => rows => Number(rows[0].n) === n;
  const one = rows => rows.length === 1;
  await test('Proposta alheia/cross-org invisível', seller, 'select count(*) n from public.proposals', count(1));
  await test('Excluir proposta alheia negado', seller, `delete from public.proposals where id='${id(2)}' returning id`, []);
  await test('Editar proposta alheia negado', seller, `update public.proposals set owner_id='${seller}' where id='${id(2)}' returning id`, []);
  await test('Criar proposta no próprio lead', seller, `insert into public.proposals values ('${id(20)}','${A}','${seller}','${id(1)}') returning id`, one);
  await test('Criar proposta no lead alheio negado mesmo com owner próprio', seller, `insert into public.proposals values ('${id(20)}','${A}','${seller}','${id(2)}') returning id`, [], { error: '42501' });
  await test('Excluir proposta própria autorizado', seller, `delete from public.proposals where id='${id(1)}' returning id`, one);
  await test('Override proposals.manage=false impede edição', seller, `update public.proposals set owner_id='${seller}' where id='${id(1)}' returning id`, [], { setup: `insert into public.team_member_permissions values ('${A}','${seller}','proposals.manage',false)` });
  await test('Override leads.read_all=true dá leitura carteira ampliada', seller, 'select count(*) n from public.proposals', count(2), { setup: `insert into public.team_member_permissions values ('${A}','${seller}','leads.read_all',true)` });
  await test('Administrador acessa propostas só na empresa ativa', admin, 'select count(*) n from public.proposals', count(2));
  await test('Excluir documento privado alheio negado', seller, `delete from public.documents where id='${id(2)}' returning id`, []);
  await test('Ler privado/ai alheio e outra organização negado', seller, `select id from public.documents where id in ('${id(2)}','${id(5)}','${id(6)}')`, []);
  await test('Team e sellers preservados', seller, `select count(*) n from public.documents where id in ('${id(3)}','${id(4)}')`, count(2));
  await test('Compartilhado não concede escrita', seller, `update public.documents set content_text='tampered' where id='${id(3)}' returning id`, []);
  await test('Criar documento próprio', seller, `insert into public.documents(id,organization_id,uploaded_by) values ('${id(20)}','${A}','${seller}') returning id`, one);
  await test('Mover documento a outra empresa negado', seller, `update public.documents set organization_id='${B}' where id='${id(1)}' returning id`, [], { error: '42501' });
  await test('Config delegado administra documentos privados', seller, `update public.documents set content_text='reviewed' where id='${id(2)}' returning id`, one, { setup: `insert into public.team_member_permissions values ('${A}','${seller}','configuration.manage',true)` });
  await test('Chunks privados não contornam documents', seller, `select id from public.knowledge_chunks where id in ('${id(2)}','${id(5)}','${id(6)}')`, []);
  await test('Chunks compartilhados legíveis', seller, `select count(*) n from public.knowledge_chunks where id in ('${id(3)}','${id(4)}')`, count(2));
  await test('Chunk alheio não pode ser editado', seller, `update public.knowledge_chunks set content='tampered' where id='${id(3)}' returning id`, []);
  await test('Chunk próprio pode ser criado', seller, `insert into public.knowledge_chunks values ('${id(20)}','${A}','${id(1)}','own') returning id`, one);
  await test('Chunk cross-org/parent alheio negado', seller, `insert into public.knowledge_chunks values ('${id(20)}','${A}','${id(2)}','forged') returning id`, [], { error: '42501' });
  await test('Bytes privados/mídia legado/cross-org/sem dono negados, ponteiro forjado não vaza', seller, `select id from storage.objects where id in ('${id(2)}','${id(5)}','${id(6)}','${id(7)}','${id(9)}','${id(10)}','${id(11)}')`, []);
  await test('Bytes team/sellers e próprio (inclui owner legado) legíveis', seller, `select count(*) n from storage.objects where id in ('${id(1)}','${id(3)}','${id(4)}','${id(12)}')`, count(4));
  await test('Mídia canônica por carteira legível', seller, `select id from storage.objects where id='${id(8)}'`, one);
  await test('Compartilhado não permite overwrite', seller, `update storage.objects set name='${A}/tampered.pdf' where id='${id(3)}' returning id`, []);
  await test('Compartilhado não permite delete', seller, `delete from storage.objects where id='${id(3)}' returning id`, []);
  await test('Upload próprio anterior a documento permitido', seller, `insert into storage.objects(bucket_id,name,owner_id) values ('ana-knowledge','${A}/ana/new.pdf','${seller}') returning id`, one);
  await test('Upload atribuído a colega negado', seller, `insert into storage.objects(bucket_id,name,owner_id) values ('docs','${A}/forged.pdf','${peer}') returning id`, [], { error: '42501' });
  await test('Upload cross-org negado', seller, `insert into storage.objects(bucket_id,name,owner_id) values ('docs','${B}/forged.pdf','${seller}') returning id`, [], { error: '42501' });
  await test('Cleanup próprio permitido', seller, `delete from storage.objects where id='${id(12)}' returning id`, one);
  await test('Revogação visibility corta compartilhamento bytes', seller, `select id from storage.objects where id='${id(3)}'`, [], { setup: `update public.documents set visibility='restricted' where id='${id(3)}'` });
  await test('Config delegado administra bytes legados sem dono', seller, `delete from storage.objects where id='${id(10)}' returning id`, one, { setup: `insert into public.team_member_permissions values ('${A}','${seller}','configuration.manage',true)` });
  await test('Excluir supressão alheia negado', seller, `delete from public.contact_suppressions where id='${id(2)}' returning id`, []);
  await test('Excluir supressão própria sem config negado', seller, `delete from public.contact_suppressions where id='${id(1)}' returning id`, []);
  await test('Supressão de lead alheio não é legível', seller, `select id from public.contact_suppressions where id='${id(2)}'`, []);
  await test('Central inclui supressão de lead próprio', seller, `insert into public.contact_suppressions(organization_id,lead_id,contact,contact_hash,channel) values ('${A}','${id(1)}','new','hash-new','whatsapp') returning id`, one);
  await test('Supressão idempotente por upsert preservada', seller, `insert into public.contact_suppressions(organization_id,lead_id,contact,contact_hash,channel,reason) values ('${A}','${id(1)}','synthetic-own','hash-own','all','repeat') on conflict(organization_id,contact_hash) do update set channel=excluded.channel,reason=excluded.reason returning id`, one);
  await test('Enfraquecer all para whatsapp negado', seller, `update public.contact_suppressions set channel='whatsapp' where id='${id(1)}' returning id`, [], { error: '42501' });
  await test('Trocar hash para contornar supressão negado', seller, `update public.contact_suppressions set contact_hash='changed' where id='${id(1)}' returning id`, [], { error: '42501' });
  await test('Fortalecer supressão para all permitido', seller, `update public.contact_suppressions set channel='all' where id='${id(1)}' returning id`, one, { setup: `update public.contact_suppressions set channel='whatsapp' where id='${id(1)}'` });
  await test('Remoção explícita por config delegado permitida', seller, `delete from public.contact_suppressions where id='${id(1)}' returning id`, one, { setup: `insert into public.team_member_permissions values ('${A}','${seller}','configuration.manage',true)` });
  await test('Último admin DELETE direto negado', admin, `delete from public.organization_members where organization_id='${A}' and user_id='${admin}' returning user_id`, [], { error: '23514' });
  await test('Último admin disable negado', admin, `update public.organization_members set status='disabled' where organization_id='${A}' and user_id='${admin}' returning user_id`, [], { error: '23514' });
  await test('Último admin demotion negada', admin, `update public.organization_members set role='vendedor' where organization_id='${A}' and user_id='${admin}' returning user_id`, [], { error: '23514' });
  await test('Dois admins: um pode ser removido', admin, `delete from public.organization_members where organization_id='${A}' and user_id='${admin}' returning user_id`, one, { setup: `update public.organization_members set role='administrador' where user_id='${peer}'` });
  await test('Admin pode remover vendedor', admin, `delete from public.organization_members where organization_id='${A}' and user_id='${seller}' returning user_id`, one);
  await test('Service role mantém bypass legítimo para supressão', '', `delete from public.contact_suppressions where id='${id(2)}' returning id`, one, { role: 'service_role' });
  await test('Service role ainda preserva último admin', '', `delete from public.organization_members where user_id='${admin}' returning user_id`, [], { role: 'service_role', error: '23514' });
  await test('Exclusão organizacional cascade preservada (somente fixture)', '', `delete from public.organizations where id='${B}' returning id`, one, { role: 'service_role' });
  await test('Vínculo disabled nega propostas/documentos/chunks/Storage', seller, `select (select count(*) from public.proposals)+(select count(*) from public.documents)+(select count(*) from public.knowledge_chunks)+(select count(*) from storage.objects) n`, count(0), { setup: `update public.organization_members set status='disabled' where user_id='${seller}'` });
  await test('Anon não pode executar helpers de privilégio', '', `select private.r1_can_access_storage('docs','${A}/own.pdf','${seller}',false)`, [], { role: 'anon', error: '42501' });
  await test('Cadeia consumer upload → documento → chunk em requisições SQL sucessivas', seller, [
    `insert into storage.objects(bucket_id,name,owner_id) values ('ana-knowledge','${A}/ana/flow.pdf','${seller}')`,
    `insert into public.documents(id,organization_id,uploaded_by,visibility,storage_path) values ('${id(20)}','${A}','${seller}','team','${A}/ana/flow.pdf')`,
    `insert into public.knowledge_chunks values ('${id(20)}','${A}','${id(20)}','new content') returning id`,
  ], one);
  await test('Overwrite próprio permitido', seller, `update storage.objects set name='${A}/own-renamed.pdf' where id='${id(1)}' returning id`, one);
  await test('Proprietário não conserva mídia canônica após sair da carteira', seller, `select id from storage.objects where id='${id(9)}'`, [], { setup: `update storage.objects set owner_id='${seller}' where id='${id(9)}'` });
  await test('Upload canônico em carteira alheia negado', seller, `insert into storage.objects(bucket_id,name,owner_id) values ('message-media','${A}/leads/${id(2)}/forged.pdf','${seller}') returning id`, [], { error: '42501' });
  await test('Último admin não pode mover vínculo de organização via service role', '', `update public.organization_members set organization_id='${B}' where organization_id='${A}' and user_id='${admin}' returning user_id`, [], { role: 'service_role', error: '23514' });
  await test('DELETE em lote não remove os dois admins', '', `delete from public.organization_members where organization_id='${A}' and role='administrador' returning user_id`, [], { role: 'service_role', error: '23514', setup: `update public.organization_members set role='administrador' where user_id='${peer}'` });
  await test('Membro convidado não é admin ativo de reserva', admin, `delete from public.organization_members where user_id='${admin}' returning user_id`, [], { error: '23514', setup: `update public.organization_members set role='administrador',status='invited' where user_id='${peer}'` });
  await test('TRUNCATE fora do workflow não contorna invariante', '', 'truncate public.organization_members', [], { role: 'service_role', error: '42501' });
  await test('Revogar leitura atribuída corta proposta própria vinculada', seller, 'select id from public.proposals', [], { setup: `insert into public.team_member_permissions values ('${A}','${seller}','leads.read_assigned',false)` });
  await test('SDR preserva team/sellers', seller, `select count(*) n from public.documents where id in ('${id(3)}','${id(4)}')`, count(2), { setup: `update public.organization_members set role='sdr' where user_id='${seller}'` });
  await test('CX preserva team, mas sellers é restrito a vendedores/SDR', seller, `select count(*) n from public.documents where id in ('${id(3)}','${id(4)}')`, count(1), { setup: `update public.organization_members set role='cx' where user_id='${seller}'` });
  await test('Duas empresas válidas: não vê organização inativa', seller, `select id from public.documents where organization_id='${B}'`, [], { setup: `insert into public.organization_members values ('${B}','${seller}','administrador','active')` });
  await test('Supressão não pode trocar lead para contornar escopo', seller, `update public.contact_suppressions set lead_id=null where id='${id(1)}' returning id`, [], { error: '42501' });
  await test('Service role pode incluir arquivo sem dono legítimo', '', `insert into storage.objects(bucket_id,name) values ('message-media','${A}/server.pdf') returning id`, one, { role: 'service_role' });
  return { engine: 'PostgreSQL/PGlite 0.3.14 in-memory', migration, fixture: 'remote policy/function snapshot 2026-10-05; reduced schema; synthetic data; no network', before, results, passed: results.filter(r => r.result === 'APROVADO').length, failed: results.filter(r => r.result !== 'APROVADO').length, concurrency: 'Not demonstrated by this single-session runner; see separate multi-session evidence.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Pass the installed PGlite module path; no remote database is accepted.');
  const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
  const db = new PGlite();
  try {
    const result = await runTests(db);
    console.log(JSON.stringify(result, null, 2));
    if (result.failed || result.before.some(r => r.unauthorizedRows !== 1)) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ error: error.message, code: error.code, where: error.where, position: error.position }));
    process.exitCode = 1;
  } finally { await db.close(); }
}
