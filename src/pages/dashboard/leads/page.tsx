import AccessibleDialog from '@/components/feature/AccessibleDialog';
import InfoTooltip from '@/components/feature/InfoTooltip';
import FilterChips from '@/components/feature/FilterChips';
import type { FilterChip } from '@/components/feature/FilterChips';
import SavedViewsControl from '@/components/feature/SavedViewsControl';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { refreshLeadsStore, useLeadsStore, waitForLeadsPersistence } from '@/hooks/useLeadsStore';
import { useTarefasStore, waitForTarefasPersistence } from '@/hooks/useTarefasStore';
import { useSavedViews } from '@/hooks/useSavedViews';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';
import { etapasCRM, segmentos } from '@/mocks/leadsData';
import type { Lead } from '@/mocks/leadsData';
import { canonicalStageKeyFromLabel, CommercialTransitionError, transitionOperationalLeadStage } from '@/lib/crm/leadStageRepository';
import { useListasStore } from '@/hooks/useListasStore';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentAccess } from '@/hooks/useCurrentAccess';
import { loadTeamMembers, type TeamMember } from '@/lib/crm/teamMembersRepository';
import { approvedAnaWhatsAppChannel, pendingManualLeadContact } from '@/lib/crm/manualLeadContact';
import { configureLeadHandoffPolicy, handoffStages, type HandoffStage } from '@/lib/crm/handoffPolicyRepository';
import { activateLeadWithAna } from '@/lib/crm/leadWorkflowRepository';
import { useLeadsLoadStatus } from '@/hooks/useLeadsStore';
import DataReadNotice from '@/components/feature/DataReadNotice';
import { loadLeadQualifications, type LeadQualification } from '@/lib/crm/leadQualificationRepository';
import { leadPurgeErrorMessage, purgeOperationalLeads } from '@/lib/crm/leadGovernanceRepository';
import { isLeadPurgeConfirmationValid, leadPurgeConfirmation } from './components/leadPurgeConfirmation';
import {
  findPotentialLeadDuplicates,
  formatPortfolioDate,
  HIGH_FIT_SCORE,
  isPortfolioDateOverdue,
  leadHasContact,
  leadHasNextAction,
  leadMatchesPortfolioQuery,
  type LeadQuickView,
  type PotentialLeadDuplicate,
} from '@/lib/crm/leadPortfolio';

const handoffStageLabels: Record<HandoffStage, string> = {
  novo: 'Novo', apresentado: 'Apresentado', qualificando: 'Qualificando', reuniao: 'Reunião', orcamento: 'Orçamento',
};

const etapaCores: Record<string, string> = {
  'Novo': 'bg-background-200 text-foreground-600',
  'Apresentado': 'bg-primary-100 text-primary-700',
  'Qualificando': 'bg-primary-100 text-primary-700',
  'Reunião': 'bg-accent-100 text-accent-700',
  'Orçamento': 'bg-secondary-100 text-secondary-700',
  'Ganho': 'bg-primary-500 text-background-50',
  'Perdido': 'bg-background-300 text-foreground-500',
  'Em Contato': 'bg-primary-100 text-primary-700',
  'Aguardando Resposta': 'bg-accent-100 text-accent-700',
  'Em Qualificação': 'bg-primary-100 text-primary-700',
  'Reunião Agendada': 'bg-accent-100 text-accent-700',
  'Proposta em Preparação': 'bg-secondary-100 text-secondary-700',
  'Orçamento Enviado': 'bg-accent-100 text-accent-700',
  'Negociação': 'bg-secondary-100 text-secondary-700',
  'Fechado — Ganho': 'bg-primary-500 text-background-50',
  'Fechado — Perdido': 'bg-background-300 text-foreground-500',
  'Pausado': 'bg-background-200 text-foreground-500',
};

type PortfolioSort = 'updated' | 'created' | 'score-desc' | 'score-asc' | 'company';
type ContactFilter = 'all' | 'with-contact' | 'without-contact' | 'whatsapp' | 'email';
type LeadColumn = 'contact' | 'segment-location' | 'fit' | 'stage' | 'last-interaction' | 'next-action' | 'owner';

interface PortfolioFilters {
  query: string;
  stage: string;
  segment: string;
  owner: string;
  archived: boolean;
  city: string;
  state: string;
  contact: ContactFilter;
  scoreMin: string;
  scoreMax: string;
  origin: string;
  sourceList: string;
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
  nextAction: 'all' | 'with' | 'without';
  duplicate: boolean;
  quickView: LeadQuickView;
  sort: PortfolioSort;
  columns: LeadColumn[];
}

const DEFAULT_COLUMNS: LeadColumn[] = ['contact', 'segment-location', 'fit', 'stage', 'last-interaction', 'next-action', 'owner'];
const PAGE_SIZE = 25;
const duplicateReasonLabel: Record<PotentialLeadDuplicate['reasons'][number], string> = {
  email: 'e-mail', phone: 'telefone', domain: 'domínio', 'external-id': 'identificador externo', 'company-location': 'empresa e local',
};

function dateOnly(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function leadOriginLabel(origin: string): string {
  const value = origin.trim();
  if (!value) return 'Origem não informada';
  if (/apify|google|busca/i.test(value)) return 'Busca de leads';
  if (/csv/i.test(value)) return 'CSV';
  if (/manual/i.test(value)) return 'Manual';
  return value;
}

export default function Leads() {
  const loadStatus = useLeadsLoadStatus();
  const [leads, setLeads] = useLeadsStore();
  const { tarefas, criar: criarTarefa } = useTarefasStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { access, loading: accessLoading } = useCurrentAccess();
  const [buscaDigitada, setBuscaDigitada] = useState(() => searchParams.get('q') || '');
  const [busca, setBusca] = useState(() => searchParams.get('q') || '');
  const [etapaFiltro, setEtapaFiltro] = useState(() => searchParams.get('etapa') || 'Todas');
  const [segmentoFiltro, setSegmentoFiltro] = useState(() => searchParams.get('segmento') || 'Todos');
  const [responsavelFiltro, setResponsavelFiltro] = useState(() => searchParams.get('responsavel') || 'Todos');
  const [ordenacao, setOrdenacao] = useState<PortfolioSort>(() => (searchParams.get('ordenar') as PortfolioSort) || 'updated');
  const [pagina, setPagina] = useState(() => Math.max(1, Number(searchParams.get('pagina') || '1')));
  const [quickView, setQuickView] = useState<LeadQuickView>(() => (searchParams.get('visao') as LeadQuickView) || 'all');
  const [filtrosAvancados, setFiltrosAvancados] = useState(false);
  const [cidadeFiltro, setCidadeFiltro] = useState(() => searchParams.get('cidade') || '');
  const [ufFiltro, setUfFiltro] = useState(() => searchParams.get('uf') || '');
  const [situacaoContato, setSituacaoContato] = useState<ContactFilter>(() => (searchParams.get('contato') as ContactFilter) || 'all');
  const [scoreMin, setScoreMin] = useState(() => searchParams.get('scoreMin') || '');
  const [scoreMax, setScoreMax] = useState(() => searchParams.get('scoreMax') || '');
  const [origemFiltro, setOrigemFiltro] = useState(() => searchParams.get('origem') || '');
  const [listaFiltro, setListaFiltro] = useState(() => searchParams.get('lista') || '');
  const [criadoDe, setCriadoDe] = useState(() => searchParams.get('criadoDe') || '');
  const [criadoAte, setCriadoAte] = useState(() => searchParams.get('criadoAte') || '');
  const [atualizadoDe, setAtualizadoDe] = useState(() => searchParams.get('atualizadoDe') || '');
  const [atualizadoAte, setAtualizadoAte] = useState(() => searchParams.get('atualizadoAte') || '');
  const [proximaAcaoFiltro, setProximaAcaoFiltro] = useState<'all' | 'with' | 'without'>(() => (searchParams.get('acao') as 'all' | 'with' | 'without') || 'all');
  const [suspeitaDuplicidade, setSuspeitaDuplicidade] = useState(() => searchParams.get('duplicidade') === '1');
  const [colunasVisiveis, setColunasVisiveis] = useLocalStorageState<LeadColumn[]>(`leads-colunas-${user?.id ?? 'anonymous'}`, DEFAULT_COLUMNS);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [envioAlvo, setEnvioAlvo] = useState<string[] | null>(null);
  const [detalhe, setDetalhe] = useState<Lead | null>(null);
  const [toast, setToast] = useState('');
  const [novoModal, setNovoModal] = useState(false);
  const [novoLead, setNovoLead] = useState({ nome: '', empresa: '', email: '', telefone: '', segmento: 'Tecnologia', cidade: '', estado: '', modo: 'IA' as 'IA' | 'HUMANO' });
  const [mostrarArquivados, setMostrarArquivados] = useState(() => searchParams.get('arquivados') === '1');
  const [editarModal, setEditarModal] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState({ nome: '', empresa: '', cidade: '', estado: '', email: '', telefone: '', responsavel: '', responsavelId: '', tags: '' });
  const [membros, setMembros] = useState<TeamMember[]>([]);
  const [handoffEtapa, setHandoffEtapa] = useState('');
  const [handoffAssigneeId, setHandoffAssigneeId] = useState('');
  const [handoffNotifyWhatsapp, setHandoffNotifyWhatsapp] = useState(false);
  const [modoSelecionado, setModoSelecionado] = useState<'IA' | 'HUMANO' | null>(null);
  const [aprovacaoKanban, setAprovacaoKanban] = useState({ confirmada: false, origem: '' });
  const [stageChangePending, setStageChangePending] = useState<string | null>(null);
  const [qualificacoes, setQualificacoes] = useState<Map<string, LeadQualification>>(new Map());
  const [qualificacoesStatus, setQualificacoesStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [possiveisDuplicados, setPossiveisDuplicados] = useState<PotentialLeadDuplicate[] | null>(null);
  const [tarefaLead, setTarefaLead] = useState<Lead | null>(null);
  const [novaTarefa, setNovaTarefa] = useState({ titulo: '', dataLimite: '', prioridade: 'MEDIA' as 'ALTA' | 'MEDIA' | 'BAIXA' });
  const [purgeLeadIds, setPurgeLeadIds] = useState<string[] | null>(null);
  const [purgeConfirmation, setPurgeConfirmation] = useState('');
  const [purgingLeads, setPurgingLeads] = useState(false);
  const navigate = useNavigate();
  const listas = useListasStore();

  useEffect(() => {
    void loadTeamMembers()
      .then((result) => setMembros(result.filter((member) => member.status === 'active')))
      .catch(() => setMembros([]));
  }, []);

  // Keep typing responsive and only apply the operational query after a short
  // pause.  The current repository hydrates the authorized portfolio in one
  // request; pagination is rendered over that server-sourced result.
  useEffect(() => {
    const timer = window.setTimeout(() => setBusca(buscaDigitada.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [buscaDigitada]);

  useEffect(() => {
    let active = true;
    const ids = leads.map((lead) => lead.id).filter(Boolean);
    if (!ids.length) {
      setQualificacoes(new Map());
      setQualificacoesStatus('idle');
      return () => { active = false; };
    }
    setQualificacoesStatus('loading');
    void loadLeadQualifications(ids)
      .then((result) => { if (active) { setQualificacoes(result); setQualificacoesStatus('idle'); } })
      .catch(() => { if (active) setQualificacoesStatus('error'); });
    return () => { active = false; };
  }, [leads]);

  useEffect(() => {
    const next = new URLSearchParams();
    const set = (key: string, value: string | boolean, defaultValue = '') => {
      if (value !== defaultValue && value !== false) next.set(key, String(value));
    };
    set('q', busca);
    set('etapa', etapaFiltro, 'Todas');
    set('segmento', segmentoFiltro, 'Todos');
    set('responsavel', responsavelFiltro, 'Todos');
    set('ordenar', ordenacao, 'updated');
    set('pagina', String(pagina), '1');
    set('visao', quickView, 'all');
    set('cidade', cidadeFiltro);
    set('uf', ufFiltro);
    set('contato', situacaoContato, 'all');
    set('scoreMin', scoreMin);
    set('scoreMax', scoreMax);
    set('origem', origemFiltro);
    set('lista', listaFiltro);
    set('criadoDe', criadoDe);
    set('criadoAte', criadoAte);
    set('atualizadoDe', atualizadoDe);
    set('atualizadoAte', atualizadoAte);
    set('acao', proximaAcaoFiltro, 'all');
    set('duplicidade', suspeitaDuplicidade ? '1' : '');
    set('arquivados', mostrarArquivados ? '1' : '');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [atualizadoAte, atualizadoDe, busca, cidadeFiltro, criadoAte, criadoDe, etapaFiltro, listaFiltro, mostrarArquivados, ordenacao, origemFiltro, pagina, proximaAcaoFiltro, quickView, responsavelFiltro, scoreMax, scoreMin, searchParams, segmentoFiltro, setSearchParams, situacaoContato, suspeitaDuplicidade, ufFiltro]);

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const abrirEdicao = (lead: Lead) => {
    setEditarModal(lead);
    setEditForm({
      nome: lead.nome,
      empresa: lead.empresa,
      cidade: lead.cidade,
      estado: lead.estado,
      email: lead.email,
      telefone: lead.telefone,
      responsavel: lead.responsavel,
      responsavelId: lead.responsavelId ?? '',
      tags: lead.tags.join(', '),
    });
  };

  const salvarEdicao = async () => {
    if (!editarModal) return;
    if (!editForm.nome.trim()) {
      mostrarToast('O nome não pode ficar vazio.');
      return;
    }
    const normalizar = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const novoEmail = normalizar(editForm.email);
    const duplicado = leads.some(
      (l) => l.id !== editarModal.id && novoEmail && normalizar(l.email) === novoEmail
    );
    if (duplicado) {
      mostrarToast('Já existe outro lead com este e-mail.');
      return;
    }
    const tags = editForm.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const membro = membros.find((item) => item.userId === editForm.responsavelId);
    const responsavelAna = editForm.responsavelId === '__ana__';
    const telefoneAlterado = normalizar(editForm.telefone) !== normalizar(editarModal.telefone);
    setLeads((prev) =>
      prev.map((l) =>
        l.id === editarModal.id
          ? {
              ...l,
              nome: editForm.nome.trim(),
              empresa: editForm.empresa.trim(),
              cidade: editForm.cidade.trim(),
              estado: editForm.estado.trim().toUpperCase(),
              email: editForm.email.trim(),
              telefone: editForm.telefone.trim(),
              whatsapp: telefoneAlterado ? '' : l.whatsapp,
              contactApprovalStatus: telefoneAlterado ? 'pending' : l.contactApprovalStatus,
              contactApprovalReason: telefoneAlterado ? 'Telefone alterado; canal e autorização precisam ser comprovados novamente.' : l.contactApprovalReason,
              contactApprovedAt: telefoneAlterado ? null : l.contactApprovedAt,
              contatoPermitido: telefoneAlterado ? false : l.contatoPermitido,
              consentimentoWhatsApp: telefoneAlterado ? false : l.consentimentoWhatsApp,
              aguardandoAtivacao: telefoneAlterado ? true : l.aguardandoAtivacao,
              automacaoStatus: telefoneAlterado ? 'PAUSADA' : l.automacaoStatus,
              responsavel: responsavelAna ? 'Ana (IA)' : membro?.name || editForm.responsavel,
              responsavelId: responsavelAna ? '' : membro?.userId || l.responsavelId,
              tags,
            }
          : l
      )
    );
    try {
      await waitForLeadsPersistence();
      setEditarModal(null);
      mostrarToast('Lead atualizado com sucesso.');
    } catch {
      mostrarToast('Não foi possível gravar a edição. A tela foi reconciliada com o servidor.');
    }
  };

  const arquivarLead = async (id: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, arquivado: true } : l)));
    try {
      await waitForLeadsPersistence();
      setDetalhe(null);
      mostrarToast('Lead arquivado. Ele ficou fora do funil ativo, sem apagar o histórico.');
    } catch {
      mostrarToast('Não foi possível arquivar o lead. A tela foi reconciliada com o servidor.');
    }
  };

  const restaurarLead = async (id: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, arquivado: false } : l)));
    try {
      await waitForLeadsPersistence();
      setDetalhe(null);
      mostrarToast('Lead restaurado para o funil ativo.');
    } catch {
      mostrarToast('Não foi possível restaurar o lead. A tela foi reconciliada com o servidor.');
    }
  };

  // Aprova os leads selecionados e persiste modo + responsável antes de
  // acionar a Ana no backend.
  const enviarParaKanban = async (ids: string[], modo: 'IA' | 'HUMANO', etapaHandoff?: HandoffStage) => {
    if (ids.length === 0) return;
    if (!user?.id) {
      mostrarToast('Sua sessão não possui um responsável válido. Entre novamente antes de enviar ao Kanban.');
      return;
    }
    const exigeNovaAprovacao = modo === 'IA' && ids.some((id) => { const lead = leads.find((item) => item.id === id); return lead?.contactApprovalStatus !== 'approved' || !lead.whatsapp; });
    if (exigeNovaAprovacao && (!aprovacaoKanban.confirmada || !aprovacaoKanban.origem.trim())) {
      mostrarToast('Confirme o WhatsApp, a autorização e informe a origem antes de ativar a Ana.');
      return;
    }
    if (modo === 'IA' && ids.some((id) => {
      const lead = leads.find((item) => item.id === id);
      return !lead || !approvedAnaWhatsAppChannel(lead);
    })) {
      mostrarToast('Informe um telefone/WhatsApp válido antes de ativar a Ana.');
      return;
    }
    const handoffMember = membros.find((member) => member.userId === handoffAssigneeId);
    // A transfer policy is only persisted when the operator selected a stage
    // and a human assignee. "Ana conduz tudo" is handled by the single
    // activation command below, so it cannot leave the UI waiting on an
    // unrelated browser RPC before Ana is called.
    if (modo === 'IA' && etapaHandoff) {
      try {
        await configureLeadHandoffPolicy({
          leadIds: ids,
          assigneeUserId: etapaHandoff ? handoffAssigneeId || null : null,
          stage: etapaHandoff ?? null,
          notifyWhatsapp: etapaHandoff ? handoffNotifyWhatsapp : false,
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : '';
        const message = code.includes('handoff_whatsapp_not_configured')
          ? 'O vendedor não possui WhatsApp de aviso configurado. Configure em Usuários antes de ativar este aviso.'
          : code.includes('handoff_assignee_cannot_reply')
            ? 'O usuário escolhido não tem permissão para responder conversas.'
            : code.includes('handoff_assignee')
              ? 'Escolha um vendedor ativo para receber a transferência.'
              : 'Não foi possível gravar a regra de transferência. A Ana não foi acionada.';
        mostrarToast(message);
        return;
      }
    }
    const idsSet = new Set(ids);
    if (modo === 'IA') {
      const result = await Promise.allSettled(ids.map((leadId) => {
        const lead = leads.find((item) => item.id === leadId);
        const activation = lead ? approvedAnaWhatsAppChannel(lead) : null;
        return activateLeadWithAna({
          leadId,
          whatsapp: activation?.whatsapp ?? '',
          approvalReason: lead?.contactApprovalStatus === 'approved' && lead.contactApprovalReason
            ? lead.contactApprovalReason
            : aprovacaoKanban.origem,
          clearHandoffPolicy: !etapaHandoff,
        });
      }));
      try {
        await refreshLeadsStore();
      } catch {
        mostrarToast('A Ana foi acionada, mas não foi possível atualizar a tela. Atualize a página para consultar o estado atual.');
        return;
      }
      const processados = result.filter((item) => item.status === 'fulfilled' && item.value.ana?.ok && !item.value.ana?.skipped).length;
      const falhas = result.filter((item) => item.status === 'rejected' || (item.status === 'fulfilled' && (!item.value.ana?.ok || item.value.ana?.skipped)));
      if (falhas.length) {
        const first = falhas[0];
        const code = first.status === 'rejected' && first.reason instanceof Error ? first.reason.message : '';
        const message = code === 'invalid_whatsapp'
          ? 'O WhatsApp informado não é válido. A Ana não foi acionada.'
          : code === 'contact_approval_reason_required'
            ? 'Informe a origem da autorização antes de ativar a Ana.'
            : 'O lead foi preparado para o Kanban, mas a Ana não iniciou. Consulte o Registro do Sistema para o motivo.';
        mostrarToast(message);
        return;
      }
      listas.listas.forEach((lista) => {
        if (lista.status === 'pendente' && lista.leadIds.length > 0 && lista.leadIds.every((lid) => idsSet.has(lid))) {
          listas.atualizar(lista.id, { status: 'ativada' });
        }
      });
      mostrarToast(`${ids.length} lead(s) enviados ao Kanban${processados ? ` · ${processados} processado(s) pela Ana` : ''}.`);
      setSelecionados([]);
      setEnvioAlvo(null);
      setModoSelecionado(null);
      setAprovacaoKanban({ confirmada: false, origem: '' });
      return;
    }
    setLeads((current) => current.map((lead) => {
      if (!idsSet.has(lead.id)) return lead;
      return {
        ...lead,
        aguardandoAtivacao: false, modoAtendimento: modo, responsavelId: etapaHandoff ? handoffAssigneeId : lead.responsavelId || user.id,
        responsavel: etapaHandoff ? handoffMember?.name || lead.responsavel : lead.responsavel === 'Ana (IA)' || !lead.responsavel ? 'Você' : lead.responsavel,
        etapa: 'Novo', etapaHandoff, automacaoStatus: 'AGUARDANDO_HUMANO',
        handoffWhatsappAtivo: etapaHandoff ? handoffNotifyWhatsapp : false,
      };
    }));
    try {
      await waitForLeadsPersistence();
    } catch {
      mostrarToast('A ativação não foi gravada no servidor. A Ana não foi acionada e nenhum envio foi feito. Tente novamente ou consulte o Registro do Sistema.');
      return;
    }
    listas.listas.forEach((lista) => {
      if (lista.status === 'pendente' && lista.leadIds.length > 0 && lista.leadIds.every((lid) => idsSet.has(lid))) {
        listas.atualizar(lista.id, { status: 'ativada' });
      }
    });
    mostrarToast(`${ids.length} lead(s) enviados ao Kanban para atendimento humano.`);
    setSelecionados([]);
    setEnvioAlvo(null);
    setModoSelecionado(null);
    setAprovacaoKanban({ confirmada: false, origem: '' });
    setHandoffEtapa(''); setHandoffAssigneeId(''); setHandoffNotifyWhatsapp(false);
  };

  const criarLead = async (confirmarPossivelDuplicidade = false) => {
    if (!novoLead.nome.trim() || !novoLead.empresa.trim()) {
      mostrarToast('Preencha ao menos nome e empresa.');
      return;
    }
    const candidate = {
      id: '', nome: novoLead.nome, empresa: novoLead.empresa, cnpj: '', email: novoLead.email, telefone: novoLead.telefone,
      whatsapp: '', segmento: novoLead.segmento, cidade: novoLead.cidade, estado: novoLead.estado, porte: '', score: 0,
      temperatura: 'Frio' as const, etapa: 'Novo', origem: 'Manual', responsavel: '', tags: [], ultimaInteracao: '', criadoEm: '',
    } satisfies Lead;
    const duplicates = findPotentialLeadDuplicates(candidate, leads);
    if (duplicates.length && !confirmarPossivelDuplicidade) {
      setPossiveisDuplicados(duplicates);
      return;
    }
    if (!user?.id) {
      mostrarToast('Sua sessão não possui um responsável válido. Entre novamente antes de criar o lead.');
      return;
    }
    const novo: Lead = {
      id: crypto.randomUUID(),
      nome: novoLead.nome.trim(),
      empresa: novoLead.empresa.trim(),
      cnpj: '',
      email: novoLead.email.trim(),
      telefone: novoLead.telefone.trim(),
      segmento: novoLead.segmento,
      cidade: novoLead.cidade.trim() || '—',
      estado: novoLead.estado.trim() || '—',
      porte: 'Pequeno',
      score: 50,
      temperatura: 'Morno',
      etapa: 'Novo',
      origem: 'Manual',
      responsavel: 'Você',
      responsavelId: user.id,
      tags: [],
      modoAtendimento: novoLead.modo,
      automacaoStatus: novoLead.modo === 'HUMANO' ? 'AGUARDANDO_HUMANO' : 'PAUSADA',
      templateId: 'tm-1',
      ...pendingManualLeadContact(novoLead),
      aguardandoAtivacao: novoLead.modo === 'IA',
      ultimaInteracao: 'agora',
      criadoEm: new Date().toISOString().slice(0, 10),
    };
    setLeads((prev) => [novo, ...prev]);
    try {
      await waitForLeadsPersistence();
    } catch {
      mostrarToast('Não foi possível criar o lead no servidor. Nenhuma ativação da Ana foi iniciada.');
      return;
    }
    setNovoModal(false);
    setPossiveisDuplicados(null);
    setNovoLead({ nome: '', empresa: '', email: '', telefone: '', segmento: 'Tecnologia', cidade: '', estado: '', modo: 'IA' });
    if (novo.modoAtendimento === 'IA') {
      setEnvioAlvo([novo.id]);
      setModoSelecionado('IA');
      mostrarToast('Lead criado. Confirme o canal e a autorização para ativar a Ana.');
      return;
    }
    mostrarToast('Lead criado em atendimento humano.');
  };

  const tarefasAbertasPorLead = useMemo(() => {
    const byLead = new Map<string, typeof tarefas[number]>();
    for (const task of tarefas.filter((item) => !item.concluida && item.leadId)) {
      const current = byLead.get(task.leadId!);
      const currentDue = current?.dataLimite ?? '9999-12-31';
      if (!current || (task.dataLimite ?? '9999-12-31') < currentDue) byLead.set(task.leadId!, task);
    }
    return byLead;
  }, [tarefas]);

  const listaPorLead = useMemo(() => {
    const result = new Map<string, string>();
    for (const lista of listas.listas) {
      for (const leadId of lista.leadIds) result.set(leadId, lista.nome);
    }
    return result;
  }, [listas.listas]);

  const possibleDuplicateIds = useMemo(() => {
    const result = new Set<string>();
    for (const lead of leads) {
      if (findPotentialLeadDuplicates(lead, leads).length) result.add(lead.id);
    }
    return result;
  }, [leads]);

  const actionFor = (lead: Lead) => {
    const task = tarefasAbertasPorLead.get(lead.id);
    const qualification = qualificacoes.get(lead.id);
    if (task) return { text: task.titulo, dueAt: task.dataLimite ? `${task.dataLimite}T23:59:59` : null, source: 'task' as const };
    if (qualification?.nextAction) return { text: qualification.nextAction, dueAt: qualification.nextActionDueAt, source: 'qualification' as const };
    if (lead.proximaAcao) return { text: lead.proximaAcao, dueAt: lead.nextFollowUpAt ?? null, source: 'lead' as const };
    if (lead.nextFollowUpAt) return { text: 'Follow-up programado', dueAt: lead.nextFollowUpAt, source: 'automation' as const };
    return null;
  };

  const base = useMemo(
    () => mostrarArquivados ? leads.filter((lead) => lead.arquivado) : leads.filter((lead) => !lead.arquivado),
    [leads, mostrarArquivados],
  );

  const filtrados = useMemo(() => {
    const minimum = scoreMin ? Number(scoreMin) : null;
    const maximum = scoreMax ? Number(scoreMax) : null;
    const dateInRange = (value: string | null | undefined, start: string, end: string) => {
      const date = dateOnly(value);
      return (!start || date >= start) && (!end || date <= end);
    };
    const filtered = base.filter((lead) => {
      const qualificationAction = qualificacoes.get(lead.id)?.nextAction;
      const hasContact = leadHasContact(lead);
      const hasNextAction = leadHasNextAction(lead, Boolean(tarefasAbertasPorLead.get(lead.id)), qualificationAction);
      if (!leadMatchesPortfolioQuery(lead, busca)) return false;
      if (etapaFiltro !== 'Todas' && lead.etapa !== etapaFiltro) return false;
      if (segmentoFiltro !== 'Todos' && lead.segmento !== segmentoFiltro) return false;
      if (responsavelFiltro !== 'Todos' && lead.responsavel !== responsavelFiltro) return false;
      if (cidadeFiltro && !lead.cidade.toLocaleLowerCase('pt-BR').includes(cidadeFiltro.toLocaleLowerCase('pt-BR'))) return false;
      if (ufFiltro && lead.estado.toLocaleUpperCase('pt-BR') !== ufFiltro.toLocaleUpperCase('pt-BR')) return false;
      if (situacaoContato === 'with-contact' && !hasContact) return false;
      if (situacaoContato === 'without-contact' && hasContact) return false;
      if (situacaoContato === 'whatsapp' && !lead.whatsapp.trim()) return false;
      if (situacaoContato === 'email' && !lead.email.trim()) return false;
      if (minimum !== null && (!Number.isFinite(minimum) || lead.score < minimum)) return false;
      if (maximum !== null && (!Number.isFinite(maximum) || lead.score > maximum)) return false;
      if (origemFiltro && lead.origem !== origemFiltro) return false;
      if (listaFiltro && listaPorLead.get(lead.id) !== listaFiltro) return false;
      if (!dateInRange(lead.createdAt ?? lead.criadoEm, criadoDe, criadoAte)) return false;
      if (!dateInRange(lead.updatedAt, atualizadoDe, atualizadoAte)) return false;
      if (proximaAcaoFiltro === 'with' && !hasNextAction) return false;
      if (proximaAcaoFiltro === 'without' && hasNextAction) return false;
      if (suspeitaDuplicidade && !possibleDuplicateIds.has(lead.id)) return false;
      if (quickView === 'without-contact' && hasContact) return false;
      if (quickView === 'without-next-action' && hasNextAction) return false;
      if (quickView === 'high-fit' && lead.score < HIGH_FIT_SCORE) return false;
      return true;
    });
    return [...filtered].sort((left, right) => {
      if (ordenacao === 'score-desc') return right.score - left.score;
      if (ordenacao === 'score-asc') return left.score - right.score;
      if (ordenacao === 'company') return left.empresa.localeCompare(right.empresa, 'pt-BR');
      if (ordenacao === 'created') return (right.createdAt ?? right.criadoEm).localeCompare(left.createdAt ?? left.criadoEm);
      return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '');
    });
  }, [atualizadoAte, atualizadoDe, base, busca, cidadeFiltro, criadoAte, criadoDe, etapaFiltro, listaFiltro, listaPorLead, ordenacao, origemFiltro, possibleDuplicateIds, proximaAcaoFiltro, qualificacoes, quickView, responsavelFiltro, scoreMax, scoreMin, segmentoFiltro, situacaoContato, suspeitaDuplicidade, tarefasAbertasPorLead, ufFiltro]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const leadsDaPagina = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);
  const carteirasAtivas = leads.filter((lead) => !lead.arquivado);
  const quickCounts = {
    all: carteirasAtivas.length,
    'without-contact': carteirasAtivas.filter((lead) => !leadHasContact(lead)).length,
    'without-next-action': carteirasAtivas.filter((lead) => !leadHasNextAction(lead, Boolean(tarefasAbertasPorLead.get(lead.id)), qualificacoes.get(lead.id)?.nextAction)).length,
    'high-fit': carteirasAtivas.filter((lead) => lead.score >= HIGH_FIT_SCORE).length,
  } satisfies Record<LeadQuickView, number>;

  const responsaveisDisponiveis = useMemo(() => Array.from(new Set(leads.map((lead) => lead.responsavel).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [leads]);
  const segmentosDisponiveis = useMemo(() => Array.from(new Set(leads.map((lead) => lead.segmento).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [leads]);
  const origensDisponiveis = useMemo(() => Array.from(new Set(leads.map((lead) => lead.origem).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [leads]);
  const listasDisponiveis = useMemo(() => Array.from(new Set(Array.from(listaPorLead.values()))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [listaPorLead]);
  const listasPendentes = listas.listas.filter((lista) => lista.status === 'pendente' && lista.leadIds.length > 0);
  const canEditAll = access?.permissions['leads.edit_all'] === true;
  const canEditLead = (lead: Lead) => canEditAll || (access?.permissions['leads.edit_assigned'] === true && lead.responsavelId === user?.id);
  const canDelete = access?.permissions['leads.delete'] === true;
  const canCreate = access?.permissions['leads.create'] === true;
  const columnVisible = (column: LeadColumn) => colunasVisiveis.includes(column);

  const openLeadPurge = (leadIds: string[]) => {
    if (!canDelete) {
      mostrarToast('Seu usuário não possui permissão para excluir leads definitivamente.');
      return;
    }
    const ids = [...new Set(leadIds)].filter((id) => leads.some((lead) => lead.id === id));
    if (!ids.length) {
      mostrarToast('Selecione ao menos um lead para excluir.');
      return;
    }
    setPurgeConfirmation('');
    setPurgeLeadIds(ids);
  };

  const confirmLeadPurge = async () => {
    if (!purgeLeadIds || !isLeadPurgeConfirmationValid(purgeConfirmation, purgeLeadIds.length)) return;
    setPurgingLeads(true);
    try {
      const result = await purgeOperationalLeads(purgeLeadIds, purgeConfirmation);
      const deleted = new Set(purgeLeadIds);
      setSelecionados((current) => current.filter((id) => !deleted.has(id)));
      setDetalhe((current) => current && deleted.has(current.id) ? null : current);
      setTarefaLead((current) => current && deleted.has(current.id) ? null : current);
      setPurgeLeadIds(null);
      setPurgeConfirmation('');
      try {
        await refreshLeadsStore();
        mostrarToast(`${result.deletedCount} lead(s) excluído(s) definitivamente.`);
      } catch {
        mostrarToast(`${result.deletedCount} lead(s) foram excluído(s), mas a lista não pôde ser atualizada. Recarregue a página.`);
      }
    } catch (error) {
      mostrarToast(leadPurgeErrorMessage(error));
    } finally {
      setPurgingLeads(false);
    }
  };

  const filtrosAtuais: PortfolioFilters = {
    query: busca, stage: etapaFiltro, segment: segmentoFiltro, owner: responsavelFiltro, archived: mostrarArquivados,
    city: cidadeFiltro, state: ufFiltro, contact: situacaoContato, scoreMin, scoreMax, origin: origemFiltro, sourceList: listaFiltro,
    createdFrom: criadoDe, createdTo: criadoAte, updatedFrom: atualizadoDe, updatedTo: atualizadoAte, nextAction: proximaAcaoFiltro,
    duplicate: suspeitaDuplicidade, quickView, sort: ordenacao, columns: colunasVisiveis,
  };
  const savedViews = useSavedViews<PortfolioFilters>(`leads-visoes-${user?.id ?? 'anonymous'}`);

  const aplicarFiltros = (filters: PortfolioFilters) => {
    setBuscaDigitada(filters.query); setBusca(filters.query); setEtapaFiltro(filters.stage); setSegmentoFiltro(filters.segment); setResponsavelFiltro(filters.owner);
    setMostrarArquivados(filters.archived); setCidadeFiltro(filters.city); setUfFiltro(filters.state); setSituacaoContato(filters.contact);
    setScoreMin(filters.scoreMin); setScoreMax(filters.scoreMax); setOrigemFiltro(filters.origin); setListaFiltro(filters.sourceList);
    setCriadoDe(filters.createdFrom); setCriadoAte(filters.createdTo); setAtualizadoDe(filters.updatedFrom); setAtualizadoAte(filters.updatedTo);
    setProximaAcaoFiltro(filters.nextAction); setSuspeitaDuplicidade(filters.duplicate); setQuickView(filters.quickView); setOrdenacao(filters.sort);
    setColunasVisiveis(filters.columns.length ? filters.columns : DEFAULT_COLUMNS); setPagina(1);
  };

  const limparFiltros = () => {
    setBuscaDigitada(''); setBusca(''); setEtapaFiltro('Todas'); setSegmentoFiltro('Todos'); setResponsavelFiltro('Todos'); setCidadeFiltro(''); setUfFiltro('');
    setSituacaoContato('all'); setScoreMin(''); setScoreMax(''); setOrigemFiltro(''); setListaFiltro(''); setCriadoDe(''); setCriadoAte('');
    setAtualizadoDe(''); setAtualizadoAte(''); setProximaAcaoFiltro('all'); setSuspeitaDuplicidade(false); setQuickView('all'); setPagina(1);
  };

  const chips: FilterChip[] = [
    busca ? { label: 'Busca', value: busca, onRemove: () => { setBusca(''); setBuscaDigitada(''); setPagina(1); } } : null,
    etapaFiltro !== 'Todas' ? { label: 'Etapa', value: etapaFiltro, onRemove: () => { setEtapaFiltro('Todas'); setPagina(1); } } : null,
    segmentoFiltro !== 'Todos' ? { label: 'Segmento', value: segmentoFiltro, onRemove: () => { setSegmentoFiltro('Todos'); setPagina(1); } } : null,
    responsavelFiltro !== 'Todos' ? { label: 'Responsável', value: responsavelFiltro, onRemove: () => { setResponsavelFiltro('Todos'); setPagina(1); } } : null,
    cidadeFiltro ? { label: 'Cidade', value: cidadeFiltro, onRemove: () => { setCidadeFiltro(''); setPagina(1); } } : null,
    ufFiltro ? { label: 'UF', value: ufFiltro, onRemove: () => { setUfFiltro(''); setPagina(1); } } : null,
    origemFiltro ? { label: 'Origem', value: origemFiltro, onRemove: () => { setOrigemFiltro(''); setPagina(1); } } : null,
    listaFiltro ? { label: 'Lista', value: listaFiltro, onRemove: () => { setListaFiltro(''); setPagina(1); } } : null,
    situacaoContato !== 'all' ? { label: 'Contato', value: situacaoContato === 'without-contact' ? 'Sem contato' : situacaoContato === 'with-contact' ? 'Com contato' : situacaoContato === 'whatsapp' ? 'WhatsApp' : 'E-mail', onRemove: () => { setSituacaoContato('all'); setPagina(1); } } : null,
    proximaAcaoFiltro !== 'all' ? { label: 'Próxima ação', value: proximaAcaoFiltro === 'with' ? 'Com ação' : 'Sem ação', onRemove: () => { setProximaAcaoFiltro('all'); setPagina(1); } } : null,
    suspeitaDuplicidade ? { label: 'Duplicidade', value: 'Suspeita', onRemove: () => { setSuspeitaDuplicidade(false); setPagina(1); } } : null,
  ].filter((chip): chip is FilterChip => chip !== null);

  const toggleSelecionado = (id: string) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter((s) => s !== id));
    } else {
      setSelecionados([...selecionados, id]);
    }
  };

  const atribuirResponsavel = async (leadIds: string[], responsavelId: string) => {
    const member = membros.find((item) => item.userId === responsavelId);
    if (!member || !canEditAll) {
      mostrarToast('Você não possui permissão para alterar o responsável.');
      return;
    }
    const ids = new Set(leadIds);
    setLeads((current) => current.map((lead) => ids.has(lead.id) ? { ...lead, responsavel: member.name, responsavelId: member.userId } : lead));
    try {
      await waitForLeadsPersistence();
      mostrarToast(`${leadIds.length} lead(s) atribuído(s) a ${member.name}.`);
    } catch {
      mostrarToast('Não foi possível confirmar o responsável no servidor. A carteira foi reconciliada.');
    }
  };

  const arquivarSelecionados = async () => {
    if (!selecionados.length || !window.confirm(`Arquivar ${selecionados.length} lead(s)? O histórico será preservado.`)) return;
    const ids = new Set(selecionados);
    setLeads((current) => current.map((lead) => ids.has(lead.id) ? { ...lead, arquivado: true } : lead));
    try {
      await waitForLeadsPersistence();
      setSelecionados([]);
      mostrarToast('Leads arquivados. O histórico comercial foi preservado.');
    } catch {
      mostrarToast('Não foi possível arquivar todos os leads. A carteira foi reconciliada.');
    }
  };

  const exportarSelecionados = () => {
    const selected = leads.filter((lead) => selecionados.includes(lead.id));
    if (!selected.length) return;
    const quote = (value: string | number | null | undefined) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const header = ['Nome', 'Empresa', 'E-mail', 'Telefone', 'WhatsApp', 'Segmento', 'Cidade', 'UF', 'Aderência', 'Etapa', 'Responsável', 'Origem'];
    const lines = selected.map((lead) => [lead.nome, lead.empresa, lead.email, lead.telefone, lead.whatsapp, lead.segmento, lead.cidade, lead.estado, lead.score, lead.etapa, lead.responsavel, lead.origem].map(quote).join(','));
    const blob = new Blob([[header.map(quote).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `wayflex-leads-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    URL.revokeObjectURL(url);
    mostrarToast(`${selected.length} lead(s) exportado(s).`);
  };

  const salvarTarefa = async () => {
    if (!tarefaLead || !novaTarefa.titulo.trim()) {
      mostrarToast('Informe a próxima ação.');
      return;
    }
    if (!canEditLead(tarefaLead)) {
      mostrarToast('Você não possui permissão para criar uma ação neste lead.');
      return;
    }
    criarTarefa({
      titulo: novaTarefa.titulo.trim(), leadId: tarefaLead.id, leadNome: tarefaLead.nome, responsavel: tarefaLead.responsavel || 'Sem responsável',
      responsavelId: tarefaLead.responsavelId, prioridade: novaTarefa.prioridade, dataLimite: novaTarefa.dataLimite || undefined, descricao: '',
    });
    try {
      await waitForTarefasPersistence();
      setTarefaLead(null); setNovaTarefa({ titulo: '', dataLimite: '', prioridade: 'MEDIA' });
      mostrarToast('Próxima ação criada e vinculada ao lead.');
    } catch {
      mostrarToast('Não foi possível salvar a próxima ação. A lista de tarefas foi reconciliada.');
    }
  };

  const mudarEtapa = async (id: string, etapa: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.etapa === etapa) return;
    const stage = canonicalStageKeyFromLabel(etapa);
    if (!stage) {
      mostrarToast('Esta etapa não pertence ao pipeline comercial canônico.');
      return;
    }
    if (stage === 'ganho' || stage === 'perdido') {
      mostrarToast('Conclua Ganho ou Perdido pelo orçamento para registrar o motivo e manter o histórico consistente.');
      return;
    }
    setStageChangePending(id);
    try {
      await transitionOperationalLeadStage({ leadId: id, stage });
      await refreshLeadsStore();
      mostrarToast(`${lead.nome} movido para “${etapa}”.`);
    } catch (error) {
      mostrarToast(error instanceof CommercialTransitionError ? error.message : 'Não foi possível confirmar a mudança de etapa.');
    } finally {
      setStageChangePending(null);
    }
  };

  const mudarEtapaEmMassa = async (etapa: string) => {
    const stage = canonicalStageKeyFromLabel(etapa);
    if (!stage || stage === 'ganho' || stage === 'perdido') {
      mostrarToast('Resultados finais devem ser concluídos individualmente pelo orçamento.');
      return;
    }
    const targets = leads.filter((lead) => selecionados.includes(lead.id) && lead.etapa !== etapa);
    if (!targets.length) return;
    setStageChangePending('bulk');
    const results = await Promise.allSettled(targets.map((lead) => transitionOperationalLeadStage({ leadId: lead.id, stage })));
    try {
      await refreshLeadsStore();
    } catch {
      mostrarToast('As alterações foram processadas, mas a tela não pôde ser atualizada. Recarregue para consultar o estado atual.');
      setStageChangePending(null);
      return;
    }
    const completed = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - completed;
    mostrarToast(failed ? `${completed} lead(s) atualizados; ${failed} bloqueado(s) pelas regras do funil.` : `${completed} lead(s) atualizados para “${etapa}”.`);
    setSelecionados([]);
    setStageChangePending(null);
  };

  return (
    <div className="wf-page wf-page--leads">
      <DataReadNotice status={loadStatus} onRetry={() => { void refreshLeadsStore().catch(() => undefined); }} />
      <header className="wf-page-header gap-4">
        <div>
          <p className="wf-eyebrow">Carteira comercial</p>
          <div className="mt-1 flex items-center gap-2"><h1 className="wf-page-title">Leads</h1><InfoTooltip text="Carteira operacional da sua organização. Use filtros, etapas e próximas ações somente sobre dados já autorizados." label="Sobre Leads" align="start" /></div>
          <p className="wf-page-description">Encontre, qualifique e acompanhe suas oportunidades comerciais.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="rounded-full border border-background-200 bg-background-50 px-3 py-2 text-xs font-semibold tabular-nums text-foreground-600">{carteirasAtivas.length} {carteirasAtivas.length === 1 ? 'lead na carteira' : 'leads na carteira'}</span>
          <button onClick={() => navigate('/dashboard/busca-leads')} className="wf-btn-primary cursor-pointer whitespace-nowrap"><i className="ri-search-line" aria-hidden="true" />Buscar novos leads</button>
          <button onClick={() => setNovoModal(true)} disabled={accessLoading || !canCreate} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-foreground-950 px-4 py-2 text-sm font-bold text-white hover:bg-foreground-800 disabled:cursor-not-allowed disabled:opacity-50"><i className="ri-add-line" aria-hidden="true" />Novo lead</button>
        </div>
      </header>

      {toast && <div role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-100 px-4 py-3 text-sm text-primary-800"><i className="ri-information-line" />{toast}</div>}

      {listasPendentes.length > 0 && <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3" aria-label="Listas aguardando revisão">
        <div className="flex items-center gap-2 text-sm text-primary-900"><i className="ri-list-check-3-line text-lg" /><span><strong>{listasPendentes.length}</strong> {listasPendentes.length === 1 ? 'lista recebida aguarda' : 'listas recebidas aguardam'} revisão antes do Kanban.</span></div>
        <button type="button" onClick={() => setEnvioAlvo(listasPendentes.flatMap((lista) => lista.leadIds))} className="text-sm font-semibold text-primary-800 hover:text-primary-950">Revisar <i className="ri-arrow-right-line" /></button>
      </section>}

      {qualificacoesStatus === 'error' && <div role="status" className="mb-4 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-900">Não foi possível consultar os resumos de qualificação agora. As próximas ações cadastradas como tarefas continuam visíveis.</div>}

      <section className="overflow-visible rounded-xl border border-background-200 bg-background-50 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-background-200 px-4 pt-3">
          <div role="tablist" aria-label="Visualizações rápidas" className="flex min-w-0 overflow-x-auto">
            {([
              ['all', 'Todos'], ['without-contact', 'Sem contato'], ['without-next-action', 'Sem próxima ação'], ['high-fit', 'Alta aderência'],
            ] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={quickView === id} onClick={() => { setQuickView(id); setPagina(1); }} className={`relative shrink-0 px-4 py-3 text-sm font-medium ${quickView === id ? 'text-foreground-950 after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-primary-500' : 'text-foreground-500 hover:text-foreground-800'}`}>{label}<span className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] ${quickView === id ? 'bg-primary-100 text-primary-800' : 'bg-background-100 text-foreground-500'}`}>{quickCounts[id]}</span></button>)}
          </div>
          <SavedViewsControl views={savedViews.views} onLoad={aplicarFiltros} onSave={(name) => savedViews.salvar(name, filtrosAtuais)} onRename={savedViews.renomear} onDelete={savedViews.excluir} />
        </div>

        <div className="grid gap-2 border-b border-background-200 p-4 lg:grid-cols-[minmax(240px,1fr)_185px_185px_185px_auto_auto]">
          <label className="relative min-w-0"><span className="sr-only">Buscar por lead, empresa, telefone ou e-mail</span><i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" /><input value={buscaDigitada} onChange={(event) => { setBuscaDigitada(event.target.value); setPagina(1); }} placeholder="Buscar por lead, empresa, telefone ou e-mail" className="w-full rounded-lg border border-background-300 bg-white py-2.5 pl-9 pr-3 text-sm text-foreground-900 outline-none focus:border-primary-500" /></label>
          <select aria-label="Todas as etapas" value={etapaFiltro} onChange={(event) => { setEtapaFiltro(event.target.value); setPagina(1); }} className="rounded-lg border border-background-300 bg-white px-3 py-2.5 text-sm text-foreground-700"><option value="Todas">Todas as etapas</option>{etapasCRM.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select>
          <select aria-label="Todos os segmentos" value={segmentoFiltro} onChange={(event) => { setSegmentoFiltro(event.target.value); setPagina(1); }} className="rounded-lg border border-background-300 bg-white px-3 py-2.5 text-sm text-foreground-700"><option value="Todos">Todos os segmentos</option>{segmentosDisponiveis.map((segment) => <option key={segment} value={segment}>{segment}</option>)}</select>
          <select aria-label="Todos os responsáveis" value={responsavelFiltro} onChange={(event) => { setResponsavelFiltro(event.target.value); setPagina(1); }} className="rounded-lg border border-background-300 bg-white px-3 py-2.5 text-sm text-foreground-700"><option value="Todos">Todos os responsáveis</option>{responsaveisDisponiveis.map((owner) => <option key={owner} value={owner}>{owner}</option>)}</select>
          <button type="button" onClick={() => setFiltrosAvancados((open) => !open)} aria-expanded={filtrosAvancados} className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${filtrosAvancados ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-background-300 bg-white text-foreground-700 hover:bg-background-100'}`}><i className="ri-equalizer-2-line" />Mais filtros</button>
          <button type="button" onClick={() => { setMostrarArquivados((value) => !value); setPagina(1); }} aria-pressed={mostrarArquivados} className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${mostrarArquivados ? 'border-accent-300 bg-accent-50 text-accent-800' : 'border-background-300 bg-white text-foreground-700 hover:bg-background-100'}`}><i className="ri-archive-line" />Arquivados{leads.some((lead) => lead.arquivado) && <span className="rounded-full bg-background-100 px-1.5 py-0.5 text-[11px]">{leads.filter((lead) => lead.arquivado).length}</span>}</button>
        </div>

        {filtrosAvancados && <div className="grid gap-3 border-b border-background-200 bg-background-100/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-foreground-600">Cidade<input value={cidadeFiltro} onChange={(event) => { setCidadeFiltro(event.target.value); setPagina(1); }} className="mt-1.5 w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm font-normal text-foreground-800" placeholder="Ex.: São Paulo" /></label>
          <label className="text-xs font-semibold text-foreground-600">UF<input maxLength={2} value={ufFiltro} onChange={(event) => { setUfFiltro(event.target.value.toUpperCase()); setPagina(1); }} className="mt-1.5 w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm font-normal text-foreground-800" placeholder="SP" /></label>
          <label className="text-xs font-semibold text-foreground-600">Situação do contato<select value={situacaoContato} onChange={(event) => { setSituacaoContato(event.target.value as ContactFilter); setPagina(1); }} className="mt-1.5 w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm font-normal text-foreground-800"><option value="all">Todas</option><option value="with-contact">Com contato</option><option value="without-contact">Sem contato</option><option value="whatsapp">WhatsApp identificado</option><option value="email">E-mail informado</option></select></label>
          <div><p className="text-xs font-semibold text-foreground-600">Faixa de aderência</p><div className="mt-1.5 grid grid-cols-2 gap-2"><input type="number" min="0" max="100" value={scoreMin} onChange={(event) => { setScoreMin(event.target.value); setPagina(1); }} className="w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm" placeholder="Mín." /><input type="number" min="0" max="100" value={scoreMax} onChange={(event) => { setScoreMax(event.target.value); setPagina(1); }} className="w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm" placeholder="Máx." /></div></div>
          <label className="text-xs font-semibold text-foreground-600">Origem<select value={origemFiltro} onChange={(event) => { setOrigemFiltro(event.target.value); setPagina(1); }} className="mt-1.5 w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm font-normal text-foreground-800"><option value="">Todas</option>{origensDisponiveis.map((origin) => <option key={origin} value={origin}>{leadOriginLabel(origin)}</option>)}</select></label>
          <label className="text-xs font-semibold text-foreground-600">Lista de origem<select value={listaFiltro} onChange={(event) => { setListaFiltro(event.target.value); setPagina(1); }} className="mt-1.5 w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm font-normal text-foreground-800"><option value="">Todas</option>{listasDisponiveis.map((list) => <option key={list} value={list}>{list}</option>)}</select></label>
          <div><p className="text-xs font-semibold text-foreground-600">Data de criação</p><div className="mt-1.5 grid grid-cols-2 gap-2"><input type="date" value={criadoDe} onChange={(event) => { setCriadoDe(event.target.value); setPagina(1); }} className="w-full rounded-lg border border-background-300 bg-white px-2 py-2 text-sm" /><input type="date" value={criadoAte} onChange={(event) => { setCriadoAte(event.target.value); setPagina(1); }} className="w-full rounded-lg border border-background-300 bg-white px-2 py-2 text-sm" /></div></div>
          <div><p className="text-xs font-semibold text-foreground-600">Última atualização</p><div className="mt-1.5 grid grid-cols-2 gap-2"><input type="date" value={atualizadoDe} onChange={(event) => { setAtualizadoDe(event.target.value); setPagina(1); }} className="w-full rounded-lg border border-background-300 bg-white px-2 py-2 text-sm" /><input type="date" value={atualizadoAte} onChange={(event) => { setAtualizadoAte(event.target.value); setPagina(1); }} className="w-full rounded-lg border border-background-300 bg-white px-2 py-2 text-sm" /></div></div>
          <label className="text-xs font-semibold text-foreground-600">Próxima ação<select value={proximaAcaoFiltro} onChange={(event) => { setProximaAcaoFiltro(event.target.value as 'all' | 'with' | 'without'); setPagina(1); }} className="mt-1.5 w-full rounded-lg border border-background-300 bg-white px-3 py-2 text-sm font-normal text-foreground-800"><option value="all">Todas</option><option value="with">Com ação</option><option value="without">Sem ação</option></select></label>
          <label className="flex items-center gap-2 self-end rounded-lg border border-background-300 bg-white px-3 py-2.5 text-sm text-foreground-700"><input checked={suspeitaDuplicidade} onChange={(event) => { setSuspeitaDuplicidade(event.target.checked); setPagina(1); }} type="checkbox" className="h-4 w-4 accent-primary-600" />Suspeita de duplicidade</label>
        </div>}

        {chips.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3"><FilterChips chips={chips} /><button type="button" onClick={limparFiltros} className="text-xs font-semibold text-primary-700 hover:text-primary-900">Limpar filtros</button></div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-background-200 px-4 py-3"><p className="text-sm font-medium text-foreground-700">{filtrados.length} {filtrados.length === 1 ? 'lead encontrado' : 'leads encontrados'}</p><div className="relative flex flex-wrap items-center gap-2"><label className="text-xs text-foreground-500">Ordenar por <select value={ordenacao} onChange={(event) => { setOrdenacao(event.target.value as PortfolioSort); setPagina(1); }} className="ml-1 rounded-lg border border-background-300 bg-white px-3 py-2 text-sm font-medium text-foreground-700"><option value="updated">Atualizados recentemente</option><option value="created">Criados recentemente</option><option value="score-desc">Maior aderência</option><option value="score-asc">Menor aderência</option><option value="company">Nome da empresa</option></select></label><button type="button" onClick={() => setColumnMenuOpen((open) => !open)} aria-expanded={columnMenuOpen} className="inline-flex items-center gap-2 rounded-lg border border-background-300 bg-white px-3 py-2 text-sm font-semibold text-foreground-700 hover:bg-background-100"><i className="ri-layout-column-line" />Colunas</button>{columnMenuOpen && <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-background-200 bg-white p-2 shadow-lg">{([
            ['contact', 'Contato'], ['segment-location', 'Segmento / local'], ['fit', 'Aderência'], ['stage', 'Etapa'], ['last-interaction', 'Última interação'], ['next-action', 'Próxima ação'], ['owner', 'Responsável'],
          ] as const).map(([column, label]) => <label key={column} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground-700 hover:bg-background-100"><input type="checkbox" checked={columnVisible(column)} onChange={(event) => setColunasVisiveis((current) => event.target.checked ? [...new Set([...current, column])] : current.filter((item) => item !== column))} className="h-4 w-4 accent-primary-600" />{label}</label>)}</div>}</div></div>
      </section>

      <section className="mt-5 overflow-hidden rounded-xl border border-background-200 bg-white shadow-2xs">
        {selecionados.length > 0 ? <div className="flex flex-wrap items-center gap-2 border-b border-primary-200 bg-primary-50 px-4 py-3"><span className="mr-2 text-sm font-semibold text-primary-900">{selecionados.length} selecionado(s)</span>{canEditAll && <select defaultValue="" onChange={(event) => { if (event.target.value) { void atribuirResponsavel(selecionados, event.target.value); event.target.value = ''; } }} className="rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm text-foreground-700"><option value="" disabled>Atribuir responsável…</option>{membros.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select>}<select disabled={stageChangePending === 'bulk'} defaultValue="" onChange={(event) => { if (event.target.value) { void mudarEtapaEmMassa(event.target.value); event.target.value = ''; } }} className="rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm text-foreground-700"><option value="" disabled>Alterar etapa…</option>{etapasCRM.filter((stage) => !['Ganho', 'Perdido'].includes(stage)).map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select><button type="button" onClick={exportarSelecionados} className="rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-100"><i className="ri-download-2-line mr-1" />Exportar</button><button type="button" onClick={() => void arquivarSelecionados()} className="rounded-lg border border-accent-200 bg-white px-3 py-2 text-sm font-semibold text-accent-700 hover:bg-accent-50"><i className="ri-archive-line mr-1" />Arquivar</button>{canDelete && <button type="button" onClick={() => openLeadPurge(selecionados)} className="rounded-lg border border-accent-300 bg-white px-3 py-2 text-sm font-semibold text-accent-700 hover:bg-accent-50"><i className="ri-delete-bin-6-line mr-1" />Excluir definitivamente</button>}<button type="button" onClick={() => setSelecionados([])} className="px-2 py-2 text-sm font-semibold text-foreground-600 hover:text-foreground-900">Limpar seleção</button></div> : <p className="border-b border-background-200 bg-background-50 px-4 py-3 text-sm text-foreground-500"><i className="ri-information-line mr-1.5" />Selecione leads para atribuir responsável, alterar etapa, exportar, arquivar ou excluir.</p>}
        <div className="overflow-x-auto"><table className="w-full min-w-[1220px] text-sm"><thead><tr className="border-b border-background-200 bg-background-100/60 text-left text-[11px] font-semibold uppercase tracking-wide text-foreground-500"><th className="w-12 px-4 py-3"><input aria-label="Selecionar leads desta página" type="checkbox" checked={leadsDaPagina.length > 0 && leadsDaPagina.every((lead) => selecionados.includes(lead.id))} onChange={(event) => setSelecionados((current) => event.target.checked ? [...new Set([...current, ...leadsDaPagina.map((lead) => lead.id)])] : current.filter((id) => !leadsDaPagina.some((lead) => lead.id === id)))} className="h-4 w-4 accent-primary-600" /></th><th className="min-w-[180px] px-4 py-3">Lead / empresa</th>{columnVisible('contact') && <th className="min-w-[170px] px-4 py-3">Contato</th>}{columnVisible('segment-location') && <th className="min-w-[150px] px-4 py-3">Segmento / local</th>}{columnVisible('fit') && <th className="min-w-[120px] px-4 py-3">Aderência</th>}{columnVisible('stage') && <th className="min-w-[145px] px-4 py-3">Etapa</th>}{columnVisible('last-interaction') && <th className="min-w-[155px] px-4 py-3">Última interação</th>}{columnVisible('next-action') && <th className="min-w-[175px] px-4 py-3">Próxima ação</th>}{columnVisible('owner') && <th className="min-w-[150px] px-4 py-3">Responsável</th>}<th className="w-12 px-4 py-3"><span className="sr-only">Ações</span></th></tr></thead><tbody>
          {loadStatus === 'loading' && <tr><td colSpan={3 + colunasVisiveis.length} className="px-4 py-12 text-center text-foreground-500"><i className="ri-loader-4-line mr-2 inline-block animate-spin" />Carregando carteira operacional…</td></tr>}
          {loadStatus !== 'loading' && leadsDaPagina.map((lead) => {
            const action = actionFor(lead);
            const hasContact = leadHasContact(lead);
            const canEdit = canEditLead(lead);
            return <tr key={lead.id} onClick={() => setDetalhe(lead)} className="cursor-pointer border-b border-background-100 align-top transition-colors hover:bg-primary-50/30"><td className="px-4 py-4" onClick={(event) => event.stopPropagation()}><input aria-label={`Selecionar ${lead.empresa || lead.nome}`} type="checkbox" checked={selecionados.includes(lead.id)} onChange={() => toggleSelecionado(lead.id)} className="h-4 w-4 accent-primary-600" /></td><td className="px-4 py-4"><p className="font-semibold text-foreground-900">{lead.nome || 'Contato não informado'}</p><p className="mt-0.5 text-xs text-foreground-600">{lead.empresa || 'Empresa não informada'}</p><span className="mt-1.5 inline-flex rounded-md bg-background-100 px-1.5 py-0.5 text-[10px] font-semibold text-foreground-600">{leadOriginLabel(lead.origem)}</span></td>
              {columnVisible('contact') && <td className="px-4 py-4 text-xs text-foreground-600">{hasContact ? <div className="space-y-1">{lead.telefone && <p><i className="ri-phone-line mr-1 text-foreground-400" />{lead.telefone}</p>}{lead.whatsapp && <p className="text-primary-700"><i className="ri-whatsapp-line mr-1" />WhatsApp identificado</p>}{lead.email && <p className="truncate"><i className="ri-mail-line mr-1 text-foreground-400" />{lead.email}</p>}</div> : <div><span className="inline-flex rounded-full bg-accent-100 px-2 py-1 text-[11px] font-semibold text-accent-800">Sem contato</span>{canEdit && <button type="button" onClick={(event) => { event.stopPropagation(); abrirEdicao(lead); }} className="mt-1.5 block text-xs font-semibold text-primary-700 hover:text-primary-900">Adicionar contato</button>}</div>}</td>}
              {columnVisible('segment-location') && <td className="px-4 py-4"><p className="text-sm text-foreground-800">{lead.segmento || 'Segmento não informado'}</p><p className="mt-1 text-xs text-foreground-500">{lead.cidade && lead.estado ? `${lead.cidade} · ${lead.estado}` : 'Local não informado'}</p></td>}
              {columnVisible('fit') && <td className="px-4 py-4"><div className="flex items-center gap-1"><span className="font-semibold text-foreground-900">{lead.score}/100</span><InfoTooltip text={lead.scoreExplanation || 'O detalhamento do score não está disponível para este registro.'} label={`Critérios da aderência de ${lead.empresa || lead.nome}`} /></div><div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-background-200"><span className="block h-full rounded-full bg-primary-500" style={{ width: `${Math.max(0, Math.min(100, lead.score))}%` }} /></div></td>}
              {columnVisible('stage') && <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}><select value={lead.etapa} disabled={!canEdit || stageChangePending === lead.id} onChange={(event) => void mudarEtapa(lead.id, event.target.value)} className={`rounded-md border-0 px-2.5 py-1.5 text-xs font-semibold ${etapaCores[lead.etapa] ?? 'bg-background-200 text-foreground-600'} disabled:cursor-not-allowed disabled:opacity-60`}>{etapasCRM.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></td>}
              {columnVisible('last-interaction') && <td className="px-4 py-4 text-xs text-foreground-600">{lead.ultimaInteracao && lead.ultimaInteracao !== '—' ? <span>{lead.ultimaInteracao}</span> : <div><p className="text-accent-700">Sem interação</p><button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/dashboard/atendimento?leadId=${lead.id}`); }} className="mt-1 text-xs font-semibold text-primary-700 hover:text-primary-900">Registrar</button></div>}</td>}
              {columnVisible('next-action') && <td className="px-4 py-4 text-xs">{action ? <div><p className="max-w-[180px] font-medium text-foreground-800">{action.text}</p>{action.dueAt && <p className={`mt-1 ${isPortfolioDateOverdue(action.dueAt) ? 'font-semibold text-accent-700' : 'text-foreground-500'}`}><i className={`${isPortfolioDateOverdue(action.dueAt) ? 'ri-alarm-warning-line' : 'ri-calendar-line'} mr-1`} />{isPortfolioDateOverdue(action.dueAt) ? 'Atrasada · ' : ''}{formatPortfolioDate(action.dueAt)}</p>}</div> : <div><p className="text-accent-700">Não definida</p>{canEdit && <button type="button" onClick={(event) => { event.stopPropagation(); setTarefaLead(lead); setNovaTarefa({ titulo: `Retomar contato com ${lead.nome || lead.empresa}`, dataLimite: '', prioridade: 'MEDIA' }); }} className="mt-1 text-xs font-semibold text-primary-700 hover:text-primary-900">Adicionar</button>}</div>}</td>}
              {columnVisible('owner') && <td className="px-4 py-4" onClick={(event) => event.stopPropagation()}><div className="flex items-center gap-2"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-800">{(lead.responsavel || '?').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>{canEditAll ? <select aria-label={`Responsável por ${lead.empresa || lead.nome}`} value={lead.responsavelId ?? '__ana__'} onChange={(event) => { if (event.target.value !== '__ana__') void atribuirResponsavel([lead.id], event.target.value); }} className="max-w-[120px] bg-transparent text-xs font-medium text-foreground-700"><option value="__ana__">{lead.responsavel || 'Ana (IA)'}</option>{membros.filter((member) => member.userId !== lead.responsavelId).map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select> : <span className="text-xs font-medium text-foreground-700">{lead.responsavel || 'Sem responsável'}</span>}</div></td>}
              <td className="relative px-4 py-4" onClick={(event) => event.stopPropagation()}><button type="button" aria-label={`Ações de ${lead.empresa || lead.nome}`} aria-expanded={menuAbertoId === lead.id} onClick={() => setMenuAbertoId((current) => current === lead.id ? null : lead.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-500 hover:bg-background-100 hover:text-foreground-900"><i className="ri-more-2-fill" /></button>{menuAbertoId === lead.id && <div className="absolute right-4 top-12 z-20 w-44 rounded-xl border border-background-200 bg-white p-1.5 shadow-lg"><button type="button" onClick={() => { setDetalhe(lead); setMenuAbertoId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground-700 hover:bg-background-100"><i className="ri-eye-line" />Ver detalhes</button>{canEdit && <button type="button" onClick={() => { abrirEdicao(lead); setMenuAbertoId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground-700 hover:bg-background-100"><i className="ri-edit-line" />Editar</button>}{canEdit && <button type="button" onClick={() => { void (lead.arquivado ? restaurarLead(lead.id) : arquivarLead(lead.id)); setMenuAbertoId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground-700 hover:bg-background-100"><i className={lead.arquivado ? 'ri-arrow-go-back-line' : 'ri-archive-line'} />{lead.arquivado ? 'Restaurar' : 'Arquivar'}</button>}{canDelete && <button type="button" onClick={() => { openLeadPurge([lead.id]); setMenuAbertoId(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-accent-700 hover:bg-accent-50"><i className="ri-delete-bin-line" />Excluir definitivamente</button>}</div>}</td></tr>;
          })}
          {loadStatus !== 'loading' && filtrados.length === 0 && <tr><td colSpan={3 + colunasVisiveis.length} className="px-4 py-12 text-center text-foreground-500"><i className="ri-search-line mb-2 block text-2xl text-foreground-400" />{leads.length === 0 ? 'Nenhum lead cadastrado ainda.' : 'Nenhum lead encontrado com os filtros selecionados.'}</td></tr>}
        </tbody></table></div>
        {filtrados.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-background-200 px-4 py-3"><p className="text-xs text-foreground-500">Exibindo {(paginaAtual - 1) * PAGE_SIZE + 1}–{Math.min(paginaAtual * PAGE_SIZE, filtrados.length)} de {filtrados.length} leads</p>{totalPaginas > 1 && <div className="flex items-center gap-2"><button type="button" disabled={paginaAtual === 1} onClick={() => setPagina((current) => Math.max(1, current - 1))} className="rounded-lg border border-background-300 px-3 py-1.5 text-xs font-semibold text-foreground-700 disabled:opacity-40">Anterior</button><span className="text-xs text-foreground-500">Página {paginaAtual} de {totalPaginas}</span><button type="button" disabled={paginaAtual === totalPaginas} onClick={() => setPagina((current) => Math.min(totalPaginas, current + 1))} className="rounded-lg border border-background-300 px-3 py-1.5 text-xs font-semibold text-foreground-700 disabled:opacity-40">Próxima</button></div>}</div>}
      </section>

      {purgeLeadIds && <AccessibleDialog title="Excluir leads definitivamente" className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground-950/50 p-4" onClose={() => { if (!purgingLeads) { setPurgeLeadIds(null); setPurgeConfirmation(''); } }}>
        <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-background-200 px-6 py-4"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">Ação irreversível</p><h3 className="mt-1 font-heading text-lg font-bold text-foreground-950">Excluir {purgeLeadIds.length} lead(s) definitivamente?</h3></div><button type="button" aria-label="Fechar" disabled={purgingLeads} onClick={() => { setPurgeLeadIds(null); setPurgeConfirmation(''); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-background-100 disabled:opacity-50"><i className="ri-close-line text-lg" /></button></div>
          <div className="space-y-4 p-6"><p className="text-sm leading-6 text-foreground-700">A exclusão apaga os leads selecionados e os vínculos operacionais deles, como conversas, mensagens, tarefas, propostas, eventos e filas. Essa ação não pode ser desfeita.</p><p className="rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-xs leading-5 text-primary-900"><i className="ri-shield-check-line mr-1" />O servidor confirma sua permissão e a lista exata antes de remover qualquer dado.</p><label className="block text-sm font-semibold text-foreground-800">Digite <code className="rounded bg-background-100 px-1.5 py-1 text-xs">{leadPurgeConfirmation(purgeLeadIds.length)}</code> para confirmar<input autoFocus value={purgeConfirmation} onChange={(event) => setPurgeConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-background-300 bg-white px-3 py-2.5 text-sm font-normal text-foreground-900 outline-none focus:border-accent-500" aria-label="Confirmação da exclusão definitiva" /></label></div>
          <div className="flex flex-col-reverse gap-2 border-t border-background-200 px-6 py-4 sm:flex-row sm:justify-end"><button type="button" disabled={purgingLeads} onClick={() => { setPurgeLeadIds(null); setPurgeConfirmation(''); }} className="rounded-lg border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-700 hover:bg-background-100 disabled:opacity-60">Cancelar</button><button type="button" disabled={purgingLeads || !isLeadPurgeConfirmationValid(purgeConfirmation, purgeLeadIds.length)} onClick={() => void confirmLeadPurge()} className="rounded-lg bg-accent-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50">{purgingLeads ? 'Excluindo…' : 'Excluir definitivamente'}</button></div>
        </div>
      </AccessibleDialog>}

      {tarefaLead && <AccessibleDialog title="Adicionar próxima ação" className="fixed inset-0 z-50 flex items-center justify-center bg-foreground-950/50 p-4" onClose={() => setTarefaLead(null)}>
        <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-background-200 px-6 py-4"><div><h3 className="font-heading text-lg font-bold text-foreground-950">Adicionar próxima ação</h3><p className="mt-1 text-sm text-foreground-500">{tarefaLead.empresa || tarefaLead.nome}</p></div><button type="button" aria-label="Fechar" onClick={() => setTarefaLead(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-background-100"><i className="ri-close-line text-lg" /></button></div>
          <div className="space-y-4 p-6"><label className="block text-sm font-semibold text-foreground-800">Ação <span className="text-accent-600">*</span><input autoFocus value={novaTarefa.titulo} onChange={(event) => setNovaTarefa((current) => ({ ...current, titulo: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-background-300 px-3 py-2.5 text-sm font-normal" placeholder="Ex.: Retornar com especificação" /></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold text-foreground-800">Prazo<input type="date" value={novaTarefa.dataLimite} onChange={(event) => setNovaTarefa((current) => ({ ...current, dataLimite: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-background-300 px-3 py-2.5 text-sm font-normal" /></label><label className="block text-sm font-semibold text-foreground-800">Prioridade<select value={novaTarefa.prioridade} onChange={(event) => setNovaTarefa((current) => ({ ...current, prioridade: event.target.value as 'ALTA' | 'MEDIA' | 'BAIXA' }))} className="mt-1.5 w-full rounded-lg border border-background-300 px-3 py-2.5 text-sm font-normal"><option value="ALTA">Alta</option><option value="MEDIA">Média</option><option value="BAIXA">Baixa</option></select></label></div></div>
          <div className="flex justify-end gap-2 border-t border-background-200 px-6 py-4"><button type="button" onClick={() => setTarefaLead(null)} className="rounded-lg border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-700 hover:bg-background-100">Cancelar</button><button type="button" onClick={() => void salvarTarefa()} disabled={!novaTarefa.titulo.trim()} className="rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50">Salvar ação</button></div>
        </div>
      </AccessibleDialog>}

      {possiveisDuplicados && <AccessibleDialog title="Possível duplicidade" className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground-950/50 p-4" onClose={() => setPossiveisDuplicados(null)}>
        <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between border-b border-background-200 px-6 py-4"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-accent-700">Revisão necessária</p><h3 className="mt-1 font-heading text-lg font-bold text-foreground-950">Possível lead já cadastrado</h3></div><button type="button" aria-label="Fechar" onClick={() => setPossiveisDuplicados(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-background-100"><i className="ri-close-line text-lg" /></button></div>
          <div className="space-y-3 p-6"><p className="text-sm leading-6 text-foreground-600">A coincidência não bloqueia o cadastro: revise os registros e decida se deseja criar um novo lead.</p>{possiveisDuplicados.map(({ lead, reasons }) => <div key={lead.id} className="rounded-lg border border-background-200 bg-background-50 p-3"><p className="font-semibold text-foreground-900">{lead.nome || 'Contato não informado'} · {lead.empresa || 'Empresa não informada'}</p><p className="mt-1 text-xs text-foreground-500">Coincidência por {reasons.map((reason) => duplicateReasonLabel[reason]).join(', ')}.</p></div>)}</div>
          <div className="flex flex-col-reverse gap-2 border-t border-background-200 px-6 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setPossiveisDuplicados(null)} className="rounded-lg border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-700 hover:bg-background-100">Voltar e revisar</button><button type="button" onClick={() => void criarLead(true)} className="rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-600">Criar mesmo assim</button></div>
        </div>
      </AccessibleDialog>}

      {/* Modal de escolha de modo (Ana ou Humano) ao enviar para o Kanban */}
      {envioAlvo && (
        <AccessibleDialog title="Encaminhar leads" className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClose={() => { setEnvioAlvo(null); setModoSelecionado(null); setAprovacaoKanban({ confirmada: false, origem: '' }); setHandoffEtapa(''); setHandoffAssigneeId(''); setHandoffNotifyWhatsapp(false); }}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">Enviar para o Kanban</h3>
                <p className="text-sm text-foreground-500">{envioAlvo.length} lead(s) selecionado(s)</p>
              </div>
              <button onClick={() => { setEnvioAlvo(null); setModoSelecionado(null); setAprovacaoKanban({ confirmada: false, origem: '' }); setHandoffEtapa(''); setHandoffAssigneeId(''); setHandoffNotifyWhatsapp(false); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-foreground-600 mb-4">
                Escolha quem assume o atendimento deste(s) lead(s) no funil:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setModoSelecionado('IA')}
                  className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-colors cursor-pointer text-left ${
                    modoSelecionado === 'IA'
                      ? 'border-secondary-400 bg-secondary-50 ring-2 ring-secondary-300'
                      : 'border-background-300 bg-background-50 hover:bg-background-100 hover:border-background-400'
                  }`}
                >
                  <span className="w-10 h-10 rounded-lg bg-secondary-500 text-background-50 flex items-center justify-center">
                    <i className="ri-robot-line text-lg"></i>
                  </span>
                  <div>
                    <p className="font-semibold text-foreground-900 text-sm">Ana (IA)</p>
                    <p className="text-xs text-foreground-500 mt-1">
                      A Ana conduz as etapas autorizadas e transfere preço, prazo, compromisso técnico e fechamento para aprovação humana.
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setModoSelecionado('HUMANO')}
                  className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-colors cursor-pointer text-left ${
                    modoSelecionado === 'HUMANO'
                      ? 'border-accent-400 bg-accent-50 ring-2 ring-accent-300'
                      : 'border-background-300 bg-background-50 hover:bg-background-100 hover:border-background-400'
                  }`}
                >
                  <span className="w-10 h-10 rounded-lg bg-accent-500 text-background-50 flex items-center justify-center">
                    <i className="ri-user-line text-lg"></i>
                  </span>
                  <div>
                    <p className="font-semibold text-foreground-900 text-sm">Humano</p>
                    <p className="text-xs text-foreground-500 mt-1">
                      Cria uma tarefa de primeiro contato para um vendedor da equipe assumir manualmente.
                    </p>
                  </div>
                </button>
              </div>

              {modoSelecionado === 'IA' && (
                <div className="mt-4 pt-4 border-t border-background-100">
                  {envioAlvo.some((id) => { const lead = leads.find((item) => item.id === id); return lead?.contactApprovalStatus !== 'approved' || !lead.whatsapp; }) && <div className="mb-4 rounded-xl border border-accent-200 bg-accent-50 p-4"><label className="flex cursor-pointer items-start gap-2 text-xs text-accent-900"><input type="checkbox" checked={aprovacaoKanban.confirmada} onChange={(e) => setAprovacaoKanban((current) => ({ ...current, confirmada: e.target.checked }))} className="mt-0.5" /><span>Confirmo que os números selecionados são WhatsApp e que os destinatários autorizaram o contato da Wayflex.</span></label>{aprovacaoKanban.confirmada && <input type="text" value={aprovacaoKanban.origem} onChange={(e) => setAprovacaoKanban((current) => ({ ...current, origem: e.target.value }))} placeholder="Origem da autorização: formulário, evento, solicitação…" className="mt-3 w-full rounded-lg border border-accent-200 bg-white px-3 py-2 text-sm text-foreground-900" />}</div>}
                  <label className="block text-xs font-semibold text-foreground-600 mb-1.5 flex items-center gap-1.5">
                    <i className="ri-robot-line text-secondary-600"></i>
                    Até qual etapa a Ana atende antes de transferir pro humano?
                  </label>
                  <select
                    value={handoffEtapa}
                    onChange={(e) => setHandoffEtapa(e.target.value)}
                    className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
                  >
                    <option value="">Até o fim do funil (Ana conduz tudo)</option>
                    {handoffStages.map((stage) => (
                      <option key={stage} value={stage}>{handoffStageLabels[stage]}</option>
                    ))}
                  </select>
                  {handoffEtapa && <div className="mt-3 space-y-3 rounded-xl border border-background-200 bg-background-100/60 p-3">
                    <label className="block text-xs font-semibold text-foreground-600">Vendedor que assumirá a transferência<select value={handoffAssigneeId} onChange={(event) => setHandoffAssigneeId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900"><option value="">Selecione um usuário ativo</option>{membros.map((member) => <option key={member.userId} value={member.userId}>{member.name} · {member.role}</option>)}</select></label>
                    <label className="flex items-start gap-2 text-xs text-foreground-700"><input type="checkbox" checked={handoffNotifyWhatsapp} onChange={(event) => setHandoffNotifyWhatsapp(event.target.checked)} className="mt-0.5" /><span><strong>Enviar aviso interno por WhatsApp</strong><span className="mt-0.5 block text-foreground-500">O número é configurado em Usuários &gt; Aviso de transferência. O aviso não entra no histórico do lead.</span></span></label>
                  </div>}
                  <p className="text-[11px] text-foreground-400 mt-1.5">Ao atingir a etapa escolhida, a Ana pausa, cria a tarefa e transfere ao vendedor definido. A regra é gravada no servidor.</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => { setEnvioAlvo(null); setModoSelecionado(null); setAprovacaoKanban({ confirmada: false, origem: '' }); setHandoffEtapa(''); setHandoffAssigneeId(''); setHandoffNotifyWhatsapp(false); }} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button
                onClick={() => modoSelecionado && enviarParaKanban(envioAlvo, modoSelecionado, modoSelecionado === 'IA' && handoffEtapa ? handoffEtapa as HandoffStage : undefined)}
                disabled={!modoSelecionado || (modoSelecionado === 'IA' && Boolean(handoffEtapa) && !handoffAssigneeId) || (modoSelecionado === 'IA' && envioAlvo.some((id) => { const lead = leads.find((item) => item.id === id); return lead?.contactApprovalStatus !== 'approved' || !lead.whatsapp; }) && (!aprovacaoKanban.confirmada || !aprovacaoKanban.origem.trim()))}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 disabled:cursor-not-allowed text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
              >
                <i className="ri-send-plane-2-line"></i>
                Enviar para o Kanban
              </button>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Modal de detalhes */}
      {detalhe && (
        <AccessibleDialog title="Detalhes do registro" className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClose={() => setDetalhe(null)}>
          <div
            className="bg-background-50 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">{detalhe.nome}</h3>
                <p className="text-sm text-foreground-500">{detalhe.empresa}</p>
              </div>
              <button aria-label="Fechar detalhes" onClick={() => setDetalhe(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${etapaCores[detalhe.etapa]}`}>{detalhe.etapa}</span>
                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">Score {detalhe.score}</span>
                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-accent-100 text-accent-700">{detalhe.temperatura}</span>
                <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${detalhe.contactApprovalStatus === 'approved' ? 'bg-primary-100 text-primary-700' : 'bg-background-200 text-foreground-600'}`}>{detalhe.contactApprovalStatus === 'approved' ? 'Contato autorizado' : 'Aguardando autorização'}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl border border-background-200 bg-background-100/50 p-3 text-center">
                <div><p className="text-base font-bold text-foreground-900">{detalhe.fitScore ?? detalhe.score}</p><p className="text-[10px] text-foreground-500">Aderência</p></div>
                <div><p className="text-base font-bold text-foreground-900">{detalhe.contactabilityScore ?? 0}</p><p className="text-[10px] text-foreground-500">Contato</p></div>
                <div><p className="text-base font-bold text-foreground-900">{detalhe.engagementScore ?? 0}</p><p className="text-[10px] text-foreground-500">Engajamento</p></div>
              </div>
              {detalhe.scoreExplanation && <p className="text-xs text-foreground-600">{detalhe.scoreExplanation}</p>}
              {detalhe.contactApprovalReason && <p className="text-xs text-foreground-600"><strong>Autorização:</strong> {detalhe.contactApprovalReason}</p>}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-foreground-500 text-xs">CNPJ</p>
                  <p className="text-foreground-900">{detalhe.cnpj}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Porte</p>
                  <p className="text-foreground-900">{detalhe.porte}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">E-mail</p>
                  <p className="text-foreground-900 truncate">{detalhe.email}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">WhatsApp</p>
                  <p className="text-foreground-900">{detalhe.whatsapp}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Localização</p>
                  <p className="text-foreground-900">{detalhe.cidade} - {detalhe.estado}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Origem</p>
                  <p className="text-foreground-900">{detalhe.origem}</p>
                </div>
              </div>

              <div>
                <p className="text-foreground-500 text-xs mb-1.5">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {detalhe.tags.length > 0 ? detalhe.tags.map((t) => (
                    <span key={t} className="px-2.5 py-1 rounded-md text-xs bg-secondary-100 text-secondary-800">{t}</span>
                  )) : <span className="text-sm text-foreground-400">Sem tags</span>}
                </div>
              </div>

              <div className="pt-4 border-t border-background-200/70 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => { abrirEdicao(detalhe); setDetalhe(null); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-edit-line"></i>
                  Editar
                </button>
                {detalhe.arquivado ? (
                  <button
                    onClick={() => restaurarLead(detalhe.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-secondary-500 hover:bg-secondary-600 text-background-50 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-arrow-go-back-line"></i>
                    Restaurar
                  </button>
                ) : (
                  <button
                    onClick={() => arquivarLead(detalhe.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-background-50 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-archive-line"></i>
                    Arquivar
                  </button>
                )}
                {canDelete && <button
                  onClick={() => openLeadPurge([detalhe.id])}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-accent-300 text-accent-700 rounded-lg text-sm font-semibold hover:bg-accent-50 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-delete-bin-6-line" />
                  Excluir definitivamente
                </button>}
                <button
                  onClick={() => setDetalhe(null)}
                  className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
                >
                  Fechar
                </button>
                <button
                  onClick={() => { setDetalhe(null); navigate(`/dashboard/atendimento?leadId=${detalhe.id}`); }}
                  className="px-4 py-2.5 bg-primary-500 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  Abrir conversa
                </button>
              </div>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Modal Novo Lead */}
      {novoModal && (
        <AccessibleDialog title="Novo registro" className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClose={() => setNovoModal(false)}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Novo Lead</h3>
              <button aria-label="Fechar formulário" onClick={() => setNovoModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome <span className="text-accent-600">*</span></label>
                <input type="text" value={novoLead.nome} onChange={(e) => setNovoLead({ ...novoLead, nome: e.target.value })} placeholder="Nome do contato" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Empresa <span className="text-accent-600">*</span></label>
                <input type="text" value={novoLead.empresa} onChange={(e) => setNovoLead({ ...novoLead, empresa: e.target.value })} placeholder="Nome da empresa" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">E-mail</label>
                  <input type="email" value={novoLead.email} onChange={(e) => setNovoLead({ ...novoLead, email: e.target.value })} placeholder="contato@empresa.com" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Telefone</label>
                  <input type="text" value={novoLead.telefone} onChange={(e) => setNovoLead({ ...novoLead, telefone: e.target.value })} placeholder="(00) 00000-0000" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Segmento</label>
                  <select value={novoLead.segmento} onChange={(e) => setNovoLead({ ...novoLead, segmento: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                    {segmentos.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Cidade</label>
                  <input type="text" value={novoLead.cidade} onChange={(e) => setNovoLead({ ...novoLead, cidade: e.target.value })} placeholder="Cidade" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">UF</label>
                  <input type="text" value={novoLead.estado} onChange={(e) => setNovoLead({ ...novoLead, estado: e.target.value })} placeholder="UF" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Modo de atendimento <span className="text-accent-600">*</span></label>
                <select value={novoLead.modo} onChange={(e) => setNovoLead({ ...novoLead, modo: e.target.value as 'IA' | 'HUMANO' })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  <option value="IA">Ana (IA) — gera rascunhos para revisão</option>
                  <option value="HUMANO">Humano — sem disparo automático</option>
                </select>
                <p className="mt-1.5 text-xs text-foreground-500">Você será definido como responsável por este lead.</p>
              </div>
              <div className="rounded-xl border border-background-200 bg-background-100/50 p-4">
                <p className="text-xs font-semibold text-foreground-800">Contato pendente de validação</p>
                <p className="mt-1 text-[11px] leading-relaxed text-foreground-500">O lead será criado normalmente. O telefone não será tratado como WhatsApp e a Ana não fará o primeiro contato até a autorização ser registrada.</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button aria-label="Fechar formulário" onClick={() => setNovoModal(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={() => void criarLead()} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Criar lead</button>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Modal Editar Lead */}
      {editarModal && (
        <AccessibleDialog title="Editar lead" className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClose={() => setEditarModal(null)}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">Editar Lead</h3>
                <p className="text-sm text-foreground-500">{editarModal.empresa}</p>
              </div>
              <button onClick={() => setEditarModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome <span className="text-accent-600">*</span></label>
                <input type="text" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <label className="block text-sm font-medium text-foreground-800">Empresa<input value={editForm.empresa} onChange={(e) => setEditForm({ ...editForm, empresa: e.target.value })} className="mt-1.5 w-full rounded-lg border border-background-300 px-4 py-2.5" /></label>
              <div className="grid grid-cols-[1fr_5rem] gap-3">
                <label className="block text-sm font-medium text-foreground-800">Cidade<input value={editForm.cidade} onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })} className="mt-1.5 w-full rounded-lg border border-background-300 px-4 py-2.5" /></label>
                <label className="block text-sm font-medium text-foreground-800">UF<input maxLength={2} value={editForm.estado} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value.toUpperCase() })} className="mt-1.5 w-full rounded-lg border border-background-300 px-3 py-2.5" /></label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">E-mail</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Telefone / WhatsApp</label>
                  <input type="text" value={editForm.telefone} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Responsável</label>
                <select value={editForm.responsavelId || '__ana__'} onChange={(e) => setEditForm({ ...editForm, responsavelId: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  <option value="__ana__">Ana (IA)</option>
                  {editForm.responsavelId && !membros.some((membro) => membro.userId === editForm.responsavelId) && (
                    <option value={editForm.responsavelId}>{editForm.responsavel || 'Responsável atual'}</option>
                  )}
                  {membros.map((membro) => <option key={membro.userId} value={membro.userId}>{membro.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Tags (separadas por vírgula)</label>
                <input type="text" value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} placeholder="Decisor, Urgente" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setEditarModal(null)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvarEdicao} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Salvar alterações</button>
            </div>
          </div>
        </AccessibleDialog>
      )}
    </div>
  );
}
