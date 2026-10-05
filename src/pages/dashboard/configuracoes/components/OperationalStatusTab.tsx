import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  activateRealEnvironment,
  activateServerScheduler,
  loadOperationalStatus,
  setOperationalKillSwitch,
  type OperationalCheck,
  type OperationalIntegration,
  type OperationalStatus,
} from '@/lib/crm/operationalDiagnosticsRepository';

type HealthState = 'validated' | 'pending' | 'stale' | 'error' | 'not_configured' | 'validating';
type UsageState = 'active' | 'disabled' | 'blocked';
type ComponentGroup = 'Automação' | 'Atendimento' | 'Inteligência e prospecção';

interface ComponentDefinition {
  id: string;
  group: ComponentGroup;
  label: string;
  description: string;
  icon: string;
  keys?: string[];
  checkIds?: string[];
  href?: string;
  action?: 'scheduler' | 'whatsapp';
}

interface ComponentRow extends ComponentDefinition {
  health: HealthState;
  usage: UsageState;
  lastValidatedAt: string | null;
  detail: string;
  integration: OperationalIntegration | null;
  check: OperationalCheck | null;
}

const COMPONENTS: ComponentDefinition[] = [
  { id: 'automation-scheduler', group: 'Automação', label: 'Agendador de automações', description: 'Executa tarefas programadas.', icon: 'ri-calendar-schedule-line', keys: ['scheduler'], checkIds: ['scheduler'], action: 'scheduler' },
  { id: 'automation-worker', group: 'Automação', label: 'Worker 24/7', description: 'Processa tarefas em segundo plano.', icon: 'ri-settings-5-line', keys: ['scheduler'], checkIds: ['scheduler'], action: 'scheduler' },
  { id: 'whatsapp', group: 'Atendimento', label: 'WhatsApp', description: 'Envia e recebe mensagens pelo provedor ativo.', icon: 'ri-whatsapp-line', keys: ['whatsapp_evolution_go:', 'whatsapp_meta', 'whatsapp'], checkIds: ['whatsapp'], href: '/dashboard/configuracoes?tab=canais' },
  { id: 'evolution-go', group: 'Atendimento', label: 'Evolution GO', description: 'Canal principal de mensagens e instâncias individuais da operação.', icon: 'ri-whatsapp-line', keys: ['whatsapp_evolution_go:', 'whatsapp'], checkIds: ['whatsapp'], href: '/dashboard/configuracoes?tab=canais#evolution-go-configuration' },
  { id: 'email', group: 'Atendimento', label: 'E-mail', description: 'Envia mensagens transacionais.', icon: 'ri-mail-line', keys: ['email', 'resend'], href: '/dashboard/configuracoes?tab=canais' },
  { id: 'evolution-go-webhook', group: 'Atendimento', label: 'Webhook Evolution GO', description: 'Recebe eventos do canal e respostas dos leads; é registrado durante o provisionamento seguro.', icon: 'ri-webhook-line', keys: ['evolution_go_webhook'], checkIds: ['whatsapp_webhook'], href: '/dashboard/configuracoes?tab=canais#evolution-go-configuration' },
  { id: 'resend-webhook', group: 'Atendimento', label: 'Webhook Resend', description: 'Recebe eventos de e-mail.', icon: 'ri-share-line', keys: ['resend_webhook'] },
  { id: 'ana', group: 'Inteligência e prospecção', label: 'Ana', description: 'Assistente de atendimento e qualificação.', icon: 'ri-robot-2-line', checkIds: ['ia', 'whatsapp', 'whatsapp_webhook', 'scheduler'], href: '/dashboard/configuracoes?tab=ana' },
  { id: 'apify', group: 'Inteligência e prospecção', label: 'Apify / Google Maps', description: 'Busca empresas para prospecção.', icon: 'ri-map-pin-search-line', keys: ['apify'], href: '/dashboard/configuracoes?tab=apis' },
  { id: 'cnpj-ws', group: 'Inteligência e prospecção', label: 'CNPJ.ws', description: 'Consulta dados empresariais.', icon: 'ri-building-4-line', keys: ['cnpj_ws'], href: '/dashboard/configuracoes?tab=apis' },
  { id: 'google-places', group: 'Inteligência e prospecção', label: 'Google Places', description: 'Enriquece locais e categorias.', icon: 'ri-map-pin-line', keys: ['google_places'], href: '/dashboard/configuracoes?tab=apis' },
  { id: 'google-calendar', group: 'Inteligência e prospecção', label: 'Google Calendar', description: 'Sincroniza compromissos.', icon: 'ri-calendar-line', keys: ['google_calendar'], href: '/dashboard/configuracoes?tab=apis' },
];

const HEALTH_COPY: Record<HealthState, { label: string; className: string; icon: string }> = {
  validated: { label: 'Validado', className: 'is-positive', icon: 'ri-checkbox-circle-fill' },
  pending: { label: 'Validação pendente', className: 'is-attention', icon: 'ri-error-warning-fill' },
  stale: { label: 'Validação vencida', className: 'is-attention', icon: 'ri-time-line' },
  error: { label: 'Falha de conexão', className: 'is-critical', icon: 'ri-close-circle-fill' },
  not_configured: { label: 'Não configurado', className: 'is-neutral', icon: 'ri-subtract-line' },
  validating: { label: 'Validando…', className: 'is-validating', icon: 'ri-loader-4-line' },
};

const USAGE_COPY: Record<UsageState, string> = { active: 'Ativo', disabled: 'Desativado', blocked: 'Bloqueado' };

function formatDate(value: string | null): string {
  if (!value) return 'Sem validação';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data indisponível';
}

function integrationHealth(item: OperationalIntegration | null): HealthState {
  if (!item) return 'not_configured';
  if (item.lastError) return 'error';
  if (item.health === 'online') return 'validated';
  if (item.health === 'stale') return 'stale';
  return item.enabled ? 'pending' : 'not_configured';
}

function checkHealth(check: OperationalCheck | null): HealthState {
  if (!check) return 'not_configured';
  return check.ok ? 'validated' : 'pending';
}

function usageFor(item: OperationalIntegration | null, health: HealthState, blocked = false): UsageState {
  if (blocked) return 'blocked';
  if (!item) return 'disabled';
  return item.enabled && health === 'validated' ? 'active' : 'disabled';
}

export default function OperationalStatusTab() {
  const [status, setStatus] = useState<OperationalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [settingUp, setSettingUp] = useState<'scheduler' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'attention' | 'disabled'>('all');
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setStatus(await loadOperationalStatus()); setError(''); }
    catch { setError('Não foi possível consultar o estado operacional. Nenhum dado foi alterado.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void refresh();
    const listener = () => { void refresh(); };
    window.addEventListener('wayflex:refresh-operational-status', listener);
    return () => window.removeEventListener('wayflex:refresh-operational-status', listener);
  }, [refresh]);

  const integrationByKeys = useCallback((keys: string[] | undefined): OperationalIntegration | null => {
    if (!status || !keys) return null;
    return keys.map((key) => status.integrations.find((item) => item.key === key || (key.endsWith(':') && item.key.startsWith(key)))).find(Boolean) || null;
  }, [status]);

  const rows = useMemo<ComponentRow[]>(() => {
    if (!status) return [];
    const getCheck = (ids: string[] | undefined) => ids?.map((id) => status.checks.find((item) => item.id === id)).find(Boolean) || null;
    return COMPONENTS.map((definition) => {
      const integration = integrationByKeys(definition.keys);
      const check = getCheck(definition.checkIds);
      const checkList = definition.checkIds?.map((id) => status.checks.find((item) => item.id === id)).filter(Boolean) as OperationalCheck[] | undefined;
      const isAna = definition.id === 'ana';
      const allAnaChecksOk = isAna && Boolean(checkList?.length) && checkList?.every((item) => item.ok);
      const health: HealthState = isAna
        ? allAnaChecksOk ? 'validated' : checkList?.some((item) => item.detail.toLowerCase().includes('falha')) ? 'error' : 'pending'
        : definition.checkIds?.length ? checkHealth(check) : integrationHealth(integration);
      const usage: UsageState = isAna
        ? allAnaChecksOk ? 'active' : 'blocked'
        : usageFor(integration, health, false);
      const lastValidatedAt = integration?.lastTestedAt || (check?.ok ? status.updatedAt : null);
      const detail = check?.detail || integration?.detail || definition.description;
      return { ...definition, health, usage, lastValidatedAt, detail, integration, check };
    });
  }, [integrationByKeys, status]);

  const attentionCount = rows.filter((row) => row.health !== 'validated').length;
  const filteredRows = rows.filter((row) => {
    const normalized = search.trim().toLocaleLowerCase();
    if (normalized && !`${row.label} ${row.description} ${row.detail}`.toLocaleLowerCase().includes(normalized)) return false;
    if (filter === 'active') return row.usage === 'active';
    if (filter === 'attention') return row.health !== 'validated';
    if (filter === 'disabled') return row.usage === 'disabled';
    return true;
  });
  const groupedRows = (['Automação', 'Atendimento', 'Inteligência e prospecção'] as ComponentGroup[]).map((group) => ({ group, rows: filteredRows.filter((row) => row.group === group) })).filter((item) => item.rows.length > 0);

  const changeKillSwitch = async () => {
    if (!status || changing) return;
    const next = !status.killSwitch;
    const message = next
      ? 'Pausar todas as automações agora? O servidor confirmará a alteração e nenhuma nova ação automática será liberada enquanto a pausa estiver ativa.'
      : 'Liberar as automações agora? Os demais requisitos continuarão sendo verificados pelo servidor.';
    if (!window.confirm(message)) return;
    setChanging(true); setError('');
    try { setStatus(await setOperationalKillSwitch(next)); setNotice(next ? 'Automações pausadas pelo controle global.' : 'Automações liberadas pelo controle global.'); }
    catch { setError('A pausa global não foi atualizada. O estado anterior foi preservado.'); }
    finally { setChanging(false); }
  };

  const prepareRealEnvironment = async () => {
    if (!status || changing) return;
    if (!window.confirm('Verificar e preparar o Ambiente Real? O servidor aplicará somente as etapas internas seguras.')) return;
    setChanging(true); setError('');
    try { const result = await activateRealEnvironment(); setStatus(result.status); setNotice(result.message); }
    catch { setError('Não foi possível concluir a preparação. As proteções atuais foram preservadas.'); }
    finally { setChanging(false); }
  };

  const setupScheduler = async () => {
    if (settingUp) return;
    setSettingUp('scheduler'); setError('');
    try { const result = await activateServerScheduler(); setStatus(result.status); setNotice(result.message); }
    catch { setError('Não foi possível preparar o worker server-side. Nenhuma automação foi liberada.'); }
    finally { setSettingUp(null); setOpenMenu(null); }
  };

  if (loading) return <div className="cc-operational-loading"><i className="ri-loader-4-line animate-spin" />Consultando o estado operacional real…</div>;
  if (!status) return <div className="cc-operational-empty"><i className="ri-error-warning-line" /><strong>Estado operacional indisponível</strong><span>{error || 'Atualize o status para consultar os componentes da empresa.'}</span><button type="button" className="wf-btn-secondary text-xs" onClick={() => void refresh()}><i className="ri-refresh-line" />Atualizar status</button></div>;

  return (
    <div className="cc-operational space-y-4">
      {error && <div className="cc-operational-feedback is-error" role="alert"><i className="ri-error-warning-line" />{error}</div>}
      {notice && <div className="cc-operational-feedback is-success" role="status"><i className="ri-checkbox-circle-line" />{notice}</div>}

      <section className="cc-operational-overview" aria-label="Visão operacional">
        <div className="cc-operational-overview-item cc-operational-environment"><span className="cc-operational-overview-icon"><i className="ri-checkbox-circle-fill" /></span><div><span className="cc-operational-label">Ambiente</span><strong>{status.mode === 'real' ? 'Ambiente real' : 'Ambiente em preparação'}</strong></div></div>
        <div className="cc-operational-overview-item"><span className="cc-operational-label">Automação global</span><strong>{status.productionReady ? 'Pronta para operar' : 'Protegida por validações'}</strong><span className="cc-operational-muted">Só executa quando os canais e a IA estão validados.</span></div>
        <div className="cc-operational-pause"><div><span className="cc-operational-label">Pausar automações</span><span className="cc-operational-muted">{status.killSwitch ? 'Pausa ativa' : 'Não pausada'}</span></div><button type="button" role="switch" aria-checked={status.killSwitch} aria-label={status.killSwitch ? 'Retomar automações' : 'Pausar automações'} onClick={() => void changeKillSwitch()} disabled={changing} className={`cc-operational-switch ${status.killSwitch ? 'is-on' : ''}`}><span /></button><Link to="#automation-pause" className="cc-operational-impact">Ver impacto</Link></div>
      </section>

      {attentionCount > 0 && <section className="cc-operational-alert" role="status"><i className="ri-error-warning-fill" /><div><strong>{attentionCount} componentes exigem atenção</strong><span>Valide as conexões antes de ativar automações externas.</span></div><a href="#cc-operational-components" className="cc-operational-alert-action">Abrir diagnóstico</a></section>}

      <section id="cc-operational-components" className="cc-operational-card" aria-labelledby="cc-operational-components-title">
        <div className="cc-operational-card-header"><div><h2 id="cc-operational-components-title">Componentes e conexões</h2><p>Ative o uso no sistema e acompanhe a saúde de cada integração.</p></div><div className="cc-operational-tools"><div className="cc-operational-filters" role="tablist" aria-label="Filtrar componentes">{([['all', 'Todos'], ['active', 'Ativos'], ['attention', 'Com atenção'], ['disabled', 'Desativados']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? 'is-selected' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div><label className="cc-operational-search"><i className="ri-search-line" /><span className="sr-only">Buscar componente</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar componente" /></label></div></div>
        <div className="cc-operational-table-wrap"><table className="cc-operational-table"><thead><tr><th>Componente</th><th>Descrição</th><th>Saúde da conexão</th><th>Última validação</th><th>Status de uso</th><th><span className="sr-only">Ações</span></th></tr></thead><tbody>{groupedRows.map(({ group, rows: groupRows }) => <>{<tr key={`${group}-heading`} className="cc-operational-group"><th colSpan={6}>{group}</th></tr>}{groupRows.map((row) => <OperationalRow key={row.id} row={row} openMenu={openMenu === row.id} onToggleMenu={() => setOpenMenu(openMenu === row.id ? null : row.id)} onSetupScheduler={() => void setupScheduler()} />)}</>)}{groupedRows.length === 0 && <tr><td colSpan={6} className="cc-operational-no-results">Nenhum componente corresponde aos filtros atuais.</td></tr>}</tbody></table></div>
      </section>

      <section className="cc-operational-card cc-operational-prereqs"><div className="cc-operational-card-header"><div><h2>Pré-requisitos para ativar a Ana</h2><p>A ativação só é liberada quando os requisitos forem concluídos.</p></div><button type="button" className="wf-btn-secondary text-xs" onClick={() => void refresh()}><i className="ri-refresh-line" />Revalidar dependências</button></div><div className="cc-operational-prereq-grid">{[['whatsapp', 'WhatsApp validado', status.checks.find((item) => item.id === 'whatsapp')], ['ia', 'IA validada', status.checks.find((item) => item.id === 'ia')], ['scheduler', 'Worker ativo', status.checks.find((item) => item.id === 'scheduler')]].map(([id, label, check]) => <div key={id as string} className={`cc-operational-prereq ${(check as OperationalCheck | undefined)?.ok ? 'is-ready' : ''}`}><i className={(check as OperationalCheck | undefined)?.ok ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'} /><div><strong>{label as string}</strong><span>{(check as OperationalCheck | undefined)?.ok ? 'Concluído' : 'Pendente'}</span></div></div>)}</div></section>

      <section id="automation-pause" className="cc-operational-audit"><div><p className="cc-operational-label">Auditoria recente</p><h2>{status.killSwitch ? 'Automações pausadas' : status.productionReady ? 'Operação pronta' : 'Validações em andamento'}</h2><p>Ativações, pausas e validações ficam registradas no Registro do Sistema.</p></div><div className="cc-operational-audit-facts"><span><i className="ri-time-line" />Status atualizado<br /><strong>{formatDate(status.updatedAt || status.runtimeUpdatedAt)}</strong></span><span><i className="ri-shield-check-line" />Proteção de dados<br /><strong>Conforme política da empresa</strong></span><Link to="/dashboard/configuracoes?tab=registro">Abrir registro <i className="ri-arrow-right-line" /></Link></div></section>

      {!status.productionReady && <div className="cc-operational-prepare"><button type="button" onClick={() => void prepareRealEnvironment()} disabled={changing} className="wf-btn-primary text-xs"><i className={changing ? 'ri-loader-4-line animate-spin' : 'ri-shield-check-line'} />{changing ? 'Verificando…' : 'Verificar preparação do Ambiente Real'}</button><span>O servidor confirma cada dependência; nenhuma credencial é exibida nesta tela.</span></div>}
    </div>
  );
}

function OperationalRow({ row, openMenu, onToggleMenu, onSetupScheduler }: { row: ComponentRow; openMenu: boolean; onToggleMenu: () => void; onSetupScheduler: () => void }) {
  const health = HEALTH_COPY[row.health];
  return <tr className={row.id === 'ana' ? 'cc-operational-row-ana' : undefined}>
    <td><div className="cc-operational-component"><span className="cc-operational-component-icon"><i className={row.icon} /></span><strong>{row.label}</strong></div></td>
    <td><span className="cc-operational-description">{row.description}</span></td>
    <td><span className={`cc-operational-health ${health.className}`}><i className={health.icon} />{health.label}</span></td>
    <td><span className="cc-operational-date">{formatDate(row.lastValidatedAt)}</span></td>
    <td><span className="cc-operational-usage"><span className={`cc-operational-switch cc-operational-switch-small ${row.usage === 'active' ? 'is-on' : ''} ${row.usage === 'blocked' ? 'is-blocked' : ''}`}><span /></span><strong>{USAGE_COPY[row.usage]}</strong>{row.usage === 'blocked' && <i className="ri-information-line" title="Bloqueado até que as dependências sejam validadas." />}</span></td>
    <td className="cc-operational-actions"><div className="cc-operational-menu"><button type="button" aria-label={`Ações de ${row.label}`} aria-expanded={openMenu} onClick={onToggleMenu}><i className="ri-more-2-fill" /></button>{openMenu && <div className="cc-operational-menu-popover"><span>{row.detail}</span>{row.action === 'scheduler' && row.health !== 'validated' && <button type="button" onClick={onSetupScheduler}><i className="ri-play-circle-line" />Preparar worker</button>}{row.href && <Link to={row.href}><i className="ri-settings-3-line" />Abrir configuração</Link>}</div>}</div></td>
  </tr>;
}
