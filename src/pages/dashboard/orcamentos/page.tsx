import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Proposta, ItemProposta } from '@/mocks/propostasData';
import { useLeadsStore } from '@/hooks/useLeadsStore';
import { usePropostasStore } from '@/hooks/usePropostasStore';
import { useConfiguracaoStore } from '@/hooks/useConfiguracaoStore';
import { useTarefasStore } from '@/hooks/useTarefasStore';
import { useNotificacoesStore } from '@/hooks/useNotificacoesStore';
import { useFluxoComercial } from '@/hooks/useFluxoComercial';
import { useTemplatesPropostaStore } from '@/hooks/useTemplatesPropostaStore';
import { useTemplatesDocumentoStore } from '@/hooks/useTemplatesDocumentoStore';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import { useVariaveisGlobaisStore } from '@/hooks/useVariaveisGlobaisStore';
import { useTemasStore } from '@/hooks/useTemasStore';
import { montarValoresVariaveis, resolverVariaveis } from '@/lib/variaveis';
import { useCatalogoStore } from '@/hooks/useCatalogoStore';
import { newProposalNumber } from '@/lib/crm/proposalsRepository';
import { useAuth } from '@/hooks/useAuth';

const statusLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  visualizada: 'Visualizada',
  aceita: 'Aceita',
  recusada: 'Recusada',
  expirada: 'Expirada',
  aguardando_aprovacao: 'Aguardando aprovação',
};

const statusCor: Record<string, string> = {
  rascunho: 'bg-background-200 text-foreground-600',
  enviada: 'bg-primary-100 text-primary-700',
  visualizada: 'bg-accent-100 text-accent-700',
  aceita: 'bg-secondary-500 text-background-50',
  recusada: 'bg-accent-500/20 text-accent-600',
  expirada: 'bg-background-200 text-foreground-500',
  aguardando_aprovacao: 'bg-accent-100 text-accent-800',
};

const motivosPerda = [
  'Preço acima do esperado',
  'Prazo incompatível',
  'Escolheu a concorrência',
  'Sem verba/orçamento no momento',
  'Não é prioridade agora',
  'Sem retorno do contato',
  'Outro motivo',
];

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const valorComDesconto = (p: Proposta) => p.valor * (1 - (p.descontoPct || 0) / 100);
const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function Orcamentos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { propostas, atualizar, confirmarAceiteLocal, criar, excluir } = usePropostasStore();
  const [selecionada, setSelecionada] = useState<Proposta | null>(null);
  const [toast, setToast] = useState('');
  const [novoModal, setNovoModal] = useState(false);
  const [novaLeadId, setNovaLeadId] = useState('');
  const [novaItens, setNovaItens] = useState<Record<string, number>>({});
  const [novaDesconto, setNovaDesconto] = useState(0);
  const [novaTemplateId, setNovaTemplateId] = useState('');
  const [novaValidadeDias, setNovaValidadeDias] = useState(0);
  const [docModal, setDocModal] = useState<Proposta | null>(null);
  const [docTemplateId, setDocTemplateId] = useState('');
  const [perdaModal, setPerdaModal] = useState<Proposta | null>(null);
  const [perdaMotivo, setPerdaMotivo] = useState('');
  const [perdaOutro, setPerdaOutro] = useState('');
  const [editarProposta, setEditarProposta] = useState<Proposta | null>(null);
  const [editItens, setEditItens] = useState<Record<string, number>>({});
  const [editDesconto, setEditDesconto] = useState(0);

  const [leads, setLeads] = useLeadsStore();
  const { config } = useConfiguracaoStore();
  const tarefas = useTarefasStore();
  const notif = useNotificacoesStore();
  const fluxo = useFluxoComercial();
  const { templates: templatesProposta } = useTemplatesPropostaStore();
  const { templates: templatesDocumento } = useTemplatesDocumentoStore();
  const { settings: { organizacao } } = useEmpresaSettingsStore();
  const { variaveis: variaveisGlobais } = useVariaveisGlobaisStore();
  const { temaPadrao } = useTemasStore();
  const { produtos: produtosCatalogo } = useCatalogoStore();
  const catalogo = useMemo(
    () => produtosCatalogo
      .filter((produto) => produto.ativo && produto.podeOrcamento)
      .map((produto) => ({ id: produto.id, nome: produto.nome, preco: produto.precoBase, unidade: produto.unidade })),
    [produtosCatalogo],
  );

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const moverLead = (proposta: Proposta, etapa: string) => {
    setLeads((prev) =>
      prev.map((l) =>
        (proposta.leadId ? l.id === proposta.leadId : l.nome === proposta.lead)
          ? {
              ...l,
              etapa,
              automacaoStatus: ['Fechado — Ganho', 'Fechado — Perdido'].includes(etapa) ? 'CONCLUIDA' : l.automacaoStatus,
            }
          : l
      )
    );
  };

  const enviar = (id: string) => {
    const p = propostas.find((x) => x.id === id);
    if (!p) return;
    if (p.bloqueadaEnvio || p.status === 'aguardando_aprovacao') {
      mostrarToast('Proposta aguardando aprovação de desconto. Envio bloqueado.');
      return;
    }
    if (!p.leadId) {
      mostrarToast('A proposta não possui um lead operacional vinculado. O envio não foi iniciado.');
      return;
    }
    navigate(`/dashboard/atendimento?leadId=${p.leadId}`);
  };

  const aceitar = async (id: string) => {
    const p = propostas.find((x) => x.id === id);
    if (!p) return;
    if (p.bloqueadaEnvio || p.status === 'aguardando_aprovacao') {
      mostrarToast('Aprove o desconto antes de aceitar a proposta.');
      return;
    }
    try {
      confirmarAceiteLocal(id);
      moverLead(p, 'Fechado — Ganho');
      fluxo.registrarAuditoria({ evento: 'PROPOSAL_ACCEPTED', ator: 'Usuário', alvo: p.empresa, detalhes: `Proposta ${p.numero} aceita` });
      mostrarToast(`${p.numero} aceita. O orçamento foi concluído e o funil atualizado.`);
    } catch (error) {
      console.error('[crm-proposals] falha ao aceitar proposta', error);
      mostrarToast('Não foi possível aceitar a proposta. Verifique as permissões e tente novamente.');
    }
  };

  const abrirRecusa = (id: string) => {
    const p = propostas.find((x) => x.id === id);
    if (!p) return;
    setPerdaMotivo('');
    setPerdaOutro('');
    setPerdaModal(p);
  };

  const confirmarRecusa = () => {
    if (!perdaModal) return;
    const motivo = perdaMotivo === 'Outro motivo' ? perdaOutro : perdaMotivo;
    if (!motivo.trim()) {
      mostrarToast('Informe o motivo da perda.');
      return;
    }
    atualizar(perdaModal.id, { status: 'recusada', motivoPerda: motivo.trim() });
    moverLead(perdaModal, 'Fechado — Perdido');
    fluxo.registrarAuditoria({ evento: 'PROPOSAL_REJECTED', ator: 'Usuário', alvo: perdaModal.empresa, detalhes: `Proposta ${perdaModal.numero} recusada — ${motivo.trim()}` });
    setPerdaModal(null);
    mostrarToast(`${perdaModal.numero} recusada. Motivo registrado e lead movido para perdido.`);
  };

  const aprovarDesconto = (id: string) => {
    const p = propostas.find((x) => x.id === id);
    atualizar(id, { status: 'rascunho', bloqueadaEnvio: false, descontoAprovado: true });
    fluxo.registrarAuditoria({ evento: 'DISCOUNT_APPROVED', ator: 'Gestor', alvo: p?.empresa || id, detalhes: `Desconto da proposta ${p?.numero || ''} aprovado` });
    mostrarToast('Desconto aprovado. Proposta liberada para envio.');
  };

  const reprovarDesconto = (id: string) => {
    const p = propostas.find((x) => x.id === id);
    atualizar(id, { descontoPct: 0, status: 'rascunho', bloqueadaEnvio: false, descontoAprovado: false });
    fluxo.registrarAuditoria({ evento: 'DISCOUNT_REJECTED', ator: 'Gestor', alvo: p?.empresa || id, detalhes: `Desconto da proposta ${p?.numero || ''} reprovado` });
    mostrarToast('Desconto reprovado. Proposta ajustada sem desconto.');
  };

  const novaVersao = (p: Proposta) => {
    const nova: Proposta = {
      ...p,
      id: `pr-${Date.now()}`,
      numero: newProposalNumber(),
      status: 'rascunho',
      versao: p.versao + 1,
      propostaPaiId: p.id,
      descontoAprovado: false,
      bloqueadaEnvio: false,
      motivoPerda: undefined,
      data: new Date().toISOString().slice(0, 10),
    };
    criar(nova);
    atualizar(p.id, { status: 'expirada' });
    setSelecionada(nova);
    mostrarToast(`Nova versão ${nova.numero} criada (v${nova.versao}). Versão anterior arquivada.`);
  };

  const baixarPDF = (p: Proposta) => {
    const total = valorComDesconto(p);
    const tema = temaPadrao();
    const nomeEmpresa = organizacao?.nome || 'Proposta comercial';
    const itens = p.itens
      .map(
        (i) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapar(i.nome)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantidade}x</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(i.preco)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(i.preco * i.quantidade)}</td></tr>`
      )
      .join('');
    const condicoes = [
      p.formaPagamento ? `<div style="margin-top:20px"><div style="color:#888;font-size:12px">Forma de pagamento</div><div style="font-size:13px">${escapar(p.formaPagamento)}</div></div>` : '',
      p.garantia ? `<div style="margin-top:12px"><div style="color:#888;font-size:12px">Garantia</div><div style="font-size:13px">${escapar(p.garantia)}</div></div>` : '',
      p.termos ? `<div style="margin-top:12px"><div style="color:#888;font-size:12px">Termos e condições</div><div style="font-size:13px">${escapar(p.termos)}</div></div>` : '',
    ].join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Proposta ${escapar(p.numero)}</title></head><body style="font-family:Arial,sans-serif;color:${tema.cores.texto};max-width:680px;margin:40px auto;padding:0 24px">
      <div style="border-bottom:2px solid ${tema.cores.primaria};padding-bottom:16px;margin-bottom:24px">
        <div style="font-size:22px;font-weight:bold;color:${tema.cores.primaria}">${escapar(nomeEmpresa)}</div>
        <div style="color:#666;font-size:12px">Proposta comercial</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:24px">
        <div><div style="color:#888;font-size:12px">Cliente</div><div style="font-weight:bold">${escapar(p.empresa)}</div><div style="color:#666;font-size:13px">${escapar(p.lead)}</div></div>
        <div style="text-align:right"><div style="color:#888;font-size:12px">Número</div><div style="font-weight:bold">${escapar(p.numero)}</div><div style="color:#666;font-size:12px">Validade: ${p.validade}</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${itens}</table>
      <div style="text-align:right;margin-top:16px">
        <div style="color:#888;font-size:13px">Subtotal: <b>${fmt(p.valor)}</b></div>
        ${p.descontoPct ? `<div style="color:#888;font-size:13px">Desconto (${p.descontoPct}%): <b>${fmt(p.valor - total)}</b></div>` : ''}
        <div style="font-size:18px;font-weight:bold;margin-top:6px">Total: ${fmt(total)}</div>
      </div>
      ${condicoes}
      <div style="margin-top:40px;color:#888;font-size:11px">Documento gerado em ${new Date().toLocaleDateString('pt-BR')} por ${escapar(nomeEmpresa)}. ${escapar(tema.assinatura)}</div>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) {
      mostrarToast('Permita pop-ups para baixar o PDF.');
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  const abrirGerarDoc = (p: Proposta) => {
    const ativos = templatesDocumento.filter((t) => t.ativo);
    const contrato = ativos.find((t) => t.tipo === 'contrato') || ativos[0];
    setDocModal(p);
    setDocTemplateId(contrato?.id || '');
  };

  const gerarDocumento = () => {
    if (!docModal) return;
    const tpl = templatesDocumento.find((t) => t.id === docTemplateId);
    if (!tpl) {
      mostrarToast('Selecione um template de documento.');
      return;
    }
    const tema = temaPadrao();
    const nomeEmpresa = organizacao?.nome || 'Documento';
    const valores = montarValoresVariaveis({
      lead: { nome: docModal.lead, empresa: docModal.empresa },
      organizacao,
      customVars: variaveisGlobais,
    });
    valores.validade = docModal.validade;
    valores.forma_pagamento = docModal.formaPagamento || '—';
    valores.garantia = docModal.garantia || '—';
    valores.valor_total = fmt(valorComDesconto(docModal));
    valores.data_hoje = new Date().toLocaleDateString('pt-BR');
    const texto = resolverVariaveis(tpl.conteudo, valores);
    const corpo = escapar(texto).replace(/\n/g, '<br>');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapar(tpl.nome)}</title></head><body style="font-family:Arial,sans-serif;color:${tema.cores.texto};max-width:680px;margin:40px auto;padding:0 24px;line-height:1.6">
      <div style="border-bottom:2px solid ${tema.cores.primaria};padding-bottom:16px;margin-bottom:24px">
        <div style="font-size:22px;font-weight:bold;color:${tema.cores.primaria}">${escapar(nomeEmpresa)}</div>
        <div style="color:#666;font-size:12px">${escapar(tpl.nome)}</div>
      </div>
      <div style="font-size:14px">${corpo}</div>
      <div style="margin-top:40px;color:#888;font-size:11px">Documento gerado em ${new Date().toLocaleDateString('pt-BR')} por ${escapar(nomeEmpresa)}. ${escapar(tema.assinatura)}</div>
      <script>window.onload=function(){window.print();}</script>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) {
      mostrarToast('Permita pop-ups para gerar o documento.');
      return;
    }
    win.document.write(html);
    win.document.close();
    setDocModal(null);
    fluxo.registrarAuditoria({ evento: 'DOCUMENT_GENERATED', ator: 'Usuário', alvo: docModal.empresa, detalhes: `${tpl.nome} gerado a partir da proposta ${docModal.numero}` });
    mostrarToast(`"${tpl.nome}" gerado.`);
  };

  const leadsCandidatos = useMemo(
    () =>
      leads.filter(
        (l) => l.etapa !== 'Fechado — Ganho' && l.etapa !== 'Fechado — Perdido' && l.etapa !== 'Pausado'
      ),
    [leads]
  );

  const subtotalNova = Object.entries(novaItens).reduce((acc, [catId, qtd]) => {
    const c = catalogo.find((x) => x.id === catId);
    return c ? acc + c.preco * qtd : acc;
  }, 0);
  const totalNova = subtotalNova * (1 - novaDesconto / 100);

  const criarProposta = () => {
    const lead = leads.find((l) => l.id === novaLeadId);
    if (!lead) {
      mostrarToast('Selecione um lead.');
      return;
    }
    const itens: ItemProposta[] = Object.entries(novaItens)
      .filter(([, qtd]) => qtd > 0)
      .map(([catId, qtd]) => {
        const c = catalogo.find((x) => x.id === catId)!;
        return { id: `it-${Date.now()}-${catId}`, nome: c.nome, quantidade: qtd, preco: c.preco };
      });
    if (itens.length === 0) {
      mostrarToast('Adicione pelo menos um item.');
      return;
    }
    const numero = newProposalNumber();
    const precisaAprovacao = novaDesconto > config.descontoExigeAprovacaoAcima;
    const template = templatesProposta.find((t) => t.id === novaTemplateId && t.ativo);
    const validadeDias = Math.max(0, Number(novaValidadeDias) || 0);
    if (validadeDias < 1) {
      mostrarToast('Defina a validade comercial antes de criar a proposta.');
      return;
    }
    const nova: Proposta = {
      id: `pr-${Date.now()}`,
      numero,
      lead: lead.nome,
      leadId: lead.id,
      empresa: lead.empresa,
      valor: itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0),
      status: precisaAprovacao ? 'aguardando_aprovacao' : 'rascunho',
      validade: new Date(Date.now() + validadeDias * 86400000).toISOString().slice(0, 10),
      responsavel: 'Ana (IA)',
      data: new Date().toISOString().slice(0, 10),
      canal: 'WhatsApp',
      itens,
      descontoPct: novaDesconto,
      versao: 1,
      bloqueadaEnvio: precisaAprovacao,
      descontoAprovado: false,
      aprovador: precisaAprovacao ? user?.name || 'Administrador da empresa' : undefined,
      templateId: template?.id,
      formaPagamento: template?.formaPagamento,
      garantia: template?.garantia,
      termos: template?.termos,
    };
    criar(nova);
    if (precisaAprovacao) {
      tarefas.criar({
        titulo: `Aprovar desconto de ${novaDesconto}% na proposta ${numero}`,
        responsavel: user?.name || 'Administrador da empresa',
        leadId: lead.id,
        leadNome: lead.nome,
        prioridade: 'ALTA',
        descricao: `Desconto de ${novaDesconto}% excede o limite de ${config.descontoExigeAprovacaoAcima}%. Aprovar ou reprovar.`,
      });
      notif.criar({ titulo: 'Desconto aguardando aprovação', descricao: `Proposta ${numero} com desconto de ${novaDesconto}% precisa de aprovação.`, tipo: 'APROVACAO' });
    }
    setNovoModal(false);
    setNovaLeadId('');
    setNovaItens({});
    setNovaDesconto(0);
    setNovaTemplateId('');
    setNovaValidadeDias(0);
    mostrarToast(precisaAprovacao ? `Proposta ${numero} criada aguardando aprovação de desconto.` : `Proposta ${numero} criada (rascunho).`);
  };

  const abrirEdicaoProposta = (p: Proposta) => {
    setEditarProposta(p);
    const map: Record<string, number> = {};
    p.itens.forEach((i) => {
      const cat = catalogo.find((c) => c.nome === i.nome);
      if (cat) map[cat.id] = (map[cat.id] || 0) + i.quantidade;
    });
    setEditItens(map);
    setEditDesconto(p.descontoPct);
  };

  const salvarEdicaoProposta = () => {
    if (!editarProposta) return;
    const itens: ItemProposta[] = Object.entries(editItens)
      .filter(([, qtd]) => qtd > 0)
      .map(([catId, qtd]) => {
        const c = catalogo.find((x) => x.id === catId)!;
        return { id: `it-${Date.now()}-${catId}`, nome: c.nome, quantidade: qtd, preco: c.preco };
      });
    if (itens.length === 0) {
      mostrarToast('A proposta precisa de pelo menos um item.');
      return;
    }
    const valor = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
    atualizar(editarProposta.id, { itens, valor, descontoPct: editDesconto });
    setEditarProposta(null);
    mostrarToast(`Proposta ${editarProposta.numero} atualizada.`);
  };

  const excluirProposta = (id: string) => {
    excluir(id);
    setSelecionada(null);
    mostrarToast('Proposta excluída.');
  };

  const subtotalEdit = Object.entries(editItens).reduce((acc, [catId, qtd]) => {
    const c = catalogo.find((x) => x.id === catId);
    return c ? acc + c.preco * qtd : acc;
  }, 0);
  const totalEdit = subtotalEdit * (1 - editDesconto / 100);

  return (
    <div className="wf-page">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-2">
            Orçamentos
          </h1>
          <p className="text-foreground-600 text-sm">
            Crie, revise, envie e acompanhe orçamentos. O aceite conclui a oportunidade, sem cobrança ou checkout no sistema.
          </p>
        </div>
        <button
          onClick={() => setNovoModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          Nova proposta
        </button>
      </div>

      {toast && (
        <div className="mb-4 bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Propostas em aberto', value: String(propostas.filter((p) => p.status === 'enviada' || p.status === 'visualizada').length), icon: 'ri-file-list-3-line', color: 'bg-primary-100 text-primary-600' },
          { label: 'Propostas aceitas', value: String(propostas.filter((p) => p.status === 'aceita').length), icon: 'ri-check-double-line', color: 'bg-secondary-100 text-secondary-600' },
          { label: 'Taxa de aceite', value: `${propostas.length ? Math.round((propostas.filter((p) => p.status === 'aceita').length / propostas.length) * 100) : 0}%`, icon: 'ri-percent-line', color: 'bg-accent-100 text-accent-600' },
          { label: 'Aguardando aprovação', value: String(propostas.filter((p) => p.status === 'aguardando_aprovacao').length), icon: 'ri-time-line', color: 'bg-primary-500/20 text-primary-600' },
        ].map((kpi, i) => (
          <div key={i} className="bg-background-50 border border-background-200/70 rounded-xl p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${kpi.color}`}>
              <i className={`${kpi.icon} text-lg`}></i>
            </div>
            <p className="text-2xl font-heading font-extrabold text-foreground-950">{kpi.value}</p>
            <p className="text-foreground-500 text-sm mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-background-200/70 bg-background-100/50">
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Número</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Lead</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Valor</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Status</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Validade</th>
                  <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Ações</th>
                </tr>
              </thead>
              <tbody>
                {propostas.map((p) => (
                  <tr key={p.id} className="border-b border-background-100 hover:bg-background-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <button
                        onClick={() => setSelecionada(p)}
                        className="font-semibold text-primary-600 hover:text-primary-700 cursor-pointer"
                      >
                        {p.numero}
                      </button>
                      <p className="text-xs text-foreground-400">v{p.versao} · {p.data}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <p className="font-medium text-foreground-900">{p.lead}</p>
                      <p className="text-xs text-foreground-500">{p.empresa}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <p className="font-bold text-foreground-900">{fmt(valorComDesconto(p))}</p>
                      {p.descontoPct > 0 && (
                        <p className="text-xs text-foreground-400 line-through">{fmt(p.valor)}</p>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${statusCor[p.status]}`}>
                        {statusLabel[p.status]}
                      </span>
                      {p.status === 'recusada' && p.motivoPerda && (
                        <p className="text-[11px] text-foreground-400 mt-1 max-w-[160px] truncate" title={p.motivoPerda}>
                          {p.motivoPerda}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">
                      {new Date(p.validade + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {p.status === 'aguardando_aprovacao' && (
                          <>
                            <button
                              onClick={() => aprovarDesconto(p.id)}
                              className="px-2.5 py-1.5 bg-secondary-500 hover:bg-secondary-600 text-background-50 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap"
                              title="Aprovar desconto"
                            >
                              <i className="ri-check-line"></i>
                            </button>
                            <button
                              onClick={() => reprovarDesconto(p.id)}
                              className="px-2.5 py-1.5 bg-accent-500 hover:bg-accent-600 text-background-50 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap"
                              title="Reprovar desconto"
                            >
                              <i className="ri-close-line"></i>
                            </button>
                          </>
                        )}
                        {p.status === 'rascunho' && (
                          <button
                            onClick={() => enviar(p.id)}
                            className="px-2.5 py-1.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap"
                            title="Enviar"
                          >
                            <i className="ri-send-plane-line"></i>
                          </button>
                        )}
                        {(p.status === 'enviada' || p.status === 'visualizada') && (
                          <>
                            <button
                              onClick={() => aceitar(p.id)}
                              className="px-2.5 py-1.5 bg-secondary-500 hover:bg-secondary-600 text-background-50 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap"
                              title="Aceitar"
                            >
                              <i className="ri-check-double-line"></i>
                            </button>
                            <button
                              onClick={() => abrirRecusa(p.id)}
                              className="px-2.5 py-1.5 bg-accent-500 hover:bg-accent-600 text-background-50 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap"
                              title="Recusar"
                            >
                              <i className="ri-close-line"></i>
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelecionada(p)}
                          className="px-2.5 py-1.5 bg-background-100 hover:bg-background-200 text-foreground-600 rounded-md text-xs cursor-pointer whitespace-nowrap"
                          title="Detalhes"
                        >
                          <i className="ri-eye-line"></i>
                        </button>
                        <button
                          onClick={() => baixarPDF(p)}
                          className="px-2.5 py-1.5 bg-background-100 hover:bg-background-200 text-foreground-600 rounded-md text-xs cursor-pointer whitespace-nowrap"
                          title="Baixar PDF"
                        >
                          <i className="ri-file-pdf-line"></i>
                        </button>
                        {(p.status === 'rascunho' || p.status === 'aguardando_aprovacao') && (
                          <button
                            onClick={() => abrirEdicaoProposta(p)}
                            className="px-2.5 py-1.5 bg-background-100 hover:bg-background-200 text-foreground-600 rounded-md text-xs cursor-pointer whitespace-nowrap"
                            title="Editar itens e desconto"
                          >
                            <i className="ri-edit-line"></i>
                          </button>
                        )}
                        {p.status !== 'aceita' && (
                          <button
                            onClick={() => excluirProposta(p.id)}
                            className="px-2.5 py-1.5 bg-background-100 hover:bg-accent-50 text-accent-600 rounded-md text-xs cursor-pointer whitespace-nowrap"
                            title="Excluir proposta"
                          >
                            <i className="ri-delete-bin-6-line"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {propostas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-foreground-500">
                      Nenhuma proposta criada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
      </div>

      {/* Drawer de detalhe */}
      {selecionada && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex justify-end" onClick={() => setSelecionada(null)}>
          <div
            className="bg-background-50 w-full max-w-md h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between sticky top-0 bg-background-50 z-10">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">Proposta {selecionada.numero}</h3>
                <p className="text-xs text-foreground-500">{selecionada.empresa} · v{selecionada.versao}</p>
              </div>
              <button onClick={() => setSelecionada(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${statusCor[selecionada.status]}`}>
                  {statusLabel[selecionada.status]}
                </span>
                <span className="text-xs text-foreground-500">Validade: {new Date(selecionada.validade + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
              </div>
              {selecionada.status === 'aguardando_aprovacao' && (
                <div className="bg-accent-50 border border-accent-200 rounded-lg px-4 py-3 text-sm text-accent-800">
                  <span className="font-semibold">Aguardando aprovação de desconto ({selecionada.descontoPct}%). </span>
                  Envio bloqueado até o aprovador liberar.
                </div>
              )}
              {selecionada.status === 'recusada' && selecionada.motivoPerda && (
                <div className="bg-accent-50 border border-accent-200 rounded-lg px-4 py-3 text-sm text-accent-800">
                  <span className="font-semibold">Motivo da perda: </span>
                  {selecionada.motivoPerda}
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold text-foreground-800 mb-3">Itens</h4>
                <div className="space-y-2">
                  {selecionada.itens.map((i) => (
                    <div key={i.id} className="flex items-center justify-between bg-background-100 rounded-lg px-4 py-2.5">
                      <div>
                        <p className="text-sm text-foreground-800">{i.nome}</p>
                        <p className="text-xs text-foreground-500">{i.quantidade}x {fmt(i.preco)}</p>
                      </div>
                      <span className="text-sm font-semibold text-foreground-900">{fmt(i.preco * i.quantidade)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-4 mt-2 border-t border-background-200/70 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground-600">Subtotal</span>
                    <span className="font-medium text-foreground-900">{fmt(selecionada.valor)}</span>
                  </div>
                  {selecionada.descontoPct > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground-600">Desconto ({selecionada.descontoPct}%)</span>
                      <span className="font-medium text-secondary-600">−{fmt(selecionada.valor - valorComDesconto(selecionada))}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm font-semibold text-foreground-800">Total</span>
                    <span className="text-lg font-heading font-extrabold text-foreground-950">{fmt(valorComDesconto(selecionada))}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => baixarPDF(selecionada)}
                className="w-full px-4 py-2.5 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
              >
                <i className="ri-file-pdf-line mr-2"></i>
                Baixar PDF
              </button>
              <button
                onClick={() => abrirGerarDoc(selecionada)}
                className="w-full px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
              >
                <i className="ri-file-copy-2-line mr-2"></i>
                Gerar documento
              </button>
              {(selecionada.status === 'enviada' || selecionada.status === 'visualizada') && (
                <div className="flex gap-2">
                  <button
                    onClick={() => aceitar(selecionada.id)}
                    className="flex-1 px-4 py-2.5 bg-secondary-500 hover:bg-secondary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
                  >
                    Aceitar
                  </button>
                  <button
                    onClick={() => abrirRecusa(selecionada.id)}
                    className="flex-1 px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
                  >
                    Recusar
                  </button>
                </div>
              )}
              {selecionada.status === 'aguardando_aprovacao' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => aprovarDesconto(selecionada.id)}
                    className="flex-1 px-4 py-2.5 bg-secondary-500 hover:bg-secondary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
                  >
                    Aprovar desconto
                  </button>
                  <button
                    onClick={() => reprovarDesconto(selecionada.id)}
                    className="flex-1 px-4 py-2.5 bg-accent-500 hover:bg-accent-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
                  >
                    Reprovar
                  </button>
                </div>
              )}
              {selecionada.status === 'rascunho' && (
                <button
                  onClick={() => enviar(selecionada.id)}
                  className="w-full px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-send-plane-line mr-2"></i>
                  Revisar envio no atendimento
                </button>
              )}
              {(selecionada.status === 'enviada' || selecionada.status === 'visualizada' || selecionada.status === 'aceita' || selecionada.status === 'recusada') && (
                <button
                  onClick={() => novaVersao(selecionada)}
                  className="w-full px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-git-branch-line mr-2"></i>
                  Criar nova versão
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova proposta */}
      {novoModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setNovoModal(false)}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Nova proposta</h3>
              <button onClick={() => setNovoModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Lead</label>
                <select value={novaLeadId} onChange={(e) => setNovaLeadId(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  <option value="">Selecione um lead...</option>
                  {leadsCandidatos.map((l) => (
                    <option key={l.id} value={l.id}>{l.nome} — {l.empresa}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Template de proposta</label>
                <select value={novaTemplateId} onChange={(e) => {
                  const templateId = e.target.value;
                  const template = templatesProposta.find((item) => item.id === templateId);
                  setNovaTemplateId(templateId);
                  setNovaValidadeDias(template?.validadePadraoDias || 0);
                }} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  <option value="">Sem template</option>
                  {templatesProposta.filter((t) => t.ativo).map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}{t.padrao ? ' (padrão)' : ''}</option>
                  ))}
                </select>
                {novaTemplateId ? (
                  <p className="text-xs text-foreground-500 mt-1.5">
                    {templatesProposta.find((x) => x.id === novaTemplateId)?.formaPagamento || 'Condições comerciais ainda não definidas no template.'}
                  </p>
                ) : (
                  <p className="text-xs text-accent-600 mt-1.5 flex items-center gap-1">
                    <i className="ri-alarm-warning-line"></i>
                    Nenhum template selecionado. Preencha os dados comerciais manualmente.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Validade comercial (dias)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={novaValidadeDias || ''}
                  onChange={(e) => setNovaValidadeDias(Number(e.target.value))}
                  placeholder="Defina após validação humana"
                  className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                />
                <p className="mt-1.5 text-xs text-foreground-500">Obrigatório. O sistema não preenche um prazo comercial inventado.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-2">Itens do catálogo</label>
                <div className="space-y-2">
                  {catalogo.map((c) => {
                    const qtd = novaItens[c.id] || 0;
                    return (
                      <div key={c.id} className="flex items-center justify-between bg-background-100 rounded-lg px-4 py-2.5">
                        <div>
                          <p className="text-sm text-foreground-800">{c.nome}</p>
                          <p className="text-xs text-foreground-500">{fmt(c.preco)} / {c.unidade}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setNovaItens({ ...novaItens, [c.id]: Math.max(0, qtd - 1) })}
                            className="w-7 h-7 flex items-center justify-center bg-background-50 border border-background-300 rounded-md text-foreground-700 cursor-pointer hover:bg-background-200"
                          >
                            <i className="ri-subtract-line text-xs"></i>
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-foreground-900">{qtd}</span>
                          <button
                            onClick={() => setNovaItens({ ...novaItens, [c.id]: qtd + 1 })}
                            className="w-7 h-7 flex items-center justify-center bg-background-50 border border-background-300 rounded-md text-foreground-700 cursor-pointer hover:bg-background-200"
                          >
                            <i className="ri-add-line text-xs"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Desconto (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={novaDesconto}
                  onChange={(e) => setNovaDesconto(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-background-200/70">
                <div className="text-sm text-foreground-500">
                  {novaDesconto > 0 && <span className="block line-through">{fmt(subtotalNova)}</span>}
                  <span className="text-xs text-foreground-400">Total com desconto</span>
                </div>
                <span className="text-lg font-heading font-extrabold text-foreground-950">{fmt(totalNova)}</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setNovoModal(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={criarProposta} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Criar proposta</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar proposta */}
      {editarProposta && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setEditarProposta(null)}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">Editar proposta {editarProposta.numero}</h3>
                <p className="text-sm text-foreground-500">{editarProposta.empresa}</p>
              </div>
              <button onClick={() => setEditarProposta(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-2">Itens do catálogo</label>
                <div className="space-y-2">
                  {catalogo.map((c) => {
                    const qtd = editItens[c.id] || 0;
                    return (
                      <div key={c.id} className="flex items-center justify-between bg-background-100 rounded-lg px-4 py-2.5">
                        <div>
                          <p className="text-sm text-foreground-800">{c.nome}</p>
                          <p className="text-xs text-foreground-500">{fmt(c.preco)} / {c.unidade}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditItens({ ...editItens, [c.id]: Math.max(0, qtd - 1) })}
                            className="w-7 h-7 flex items-center justify-center bg-background-50 border border-background-300 rounded-md text-foreground-700 cursor-pointer hover:bg-background-200"
                          >
                            <i className="ri-subtract-line text-xs"></i>
                          </button>
                          <span className="w-6 text-center text-sm font-semibold text-foreground-900">{qtd}</span>
                          <button
                            onClick={() => setEditItens({ ...editItens, [c.id]: qtd + 1 })}
                            className="w-7 h-7 flex items-center justify-center bg-background-50 border border-background-300 rounded-md text-foreground-700 cursor-pointer hover:bg-background-200"
                          >
                            <i className="ri-add-line text-xs"></i>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Desconto (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editDesconto}
                  onChange={(e) => setEditDesconto(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-background-200/70">
                <div className="text-sm text-foreground-500">
                  {editDesconto > 0 && <span className="block line-through">{fmt(subtotalEdit)}</span>}
                  <span className="text-xs text-foreground-400">Total com desconto</span>
                </div>
                <span className="text-lg font-heading font-extrabold text-foreground-950">{fmt(totalEdit)}</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setEditarProposta(null)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvarEdicaoProposta} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Salvar alterações</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal motivo de perda */}
      {perdaModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setPerdaModal(null)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Registrar perda</h3>
              <button onClick={() => setPerdaModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-3 flex items-center gap-2 text-xs text-accent-700 bg-accent-50 border border-accent-200 rounded-lg px-3 py-2">
                <i className="ri-alarm-warning-line"></i>
                Ação irreversível — a proposta será marcada como recusada e o lead movido para perdido.
              </div>
              <p className="text-sm text-foreground-600 mb-4">
                Proposta <b>{perdaModal.numero}</b> ({perdaModal.lead}). Informe o motivo da perda — obrigatório para encerrar como perdido.
              </p>
              <div className="space-y-2">
                {motivosPerda.map((m) => (
                  <label
                    key={m}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                      perdaMotivo === m ? 'border-accent-500 bg-accent-50' : 'border-background-200/70 hover:bg-background-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="motivoPerda"
                      value={m}
                      checked={perdaMotivo === m}
                      onChange={() => setPerdaMotivo(m)}
                      className="accent-[oklch(var(--accent-500))] cursor-pointer"
                    />
                    <span className="text-sm text-foreground-800">{m}</span>
                  </label>
                ))}
              </div>
              {perdaMotivo === 'Outro motivo' && (
                <textarea
                  value={perdaOutro}
                  onChange={(e) => setPerdaOutro(e.target.value)}
                  maxLength={200}
                  placeholder="Descreva o motivo..."
                  className="mt-3 w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 min-h-[70px]"
                />
              )}
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setPerdaModal(null)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button
                onClick={confirmarRecusa}
                disabled={!perdaMotivo}
                className="px-5 py-2.5 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
              >
                Confirmar perda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal gerar documento */}
      {docModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setDocModal(null)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">Gerar documento</h3>
                <p className="text-sm text-foreground-500">{docModal.numero} · {docModal.empresa}</p>
              </div>
              <button onClick={() => setDocModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Template de documento</label>
                <select value={docTemplateId} onChange={(e) => setDocTemplateId(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  {templatesDocumento.filter((t) => t.ativo).map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-foreground-500">
                As variáveis {'{nome}'}, {'{empresa}'}, {'{valor_total}'} e {'{assinatura}'} serão preenchidas com os dados desta proposta e da sua empresa.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setDocModal(null)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={gerarDocumento} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Gerar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
