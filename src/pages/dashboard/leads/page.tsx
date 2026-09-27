import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { refreshLeadsStore, useLeadsStore, waitForLeadsPersistence } from '@/hooks/useLeadsStore';
import { etapasCRM, segmentos } from '@/mocks/leadsData';
import type { Lead } from '@/mocks/leadsData';
import { canonicalStageKeyFromLabel, CommercialTransitionError, transitionOperationalLeadStage } from '@/lib/crm/leadStageRepository';
import { useListasStore } from '@/hooks/useListasStore';
import { useFluxoComercial } from '@/hooks/useFluxoComercial';
import { useAuth } from '@/hooks/useAuth';
import { loadTeamMembers, type TeamMember } from '@/lib/crm/teamMembersRepository';
import { approvedAnaWhatsAppChannel, pendingManualLeadContact } from '@/lib/crm/manualLeadContact';
import { configureLeadHandoffPolicy, handoffStages, type HandoffStage } from '@/lib/crm/handoffPolicyRepository';
import { activateLeadWithAna } from '@/lib/crm/leadWorkflowRepository';

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

const tempCores: Record<string, string> = {
  Frio: 'text-foreground-400',
  Morno: 'text-accent-600',
  Quente: 'text-accent-500',
};

export default function Leads() {
  const [leads, setLeads] = useLeadsStore();
  const [searchParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [etapaFiltro, setEtapaFiltro] = useState(() => searchParams.get('etapa') || 'Todas');
  const [segmentoFiltro, setSegmentoFiltro] = useState('Todos');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [envioAlvo, setEnvioAlvo] = useState<string[] | null>(null);
  const [detalhe, setDetalhe] = useState<Lead | null>(null);
  const [toast, setToast] = useState('');
  const [novoModal, setNovoModal] = useState(false);
  const [novoLead, setNovoLead] = useState({ nome: '', empresa: '', email: '', telefone: '', segmento: 'Tecnologia', cidade: '', estado: '', modo: 'IA' as 'IA' | 'HUMANO' });
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [editarModal, setEditarModal] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState({ nome: '', email: '', telefone: '', responsavel: '', responsavelId: '', tags: '' });
  const [membros, setMembros] = useState<TeamMember[]>([]);
  const [handoffEtapa, setHandoffEtapa] = useState('');
  const [handoffAssigneeId, setHandoffAssigneeId] = useState('');
  const [handoffNotifyWhatsapp, setHandoffNotifyWhatsapp] = useState(false);
  const [modoSelecionado, setModoSelecionado] = useState<'IA' | 'HUMANO' | null>(null);
  const [aprovacaoKanban, setAprovacaoKanban] = useState({ confirmada: false, origem: '' });
  const [stageChangePending, setStageChangePending] = useState<string | null>(null);
  const navigate = useNavigate();
  const listas = useListasStore();
  const fluxo = useFluxoComercial();
  const { user } = useAuth();

  useEffect(() => {
    void loadTeamMembers()
      .then((result) => setMembros(result.filter((member) => member.status === 'active')))
      .catch(() => setMembros([]));
  }, []);

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const abrirEdicao = (lead: Lead) => {
    setEditarModal(lead);
    setEditForm({
      nome: lead.nome,
      email: lead.email,
      telefone: lead.telefone,
      responsavel: lead.responsavel,
      responsavelId: lead.responsavelId,
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

  const criarLead = async () => {
    if (!novoLead.nome.trim() || !novoLead.empresa.trim()) {
      mostrarToast('Preencha ao menos nome e empresa.');
      return;
    }
    const normalizar = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const email = normalizar(novoLead.email);
    const tel = normalizar(novoLead.telefone);
    const empresa = normalizar(novoLead.empresa);
    const duplicado = leads.some((e) => {
      const eEx = normalizar(e.email);
      const tEx = normalizar(e.whatsapp || e.telefone);
      const emEx = normalizar(e.empresa);
      return (
        (email && eEx && email === eEx) ||
        (tel && tEx && tel === tEx) ||
        (empresa && emEx && empresa === emEx)
      );
    });
    if (duplicado) {
      mostrarToast('Já existe um lead com este e-mail, telefone ou empresa.');
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
    setNovoLead({ nome: '', empresa: '', email: '', telefone: '', segmento: 'Tecnologia', cidade: '', estado: '', modo: 'IA' });
    if (novo.modoAtendimento === 'IA') {
      setEnvioAlvo([novo.id]);
      setModoSelecionado('IA');
      mostrarToast('Lead criado. Confirme o canal e a autorização para ativar a Ana.');
      return;
    }
    mostrarToast('Lead criado em atendimento humano.');
  };

  const base = mostrarArquivados ? leads.filter((l) => l.arquivado) : leads.filter((l) => !l.arquivado);
  const filtrados = base.filter((l) => {
    const matchBusca = (l.nome + l.empresa + l.segmento).toLowerCase().includes(busca.toLowerCase());
    const matchEtapa = etapaFiltro === 'Todas' || l.etapa === etapaFiltro;
    const matchSegmento = segmentoFiltro === 'Todos' || l.segmento === segmentoFiltro;
    return matchBusca && matchEtapa && matchSegmento;
  });

  const toggleSelecionado = (id: string) => {
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter((s) => s !== id));
    } else {
      setSelecionados([...selecionados, id]);
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
    <div className="wf-page">
      <header className="wf-page-header">
        <div>
          <p className="wf-eyebrow">Carteira comercial</p>
          <div className="mt-1 flex items-center gap-2"><h1 className="wf-page-title">Leads</h1><InfoTooltip text="Consulte a carteira, acompanhe a etapa e abra o próximo atendimento." label="Sobre Leads" align="start" /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-background-200 bg-white px-3 py-2 text-xs font-semibold tabular-nums text-foreground-600">{filtrados.length} exibidos · {leads.length} na carteira</span>
          <button
            onClick={() => setNovoModal(true)}
            className="wf-btn-primary cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line" aria-hidden="true"></i>
            Novo Lead
          </button>
        </div>
      </header>

      {toast && (
        <div className="mb-4 bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      {/* Listas recebidas da Busca de Leads (aguardando aprovação) */}
      {listas.listas.filter((l) => l.status === 'pendente').length > 0 && (
        <section className="wf-surface p-4 sm:p-5" aria-label="Listas aguardando revisão">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <i className="ri-list-check-3 text-primary-600 text-lg"></i>
              <h3 className="font-heading font-bold text-foreground-900 text-sm">Listas recebidas da Busca de Leads</h3>
            </div>
            <span className="text-xs text-foreground-500">Revise as listas antes de avançar para o Kanban.</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {listas.listas.filter((l) => l.status === 'pendente').map((lista) => (
              <div key={lista.id} className="rounded-xl border border-background-200/70 bg-background-100/40 p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground-900 text-sm break-words">{lista.nome}</p>
                    <p className="text-xs text-foreground-500">{lista.cidade} - {lista.estado} · {lista.segmento}</p>
                  </div>
                  <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-accent-100 text-accent-700 whitespace-nowrap flex-shrink-0">
                    {lista.total} leads
                  </span>
                </div>
                <p className="text-xs text-foreground-400 mb-3">Fonte: {lista.fonte}</p>
                <button
                  onClick={() => setEnvioAlvo(lista.leadIds)}
                  disabled={lista.leadIds.length === 0}
                  className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-foreground-950 px-4 py-2 text-xs font-bold text-white hover:bg-foreground-800 cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-send-plane-2-line"></i>
                  {lista.leadIds.length ? 'Enviar para o Kanban' : 'Lista sem leads vinculados'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filtros */}
      <div className="wf-toolbar">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar leads por nome, empresa ou segmento</span>
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, empresa ou segmento..."
            className="w-full pl-9 pr-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-800 placeholder-foreground-400 focus:outline-none focus:border-primary-400"
          />
        </label>
        <select
          aria-label="Filtrar por etapa"
          value={etapaFiltro}
          onChange={(e) => setEtapaFiltro(e.target.value)}
          className="w-full bg-background-50 px-3 py-2 text-sm text-foreground-700 cursor-pointer lg:w-auto"
        >
          <option value="Todas">Todas as etapas</option>
          {etapasCRM.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar por segmento"
          value={segmentoFiltro}
          onChange={(e) => setSegmentoFiltro(e.target.value)}
          className="w-full bg-background-50 px-3 py-2 text-sm text-foreground-700 cursor-pointer lg:w-auto"
        >
          <option value="Todos">Todos os segmentos</option>
          {segmentos.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={() => setMostrarArquivados(!mostrarArquivados)}
          aria-pressed={mostrarArquivados}
          className={`inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold cursor-pointer whitespace-nowrap border ${
            mostrarArquivados
              ? 'bg-accent-100 border-accent-300 text-accent-800'
              : 'bg-background-50 border-background-300 text-foreground-600 hover:bg-background-100'
          }`}
        >
          <i className="ri-archive-line"></i>
          Arquivados
          {leads.filter((l) => l.arquivado).length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-background-50 text-xs">{leads.filter((l) => l.arquivado).length}</span>
          )}
        </button>
      </div>

      {/* Barra de ações em massa */}
      {selecionados.length > 0 && (
        <div className="mb-4 bg-primary-50 border border-primary-200 rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-primary-800">{selecionados.length} selecionados</span>
          <select
            disabled={stageChangePending === 'bulk'}
            onChange={(e) => e.target.value && void mudarEtapaEmMassa(e.target.value)}
            defaultValue=""
            className="px-3 py-1.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-700 cursor-pointer"
          >
            <option value="" disabled>Mover para etapa...</option>
            {etapasCRM.filter((e) => !['Ganho', 'Perdido'].includes(e)).map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <button
            onClick={() => setEnvioAlvo(selecionados)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-send-plane-2-line"></i>
            Enviar para Kanban
          </button>
          <button
            onClick={() => { setSelecionados([]); mostrarToast('Seleção limpa'); }}
            className="text-sm text-foreground-500 hover:text-foreground-700 cursor-pointer"
          >
            Limpar seleção
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="wf-table-shell">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selecionados.length === filtrados.length && filtrados.length > 0}
                    onChange={(e) => setSelecionados(e.target.checked ? filtrados.map((l) => l.id) : [])}
                    className="cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Lead / Empresa</th>
                <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Segmento</th>
                <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Score</th>
                <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Etapa</th>
                <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs hidden lg:table-cell">Responsável</th>
                <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((lead) => (
                <tr key={lead.id} className="border-b border-background-100 hover:bg-background-50/50 transition-colors">
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={selecionados.includes(lead.id)}
                      onChange={() => toggleSelecionado(lead.id)}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3.5 cursor-pointer" onClick={() => setDetalhe(lead)}>
                    <p className="font-medium text-foreground-900">{lead.nome}</p>
                    <p className="text-foreground-500 text-xs">{lead.empresa}</p>
                    <span className={`inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${(lead.modoAtendimento ?? 'IA') === 'IA' ? 'bg-secondary-100 text-secondary-800' : 'bg-accent-100 text-accent-800'}`}>
                      <i className={`${(lead.modoAtendimento ?? 'IA') === 'IA' ? 'ri-robot-line' : 'ri-user-line'} text-[10px]`}></i>
                      {(lead.modoAtendimento ?? 'IA') === 'IA' ? 'IA' : 'Humano'}
                    </span>
                    {lead.aguardandoAtivacao && (
                      <span className="inline-flex items-center gap-0.5 ml-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent-100 text-accent-700">
                        <i className="ri-time-line text-[10px]"></i>
                        Aguardando
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-foreground-600 hidden md:table-cell">{lead.segmento}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground-900">{lead.score}</span>
                      <i className={`ri-fire-line text-sm ${tempCores[lead.temperatura]}`}></i>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <select
                      value={lead.etapa}
                      onChange={(e) => void mudarEtapa(lead.id, e.target.value)}
                      disabled={stageChangePending === lead.id}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer border-0 focus:outline-none ${etapaCores[lead.etapa]}`}
                    >
                      {etapasCRM.map((e) => (
                        <option key={e} value={e}>{e}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3.5 text-foreground-600 hidden lg:table-cell">{lead.responsavel}</td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => setDetalhe(lead)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer"
                    >
                      <i className="ri-eye-line"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-foreground-500">
                    <i className="ri-search-line mb-2 block text-2xl text-foreground-400" aria-hidden="true"></i>
                    Nenhum lead encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de escolha de modo (Ana ou Humano) ao enviar para o Kanban */}
      {envioAlvo && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => { setEnvioAlvo(null); setModoSelecionado(null); setAprovacaoKanban({ confirmada: false, origem: '' }); setHandoffEtapa(''); setHandoffAssigneeId(''); setHandoffNotifyWhatsapp(false); }}>
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
        </div>
      )}

      {/* Modal de detalhes */}
      {detalhe && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setDetalhe(null)}>
          <div
            className="bg-background-50 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">{detalhe.nome}</h3>
                <p className="text-sm text-foreground-500">{detalhe.empresa}</p>
              </div>
              <button onClick={() => setDetalhe(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
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
        </div>
      )}

      {/* Modal Novo Lead */}
      {novoModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setNovoModal(false)}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Novo Lead</h3>
              <button onClick={() => setNovoModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
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
              <button onClick={() => setNovoModal(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={criarLead} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Criar lead</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Lead */}
      {editarModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setEditarModal(null)}>
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
        </div>
      )}
    </div>
  );
}
import InfoTooltip from '@/components/feature/InfoTooltip';
