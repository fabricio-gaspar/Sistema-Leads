import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const evidence = dirname(fileURLToPath(import.meta.url));
const audit = resolve(evidence, '..');
const excluded = new Set(['EVIDENCIAS/manifest-sha256.json','EVIDENCIAS/EV-AUDIT-001-verification.json','EVIDENCIAS/EV-GIT-FINAL.json']);
const files = [];
async function walk(dir) { for (const e of await readdir(dir,{withFileTypes:true})) { const p=resolve(dir,e.name); if(e.isDirectory()) await walk(p); else files.push(p); } }
await walk(audit);
function parseCsv(input) {
  const rows=[]; let row=[],field='',quoted=false;
  for(let i=0;i<input.length;i++){const c=input[i];
    if(c==='"'){if(quoted&&input[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(field);field='';}
    else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));if(row.some(Boolean))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw new Error('CSV unclosed quote');
  if(field||row.length){row.push(field);rows.push(row);}
  return rows;
}
const results={observed_at:new Date().toISOString(),json:[],csv:[],required:[],secret_scan:[],errors:[]};
const required=['RELATORIO_AUDITORIA.md','MATRIZ_DE_COBERTURA.csv','PLANO_DE_REMEDIACAO.md','EVIDENCIAS/index.md','MATRIZ_CICLO_DE_VIDA_MODULOS.csv','MAPA_NAVEGACAO_E_RECURSOS.md','ESPECIFICACAO_UI_COMPACTA.md','FONTES_E_DECISOES.md','RELATORIO_IMPLEMENTACAO_E_REGRESSAO.md','MATRIZ_REQUISITOS_TESTES_EVIDENCIAS.csv','JORNADAS_PONTA_A_PONTA.md','BLOQUEIOS_E_ACESSOS.md','CHECKLIST_DE_LIBERACAO.md'];
for(const f of required){const exists=files.includes(resolve(audit,f));results.required.push({file:f,exists});if(!exists)results.errors.push('Missing '+f);}
const manifest=[];
for(const p of files.sort()){
  const name=relative(audit,p); if(excluded.has(name))continue;
  const bytes=await readFile(p);manifest.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  if(name.endsWith('.json')){try{JSON.parse(bytes.toString());results.json.push(name);}catch(e){results.errors.push(name+': '+e.message);}}
  if(name.endsWith('.csv')){try{const rows=parseCsv(bytes.toString());const width=rows[0].length;if(rows.some(r=>r.length!==width))throw new Error('inconsistent columns');results.csv.push({file:name,rows:rows.length-1,columns:width});}catch(e){results.errors.push(name+': '+e.message);}}
  if(!name.endsWith('.jpg')&&!name.endsWith('.png')){
    const patterns=[/github_pat_[A-Za-z0-9_]{30,}/,/gh[pousr]_[A-Za-z0-9]{25,}/,/sk-(?:proj-|ant-)?[A-Za-z0-9_-]{28,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
    if(patterns.some(x=>x.test(bytes.toString())))results.secret_scan.push(name);
  }
}
if(results.secret_scan.length)results.errors.push('Potential literal secret(s): review names only');
results.status=results.errors.length?'REPROVADO':'APROVADO';
await writeFile(resolve(evidence,'manifest-sha256.json'),JSON.stringify({audit_id:'WAYFLEX-V3-20261005',algorithm:'SHA-256',excludes:[...excluded],files:manifest},null,2)+'\n');
await writeFile(resolve(evidence,'EV-AUDIT-001-verification.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({status:results.status,files:manifest.length,json:results.json.length,csv:results.csv,errors:results.errors},null,2));
process.exitCode=results.errors.length?1:0;
