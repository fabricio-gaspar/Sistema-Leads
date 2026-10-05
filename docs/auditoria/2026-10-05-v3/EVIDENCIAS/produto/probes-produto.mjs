// Audit-only probes. Loads the actual TypeScript source with dependency fakes.
// Does not call a network API, modify the product, or create customer records.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const results = [];
const hashes = {};
function source(file) { const text = readFileSync(path.join(root, file), 'utf8'); hashes[file] = createHash('sha256').update(text).digest('hex'); return text; }
function load(file, mocks = {}, globals = {}) {
  const output = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, require: (name) => { if (name in mocks) return mocks[name]; throw new Error(`Unexpected import: ${name}`); }, console: { error() {}, warn() {}, log() {} }, crypto: globalThis.crypto, setTimeout, clearTimeout, ...globals });
  vm.runInContext(output, context, { filename: file });
  return module.exports;
}
function add(id, scenario, expected, observed, passed) { results.push({ id, scenario, modality: 'contrato simulado local; fonte de produção carregada', expected, observed, status: passed ? 'APROVADO' : 'REPROVADO' }); }
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const csv = load('src/lib/csv.ts');
let parsed = csv.parseCsv('nome,descricao\r\nEmpresa,"linha 1\r\nlinha 2"');
add('T-UI-001', 'CSV com quebra de linha em campo entre aspas', [['Empresa', 'linha 1\r\nlinha 2']], parsed.linhas, parsed.linhas.length === 1 && parsed.linhas[0][1] === 'linha 1\r\nlinha 2');
parsed = csv.parseCsv('nome,descricao\nEmpresa,"Peça ""A"" aprovada"');
add('T-UI-002', 'CSV com aspas escapadas', 'Peça "A" aprovada', parsed.linhas[0][1], parsed.linhas[0][1] === 'Peça "A" aprovada');
parsed = csv.parseCsv('nome;cidade\nEmpresa;São Paulo');
add('T-UI-003', 'CSV simples separado por ponto e vírgula', ['Empresa', 'São Paulo'], parsed.linhas[0], JSON.stringify(parsed.linhas[0]) === JSON.stringify(['Empresa', 'São Paulo']));
for (const [index, file] of ['src/pages/dashboard/leads/page.tsx', 'src/pages/dashboard/kanban/page.tsx'].entries()) {
  const content = source(file);
  const ast = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  const visit = (node) => { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'quote') initializer = node.initializer.getText(ast); ts.forEachChild(node, visit); };
  visit(ast);
  if (!initializer) throw new Error(`quote function not found: ${file}`);
  const code = ts.transpileModule(`module.exports = ${initializer};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({ module: { exports: null } }); vm.runInContext(code, context);
  const encoded = context.module.exports('=1+1');
  const payload = encoded.slice(1, -1).replaceAll('""', '"');
  add(`T-UI-00${4 + index}`, `Exportação ${index ? 'Kanban' : 'Leads'} neutraliza fórmula de planilha`, 'Campo textual que não inicia fórmula após decodificação CSV', { csv: encoded, value: payload }, !/^[=+@-]/.test(payload));
}
for (const [index, kind] of ['leads', 'lists'].entries()) {
  let current = [{ id: 'synthetic-A', nome: 'Dado sintético da organização A' }];
  let loads = 0;
  const react = { useEffect: (effect) => effect(), useSyncExternalStore: (_subscribe, snapshot) => snapshot() };
  const repository = { loadOperationalLeads: async () => { loads++; return current; }, persistOperationalLeads: async (_old, next) => next, loadOperationalLists: async () => { loads++; return current; }, persistOperationalLists: async (_old, next) => next };
  const file = kind === 'leads' ? 'src/hooks/useLeadsStore.ts' : 'src/hooks/useListasStore.ts';
  const mod = load(file, { react, '@/mocks/leadsData': { normalizarLead: (lead) => lead }, '@/lib/crm/leadMapper': { persistentLeadId: (id) => id }, '@/lib/crm/leadsRepository': repository, '@/lib/crm/operationalEntitiesRepository': repository });
  const hook = kind === 'leads' ? mod.useLeadsStore : mod.useListasStore;
  const snapshot = kind === 'leads' ? mod.getLeadsSnapshot : mod.getListasSnapshot;
  hook(); await settle();
  const first = JSON.parse(JSON.stringify(snapshot()));
  // Same SPA module instance after logout/login with another identity/organization.
  current = [{ id: 'synthetic-B', nome: 'Dado sintético da organização B' }];
  hook(); await settle();
  add(`T-UI-00${6 + index}`, `${kind}: remontar consumidor com sessão B depois da sessão A`, 'Fonte B recarregada ou estado anterior apagado', { initial: first, afterSessionChange: snapshot(), repositoryCalls: loads }, snapshot()[0]?.id === 'synthetic-B');
}
{
  const cachedA = [{ id: 'synthetic-notification-A', titulo: 'Notificação sintética de A' }];
  const cache = new Map([['leadai_notificacoes_v1', JSON.stringify(cachedA)]]);
  const writes = []; let callback;
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: null, error: null }; }, async upsert(row) { writes.push(row); return { error: null }; } };
  const mod = load('src/lib/backendStore.ts', { react: { useSyncExternalStore: (_subscribe, snapshot) => snapshot() }, '@/lib/supabase': { supabase: { from: () => query, auth: { onAuthStateChange(fn) { callback = fn; return {}; } } } }, '@/lib/organizationSession': { resolveOrganizationSession: async () => ({ organizationId: 'synthetic-org-B', userId: 'synthetic-user-B' }) } }, { localStorage: { getItem: (key) => cache.get(key) ?? null, setItem: (key, value) => cache.set(key, value) } });
  const store = mod.createBackendStore('notificacoes', 'leadai_notificacoes_v1', []);
  const initial = JSON.parse(JSON.stringify(store.get()));
  callback('SIGNED_IN', { user: { id: 'synthetic-user-B' } }); await settle();
  add('T-UI-008', 'Cache legado não pode semear conteúdo de A na nova organização B', 'Estado vazio/B e nenhuma escrita de A para B', { initial, attemptedWrites: writes }, !writes.some((write) => write.organization_id === 'synthetic-org-B' && write.data[0]?.id === 'synthetic-notification-A'));
}
{
  const content = source('src/pages/dashboard/agenda/page.tsx');
  const ast = ts.createSourceFile('agenda.tsx', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler; let zonedUtc;
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'zonedUtc') zonedUtc = node.getText(ast);
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'onCreate' && ts.isJsxExpression(node.initializer) && node.initializer.expression && node.initializer.expression.getText(ast).includes('nextActionFor')) handler = node.initializer.expression.getText(ast);
    ts.forEachChild(node, visit);
  }; visit(ast);
  if (!handler || !zonedUtc) throw new Error('Agenda handler not found');
  const fixture = { id: '00000000-0000-4000-8000-000000000001', leadId: '00000000-0000-4000-8000-000000000002', title: 'Follow-up sintético', startsAt: '2026-10-05T12:00:00Z', endsAt: '2026-10-05T13:00:00Z', timezone: 'America/Sao_Paulo', location: '', notes: '', updatedAt: '2026-10-05T12:00:00Z' };
  const repo = load('src/lib/crm/appointmentsRepository.ts', { '@/lib/supabase': { supabase: {} }, '@/lib/organizationSession': { resolveOrganizationSession: async () => ({ organizationId: 'synthetic-A', userId: 'synthetic-user-A' }) }, '@/lib/crm/leadMapper': { isUuid: () => true } });
  let attempted; let validation; let notice; let saved = false;
  const context = vm.createContext({ module: { exports: null }, crypto: globalThis.crypto, nextActionFor: fixture, createOperationalAppointment: async (input) => { attempted = input; try { repo.agendaMappers.editableRow(input); } catch (error) { validation = error.message; throw error; } saved = true; return input; }, updateOperationalAppointment: async () => {}, setNextActionFor() {}, load: async () => {}, pushMessage: (message) => { notice = message; } });
  vm.runInContext(ts.transpileModule(`${zonedUtc}\nmodule.exports = ${handler}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  await context.module.exports({ title: 'Ligar para contato sintético', date: '2026-10-06', time: '10:00' });
  add('T-UI-009', 'Agenda: Criar próxima ação deve produzir compromisso válido', 'Fim posterior ao início e criação confirmada', { startsAt: attempted?.startsAt, endsAt: attempted?.endsAt, validation, notice, saved }, saved);
}
{
  const content = source('src/pages/dashboard/busca-leads/page.tsx');
  const ast = ts.createSourceFile('busca.tsx', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let handler;
  const visit = (node) => { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'executarBusca') handler = node.initializer.getText(ast); ts.forEachChild(node, visit); }; visit(ast);
  if (!handler) throw new Error('Search handler not found');
  const fonte = { id: 'synthetic-apify', nome: 'Apify', sourceKey: 'apify' }; let calls = 0; let error;
  const context = vm.createContext({ module: { exports: null }, fontes: [fonte], fontesDisponiveis: [fonte], fonteSelecionada: fonte.id, operationalMode: 'real', cidade: 'São Paulo', termosAplicados: [], historicoAberto: false, setPreview() {}, setSelecionados() {}, setErroBusca: (value) => { error = value; }, mensagemBuscaReal: (code) => code, setBuscando() {}, setExecucaoAtual() {}, setFaseBusca() {}, supabase: { functions: { invoke: async () => { calls++; throw new Error('Unexpected network attempt'); } } } });
  vm.runInContext(ts.transpileModule(`module.exports = ${handler}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  await context.module.exports(10);
  add('T-UI-010', 'Busca: handler impede consultar provedor sem termos', { apiCalls: 0, error: 'prospecting_terms_required' }, { apiCalls: calls, error }, calls === 0 && error === 'prospecting_terms_required');
}
{
  const content = source('src/components/feature/CommercialAnalytics.tsx');
  const ast = ts.createSourceFile('analytics.tsx', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); let expression;
  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node) && node.properties.some((prop) => ts.isPropertyAssignment(prop) && prop.name.getText(ast) === 'title' && prop.initializer.getText(ast) === "'Mensagens hoje'")) {
      expression = node.properties.find((prop) => ts.isPropertyAssignment(prop) && prop.name.getText(ast) === 'value').initializer.getText(ast);
    }
    ts.forEachChild(node, visit);
  }; visit(ast);
  if (!expression) throw new Error('Dashboard metric not found');
  const context = vm.createContext({ module: { exports: null }, metric: (value) => value, analytics: { days: [{ key: '2026-10-04', recebidas: 3, enviadas: 2 }, { key: '2026-10-05', recebidas: 1, enviadas: 1 }] } });
  vm.runInContext(ts.transpileModule(`module.exports = ${expression}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  add('T-UI-011', 'Indicador rotulado Mensagens hoje representa apenas o dia corrente', 2, context.module.exports, context.module.exports === 2);
}
console.log(JSON.stringify({ evidence: 'EV-UI-001', executedAt: new Date().toISOString(), commit: '847048429a86294aa10fa54ffdd750c04447d4fb', fixtures: 'A/B sintéticos; stubs locais; nenhum acesso ao backend', hashes, results }, null, 2));
// A failing contract is evidence, never silently converted into test success.
process.exitCode = results.some((result) => result.status === 'REPROVADO') ? 1 : 0;
