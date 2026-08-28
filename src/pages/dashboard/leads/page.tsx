import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { etapasCRM, segmentos } from '@/mocks/leadsData';
import type { Lead } from '@/mocks/leadsData';
import { podeTransicionar } from '@/lib/automacao';
import { useListasStore } from '@/hooks/useListasStore';
import { useFluxoComercial } from '@/hooks/useFluxoComercial';

const etapaCores: Record<string, string> = {
  'Novo': 'bg-background-200 text-foreground-600',
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
  const [busca, setBusca] = useState('');
  const [etapaFiltro, setEtapaFiltro] = useState('Todas');
  const [segmentoFiltro, setSegmentoFiltro] = useState('Todos');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [envioAlvo, setEnvioAlvo] = useState<string[] | null>(null);
  const [detalhe, setDetalhe] = useState<Lead | null>(null);
  const [toast, setToast] = useState('');
  const [novoModal, setNovoModal] = useState(false);
  const [novoLead, setNovoLead] = useState({ nome: '', empresa: '', email: '', telefone: '', segmento: 'Tecnologia', cidade: '', estado: '' });
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [editarModal, setEditarModal] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState({ nome: '', email: '', telefone: '', responsavel: '', tags: '' });
  const [handoffEtapa, setHandoffEtapa] = useState('');
  const [modoSelecionado, setModoSelecionado] = useState<'IA' | 'HUMANO' | null>(null);
  const navigate = useNavigate();
  const listas = useListasStore();
  const fluxo = useFluxoComercial();

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
      tags: lead.tags.join(', '),
    });
  };

  const salvarEdicao = () => {
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
    setLeads((prev) =>
      prev.map((l) =>
        l.id === editarModal.id
          ? {
              ...l,
              nome: editForm.nome.trim(),
              email: editForm.email.trim(),
              telefone: editForm.telefone.trim(),
              whatsapp: editForm.telefone.trim() || l.whatsapp,
              responsavel: editForm.responsavel,
              responsavelId: editForm.responsavel === 'Ana (IA)' ? '' : l.responsavelId,
              tags,
            }
          : l
      )
    );
    setEditarModal(null);
    mostrarToast('Lead atualizado com sucesso!');
  };

  const arquivarLead = (id: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, arquivado: true } : l)));
    setDetalhe(null);
    mostrarToast('Lead arquivado. Ele ficará fora do funil ativo.');
  };

  const restaurarLead = (id: string) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, arquivado: false } : l)));
    setDetalhe(null);
    mostrarToast('Lead restaurado para o funil ativo.');
  };

  // Aprova os leads selecionados: tira do estado "aguardando" e dispara a Ana
  // (ou cria tarefa para humano), marcando listas totalmente ativadas.
  const enviarParaKanban = (ids: string[], modo: 'IA' | 'HUMANO', etapaHandoff?: string) => {
    if (ids.length === 0) return;
    const r = fluxo.ativarParaKanban(ids, modo, etapaHandoff);
    const idsSet = new Set(ids);
    listas.listas.forEach((lista) => {
      if (lista.status === 'pendente' && lista.leadIds.length > 0 && lista.leadIds.every((lid) => idsSet.has(lid))) {
        listas.atualizar(lista.id, { status: 'ativada' });
      }
    });
    const resumo =
      r.disparados > 0
        ? `${r.disparados} lead(s) assumido(s) pela Ana`
        : '';
    const tarefas = r.tarefas > 0 ? `${r.tarefas} tarefa(s) criada(s) para humano` : '';
    const partes = [resumo, tarefas].filter(Boolean);
    mostrarToast(
      `${ids.length} lead(s) enviados ao Kanban${partes.length ? ' · ' + partes.join(' · ') : ''}.`
    );
    setSelecionados([]);
    setEnvioAlvo(null);
    setModoSelecionado(null);
  };

  const criarLead = () => {
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
    const novo: Lead = {
      id: crypto.randomUUID(),
      nome: novoLead.nome.trim(),
      empresa: novoLead.empresa.trim(),
      cnpj: '',
      email: novoLead.email.trim(),
      telefone: novoLead.telefone.trim(),
      whatsapp: novoLead.telefone.trim(),
      segmento: novoLead.segmento,
      cidade: novoLead.cidade.trim() || '—',
      estado: novoLead.estado.trim() || '—',
      porte: 'Pequeno',
      score: 50,
      temperatura: 'Morno',
      etapa: 'Novo',
      origem: 'Manual',
      responsavel: 'Você',
      tags: [],
      modoAtendimento: 'IA',
      automacaoStatus: 'ATIVA',
      canalPreferencial: 'WhatsApp',
      templateId: 'tm-1',
      contatoPermitido: true,
      consentimentoWhatsApp: true,
      consentimentoEmail: true,
      ultimaInteracao: 'agora',
      criadoEm: new Date().toISOString().slice(0, 10),
    };
    setLeads((prev) => [novo, ...prev]);
    // Lead criado manualmente entra direto no funil: ativa a Ana (primeiro contato
    // + cadência) para não ficar parado na etapa "Novo".
    fluxo.ativarParaKanban([novo.id], 'IA');
    setNovoModal(false);
    setNovoLead({ nome: '', empresa: '', email: '', telefone: '', segmento: 'Tecnologia', cidade: '', estado: '' });
    mostrarToast('Lead criado e enviado ao Kanban — a Ana iniciou o primeiro contato.');
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

  const mudarEtapa = (id: string, etapa: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.etapa === etapa) return;
    const check = podeTransicionar(lead.etapa, etapa);
    if (!check.ok) {
      mostrarToast(check.motivo || 'Transição não permitida.');
      return;
    }
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              etapa,
              motivoPerda: etapa === 'Fechado — Perdido' ? (l.motivoPerda || 'Sem resposta') : l.motivoPerda,
              automacaoStatus: ['Fechado — Ganho', 'Fechado — Perdido', 'Pausado'].includes(etapa) ? 'CONCLUIDA' : l.automacaoStatus,
            }
          : l
      )
    );
  };

  const mudarEtapaEmMassa = (etapa: string) => {
    setLeads((prev) =>
      prev.map((l) =>
        selecionados.includes(l.id)
          ? {
              ...l,
              etapa,
              automacaoStatus: ['Fechado — Ganho', 'Fechado — Perdido', 'Pausado'].includes(etapa) ? 'CONCLUIDA' : l.automacaoStatus,
            }
          : l
      )
    );
    mostrarToast(`${selecionados.length} leads atualizados para "${etapa}"`);
    setSelecionados([]);
  };

  return (
    <div className="wf-page">
      <div className="wf-page-header">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">CRM</p>
          <h1 className="wf-page-title mt-1">
            Leads
          </h1>
          <p className="wf-page-description">
            {leads.length} leads no funil · CRM completo com score, tags e responsáveis.
          </p>
        </div>
        <button
          onClick={() => setNovoModal(true)}
          className="wf-btn-primary cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          Novo Lead
        </button>
      </div>

      {toast && (
        <div className="mb-4 bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      {/* Listas recebidas da Busca de Leads (aguardando aprovação) */}
      {listas.listas.filter((l) => l.status === 'pendente').length > 0 && (
        <div className="mb-5 bg-background-50 border border-background-200/70 rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <i className="ri-list-check-3 text-primary-600 text-lg"></i>
              <h3 className="font-heading font-bold text-foreground-900 text-sm">Listas recebidas da Busca de Leads</h3>
            </div>
            <span className="text-xs text-foreground-500">Aprove para disparar a Ana no primeiro contato</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {listas.listas.filter((l) => l.status === 'pendente').map((lista) => (
              <div key={lista.id} className="border border-background-200/70 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground-900 text-sm truncate">{lista.nome}</p>
                    <p className="text-xs text-foreground-500">{lista.cidade} - {lista.estado} · {lista.segmento}</p>
                  </div>
                  <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-accent-100 text-accent-700 whitespace-nowrap flex-shrink-0">
                    {lista.total} leads
                  </span>
                </div>
                <p className="text-xs text-foreground-400 mb-3">Fonte: {lista.fonte}</p>
                <button
                  onClick={() => setEnvioAlvo(lista.leadIds)}
                  className="w-full inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-send-plane-2-line"></i>
                  Enviar para o Kanban
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="wf-toolbar mb-5">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, empresa ou segmento..."
            className="w-full pl-9 pr-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-800 placeholder-foreground-400 focus:outline-none focus:border-primary-400"
          />
        </div>
        <select
          value={etapaFiltro}
          onChange={(e) => setEtapaFiltro(e.target.value)}
          className="px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-700 cursor-pointer"
        >
          <option value="Todas">Todas as etapas</option>
          {etapasCRM.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select
          value={segmentoFiltro}
          onChange={(e) => setSegmentoFiltro(e.target.value)}
          className="px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-700 cursor-pointer"
        >
          <option value="Todos">Todos os segmentos</option>
          {segmentos.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={() => setMostrarArquivados(!mostrarArquivados)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap border ${
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
            onChange={(e) => e.target.value && mudarEtapaEmMassa(e.target.value)}
            defaultValue=""
            className="px-3 py-1.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-700 cursor-pointer"
          >
            <option value="" disabled>Mover para etapa...</option>
            {etapasCRM.map((e) => (
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
      <div className="wf-surface overflow-hidden">
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
                      onChange={(e) => mudarEtapa(lead.id, e.target.value)}
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
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => { setEnvioAlvo(null); setModoSelecionado(null); }}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">Enviar para o Kanban</h3>
                <p className="text-sm text-foreground-500">{envioAlvo.length} lead(s) selecionado(s)</p>
              </div>
              <button onClick={() => { setEnvioAlvo(null); setModoSelecionado(null); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
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
                      A Ana faz o primeiro contato e assume a conversa de ponta a ponta, respondendo e avançando o funil automaticamente.
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
                    {['Novo', 'Em Contato', 'Aguardando Resposta', 'Em Qualificação', 'Reunião Agendada', 'Proposta em Preparação', 'Orçamento Enviado', 'Negociação'].map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-foreground-400 mt-1.5">
                    Ao chegar nessa etapa, a Ana transfere o lead pro vendedor (com tarefa e notificação). Vale apenas para a opção Ana (IA).
                  </p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => { setEnvioAlvo(null); setModoSelecionado(null); }} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button
                onClick={() => modoSelecionado && enviarParaKanban(envioAlvo, modoSelecionado, modoSelecionado === 'IA' ? handoffEtapa || undefined : undefined)}
                disabled={!modoSelecionado}
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
              </div>

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
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Telefone / WhatsApp</label>
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
                <select value={editForm.responsavel} onChange={(e) => setEditForm({ ...editForm, responsavel: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  {['Ana (IA)', 'Marina Sales', 'João Vendedor', 'Paula SDR', 'Lucas CX', 'Você'].map((r) => <option key={r} value={r}>{r}</option>)}
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
