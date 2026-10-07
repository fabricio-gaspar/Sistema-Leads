// Usage: node supabase/tests/receiptReconciliationR3.pglite.mjs /absolute/path/to/pglite/dist/index.js
// PostgreSQL in memory. No Supabase project, provider, credential or network.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const results = [];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const org = id(1), orgB = id(2), account = id(11), accountB = id(12), accountOtherOrg = id(13);
const at = '2026-10-05T12:00:00.000Z';
const migration = new URL('../migrations/20261005220139_audit_r3_receipt_reconciliation.sql', import.meta.url);
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create table public.whatsapp_accounts(id uuid primary key, organization_id uuid not null, provider text not null);
  create table public.lead_outreach(
    id uuid primary key, organization_id uuid not null, whatsapp_account_id uuid,
    lead_id uuid not null, channel text, provider text, provider_message_id text,
    status text, metadata jsonb default '{}', created_at timestamptz default now(),
    updated_at timestamptz, sent_at timestamptz, delivered_at timestamptz, read_at timestamptz,
    failed_at timestamptz, error text);
  create table public.lead_messages(id uuid primary key, organization_id uuid not null,
    whatsapp_account_id uuid, lead_id uuid not null, type text, provider_message_id text);
  grant usage on schema public to service_role;
  grant select,update on all tables in schema public to service_role;
`);
const previousSource = await readFile(new URL('../migrations/20261005005823_wa_akg_provider_foundation.sql', import.meta.url), 'utf8');
const previousFunction = previousSource.slice(previousSource.indexOf('create or replace function public.reconcile_whatsapp_receipt('), previousSource.indexOf('comment on table public.wa_akg_webhook_events'));
await db.exec(previousFunction);
await assert.rejects(() => db.query('select * from public.reconcile_whatsapp_receipt($1, $2, 1, $3, $4)', [org, ['synthetic'], 'read', at]), /coalesce/);
results.push({ id: 'T-R3-SQL-000', result: 'PASS', scenario: 'preserved pre-fix function reproduces COALESCE SQLSTATE42883' });
await db.exec(await readFile(migration, 'utf8'));

async function seed() {
  await db.exec('truncate public.lead_outreach, public.lead_messages, public.whatsapp_accounts');
  for (const [a, o, provider] of [[account, org, 'wa_akg'], [accountB, org, 'wa_akg'], [accountOtherOrg, orgB, 'wa_akg']]) {
    await db.query('insert into public.whatsapp_accounts values ($1,$2,$3)', [a,o,provider]);
  }
  for (const [n, a, o] of [[21,account,org], [22,accountB,org], [23,accountOtherOrg,orgB]]) {
    await db.query(`insert into public.lead_outreach(id,organization_id,whatsapp_account_id,lead_id,channel,provider,provider_message_id,status,metadata)
      values ($1,$2,$3,$4,'whatsapp','wa_akg','same-provider-id','sent',$5)`,
    [id(n),o,a,id(n+10),{ message_id:id(n+20) }]);
    await db.query("insert into public.lead_messages values ($1,$2,$3,$4,'sent','same-provider-id')", [id(n+20),o,a,id(n+10)]);
  }
}
async function receipt(status='read', messageIds=['same-provider-id'], a=account, o=org, count=messageIds.length) {
  return (await db.query('select * from public.reconcile_whatsapp_receipt_for_account($1,$2,$3,$4,$5,$6)', [o,a,messageIds,count,status,at])).rows;
}
async function rows() { return (await db.query('select * from public.lead_outreach order by id')).rows; }
async function check(testId, scenario, fn) {
  await seed();
  try { await fn(); results.push({ id:testId, result:'PASS', scenario }); }
  catch(error) { results.push({ id:testId, result:'FAIL', scenario, error: error.message }); }
}

await check('T-R3-SQL-001', 'read, then older delivered/sent/failed never downgrade; repeat read is unchanged', async () => {
  assert.equal((await receipt())[0].changed, true);
  const stable = await rows();
  for (const status of ['delivered','sent','failed','read']) {
    const result = (await receipt(status))[0];
    assert.equal(result.current_status,'read'); assert.equal(result.changed,false);
  }
  assert.deepEqual(await rows(),stable);
  assert.equal(stable[0].read_at.toISOString(),at);
});
await check('T-R3-SQL-002', 'normal sent → delivered → read transition fills timestamps once', async () => {
  assert.equal((await receipt('delivered'))[0].current_status,'delivered');
  assert.equal((await receipt('read'))[0].current_status,'read');
  const current = (await rows())[0];
  assert.ok(current.sent_at); assert.ok(current.delivered_at); assert.ok(current.read_at);
});
await check('T-R3-SQL-003', 'same provider ID in other account or organization is untouched', async () => {
  await receipt(); const current = await rows();
  assert.deepEqual(current.map(r => r.status),['read','sent','sent']);
  assert.equal((await receipt('read',['same-provider-id'],accountOtherOrg,orgB))[0].outreach_id,id(23));
  assert.equal((await rows())[1].status,'sent');
});
await check('T-R3-SQL-004', 'account from another organization or missing account fails closed', async () => {
  const previous = await rows();
  await assert.rejects(() => receipt('read',['same-provider-id'],accountOtherOrg,org), /receipt_account_not_owned/);
  await assert.rejects(() => receipt('read',['same-provider-id'],null), /receipt_input_invalid/);
  assert.deepEqual(await rows(),previous);
});
await check('T-R3-SQL-005', 'unknown ID is a no-op, not a synthetic outbound message', async () => {
  const previous = await rows(); assert.deepEqual(await receipt('read',['unknown']),[]);
  assert.deepEqual(await rows(),previous);
  assert.equal((await db.query('select count(*)::int n from public.lead_messages')).rows[0].n,3);
});
await check('T-R3-SQL-006', 'receipt provider must match original account', async () => {
  await db.query("update public.whatsapp_accounts set provider='evolution_go' where id=$1",[account]);
  assert.deepEqual(await receipt(),[]); assert.equal((await rows())[0].status,'sent');
});
await check('T-R3-SQL-007', 'linked message from another account aborts and rolls back outreach update', async () => {
  await db.query('update public.lead_messages set whatsapp_account_id=$1 where id=$2',[accountB,id(41)]);
  await assert.rejects(() => receipt(),/receipt_message_identity_conflict/);
  assert.equal((await rows())[0].status,'sent');
});
await check('T-R3-SQL-008', 'failed and replied terminal states preserve existing contract', async () => {
  await receipt('failed'); assert.equal((await receipt('sent'))[0].current_status,'failed');
  await db.query("update public.lead_outreach set status='replied' where id=$1",[id(21)]);
  for (const status of ['sent','delivered','read','failed']) assert.equal((await receipt(status))[0].current_status,'replied');
});
await check('T-R3-SQL-009', 'ambiguous same-account IDs reject atomically', async () => {
  await db.query('update public.lead_outreach set whatsapp_account_id=$1 where id=$2',[account,id(22)]);
  const previous = await rows(); await assert.rejects(() => receipt(),/receipt_identity_ambiguous/);
  assert.deepEqual(await rows(),previous);
});
await check('T-R3-SQL-010', 'partial batch returns only known target for caller review', async () => {
  const result = await receipt('read',['same-provider-id','unknown']);
  assert.equal(result.length,1); assert.equal(result[0].outreach_id,id(21));
});
await check('T-R3-SQL-011', 'legacy five-argument API is fixed and preserved without broader grants', async () => {
  const result = await db.query('select * from public.reconcile_whatsapp_receipt($1,$2,1,$3,$4)',[orgB,['same-provider-id'],'read',at]);
  assert.equal(result.rows[0].current_status,'read'); assert.equal((await rows())[0].status,'sent');
});
await check('T-R3-SQL-012', 'both APIs deny anon/authenticated and remain invoker with empty search_path', async () => {
  const functions = ['reconcile_whatsapp_receipt(uuid,text[],integer,text,timestamptz)', 'reconcile_whatsapp_receipt_for_account(uuid,uuid,text[],integer,text,timestamptz)'];
  for (const fn of functions) {
    for (const role of ['anon','authenticated','service_role']) {
      const r = await db.query("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,`public.${fn}`]);
      assert.equal(r.rows[0].allowed,role === 'service_role');
    }
    const r = await db.query('select prosecdef,proconfig from pg_proc where oid=$1::regprocedure',[`public.${fn}`]);
    assert.equal(r.rows[0].prosecdef,false); assert.ok(r.rows[0].proconfig.includes('search_path=""'));
  }
  await db.exec('set role service_role');
  try { assert.equal((await receipt())[0].current_status,'read'); }
  finally { await db.exec('reset role'); }
});
await check('T-R3-SQL-013', 'null status and empty message IDs are invalid', async () => {
  await assert.rejects(() => receipt(null),/receipt_input_invalid/);
  await assert.rejects(() => receipt('read',[]),/receipt_input_invalid/);
});

const version = (await db.query('select version() version')).rows[0].version;
await db.close();
console.log(JSON.stringify({ environment:'PGlite in-memory, synthetic schema and fixtures, no network',version,migration:migration.pathname,
  passed:results.filter(r=>r.result==='PASS').length,failed:results.filter(r=>r.result==='FAIL').length,results },null,2));
if(results.some(r=>r.result==='FAIL')) process.exitCode=1;
