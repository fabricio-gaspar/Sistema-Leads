import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(pathToFileURL(resolve(process.argv[2])).href);
const base=process.argv[3]??'http://127.0.0.1:4181';
if(new URL(base).hostname!=='127.0.0.1')throw new Error('Only local harness allowed');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});
await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
const page=await context.newPage();const failures=[];const checks=[];const errors=[];
page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(5000);
const test=async(name,fn)=>{try{await fn();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:error.message});failures.push(name);}};
try{
 await page.goto(base+'/docs/remediacao/2026-10-05-r4-r14/ui-harness.html');
 await test('Tooltip remains visible across trigger/content gap',async()=>{
   await page.getByRole('button',{name:'Ajuda de teste'}).hover();
   await page.getByRole('tooltip').waitFor({state:'visible'});
   const box=await page.locator('.wf-info-tooltip__portal').boundingBox();
   await page.mouse.move(box.x+20,box.y+4);await page.waitForTimeout(250);
   assert(await page.getByRole('tooltip').isVisible());
   await page.getByRole('tooltip').hover();await page.waitForTimeout(250);
   assert(await page.getByRole('tooltip').isVisible());
 });
 await test('Tooltip overflow can scroll without closing',async()=>{
   await page.getByRole('tooltip').evaluate(el=>{el.scrollTop=100;});
   assert(await page.getByRole('tooltip').isVisible());
   assert((await page.getByRole('tooltip').evaluate(el=>el.scrollTop))>0);
 });
 await test('Escape dismisses help without moving keyboard focus',async()=>{
   const button=page.getByRole('button',{name:'Ajuda de teste'});await button.focus();await page.keyboard.press('Escape');
   assert.equal(await page.getByRole('tooltip').count(),0);assert(await button.evaluate(el=>el===document.activeElement));
 });
 await test('Outside click dismisses help',async()=>{
   await page.getByRole('button',{name:'Ajuda de teste'}).click();await page.mouse.click(1200,800);
   await page.getByRole('tooltip').waitFor({state:'detached'});
 });
 await test('Native dialog traps focus, Escape closes and restores trigger',async()=>{
   await page.locator('#open-csv').click();await page.getByRole('dialog',{name:'CSV sintético'}).waitFor();
   for(let i=0;i<10;i++){await page.keyboard.press('Tab');assert(await page.locator('dialog').evaluate(el=>el.contains(document.activeElement)));}
   await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').count(),0);
   assert(await page.locator('#open-csv').evaluate(el=>el===document.activeElement));
 });
 await test('Column labels associated; multiline/escaped quotes remain one row',async()=>{
   await page.locator('#open-csv').click();
   await page.locator('input[type=file]').setInputFiles({name:'sintetico.csv',mimeType:'text/csv',buffer:Buffer.from('Nome,Nota\r\nAna,"Peça ""A""\r\naprovada"')});
   await page.getByLabel('Nome', {exact:false}).waitFor();
   assert.equal(await page.locator('select').count(),2);
   assert(await page.locator('select').evaluateAll(list=>list.every(el=>el.labels?.length>0)));
   assert.equal(await page.evaluate(()=>window.__imports.length),0);
   await page.getByRole('button',{name:'Importar 1 linha(s)',exact:true}).click();
   assert.deepEqual(await page.evaluate(()=>window.__imports),[[{nome:'Ana',nota:'Peça "A"\r\naprovada'}]]);
 });
 await test('Malformed replacement clears previous valid dataset',async()=>{
   await page.keyboard.press('Escape');await page.locator('#open-csv').click();
   await page.locator('input[type=file]').setInputFiles({name:'valido.csv',mimeType:'text/csv',buffer:Buffer.from('Nome,Nota\nAna,ok')});
   await page.getByRole('button',{name:'Importar 1 linha(s)',exact:true}).waitFor();
   await page.getByRole('button',{name:'Trocar arquivo'}).click();
   await page.locator('input[type=file]').setInputFiles({name:'invalido.csv',mimeType:'text/csv',buffer:Buffer.from('Nome,Nota\nAna,"aberto')});
   await page.getByText(/aspas não fechadas/).waitFor();assert.equal(await page.locator('select').count(),0);
   assert.equal(await page.evaluate(()=>window.__imports.length),1);
 });
 await test('Dialog fits 320px and retains accessible close',async()=>{
   await page.setViewportSize({width:320,height:640});const box=await page.locator('dialog').boundingBox();
   assert(box.width<=320&&box.x>=0);assert(await page.getByRole('button',{name:'Fechar importação'}).isVisible());
 });
 await test('Recovery never runs automatically and requires explicit diagnosis',async()=>{
   await page.keyboard.press('Escape');await page.setViewportSize({width:1280,height:900});
   assert.equal(await page.evaluate(()=>window.__reviews.length),0);
   assert.equal(await page.getByRole('button',{name:'Encerrar consulta mantendo bloqueios'}).count(),0);
   await page.getByRole('button',{name:'Consultar diagnóstico seguro'}).click();
   await page.getByLabel('Motivo da revisão (8 a 500 caracteres)').waitFor();
   assert.equal(await page.evaluate(()=>window.__reviews.length),1);
   assert(await page.getByRole('button',{name:'Encerrar consulta mantendo bloqueios'}).isDisabled());
 });
 await test('Recovery sends observed revision once and promises no activation',async()=>{
   await page.getByLabel('Motivo da revisão (8 a 500 caracteres)').fill('Consulta verificada em teste isolado');
   await page.getByRole('button',{name:'Encerrar consulta mantendo bloqueios'}).click();
   await page.getByText('Revisão registrada. A conta continua desabilitada; envio e Ana não foram liberados.').waitFor();
   assert.deepEqual(await page.evaluate(()=>window.__reviews[1].reconciliation),{expectedRevision:7,reason:'Consulta verificada em teste isolado'});
   assert.equal(await page.evaluate(()=>window.__reconciled),1);
 });
 await test('Unknown external mutation has no reset/replay button',async()=>{
   await page.locator('#reset-recovery').click();await page.getByRole('button',{name:'Consultar diagnóstico seguro'}).click();
   await page.getByText(/não comprovou o término da alteração anterior/).waitFor();
   assert.equal(await page.getByRole('button',{name:'Encerrar consulta mantendo bloqueios'}).count(),0);
   assert.equal(await page.evaluate(()=>window.__reconciled),1);
 });
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({scope:'Real React components in isolated local Chrome; recovery service injected synthetic; no Auth/Supabase/provider requests; not full CRM E2E',browser:await browser.version(),checks,passed:checks.filter(c=>c.passed).length,failed:failures.length,consoleErrors:errors},null,2));
 if(failures.length)process.exitCode=1;
}finally{await context.close();await browser.close();}
