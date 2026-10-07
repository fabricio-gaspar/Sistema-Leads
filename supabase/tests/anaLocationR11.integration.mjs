import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Real migration on a minimal synthetic schema. No provider, auth or production connection.
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
const tests = [];
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const valid = { cidade: 'Campinas', estados: ['SP'], atividades: ['transportadores'] };
const sqlJson = value => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
try {
  await db.exec(`create schema private; create role anon; create role authenticated;
    create table public.prospecting_schedules(id uuid primary key, organization_id uuid, active boolean, filters jsonb);
    create table public.prospecting_schedule_runs(id uuid primary key, organization_id uuid, schedule_id uuid, operation_mode text, status text);
    insert into public.prospecting_schedules values ('${id(1)}','${id(100)}',false,'{}'),('${id(2)}','${id(100)}',false,${sqlJson(valid)});
    insert into public.prospecting_schedule_runs values ('${id(3)}','${id(100)}','${id(1)}','supervised','awaiting_approval');`);
  await db.exec(await readFile(new URL('../migrations/20261005225107_audit_r11_prospecting_location_guard.sql', import.meta.url), 'utf8'));
  async function test(name, sql, expectedError = null, expected = () => true) {
    await db.exec('begin');
    try {
      const result = await db.query(sql);
      tests.push({ name, passed: !expectedError && expected(result.rows), rows: result.rows });
    } catch (error) { tests.push({ name, passed: error.code === '23514' && error.message === expectedError, code: error.code, message: error.message }); }
    finally { await db.exec('rollback'); }
  }
  for (const [name, filters, issue] of [
    ['Missing city', {}, 'operation_city_required'], ['Non-string city', {...valid,cidade:7},'operation_city_required'],
    ['Empty city', {...valid,cidade:' '},'operation_city_required'], ['Oversize city',{...valid,cidade:'x'.repeat(121)},'operation_city_required'],
    ['No UF',{...valid,estados:[]},'operation_single_state_required'], ['Multiple UF',{...valid,estados:['SP','PR']},'operation_single_state_required'],
    ['Invalid UF',{...valid,estados:['XX']},'operation_single_state_required'], ['Wrong UF type',{...valid,estados:'SP'},'operation_single_state_required'],
    ['No term',{...valid,atividades:[]},'operation_search_terms_required'], ['Malformed term',{...valid,atividades:[true]},'operation_search_terms_required'],
  ]) await test(name, `update public.prospecting_schedules set active=true,filters=${sqlJson(filters)} where id='${id(1)}'`, issue);
  await test('Valid active schedule accepted', `update public.prospecting_schedules set active=true where id='${id(2)}' returning active`, null, rows=>rows[0].active);
  await test('Invalid legacy draft still editable without activation', `update public.prospecting_schedules set filters='{}' where id='${id(1)}' returning id`, null, rows=>rows.length===1);
  for (const status of ['awaiting_approval','queued','running']) {
    await test(`Invalid parent rejects ${status}`, `insert into public.prospecting_schedule_runs values ('${id(4)}','${id(100)}','${id(1)}','automatic','${status}')`, 'operation_city_required');
  }
  await test('Approval checks older run parent rather than newer valid schedule', `update public.prospecting_schedule_runs set status='queued' where id='${id(3)}'`, 'operation_city_required');
  await test('Valid execution accepted', `insert into public.prospecting_schedule_runs values ('${id(4)}','${id(100)}','${id(2)}','automatic','queued') returning id`, null, rows=>rows.length===1);
  await test('Cross-org parent refused', `insert into public.prospecting_schedule_runs values ('${id(4)}','${id(101)}','${id(2)}','automatic','queued')`, 'operation_schedule_missing');
  await test('Simulation can report incomplete draft without paid queue', `insert into public.prospecting_schedule_runs values ('${id(4)}','${id(100)}','${id(1)}','simulation','simulated') returning id`, null, rows=>rows.length===1);
  await test('Legacy invalid run can be cancelled', `update public.prospecting_schedule_runs set status='cancelled' where id='${id(3)}' returning id`, null, rows=>rows.length===1);
  console.log(JSON.stringify({scope:'R11 migration + synthetic schema, no real provider', tests, passed:tests.filter(x=>x.passed).length, total:tests.length},null,2));
  if (tests.some(test=>!test.passed)) process.exitCode=1;
} finally { await db.close(); }
