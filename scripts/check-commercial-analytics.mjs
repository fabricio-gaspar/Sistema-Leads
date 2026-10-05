// Deterministic, network-free smoke checks of the actual TypeScript domain modules.
// This complements Vitest; it does not claim complete UI or integration coverage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const cache = new Map();
function load(relative) {
  const file = resolve(root, relative.endsWith('.ts') ? relative : `${relative}.ts`);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} }; cache.set(file, module.exports);
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const localRequire = (name) => name.startsWith('@/') ? load(`src/${name.slice(2)}`) : name.startsWith('.') ? load(resolve(dirname(file), name)) : require(name);
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports);
  return module.exports;
}
const domain = load('src/domain/commercialAnalytics');
const pricing = load('src/domain/proposalPricing');
const { readAllPages } = load('src/lib/crm/paginatedRead');
const now = new Date('2026-09-27T15:00:00Z');
const lead = (id, patch = {}) => ({ id, nome: 'Fixture', empresa: 'Fixture', tags: [], segmento: 'Teste', origem: 'Fixture', responsavel: 'Fixture', responsavelId: 'fixture-owner', modoAtendimento: 'HUMANO', etapa: 'Novo', criadoEm: '2026-09-25', ...patch });
const proposal = (id, patch = {}) => ({ id, leadId: '1', valor: 1000, descontoPct: 10, status: 'enviada', data: '2026-09-25', itens: [], ...patch });
const analyse = (leads, proposals = [], events = [], contacts = []) => domain.buildCommercialAnalytics(leads, proposals, domain.initialAnalyticsFilters, events, contacts, now);
const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); console.log(`PASS ${name}`); };
await check('Revisão não entra no pipeline', () => { const result = analyse([lead('1', { responsavelId: '' })]); assert.equal(result.pipeline.length, 0); assert.equal(result.conversion, null); });
await check('Contato pendente não retira lead atribuído', () => assert.equal(domain.isCommercialLead(lead('1', { contactApprovalStatus: 'pending' })), true));
await check('Arquivados não entram nos indicadores', () => assert.equal(analyse([lead('1', { arquivado: true })]).cohort.length, 0));
await check('Ganhos e perdas permanecem distintos', () => { const result = analyse([lead('1', { etapa: 'Ganho' }), lead('2', { etapa: 'Perdido' })]); assert.equal(result.conversion, 50); assert.equal(result.active.length, 0); });
await check('Base zero não gera percentual', () => { assert.equal(domain.percentage(0, 0), null); assert.equal(domain.variation(5, 0), null); });
await check('Janela inclusiva e comparação sem sobreposição', () => assert.deepEqual(domain.analyticsWindow('7', now), { start: '2026-09-21', end: '2026-09-27', previousStart: '2026-09-14', previousEnd: '2026-09-20', length: 7 }));
await check('Fuso de São Paulo preserva a data do cadastro', () => assert.equal(domain.dateKey('2026-09-27T01:00:00Z'), '2026-09-26'));
await check('Ano bissexto preservado', () => assert.equal(domain.analyticsWindow('year', new Date('2024-12-31T15:00:00Z')).length, 366));
await check('Desconto aplicado uma vez e arredondado em centavos', () => { assert.equal(domain.proposalNet(proposal('p')), 900); assert.equal(domain.proposalNet(proposal('p', { valor: 19.99, descontoPct: 12.5 })), 17.49); });
await check('Rascunho não infla previsão, aceite é separado', () => { const result = analyse([lead('1')], [proposal('p'), proposal('d', { status: 'rascunho' }), proposal('a', { status: 'aceita' })]); assert.equal(result.expectedValue, 900); assert.equal(result.acceptedValue, 900); });
await check('Totais por origem incluem propostas de leads antigos', () => { const result = analyse([lead('1', { criadoEm: '2026-01-01', origem: 'Antiga' })], [proposal('a', { status: 'aceita' })]); assert.equal(result.origins.reduce((sum, row) => sum + row.aceito, 0), result.acceptedValue); });
await check('Backlog independe da idade do cadastro', () => { const result = analyse([lead('1', { criadoEm: '2026-01-01', responsavelId: '' })]); assert.equal(result.pending.length, 0); assert.equal(result.reviewBacklog.length, 1); });
await check('Falha e fila não são envios aceitos', () => { const contacts = ['queued', 'failed', 'internal', 'sent'].map((type) => ({ id: type, lead_id: '1', sender: 'seller', type, created_at: '2026-09-25T12:00:00Z', sent_at: type === 'sent' ? '2026-09-25T12:00:00Z' : null })); assert.equal(analyse([lead('1')], [], [], contacts).days.reduce((sum, day) => sum + day.enviadas, 0), 1); });
await check('Etapa atual não inventa conversão histórica', () => assert.ok(analyse([lead('1', { etapa: 'Ganho' })]).progression.every((row) => row.rate === null)));
await check('Preço desconhecido não é gratuidade', () => { assert.equal(pricing.confirmedUnitPrice(0), null); assert.equal(pricing.confirmedUnitPrice(0, '0'), 0); assert.equal(pricing.confirmedUnitPrice(100, ''), null); assert.equal(pricing.confirmedUnitPrice(100, '-1'), null); });
await check('Paginação aceita limite menor do servidor', async () => { const source = [1, 2, 3, 4, 5]; assert.deepEqual(await readAllPages(async (from) => ({ data: source.slice(from, from + 2), error: null })), source); });
await check('Página com falha não retorna total parcial', async () => assert.rejects(readAllPages(async (from) => from ? { data: null, error: new Error('offline') } : { data: [1], error: null }), /offline/));
console.log(`${checks.length} verificações determinísticas concluídas; sem rede ou dados operacionais.`);
