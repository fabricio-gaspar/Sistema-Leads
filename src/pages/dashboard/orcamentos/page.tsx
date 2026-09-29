import AccessibleDialog from '@/components/feature/AccessibleDialog';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Proposta, ItemProposta } from '@/mocks/propostasData';
import { refreshLeadsStore, useLeadsStore } from '@/hooks/useLeadsStore';
import { refreshPropostasStore, usePropostasStore, usePropostasLoadStatus, waitForPropostasPersistence } from '@/hooks/usePropostasStore';
import { confirmedUnitPrice, hasUnconfirmedPrices } from '@/domain/proposalPricing';
import DataReadNotice from '@/components/feature/DataReadNotice';
import { proposalNet } from '@/domain/commercialAnalytics';
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
import { CommercialTransitionError, resolveOperationalProposalOutcome } from '@/lib/crm/leadStageRepository';
import { stageFromLegacy } from '@/domain/pipeline';
import '../command-secondary.css';

const statusLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviado',
  visualizada: 'Visualizado',
  aceita: 'Aceito',
  recusada: 'Recusado',
  expirada: 'Vencido',
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
const valorComDesconto = proposalNet;
const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function Orcamentos() {
  const loadStatus = usePropostasLoadStatus();
  const writing = useRef(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { propostas, atualizar, criar, excluir } = usePropostasStore();
  const [filtroStatus, setFiltroStatus] = useState('');
  const [buscaProposta, setBuscaProposta] = useState('');
  const [ordenacao, setOrdenacao] = useState<'updated' | 'created' | 'validity' | 'value'>('updated');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [colunas, setColunas] = useState<'essenciais' | 'completas'>('essenciais');
  const statusTabs = [
    { value: '', label: 'Todos' },
    { value: 'rascunho', label: 'Rascunhos' },
    { value: 'aguardando_aprovacao', label: 'Em aprovação' },
    { value: 'enviada', label: 'Enviados' },
    { value: 'aceita', label: 'Aceitos' },
    { value: 'expirada', label: 'Vencidos' },
  ];
  const responsaveis = useMemo(() => [...new Set(propostas.map((proposal) => proposal.responsavel).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [propostas]);
  const propostasVisiveis = useMemo(() => {
    const termo = buscaProposta.trim().toLocaleLowerCase('pt-BR');
    const filtered = propostas.filter((proposal) => {
      const itens = proposal.itens.map((item) => `${item.nome} ${item.id}`).join(' ');
      const haystack = `${proposal.numero} ${proposal.empresa} ${proposal.lead} ${itens}`.toLocaleLowerCase('pt-BR');
      return (!filtroStatus || proposal.status === filtroStatus)
        && (!filtroResponsavel || proposal.responsavel === filtroResponsavel)
        && (!termo || haystack.includes(termo));
    });
    return [...filtered].sort((a, b) => {
      if (ordenacao === 'value') return valorComDesconto(b) - valorComDesconto(a);
      if (ordenacao === 'validity') return b.validade.localeCompare(a.validade);
      if (ordenacao === 'created') return b.data.localeCompare(a.data);
      return (b.createdAt || b.data).localeCompare(a.createdAt || a.data);
    });
  }, [buscaProposta, filtroResponsavel, filtroStatus, ordenacao, propostas]);
  const [selecionada, setSelecionada] = useState<Proposta | null>(null);
  const [toast, setToast] = useState('');
  const [novoModal, setNovoModal] = useState(false);
  const [novaLeadId, setNovaLeadId] = useState('');
  const [novaItens, setNovaItens] = useState<Record<string, number>>({});
  const [novaPrecos, setNovaPrecos] = useState<Record<string, string>>({});
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
  const [editPrecos, setEditPrecos] = useState<Record<string, string>>({});
  const [editDesconto, setEditDesconto] = useState(0);

  const [leads] = useLeadsStore();
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

  // Quando o atendimento pede um orçamento, apenas abre o formulário deste
  // módulo com o lead já selecionado. Nenhuma proposta é criada sem a ação
  // explícita do usuário em "Criar proposta".
  useEffect(() => {
    const requestedLeadId = searchParams.get('leadId');
    if (searchParams.get('new') !== '1' || !requestedLeadId || !leads.some((lead) => lead.id === requestedLeadId)) return;
    setNovaLeadId(requestedLeadId);
    setNovoModal(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('new');
    setSearchParams(nextParams, { replace: true });
  }, [leads, searchParams, setSearchParams]);
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

  const enviar = (id: string) => {
    const p = propostas.find((x) => x.id === id);
    if (!p) return;
    if (hasUnconfirmedPrices(p)) { mostrarToast('Confirme os preços unitários antes de preparar o envio.'); return; }
    if (p.bloqueadaEnvio || p.status === 'aguardando_aprovacao') {
      mostrarToast('Proposta aguardando aprovação de desconto. Envio bloqueado.');
      return;
    }
    if (!p.leadId) {
      mostrarToast('A proposta não possui um lead operacional vinculado. O envio não foi iniciado.');
      return;
    }
    navigate(`/dashboard/atendimento?leadId=${p.leadId}&proposalId=${p.id}`);
  };

  const aceitar = async (id: string) => {
    const p = propostas.find((x) => x.id === id);
    if (!p) return;
    if (hasUnconfirmedPrices(p)) { mostrarToast('Confirme os preços unitários antes de registrar o aceite.'); return; }
    if (p.bloqueadaEnvio || p.status === 'aguardando_aprovacao') {
      mostrarToast('Aprove o desconto antes de aceitar a proposta.');
      return;
    }
    try {
      await resolveOperationalProposalOutcome({
        proposalId: p.id,
        outcome: 'accepted',
        reason: 'Aceite comercial confirmado por usuário autorizado.',
      });
      await Promise.all([refreshPropostasStore(), refreshLeadsStore()]);
      fluxo.registrarAuditoria({ evento: 'PROPOSAL_ACCEPTED', ator: 'Usuário', alvo: p.empresa, detalhes: `Proposta ${p.numero} aceita` });
      mostrarToast(`${p.numero} aceita. O orçamento foi concluído e o funil atualizado.`);
    } catch (error) {
      console.error('[crm-proposals] falha ao aceitar proposta', error);
      mostrarToast(error instanceof CommercialTransitionError ? error.message : 'Não foi possível aceitar a proposta. Verifique as permissões e tente novamente.');
    }
  };

  const abrirRecusa = (id: string) => {
    const p = propostas.find((x) => x.id === id);
    if (!p) return;
    setPerdaMotivo('');
    setPerdaOutro('');
    setPerdaModal(p);
  };

  const confirmarRecusa = async () => {
    if (!perdaModal) return;
    const motivo = perdaMotivo === 'Outro motivo' ? perdaOutro : perdaMotivo;
    if (!motivo.trim()) {
      mostrarToast('Informe o motivo da perda.');
      return;
    }
    try {
      await resolveOperationalProposalOutcome({ proposalId: perdaModal.id, outcome: 'rejected', reason: motivo.trim() });
      await Promise.all([refreshPropostasStore(), refreshLeadsStore()]);
      fluxo.registrarAuditoria({ evento: 'PROPOSAL_REJECTED', ator: 'Usuário', alvo: perdaModal.empresa, detalhes: `Proposta ${perdaModal.numero} recusada — ${motivo.trim()}` });
      setPerdaModal(null);
      mostrarToast(`${perdaModal.numero} recusada. Motivo registrado e lead movido para Perdido.`);
    } catch (error) {
      mostrarToast(error instanceof CommercialTransitionError ? error.message : 'Não foi possível concluir a recusa do orçamento.');
    }
  };

  const confirmarGravacao = async () => {
    try { await waitForPropostasPersistence(); return true; }
    catch { mostrarToast('Não foi possível salvar a proposta. Os dados foram reconciliados com o servidor.'); return false; }
    finally { writing.current = false; setSaving(false); }
  };

  const aprovarDesconto = async (id: string) => {
    const p = propostas.find((x) => x.id === id);
    atualizar(id, { status: 'rascunho', bloqueadaEnvio: false, descontoAprovado: true });
    if (!await confirmarGravacao()) return;
    fluxo.registrarAuditoria({ evento: 'DISCOUNT_APPROVED', ator: 'Gestor', alvo: p?.empresa || id, detalhes: `Desconto da proposta ${p?.numero || ''} aprovado` });
    mostrarToast('Desconto aprovado. Proposta liberada para envio.');
  };

  const reprovarDesconto = async (id: string) => {
    const p = propostas.find((x) => x.id === id);
    atualizar(id, { descontoPct: 0, status: 'rascunho', bloqueadaEnvio: false, descontoAprovado: false });
    if (!await confirmarGravacao()) return;
    fluxo.registrarAuditoria({ evento: 'DISCOUNT_REJECTED', ator: 'Gestor', alvo: p?.empresa || id, detalhes: `Desconto da proposta ${p?.numero || ''} reprovado` });
    mostrarToast('Desconto reprovado. Proposta ajustada sem desconto.');
  };

  const novaVersao = async (p: Proposta) => {
    if (writing.current) return;
    writing.current = true; setSaving(true);
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
    if (p.status !== 'aceita') atualizar(p.id, { status: 'expirada' });
    if (!await confirmarGravacao()) return;
    setSelecionada(nova);
    mostrarToast(`Nova versão ${nova.numero} criada (v${nova.versao}). ${p.status === 'aceita' ? 'Aceite da versão anterior preservado.' : 'Versão anterior marcada como expirada.'}`);
  };

  const baixarPDF = (p: Proposta) => {
    if (hasUnconfirmedPrices(p)) { mostrarToast('Confirme os preços dos itens antes de gerar o documento. Zero sem confirmação não representa gratuidade.'); return; }
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
    if (hasUnconfirmedPrices(p)) { mostrarToast('Confirme os preços dos itens antes de gerar o documento.'); return; }
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
    () => leads.filter((lead) => !['won', 'lost'].includes(stageFromLegacy(lead.etapa))),
    [leads]
  );

  const subtotalNova = Object.entries(novaItens).reduce((acc, [catId, qtd]) => {
    const c = catalogo.find((x) => x.id === catId);
    return c ? acc + (confirmedUnitPrice(c.preco, novaPrecos[catId]) ?? 0) * qtd : acc;
  }, 0);
  const novaPrecoPendente = Object.entries(novaItens).some(([id, qtd]) => qtd > 0 && confirmedUnitPrice(catalogo.find((c) => c.id === id)?.preco ?? 0, novaPrecos[id]) === null);
  const totalNova = subtotalNova * (1 - novaDesconto / 100);

  const criarProposta = async () => {
    if (writing.current) return;
    const lead = leads.find((l) => l.id === novaLeadId);
    if (!lead) {
      mostrarToast('Selecione um lead.');
      return;
    }
    if (novaPrecoPendente) { mostrarToast('Defina o preço unitário dos itens selecionados. Para gratuidade intencional, informe zero explicitamente.'); return; }
    const itens: ItemProposta[] = Object.entries(novaItens)
      .filter(([, qtd]) => qtd > 0)
      .map(([catId, qtd]) => {
        const c = catalogo.find((x) => x.id === catId)!;
        return { id: `it-${Date.now()}-${catId}`, nome: c.nome, quantidade: qtd, preco: confirmedUnitPrice(c.preco, novaPrecos[catId])!, precoConfirmado: true };
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
      responsavel: user?.name || 'Usuário',
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
    writing.current = true; setSaving(true);
    criar(nova);
    if (!await confirmarGravacao()) return;
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
    setNovaPrecos({});
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
    setEditPrecos(Object.fromEntries(p.itens.flatMap((item) => { const product = catalogo.find((c) => c.nome === item.nome); return product && (item.preco > 0 || item.precoConfirmado) ? [[product.id, String(item.preco)]] : []; })));
    setEditDesconto(p.descontoPct);
  };

  const salvarEdicaoProposta = async () => {
    if (!editarProposta) return;
    if (Object.entries(editItens).some(([id, qtd]) => qtd > 0 && confirmedUnitPrice(catalogo.find((c) => c.id === id)?.preco ?? 0, editPrecos[id]) === null)) { mostrarToast('Confirme os preços unitários antes de salvar.'); return; }
    const itens: ItemProposta[] = Object.entries(editItens)
      .filter(([, qtd]) => qtd > 0)
      .map(([catId, qtd]) => {
        const c = catalogo.find((x) => x.id === catId)!;
        return { id: `it-${Date.now()}-${catId}`, nome: c.nome, quantidade: qtd, preco: confirmedUnitPrice(c.preco, editPrecos[catId])!, precoConfirmado: true };
      });
    if (itens.length === 0) {
      mostrarToast('A proposta precisa de pelo menos um item.');
      return;
    }
    itens.push(...editarProposta.itens.filter((item) => !catalogo.some((product) => product.nome === item.nome)));
    const valor = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
    const requiresApproval = editDesconto > config.descontoExigeAprovacaoAcima;
    const retainsApproval = requiresApproval
      && editDesconto === editarProposta.descontoPct
      && editarProposta.descontoAprovado === true;
    atualizar(editarProposta.id, {
      itens,
      valor,
      descontoPct: editDesconto,
      descontoAprovado: !requiresApproval || retainsApproval,
      bloqueadaEnvio: requiresApproval && !retainsApproval,
      status: requiresApproval && !retainsApproval
        ? 'aguardando_aprovacao'
        : editarProposta.status === 'aguardando_aprovacao' ? 'rascunho' : editarProposta.status,
    });
    if (!await confirmarGravacao()) return;
    setEditarProposta(null);
    mostrarToast(`Proposta ${editarProposta.numero} atualizada.`);
  };

  const excluirProposta = async (id: string) => {
    if (!window.confirm('Arquivar esta proposta? Ela sairá da lista sem apagar o histórico no servidor.')) return;
    excluir(id);
    if (!await confirmarGravacao()) return;
    setSelecionada(null);
    mostrarToast('Proposta arquivada.');
  };

  const subtotalEdit = Object.entries(editItens).reduce((acc, [catId, qtd]) => {
    const c = catalogo.find((x) => x.id === catId);
    return c ? acc + (confirmedUnitPrice(c.preco, editPrecos[catId]) ?? 0) * qtd : acc;
  }, (editarProposta?.itens ?? []).filter((item) => !catalogo.some((product) => product.nome === item.nome)).reduce((sum, item) => sum + item.preco * item.quantidade, 0));
  const editPrecoPendente = Object.entries(editItens).some(([id, qtd]) => qtd > 0 && confirmedUnitPrice(catalogo.find((c) => c.id === id)?.preco ?? 0, editPrecos[id]) === null);
  const totalEdit = subtotalEdit * (1 - editDesconto / 100);

  return (
    <div className="wf-page wf-secondary-page wf-secondary-page--quotes">
      <DataReadNotice status={loadStatus} onRetry={() => { void refreshPropostasStore().catch(() => undefined); }} />
      <header className="wf-secondary-header mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="wf-secondary-eyebrow">Operação comercial</p>
          <h1 className="wf-page-title mb-1">Orçamentos</h1>
          <p className="wf-secondary-description text-sm">Crie, aprove, envie e acompanhe orçamentos comerciais.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => navigate('/dashboard/configuracoes?tab=empresa&subtab=templates')} className="inline-flex items-center gap-2 rounded-full border border-background-300 bg-background-50 px-4 py-2.5 text-sm font-semibold text-foreground-800 hover:bg-background-100">
            <i className="ri-file-copy-2-line" /> Modelos e catálogo
          </button>
          <button type="button" onClick={() => setNovoModal(true)} className="wf-secondary-action inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold">
            <i className="ri-add-line" /> Novo orçamento
          </button>
        </div>
      </header>

      {toast && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800"><i className="ri-information-line" />{toast}</div>}

      <section className="wf-secondary-filter mb-4 overflow-hidden" aria-label="Filtros de orçamentos">
        <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-background-200/70 px-4 py-3 sm:px-5" role="tablist" aria-label="Status do orçamento">
          {statusTabs.map((tab) => {
            const count = tab.value === '' ? propostas.length : propostas.filter((proposal) => proposal.status === tab.value).length;
            const active = filtroStatus === tab.value;
            return <button key={tab.value || 'all'} type="button" role="tab" aria-selected={active} onClick={() => setFiltroStatus(tab.value)} className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${active ? 'border border-primary-400 bg-primary-50 text-primary-800' : 'text-foreground-700 hover:bg-background-100'}`}><span>{tab.label}</span><span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-primary-100 text-primary-800' : 'bg-background-100 text-foreground-600'}`}>{loadStatus === 'ready' ? count : '—'}</span></button>;
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
          <label className="relative min-w-[220px] flex-1"><span className="sr-only">Buscar orçamento</span><i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400" /><input value={buscaProposta} onChange={(event) => setBuscaProposta(event.target.value)} placeholder="Buscar número, empresa, contato ou item" className="w-full rounded-lg border border-background-300 bg-background-50 py-2.5 pl-9 pr-3 text-sm" /></label>
          <label className="min-w-[170px]"><span className="sr-only">Responsável</span><select value={filtroResponsavel} onChange={(event) => setFiltroResponsavel(event.target.value)} className="w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2.5 text-sm"><option value="">Todos os responsáveis</option>{responsaveis.map((responsavel) => <option key={responsavel} value={responsavel}>{responsavel}</option>)}</select></label>
          <button type="button" onClick={() => setMostrarFiltros((value) => !value)} className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-semibold ${mostrarFiltros ? 'border-primary-400 bg-primary-50 text-primary-800' : 'border-background-300 text-foreground-800 hover:bg-background-100'}`}><i className="ri-equalizer-2-line" /> Filtros</button>
          <button type="button" onClick={() => setColunas((value) => value === 'essenciais' ? 'completas' : 'essenciais')} className="inline-flex items-center gap-2 rounded-lg border border-background-300 px-3.5 py-2.5 text-sm font-semibold text-foreground-800 hover:bg-background-100"><i className="ri-layout-column-line" /> Colunas</button>
          <label className="ml-auto flex items-center gap-2 text-sm text-foreground-500"><span className="hidden sm:inline">Ordenar por</span><select value={ordenacao} onChange={(event) => setOrdenacao(event.target.value as typeof ordenacao)} className="rounded-lg border border-background-300 bg-background-50 px-3 py-2.5 font-semibold text-foreground-800"><option value="updated">Atualizados recentemente</option><option value="created">Criados recentemente</option><option value="validity">Validade mais próxima</option><option value="value">Maior valor</option></select></label>
        </div>
        {mostrarFiltros && <div className="flex flex-wrap items-center gap-2 border-t border-background-200/70 bg-background-50 px-4 py-3 text-xs text-foreground-600 sm:px-5"><span className="rounded-full bg-background-100 px-3 py-1.5">Status: {filtroStatus ? statusLabel[filtroStatus] : 'Todos'}</span><span className="rounded-full bg-background-100 px-3 py-1.5">Itens incluídos na busca</span><button type="button" onClick={() => { setFiltroStatus(''); setFiltroResponsavel(''); setBuscaProposta(''); }} className="font-semibold text-primary-700 hover:underline">Limpar filtros</button></div>}
      </section>

      <section className="wf-secondary-panel wf-secondary-table overflow-hidden" aria-labelledby="quote-portfolio-title">
        <div className="wf-secondary-panel-heading"><div><p className="wf-secondary-eyebrow">Carteira de orçamentos</p><h2 id="quote-portfolio-title">Orçamentos cadastrados</h2></div><div className="flex items-center gap-3"><span className="wf-secondary-count">{propostasVisiveis.length} registros</span><button type="button" onClick={() => setColunas((value) => value === 'essenciais' ? 'completas' : 'essenciais')} className="hidden rounded-lg border border-background-300 px-3 py-2 text-sm font-semibold text-foreground-800 hover:bg-background-100 sm:inline-flex"><i className="ri-layout-column-line mr-1" /> Colunas</button></div></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-background-200/70 bg-background-100/50"><th className="w-10 px-5 py-3 text-left"><input type="checkbox" aria-label="Selecionar todos os orçamentos" disabled /></th><th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground-500">Número</th><th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground-500">Empresa / contato</th><th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground-500">Valor</th><th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground-500">Situação</th><th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground-500">Responsável</th>{colunas === 'completas' && <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground-500">Canal / versão</th>}<th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-foreground-500">Validade</th><th className="w-16 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-foreground-500">Ações</th></tr></thead>
            <tbody>
              {propostasVisiveis.map((p) => <tr key={p.id} className="border-b border-background-100 hover:bg-background-50/60">
                <td className="px-5 py-4"><input type="checkbox" aria-label={`Selecionar orçamento ${p.numero}`} /></td>
                <td className="px-3 py-4"><button type="button" onClick={() => setSelecionada(p)} className="font-semibold text-primary-700 hover:underline">{p.numero}</button><p className="mt-1 text-xs text-foreground-500">v{p.versao} · {p.data}</p></td>
                <td className="px-3 py-4"><button type="button" onClick={() => setSelecionada(p)} className="text-left"><p className="font-semibold text-foreground-900">{p.empresa}</p><p className="text-xs text-foreground-500">{p.lead}</p></button></td>
                <td className="px-3 py-4"><p className="font-bold tabular-nums text-foreground-900">{fmt(valorComDesconto(p))}</p>{p.descontoPct > 0 && <p className="text-xs text-foreground-400 line-through">{fmt(p.valor)}</p>}</td>
                <td className="px-3 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusCor[p.status]}`}>{statusLabel[p.status]}</span>{p.status === 'recusada' && p.motivoPerda && <p className="mt-1 max-w-[150px] truncate text-[11px] text-foreground-500" title={p.motivoPerda}>{p.motivoPerda}</p>}</td>
                <td className="px-3 py-4 text-foreground-700">{p.responsavel}</td>
                {colunas === 'completas' && <td className="px-3 py-4 text-foreground-700"><span>{p.canal}</span><span className="mt-1 block text-xs text-foreground-500">Versão {p.versao}</span></td>}
                <td className="px-3 py-4 text-foreground-700">{new Date(p.validade + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-4 text-right"><div className="flex justify-end gap-1"><button type="button" onClick={() => setSelecionada(p)} className="rounded-lg p-2 text-foreground-600 hover:bg-background-100" title="Abrir orçamento"><i className="ri-eye-line" /></button><button type="button" onClick={() => baixarPDF(p)} className="rounded-lg p-2 text-foreground-600 hover:bg-background-100" title="Prévia para impressão"><i className="ri-file-pdf-line" /></button><button type="button" onClick={() => { if (p.status === 'rascunho' || p.status === 'aguardando_aprovacao') abrirEdicaoProposta(p); else setSelecionada(p); }} className="rounded-lg p-2 text-foreground-600 hover:bg-background-100" title="Mais ações"><i className="ri-more-2-fill" /></button></div></td>
              </tr>)}
              {loadStatus === 'ready' && propostasVisiveis.length === 0 && <tr><td colSpan={colunas === 'completas' ? 9 : 8} className="px-6 py-16 text-center"><div className="mx-auto flex max-w-md flex-col items-center"><span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-3xl text-primary-700"><i className="ri-file-list-3-line" /></span><h3 className="text-lg font-bold text-foreground-950">{propostas.length ? 'Nenhum orçamento corresponde aos filtros' : 'Nenhum orçamento criado'}</h3><p className="mt-2 text-sm text-foreground-500">{propostas.length ? 'Ajuste a busca ou limpe os filtros para consultar a carteira.' : 'Crie seu primeiro orçamento vinculando uma empresa e adicionando produtos ou serviços.'}</p><div className="mt-5 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => setNovoModal(true)} className="wf-secondary-action inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold"><i className="ri-add-line" /> Criar primeiro orçamento</button><button type="button" onClick={() => navigate('/dashboard/configuracoes?tab=empresa&subtab=catalogo')} className="inline-flex items-center gap-2 rounded-full border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-800 hover:bg-background-100"><i className="ri-book-open-line" /> Abrir catálogo</button></div><button type="button" onClick={() => navigate('/dashboard/configuracoes?tab=empresa&subtab=templates')} className="mt-4 text-sm font-semibold text-primary-700 hover:underline">Saiba como funciona <i className="ri-arrow-right-up-line ml-1" /></button></div></td></tr>}
            </tbody>
          </table>
        </div>
        {colunas === 'completas' && <div className="border-t border-background-200/70 bg-background-50 px-5 py-3 text-xs text-foreground-500">Colunas adicionais disponíveis no detalhe: canal, versão, data de criação e itens incluídos. A carteira mantém as colunas essenciais para leitura rápida.</div>}
      </section>

      {/* Drawer de detalhe */}
      {selecionada && (
        <AccessibleDialog title="Detalhes da proposta" className="fixed inset-0 z-50 bg-foreground-950/50 flex justify-end" onClose={() => setSelecionada(null)}>
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
                    <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 bg-background-100 rounded-lg px-4 py-2.5">
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
                Imprimir proposta
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
                  disabled={saving} onClick={() => novaVersao(selecionada)}
                  className="w-full px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-git-branch-line mr-2"></i>
                  Criar nova versão
                </button>
              )}
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Modal Nova proposta */}
      {novoModal && (
        <AccessibleDialog title="Novo registro" className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClose={() => setNovoModal(false)}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Nova proposta</h3>
              <button aria-label="Fechar formulário" onClick={() => setNovoModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
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
                      <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 bg-background-100 rounded-lg px-4 py-2.5">
                        <div>
                          <p className="text-sm text-foreground-800">{c.nome}</p>
                          <p className="text-xs text-foreground-500">{c.preco > 0 ? fmt(c.preco) : 'Preço a confirmar'} / {c.unidade}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {qtd > 0 && <label className="text-xs">Unitário (R$)<input type="number" min="0" step="0.01" aria-label={`Preço unitário de ${c.nome}`} value={novaPrecos[c.id] ?? (c.preco > 0 ? String(c.preco) : '')} onChange={(event) => setNovaPrecos({ ...novaPrecos, [c.id]: event.target.value })} placeholder="Definir" className="ml-2 w-24 rounded border border-background-300 px-2" /></label>}
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
                <span className="text-lg font-heading font-extrabold text-foreground-950">{novaPrecoPendente ? 'A definir' : fmt(totalNova)}</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button aria-label="Fechar formulário" onClick={() => setNovoModal(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button disabled={saving} onClick={criarProposta} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Criar proposta</button>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Modal Editar proposta */}
      {editarProposta && (
        <AccessibleDialog title="Editar proposta" className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClose={() => setEditarProposta(null)}>
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
                      <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 bg-background-100 rounded-lg px-4 py-2.5">
                        <div>
                          <p className="text-sm text-foreground-800">{c.nome}</p>
                          <p className="text-xs text-foreground-500">{c.preco > 0 ? fmt(c.preco) : 'Preço a confirmar'} / {c.unidade}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {qtd > 0 && <label className="text-xs">Unitário (R$)<input type="number" min="0" step="0.01" aria-label={`Preço unitário de ${c.nome}`} value={editPrecos[c.id] ?? (c.preco > 0 ? String(c.preco) : '')} onChange={(event) => setEditPrecos({ ...editPrecos, [c.id]: event.target.value })} placeholder="Definir" className="ml-2 w-24 rounded border border-background-300 px-2" /></label>}
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
                <span className="text-lg font-heading font-extrabold text-foreground-950">{editPrecoPendente ? 'A definir' : fmt(totalEdit)}</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setEditarProposta(null)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button disabled={saving} onClick={salvarEdicaoProposta} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Salvar alterações</button>
            </div>
          </div>
        </AccessibleDialog>
      )}

      {/* Modal motivo de perda */}
      {perdaModal && (
        <AccessibleDialog title="Registrar perda" className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClose={() => setPerdaModal(null)}>
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
        </AccessibleDialog>
      )}

      {/* Modal gerar documento */}
      {docModal && (
        <AccessibleDialog title="Gerar documento" className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClose={() => setDocModal(null)}>
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
        </AccessibleDialog>
      )}
    </div>
  );
}
