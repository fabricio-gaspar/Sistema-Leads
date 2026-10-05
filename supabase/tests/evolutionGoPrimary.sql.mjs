import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run only against a caller-created in-memory PGlite database, never a DSN.
const original = await readFile(new URL('../migrations/20261003223000_transfer_whatsapp_channel_with_assignee.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../migrations/20261005234602_prefer_evolution_go_for_new_lead_bindings.sql', import.meta.url), 'utf8');
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const org = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const seller = '11111111-1111-4111-8111-111111111111';
const lead = '22222222-2222-4222-8222-222222222222';
const wa = '33333333-3333-4333-8333-333333333333';
const evo = '44444444-4444-4444-8444-444444444444';
const corporate = '55555555-5555-4555-8555-555555555555';

function definition(name) {
  const match = original.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$function\\$;`, 'i'));
  assert.ok(match, `${name} definition missing`);
  return match[0];
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private;
    create table public.leads(id uuid primary key, organization_id uuid, assigned_to uuid, owner_id uuid,
      whatsapp_account_id uuid, updated_at timestamptz default now());
    create table public.whatsapp_accounts(id uuid primary key, organization_id uuid, integration_id uuid,
      owner_user_id uuid, provider text, account_type text, enabled boolean, is_default boolean,
      connection_status text, archived_at timestamptz, updated_at timestamptz default now());
    create table public.messaging_provider_controls(organization_id uuid, provider text, kill_switch boolean, send_enabled boolean);
    create table public.lead_whatsapp_account_bindings(organization_id uuid, lead_id uuid,
      whatsapp_account_id uuid, reason text, unbound_at timestamptz);
  `);
  for (const name of ['resolve_lead_whatsapp_account', 'central_list_transfer_targets', 'assign_human_handoff']) {
    await db.exec(definition(name));
  }
  await db.exec(migration);
  for (const [name, marker] of [
    ['resolve_lead_whatsapp_account', "account.provider = 'evolution_go'"],
    ['central_list_transfer_targets', "candidate.provider = 'evolution_go'"],
    ['assign_human_handoff', "account.provider = 'evolution_go'"],
  ]) {
    const result = await db.query(`select pg_get_functiondef(to_regprocedure('public.${name}(${name === 'resolve_lead_whatsapp_account' ? 'uuid,uuid' : name === 'central_list_transfer_targets' ? 'uuid' : 'uuid,text,text,uuid'})')) as source`);
    assert.ok(result.rows[0].source.includes(marker), `${name} was not updated`);
  }
  await db.exec(`
    insert into public.whatsapp_accounts(id,organization_id,integration_id,owner_user_id,provider,account_type,enabled,is_default,connection_status,updated_at)
    values
      ('${wa}','${org}','${wa}','${seller}','wa_akg','seller',true,false,'connected',now()),
      ('${evo}','${org}','${evo}','${seller}','evolution_go','seller',true,false,'connected',now()-interval '1 day'),
      ('${corporate}','${org}','${corporate}',null,'zapi','corporate',true,true,'connected',now());
    insert into public.messaging_provider_controls values
      ('${org}','wa_akg',false,true),('${org}','evolution_go',false,true),('${org}','zapi',false,true);
    insert into public.leads(id,organization_id,assigned_to,owner_id) values('${lead}','${org}','${seller}','${seller}');
  `);
  const select = async () => (await db.query(`select * from public.resolve_lead_whatsapp_account('${org}','${lead}')`)).rows[0];
  assert.equal((await select()).account_id, evo, 'new lead should prefer ready Evolution GO despite older timestamp');
  assert.equal((await db.query(`select whatsapp_account_id from public.leads where id='${lead}'`)).rows[0].whatsapp_account_id, evo);
  await db.exec(`update public.leads set whatsapp_account_id='${wa}' where id='${lead}';
    update public.lead_whatsapp_account_bindings set whatsapp_account_id='${wa}' where lead_id='${lead}';`);
  assert.equal((await select()).account_id, wa, 'existing binding must remain on its original number');
  await db.exec(`update public.leads set whatsapp_account_id=null where id='${lead}';
    delete from public.lead_whatsapp_account_bindings where lead_id='${lead}';
    update public.whatsapp_accounts set enabled=false where id='${evo}';`);
  assert.equal((await select()).account_id, wa, 'disabled Evolution GO must not be selected');
  await db.exec(`update public.leads set whatsapp_account_id=null,assigned_to=null,owner_id=null where id='${lead}';
    delete from public.lead_whatsapp_account_bindings where lead_id='${lead}';`);
  assert.equal((await select()).account_id, corporate, 'corporate fallback remains available');
  console.log(JSON.stringify({ engine: 'PGlite', scenarios: 7, status: 'passed', externalCalls: 0 }));
} finally {
  await db.close();
}
