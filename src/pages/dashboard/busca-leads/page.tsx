import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { segmentos, portes } from '@/mocks/leadsData';
import type { Lead } from '@/mocks/leadsData';
import { useLeadsStore, waitForLeadsPersistence } from '@/hooks/useLeadsStore';
import { useListasStore } from '@/hooks/useListasStore';
import { fontesAtivas, useFontesStore } from '@/hooks/useFontesStore';
import { templatesMensagem } from '@/mocks/templatesData';
import { mockUsers } from '@/mocks/users';
import { temperaturaDe, tempBadge, tempLabel } from '@/mocks/enriquecimentoData';
import type { PreviewLead } from '@/mocks/enriquecimentoData';
import PromptAgent from '@/pages/dashboard/busca-leads/components/PromptAgent';
import LeadPreviewDrawer from '@/pages/dashboard/busca-leads/components/LeadPreviewDrawer';
import ProspectingMap from '@/pages/dashboard/busca-leads/components/ProspectingMap';
import CsvImportModal from '@/components/feature/CsvImportModal';
import type { CampoImportacao, ResultadoImportacao } from '@/components/feature/CsvImportModal';
import { useOperationalMode } from '@/hooks/useOperationalMode';
import { supabase } from '@/lib/supabase';

const estados = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE', 'GO', 'DF'];
const atividades = ['Tecnologia', 'Saúde', 'Educação', 'Varejo', 'Indústria', 'Logística', 'Marketing', 'Consultoria', 'Financeiro', 'Imobiliário'];
const cargos = ['CEO', 'Diretor', 'Gerente', 'Coordenador', 'Analista', 'Proprietário'];

const fasesBusca = ['Iniciando a busca', 'Aguardando resposta da fonte', 'Preparando a revisão'];

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
  leads?: ProspectingLeadResponse[];
}

function prospectingLeadToPreview(lead: ProspectingLeadResponse, fonte: string, index: number): PreviewLead {
  const nome = lead.nome || lead.name || lead.nome_fantasia || lead.razao_social || 'Contato sem nome';
  const empresa = lead.empresa || lead.company || lead.razao_social || lead.nome_fantasia || nome;
  const whatsapp = lead.whatsapp || '';
  const telefone = lead.telefone || lead.phone || whatsapp;
  const email = lead.email || '';
  const site = lead.site || lead.website || '';
  const score = typeof lead.score === 'number' ? Math.max(0, Math.min(100, Math.round(lead.score))) : 60;
  const cidadeReal = lead.cidade || lead.city || lead.municipio || '';
  const estadoReal = lead.estado || lead.state || lead.uf || '';
  const latitude = Number(lead.latitude ?? lead.lat);
  const longitude = Number(lead.longitude ?? lead.lng);
  return {
    id: lead.id || lead.externalId || `real-${index}-${Date.now()}`,
    nome,
    empresa,
    cnpj: lead.cnpj || '—',
    cargo: lead.cargo || '',
    telefone,
    whatsapp,
    email,
    localidade: [cidadeReal, estadoReal].filter(Boolean).join(' - ') || '—',
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
  const [aba, setAba] = useState<'agente' | 'busca' | 'importar'>('agente');
  const [etapa, setEtapa] = useState(1);
  const [fonteSelecionada, setFonteSelecionada] = useState('');
  const [cidade, setCidade] = useState('São Paulo');
  const [estado, setEstado] = useState('SP');
  const [pais, setPais] = useState('Brasil');
  const [raio, setRaio] = useState(50);
  const [segs, setSegs] = useState<string[]>(['Tecnologia', 'Varejo']);
  const [portesSel, setPortesSel] = useState<string[]>(['Pequeno', 'Médio']);
  const [leadsDia, setLeadsDia] = useState(30);
  const [atividadesSel, setAtividadesSel] = useState<string[]>([]);
  const [cargoDecisor, setCargoDecisor] = useState('');
  const [temSite, setTemSite] = useState<boolean | null>(null);
  const [temWhatsApp, setTemWhatsApp] = useState<boolean | null>(null);
  const [temEmail, setTemEmail] = useState<boolean | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewLead[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [faseBusca, setFaseBusca] = useState('');
  const [leadAberto, setLeadAberto] = useState<PreviewLead | null>(null);
  const [feedbackAna, setFeedbackAna] = useState('');
  const [nomeLista, setNomeLista] = useState('');
  const [modoAtendimento, setModoAtendimento] = useState<'IA' | 'HUMANO'>('IA');
  const [responsavel, setResponsavel] = useState('u-2');
  const [canal, setCanal] = useState('WhatsApp');
  const [template, setTemplate] = useState('tm-1');
  const [tags, setTags] = useState('');
  const [autorizacaoContato, setAutorizacaoContato] = useState(false);
  const [origemAutorizacao, setOrigemAutorizacao] = useState('');

  const [leads, setLeads] = useLeadsStore();
  const listas = useListasStore();
  const { fontes } = useFontesStore();
  const { mode: operationalMode } = useOperationalMode();
  const [csvModal, setCsvModal] = useState(false);
  // O fluxo oficial atual usa Apify; integrações legadas permanecem preservadas,
  // porém fora da captura principal até homologação explícita.
  const fontesProspecao = fontes.filter((fonte) => fonte.sourceKey === 'apify');
  const fontesDisponiveis = fontesAtivas(fontesProspecao);

  useEffect(() => {
    if (fonteSelecionada && !fontesProspecao.some((fonte) => fonte.id === fonteSelecionada)) {
      setFonteSelecionada('');
      setEtapa(1);
    }
  }, [fonteSelecionada, fontesProspecao]);

  const responsavelNome =
    modoAtendimento === 'IA' ? 'Ana (IA)' : mockUsers.find((u) => u.id === responsavel)?.name || 'Selecionar responsável';

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
    return ({
    id: crypto.randomUUID(),
    nome: dados.nome,
    empresa: dados.empresa,
    cnpj: dados.cnpj || '—',
    email: dados.email || '',
    telefone: dados.telefone || '',
    whatsapp: dados.whatsapp || '',
    segmento: dados.segmento || (atividadesSel[0] || 'Tecnologia'),
    cidade: dados.cidade || '',
    estado: dados.estado || '',
    porte: dados.porte || 'Pequeno',
    score: dados.score ?? 60,
    temperatura: dados.temperatura || (dados.score !== undefined && dados.score >= 80 ? 'Quente' : dados.score !== undefined && dados.score >= 60 ? 'Morno' : 'Frio'),
    etapa: dados.etapa || 'Novo',
    origem: dados.origem || 'Importação',
    responsavel: dados.responsavel || responsavelNome,
    responsavelId: modoAtendimento === 'IA' ? '' : responsavel,
    modoAtendimento,
    automacaoStatus: contatoAprovado && modoAtendimento === 'IA' ? 'ATIVA' : 'PAUSADA',
    canalPreferencial: canal,
    templateId: template,
    tags: dados.tags || (tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []),
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

  const toggle = (lista: string[], setLista: (v: string[]) => void, valor: string) => {
    if (lista.includes(valor)) {
      setLista(lista.filter((x) => x !== valor));
    } else {
      setLista([...lista, valor]);
    }
  };

  const buscar = () => { void executarBusca(); };

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

  const aplicarResultadoDaBusca = (data: ProspectingResponse, fonteNome: string) => {
    if (!data?.leads || !Array.isArray(data.leads)) throw new Error(data?.error || 'prospecting_empty_response');
    const encontrados = data.leads.map((lead, index) => prospectingLeadToPreview(lead, fonteNome, index));
    const cruzados = cruzarPreview(encontrados);
    setPreview(cruzados);
    setSelecionados(cruzados.filter((lead) => !lead.duplicado).map((lead) => lead.id));
    const duplicados = cruzados.filter((lead) => lead.duplicado).length;
    setResultado(
      duplicados > 0
        ? `${cruzados.length} leads encontrados (limite: ${leadsDia}). ${duplicados} duplicado(s) já no funil e bloqueado(s).`
        : cruzados.length
          ? `${cruzados.length} leads encontrados (limite: ${leadsDia}), resultado real do provedor.`
          : `${fonteNome} concluiu a busca, mas não retornou leads para estes filtros. Nenhum lead foi importado.`,
    );
    setEtapa(3);
  };

  const executarBusca = async () => {
    const fonte = fontes.find((item) => item.id === fonteSelecionada);
    const fonteNome = fonte?.nome || '';
    const sourceKey = fonte?.sourceKey || ({
      'Receita Federal': 'cnpj',
      'Apify — Google Maps': 'apify',
      'Importação CSV': 'csv',
      'Pesquisa assistida por IA': 'ai',
    } as Record<string, string>)[fonteNome] || '';

    setBuscando(true);
    setResultado(null);
    setErroBusca(null);
    setFeedbackAna('');
    setFaseBusca(fasesBusca[0]);
    try {
      if (operationalMode !== 'real') throw new Error('operational_mode_protected');
      if (!fontesDisponiveis.some((item) => item.id === fonteSelecionada)) throw new Error('source_disabled');
      if (!sourceKey) throw new Error('source_not_configured');
      const { data, error } = await supabase.functions.invoke('prospectar-leads', {
        body: {
          sourceKey,
          mode: 'production',
          filters: {
            pais,
            estado,
            cidade,
            raio,
            atividades: atividadesSel,
            segmentos: segs,
            portes: portesSel,
            cargo: cargoDecisor,
            exigeSite: temSite === true,
            exigeWhatsApp: temWhatsApp === true,
            exigeEmail: temEmail === true,
            volumeMaximo: leadsDia,
          },
        },
      });
      if (error) throw new Error(await detalheDoErroBusca(error));
      let response = data as ProspectingResponse;
      if (response?.pending) {
        if (!response.runId) throw new Error('prospecting_run_not_started');
        setFaseBusca(fasesBusca[1]);
        response = await aguardarResultadoApify(sourceKey, response.runId);
      }
      setFaseBusca(fasesBusca[2]);
      aplicarResultadoDaBusca(response, fonteNome);
    } catch (error) {
      setPreview([]);
      setSelecionados([]);
      const message = error instanceof Error ? error.message : 'prospecting_failed';
      setErroBusca(mensagemBuscaReal(message, fonteNome));
    } finally {
      setBuscando(false);
      setFaseBusca('');
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
    if (selecionados.includes(id)) {
      setSelecionados(selecionados.filter((s) => s !== id));
    } else {
      setSelecionados([...selecionados, id]);
    }
  };

  const selecionarTodos = () => {
    const ids = preview.filter((l) => !l.duplicado).map((l) => l.id);
    setSelecionados(ids.length === selecionados.length ? [] : ids);
  };

  const abrirLead = (l: PreviewLead) => setLeadAberto(l);

  const descartarLead = (id: string) => {
    setPreview((prev) => prev.filter((p) => p.id !== id));
    setSelecionados((prev) => prev.filter((s) => s !== id));
    setLeadAberto(null);
    setFeedbackAna('Lead descartado da revisão. Ele não será enviado ao módulo Leads.');
  };

  const abordarLead = (id: string) => {
    setSelecionados((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setLeadAberto(null);
    if (etapa < 4) setEtapa(4);
  };

  const leadsQuentes = leads.filter((l) => temperaturaDe(l.score) === 'Quente').length;
  const taxaQualificacao = Math.round((leads.filter((l) => l.score >= 65).length / Math.max(leads.length, 1)) * 100);

  const avancar = () => {
    if (etapa < 4) setEtapa(etapa + 1);
  };

  const voltar = () => {
    if (etapa > 1) setEtapa(etapa - 1);
  };

  const concluir = async () => {
    if (modoAtendimento === 'HUMANO' && !responsavel) {
      setResultado('Selecione um responsável para o modo de atendimento humano.');
      return;
    }
    const fonte = fontes.find((f) => f.id === fonteSelecionada);
    const nomeFinal = nomeLista.trim() || `Prospecção ${cidade} · ${new Date().toLocaleDateString('pt-BR')}`;
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
          segmento: atividadesSel[0] || segs[0] || 'Tecnologia',
          cidade: l.localidade.split(' - ')[0] || cidade,
          estado: l.localidade.split(' - ')[1] || estado,
          score: l.score,
          origem: l.fonte,
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
      setResultado('Selecione pelo menos um lead válido antes de enviar para o módulo Leads.');
      return;
    }
    // Primeiro persiste os leads para respeitar a chave estrangeira da lista.
    // A criação continua sem qualquer disparo da Ana ou provedor externo.
    setLeads((prev) => [...selecionadosLeads, ...prev]);
    await waitForLeadsPersistence();
    const lista = listas.criar({
      nome: nomeFinal,
      segmento: atividadesSel[0] || segs[0] || 'Tecnologia',
      cidade,
      estado,
      total: selecionadosLeads.length,
      fonte: fonte?.nome || 'Busca manual',
      leadIds: selecionadosLeads.map((l) => l.id),
      status: 'pendente',
    });
    const leadIds = new Set(selecionadosLeads.map((lead) => lead.id));
    setLeads((prev) => prev.map((lead) => leadIds.has(lead.id) ? { ...lead, listaId: lista.id } : lead));
    navigate('/dashboard/leads');
  };

  const importarLeads = (linhas: Record<string, string>[]): ResultadoImportacao => {
    const novos: Lead[] = linhas
      .filter((l) => (l.nome || '').trim() && (l.empresa || '').trim())
      .map((l) =>
        mapearNovoLead({
          nome: (l.nome || '').trim(),
          empresa: (l.empresa || '').trim(),
          email: (l.email || '').trim(),
          telefone: (l.telefone || '').trim(),
          segmento: (l.segmento || '').trim() || segs[0] || 'Tecnologia',
          cidade: (l.cidade || '').trim(),
          estado: (l.estado || '').trim(),
        })
      );
    const exclusivos = novos.filter((l) => {
      const email = normalizar(l.email);
      const whats = normalizar(l.whatsapp || l.telefone);
      const empresa = normalizar(l.empresa);
      return !leads.some((e) => {
        const eEx = normalizar(e.email);
        const wEx = normalizar(e.whatsapp || e.telefone);
        const emEx = normalizar(e.empresa);
        return (
          (email && eEx && email === eEx) ||
          (whats && wEx && whats === wEx) ||
          (empresa && emEx && empresa === emEx)
        );
      });
    });
    const duplicados = novos.length - exclusivos.length;
    if (exclusivos.length > 0) {
      setLeads((prev) => [...exclusivos, ...prev]);
    }
    return { importados: exclusivos.length, duplicados };
  };

  const etapaLabel = ['Fonte', 'Filtros', 'Revisão', 'Importação'];

  return (
    <div className="wf-page !max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-2">
          Busca de Leads
        </h1>
        <p className="text-foreground-600 text-sm">
          Escolha a fonte, defina o perfil de empresa e revise os resultados antes de adicioná-los ao módulo Leads.
        </p>
      </div>

      {/* Abas */}
      <div className="mb-6 flex flex-wrap gap-1 bg-background-100 rounded-xl p-1">
        {(
          [
            { id: 'agente', label: 'Agente de Prompt (IA)' },
            { id: 'busca', label: 'Busca manual' },
            { id: 'importar', label: 'Importar lista' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              aba === t.id ? 'bg-background-50 text-foreground-900 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {aba === 'agente' && <PromptAgent />}

      {aba === 'busca' && (
        <>
          {/* Faixa de estatísticas da prospecção */}
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-background-50 border border-background-200/70 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <i className="ri-database-2-line text-primary-600"></i>
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold text-foreground-950">{leads.length}</p>
                  <p className="text-xs text-foreground-500">Leads no funil</p>
                </div>
              </div>
            </div>
            <div className="bg-background-50 border border-background-200/70 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent-100 rounded-lg flex items-center justify-center">
                  <i className="ri-fire-fill text-accent-600"></i>
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold text-foreground-950">{leadsQuentes}</p>
                  <p className="text-xs text-foreground-500">Leads quentes</p>
                </div>
              </div>
            </div>
            <div className="bg-background-50 border border-background-200/70 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary-100 rounded-lg flex items-center justify-center">
                  <i className="ri-line-chart-line text-secondary-600"></i>
                </div>
                <div>
                  <p className="text-2xl font-heading font-bold text-foreground-950">{taxaQualificacao}%</p>
                  <p className="text-xs text-foreground-500">Taxa de qualificação</p>
                </div>
              </div>
            </div>
          </div>

          {/* Wizard steps */}
          <div className="mb-6 flex items-center gap-2">
            {etapaLabel.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    etapa > i + 1
                      ? 'bg-primary-500 text-background-50'
                      : etapa === i + 1
                      ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                      : 'bg-background-200 text-foreground-400'
                  }`}
                >
                  {etapa > i + 1 ? <i className="ri-check-line"></i> : i + 1}
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    etapa >= i + 1 ? 'text-foreground-900' : 'text-foreground-400'
                  }`}
                >
                  {e}
                </span>
                {i < etapaLabel.length - 1 && (
                  <div className={`w-8 h-0.5 ${etapa > i + 1 ? 'bg-primary-500' : 'bg-background-200'}`}></div>
                )}
              </div>
            ))}
          </div>

          {/* ETAPA 1: Fonte */}
          {etapa === 1 && (
            <div className="space-y-6">
              <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="font-heading font-bold text-foreground-900 text-sm">Como deseja buscar?</h3>
                    <p className="mt-1 text-xs text-foreground-500">Escolha uma fonte validada para liberar os filtros da busca.</p>
                  </div>
                  <span className="rounded-full bg-background-100 px-2.5 py-1 text-[11px] font-semibold text-foreground-600">{fontesDisponiveis.length} fonte(s) pronta(s)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                  Avançar
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 2: Filtros */}
          {etapa === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
                        <i className="ri-map-pin-2-line text-primary-600"></i>
                      </div>
                      <h3 className="font-heading font-bold text-foreground-900">Localização</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">País</label>
                        <input type="text" value={pais} onChange={(e) => setPais(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Estado (UF)</label>
                        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                          {estados.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Cidade</label>
                        <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                      </div>
                    </div>
                    <div className="mt-5">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-foreground-800">Raio de atuação</label>
                        <span className="text-sm font-bold text-primary-600">{raio} km</span>
                      </div>
                      <input type="range" min={10} max={200} step={5} value={raio} onChange={(e) => setRaio(Number(e.target.value))} className="w-full accent-[oklch(var(--primary-500))] cursor-pointer" />
                    </div>
                  </section>

                  <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 bg-accent-100 rounded-lg flex items-center justify-center">
                        <i className="ri-filter-3-line text-accent-600"></i>
                      </div>
                      <h3 className="font-heading font-bold text-foreground-900">Perfil da empresa</h3>
                    </div>
                    <label className="block text-sm font-medium text-foreground-800 mb-2">Tipo de empresa / atividade</label>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {atividades.map((a) => (
                        <button key={a} onClick={() => toggle(atividadesSel, setAtividadesSel, a)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${atividadesSel.includes(a) ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}>
                          {a}
                        </button>
                      ))}
                    </div>
                    <label className="block text-sm font-medium text-foreground-800 mb-2">Nicho ou segmento desejado</label>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {segmentos.map((s) => (
                        <button key={s} onClick={() => toggle(segs, setSegs, s)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${segs.includes(s) ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <label className="block text-sm font-medium text-foreground-800 mb-2">Porte da empresa</label>
                    <div className="flex flex-wrap gap-2">
                      {portes.map((p) => (
                        <button key={p} onClick={() => toggle(portesSel, setPortesSel, p)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${portesSel.includes(p) ? 'bg-secondary-500 text-background-50' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
                        <i className="ri-user-settings-line text-primary-600"></i>
                      </div>
                      <h3 className="font-heading font-bold text-foreground-900">Contato e quantidade</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Cargo do decisor</label>
                        <select value={cargoDecisor} onChange={(e) => setCargoDecisor(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                          <option value="">Qualquer</option>
                          {cargos.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Volume máximo</label>
                        <input type="number" min={1} max={100} value={leadsDia} onChange={(e) => setLeadsDia(Math.max(1, Math.min(100, Number(e.target.value))))} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer">
                        <input type="checkbox" checked={temSite === true} onChange={() => setTemSite(temSite === true ? null : true)} className="cursor-pointer" />
                        Tem site
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer">
                        <input type="checkbox" checked={temWhatsApp === true} onChange={() => setTemWhatsApp(temWhatsApp === true ? null : true)} className="cursor-pointer" />
                        Tem WhatsApp
                      </label>
                      <label className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer">
                        <input type="checkbox" checked={temEmail === true} onChange={() => setTemEmail(temEmail === true ? null : true)} className="cursor-pointer" />
                        Tem e-mail
                      </label>
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <div className="bg-background-950 rounded-xl p-6 text-background-50">
                    <h3 className="font-heading font-bold mb-4">Resumo da busca</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-background-400">Fonte</span><span className="font-medium">{fontes.find((f) => f.id === fonteSelecionada)?.nome || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Local</span><span className="font-medium">{cidade} - {estado}</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Raio</span><span className="font-medium">{raio} km</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Tipo / nicho</span><span className="font-medium text-right">{atividadesSel.length + segs.length} selecionados</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Porte</span><span className="font-medium">{portesSel.length} selecionados</span></div>
                      <div className="flex justify-between border-t border-background-800 pt-3"><span className="text-background-400">Volume máximo</span><span className="font-bold">{leadsDia} leads</span></div>
                    </div>
                  </div>

                </div>
              </div>

              <div className="flex items-center justify-between">
                <button onClick={voltar} className="px-6 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">
                  Voltar
                </button>
                <button onClick={buscar} disabled={buscando} className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 px-8 py-3 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer whitespace-nowrap">
                  {buscando ? (
                    <>
                      <div className="w-4 h-4 border-2 border-background-50/30 border-t-background-50 rounded-full animate-spin"></div>
                      Buscando leads...
                    </>
                  ) : (
                    <>
                      <i className="ri-search-eye-line"></i>
                      Buscar leads
                    </>
                  )}
                </button>
              </div>

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
                <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
                  <div>
                    <h3 className="font-heading font-bold text-foreground-900 text-sm">Revisão dos leads encontrados</h3>
                    <p className="text-xs text-foreground-500">Selecione os leads para importar. Duplicados estão sinalizados.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-foreground-500">{selecionados.length} de {preview.length} selecionados</span>
                    <button onClick={selecionarTodos} disabled={preview.length === 0} className="text-xs text-primary-600 hover:text-primary-700 disabled:text-foreground-400 disabled:cursor-not-allowed font-medium cursor-pointer whitespace-nowrap">
                      {preview.length > 0 && selecionados.length === preview.filter((l) => !l.duplicado).length ? 'Desmarcar todos' : 'Selecionar todos'}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  {preview.length === 0 ? (
                    <div className="px-6 py-10 text-center text-sm text-foreground-500">
                      A fonte não retornou nenhum lead para os filtros informados. Ajuste os filtros e tente novamente.
                    </div>
                  ) : <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-background-200/70 bg-background-100/50">
                        <th className="text-left px-4 py-3 w-10">
                          <input type="checkbox" checked={selecionados.length > 0 && selecionados.length === preview.filter((l) => !l.duplicado).length} onChange={selecionarTodos} className="cursor-pointer" />
                        </th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Lead</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Aderência</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Localidade</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Fonte</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs hidden lg:table-cell">Completude</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Contato</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((l) => (
                        <tr key={l.id} className={`border-b border-background-100 hover:bg-background-50/50 ${l.duplicado ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3.5">
                            <input type="checkbox" checked={selecionados.includes(l.id)} onChange={() => toggleSelecionado(l.id)} disabled={l.duplicado} className="cursor-pointer" />
                          </td>
                          <td className="px-4 py-3.5 cursor-pointer" onClick={() => abrirLead(l)}>
                            <p className="font-medium text-foreground-900 flex items-center gap-1.5">
                              {l.nome}
                              <i className="ri-external-link-line text-foreground-300 text-xs"></i>
                            </p>
                            <p className="text-xs text-foreground-500">{l.empresa} · {l.cargo}</p>
                            <p className="text-xs text-foreground-400">{l.telefone} · {l.email}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${tempBadge[l.temperatura]}`}>{l.fitScore ?? l.score}/100</span>
                          </td>
                          <td className="px-4 py-3.5 text-foreground-600 hidden md:table-cell">{l.localidade}</td>
                          <td className="px-4 py-3.5 text-foreground-700">{l.fonte}</td>
                          <td className="px-4 py-3.5 hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-background-200 rounded-full overflow-hidden flex-shrink-0">
                                <div
                                  className={`h-full rounded-full ${l.completude >= 80 ? 'bg-primary-500' : l.completude >= 60 ? 'bg-accent-500' : 'bg-background-300'}`}
                                  style={{ width: `${l.completude}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-foreground-600 whitespace-nowrap">{l.completude}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-primary-100 text-primary-700">
                              {l.contactabilityScore ?? 0}/100
                            </span>
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
                                title="Lead não serve"
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-background-200/70 hover:bg-accent-50 cursor-pointer"
                              >
                                <i className="ri-close-circle-line text-foreground-500"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>}
                </div>
              </div>

                <div className="xl:col-span-2 space-y-4">
                  <ProspectingMap leads={preview} selectedIds={selecionados} onSelect={abrirLead} />
                  <section className="grid grid-cols-2 divide-x divide-background-200 overflow-hidden rounded-xl border border-background-200/70 bg-white text-center">
                    <div className="px-3 py-3"><p className="text-lg font-bold text-foreground-950">{preview.filter((lead) => lead.canais.whatsapp).length}</p><p className="mt-0.5 text-[11px] text-foreground-500">WhatsApp informado pela fonte</p></div>
                    <div className="px-3 py-3"><p className="text-lg font-bold text-foreground-950">{preview.filter((lead) => lead.canais.email).length}</p><p className="mt-0.5 text-[11px] text-foreground-500">Com e-mail válido</p></div>
                  </section>
                </div>
              </div>

              {feedbackAna && (
                <div className="bg-secondary-50 border border-secondary-200 text-secondary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                  <i className="ri-brain-line"></i>
                  {feedbackAna}
                </div>
              )}

              <div className="flex items-center justify-between">
                <button onClick={voltar} className="px-6 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">
                  Voltar
                </button>
                <button onClick={avancar} disabled={selecionados.length === 0} className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">
                  Avançar ({selecionados.length} leads)
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
                          <button onClick={() => setModoAtendimento('IA')} className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap ${modoAtendimento === 'IA' ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}>
                            <i className="ri-robot-line mr-1"></i> Ana (IA)
                          </button>
                          <button onClick={() => setModoAtendimento('HUMANO')} className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap ${modoAtendimento === 'HUMANO' ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}>
                            <i className="ri-user-line mr-1"></i> Humano
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Responsável</label>
                        <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                          {mockUsers.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Canal preferencial</label>
                        <select value={canal} onChange={(e) => setCanal(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="E-mail">E-mail</option>
                          <option value="Telefone">Telefone</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Template de primeiro contato</label>
                        <select value={template} onChange={(e) => setTemplate(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                          {templatesMensagem.filter((t) => t.categoria === 'Primeiro contato' || t.categoria === 'Follow-up').map((t) => (
                            <option key={t.id} value={t.id}>{t.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Tags (separadas por vírgula)</label>
                        <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="prospecção, agosto, saopaulo" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                      </div>
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
                <button onClick={concluir} className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-8 py-3 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer whitespace-nowrap">
                  <i className="ri-check-line"></i>
                  Adicionar aos Leads
                </button>
              </div>
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
        <div className="bg-background-50 border border-background-200/70 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-background-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-upload-cloud-line text-foreground-400 text-2xl"></i>
          </div>
          <h3 className="font-heading font-bold text-foreground-900 mb-2">Importar lista de contatos</h3>
          <p className="text-sm text-foreground-500 mb-6 max-w-md mx-auto">
            Faça upload de um arquivo CSV com colunas como Nome, Empresa, E-mail, Telefone, Segmento, Cidade e Estado.
            As colunas são mapeadas automaticamente e você confere uma prévia antes de importar.
          </p>
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
          subtitulo="Mapeie as colunas e importe vários contatos de uma vez."
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
