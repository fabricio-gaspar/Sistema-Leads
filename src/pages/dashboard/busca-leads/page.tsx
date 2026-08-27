import { useState } from 'react';
import { segmentos, portes } from '@/mocks/leadsData';
import type { Lead } from '@/mocks/leadsData';
import { useLeadsStore, waitForLeadsPersistence } from '@/hooks/useLeadsStore';
import { useFluxoComercial } from '@/hooks/useFluxoComercial';
import { useListasStore } from '@/hooks/useListasStore';
import { fontesLeads } from '@/mocks/fontesData';
import { templatesMensagem } from '@/mocks/templatesData';
import { mockUsers } from '@/mocks/users';
import { leadsPreviewInicial, temperaturaDe, tempBadge, tempLabel, eficienciaFonte, alertasLeads } from '@/mocks/enriquecimentoData';
import type { PreviewLead } from '@/mocks/enriquecimentoData';
import PromptAgent from '@/pages/dashboard/busca-leads/components/PromptAgent';
import LeadPreviewDrawer from '@/pages/dashboard/busca-leads/components/LeadPreviewDrawer';
import CsvImportModal from '@/components/feature/CsvImportModal';
import type { CampoImportacao, ResultadoImportacao } from '@/components/feature/CsvImportModal';

const estados = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS', 'BA', 'PE', 'GO', 'DF'];
const atividades = ['Tecnologia', 'Saúde', 'Educação', 'Varejo', 'Indústria', 'Logística', 'Marketing', 'Consultoria', 'Financeiro', 'Imobiliário'];
const cargos = ['CEO', 'Diretor', 'Gerente', 'Coordenador', 'Analista', 'Proprietário'];

const campanhas = ['Prospecção Q3', 'Construção Civil SP', 'Scraper Industrial', 'IA Search', 'Evento Borracha Técnica', 'Integração ERP', 'Catálogo Wayflex'];

const fasesBusca = ['Buscando nas fontes', 'Enriquecendo contatos', 'Qualificando com a Ana', 'Removendo duplicados'];

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
  const [aba, setAba] = useState<'agente' | 'busca' | 'importar' | 'campanhas' | 'operacao'>('agente');
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
  const [preview, setPreview] = useState<PreviewLead[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [faseBusca, setFaseBusca] = useState('');
  const [leadAberto, setLeadAberto] = useState<PreviewLead | null>(null);
  const [feedbackAna, setFeedbackAna] = useState('');
  const [alertasAberto, setAlertasAberto] = useState(false);
  const [nomeLista, setNomeLista] = useState('');
  const [modoAtendimento, setModoAtendimento] = useState<'IA' | 'HUMANO'>('IA');
  const [responsavel, setResponsavel] = useState('u-2');
  const [canal, setCanal] = useState('WhatsApp');
  const [template, setTemplate] = useState('tm-1');
  const [campanha, setCampanha] = useState('Prospecção Q3');
  const [tags, setTags] = useState('');

  const [leads, setLeads] = useLeadsStore();
  const fluxo = useFluxoComercial();
  const listas = useListasStore();
  const [csvModal, setCsvModal] = useState(false);

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

  const mapearNovoLead = (dados: Partial<Lead> & { nome: string; empresa: string }): Lead => ({
    id: crypto.randomUUID(),
    nome: dados.nome,
    empresa: dados.empresa,
    cnpj: dados.cnpj || '—',
    email: dados.email || '',
    telefone: dados.telefone || '',
    whatsapp: dados.whatsapp || dados.telefone || '',
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
    automacaoStatus: 'ATIVA',
    canalPreferencial: canal,
    templateId: template,
    campanha: dados.campanha || campanha,
    tags: dados.tags || (tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []),
    bloqueado: false,
    contatoPermitido: true,
    consentimentoWhatsApp: true,
    consentimentoEmail: true,
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
    aguardandoAtivacao: true,
  });

  const toggle = (lista: string[], setLista: (v: string[]) => void, valor: string) => {
    if (lista.includes(valor)) {
      setLista(lista.filter((x) => x !== valor));
    } else {
      setLista([...lista, valor]);
    }
  };

  const buscar = () => {
    setBuscando(true);
    setResultado(null);
    setFeedbackAna('');
    setFaseBusca(fasesBusca[0]);
    setTimeout(() => setFaseBusca(fasesBusca[1]), 450);
    setTimeout(() => setFaseBusca(fasesBusca[2]), 950);
    setTimeout(() => setFaseBusca(fasesBusca[3]), 1400);
    setTimeout(() => {
      setBuscando(false);
      setFaseBusca('');
      const cruzados = cruzarPreview(leadsPreviewInicial);
      setPreview(cruzados);
      setSelecionados(cruzados.filter((l) => !l.duplicado).map((l) => l.id));
      const dups = cruzados.filter((l) => l.duplicado).length;
      setResultado(
        dups > 0
          ? `${cruzados.length} leads encontrados. ${dups} duplicado(s) já no funil e bloqueado(s).`
          : `${cruzados.length} leads encontrados, sem duplicados no funil.`
      );
      setEtapa(3);
    }, 1900);
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
    setFeedbackAna('Lead descartado. A Ana ajustou o filtro para não trazer este tipo novamente.');
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
    const fonte = fontesLeads.find((f) => f.id === fonteSelecionada);
    const nomeFinal = nomeLista.trim() || `Prospecção ${cidade} · ${new Date().toLocaleDateString('pt-BR')}`;
    const selecionadosLeads = preview
      .filter((l) => !l.duplicado && selecionados.includes(l.id))
      .map((l) =>
        mapearNovoLead({
          nome: l.nome,
          empresa: l.empresa,
          email: l.email,
          telefone: l.telefone,
          segmento: atividadesSel[0] || segs[0] || 'Tecnologia',
          cidade: l.localidade.split(' - ')[0] || cidade,
          estado: l.localidade.split(' - ')[1] || estado,
          score: l.score,
          origem: l.fonte,
          campanha: fonte?.campanhaPadrao || campanha,
          tags: fonte?.tagsPadrao,
        })
      );
    if (selecionadosLeads.length) {
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
    }
    setResultado(
      `Lista "${nomeFinal}" criada com ${selecionadosLeads.length} leads e enviada para o menu Leads. A Ana dispara a apresentação depois que você aprovar no Kanban.`
    );
    setTimeout(() => {
      setEtapa(1);
      setPreview([]);
      setSelecionados([]);
      setResultado(null);
      setNomeLista('');
    }, 5000);
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

  const etapaLabel = ['Fonte', 'Filtros', 'Revisão', 'Operação'];

  return (
    <div className="p-6 md:p-8 max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-2">
            Busca de Leads
          </h1>
          <p className="text-foreground-600 text-sm">
            Defina a região, segmentos e volume de prospecção. A Ana busca leads automaticamente via APIs e bases públicas.
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setAlertasAberto((v) => !v)}
            className="relative w-10 h-10 flex items-center justify-center rounded-lg border border-background-200/70 bg-background-50 hover:bg-background-100 transition-all cursor-pointer"
          >
            <i className="ri-notification-3-line text-foreground-700 text-lg"></i>
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold flex items-center justify-center">
              {alertasLeads.length}
            </span>
          </button>
          {alertasAberto && (
            <div className="absolute right-0 top-12 w-80 bg-background-50 border border-background-200/70 rounded-xl shadow-lg z-40 overflow-hidden">
              <div className="px-4 py-3 border-b border-background-200/70 flex items-center justify-between">
                <span className="text-sm font-heading font-bold text-foreground-900">Alertas da Ana</span>
                <button
                  onClick={() => setAlertasAberto(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-background-100 cursor-pointer"
                >
                  <i className="ri-close-line"></i>
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {alertasLeads.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAlertasAberto(false)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-background-50/60 border-b border-background-100 last:border-0 cursor-pointer"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        a.tipo === 'icp'
                          ? 'bg-accent-100 text-accent-700'
                          : a.tipo === 'quente'
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-secondary-100 text-secondary-800'
                      }`}
                    >
                      <i className={a.tipo === 'fonte' ? 'ri-cloud-line' : 'ri-fire-fill'}></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground-800 leading-snug">{a.titulo}</p>
                      <p className="text-[11px] text-foreground-400 mt-0.5">{a.tempo}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="px-4 py-2.5 bg-background-100/50 text-center">
                <span className="text-xs text-foreground-500">A Ana monitora novas oportunidades em tempo real</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="mb-6 flex gap-1 bg-background-100 rounded-full p-1 overflow-x-auto">
        {(
          [
            { id: 'agente', label: 'Agente de Prompt (IA)' },
            { id: 'busca', label: 'Busca manual' },
            { id: 'importar', label: 'Importar lista' },
            { id: 'campanhas', label: 'Campanhas agendadas' },
            { id: 'operacao', label: 'Operação comercial' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex-shrink-0 ${
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
                <h3 className="font-heading font-bold text-foreground-900 text-sm mb-4">Selecione a fonte de prospecção</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {fontesLeads.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFonteSelecionada(f.id)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        fonteSelecionada === f.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-background-200/70 hover:border-background-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <i className={`${f.tipo === 'API' ? 'ri-cloud-line' : f.tipo === 'CSV' ? 'ri-file-upload-line' : f.tipo === 'webhook' ? 'ri-webhook-line' : 'ri-survey-line'} text-primary-600`}></i>
                        <span className="text-sm font-medium text-foreground-900">{f.nome}</span>
                      </div>
                      <p className="text-xs text-foreground-500">{f.leadsImportados.toLocaleString()} leads importados</p>
                      <p className="text-xs text-foreground-400 mt-0.5">{f.ultimaSincronizacao}</p>
                    </button>
                  ))}
                </div>
              </div>
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
                      <h3 className="font-heading font-bold text-foreground-900">Segmentos e porte</h3>
                    </div>
                    <label className="block text-sm font-medium text-foreground-800 mb-2">Atividades / CNAE</label>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {atividades.map((a) => (
                        <button key={a} onClick={() => toggle(atividadesSel, setAtividadesSel, a)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${atividadesSel.includes(a) ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}>
                          {a}
                        </button>
                      ))}
                    </div>
                    <label className="block text-sm font-medium text-foreground-800 mb-2">Segmentos desejados</label>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {segmentos.map((s) => (
                        <button key={s} onClick={() => toggle(segs, setSegs, s)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${segs.includes(s) ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <label className="block text-sm font-medium text-foreground-800 mb-2">Porte das empresas</label>
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
                      <h3 className="font-heading font-bold text-foreground-900">Critérios avançados</h3>
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
                        <input type="number" min={1} max={500} value={leadsDia} onChange={(e) => setLeadsDia(Number(e.target.value))} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
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
                      <div className="flex justify-between"><span className="text-background-400">Fonte</span><span className="font-medium">{fontesLeads.find((f) => f.id === fonteSelecionada)?.nome || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Local</span><span className="font-medium">{cidade} - {estado}</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Raio</span><span className="font-medium">{raio} km</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Segmentos</span><span className="font-medium text-right">{segs.length} selecionados</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Portes</span><span className="font-medium">{portesSel.length} selecionados</span></div>
                      <div className="flex justify-between border-t border-background-800 pt-3"><span className="text-background-400">Volume</span><span className="font-bold">{leadsDia} leads/dia</span></div>
                    </div>
                  </div>

                  <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <i className="ri-bar-chart-2-line text-primary-600"></i>
                      <h3 className="font-heading font-bold text-foreground-900 text-sm">Eficiência por fonte</h3>
                    </div>
                    <div className="space-y-4">
                      {eficienciaFonte.map((f) => {
                        const taxa = f.importados > 0 ? Math.round((f.qualificados / f.importados) * 100) : 0;
                        return (
                          <div key={f.fonte}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-foreground-700">{f.fonte}</span>
                              <span className="text-xs font-bold text-foreground-900">
                                {f.importados > 0 ? `${taxa}%` : '—'}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-background-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${taxa >= 45 ? 'bg-primary-500' : taxa >= 30 ? 'bg-accent-500' : 'bg-secondary-500'}`}
                                style={{ width: `${taxa}%` }}
                              ></div>
                            </div>
                            <p className="text-[11px] text-foreground-400 mt-1">
                              {f.qualificados} qualificados · {f.importados} importados · custo {f.custo}
                            </p>
                          </div>
                        );
                      })}
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
              <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
                  <div>
                    <h3 className="font-heading font-bold text-foreground-900 text-sm">Revisão dos leads encontrados</h3>
                    <p className="text-xs text-foreground-500">Selecione os leads para importar. Duplicados estão sinalizados.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-foreground-500">{selecionados.length} de {preview.length} selecionados</span>
                    <button onClick={selecionarTodos} className="text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer whitespace-nowrap">
                      {selecionados.length === preview.filter((l) => !l.duplicado).length ? 'Desmarcar todos' : 'Selecionar todos'}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-background-200/70 bg-background-100/50">
                        <th className="text-left px-4 py-3 w-10">
                          <input type="checkbox" checked={selecionados.length > 0 && selecionados.length === preview.filter((l) => !l.duplicado).length} onChange={selecionarTodos} className="cursor-pointer" />
                        </th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Lead</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Temperatura</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Localidade</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Fonte</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs hidden lg:table-cell">Completude</th>
                        <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Score</th>
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
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${tempBadge[l.temperatura]}`}>
                              {tempLabel[l.temperatura]}
                            </span>
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
                              {l.score}
                            </span>
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
                  </table>
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

          {/* ETAPA 4: Operação */}
          {etapa === 4 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
                    <h3 className="font-heading font-bold text-foreground-900 text-sm mb-4">Configuração da operação</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome da lista / campanha</label>
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
                      <div>
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Campanha</label>
                        <select value={campanha} onChange={(e) => setCampanha(e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                          {campanhas.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-foreground-800 mb-1.5">Tags (separadas por vírgula)</label>
                        <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="prospecção, agosto, saopaulo" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-6">
                  <div className="bg-background-950 rounded-xl p-6 text-background-50">
                    <h3 className="font-heading font-bold mb-4">Resumo da operação</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-background-400">Leads selecionados</span><span className="font-bold">{selecionados.length}</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Modo</span><span className="font-medium">{modoAtendimento}</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Responsável</span><span className="font-medium">{responsavelNome}</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Canal</span><span className="font-medium">{canal}</span></div>
                      <div className="flex justify-between"><span className="text-background-400">Campanha</span><span className="font-medium">{campanha}</span></div>
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
                  Concluir e importar
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

      {aba === 'campanhas' && (
        <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-background-200/70">
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Campanhas agendadas</h3>
          </div>
          <div className="p-8 text-center text-foreground-400 text-sm">
            <i className="ri-calendar-event-line text-xl mb-2 block"></i>
            Nenhuma campanha agendada no momento.
          </div>
        </div>
      )}

      {aba === 'operacao' && (
        <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-background-200/70">
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Operações comerciais em andamento</h3>
          </div>
          <div className="p-8 text-center text-foreground-400 text-sm">
            <i className="ri-briefcase-line text-xl mb-2 block"></i>
            Nenhuma operação comercial ativa no momento.
          </div>
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
