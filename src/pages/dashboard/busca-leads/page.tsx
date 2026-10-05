import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Lead } from '@/mocks/leadsData';
import { refreshLeadsStore, useLeadsStore } from '@/hooks/useLeadsStore';
import { refreshListsStore } from '@/hooks/useListasStore';
import { fontesApiProspeccao, fontesAtivas, useFontesStore } from '@/hooks/useFontesStore';
import { templatesMensagem } from '@/mocks/templatesData';
import { useAuth } from '@/hooks/useAuth';
import { sessionContext } from '@/lib/sessionContext';
import { loadCurrentAccess } from '@/lib/crm/currentAccessRepository';
import { findActiveAssignee, loadTeamMembers, roleLabel, type TeamMember } from '@/lib/crm/teamMembersRepository';
import { temperaturaDe, tempBadge } from '@/mocks/enriquecimentoData';
import type { PreviewLead } from '@/mocks/enriquecimentoData';
import PromptAgent from '@/pages/dashboard/busca-leads/components/PromptAgent';
import LeadPreviewDrawer from '@/pages/dashboard/busca-leads/components/LeadPreviewDrawer';
import ProspectingMap from '@/pages/dashboard/busca-leads/components/ProspectingMap';
import CsvImportModal from '@/components/feature/CsvImportModal';
import type { CampoImportacao, ResultadoImportacao } from '@/components/feature/CsvImportModal';
import { useOperationalMode } from '@/hooks/useOperationalMode';
import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { prospectingImportDetails } from '@/lib/crm/prospectingImportDetails';
import { importProspectingBatch, type ProspectingBatchInput } from '@/lib/crm/prospectingBatchRepository';
import InfoTooltip from '@/components/feature/InfoTooltip';
import {
  MAX_PROSPECTING_TERMS,
  csvLeadIdentity,
  deterministicProspectingUuid,
  nextProspectingTerms,
  normalizeProspectingPhone,
  normalizeProspectingTerms,
  prepareCsvLeads,
  type ProspectingReviewFilter,
} from '@/lib/crm/prospectingUi';
import {
  PROSPECTING_TERM_SUGGESTION_GROUPS,
  findProspectingTermSuggestions,
} from '@/lib/crm/prospectingTermSuggestions';
import {
  PROSPECTING_CUSTOMER_SEGMENTS,
  PROSPECTING_TARGET_PROFILES,
  termsFromIdealProfile,
  type ProspectingTargetProfile,
} from '@/lib/crm/prospectingIdealProfile';
import {
  PROSPECTING_WIZARD_STEPS,
  nextProspectingWizardStep,
  validateProspectingWizardStep,
  prospectingWizardBlockReason,
  type ProspectingWizardStep,
} from '@/lib/crm/prospectingWizard';

const estados = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE', 'GO', 'DF'];
const fasesBusca = ['Iniciando a busca', 'Aguardando resposta da fonte', 'Preparando a revisão'];
const PROSPECTING_REQUEST_STORAGE_KEY = 'wayflex.prospecting.pending-request.v1';
const SAMPLE_SIZE = 10;

type SampleClassification = 'adequada' | 'fora_do_perfil' | 'duplicada' | 'sem_contato_util';
const SAMPLE_CLASSIFICATIONS: Array<{ id: SampleClassification; label: string }> = [
  { id: 'adequada', label: 'Adequada' },
  { id: 'fora_do_perfil', label: 'Fora do perfil' },
  { id: 'duplicada', label: 'Duplicada' },
  { id: 'sem_contato_util', label: 'Sem contato útil' },
];
const OUT_OF_PROFILE_REASONS = ['Segmento incorreto', 'Concorrente', 'Região incorreta', 'Empresa sem potencial de compra', 'Outro'];

interface ProspectingRunSummary {
  id: string;
  status: string;
  startedAt: string | null;
  resultCount: number;
  hasProvider: boolean;
  hasResults: boolean;
  providerStartState?: string;
  lastError: string | null;
  location: string;
  fromTeam?: boolean;
}

interface ProspectingLeadResponse {
  id?: string;
  externalId?: string;
  nome?: string;
  name?: string;
  empresa?: string;
  company?: string;
  razao_social?: string;
  nome_fantasia?: string;
  telefone?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  website?: string;
  cidade?: string;
  city?: string;
  municipio?: string;
  estado?: string;
  state?: string;
  uf?: string;
  logradouro?: string;
  cnae_descricao?: string;
  cargo?: string;
  segmento?: string;
  porte?: string;
  cnpj?: string;
  score?: number;
  fit_score?: number;
  contactability_score?: number;
  engagement_score?: number;
  score_reason?: string;
  source_record_id?: string;
  source_url?: string;
  channel_verification?: { whatsapp?: string; email?: string };
  sourceUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  lat?: number | null;
  lng?: number | null;
}

interface ProspectingResponse {
  pending?: boolean;
  runId?: string;
  error?: string;
  recoverable?: boolean;
  leads?: ProspectingLeadResponse[];
}

interface PendingCsvBatch {
  fingerprint: string;
  input: ProspectingBatchInput;
  duplicateCount: number;
}

async function listarExecucoesApify(): Promise<ProspectingRunSummary[]> {
  const { data, error } = await supabase.functions.invoke('prospectar-leads', {
    body: { action: 'list_runs', sourceKey: 'apify', mode: 'production' },
  });
  if (error) throw error;
  return Array.isArray(data?.runs) ? data.runs as ProspectingRunSummary[] : [];
}

function prospectingLeadToPreview(lead: ProspectingLeadResponse, fonte: string, index: number): PreviewLead {
  const nome = lead.nome || lead.name || lead.nome_fantasia || lead.razao_social || 'Contato sem nome';
  const empresa = lead.empresa || lead.company || lead.razao_social || lead.nome_fantasia || nome;
  const whatsapp = lead.whatsapp || '';
  const telefone = lead.telefone || lead.phone || whatsapp;
  const email = lead.email || '';
  const site = lead.site || lead.website || '';
  const score = typeof lead.score === 'number' ? Math.max(0, Math.min(100, Math.round(lead.score))) : 60;
  const details = prospectingImportDetails(lead);
  const latitudeValue = lead.latitude ?? lead.lat;
  const longitudeValue = lead.longitude ?? lead.lng;
  const latitude = latitudeValue == null ? NaN : Number(latitudeValue);
  const longitude = longitudeValue == null ? NaN : Number(longitudeValue);
  return {
    id: lead.id || lead.externalId || `real-${index}-${Date.now()}`,
    nome,
    empresa,
    cnpj: lead.cnpj || '—',
    cargo: lead.cargo || '',
    telefone,
    whatsapp,
    email,
    ...details,
    localidade: [details.cidade, details.estado].filter(Boolean).join(' - ') || '—',
    fonte,
    validacao: email && !validarEmailReal(email) ? 'revisar' : 'ok',
    duplicado: false,
    score,
    temperatura: temperaturaDe(score),
    completude: Math.round(([nome, empresa, telefone, email, site].filter(Boolean).length / 5) * 100),
    fitScore: lead.fit_score ?? score,
    contactabilityScore: lead.contactability_score ?? 0,
    engagementScore: lead.engagement_score ?? 0,
    scoreExplanation: lead.score_reason || '',
    motivos: [lead.segmento || 'Fonte real', lead.source_url || lead.sourceUrl ? 'Origem rastreável' : 'Contato retornado pelo provedor'].filter(Boolean),
    canais: { whatsapp: Boolean(whatsapp), email: Boolean(email && validarEmailReal(email)), site: Boolean(site), instagram: false },
    whatsappStatus: lead.channel_verification?.whatsapp === 'source_reported' && whatsapp ? 'verified' : telefone ? 'unverified' : 'absent',
    sourceRecordId: lead.source_record_id || lead.id || lead.externalId,
    sourceUrl: lead.source_url || lead.sourceUrl,
    selecionado: true,
    latitude: Number.isFinite(latitude) && Math.abs(latitude) <= 85 ? latitude : null,
    longitude: Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? longitude : null,
  };
}

function validarEmailReal(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizarTermoSugerido(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ');
}

const camposLeadImport: CampoImportacao[] = [
  { chave: 'nome', rotulo: 'Nome', obrigatorio: true, aliases: ['contato', 'cliente'] },
  { chave: 'empresa', rotulo: 'Empresa', obrigatorio: true, aliases: ['empresa_nome', 'razao_social'] },
  { chave: 'email', rotulo: 'E-mail', aliases: ['e-mail', 'correio'] },
  { chave: 'telefone', rotulo: 'Telefone', aliases: ['whatsapp', 'celular', 'fone'] },
  { chave: 'segmento', rotulo: 'Segmento' },
  { chave: 'cidade', rotulo: 'Cidade' },
  { chave: 'estado', rotulo: 'Estado (UF)', aliases: ['uf'] },
];

export default function BuscaLeads() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<'agente' | 'busca' | 'importar' | 'salvas'>('busca');
  const [etapa, setEtapa] = useState(1);
  const [wizardStep, setWizardStep] = useState<ProspectingWizardStep>(1);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [fonteSelecionada, setFonteSelecionada] = useState('');
  const [cidade, setCidade] = useState('São Paulo');
  const [estado, setEstado] = useState('SP');
  const [pais, setPais] = useState('Brasil');
  const [ofertaEmpresa, setOfertaEmpresa] = useState('Peças e soluções em borracha, silicone e poliuretano');
  const [tipoEmpresaAlvo, setTipoEmpresaAlvo] = useState<ProspectingTargetProfile>('potential_customers');
  const [segmentosCliente, setSegmentosCliente] = useState<string[]>([]);
  const [termosBusca, setTermosBusca] = useState<string[]>([]);
  const [novoTermo, setNovoTermo] = useState('');
  const [segmentoSugestao, setSegmentoSugestao] = useState('');
  const [leadsDia, setLeadsDia] = useState(30);
  const [temSite, setTemSite] = useState<boolean | null>(null);
  const [temWhatsApp, setTemWhatsApp] = useState<boolean | null>(null);
  const [temEmail, setTemEmail] = useState<boolean | null>(null);
  const [filtrosAvancados, setFiltrosAvancados] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erroImportacao, setErroImportacao] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [importacaoPendenteVerificacao, setImportacaoPendenteVerificacao] = useState(false);
  const lotePendente = useRef<ProspectingBatchInput | null>(null);
  const loteCsvPendente = useRef<PendingCsvBatch | null>(null);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewLead[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [faseBusca, setFaseBusca] = useState('');
  const [execucoes, setExecucoes] = useState<ProspectingRunSummary[]>([]);
  const [carregandoExecucoes, setCarregandoExecucoes] = useState(false);
  const [erroExecucoes, setErroExecucoes] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [historicoCarregado, setHistoricoCarregado] = useState(false);
  const [execucaoAtual, setExecucaoAtual] = useState<string | null>(null);
  const [leadAberto, setLeadAberto] = useState<PreviewLead | null>(null);
  const [feedbackRevisao, setFeedbackRevisao] = useState('');
  const [classificacoesAmostra, setClassificacoesAmostra] = useState<Record<string, SampleClassification>>({});
  const [motivosForaPerfil, setMotivosForaPerfil] = useState<Record<string, string>>({});
  const [filtroRevisao, setFiltroRevisao] = useState<ProspectingReviewFilter>('todos');
  const [mapaAberto, setMapaAberto] = useState(false);
  const [nomeLista, setNomeLista] = useState('');
  const [modoAtendimento, setModoAtendimento] = useState<'IA' | 'HUMANO'>('IA');
  const [responsavel, setResponsavel] = useState('');
  const [membros, setMembros] = useState<TeamMember[]>([]);
  const [carregandoMembros, setCarregandoMembros] = useState(false);
  const [erroMembros, setErroMembros] = useState(false);
  const [canal, setCanal] = useState('WhatsApp');
  const [template, setTemplate] = useState('tm-1');
  const [tags, setTags] = useState('');
  const [opcoesAvancadasImportacao, setOpcoesAvancadasImportacao] = useState(false);
  const [autorizacaoContato, setAutorizacaoContato] = useState(false);
  const [origemAutorizacao, setOrigemAutorizacao] = useState('');

  const [leads] = useLeadsStore();
  const { fontes, recarregar: recarregarFontes } = useFontesStore();
  const { mode: operationalMode } = useOperationalMode();
  const { user } = useAuth();
  const [csvModal, setCsvModal] = useState(false);
  const [csvConfirmacaoPendente, setCsvConfirmacaoPendente] = useState(false);
  const membrosAtivos = membros.filter((member) => member.status === 'active');

  useEffect(() => {
    void recarregarFontes();
    const atualizarAoRetomar = () => { void recarregarFontes(); };
    window.addEventListener('focus', atualizarAoRetomar);
    return () => window.removeEventListener('focus', atualizarAoRetomar);
  }, [recarregarFontes]);

  useEffect(() => {
    if (aba !== 'busca' || etapa !== 4) return;
    let mounted = true;
    setCarregandoMembros(true);
    loadTeamMembers()
      .then((members) => { if (mounted) { setMembros(members); setErroMembros(false); } })
      .catch(() => { if (mounted) { setMembros([]); setErroMembros(true); } })
      .finally(() => { if (mounted) setCarregandoMembros(false); });
    return () => { mounted = false; };
  }, [aba, etapa]);
  // A busca manual expõe somente provedores que o backend realmente executa.
  const fontesProspecao = useMemo(() => fontesApiProspeccao(fontes), [fontes]);
  const fontesDisponiveis = useMemo(() => fontesAtivas(fontesProspecao), [fontesProspecao]);
  const fonteUnicaAtiva = fontesDisponiveis.length === 1 ? fontesDisponiveis[0] : null;
  const gruposSugeridos = useMemo(() => findProspectingTermSuggestions(segmentoSugestao), [segmentoSugestao]);
  const termosSelecionados = useMemo(() => new Set(normalizeProspectingTerms(termosBusca).map((term) => normalizarTermoSugerido(term))), [termosBusca]);
  const termosDoPerfil = useMemo(
    () => termsFromIdealProfile(ofertaEmpresa, tipoEmpresaAlvo, segmentosCliente),
    [ofertaEmpresa, tipoEmpresaAlvo, segmentosCliente],
  );
  // Só os termos marcados pelo usuário seguem para o provedor. O perfil ideal
  // oferece sugestões, mas não dispara uma busca com filtros implícitos.
  const termosAplicados = useMemo(() => normalizeProspectingTerms(termosBusca), [termosBusca]);
  const tipoEmpresaAlvoLabel = PROSPECTING_TARGET_PROFILES.find((item) => item.id === tipoEmpresaAlvo)?.label || 'Clientes potenciais';
  const activeSearchStage = etapa;
  const wizardDraft = useMemo(() => ({
    sourceId: fonteSelecionada,
    city: cidade,
    offer: ofertaEmpresa,
    terms: termosAplicados,
  }), [cidade, fonteSelecionada, ofertaEmpresa, termosAplicados]);
  const wizardBlockReason = prospectingWizardBlockReason(wizardStep, wizardDraft, buscando);

  useEffect(() => {
    if (wizardError && !validateProspectingWizardStep(wizardStep, wizardDraft)) {
      setWizardError(null);
    }
  }, [wizardDraft, wizardError, wizardStep]);

  useEffect(() => {
    if (fonteSelecionada && !fontesDisponiveis.some((fonte) => fonte.id === fonteSelecionada)) {
      setFonteSelecionada('');
      setEtapa(1);
      setWizardStep(1);
    }
  }, [fonteSelecionada, fontesDisponiveis]);

  useEffect(() => {
    if (!fonteUnicaAtiva || fonteSelecionada) return;
    setFonteSelecionada(fonteUnicaAtiva.id);
  }, [fonteSelecionada, fonteUnicaAtiva]);

  useEffect(() => {
    if ((aba !== 'busca' && aba !== 'salvas') || !historicoAberto || historicoCarregado) return;
    let mounted = true;
    setCarregandoExecucoes(true);
    listarExecucoesApify()
      .then((runs) => { if (mounted) { setExecucoes(runs); setErroExecucoes(false); setHistoricoCarregado(true); } })
      .catch(() => { if (mounted) setErroExecucoes(true); })
      .finally(() => { if (mounted) setCarregandoExecucoes(false); });
    return () => { mounted = false; };
  }, [aba, historicoAberto, historicoCarregado]);

  const atualizarExecucoes = async () => {
    setCarregandoExecucoes(true);
    try { setExecucoes(await listarExecucoesApify()); setErroExecucoes(false); setHistoricoCarregado(true); }
    catch { setErroExecucoes(true); }
    finally { setCarregandoExecucoes(false); }
  };

  const responsavelNome = modoAtendimento === 'IA'
    ? 'Ana (IA)'
    : findActiveAssignee(membrosAtivos, responsavel)?.name || 'Selecione um usuário ativo';

  const normalizar = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const validarEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // Cruza os leads encontrados com os leads já existentes no funil para sinalizar
  // duplicados (por e-mail, WhatsApp ou CNPJ) e valida o formato dos contatos.
  const cruzarPreview = (lista: PreviewLead[]): PreviewLead[] => {
    return lista.map((l) => {
      const email = normalizar(l.email);
      const whats = normalizar(l.telefone);
      const empresa = normalizar(l.empresa);
      const duplicado = leads.some((existente) => {
        const eEx = normalizar(existente.email);
        const wEx = normalizar(existente.whatsapp || existente.telefone);
        const emEx = normalizar(existente.empresa);
        return (
          (email && eEx && email === eEx) ||
          (whats && wEx && whats === wEx) ||
          (empresa && emEx && empresa === emEx)
        );
      });
      const validacao = l.email && !validarEmail(l.email) ? 'revisar' : l.validacao;
      return { ...l, duplicado, validacao };
    });
  };

  const mapearNovoLead = (dados: Partial<Lead> & { nome: string; empresa: string }): Lead => {
    const contatoAprovado = dados.contactApprovalStatus === 'approved';
    const modo = dados.modoAtendimento || modoAtendimento;
    return ({
    id: dados.id || crypto.randomUUID(),
    nome: dados.nome,
    empresa: dados.empresa,
    cnpj: dados.cnpj || '—',
    email: dados.email || '',
    telefone: dados.telefone || '',
    whatsapp: dados.whatsapp || '',
    segmento: dados.segmento || '',
    cidade: dados.cidade || '',
    estado: dados.estado || '',
    porte: dados.porte || '',
    score: dados.score ?? 60,
    temperatura: dados.temperatura || (dados.score !== undefined && dados.score >= 80 ? 'Quente' : dados.score !== undefined && dados.score >= 60 ? 'Morno' : 'Frio'),
    etapa: dados.etapa || 'Novo',
    origem: dados.origem || 'Importação',
    responsavel: dados.responsavel || responsavelNome,
    responsavelId: modo === 'IA' ? '' : responsavel,
    modoAtendimento: modo,
    automacaoStatus: contatoAprovado && modo === 'IA' ? 'ATIVA' : 'PAUSADA',
    canalPreferencial: dados.canalPreferencial ?? canal,
    templateId: template,
    tags: dados.tags ?? (tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []),
    bloqueado: false,
    contatoPermitido: contatoAprovado,
    consentimentoWhatsApp: contatoAprovado && canal === 'WhatsApp',
    consentimentoEmail: contatoAprovado && canal === 'E-mail',
    contactApprovalStatus: contatoAprovado ? 'approved' : 'pending',
    contactApprovalReason: dados.contactApprovalReason || '',
    contactApprovedAt: contatoAprovado ? new Date().toISOString() : null,
    sourceRecordId: dados.sourceRecordId,
    sourceUrl: dados.sourceUrl,
    deduplicationKey: dados.deduplicationKey,
    fitScore: dados.fitScore,
    contactabilityScore: dados.contactabilityScore,
    engagementScore: dados.engagementScore ?? 0,
    scoreExplanation: dados.scoreExplanation,
    scoreVerifiedAt: dados.scoreVerifiedAt || new Date().toISOString(),
    maxFollowUps: 2,
    followUpCount: 0,
    intencao: null,
    sentimento: 'NEUTRO',
    confianca: 100,
    proximaAcao: null,
    motivoTransferencia: '',
    automationEvents: [],
    historico: [{ id: `h-import-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, tipo: 'IMPORTACAO', descricao: `Lead importado via ${dados.origem || 'Importação'}`, ator: 'Sistema', data: new Date().toISOString() }],
    ultimaInteracao: 'agora',
    criadoEm: dados.criadoEm || new Date().toISOString().slice(0, 10),
    aguardandoAtivacao: !contatoAprovado,
  });
  };

  const adicionarTermo = () => {
    const next = nextProspectingTerms(termosBusca, novoTermo);
    if (!novoTermo.trim()) return;
    if (next.length === termosBusca.length) {
      setErroBusca(`Use termos diferentes e mantenha no máximo ${MAX_PROSPECTING_TERMS}.`);
      return;
    }
    setTermosBusca(next);
    setNovoTermo('');
    setErroBusca(null);
  };

  const removerTermo = (term: string) => {
    const normalized = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    setTermosBusca((current) => current.filter((value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR') !== normalized));
  };

  const alternarTermoSugerido = (term: string) => {
    if (termosSelecionados.has(normalizarTermoSugerido(term))) {
      removerTermo(term);
      return;
    }
    const next = nextProspectingTerms(termosBusca, term);
    if (next.length === termosBusca.length) {
      setErroBusca(`O limite é de ${MAX_PROSPECTING_TERMS} termos. Remova um termo antes de marcar outra opção.`);
      return;
    }
    setTermosBusca(next);
    setErroBusca(null);
  };

  const adicionarGrupoSugerido = (terms: string[]) => {
    const next = normalizeProspectingTerms([...termosBusca, ...terms]);
    if (next.length === termosBusca.length) {
      setErroBusca(termosBusca.length >= MAX_PROSPECTING_TERMS
        ? `O limite é de ${MAX_PROSPECTING_TERMS} termos. Remova um termo antes de adicionar outras opções.`
        : 'As opções deste segmento já estão selecionadas.');
      return;
    }
    setTermosBusca(next);
    setErroBusca(null);
  };

  const alternarSegmentoCliente = (segment: string) => {
    setSegmentosCliente((current) => current.includes(segment)
      ? current.filter((item) => item !== segment)
      : [...current, segment]);
  };

  const gerarSugestoesDoPerfil = () => {
    const suggested = termsFromIdealProfile(ofertaEmpresa, tipoEmpresaAlvo, segmentosCliente);
    const next = normalizeProspectingTerms([...termosBusca, ...suggested]);
    if (!suggested.length) {
      setErroBusca('Informe a oferta da empresa ou selecione segmentos para gerar termos relacionados.');
      return;
    }
    if (next.length === termosBusca.length) {
      setErroBusca(termosBusca.length >= MAX_PROSPECTING_TERMS
        ? `O limite é de ${MAX_PROSPECTING_TERMS} termos. Remova um termo antes de gerar outras sugestões.`
        : 'As sugestões deste perfil já estão selecionadas.');
      return;
    }
    setTermosBusca(next);
    setErroBusca(null);
  };

  const classificacaoDaAmostra = (lead: PreviewLead): SampleClassification => {
    if (lead.duplicado) return 'duplicada';
    return classificacoesAmostra[lead.id] || 'adequada';
  };

  const atualizarClassificacaoAmostra = (lead: PreviewLead, classification: SampleClassification) => {
    if (lead.duplicado && classification !== 'duplicada') return;
    setClassificacoesAmostra((current) => ({ ...current, [lead.id]: classification }));
    if (classification !== 'adequada') setSelecionados((current) => current.filter((id) => id !== lead.id));
    else if (!lead.duplicado) setSelecionados((current) => current.includes(lead.id) ? current : [...current, lead.id]);
  };

  const requestSignature = (sourceKey: string, filters: Record<string, unknown>) => JSON.stringify({ sourceKey, filters });

  const requestKeyFor = (sourceKey: string, filters: Record<string, unknown>) => {
    const context = sessionContext.requireReady();
    const storageKey = `${PROSPECTING_REQUEST_STORAGE_KEY}:${context.userId}:${context.organizationId}`;
    const signature = requestSignature(sourceKey, filters);
    try {
      const stored = JSON.parse(window.sessionStorage.getItem(storageKey) || '{}') as { signature?: string; key?: string };
      if (stored.signature === signature && typeof stored.key === 'string' && stored.key) return stored.key;
      const key = crypto.randomUUID();
      window.sessionStorage.setItem(storageKey, JSON.stringify({ signature, key }));
      return key;
    } catch {
      return crypto.randomUUID();
    }
  };

  const clearRequestKey = () => {
    const context = sessionContext.get();
    try { window.sessionStorage.removeItem(`${PROSPECTING_REQUEST_STORAGE_KEY}:${context.userId}:${context.organizationId}`); } catch { /* armazenamento indisponível */ }
  };

  const testarAmostra = () => { void executarBusca(SAMPLE_SIZE); };

  const aguardarResultadoApify = async (sourceKey: string, runId: string): Promise<ProspectingResponse> => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 4_000));
      const { data, error } = await supabase.functions.invoke('prospectar-leads', {
        body: { sourceKey, mode: 'production', runId },
      });
      if (error) throw new Error(await detalheDoErroBusca(error));
      const response = data as ProspectingResponse;
      if (!response?.pending) return response;
    }
    throw new Error('apify_processing_timeout');
  };

  const retomarExecucao = async (run: ProspectingRunSummary) => {
    const fonte = fontesProspecao.find((item) => item.sourceKey === 'apify');
    if (fonte) setFonteSelecionada(fonte.id);
    setBuscando(true);
    setExecucaoAtual(run.id);
    setErroBusca(null);
    setResultado(null);
    setFaseBusca(fasesBusca[1]);
    setAba('busca');
    try {
      const { data, error } = await supabase.functions.invoke('prospectar-leads', {
        body: { sourceKey: 'apify', mode: 'production', ...(run.status === 'cached' ? { action: 'open_cache', cacheId: run.id } : { runId: run.id }) },
      });
      if (error) throw new Error(await detalheDoErroBusca(error));
      let response = data as ProspectingResponse;
      if (response?.pending) response = await aguardarResultadoApify('apify', run.id);
      setFaseBusca(fasesBusca[2]);
      aplicarResultadoDaBusca(response, fonte?.nome || 'Apify — Google Maps', run.resultCount || leadsDia);
    } catch (error) {
      setErroBusca(mensagemBuscaReal(error instanceof Error ? error.message : 'prospecting_failed', fonte?.nome || 'Apify'));
    } finally {
      setBuscando(false);
      setExecucaoAtual(null);
      setFaseBusca('');
      if (historicoAberto) void atualizarExecucoes();
    }
  };

  const aplicarResultadoDaBusca = (data: ProspectingResponse, fonteNome: string, requestedVolume: number) => {
    if (!data?.leads || !Array.isArray(data.leads)) throw new Error(data?.error || 'prospecting_empty_response');
    const encontrados = data.leads.map((lead, index) => prospectingLeadToPreview(lead, fonteNome, index));
    const cruzados = cruzarPreview(encontrados);
    setPreview(cruzados);
    setSelecionados(cruzados.filter((lead) => !lead.duplicado).map((lead) => lead.id));
    setFiltroRevisao('todos');
    setMapaAberto(false);
    setFeedbackRevisao('');
    setClassificacoesAmostra(Object.fromEntries(cruzados.map((lead) => [lead.id, lead.duplicado ? 'duplicada' : 'adequada'])));
    setMotivosForaPerfil({});
    clearRequestKey();
    const duplicados = cruzados.filter((lead) => lead.duplicado).length;
    setResultado(
      duplicados > 0
        ? `${cruzados.length} leads encontrados (limite: ${requestedVolume}). ${duplicados} duplicado(s) já no funil e bloqueado(s).`
        : cruzados.length
          ? `${cruzados.length} leads encontrados (limite: ${requestedVolume}), resultado real do provedor.`
          : `${fonteNome} concluiu a busca, mas não retornou leads para estes filtros. Nenhum lead foi importado.`,
    );
    setEtapa(3);
  };

  const executarBusca = async (requestedVolume: number) => {
    const fonte = fontes.find((item) => item.id === fonteSelecionada);
    const fonteNome = fonte?.nome || '';
    const sourceKey = fonte?.sourceKey || ({
      'Receita Federal': 'cnpj',
      'Apify — Google Maps': 'apify',
      'Importação CSV': 'csv',
      'Pesquisa assistida por IA': 'ai',
    } as Record<string, string>)[fonteNome] || '';

    try {
      if (operationalMode !== 'real') throw new Error('operational_mode_protected');
      if (!fontesDisponiveis.some((item) => item.id === fonteSelecionada)) throw new Error('source_disabled');
      if (!sourceKey) throw new Error('source_not_configured');
      if (!cidade.trim()) throw new Error('prospecting_city_required');
      const terms = termosAplicados;
      if (!terms.length) throw new Error('prospecting_terms_required');
      const filters = {
        pais,
        estado,
        cidade: cidade.trim(),
        atividades: terms,
        segmentos: [] as string[],
        exigeSite: temSite === true,
        exigeWhatsApp: temWhatsApp === true,
        exigeEmail: temEmail === true,
        volumeMaximo: requestedVolume,
      };
      const idempotencyKey = requestKeyFor(sourceKey, filters);
      setBuscando(true);
      setResultado(null);
      setErroBusca(null);
      setFeedbackRevisao('');
      setFaseBusca(fasesBusca[0]);
      const { data, error } = await supabase.functions.invoke('prospectar-leads', {
        body: {
          sourceKey,
          mode: 'production',
          idempotencyKey,
          filters,
        },
      });
      if (error) throw new Error(await detalheDoErroBusca(error));
      let response = data as ProspectingResponse;
      if (response?.pending) {
        if (!response.runId) throw new Error('prospecting_run_not_started');
        setExecucaoAtual(response.runId);
        if (historicoAberto) void atualizarExecucoes();
        setFaseBusca(fasesBusca[1]);
        response = await aguardarResultadoApify(sourceKey, response.runId);
      }
      setFaseBusca(fasesBusca[2]);
      aplicarResultadoDaBusca(response, fonteNome, requestedVolume);
    } catch (error) {
      setPreview([]);
      setSelecionados([]);
      const message = error instanceof Error ? error.message : 'prospecting_failed';
      if (/^(source_|apify_auth_|apify_actor_|apify_http_4|provider_invalid_response|prospecting_run_not_pending)/.test(message)) clearRequestKey();
      setErroBusca(mensagemBuscaReal(message, fonteNome));
    } finally {
      setBuscando(false);
      setExecucaoAtual(null);
      setFaseBusca('');
      if (historicoAberto) void atualizarExecucoes();
    }
  };

  const detalheDoErroBusca = async (error: unknown): Promise<string> => {
    if (error && typeof error === 'object' && 'context' in error) {
      try {
        const response = (error as { context?: Response }).context;
        const body = await response?.clone().json() as { error?: string } | undefined;
        if (body?.error) return body.error;
      } catch { /* usa mensagem genérica */ }
    }
    return error instanceof Error ? error.message : 'prospecting_failed';
  };

  const mensagemBuscaReal = (code: string, fonte: string): string => {
    const mensagens: Record<string, string> = {
      source_not_configured: `${fonte} ainda não está configurada no Backend. Abra Configurações → Integrações, salve as credenciais e teste a conexão.`,
      source_disabled: `${fonte} está desativada. Ative a fonte e valide a conexão antes de buscar.`,
      source_credentials_missing: `As credenciais de ${fonte} não foram encontradas no cofre seguro. Configure a fonte novamente.`,
      source_not_supported: `${fonte} ainda não possui um adaptador de busca real habilitado.`,
      provider_error: `O provedor de ${fonte} recusou a busca. Confira as credenciais, limites e a configuração do Actor/Task.`,
      apify_actor_incompatible: `${fonte} está configurada com um Actor que não aceita os filtros de Google Maps. Corrija o Actor em Configurações antes de buscar.`,
      apify_http_400: `${fonte} recusou o formato da busca. Use um Actor de Google Maps compatível com localização e volume de resultados.`,
      apify_processing_timeout: `${fonte} ainda está processando esta busca. Aguarde alguns minutos antes de iniciar outra consulta; o Registro do Sistema mantém a execução para auditoria.`,
      prospecting_start_unconfirmed: `${fonte} recebeu uma tentativa de início cuja confirmação não foi registrada. Para evitar uma busca duplicada, o sistema não enviará outro pedido automaticamente. Abra o histórico e siga o Registro do Sistema.`,
      prospecting_request_key_required: 'Não foi possível proteger a repetição desta busca. Atualize a página e tente novamente.',
      prospecting_idempotency_conflict: 'Esta tentativa de busca já está vinculada a filtros diferentes. Atualize a página antes de criar uma nova busca.',
      prospecting_run_reservation_failed: 'Não foi possível reservar esta busca com segurança. Nenhum novo pedido foi enviado ao provedor.',
      prospecting_city_required: 'Informe a cidade antes de buscar.',
      prospecting_terms_required: 'Adicione pelo menos um termo de busca para evitar uma consulta ampla e imprecisa.',
      prospecting_run_not_started: `A fonte não confirmou o início da execução. A busca não foi enviada para revisão.`,
      prospecting_run_not_found: `A execução não pertence à empresa ativa ou não está mais disponível para consulta.`,
      prospecting_run_not_pending: `A execução já não está pendente. Atualize a página antes de iniciar uma nova busca.`,
      source_input_invalid: `A entrada adicional de ${fonte} não é um JSON válido. Corrija o campo em Configurações → Integrações.`,
      provider_invalid_response: `${fonte} respondeu em um formato incompatível. Use uma Task/Actor compatível ou ajuste a entrada adicional.`,
      organization_access_denied: 'Seu usuário não tem a permissão necessária na empresa ativa para executar buscas reais.',
      prospecting_empty_response: `A busca em ${fonte} terminou sem uma resposta válida.`,
      operational_mode_protected: 'A empresa está em modo protegido. A Busca de Leads não cria prévias fictícias; conclua as verificações em Configurações → Status operacional antes de consultar um provedor real.',
    };
    return mensagens[code] || `Não foi possível buscar leads em ${fonte || 'a fonte selecionada'} no Modo Real. Tente novamente após validar a conexão.`;
  };

  const toggleSelecionado = (id: string) => {
    const lead = preview.find((item) => item.id === id);
    if (lead?.duplicado || classificacoesAmostra[id] !== 'adequada') return;
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter((s) => s !== id));
    } else {
      setSelecionados([...selecionados, id]);
    }
  };

  const selecionarTodos = () => {
    const ids = leadsRevisao
      .filter((lead) => !lead.duplicado && classificacoesAmostra[lead.id] === 'adequada')
      .map((lead) => lead.id);
    if (!ids.length) return;
    const todosVisiveisSelecionados = ids.every((id) => selecionados.includes(id));
    setSelecionados((current) => todosVisiveisSelecionados
      ? current.filter((id) => !ids.includes(id))
      : [...new Set([...current, ...ids])]);
  };

  const abrirLead = (l: PreviewLead) => setLeadAberto(l);

  const descartarLead = (id: string) => {
    setPreview((prev) => prev.filter((p) => p.id !== id));
    setSelecionados((prev) => prev.filter((s) => s !== id));
    setLeadAberto(null);
    setFeedbackRevisao('Resultado removido da revisão. Ele não será enviado ao módulo Leads.');
  };

  const abordarLead = (id: string) => {
    setSelecionados((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setLeadAberto(null);
    if (etapa < 4) setEtapa(4);
  };

  const avancar = () => {
    if (etapa === 3) {
      if (selecionados.length > 0) setEtapa(4);
      return;
    }

    const validationError = prospectingWizardBlockReason(wizardStep, wizardDraft, buscando);
    if (validationError) {
      setWizardError(validationError);
      return;
    }

    setWizardError(null);
    if (wizardStep === 4) {
      testarAmostra();
      return;
    }

    const nextStep = nextProspectingWizardStep(wizardStep);
    setWizardStep(nextStep);
    if (nextStep === 2) setEtapa(2);
  };

  const voltar = () => {
    setWizardError(null);
    if (etapa === 4) {
      setEtapa(3);
      return;
    }
    if (etapa === 3) {
      setResultado(null);
      setErroBusca(null);
      setEtapa(2);
      setWizardStep(4);
      return;
    }
    if (etapa === 2 && wizardStep > 2) {
      setWizardStep((current) => (current - 1) as ProspectingWizardStep);
      return;
    }
    setEtapa(1);
    setWizardStep(1);
  };

  const confirmarLote = async (input: ProspectingBatchInput) => {
    let loteConfirmado = false;
    try {
      await importProspectingBatch(input);
      loteConfirmado = true;
      await Promise.all([refreshLeadsStore(), refreshListsStore()]);
      lotePendente.current = null;
      setImportacaoPendenteVerificacao(false);
      navigate('/dashboard/leads');
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      const rejeicaoConfirmada = ['22023', '42501'].includes(code);
      if (rejeicaoConfirmada) lotePendente.current = null;
      setImportacaoPendenteVerificacao(loteConfirmado || !rejeicaoConfirmada);
      setErroImportacao(loteConfirmado
        ? 'O lote foi salvo, mas a tela não conseguiu atualizar. Tente confirmar novamente ou abra Leads.'
        : rejeicaoConfirmada
          ? code === '42501'
            ? 'Seu usuário não tem permissão para importar leads. Nenhum dado foi gravado.'
            : 'O banco recusou os dados antes de confirmar o lote. Revise a seleção e suas permissões.'
          : code === '23505'
            ? 'O lote possui um estado existente diferente. O lote original foi preservado; confira em Leads ou solicite reconciliação antes de criar outra importação.'
            : code === '23514'
              ? 'O lote existe, mas está incompleto no banco. O lote original foi preservado; solicite reconciliação antes de tentar de novo.'
          : 'Não foi possível confirmar a resposta do banco. O lote nunca é gravado pela metade. Confirme o lote original ou confira em Leads.');
    } finally {
      setImportando(false);
    }
  };

  const concluir = async () => {
    if (importando) return;
    if (importacaoPendenteVerificacao && lotePendente.current) {
      setImportando(true);
      setErroImportacao(null);
      await confirmarLote(lotePendente.current);
      return;
    }
    if (!user?.id) {
      setErroImportacao('Sua sessão não está disponível. Entre novamente antes de importar.');
      return;
    }
    setImportando(true);
    let responsavelAtual: TeamMember | null = null;
    try {
      const access = await loadCurrentAccess(user.id, true);
      if (access.permissions['leads.create'] !== true) {
        setErroImportacao('Seu usuário não tem permissão para criar leads. Peça acesso em Configurações → Usuários.');
        setImportando(false);
        return;
      }
      if (modoAtendimento === 'HUMANO') {
        const members = await loadTeamMembers();
        setMembros(members);
        setErroMembros(false);
        responsavelAtual = findActiveAssignee(members, responsavel);
        if (!responsavelAtual) {
          setErroImportacao('Selecione um usuário ativo da Wayflex. A equipe foi atualizada; confira o responsável antes de importar.');
          setImportando(false);
          return;
        }
      }
    } catch {
      setErroImportacao('Não foi possível confirmar suas permissões e a equipe ativa. Tente novamente antes de importar.');
      setImportando(false);
      return;
    }
    const fonte = fontes.find((f) => f.id === fonteSelecionada);
    const selecionadosLeads = preview
      .filter((l) => !l.duplicado && selecionados.includes(l.id))
      .map((l) => {
        const canalComprovado = canal === 'WhatsApp' ? l.whatsappStatus === 'verified' : canal === 'E-mail' ? l.canais.email : Boolean(l.telefone);
        const contatoAprovado = autorizacaoContato && Boolean(origemAutorizacao.trim()) && canalComprovado;
        return mapearNovoLead({
          nome: l.nome,
          empresa: l.empresa,
          email: l.email,
          telefone: l.telefone,
          whatsapp: l.whatsapp || '',
          segmento: l.segmento || '',
          porte: l.porte || '',
          cidade: l.cidade || '',
          estado: l.estado || '',
          score: l.score,
          origem: l.fonte,
          responsavel: responsavelAtual?.name || 'Ana (IA)',
          tags: fonte?.tagsPadrao,
          contactApprovalStatus: contatoAprovado ? 'approved' : 'pending',
          contactApprovalReason: contatoAprovado ? origemAutorizacao.trim() : canalComprovado ? 'Aguardando registro de autorização para contato.' : 'Canal preferencial ainda não comprovado.',
          sourceRecordId: l.sourceRecordId,
          sourceUrl: l.sourceUrl,
          fitScore: l.fitScore,
          contactabilityScore: l.contactabilityScore,
          engagementScore: l.engagementScore,
          scoreExplanation: l.scoreExplanation,
        })
      });
    if (!selecionadosLeads.length) {
      setErroImportacao('Selecione pelo menos um lead válido antes de enviar para o módulo Leads.');
      setImportando(false);
      return;
    }
    const cidadesSelecionadas = [...new Set(selecionadosLeads.map((lead) => lead.cidade).filter(Boolean))].join(', ');
    const nomeFinal = nomeLista.trim() || `Prospecção ${cidadesSelecionadas || 'Apify'} · ${new Date().toLocaleDateString('pt-BR')}`;
    setErroImportacao(null);
    setResultado(null);
    const input: ProspectingBatchInput = {
      batchId: crypto.randomUUID(),
      leads: selecionadosLeads,
      listName: nomeFinal,
      listCriteria: {
        segmento: [...new Set(selecionadosLeads.map((lead) => lead.segmento).filter(Boolean))].join(', '),
        cidade: cidadesSelecionadas,
        estado: [...new Set(selecionadosLeads.map((lead) => lead.estado).filter(Boolean))].join(', '),
        fonte: [...new Set(selecionadosLeads.map((lead) => lead.origem).filter(Boolean))].join(', ') || fonte?.nome || 'Busca manual',
      },
    };
    lotePendente.current = input;
    await confirmarLote(input);
  };

  const confirmarImportacaoCsv = async (pending: PendingCsvBatch): Promise<ResultadoImportacao> => {
    try {
      const result = await importProspectingBatch(pending.input);
      await Promise.all([refreshLeadsStore(), refreshListsStore()]);
      loteCsvPendente.current = null;
      setCsvConfirmacaoPendente(false);
      return { importados: result.leadIds.length, duplicados: pending.duplicateCount };
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (['22023', '42501', '23505', '23514'].includes(code)) {
        loteCsvPendente.current = null;
        setCsvConfirmacaoPendente(false);
      }
      if (code === '42501') throw new Error('Seu usuário não tem permissão para importar leads. Nenhum dado foi gravado.');
      if (code === '22023') throw new Error('O banco recusou os dados antes de confirmar o lote. Revise o arquivo e tente novamente.');
      if (code === '23505') throw new Error('O banco encontrou um lote existente com conteúdo diferente. Nenhum lote novo será criado; confira em Leads ou solicite reconciliação.');
      if (code === '23514') throw new Error('O lote existente está incompleto no banco. Nenhum lote novo será criado; solicite reconciliação antes de importar novamente.');
      setCsvConfirmacaoPendente(true);
      throw new Error('Não foi possível confirmar a resposta do banco. O mesmo lote foi mantido nesta página para uma confirmação segura, sem duplicar registros.');
    }
  };

  const confirmarLoteCsvPendente = async (): Promise<ResultadoImportacao> => {
    const pending = loteCsvPendente.current;
    if (!pending) throw new Error('O lote pendente não está mais disponível nesta página. Reabra o arquivo para uma nova verificação.');
    return confirmarImportacaoCsv(pending);
  };

  const importarLeads = async (linhas: Record<string, string>[]): Promise<ResultadoImportacao> => {
    const prepared = prepareCsvLeads(linhas);
    if (prepared.invalidLines.length) {
      throw new Error(`Corrija as linhas inválidas antes de importar: ${prepared.invalidLines.join(', ')}.`);
    }
    if (prepared.rows.length > 100) {
      throw new Error('O arquivo possui mais de 100 leads válidos. Divida-o em arquivos de no máximo 100 linhas para uma importação auditável.');
    }

    // A comparação usa as linhas canônicas do arquivo, antes de olhar a store.
    // Assim, uma confirmação incerta na mesma página reenviará o mesmo lote.
    const fingerprint = JSON.stringify(prepared.rows);
    const pending = loteCsvPendente.current;
    if (pending) {
      setCsvConfirmacaoPendente(true);
    }
    if (pending && pending.fingerprint !== fingerprint) {
      throw new Error('Há uma importação CSV anterior sem confirmação. Confirme o lote original antes de escolher outro arquivo; nenhum novo lote será criado até isso ser resolvido.');
    }
    if (pending) return confirmarImportacaoCsv(pending);

    let duplicatesInExistingLeads = 0;
    const existingIdentities = new Set<string>();
    leads.forEach((lead) => {
      if (lead.email.trim()) existingIdentities.add(`email:${lead.email.trim().toLocaleLowerCase('pt-BR')}`);
      [lead.telefone, lead.whatsapp].forEach((contact) => {
        const phone = normalizeProspectingPhone(contact || '');
        if (phone.length >= 10) existingIdentities.add(`phone:${phone}`);
      });
    });
    const rowsToImport = prepared.rows.filter((row) => {
      const identities = csvLeadIdentity(row);
      if (identities.some((identity) => existingIdentities.has(identity))) {
        duplicatesInExistingLeads += 1;
        return false;
      }
      identities.forEach((identity) => existingIdentities.add(identity));
      return true;
    });
    if (!rowsToImport.length) {
      throw new Error('Nenhum lead novo ficou disponível após a verificação de identificadores fortes. Nenhum dado foi enviado ao banco.');
    }
    const session = await resolveOrganizationSession();
    const cidades = [...new Set(rowsToImport.map((row) => row.cidade).filter(Boolean))].join(', ');
    const segmentosCsv = [...new Set(rowsToImport.map((row) => row.segmento).filter(Boolean))].join(', ');
    const input: ProspectingBatchInput = {
      // O mesmo CSV para a mesma organização produz a mesma chave atômica.
      // Em uma recarga, uma resposta já persistida volta como conflito/replay
      // seguro; nunca como um segundo lote automático.
      batchId: await deterministicProspectingUuid(`wayflex:csv:${session.organizationId}:${fingerprint}`),
      leads: rowsToImport.map((row) => mapearNovoLead({
        nome: row.nome,
        empresa: row.empresa,
        email: row.email,
        telefone: row.telefone,
        whatsapp: '',
        segmento: row.segmento,
        cidade: row.cidade,
        estado: row.estado,
        score: 0,
        origem: 'Importação CSV',
        modoAtendimento: 'IA',
        responsavel: 'Ana (IA)',
        canalPreferencial: '',
        tags: [],
        contactApprovalStatus: 'pending',
        contactApprovalReason: 'Importação CSV exige aprovação de contato antes de qualquer automação.',
      })),
      listName: `Importação CSV · ${new Date().toLocaleDateString('pt-BR')}`,
      listCriteria: {
        segmento: segmentosCsv,
        cidade: cidades,
        estado: [...new Set(rowsToImport.map((row) => row.estado).filter(Boolean))].join(', '),
        fonte: 'Importação CSV',
      },
    };
    const nextPending: PendingCsvBatch = {
      fingerprint,
      input,
      duplicateCount: prepared.duplicateLines.length + duplicatesInExistingLeads,
    };
    loteCsvPendente.current = nextPending;
    return confirmarImportacaoCsv(nextPending);
  };

  const etapaLabel = ['Escolher fonte', 'Configurar busca', 'Revisar amostra', 'Importar'];
  const leadsRevisao = preview.filter((lead) => {
    const classificacao = classificacaoDaAmostra(lead);
    if (filtroRevisao === 'elegiveis') return !lead.duplicado && classificacao === 'adequada';
    if (filtroRevisao === 'duplicados') return lead.duplicado || classificacao === 'duplicada';
    return true;
  });
  const elegiveis = preview.filter((lead) => !lead.duplicado && classificacaoDaAmostra(lead) === 'adequada');
  const duplicados = preview.filter((lead) => lead.duplicado || classificacaoDaAmostra(lead) === 'duplicada');

  return (
    <div className="wf-page wf-page--prospecting">
      <header className="wf-page-header">
        <div>
          <p className="wf-eyebrow">Prospecção</p>
          <div className="mt-1 flex items-center gap-2"><h1 className="wf-page-title">Busca de Leads</h1><InfoTooltip text="A busca usa apenas fontes configuradas. Todo resultado passa por revisão antes da importação." label="Sobre Busca de Leads" align="start" /></div>
          <p className="wf-page-description">Defina o cliente ideal, teste uma amostra e importe apenas leads qualificados.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-background-200 bg-white px-3 py-2 text-xs font-semibold text-foreground-600">
          <i className="ri-shield-check-line text-primary-700" aria-hidden="true" /> Importação sob revisão
        </span>
      </header>

      <div className="wf-tabs max-w-full overflow-x-auto" aria-label="Modo de prospecção">
        {(
          [
            { id: 'busca', label: 'Nova busca' },
            { id: 'agente', label: 'Assistente de termos' },
            { id: 'importar', label: 'Importar CSV' },
            { id: 'salvas', label: 'Buscas salvas' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            aria-pressed={aba === t.id}
            className={`inline-flex min-h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-xs font-semibold transition-all cursor-pointer sm:flex-none ${
              aba === t.id ? 'active text-white shadow-sm' : 'text-foreground-600 hover:bg-white hover:text-foreground-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {aba === 'agente' && <PromptAgent />}

      {aba === 'salvas' && <section className="mt-5 rounded-xl border border-background-200/70 bg-white p-5" aria-label="Buscas salvas">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-heading font-bold text-foreground-900">Buscas salvas e recuperação</h2><p className="mt-1 text-sm text-foreground-500">Retome uma execução real sem iniciar uma consulta duplicada.</p></div><button type="button" onClick={() => void atualizarExecucoes()} disabled={carregandoExecucoes || buscando} className="rounded-lg border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100 disabled:opacity-50"><i className="ri-refresh-line mr-1" aria-hidden="true" />Atualizar</button></div>
        {carregandoExecucoes && <p className="mt-4 text-sm text-foreground-500">Carregando execuções...</p>}
        {erroExecucoes && <p role="alert" className="mt-4 text-sm text-secondary-700">Não foi possível carregar as buscas salvas. Tente atualizar.</p>}
        {!carregandoExecucoes && !erroExecucoes && !historicoCarregado && <button type="button" onClick={() => { setHistoricoAberto(true); void atualizarExecucoes(); }} className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white">Carregar buscas salvas</button>}
        {historicoCarregado && !carregandoExecucoes && !erroExecucoes && execucoes.length === 0 && <p className="mt-4 text-sm text-foreground-500">Nenhuma busca disponível.</p>}
        {execucoes.length > 0 && <div className="mt-4 space-y-2">{execucoes.map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-background-200 px-4 py-3"><div><p className="text-sm font-semibold text-foreground-900">{run.location || 'Local não informado'}</p><p className="mt-1 text-xs text-foreground-500">{run.startedAt ? new Date(run.startedAt).toLocaleString('pt-BR') : 'Data indisponível'} · {run.status === 'completed' ? `${run.resultCount} encontrado(s)` : run.status === 'cached' ? `${run.resultCount} resultado(s) salvos` : run.status === 'running' ? 'Em andamento' : run.status === 'failed' ? 'Falha' : 'Não concluída'}</p></div>{((run.status === 'running' && run.hasProvider) || ((run.status === 'completed' || run.status === 'cached') && run.hasResults)) && <button type="button" onClick={() => void retomarExecucao(run)} disabled={buscando} className="rounded-lg border border-primary-300 px-3 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-50">{buscando && execucaoAtual === run.id ? 'Consultando...' : run.status === 'completed' || run.status === 'cached' ? 'Abrir revisão' : 'Retomar busca'}</button>}</div>)}</div>}
      </section>}

      {aba === 'busca' && (
        <>
          <nav className="mb-4 mt-5 flex items-center gap-2 overflow-x-auto rounded-xl border border-background-200/70 bg-white px-3 py-3" aria-label="Etapas da busca">
            {etapaLabel.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                {(() => {
                  const step = i + 1;
                  return <>
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    activeSearchStage > step
                      ? 'bg-primary-500 text-background-50'
                      : activeSearchStage === step
                      ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                      : 'bg-background-200 text-foreground-400'
                  }`}
                >
                  {activeSearchStage > step ? <i className="ri-check-line"></i> : i + 1}
                </div>
                <span
                  aria-current={activeSearchStage === step ? 'step' : undefined}
                  className={`whitespace-nowrap text-xs font-semibold ${
                    activeSearchStage >= step ? 'text-foreground-900' : 'text-foreground-400'
                  }`}
                >
                  {e}
                </span>
                {i < etapaLabel.length - 1 && (
                  <div className={`h-px w-3 sm:w-8 ${activeSearchStage > step ? 'bg-primary-500' : 'bg-background-200'}`}></div>
                )}
                  </>;
                })()}
              </div>
            ))}
          </nav>

          {/* ETAPA 1: Fonte */}
          {etapa === 1 && (
            <div className="space-y-6">
              <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">Passo 1 de 4</p>
                    <h3 className="mt-1 font-heading font-bold text-foreground-900 text-sm">Escolha a fonte da busca</h3>
                    <p className="mt-1 text-xs text-foreground-500">Use somente uma fonte validada para liberar o restante do assistente.</p>
                  </div>
                  <span className="rounded-full bg-background-100 px-2.5 py-1 text-[11px] font-semibold text-foreground-600">{fontesDisponiveis.length} fonte(s) pronta(s)</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Fonte da busca">
                  {fontesProspecao.map((f) => {
                    const pronta = fontesDisponiveis.some((fonte) => fonte.id === f.id);
                    return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => pronta && setFonteSelecionada(f.id)}
                      disabled={!pronta}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        fonteSelecionada === f.id
                          ? 'border-primary-500 bg-primary-50'
                          : pronta
                            ? 'border-background-200/70 hover:border-background-300 cursor-pointer'
                            : 'border-background-200/70 bg-background-100/70 cursor-not-allowed opacity-70'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <i className={`${f.tipo === 'API' ? 'ri-cloud-line' : f.tipo === 'CSV' ? 'ri-file-upload-line' : f.tipo === 'webhook' ? 'ri-webhook-line' : 'ri-survey-line'} text-primary-600`}></i>
                        <span className="text-sm font-medium text-foreground-900">{f.nome}</span>
                      </div>
                      <p className="text-xs text-foreground-500">{pronta ? 'Pronta para busca manual' : 'Configure e valide em Configurações'}</p>
                    </button>
                  )})}
                </div>
              </div>
              {fontesProspecao.length === 0 && <p className="text-sm text-foreground-500">Nenhuma fonte de prospecção está configurada. Configure uma em Configurações → Canais, APIs e fontes.</p>}
              <div className="flex justify-end">
                <button
                  onClick={avancar}
                  disabled={!fonteSelecionada}
                  className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  Continuar para a região
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 2: Filtros */}
          {etapa === 2 && (
            <div className="space-y-5">
              <section className="rounded-2xl border border-primary-100 bg-primary-50/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">Assistente de busca</p>
                    <h2 className="mt-1 text-base font-heading font-bold text-foreground-900">Passo {wizardStep} de 4 · {PROSPECTING_WIZARD_STEPS.find((step) => step.id === wizardStep)?.label}</h2>
                    <p className="mt-1 text-sm text-foreground-600">{PROSPECTING_WIZARD_STEPS.find((step) => step.id === wizardStep)?.description}</p>
                  </div>
                  <span className="rounded-full border border-primary-200 bg-white px-3 py-1.5 text-xs font-semibold text-primary-800">Dados ficam salvos enquanto você avança</span>
                </div>
                <ol className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Progresso da configuração">
                  {PROSPECTING_WIZARD_STEPS.filter((step) => step.id > 1).map((step) => {
                    const completed = wizardStep > step.id;
                    const active = wizardStep === step.id;
                    return <li key={step.id} className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold ${active ? 'border-primary-400 bg-white text-primary-800' : completed ? 'border-primary-200 bg-primary-100/60 text-primary-800' : 'border-background-200 bg-white/70 text-foreground-500'}`}>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${active ? 'bg-primary-600 text-white' : completed ? 'bg-primary-200 text-primary-800' : 'bg-background-200 text-foreground-500'}`}>{completed ? <i className="ri-check-line" aria-hidden="true" /> : step.id}</span>
                      {step.label}
                    </li>;
                  })}
                </ol>
              </section>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="space-y-4">
                  {wizardStep === 2 && (
                  <section className="rounded-2xl border border-background-200/80 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700"><i className="ri-map-pin-2-line" aria-hidden="true" /></span>
                      <div><h3 className="text-sm font-heading font-bold text-foreground-900">1. Região da busca</h3><p className="mt-0.5 text-xs text-foreground-500">Escolha onde as empresas devem atuar.</p></div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <label className="text-xs font-semibold text-foreground-700">Cidade
                        <input type="text" value={cidade} onChange={(event) => setCidade(event.target.value)} placeholder="Ex.: São Paulo" className="mt-1.5 w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900" />
                      </label>
                      <label className="text-xs font-semibold text-foreground-700">UF
                        <select value={estado} onChange={(event) => setEstado(event.target.value)} className="mt-1.5 w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900">
                          {estados.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-foreground-700">País
                        <input type="text" value={pais} onChange={(event) => setPais(event.target.value)} className="mt-1.5 w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900" />
                      </label>
                      <div className="text-xs font-semibold text-foreground-700">Abrangência <InfoTooltip text="A fonte ativa recebe cidade e UF. Raio de alcance não é aplicado pelo conector atual e, por isso, não é exibido como filtro." label="Sobre a abrangência" />
                        <div className="mt-1.5 flex h-[38px] items-center rounded-lg border border-background-200 bg-background-100 px-3 text-sm font-medium text-foreground-500">Toda a cidade</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-background-200 bg-background-50 px-3 py-2.5">
                      <p className="text-xs text-foreground-600"><strong className="text-foreground-800">Fonte selecionada:</strong> {fontesProspecao.find((fonte) => fonte.id === fonteSelecionada)?.nome || 'Nenhuma fonte selecionada'}</p>
                      <button type="button" onClick={() => { setWizardError(null); setEtapa(1); setWizardStep(1); }} className="text-xs font-semibold text-primary-700 hover:text-primary-900">Trocar fonte</button>
                    </div>
                  </section>
                  )}

                  {wizardStep === 3 && (
                  <section className="rounded-2xl border border-background-200/80 bg-white p-4 shadow-sm">
                    <div className="mb-4 flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700"><i className="ri-group-line" aria-hidden="true" /></span>
                      <div><h3 className="text-sm font-heading font-bold text-foreground-900">2. Perfil de cliente ideal</h3><p className="mt-0.5 text-xs text-foreground-500">Conte o que sua empresa vende e quem pode comprar.</p></div>
                    </div>
                    <label className="block text-xs font-semibold text-foreground-700">O que sua empresa vende?
                      <input value={ofertaEmpresa} onChange={(event) => setOfertaEmpresa(event.target.value)} maxLength={240} className="mt-1.5 w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900" />
                    </label>
                    <fieldset className="mt-4"><legend className="text-xs font-semibold text-foreground-700">Quem você quer encontrar?</legend>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        {PROSPECTING_TARGET_PROFILES.map((profile) => {
                          const selected = tipoEmpresaAlvo === profile.id;
                          return <button key={profile.id} type="button" aria-pressed={selected} onClick={() => setTipoEmpresaAlvo(profile.id)} className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 text-left text-xs font-semibold transition-colors ${selected ? 'border-primary-400 bg-primary-50 text-primary-800' : 'border-background-200 bg-white text-foreground-600 hover:border-background-300'}`}><i className={selected ? 'ri-checkbox-circle-fill text-primary-600' : 'ri-checkbox-blank-circle-line'} aria-hidden="true" />{profile.label}</button>;
                        })}
                      </div>
                    </fieldset>
                    <div className="mt-4"><p className="text-xs font-semibold text-foreground-700">Segmentos dos clientes</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {PROSPECTING_CUSTOMER_SEGMENTS.map((segment) => {
                          const selected = segmentosCliente.includes(segment);
                          return <button key={segment} type="button" aria-pressed={selected} onClick={() => alternarSegmentoCliente(segment)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${selected ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-background-200 bg-white text-foreground-600 hover:border-primary-300'}`}>{selected && <i className="ri-check-line mr-1" aria-hidden="true" />}{segment}</button>;
                        })}
                      </div>
                    </div>
                  </section>
                  )}

                  {wizardStep === 4 && (
                  <>
                  <section className="rounded-2xl border border-background-200/80 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700"><i className="ri-equalizer-2-line" aria-hidden="true" /></span><div><h3 className="text-sm font-heading font-bold text-foreground-900">3. Critérios de qualificação</h3><p className="mt-0.5 text-xs text-foreground-500">Defina o que precisa estar presente para entrar na amostra.</p></div></div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-foreground-700">
                      <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={temSite === true} onChange={() => setTemSite(temSite === true ? null : true)} /> Site informado</label>
                      <div className="inline-flex items-center gap-2"><label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={temWhatsApp === true} onChange={() => setTemWhatsApp(temWhatsApp === true ? null : true)} /> Telefone ou WhatsApp</label><InfoTooltip text="Telefone encontrado não é tratado como WhatsApp comprovado." label="Sobre a evidência de WhatsApp" /></div>
                      <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={temEmail === true} onChange={() => setTemEmail(temEmail === true ? null : true)} /> E-mail informado</label>
                    </div>
                    <button type="button" onClick={() => setFiltrosAvancados((visible) => !visible)} aria-expanded={filtrosAvancados} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-600 hover:text-foreground-900"><i className={filtrosAvancados ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} aria-hidden="true" /> Filtros avançados</button>
                    {filtrosAvancados && <div className="mt-3 rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-xs leading-5 text-foreground-600">A fonte e a região já foram definidas nos passos anteriores. A duplicidade será conferida na revisão por empresa, e-mail ou telefone.</div>}
                    <div className="mt-4 border-t border-background-200 pt-3"><p className="text-xs font-semibold text-foreground-700">Excluir da busca</p><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-background-100 px-3 py-1.5 text-xs text-foreground-600">Empresas já cadastradas no CRM</span></div><p className="mt-2 text-xs leading-5 text-foreground-500">A duplicidade é identificada na revisão por empresa, e-mail ou telefone; nenhuma lista fictícia é enviada ao provedor.</p></div>
                  </section>

                  <section className="rounded-2xl border border-background-200/80 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700"><i className="ri-file-list-3-line" aria-hidden="true" /></span><div><h3 className="text-sm font-heading font-bold text-foreground-900">4. Termos sugeridos</h3><p className="mt-0.5 text-xs text-foreground-500">Revise os termos que serão enviados à fonte de dados.</p></div></div><span className="rounded-full bg-background-100 px-2 py-1 text-[11px] font-semibold text-foreground-600">{termosBusca.length}/{MAX_PROSPECTING_TERMS}</span></div>
                    <div className="flex gap-2"><input type="text" value={novoTermo} onChange={(event) => setNovoTermo(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); adicionarTermo(); } }} maxLength={80} placeholder="Ex.: manutenção industrial" className="min-w-0 flex-1 rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900" /><button type="button" onClick={adicionarTermo} disabled={!novoTermo.trim() || termosBusca.length >= MAX_PROSPECTING_TERMS} className="rounded-lg bg-background-950 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Adicionar</button></div>
                    {termosBusca.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{termosBusca.map((term) => <span key={term} className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-800">{term}<button type="button" onClick={() => removerTermo(term)} aria-label={`Remover ${term}`} className="rounded-full text-primary-700 hover:text-primary-950"><i className="ri-close-line" aria-hidden="true" /></button></span>)}</div>}
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-background-200 pt-3"><button type="button" onClick={gerarSugestoesDoPerfil} disabled={termosBusca.length >= MAX_PROSPECTING_TERMS} className="inline-flex items-center gap-1.5 rounded-lg border border-primary-300 px-3 py-2 text-xs font-semibold text-primary-800 hover:bg-primary-50 disabled:opacity-40"><i className="ri-refresh-line" aria-hidden="true" />Gerar novas sugestões</button><button type="button" onClick={() => setAba('agente')} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-foreground-600 hover:bg-background-100"><i className="ri-magic-line" aria-hidden="true" />Usar assistente de busca</button></div>
                    {termosDoPerfil.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{termosDoPerfil.map((term) => { const selected = termosSelecionados.has(normalizarTermoSugerido(term)); return <button key={term} type="button" onClick={() => alternarTermoSugerido(term)} aria-pressed={selected} disabled={!selected && termosBusca.length >= MAX_PROSPECTING_TERMS} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selected ? 'border-primary-300 bg-primary-100 text-primary-900' : 'border-background-300 bg-white text-foreground-700 hover:border-primary-300'}`}>{selected ? <i className="ri-checkbox-circle-fill mr-1" aria-hidden="true" /> : <i className="ri-add-circle-line mr-1" aria-hidden="true" />}{term}</button>; })}</div>}
                    <div className="mt-4 border-t border-background-200 pt-4"><label className="block text-xs font-semibold text-foreground-700">Segmento da empresa<input type="text" value={segmentoSugestao} onChange={(event) => setSegmentoSugestao(event.target.value)} placeholder="Ex.: borracha, silicone ou poliuretano" className="mt-1.5 w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm text-foreground-900" /></label><div className="mt-2 flex flex-wrap gap-1.5" aria-label="Segmentos sugeridos">{PROSPECTING_TERM_SUGGESTION_GROUPS.map((group) => <button key={group.id} type="button" onClick={() => setSegmentoSugestao(group.label)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${gruposSugeridos.some((item) => item.id === group.id) ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-background-200 bg-white text-foreground-600 hover:border-background-300'}`}>{group.label}</button>)}</div>
                      {gruposSugeridos.length > 0 && <div className="mt-3 space-y-2">{gruposSugeridos.map((group) => <div key={group.id} className="rounded-xl border border-background-200 bg-background-50/70 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-foreground-900">{group.label}</p><p className="mt-0.5 text-xs text-foreground-500">{group.description}</p></div><button type="button" onClick={() => adicionarGrupoSugerido(group.terms)} className="rounded-lg border border-primary-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary-800 hover:bg-primary-50">Marcar disponíveis</button></div></div>)}</div>}
                    </div>
                  </section>
                  </>
                  )}
                </div>

                <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
                  <section className="rounded-2xl bg-background-950 p-5 text-background-50 shadow-sm">
                    <p className="text-xs font-semibold text-background-400">Resumo da busca</p>
                    <p className="mt-2 flex items-center gap-2 text-lg font-heading font-bold"><i className="ri-map-pin-line text-primary-300" aria-hidden="true" />{cidade || 'Cidade'} · {estado}</p>
                    <dl className="mt-4 divide-y divide-white/10 text-xs">
                      <div className="flex justify-between gap-3 py-2"><dt className="text-background-400">Fonte</dt><dd className="text-right font-semibold">{fontesProspecao.find((fonte) => fonte.id === fonteSelecionada)?.nome || 'Pendente'}</dd></div>
                      <div className="flex justify-between py-2"><dt className="text-background-400">Perfil</dt><dd className="font-semibold">{tipoEmpresaAlvoLabel}</dd></div>
                      <div className="flex justify-between py-2"><dt className="text-background-400">Segmentos</dt><dd className="font-semibold">{segmentosCliente.length}</dd></div>
                      <div className="flex justify-between py-2"><dt className="text-background-400">Termos</dt><dd className="font-semibold">{termosAplicados.length}</dd></div>
                      <div className="flex justify-between py-2"><dt className="text-background-400">Obrigatórios</dt><dd className="font-semibold">{[temSite, temWhatsApp, temEmail].filter(Boolean).length}</dd></div>
                    </dl>
                    <div className="mt-4 border-t border-white/10 pt-4"><p className="flex items-center gap-2 text-xs font-semibold text-primary-200"><span className="h-2 w-2 rounded-full bg-primary-400" />{wizardStep === 4 ? 'Pronto para validar a amostra' : `Próximo: ${PROSPECTING_WIZARD_STEPS.find((step) => step.id === nextProspectingWizardStep(wizardStep))?.label}`}</p><p className="mt-1 text-xs leading-5 text-background-300">A primeira consulta real continua limitada a 10 empresas.</p></div>
                    <button type="button" onClick={avancar} aria-describedby={wizardBlockReason ? 'wizard-block-reason' : undefined} disabled={wizardStep !== 4 || Boolean(wizardBlockReason)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-3 py-2.5 text-sm font-heading font-bold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-800">{buscando ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Buscando...</> : <><i className="ri-search-eye-line" aria-hidden="true" />Testar com 10 empresas</>}</button>
                    <button type="button" onClick={() => { setHistoricoAberto(true); setAba('salvas'); }} className="mt-2 w-full rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10">Ver buscas salvas</button>
                  </section>
                  <section className="rounded-2xl border border-background-200 bg-white p-4"><h3 className="flex items-center gap-2 text-sm font-heading font-bold text-foreground-900"><i className="ri-lightbulb-flash-line text-primary-600" aria-hidden="true" />Como a amostra melhora a busca</h3><ol className="mt-3 space-y-3 text-xs leading-5 text-foreground-600"><li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700">1</span>Valide o público encontrado.</li><li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700">2</span>Classifique os resultados fora do perfil.</li><li className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700">3</span>Ajuste termos antes da busca completa.</li></ol></section>
                </aside>
              </div>

              <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-background-200 bg-white/95 p-3 shadow-sm backdrop-blur">
                <button type="button" onClick={voltar} className="rounded-lg border border-background-300 px-4 py-2.5 text-sm font-semibold text-foreground-700 hover:bg-background-100">{wizardStep === 2 ? 'Voltar para a fonte' : 'Voltar'}</button>
                <div className="text-right">
                  <p className="text-xs font-semibold text-foreground-700">Passo {wizardStep} de 4</p>
                  <p className="mt-0.5 text-xs text-foreground-500">{wizardStep === 4 ? 'A consulta só começa após este comando.' : 'Nenhuma busca é realizada enquanto você preenche.'}</p>
                </div>
                <button type="button" onClick={avancar} aria-describedby={wizardBlockReason ? 'wizard-block-reason' : undefined} disabled={Boolean(wizardBlockReason)} className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-300">
                  {wizardStep === 2 ? 'Continuar para o perfil' : wizardStep === 3 ? 'Continuar para os critérios' : buscando ? 'Buscando...' : 'Testar com 10 empresas'}
                  {!buscando && <i className={wizardStep === 4 ? 'ri-search-eye-line' : 'ri-arrow-right-line'} aria-hidden="true" />}
                </button>
              </div>

              {wizardError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm text-secondary-800">
                  <i className="ri-error-warning-line mt-0.5" aria-hidden="true" />
                  <span>{wizardError}</span>
                </div>
              )}
              {wizardBlockReason && <p id="wizard-block-reason" className="text-xs text-foreground-600" role="status">{wizardBlockReason}</p>}

              {erroBusca && (
                <div role="alert" className="border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm text-secondary-800 rounded-lg flex items-start gap-2">
                  <i className="ri-error-warning-line mt-0.5" aria-hidden="true"></i>
                  <span>{erroBusca}</span>
                </div>
              )}

              {buscando && (
                <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-4 h-4 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
                    <h3 className="font-heading font-bold text-foreground-900 text-sm">Processando prospecção</h3>
                  </div>
                  <div className="space-y-3">
                    {fasesBusca.map((fase, i) => {
                      const faseAtual = fasesBusca.indexOf(faseBusca);
                      const concluida = i < faseAtual;
                      const ativa = i === faseAtual;
                      return (
                        <div key={fase} className="flex items-center gap-3">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                              concluida
                                ? 'bg-primary-500 text-background-50'
                                : ativa
                                ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                                : 'bg-background-200 text-foreground-400'
                            }`}
                          >
                            {concluida ? (
                              <i className="ri-check-line"></i>
                            ) : ativa ? (
                              <div className="w-3 h-3 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
                            ) : (
                              i + 1
                            )}
                          </div>
                          <span className={`text-sm ${concluida || ativa ? 'text-foreground-900 font-medium' : 'text-foreground-400'}`}>
                            {fase}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ETAPA 3: Revisão */}
          {etapa === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
              <div className="xl:col-span-3 bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
                <div className="border-b border-background-200/70 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><h3 className="text-sm font-heading font-bold text-foreground-900">Revisão dos resultados</h3><p className="text-xs text-foreground-500">Somente resultados elegíveis seguem para importação.</p></div>
                    <button type="button" onClick={selecionarTodos} disabled={!leadsRevisao.some((lead) => !lead.duplicado && classificacaoDaAmostra(lead) === 'adequada')} className="text-xs font-semibold text-primary-700 disabled:opacity-50">{leadsRevisao.filter((lead) => !lead.duplicado && classificacaoDaAmostra(lead) === 'adequada').every((lead) => selecionados.includes(lead.id)) && leadsRevisao.some((lead) => !lead.duplicado && classificacaoDaAmostra(lead) === 'adequada') ? 'Desmarcar todos' : 'Selecionar todos'}</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {([
                      ['todos', 'Encontrados', preview.length],
                      ['elegiveis', 'Elegíveis', elegiveis.length],
                      ['duplicados', 'Duplicados', duplicados.length],
                    ] as const).map(([id, label, count]) => <button type="button" key={id} onClick={() => setFiltroRevisao(id)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${filtroRevisao === id ? 'bg-background-950 text-white' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}>{label} · {count}</button>)}
                    <span className="ml-auto self-center text-[11px] font-semibold text-primary-700">{selecionados.length} selecionado(s)</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  {leadsRevisao.length === 0 ? (
                    <div className="px-6 py-10 text-center text-sm text-foreground-500">
                      {filtroRevisao === 'duplicados'
                        ? 'Nenhum resultado duplicado nesta revisão.'
                        : filtroRevisao === 'elegiveis'
                          ? 'Nenhum resultado elegível nesta revisão.'
                          : 'A fonte não retornou nenhum lead para os filtros informados. Ajuste os filtros e tente novamente.'}
                    </div>
                  ) : <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-background-200/70 bg-background-100/50">
                        <th className="text-left px-4 py-3 w-10">
                          <input type="checkbox" checked={leadsRevisao.filter((lead) => !lead.duplicado && classificacaoDaAmostra(lead) === 'adequada').length > 0 && leadsRevisao.filter((lead) => !lead.duplicado && classificacaoDaAmostra(lead) === 'adequada').every((lead) => selecionados.includes(lead.id))} onChange={selecionarTodos} disabled={!leadsRevisao.some((lead) => !lead.duplicado && classificacaoDaAmostra(lead) === 'adequada')} className="cursor-pointer disabled:cursor-not-allowed" />
                        </th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Lead</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Aderência</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs hidden lg:table-cell">Classificação</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Canais</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadsRevisao.map((l) => {
                        const classificacao = classificacaoDaAmostra(l);
                        return <tr key={l.id} className={`border-b border-background-100 hover:bg-background-50/50 ${classificacao === 'duplicada' ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3.5">
                            <input type="checkbox" checked={selecionados.includes(l.id)} onChange={() => toggleSelecionado(l.id)} disabled={classificacao !== 'adequada'} className="cursor-pointer disabled:cursor-not-allowed" />
                          </td>
                          <td className="px-4 py-3.5 cursor-pointer" onClick={() => abrirLead(l)}>
                            <p className="font-medium text-foreground-900 flex items-center gap-1.5">
                              {l.nome}
                              <i className="ri-external-link-line text-foreground-300 text-xs"></i>
                            </p>
                            <p className="text-xs text-foreground-500 truncate max-w-[220px]">{l.empresa}{l.cargo ? ` · ${l.cargo}` : ''}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${tempBadge[l.temperatura]}`}>{l.fitScore ?? l.score}/100</span>
                          </td>
                          <td className="hidden px-4 py-3.5 lg:table-cell">
                            <label className="sr-only" htmlFor={`classificacao-${l.id}`}>Classificação de {l.nome}</label>
                            <select id={`classificacao-${l.id}`} value={classificacao} disabled={l.duplicado} onChange={(event) => atualizarClassificacaoAmostra(l, event.target.value as SampleClassification)} className="max-w-[150px] rounded-lg border border-background-300 bg-white px-2 py-1.5 text-xs font-semibold text-foreground-700 disabled:cursor-not-allowed">
                              {SAMPLE_CLASSIFICATIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                            </select>
                            {classificacao === 'fora_do_perfil' && <select aria-label={`Motivo para ${l.nome} estar fora do perfil`} value={motivosForaPerfil[l.id] || ''} onChange={(event) => setMotivosForaPerfil((current) => ({ ...current, [l.id]: event.target.value }))} className="mt-1.5 max-w-[150px] rounded-lg border border-background-300 bg-white px-2 py-1 text-[11px] text-foreground-600"><option value="">Motivo</option>{OUT_OF_PROFILE_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select>}
                            <p className="mt-1 text-[11px] text-foreground-500">{l.localidade}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${l.canais.site ? 'bg-primary-50 text-primary-700' : 'bg-background-100 text-foreground-500'}`}>Site</span><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${l.canais.email ? 'bg-primary-50 text-primary-700' : 'bg-background-100 text-foreground-500'}`}>E-mail</span><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${l.whatsappStatus === 'verified' ? 'bg-primary-50 text-primary-700' : 'bg-background-100 text-foreground-500'}`}>WhatsApp</span></div>
                            {l.whatsappStatus === 'unverified' && <p className="mt-1 text-[11px] text-accent-700">Telefone ≠ WhatsApp</p>}
                            {l.validacao === 'revisar' && !l.duplicado && (
                              <p className="text-[11px] text-secondary-600 mt-1 flex items-center gap-0.5">
                                <i className="ri-alert-line"></i> Revisar
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => abrirLead(l)}
                                title="Ver detalhes"
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-background-200/70 hover:bg-background-100 cursor-pointer"
                              >
                                <i className="ri-eye-line text-foreground-600"></i>
                              </button>
                              <button
                                onClick={() => descartarLead(l.id)}
                                title="Remover desta revisão"
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-background-200/70 hover:bg-accent-50 cursor-pointer"
                              >
                                <i className="ri-close-circle-line text-foreground-500"></i>
                              </button>
                            </div>
                          </td>
                        </tr>;
                      })}
                    </tbody>
                  </table>}
                </div>
              </div>

                <aside className="xl:col-span-2 space-y-3">
                  <section className="grid grid-cols-2 divide-x divide-background-200 overflow-hidden rounded-xl border border-background-200/70 bg-white text-center">
                    <div className="px-3 py-3"><p className="text-lg font-bold text-foreground-950">{preview.filter((lead) => lead.whatsappStatus === 'verified').length}</p><p className="mt-0.5 text-[11px] text-foreground-500">WhatsApp informado</p></div>
                    <div className="px-3 py-3"><p className="text-lg font-bold text-foreground-950">{preview.filter((lead) => lead.canais.email).length}</p><p className="mt-0.5 text-[11px] text-foreground-500">E-mail válido</p></div>
                  </section>
                  <button type="button" onClick={() => setMapaAberto((open) => !open)} aria-expanded={mapaAberto} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-700 hover:bg-background-100"><i className="ri-map-2-line" aria-hidden="true" />{mapaAberto ? 'Ocultar mapa' : 'Ver mapa'}</button>
                  {mapaAberto && <ProspectingMap leads={preview} selectedIds={selecionados} onSelect={abrirLead} />}
                </aside>
              </div>

              {feedbackRevisao && (
                <div className="bg-secondary-50 border border-secondary-200 text-secondary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <i className="ri-information-line"></i>
                  {feedbackRevisao}
                </div>
              )}

              <div className="sticky bottom-3 z-10 flex items-center justify-between rounded-xl border border-background-200 bg-white/95 p-3 shadow-sm backdrop-blur">
                <button onClick={voltar} className="px-6 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">
                  Ajustar busca
                </button>
                <button onClick={avancar} disabled={selecionados.length === 0} className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">
                  Continuar para importação ({selecionados.length})
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 4: Importação */}
          {etapa === 4 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
                    <h3 className="font-heading font-bold text-foreground-900 text-sm mb-4">Adicionar ao módulo Leads</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome da lista</label>
                        <input type="text" value={nomeLista} onChange={(e) => setNomeLista(e.target.value)} placeholder="Ex: Prospecção São Paulo Agosto" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Modo de atendimento</label>
                        <div className="flex gap-2">
                          <button disabled={importando} onClick={() => setModoAtendimento('IA')} className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-60 ${modoAtendimento === 'IA' ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}>
                            <i className="ri-robot-line mr-1"></i> Ana (IA)
                          </button>
                          <button disabled={importando} onClick={() => setModoAtendimento('HUMANO')} className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-60 ${modoAtendimento === 'HUMANO' ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}>
                            <i className="ri-user-line mr-1"></i> Humano
                          </button>
                        </div>
                      </div>
                      {modoAtendimento === 'HUMANO' && <div>
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Responsável</label>
                        <select value={findActiveAssignee(membrosAtivos, responsavel)?.userId || ''} onChange={(e) => setResponsavel(e.target.value)} disabled={importando || carregandoMembros || erroMembros || membrosAtivos.length === 0} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer disabled:opacity-60">
                          <option value="">Selecione um usuário ativo</option>
                          {membrosAtivos.map((member) => (
                            <option key={member.userId} value={member.userId}>{member.name} · {roleLabel[member.role]}</option>
                          ))}
                        </select>
                        {carregandoMembros && <p className="mt-1 text-xs text-foreground-500">Carregando equipe...</p>}
                        {erroMembros && <p role="alert" className="mt-1 text-xs text-accent-700">Não foi possível carregar a equipe. Volte à revisão e abra esta etapa novamente.</p>}
                        {!carregandoMembros && !erroMembros && membrosAtivos.length === 0 && <p role="alert" className="mt-1 text-xs text-foreground-500">Nenhum usuário ativo disponível para atribuição.</p>}
                      </div>}
                      <div>
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Canal preferencial</label>
                        <select value={canal} onChange={(e) => setCanal(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="E-mail">E-mail</option>
                          <option value="Telefone">Telefone</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <button type="button" onClick={() => setOpcoesAvancadasImportacao((open) => !open)} aria-expanded={opcoesAvancadasImportacao} className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground-600 hover:text-foreground-900"><i className={opcoesAvancadasImportacao ? 'ri-arrow-up-s-line' : 'ri-settings-3-line'} aria-hidden="true" />Opções avançadas</button>
                      </div>
                      {opcoesAvancadasImportacao && <>
                        <div>
                          <label className="block text-sm font-medium text-foreground-800 mb-1.5">Template de primeiro contato</label>
                          <select value={template} onChange={(e) => setTemplate(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                            {templatesMensagem.filter((t) => t.categoria === 'Primeiro contato' || t.categoria === 'Follow-up').map((t) => (
                              <option key={t.id} value={t.id}>{t.nome}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground-800 mb-1.5">Tags</label>
                          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="prospecção, agosto" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                        </div>
                      </>}
                      <div className="md:col-span-2 rounded-xl border border-background-200 bg-background-100/50 p-4">
                        <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground-800">
                          <input type="checkbox" checked={autorizacaoContato} onChange={(e) => setAutorizacaoContato(e.target.checked)} className="mt-0.5 cursor-pointer" />
                          <span><strong>Tenho autorização comprovável para contatar estes destinatários pelo canal escolhido.</strong><span className="mt-1 block text-xs text-foreground-500">Sem esta confirmação, os leads serão importados com a Ana pausada e nenhum primeiro contato será liberado.</span></span>
                        </label>
                        {autorizacaoContato && <div className="mt-3"><label className="block text-xs font-medium text-foreground-700 mb-1.5">Origem da autorização</label><input type="text" value={origemAutorizacao} onChange={(e) => setOrigemAutorizacao(e.target.value)} placeholder="Ex.: formulário do site em 13/09/2026" className="w-full px-3 py-2 bg-white border border-background-300 rounded-lg text-sm text-foreground-900" /></div>}
                        {canal === 'WhatsApp' && preview.some((lead) => selecionados.includes(lead.id) && lead.whatsappStatus !== 'verified') && <p className="mt-3 text-xs text-accent-700">Há números apenas encontrados como telefone. Esses leads permanecerão pausados até o WhatsApp ser comprovado, mesmo com a autorização marcada.</p>}
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <div className="bg-background-950 rounded-xl p-6 text-background-50">
                    <h3 className="font-heading font-bold mb-4">Resumo da lista</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-background-400">Leads selecionados</span><span className="font-bold">{selecionados.length}</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Modo</span><span className="font-medium">{modoAtendimento}</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Responsável</span><span className="font-medium">{responsavelNome}</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Canal</span><span className="font-medium">{canal}</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Contato automático</span><span className="font-medium">{autorizacaoContato && origemAutorizacao.trim() ? 'Somente canais comprovados' : 'Pausado para revisão'}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={voltar} className="px-6 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">
                  Voltar
                </button>
                <button onClick={() => void concluir()} disabled={importando} className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-8 py-3 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50">
                  <i className="ri-check-line"></i>
                  {importando ? 'Salvando...' : importacaoPendenteVerificacao ? 'Confirmar lote original' : 'Adicionar aos Leads'}
                </button>
              </div>
            </div>
          )}

          {erroImportacao && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800">
              <span>{erroImportacao}</span>
              {importacaoPendenteVerificacao && <button type="button" onClick={() => navigate('/dashboard/leads')} className="font-semibold underline underline-offset-2">Ver Leads</button>}
            </div>
          )}

          {resultado && (
            <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <i className="ri-checkbox-circle-line"></i>
              {resultado}
            </div>
          )}
        </>
      )}

      {aba === 'importar' && (
        <div className="mx-auto max-w-xl rounded-xl border border-background-200/70 bg-white p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
            <i className="ri-upload-cloud-line text-xl text-primary-700"></i>
          </div>
          <h3 className="mb-2 font-heading font-bold text-foreground-900">Importar lista por CSV</h3>
          <p className="mx-auto mb-4 max-w-md text-sm text-foreground-500">
            Confira o mapeamento e envie até 100 leads válidos em um único lote transacional.
          </p>
          <div className="mb-5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5 text-left text-xs text-primary-800"><i className="ri-shield-check-line mr-1.5" aria-hidden="true" />Os leads entram pendentes de aprovação. Nenhuma mensagem nem automação da Ana será iniciada.</div>
          <button
            onClick={() => setCsvModal(true)}
            className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-file-upload-line mr-2"></i>
            Selecionar arquivo CSV
          </button>
        </div>
      )}

      {csvModal && (
        <CsvImportModal
          titulo="Importar leads por CSV"
          subtitulo="Mapeie as colunas; o lote só será confirmado após a gravação atômica no banco."
          aviso="Os registros desta importação ficam pendentes de aprovação de contato. Telefone não é convertido em WhatsApp e nenhum disparo será iniciado."
          confirmarLotePendente={csvConfirmacaoPendente}
          onConfirmarLotePendente={confirmarLoteCsvPendente}
          campos={camposLeadImport}
          onImportar={importarLeads}
          onClose={() => setCsvModal(false)}
        />
      )}

      {leadAberto && (
        <LeadPreviewDrawer
          lead={leadAberto}
          onClose={() => setLeadAberto(null)}
          onDescartar={descartarLead}
          onAbordar={abordarLead}
        />
      )}
    </div>
  );
}
