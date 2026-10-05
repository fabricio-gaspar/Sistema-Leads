import { escapeCsvCell } from '@/lib/csv';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AccessibleDialog from '@/components/feature/AccessibleDialog';
import FilterChips from '@/components/feature/FilterChips';
import type { FilterChip } from '@/components/feature/FilterChips';
import InfoTooltip from '@/components/feature/InfoTooltip';
import { useAuth } from '@/hooks/useAuth';
import { refreshLeadsStore, useLeadsStore, useLeadsLoadStatus, waitForLeadsPersistence } from '@/hooks/useLeadsStore';
import { useTarefasStore, waitForTarefasPersistence } from '@/hooks/useTarefasStore';
import { useCurrentAccess } from '@/hooks/useCurrentAccess';
import { useFluxosAutomatizacaoStore } from '@/hooks/useFluxosAutomatizacaoStore';
import type { Lead } from '@/mocks/leadsData';
import { loadTeamMembers, type TeamMember } from '@/lib/crm/teamMembersRepository';
import { runOperationalAutomations } from '@/lib/crm/automationRepository';
import {
  createKanbanSavedView,
  deleteKanbanSavedView,
  initialKanbanPortfolioFilters,
  loadKanbanAutomationRuns,
  loadKanbanPortfolio,
  loadKanbanSavedViews,
  loadKanbanStageAlertThresholds,
  renameKanbanSavedView,
  setDefaultKanbanSavedView,
  updateKanbanSavedView,
  updateKanbanStageAlertThreshold,
  type KanbanAutomationRun,
  type KanbanPortfolioFilters,
  type KanbanPortfolioItem,
  type KanbanQuickFilter,
  type KanbanSavedView,
  type KanbanSort,
  type KanbanStageAlertThreshold,
} from '@/lib/crm/kanbanRepository';
import {
  canonicalStageKeys,
  CommercialTransitionError,
  transitionOperationalLeadStage,
  undoRecentOperationalLeadStageTransition,
  type CanonicalStageKey,
} from '@/lib/crm/leadStageRepository';
import KanbanViewsMenu from './components/KanbanViewsMenu';
import LeadDrawer from './components/LeadDrawer';

const PAGE_SIZE = 40;
const BOARD_LIMIT = 200;

const stageLabels: Record<CanonicalStageKey, string> = {
  novo: 'Novo',
  apresentado: 'Apresentado',
  qualificando: 'Qualificando',
  reuniao: 'Reunião',
  orcamento: 'Orçamento',
  ganho: 'Ganho',
  perdido: 'Perdido',
};

const stageDot: Record<CanonicalStageKey, string> = {
  novo: 'bg-foreground-400',
  apresentado: 'bg-primary-500',
  qualificando: 'bg-primary-600',
  reuniao: 'bg-secondary-500',
  orcamento: 'bg-amber-500',
  ganho: 'bg-primary-700',
  perdido: 'bg-foreground-500',
};

const stageBadge: Record<CanonicalStageKey, string> = {
  novo: 'bg-background-200 text-foreground-700',
  apresentado: 'bg-primary-100 text-primary-800',
  qualificando: 'bg-primary-100 text-primary-800',
  reuniao: 'bg-secondary-100 text-secondary-800',
  orcamento: 'bg-amber-100 text-amber-900',
  ganho: 'bg-primary-600 text-white',
  perdido: 'bg-background-300 text-foreground-600',
};

type ViewMode = 'kanban' | 'list';
type ViewConfiguration = { filters: KanbanPortfolioFilters; mode: ViewMode };
type OutcomeTarget = { item: KanbanPortfolioItem; stage: 'ganho' | 'perdido' };
type UndoTarget = { item: KanbanPortfolioItem; stage: CanonicalStageKey; expiresAt: number };

function safeNumber(value: string | null): string {
  return value && /^\d{1,4}$/.test(value) ? value : '';
}

function filtersFromUrl(params: URLSearchParams): KanbanPortfolioFilters {
  const sort = params.get('sort');
  const quick = params.get('quick');
  return {
    ...initialKanbanPortfolioFilters,
    query: params.get('q') || '',
    ownerId: params.get('owner') || '',
    segment: params.get('segment') || '',
    city: params.get('city') || '',
    uf: (params.get('uf') || '').toUpperCase().slice(0, 2),
    origin: params.get('origin') || '',
    listId: params.get('list') || '',
    scoreMin: safeNumber(params.get('scoreMin')),
    scoreMax: safeNumber(params.get('scoreMax')),
    contact: (params.get('contact') as KanbanPortfolioFilters['contact']) || '',
    nextAction: (params.get('action') as KanbanPortfolioFilters['nextAction']) || '',
    inactiveDays: safeNumber(params.get('inactive')),
    stageDays: safeNumber(params.get('stageDays')),
    enteredFrom: params.get('from') || '',
    enteredTo: params.get('to') || '',
    contactApproval: (params.get('approval') as KanbanPortfolioFilters['contactApproval']) || '',
    quick: (['mine', 'overdue', 'without_contact', 'without_action', 'high_fit'].includes(quick || '') ? quick : '') as KanbanQuickFilter,
    duplicatesOnly: params.get('duplicates') === '1',
    showClosed: params.get('closed') === '1',
    sort: (['next_action', 'fit', 'stage_age', 'updated', 'company'].includes(sort || '') ? sort : 'next_action') as KanbanSort,
  };
}

function formatDate(value: string | null | undefined, fallback = 'Sem prazo'): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function updateText(value: string | null | undefined): string {
  if (!value) return 'Atualização não registrada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Atualização não registrada';
  const difference = Date.now() - date.getTime();
  if (difference >= 0 && difference < 86_400_000) return `Atualizado hoje, ${formatDate(value)}`;
  return `Atualizado em ${formatDate(value)}`;
}

function stageAgeText(value: string | null): string {
  if (!value) return 'Entrada na etapa não registrada';
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  if (!Number.isFinite(hours)) return 'Entrada na etapa não registrada';
  return hours < 24 ? `Há ${Math.max(1, hours)}h nesta etapa` : `Há ${Math.floor(hours / 24)} dia${Math.floor(hours / 24) === 1 ? '' : 's'} nesta etapa`;
}

function isStageAlert(item: KanbanPortfolioItem): boolean {
  if (!item.stageEnteredAt || !item.stageAlertAfterHours) return false;
  return Date.now() - new Date(item.stageEnteredAt).getTime() >= item.stageAlertAfterHours * 3_600_000;
}

function contactLabel(lead: Lead): { text: string; className: string } {
  const hasPhone = Boolean((lead.telefone || '').replace(/\D/g, ''));
  const hasWhatsApp = Boolean((lead.whatsapp || '').replace(/\D/g, ''));
  if (hasWhatsApp) return { text: 'WhatsApp identificado', className: 'bg-primary-50 text-primary-800' };
  if (hasPhone) return { text: 'Telefone identificado', className: 'bg-background-200 text-foreground-700' };
  if (lead.email) return { text: 'E-mail encontrado', className: 'bg-secondary-100 text-secondary-800' };
  return { text: 'Sem contato', className: 'bg-amber-100 text-amber-900' };
}

function originLabel(value: string): string {
  if (!value) return 'Origem não informada';
  if (/apify|google|busca/i.test(value)) return 'Busca de leads';
  if (/csv/i.test(value)) return 'CSV';
  if (/manual/i.test(value)) return 'Manual';
  return value;
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase() || '?';
}

function chipsFor(filters: KanbanPortfolioFilters, setFilters: (updater: (previous: KanbanPortfolioFilters) => KanbanPortfolioFilters) => void): FilterChip[] {
  const remove = <K extends keyof KanbanPortfolioFilters>(key: K, value: KanbanPortfolioFilters[K]) => () => setFilters((previous) => ({ ...previous, [key]: value, quick: key === 'quick' ? '' : previous.quick }));
  const contactText: Record<string, string> = { with_phone: 'Com telefone', without_phone: 'Sem telefone', whatsapp: 'WhatsApp', with_email: 'Com e-mail', without_email: 'Sem e-mail', without_contact: 'Sem contato' };
  const quickText: Record<Exclude<KanbanQuickFilter, ''>, string> = { mine: 'Meus leads', overdue: 'Atrasados', without_contact: 'Sem contato', without_action: 'Sem próxima ação', high_fit: 'Alta aderência' };
  return [
    filters.query ? { label: 'Busca', value: filters.query, onRemove: remove('query', '') } : null,
    filters.quick ? { label: 'Visão rápida', value: quickText[filters.quick], onRemove: remove('quick', '') } : null,
    filters.ownerId ? { label: 'Responsável', value: 'Aplicado', onRemove: remove('ownerId', '') } : null,
    filters.segment ? { label: 'Segmento', value: filters.segment, onRemove: remove('segment', '') } : null,
    filters.city ? { label: 'Cidade', value: filters.city, onRemove: remove('city', '') } : null,
    filters.uf ? { label: 'UF', value: filters.uf, onRemove: remove('uf', '') } : null,
    filters.origin ? { label: 'Origem', value: filters.origin, onRemove: remove('origin', '') } : null,
    filters.listId ? { label: 'Lista', value: 'Aplicada', onRemove: remove('listId', '') } : null,
    filters.contact ? { label: 'Contato', value: contactText[filters.contact], onRemove: remove('contact', '') } : null,
    filters.nextAction ? { label: 'Próxima ação', value: filters.nextAction === 'overdue' ? 'Atrasada' : 'Sem ação', onRemove: remove('nextAction', '') } : null,
    filters.scoreMin || filters.scoreMax ? { label: 'Aderência', value: `${filters.scoreMin || '0'}–${filters.scoreMax || '100'}`, onRemove: () => setFilters((previous) => ({ ...previous, scoreMin: '', scoreMax: '' })) } : null,
    filters.inactiveDays ? { label: 'Sem interação', value: `${filters.inactiveDays} dias`, onRemove: remove('inactiveDays', '') } : null,
    filters.stageDays ? { label: 'Tempo na etapa', value: `${filters.stageDays} dias`, onRemove: remove('stageDays', '') } : null,
    filters.enteredFrom || filters.enteredTo ? { label: 'Entrada', value: [filters.enteredFrom, filters.enteredTo].filter(Boolean).join(' até '), onRemove: () => setFilters((previous) => ({ ...previous, enteredFrom: '', enteredTo: '' })) } : null,
    filters.contactApproval ? { label: 'Autorização', value: filters.contactApproval === 'approved' ? 'Aprovada' : filters.contactApproval === 'rejected' ? 'Recusada' : 'Pendente', onRemove: remove('contactApproval', '') } : null,
    filters.duplicatesOnly ? { label: 'Duplicidade', value: 'Suspeita', onRemove: remove('duplicatesOnly', false) } : null,
    filters.showClosed ? { label: 'Encerrados', value: 'Visíveis', onRemove: remove('showClosed', false) } : null,
  ].filter((chip): chip is FilterChip => chip !== null);
}

export default function KanbanCRM() {
  const { user } = useAuth();
  const { access, loading: loadingAccess } = useCurrentAccess();
  const loadStatus = useLeadsLoadStatus();
  const [, setLeads] = useLeadsStore();
  const { criar: criarTarefa, alternar: alternarTarefa } = useTarefasStore();
  const { fluxos } = useFluxosAutomatizacaoStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<KanbanPortfolioFilters>(() => filtersFromUrl(searchParams));
  const [queryDraft, setQueryDraft] = useState(() => searchParams.get('q') || '');
  const [viewMode, setViewMode] = useState<ViewMode>(() => searchParams.get('view') === 'list' ? 'list' : 'kanban');
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page') || '1')));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [portfolio, setPortfolio] = useState<{ items: KanbanPortfolioItem[]; total: number; stageCounts: Record<CanonicalStageKey, number>; quickCounts: Record<Exclude<KanbanQuickFilter, ''>, number> } | null>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [views, setViews] = useState<KanbanSavedView<ViewConfiguration>[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [detail, setDetail] = useState<KanbanPortfolioItem | null>(null);
  const [taskLead, setTaskLead] = useState<KanbanPortfolioItem | null>(null);
  const [taskForm, setTaskForm] = useState({ title: '', dueDate: '', priority: 'MEDIA' as 'ALTA' | 'MEDIA' | 'BAIXA' });
  const [outcome, setOutcome] = useState<OutcomeTarget | null>(null);
  const [outcomeReason, setOutcomeReason] = useState('');
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [optimisticMoves, setOptimisticMoves] = useState<Record<string, { from: CanonicalStageKey; to: CanonicalStageKey }>>({});
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragDestination, setDragDestination] = useState<CanonicalStageKey | null>(null);
  const [undo, setUndo] = useState<UndoTarget | null>(null);
  const [toast, setToast] = useState('');
  const [automationOpen, setAutomationOpen] = useState(false);
  const [automationRuns, setAutomationRuns] = useState<KanbanAutomationRun[]>([]);
  const [automationRunsError, setAutomationRunsError] = useState('');
  const [automationRunning, setAutomationRunning] = useState(false);
  const [thresholds, setThresholds] = useState<KanbanStageAlertThreshold[]>([]);
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, string>>({});
  const [thresholdSaving, setThresholdSaving] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<KanbanPortfolioItem | null>(null);
  const navigate = useNavigate();
  const boardRef = useRef<HTMLDivElement>(null);

  const canEditAll = access?.permissions['leads.edit_all'] === true;
  const canAssign = canEditAll;
  const canConfigure = access?.permissions['configuration.manage'] === true;
  const canEdit = (item: KanbanPortfolioItem) => canEditAll || (access?.permissions['leads.edit_assigned'] === true && item.lead.responsavelId === user?.id);

  const currentConfiguration = useMemo<ViewConfiguration>(() => ({ filters, mode: viewMode }), [filters, viewMode]);
  const configurationText = useMemo(() => JSON.stringify(currentConfiguration), [currentConfiguration]);
  const dirtyView = Boolean(activeViewId && savedSnapshot && savedSnapshot !== configurationText);
  const chips = useMemo(() => chipsFor(filters, (updater) => { setFilters((previous) => updater(previous)); setPage(1); }), [filters]);
  const listOffset = viewMode === 'list' ? (page - 1) * PAGE_SIZE : 0;
  const fetchLimit = viewMode === 'list' ? PAGE_SIZE : BOARD_LIMIT;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((previous) => previous.query === queryDraft.trim() ? previous : { ...previous, query: queryDraft.trim() });
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [queryDraft]);

  useEffect(() => {
    const next = new URLSearchParams();
    const add = (key: string, value: string | boolean, fallback = '') => { if (value !== fallback && value !== false) next.set(key, String(value)); };
    add('q', filters.query); add('owner', filters.ownerId); add('segment', filters.segment); add('city', filters.city); add('uf', filters.uf);
    add('origin', filters.origin); add('list', filters.listId); add('scoreMin', filters.scoreMin); add('scoreMax', filters.scoreMax);
    add('contact', filters.contact); add('action', filters.nextAction); add('inactive', filters.inactiveDays); add('stageDays', filters.stageDays);
    add('from', filters.enteredFrom); add('to', filters.enteredTo); add('approval', filters.contactApproval); add('quick', filters.quick);
    add('duplicates', filters.duplicatesOnly ? '1' : ''); add('closed', filters.showClosed ? '1' : ''); add('sort', filters.sort, 'next_action');
    add('view', viewMode, 'kanban'); add('page', String(page), '1');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [filters, page, searchParams, setSearchParams, viewMode]);

  useEffect(() => {
    let active = true;
    setPortfolioLoading(true); setPortfolioError('');
    void loadKanbanPortfolio(filters, listOffset, fetchLimit)
      .then((result) => { if (active) setPortfolio(result); })
      .catch(() => { if (active) { setPortfolio(null); setPortfolioError('Não foi possível consultar o Kanban no servidor. Tente atualizar.'); } })
      .finally(() => { if (active) setPortfolioLoading(false); });
    return () => { active = false; };
  }, [fetchLimit, filters, listOffset, refreshToken]);

  useEffect(() => {
    let active = true;
    void loadTeamMembers().then((members) => { if (active) setTeam(members.filter((member) => member.status === 'active')); }).catch(() => { if (active) setTeam([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void loadKanbanSavedViews<ViewConfiguration>()
      .then((stored) => {
        if (!active) return;
        setViews(stored);
        const defaultView = stored.find((view) => view.isDefault);
        if (!defaultView || searchParams.toString()) return;
        setActiveViewId(defaultView.id); setFilters(defaultView.configuration.filters); setQueryDraft(defaultView.configuration.filters.query); setViewMode(defaultView.configuration.mode); setSavedSnapshot(JSON.stringify(defaultView.configuration));
      })
      .catch(() => { if (active) setViews([]); });
    return () => { active = false; };
  }, [searchParams, user?.id]);

  useEffect(() => {
    if (!automationOpen) return;
    let active = true;
    void Promise.all([loadKanbanAutomationRuns(), loadKanbanStageAlertThresholds()])
      .then(([runs, stageThresholds]) => {
        if (!active) return;
        setAutomationRuns(runs); setAutomationRunsError(''); setThresholds(stageThresholds);
        setThresholdDrafts(Object.fromEntries(stageThresholds.map((threshold) => [threshold.id, String(threshold.alertAfterHours)])));
      })
      .catch(() => { if (active) setAutomationRunsError('O histórico operacional não está disponível para sua sessão.'); });
    return () => { active = false; };
  }, [automationOpen, refreshToken]);

  useEffect(() => {
    if (!undo) return;
    const timeout = window.setTimeout(() => setUndo(null), Math.max(0, undo.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [undo]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 4200);
  };

  const refreshBoard = () => setRefreshToken((value) => value + 1);
  const currentItems = portfolio?.items ?? [];
  const displayStage = (item: KanbanPortfolioItem) => optimisticMoves[item.lead.id]?.to || item.stage;
  const displayCounts = useMemo(() => {
    const counts = { novo: 0, apresentado: 0, qualificando: 0, reuniao: 0, orcamento: 0, ganho: 0, perdido: 0 } as Record<CanonicalStageKey, number>;
    Object.entries(portfolio?.stageCounts ?? {}).forEach(([stage, count]) => { counts[stage as CanonicalStageKey] = count; });
    Object.values(optimisticMoves).forEach((move) => { counts[move.from] = Math.max(0, counts[move.from] - 1); counts[move.to] += 1; });
    return counts;
  }, [optimisticMoves, portfolio?.stageCounts]);

  const move = async (item: KanbanPortfolioItem, target: CanonicalStageKey, reason?: string) => {
    const current = displayStage(item);
    if (current === target) return;
    if (!canEdit(item)) { showToast('Você não tem permissão para alterar este lead.'); return; }
    if (target === 'ganho' || target === 'perdido') {
      setOutcome({ item, stage: target }); setOutcomeReason(reason || ''); return;
    }
    setPendingLeadId(item.lead.id);
    setOptimisticMoves((previous) => ({ ...previous, [item.lead.id]: { from: current, to: target } }));
    try {
      await transitionOperationalLeadStage({ leadId: item.lead.id, stage: target, reason });
      setUndo({ item, stage: target, expiresAt: Date.now() + 30_000 });
      showToast(`${item.lead.nome || item.lead.empresa} movido para ${stageLabels[target]}.`);
      await refreshLeadsStore();
      refreshBoard();
    } catch (error) {
      showToast(error instanceof CommercialTransitionError ? error.message : 'A mudança não foi confirmada no servidor; o cartão foi restaurado.');
    } finally {
      setOptimisticMoves((previous) => { const next = { ...previous }; delete next[item.lead.id]; return next; });
      setPendingLeadId(null);
    }
  };

  const confirmOutcome = async () => {
    if (!outcome || !outcomeReason.trim()) { showToast('Informe o motivo comercial.'); return; }
    const active = outcome; setOutcome(null); setPendingLeadId(active.item.lead.id);
    try {
      await transitionOperationalLeadStage({ leadId: active.item.lead.id, stage: active.stage, reason: outcomeReason.trim() });
      await refreshLeadsStore(); refreshBoard();
      showToast(`${stageLabels[active.stage]} registrado no servidor.`);
    } catch (error) {
      showToast(error instanceof CommercialTransitionError ? error.message : 'Não foi possível concluir o resultado.');
    } finally {
      setPendingLeadId(null); setOutcomeReason('');
    }
  };

  const undoMove = async () => {
    if (!undo) return;
    const target = undo; setUndo(null); setPendingLeadId(target.item.lead.id);
    setOptimisticMoves((previous) => ({ ...previous, [target.item.lead.id]: { from: target.stage, to: target.item.stage } }));
    try {
      await undoRecentOperationalLeadStageTransition({ leadId: target.item.lead.id, expectedStage: target.stage });
      await refreshLeadsStore(); refreshBoard(); showToast('Movimentação desfeita e registrada na auditoria.');
    } catch (error) {
      showToast(error instanceof CommercialTransitionError ? error.message : 'A janela de desfazer expirou ou outro usuário alterou o lead.');
    } finally {
      setOptimisticMoves((previous) => { const next = { ...previous }; delete next[target.item.lead.id]; return next; });
      setPendingLeadId(null);
    }
  };

  const createTask = async () => {
    if (!taskLead || !taskForm.title.trim()) { showToast('Informe a próxima ação.'); return; }
    if (!canEdit(taskLead)) { showToast('Você não tem permissão para criar esta tarefa.'); return; }
    criarTarefa({
      titulo: taskForm.title.trim(),
      leadId: taskLead.lead.id,
      leadNome: taskLead.lead.nome || taskLead.lead.empresa,
      responsavel: taskLead.lead.responsavel || 'Sem responsável',
      responsavelId: taskLead.lead.responsavelId,
      prioridade: taskForm.priority,
      dataLimite: taskForm.dueDate || undefined,
      descricao: '',
    });
    try {
      await waitForTarefasPersistence();
      showToast('Tarefa vinculada ao lead e persistida.'); setTaskLead(null); setTaskForm({ title: '', dueDate: '', priority: 'MEDIA' }); refreshBoard();
    } catch {
      showToast('Não foi possível salvar a tarefa. O estado foi reconciliado com o servidor.');
    }
  };

  const toggleTask = async (taskId: string) => {
    alternarTarefa(taskId);
    try { await waitForTarefasPersistence(); refreshBoard(); } catch { showToast('Não foi possível atualizar a tarefa. O estado foi reconciliado.'); }
  };

  const assign = async (items: KanbanPortfolioItem[], memberId: string) => {
    const member = team.find((candidate) => candidate.userId === memberId);
    if (!member || !canAssign) { showToast('Você não tem permissão para alterar responsáveis.'); return; }
    const ids = new Set(items.map((item) => item.lead.id));
    setLeads((leads) => leads.map((lead) => ids.has(lead.id) ? { ...lead, responsavelId: member.userId, responsavel: member.name } : lead));
    try { await waitForLeadsPersistence(); await refreshLeadsStore(); refreshBoard(); showToast(`${ids.size} lead(s) atribuído(s) a ${member.name}.`); } catch { showToast('Não foi possível confirmar a atribuição. A lista foi reconciliada.'); }
  };

  const archive = async (item: KanbanPortfolioItem) => {
    setLeads((leads) => leads.map((lead) => lead.id === item.lead.id ? { ...lead, arquivado: true } : lead));
    try { await waitForLeadsPersistence(); await refreshLeadsStore(); setDetail(null); refreshBoard(); showToast('Lead arquivado; o histórico comercial foi preservado.'); } catch { showToast('Não foi possível arquivar o lead. A lista foi reconciliada.'); } finally { setArchiveTarget(null); }
  };

  const exportItems = (items: KanbanPortfolioItem[]) => {
    if (!items.length) return;
    const quote = escapeCsvCell;
    const header = ['Nome', 'Empresa', 'Telefone', 'WhatsApp', 'E-mail', 'Segmento', 'Cidade', 'UF', 'Aderência', 'Etapa', 'Responsável', 'Origem'];
    const rows = items.map(({ lead, stage }) => [lead.nome, lead.empresa, lead.telefone, lead.whatsapp, lead.email, lead.segmento, lead.cidade, lead.estado, lead.score, stageLabels[stage], lead.responsavel, lead.origem].map(quote).join(','));
    const url = URL.createObjectURL(new Blob([[header.map(quote).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `wayflex-kanban-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
    showToast(`${items.length} lead(s) exportado(s).`);
  };

  const runAutomations = async () => {
    if (!canConfigure || automationRunning) return;
    if (!window.confirm('Executar a manutenção da automação agora? Itens de fila que já estejam aptos seguem as políticas e os canais configurados.')) return;
    setAutomationRunning(true);
    try {
      const result = await runOperationalAutomations();
      showToast(`Processamento concluído: ${result.sent_jobs || 0} envio(s) aceito(s), ${result.failed_jobs || 0} falha(s).`);
      const runs = await loadKanbanAutomationRuns(); setAutomationRuns(runs); refreshBoard();
    } catch { showToast('A execução manual não foi concluída. Consulte o erro operacional antes de repetir.'); } finally { setAutomationRunning(false); }
  };

  const saveThreshold = async (threshold: KanbanStageAlertThreshold) => {
    const value = Number(thresholdDrafts[threshold.id]);
    if (!Number.isInteger(value) || value < 1 || value > 8760) { showToast('Informe entre 1 e 8760 horas.'); return; }
    setThresholdSaving(threshold.id);
    try {
      await updateKanbanStageAlertThreshold(threshold.id, value);
      setThresholds((all) => all.map((row) => row.id === threshold.id ? { ...row, alertAfterHours: value } : row));
      showToast(`Alerta de ${stageLabels[threshold.stage]} atualizado.`); refreshBoard();
    } catch { showToast('Não foi possível salvar o alerta desta etapa.'); } finally { setThresholdSaving(null); }
  };

  const [selected, setSelected] = useState<string[]>([]); // keeps selection scoped to the current server page
  const selectedItems = currentItems.filter((item) => selected.includes(item.lead.id));
  useEffect(() => { setSelected([]); }, [filters, page, setSelected, viewMode]);

  const updateFilters = (change: Partial<KanbanPortfolioFilters>) => { setFilters((previous) => ({ ...previous, ...change, quick: Object.prototype.hasOwnProperty.call(change, 'quick') ? change.quick as KanbanQuickFilter : previous.quick })); setPage(1); };
  const clearFilters = () => { setFilters(initialKanbanPortfolioFilters); setQueryDraft(''); setPage(1); setActiveViewId(null); setSavedSnapshot(''); };

  const saveView = async (name: string) => {
    const created = await createKanbanSavedView<ViewConfiguration>(name, currentConfiguration);
    const next = [created, ...views]; setViews(next); setActiveViewId(created.id); setSavedSnapshot(JSON.stringify(currentConfiguration)); showToast('Visão salva na sua conta.');
  };
  const updateView = async (id: string) => { await updateKanbanSavedView(id, currentConfiguration); setViews((items) => items.map((item) => item.id === id ? { ...item, configuration: currentConfiguration, updatedAt: new Date().toISOString() } : item)); setSavedSnapshot(JSON.stringify(currentConfiguration)); showToast('Visão atualizada.'); };
  const renameView = async (id: string, name: string) => { await renameKanbanSavedView(id, name); setViews((items) => items.map((item) => item.id === id ? { ...item, name } : item)); showToast('Visão renomeada.'); };
  const deleteView = async (id: string) => { await deleteKanbanSavedView(id); setViews((items) => items.filter((item) => item.id !== id)); if (activeViewId === id) { setActiveViewId(null); setSavedSnapshot(''); } showToast('Visão excluída.'); };
  const setDefaultView = async (id: string) => { await setDefaultKanbanSavedView(id); setViews((items) => items.map((item) => ({ ...item, isDefault: item.id === id }))); showToast('Visão padrão atualizada.'); };
  const loadView = (view: KanbanSavedView<ViewConfiguration>) => { setFilters(view.configuration.filters); setQueryDraft(view.configuration.filters.query); setViewMode(view.configuration.mode); setPage(1); setActiveViewId(view.id); setSavedSnapshot(JSON.stringify(view.configuration)); };

  const columns = (filters.showClosed ? canonicalStageKeys : canonicalStageKeys.filter((stage) => stage !== 'perdido')) as CanonicalStageKey[];
  const totalPages = Math.max(1, Math.ceil((portfolio?.total || 0) / PAGE_SIZE));

  return (
    <div className="wf-page wf-page--kanban">
      <header className="wf-page-header">
        <div>
          <p className="wf-eyebrow">Pipeline comercial</p>
          <div className="mt-1 flex items-center gap-2"><h1 className="wf-page-title">Kanban</h1><InfoTooltip text="Acompanhe a carteira e decida a próxima ação. Mudanças de etapa continuam obedecendo às regras comerciais do servidor." label="Sobre o Kanban" align="start" /></div>
          <p className="mt-1 text-sm text-foreground-600">Acompanhe o avanço dos leads e priorize as próximas ações.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full border border-background-300 bg-white px-3 py-2 text-xs font-semibold text-foreground-700">{portfolio?.total === 1 ? '1 lead no funil' : `${portfolio?.total ?? 0} leads no funil`}</span>
          <div className="inline-flex rounded-lg border border-background-300 bg-white p-1" aria-label="Modo de visualização">
            <button type="button" onClick={() => setViewMode('kanban')} className={`rounded-md px-3 py-2 text-xs font-semibold ${viewMode === 'kanban' ? 'bg-primary-50 text-primary-800 shadow-sm' : 'text-foreground-600'}`}><i className="ri-kanban-view-2-line mr-1" />Kanban</button>
            <button type="button" onClick={() => setViewMode('list')} className={`rounded-md px-3 py-2 text-xs font-semibold ${viewMode === 'list' ? 'bg-primary-50 text-primary-800 shadow-sm' : 'text-foreground-600'}`}><i className="ri-list-check-2 mr-1" />Lista</button>
          </div>
          <button type="button" onClick={() => setAutomationOpen(true)} className="wf-btn-secondary"><i className="ri-settings-3-line" />Automações</button>
        </div>
      </header>

      <section className="rounded-xl border border-background-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Buscar no Kanban</span><i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-500" /><input value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} placeholder="Buscar por lead, empresa, telefone ou e-mail" className="h-10 w-full rounded-lg border border-background-300 bg-background-50 pl-9 pr-3 text-sm text-foreground-900 outline-none ring-primary-300 focus:ring-2" /></label>
          <KanbanViewsMenu<ViewConfiguration> views={views} activeViewId={activeViewId} dirty={dirtyView} onLoad={loadView} onCreate={saveView} onRename={renameView} onUpdate={updateView} onSetDefault={setDefaultView} onDelete={deleteView} />
          <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} className={`wf-btn-secondary ${filtersOpen ? 'border-primary-400 bg-primary-50 text-primary-800' : ''}`}><i className="ri-filter-3-line" />Filtros</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {([
            ['mine', 'Meus leads', 'ri-user-line'], ['overdue', 'Atrasados', 'ri-time-line'], ['without_contact', 'Sem contato', 'ri-phone-off-line'], ['without_action', 'Sem próxima ação', 'ri-calendar-close-line'], ['high_fit', 'Alta aderência', 'ri-bar-chart-line'],
          ] as const).map(([key, label, icon]) => <button key={key} type="button" onClick={() => updateFilters({ quick: filters.quick === key ? '' : key })} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${filters.quick === key ? 'border-primary-400 bg-primary-50 text-primary-800' : 'border-background-300 bg-white text-foreground-700 hover:bg-background-50'}`}><i className={icon} /><span>{label}</span><span className="rounded-full bg-background-100 px-1.5 py-0.5 text-[10px]">{portfolio?.quickCounts[key] ?? 0}</span></button>)}
          <label className="ml-auto flex items-center gap-2 text-xs font-medium text-foreground-600">Ordenar cards por<select value={filters.sort} onChange={(event) => updateFilters({ sort: event.target.value as KanbanSort })} className="rounded-lg border border-background-300 bg-white px-2 py-2 text-xs text-foreground-800"><option value="next_action">Próxima ação</option><option value="fit">Maior aderência</option><option value="stage_age">Mais tempo na etapa</option><option value="updated">Atualizados recentemente</option><option value="company">Nome da empresa</option></select></label>
        </div>
        {filtersOpen && <div className="mt-3 grid gap-3 border-t border-background-200 pt-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-semibold text-foreground-600">Responsável<select value={filters.ownerId} onChange={(event) => updateFilters({ ownerId: event.target.value })} className="mt-1 block w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm text-foreground-800"><option value="">Todos</option>{team.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-foreground-600">Segmento<input value={filters.segment} onChange={(event) => updateFilters({ segment: event.target.value })} className="mt-1 block w-full rounded-lg border border-background-300 px-3 py-2 text-sm" placeholder="Ex.: Indústria" /></label>
          <label className="text-xs font-semibold text-foreground-600">Cidade<input value={filters.city} onChange={(event) => updateFilters({ city: event.target.value })} className="mt-1 block w-full rounded-lg border border-background-300 px-3 py-2 text-sm" placeholder="Ex.: Sorocaba" /></label>
          <label className="text-xs font-semibold text-foreground-600">UF<input value={filters.uf} maxLength={2} onChange={(event) => updateFilters({ uf: event.target.value.toUpperCase() })} className="mt-1 block w-full rounded-lg border border-background-300 px-3 py-2 text-sm uppercase" placeholder="SP" /></label>
          <label className="text-xs font-semibold text-foreground-600">Origem<input value={filters.origin} onChange={(event) => updateFilters({ origin: event.target.value })} className="mt-1 block w-full rounded-lg border border-background-300 px-3 py-2 text-sm" placeholder="Busca, CSV ou Manual" /></label>
          <label className="text-xs font-semibold text-foreground-600">Lista de origem<select value={filters.listId} onChange={(event) => updateFilters({ listId: event.target.value })} className="mt-1 block w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm text-foreground-800"><option value="">Todas</option>{Array.from(new Map(currentItems.filter((item) => item.listId && item.listName).map((item) => [item.listId!, item.listName!])).entries()).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-foreground-600">Aderência mín.<input type="number" min="0" max="100" value={filters.scoreMin} onChange={(event) => updateFilters({ scoreMin: safeNumber(event.target.value) })} className="mt-1 block w-full rounded-lg border border-background-300 px-3 py-2 text-sm" /></label><label className="text-xs font-semibold text-foreground-600">Aderência máx.<input type="number" min="0" max="100" value={filters.scoreMax} onChange={(event) => updateFilters({ scoreMax: safeNumber(event.target.value) })} className="mt-1 block w-full rounded-lg border border-background-300 px-3 py-2 text-sm" /></label></div>
          <label className="text-xs font-semibold text-foreground-600">Contato<select value={filters.contact} onChange={(event) => updateFilters({ contact: event.target.value as KanbanPortfolioFilters['contact'] })} className="mt-1 block w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm"><option value="">Todos</option><option value="with_phone">Com telefone</option><option value="without_phone">Sem telefone</option><option value="whatsapp">WhatsApp identificado</option><option value="with_email">Com e-mail</option><option value="without_email">Sem e-mail</option><option value="without_contact">Sem contato</option></select></label>
          <label className="text-xs font-semibold text-foreground-600">Próxima ação<select value={filters.nextAction} onChange={(event) => updateFilters({ nextAction: event.target.value as KanbanPortfolioFilters['nextAction'] })} className="mt-1 block w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm"><option value="">Todas</option><option value="without">Sem próxima ação</option><option value="overdue">Atrasada</option></select></label>
          <label className="text-xs font-semibold text-foreground-600">Sem interação há (dias)<input type="number" min="1" max="999" value={filters.inactiveDays} onChange={(event) => updateFilters({ inactiveDays: safeNumber(event.target.value) })} className="mt-1 block w-full rounded-lg border border-background-300 px-3 py-2 text-sm" /></label>
          <label className="text-xs font-semibold text-foreground-600">Tempo na etapa (dias)<input type="number" min="1" max="9999" value={filters.stageDays} onChange={(event) => updateFilters({ stageDays: safeNumber(event.target.value) })} className="mt-1 block w-full rounded-lg border border-background-300 px-3 py-2 text-sm" /></label>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-foreground-600">Entrada de<input type="date" value={filters.enteredFrom} onChange={(event) => updateFilters({ enteredFrom: event.target.value })} className="mt-1 block w-full rounded-lg border border-background-300 px-2 py-2 text-sm" /></label><label className="text-xs font-semibold text-foreground-600">Entrada até<input type="date" value={filters.enteredTo} onChange={(event) => updateFilters({ enteredTo: event.target.value })} className="mt-1 block w-full rounded-lg border border-background-300 px-2 py-2 text-sm" /></label></div>
          <label className="text-xs font-semibold text-foreground-600">Autorização de contato<select value={filters.contactApproval} onChange={(event) => updateFilters({ contactApproval: event.target.value as KanbanPortfolioFilters['contactApproval'] })} className="mt-1 block w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm"><option value="">Todas</option><option value="approved">Aprovada</option><option value="pending">Pendente</option><option value="rejected">Recusada</option></select></label>
          <div className="flex flex-wrap items-end gap-4 pb-2 text-xs font-medium text-foreground-700"><label className="flex items-center gap-2"><input type="checkbox" checked={filters.duplicatesOnly} onChange={(event) => updateFilters({ duplicatesOnly: event.target.checked })} className="h-4 w-4 accent-primary-600" />Suspeita de duplicidade</label><label className="flex items-center gap-2"><input type="checkbox" checked={filters.showClosed} onChange={(event) => updateFilters({ showClosed: event.target.checked })} className="h-4 w-4 accent-primary-600" />Mostrar encerrados</label></div>
        </div>}
        {chips.length > 0 && <div className="mt-3 flex items-center gap-2 border-t border-background-200 pt-3"><FilterChips chips={chips} /><button type="button" onClick={clearFilters} className="ml-auto shrink-0 text-xs font-semibold text-primary-700 hover:underline">Limpar filtros</button></div>}
      </section>

      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-[80] max-w-md -translate-x-1/2 rounded-xl bg-foreground-950 px-4 py-3 text-sm font-medium text-white shadow-xl">{toast}</div>}
      {undo && <div className="fixed bottom-16 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-primary-200 bg-white px-4 py-3 text-sm shadow-xl"><span>Movimentação confirmada.</span><button type="button" onClick={() => void undoMove()} className="font-bold text-primary-700 hover:underline">Desfazer</button></div>}

      {portfolioError ? <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><div className="flex items-center justify-between gap-4"><span>{portfolioError}</span><button type="button" onClick={refreshBoard} className="wf-btn-secondary">Atualizar</button></div></section> : (
        <>
          {loadStatus === 'error' && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">A carteira geral não foi atualizada, mas o quadro usa a consulta operacional do servidor.</p>}
          {viewMode === 'kanban' ? <section ref={boardRef} className="mt-5 overflow-x-auto rounded-xl border border-background-200 bg-background-50 p-3" aria-label="Quadro Kanban">
            {portfolioLoading && <div className="absolute sr-only" aria-live="polite">Atualizando quadro</div>}
            {portfolio && portfolio.total > BOARD_LIMIT && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">O quadro exibe os primeiros {BOARD_LIMIT} leads ordenados. Refine os filtros para operar toda a carteira.</p>}
            <div className="grid min-w-[1440px] grid-cols-6 gap-3">
              {columns.map((stage) => {
                const cards = currentItems.filter((item) => displayStage(item) === stage);
                return <section key={stage} onDragOver={(event) => { if (draggedId) { event.preventDefault(); setDragDestination(stage); } }} onDragLeave={() => setDragDestination((current) => current === stage ? null : current)} onDrop={(event) => { event.preventDefault(); const item = currentItems.find((candidate) => candidate.lead.id === draggedId); setDraggedId(null); setDragDestination(null); if (item) void move(item, stage); }} className={`min-h-[560px] rounded-xl border p-2 ${dragDestination === stage ? 'border-primary-500 bg-primary-50/60' : 'border-background-200 bg-white'}`}>
                  <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-background-200 bg-inherit px-1 pb-3 pt-1"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${stageDot[stage]}`} /><h2 className="text-sm font-bold text-foreground-900">{stageLabels[stage]}</h2></div><span className="rounded-full bg-background-100 px-2 py-0.5 text-xs font-bold text-foreground-700">{displayCounts[stage]}</span></header>
                  <div className="space-y-2 pt-2">
                    {cards.map((item) => <LeadCard key={item.lead.id} item={item} stage={displayStage(item)} editable={canEdit(item)} pending={pendingLeadId === item.lead.id} onOpen={() => setDetail(item)} onCreateTask={() => { setTaskLead(item); setTaskForm({ title: '', dueDate: '', priority: 'MEDIA' }); }} onMove={(target) => void move(item, target)} onArchive={() => setArchiveTarget(item)} onDragStart={() => setDraggedId(item.lead.id)} onDragEnd={() => { setDraggedId(null); setDragDestination(null); }} />)}
                    {!cards.length && <div className="flex min-h-24 items-center justify-center px-4 text-center text-xs text-foreground-500">Arraste um lead para cá</div>}
                  </div>
                </section>;
              })}
            </div>
          </section> : <ListMode items={currentItems} loading={portfolioLoading} selected={selected} setSelected={setSelected} team={team} canAssign={canAssign} canEdit={canEdit} onOpen={setDetail} onAssign={(memberId) => void assign(selectedItems, memberId)} onMove={(stage) => { if (stage === 'ganho' || stage === 'perdido') { showToast('Conclua Ganho ou Perdido individualmente para registrar o motivo e validar o orçamento.'); return; } selectedItems.forEach((item) => void move(item, stage)); }} onExport={() => exportItems(selectedItems)} onArchive={() => { if (selectedItems.length && window.confirm(`Arquivar ${selectedItems.length} lead(s)? O histórico será preservado e poderá ser recuperado depois.`)) selectedItems.forEach((item) => void archive(item)); }} page={page} pages={totalPages} total={portfolio?.total || 0} onPage={setPage} />}
        </>
      )}

      {detail && <LeadDrawer item={detail} team={team} canEdit={canEdit(detail)} canAssign={canAssign} onClose={() => setDetail(null)} onMove={(stage) => void move(detail, stage)} onOpenConversation={() => navigate(`/dashboard/atendimento?lead=${detail.lead.id}`)} onCreateTask={() => { setTaskLead(detail); setTaskForm({ title: '', dueDate: '', priority: 'MEDIA' }); }} onAssign={(memberId) => void assign([detail], memberId)} onArchive={() => setArchiveTarget(detail)} onToggleTask={(id) => void toggleTask(id)} />}

      {taskLead && <AccessibleDialog title="Criar próxima ação" onClose={() => setTaskLead(null)}><div className="w-full max-w-md rounded-xl bg-white"><header className="border-b border-background-200 px-5 py-4"><h2 className="font-heading text-lg font-bold text-foreground-950">Criar próxima ação</h2><p className="mt-1 text-xs text-foreground-600">{taskLead.lead.nome || taskLead.lead.empresa}</p></header><div className="space-y-4 p-5"><label className="block text-sm font-medium text-foreground-800">Ação<input autoFocus value={taskForm.title} onChange={(event) => setTaskForm((form) => ({ ...form, title: event.target.value }))} className="mt-1 block w-full rounded-lg border border-background-300 px-3 py-2.5" placeholder="Ex.: Ligar para confirmar aplicação" /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-medium text-foreground-800">Prazo<input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((form) => ({ ...form, dueDate: event.target.value }))} className="mt-1 block w-full rounded-lg border border-background-300 px-3 py-2.5" /></label><label className="text-sm font-medium text-foreground-800">Prioridade<select value={taskForm.priority} onChange={(event) => setTaskForm((form) => ({ ...form, priority: event.target.value as typeof form.priority }))} className="mt-1 block w-full rounded-lg border border-background-300 bg-white px-3 py-2.5"><option value="ALTA">Alta</option><option value="MEDIA">Média</option><option value="BAIXA">Baixa</option></select></label></div></div><footer className="flex justify-end gap-2 border-t border-background-200 px-5 py-4"><button type="button" onClick={() => setTaskLead(null)} className="wf-btn-secondary">Cancelar</button><button type="button" onClick={() => void createTask()} className="wf-btn-primary">Salvar tarefa</button></footer></div></AccessibleDialog>}

      {outcome && <AccessibleDialog title={outcome.stage === 'ganho' ? 'Concluir ganho' : 'Registrar perda'} onClose={() => setOutcome(null)}><div className="w-full max-w-md rounded-xl bg-white"><header className="border-b border-background-200 px-5 py-4"><h2 className="font-heading text-lg font-bold text-foreground-950">{outcome.stage === 'ganho' ? 'Concluir Ganho' : 'Registrar Perdido'}</h2><p className="mt-1 text-xs text-foreground-600">{outcome.item.lead.nome || outcome.item.lead.empresa}</p></header><div className="p-5"><p className="mb-3 text-sm text-foreground-600">{outcome.stage === 'ganho' ? 'O servidor só confirmará Ganho se houver orçamento aceito vinculado. Valores e aceite continuam no módulo Orçamentos.' : 'O motivo fica registrado na auditoria comercial.'}</p><label className="block text-sm font-medium text-foreground-800">Motivo<textarea autoFocus value={outcomeReason} onChange={(event) => setOutcomeReason(event.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-background-300 px-3 py-2.5" placeholder={outcome.stage === 'ganho' ? 'Ex.: Aceite confirmado pelo responsável' : 'Ex.: Projeto adiado pelo cliente'} /></label></div><footer className="flex justify-end gap-2 border-t border-background-200 px-5 py-4"><button type="button" onClick={() => setOutcome(null)} className="wf-btn-secondary">Cancelar</button><button type="button" onClick={() => void confirmOutcome()} className="wf-btn-primary">Confirmar</button></footer></div></AccessibleDialog>}

      {archiveTarget && <AccessibleDialog title="Arquivar lead" onClose={() => setArchiveTarget(null)}><div className="w-full max-w-md rounded-xl bg-white"><header className="border-b border-background-200 px-5 py-4"><h2 className="font-heading text-lg font-bold text-foreground-950">Arquivar lead</h2></header><div className="p-5 text-sm text-foreground-700">Arquivar <strong>{archiveTarget.lead.nome || archiveTarget.lead.empresa}</strong> remove o lead do quadro ativo e preserva todo o histórico comercial.</div><footer className="flex justify-end gap-2 border-t border-background-200 px-5 py-4"><button type="button" onClick={() => setArchiveTarget(null)} className="wf-btn-secondary">Cancelar</button><button type="button" onClick={() => void archive(archiveTarget)} className="wf-btn-primary">Arquivar</button></footer></div></AccessibleDialog>}

      {automationOpen && <AccessibleDialog title="Automações do Kanban" onClose={() => setAutomationOpen(false)}><div className="max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white"><header className="border-b border-background-200 px-5 py-4"><div className="flex items-start justify-between gap-4"><div><h2 className="font-heading text-lg font-bold text-foreground-950">Automações</h2><p className="mt-1 text-xs text-foreground-600">Configuração, evidências e execução manual protegida.</p></div>{canConfigure && <button type="button" disabled={automationRunning} onClick={() => void runAutomations()} className="wf-btn-primary disabled:opacity-50">{automationRunning ? 'Processando…' : 'Executar manutenção'}</button>}</div></header><div className="space-y-5 p-5"><section><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-foreground-900">Fluxos configurados</h3><span className="text-xs text-foreground-500">{fluxos.length} registrado(s)</span></div><div className="mt-2 space-y-2">{fluxos.length ? fluxos.map((flow) => <div key={flow.id} className="flex items-center justify-between rounded-lg border border-background-200 px-3 py-2.5 text-sm"><span className="font-medium text-foreground-800">{flow.nome}</span><span className={flow.ativo ? 'text-primary-700' : 'text-foreground-500'}>{flow.ativo ? 'Ativo' : 'Inativo'}</span></div>) : <p className="rounded-lg bg-background-100 p-3 text-sm text-foreground-600">Nenhum fluxo operacional configurado.</p>}</div></section><section><h3 className="text-sm font-bold text-foreground-900">Execuções recentes da Ana</h3>{automationRunsError ? <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{automationRunsError}</p> : <div className="mt-2 space-y-2">{automationRuns.length ? automationRuns.slice(0, 8).map((run) => <div key={run.id} className="rounded-lg border border-background-200 px-3 py-2"><div className="flex justify-between gap-3 text-sm"><span className="font-medium text-foreground-800">{run.event}</span><span className="text-foreground-600">{run.status}</span></div><p className="mt-1 text-xs text-foreground-500">{run.completedAt ? `Concluída em ${formatDate(run.completedAt)}` : run.startedAt ? `Iniciada em ${formatDate(run.startedAt)}` : 'Sem horário registrado'}{run.errorCode ? ` · Erro: ${run.errorCode}` : ''}</p></div>) : <p className="rounded-lg bg-background-100 p-3 text-sm text-foreground-600">Nenhuma execução registrada.</p>}</div>}<p className="mt-2 text-xs text-foreground-500">Falhas não são reenviadas automaticamente. O worker trata idempotência e fila; itens que exigem reconciliação devem ser avaliados no Registro do Sistema.</p></section><section><h3 className="text-sm font-bold text-foreground-900">Alertas de tempo por etapa</h3><p className="mt-1 text-xs text-foreground-600">Depois desse limite, o cartão passa a indicar que está parado. A etapa e as automações não são alteradas.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{thresholds.filter((threshold) => threshold.stage !== 'perdido').map((threshold) => <div key={threshold.id} className="flex items-center gap-2 rounded-lg border border-background-200 p-2.5"><label className="min-w-0 flex-1 text-sm font-medium text-foreground-800">{stageLabels[threshold.stage]}<input disabled={!canConfigure} type="number" min="1" max="8760" value={thresholdDrafts[threshold.id] ?? ''} onChange={(event) => setThresholdDrafts((drafts) => ({ ...drafts, [threshold.id]: event.target.value }))} className="mt-1 block w-full rounded-md border border-background-300 px-2 py-1.5 text-sm disabled:bg-background-100" /><span className="mt-1 block text-xs font-normal text-foreground-500">horas</span></label>{canConfigure && <button type="button" disabled={thresholdSaving === threshold.id} onClick={() => void saveThreshold(threshold)} className="text-xs font-semibold text-primary-700 hover:underline disabled:opacity-50">Salvar</button>}</div>)}</div>{!thresholds.length && !automationRunsError && <p className="mt-2 rounded-lg bg-background-100 p-3 text-sm text-foreground-600">Os limites por etapa não foram carregados.</p>}</section></div></div></AccessibleDialog>}
    </div>
  );
}

function LeadCard({ item, stage, editable, pending, onOpen, onCreateTask, onMove, onArchive, onDragStart, onDragEnd }: {
  item: KanbanPortfolioItem;
  stage: CanonicalStageKey;
  editable: boolean;
  pending: boolean;
  onOpen: () => void;
  onCreateTask: () => void;
  onMove: (stage: CanonicalStageKey) => void;
  onArchive: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { lead, nextAction, stageEnteredAt, duplicateSuspected } = item;
  const contact = contactLabel(lead);
  const overdue = Boolean(nextAction.dueAt && new Date(nextAction.dueAt).getTime() < Date.now());
  const alert = isStageAlert(item);
  return <article draggable={editable && !pending} onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(); } }} tabIndex={0} role="button" aria-label={`Abrir lead ${lead.nome || lead.empresa}`} className={`cursor-pointer rounded-xl border bg-white p-3 shadow-sm outline-none transition hover:border-primary-300 hover:shadow focus:ring-2 focus:ring-primary-300 ${pending ? 'pointer-events-none opacity-60' : 'border-background-200'}`}>
    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-sm font-bold text-foreground-950">{lead.nome || lead.empresa}</h3>{lead.nome && <p className="truncate text-xs text-foreground-600">{lead.empresa || 'Empresa não informada'}</p>}</div><details onClick={(event) => event.stopPropagation()} className="relative"><summary className="list-none rounded p-1 text-foreground-500 hover:bg-background-100" aria-label="Ações do lead"><i className="ri-more-2-fill" /></summary><div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-background-200 bg-white p-1 shadow-xl"><button type="button" onClick={onOpen} className="w-full rounded px-2 py-2 text-left text-xs hover:bg-background-100">Abrir detalhes</button>{editable && <><button type="button" onClick={onCreateTask} className="w-full rounded px-2 py-2 text-left text-xs hover:bg-background-100">Adicionar tarefa</button><label className="block px-2 py-1.5 text-xs text-foreground-600">Mover para<select value={stage} onChange={(event) => onMove(event.target.value as CanonicalStageKey)} className="mt-1 w-full rounded border border-background-300 bg-white p-1 text-xs">{canonicalStageKeys.map((candidate) => <option key={candidate} value={candidate} disabled={candidate === stage}>{stageLabels[candidate]}</option>)}</select></label><button type="button" onClick={onArchive} className="w-full rounded px-2 py-2 text-left text-xs text-foreground-700 hover:bg-background-100">Arquivar</button></>}</div></details></div>
    <div className="mt-2 flex flex-wrap gap-1.5"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${contact.className}`}>{contact.text}</span>{lead.origem && <span className="rounded-full bg-background-100 px-2 py-1 text-[11px] font-medium text-foreground-600">{originLabel(lead.origem)}</span>}{duplicateSuspected && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-900">Possível duplicidade</span>}</div>
    <p className="mt-2 truncate text-xs text-foreground-600">{[lead.segmento, [lead.cidade, lead.estado].filter(Boolean).join(' · ')].filter(Boolean).join(' · ') || 'Segmento e local não informados'}</p>
    <div className="mt-3"><div className="flex items-center justify-between text-xs"><span className="font-semibold text-foreground-700">Aderência</span><span className="font-bold text-foreground-900">{lead.score}/100</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background-200"><div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.max(0, Math.min(100, lead.score))}%` }} /></div>{lead.scoreExplanation && <p className="mt-1 line-clamp-2 text-[11px] text-foreground-500" title={lead.scoreExplanation}>{lead.scoreExplanation}</p>}</div>
    <div className={`mt-3 border-t pt-2 text-xs ${overdue ? 'border-amber-200 text-amber-900' : 'border-background-200 text-foreground-600'}`}>{nextAction.text ? <><p className="truncate font-semibold">{nextAction.text}</p><p className="mt-0.5">{overdue ? 'Atrasada: ' : 'Prazo: '}{formatDate(nextAction.dueAt)}{nextAction.owner ? ` · ${nextAction.owner}` : ''}</p></> : <button type="button" onClick={(event) => { event.stopPropagation(); onCreateTask(); }} className="font-semibold text-amber-800 hover:underline">Sem próxima ação · adicionar tarefa</button>}</div>
    <div className={`mt-2 text-[11px] ${alert ? 'font-semibold text-amber-800' : 'text-foreground-500'}`}>{alert ? `Parado · ${stageAgeText(stageEnteredAt)}` : stageAgeText(stageEnteredAt)}</div>
    <div className="mt-3 flex items-center justify-between border-t border-background-100 pt-2"><div className="flex min-w-0 items-center gap-2"><span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-800">{initials(lead.responsavel || '?')}</span><span className="truncate text-xs font-medium text-foreground-700">{lead.responsavel || 'Sem responsável'}</span></div><span className="max-w-24 truncate text-right text-[10px] text-foreground-500">{updateText(lead.updatedAt)}</span></div>
  </article>;
}

function ListMode({ items, loading, selected, setSelected, team, canAssign, canEdit, onOpen, onAssign, onMove, onExport, onArchive, page, pages, total, onPage }: {
  items: KanbanPortfolioItem[]; loading: boolean; selected: string[]; setSelected: (ids: string[]) => void; team: TeamMember[]; canAssign: boolean; canEdit: (item: KanbanPortfolioItem) => boolean; onOpen: (item: KanbanPortfolioItem) => void; onAssign: (id: string) => void; onMove: (stage: CanonicalStageKey) => void; onExport: () => void; onArchive: () => void; page: number; pages: number; total: number; onPage: (page: number) => void;
}) {
  const allSelected = Boolean(items.length) && items.every((item) => selected.includes(item.lead.id));
  return <section className="mt-5 rounded-xl border border-background-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-background-200 p-3">{selected.length ? <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground-800"><span>{selected.length} selecionado(s)</span>{canAssign && <select defaultValue="" onChange={(event) => { if (event.target.value) onAssign(event.target.value); event.currentTarget.value = ''; }} className="rounded-lg border border-background-300 bg-white px-2 py-1.5 text-xs"><option value="">Atribuir responsável…</option>{team.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select>}<select defaultValue="" onChange={(event) => { if (event.target.value) onMove(event.target.value as CanonicalStageKey); event.currentTarget.value = ''; }} className="rounded-lg border border-background-300 bg-white px-2 py-1.5 text-xs"><option value="">Alterar etapa…</option>{canonicalStageKeys.filter((stage) => !['ganho', 'perdido'].includes(stage)).map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select><button type="button" onClick={onExport} className="wf-btn-secondary text-xs">Exportar</button><button type="button" onClick={onArchive} className="wf-btn-secondary text-xs">Arquivar</button></div> : <p className="text-sm text-foreground-600">{total === 1 ? '1 lead encontrado' : `${total} leads encontrados`}</p>}<span className="text-xs text-foreground-500">Página {page} de {pages}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-sm"><thead className="bg-background-50 text-left text-xs text-foreground-500"><tr><th className="w-10 px-4 py-3"><input aria-label="Selecionar todos os leads desta página" type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? items.map((item) => item.lead.id) : [])} className="h-4 w-4 accent-primary-600" /></th><th className="px-3 py-3">Lead / empresa</th><th className="px-3 py-3">Contato</th><th className="px-3 py-3">Local</th><th className="px-3 py-3">Aderência</th><th className="px-3 py-3">Etapa</th><th className="px-3 py-3">Próxima ação</th><th className="px-3 py-3">Responsável</th></tr></thead><tbody>{items.map((item) => { const contact = contactLabel(item.lead); return <tr key={item.lead.id} onClick={() => onOpen(item)} className="cursor-pointer border-t border-background-100 hover:bg-background-50"><td className="px-4 py-3" onClick={(event) => event.stopPropagation()}><input aria-label={`Selecionar ${item.lead.nome || item.lead.empresa}`} type="checkbox" checked={selected.includes(item.lead.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, item.lead.id] : selected.filter((id) => id !== item.lead.id))} className="h-4 w-4 accent-primary-600" /></td><td className="px-3 py-3"><p className="font-semibold text-foreground-900">{item.lead.nome || item.lead.empresa}</p>{item.lead.nome && <p className="text-xs text-foreground-600">{item.lead.empresa}</p>}<span className="mt-1 inline-block rounded-full bg-background-100 px-1.5 py-0.5 text-[10px] text-foreground-600">{originLabel(item.lead.origem)}</span></td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${contact.className}`}>{contact.text}</span></td><td className="px-3 py-3 text-foreground-700">{[item.lead.segmento, item.lead.cidade, item.lead.estado].filter(Boolean).join(' · ') || 'Não informado'}</td><td className="px-3 py-3"><span className="font-semibold text-foreground-900">{item.lead.score}/100</span>{item.duplicateSuspected && <p className="mt-1 text-[10px] text-amber-800">Possível duplicidade</p>}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${stageBadge[item.stage]}`}>{stageLabels[item.stage]}</span></td><td className="px-3 py-3 text-xs text-foreground-700">{item.nextAction.text ? <><p className="font-semibold">{item.nextAction.text}</p><p className={item.nextAction.dueAt && new Date(item.nextAction.dueAt).getTime() < Date.now() ? 'text-amber-800' : 'text-foreground-500'}>{formatDate(item.nextAction.dueAt)}</p></> : 'Sem próxima ação'}</td><td className="px-3 py-3 text-xs font-medium text-foreground-700">{item.lead.responsavel || 'Sem responsável'}</td></tr>; })}</tbody></table>{!loading && !items.length && <p className="p-8 text-center text-sm text-foreground-600">Nenhum lead corresponde aos filtros.</p>}</div><footer className="flex items-center justify-end gap-2 border-t border-background-200 p-3"><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="wf-btn-secondary disabled:opacity-40">Anterior</button><button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} className="wf-btn-secondary disabled:opacity-40">Próxima</button></footer></section>;
}
