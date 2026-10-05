import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { camposDisponiveis, montarPrompt } from '@/lib/promptBusca';
import { useBibliotecaPromptsStore, type BibliotecaPrompt } from '@/hooks/useBibliotecaPromptsStore';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import { useLocalStorageState } from '@/hooks/useLocalStorageState';

type FiltroBiblioteca = 'todos' | 'favoritos' | 'recentes';

// Detecta a intenção a partir dos critérios digitados e sugere o prompt mais
// alinhado (buscar lead, qualificar, resumir e fazer follow-up).
function detectarSugestao(criterios: string, prompts: BibliotecaPrompt[]): BibliotecaPrompt | null {
  const t = criterios.toLowerCase();
  if (!t.trim()) return null;

  const mapa: [RegExp, string][] = [
    [/qualif|desafio|necessidade|orcamento|decide/, 'Qualificação'],
    [/sequencia|abordagem|apresentar/, 'Follow-up'],
    [/resumir|resumo|conversa/, 'Atendimento'],
    [/follow|retomar|retorno|pos.*proposta/, 'Follow-up'],
    [/buscar|lead|prospec|empresa|contato|lista/, 'Prospecção'],
  ];

  const preset = mapa.find(([re]) => re.test(t))?.[1];
  if (!preset) return null;
  return prompts.find((p) => p.ativo && p.preset === preset) ?? null;
}

export default function PromptAgent() {
  const navigate = useNavigate();
  const { prompts } = useBibliotecaPromptsStore();
  const { settings } = useEmpresaSettingsStore();

  const [campos, setCampos] = useState<string[]>(['nome', 'empresa', 'email', 'telefone', 'segmento']);
  const [criterios, setCriterios] = useState('');
  const [modeloAtivo, setModeloAtivo] = useState<string | null>(null);
  const [resultado, setResultado] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [incluirContexto, setIncluirContexto] = useState(true);
  const [filtro, setFiltro] = useState<FiltroBiblioteca>('todos');
  const [busca, setBusca] = useState('');
  const [favoritos, setFavoritos] = useLocalStorageState<string[]>('leadai_prompts_favoritos', []);
  const [recentes, setRecentes] = useLocalStorageState<string[]>('leadai_prompts_recentes', []);

  const ativos = useMemo(() => prompts.filter((p) => p.ativo), [prompts]);
  const sugestao = useMemo(() => detectarSugestao(criterios, prompts), [criterios, prompts]);

  const toggleCampo = (id: string) => {
    setCampos((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const registrarRecente = (id: string) => {
    setRecentes((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 5));
  };

  const aplicarModelo = (m: BibliotecaPrompt) => {
    setModeloAtivo(m.id);
    setCriterios(m.criterios);
    setCampos(m.campos);
    setResultado('');
    setAviso('');
    setErro('');
    setCopiado(false);
    registrarRecente(m.id);
  };

  const toggleFavorito = (id: string) => {
    setFavoritos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const listaFiltrada = useMemo(() => {
    let lista = ativos;
    if (filtro === 'favoritos') lista = lista.filter((p) => favoritos.includes(p.id));
    if (filtro === 'recentes') lista = lista.filter((p) => recentes.includes(p.id));
    if (busca.trim()) {
      const q = busca.toLowerCase();
      lista = lista.filter(
        (p) => p.titulo.toLowerCase().includes(q) || p.objetivo.toLowerCase().includes(q),
      );
    }
    return lista;
  }, [ativos, filtro, favoritos, recentes, busca]);

  const montarContexto = (): string | undefined => {
    if (!incluirContexto) return undefined;
    const partes: string[] = [];
    if (settings.organizacao.nome) partes.push(`- Empresa: ${settings.organizacao.nome}`);
    if (settings.ramo) partes.push(`- Ramo de atuação: ${settings.ramo}`);
    if (settings.publico) partes.push(`- Público-alvo: ${settings.publico}`);
    if (partes.length === 0) return undefined;
    return partes.join('\n');
  };

  const gerar = async () => {
    setErro('');
    setAviso('');
    setCopiado(false);

    if (campos.length === 0) {
      setErro('Selecione ao menos um campo para a busca.');
      return;
    }
    if (!criterios.trim()) {
      setErro('Descreva os critérios da busca (ou escolha um modelo da biblioteca).');
      return;
    }

    setCarregando(true);
    const base = montarPrompt(campos, criterios, montarContexto());

    try {
      const session = await resolveOrganizationSession();
      const { data, error } = await supabase.functions.invoke('gerar-prompt-busca', {
        body: { organizationId: session.organizationId, fields: campos, criteria: criterios },
      });

      if (error || !data?.prompt) {
        setResultado(base);
        setAviso('IA indisponível — usei o modelo local. Adicione sua chave de IA para otimizar o prompt.');
      } else {
        setResultado(data.prompt);
      }
    } catch {
      setResultado(base);
      setAviso('IA indisponível — usei o modelo local. Adicione sua chave de IA para otimizar o prompt.');
    } finally {
      setCarregando(false);
    }
  };

  const copiar = async () => {
    if (!resultado) return;
    try {
      await navigator.clipboard.writeText(resultado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // navegador sem suporte a clipboard — mantém silencioso
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm mb-1">
              Gerador de prompt de busca de leads
            </h3>
            <p className="text-sm text-foreground-500">
              Descreva o que quer prospectar, escolha os campos e gere um prompt pronto para usar em qualquer ferramenta de busca.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 shrink-0 rounded-full bg-background-100 px-3 py-1.5 text-xs font-semibold text-foreground-700"><i className="ri-draft-line"></i> Rascunho — não executa busca</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal: critérios + campos */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
                <i className="ri-quill-pen-line text-primary-600"></i>
              </div>
              <h3 className="font-heading font-bold text-foreground-900">Critérios da busca</h3>
            </div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">
              O que você quer prospectar?
            </label>
            <textarea
              value={criterios}
              onChange={(e) => {
                setCriterios(e.target.value);
                setModeloAtivo(null);
              }}
              rows={4}
              placeholder="Ex: Empresas de construção civil em Curitiba - PR com site próprio e contato do responsável comercial..."
              className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
            />

            {sugestao && !modeloAtivo && (
              <button
                onClick={() => aplicarModelo(sugestao)}
                className="mt-3 w-full flex items-center gap-2 px-4 py-2.5 bg-secondary-50 border border-secondary-200 rounded-lg text-sm text-secondary-800 hover:bg-secondary-100 transition-all cursor-pointer"
              >
                <i className="ri-sparkling-2-line text-secondary-600"></i>
                <span className="text-left">
                  Parece que você quer <strong>{sugestao.titulo.toLowerCase()}</strong>. Usar este modelo?
                </span>
                <i className="ri-arrow-right-line ml-auto text-secondary-500"></i>
              </button>
            )}

            <label className="mt-4 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={incluirContexto}
                onChange={(e) => setIncluirContexto(e.target.checked)}
                className="w-4 h-4 text-primary-500 rounded border-background-300 focus:ring-primary-300"
              />
              <span className="text-xs text-foreground-600">
                Incluir contexto da empresa (o que você vende, tom e público) no prompt
              </span>
            </label>
          </section>

          <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-accent-100 rounded-lg flex items-center justify-center">
                <i className="ri-list-check-3 text-accent-600"></i>
              </div>
              <div>
                <h3 className="font-heading font-bold text-foreground-900">Campos a retornar</h3>
                <p className="text-xs text-foreground-500">Marque os dados que cada lead deve conter.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {camposDisponiveis.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggleCampo(c.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                    campos.includes(c.id)
                      ? 'bg-primary-500 text-background-50'
                      : 'bg-background-100 text-foreground-600 hover:bg-background-200'
                  }`}
                >
                  {campos.includes(c.id) && <i className="ri-check-line mr-1"></i>}
                  {c.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Coluna lateral: biblioteca de prompts */}
        <div className="space-y-4">
          <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-secondary-100 rounded-lg flex items-center justify-center">
                <i className="ri-sparkling-2-line text-secondary-600"></i>
              </div>
              <h3 className="font-heading font-bold text-foreground-900">Biblioteca de prompts</h3>
            </div>

            <div className="flex gap-1 bg-background-100 rounded-full p-1 mb-3">
              {(
                [
                  ['todos', 'Todos'],
                  ['favoritos', 'Favoritos'],
                  ['recentes', 'Recentes'],
                ] as [FiltroBiblioteca, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setFiltro(id)}
                  className={`flex-1 px-2 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    filtro === id ? 'bg-background-50 text-foreground-900 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar prompt..."
              className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 mb-3 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {listaFiltrada.map((m) => (
                <div
                  key={m.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    modeloAtivo === m.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-background-200/70 hover:border-background-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => aplicarModelo(m)} className="flex-1 text-left cursor-pointer">
                      <span className="text-sm font-semibold text-foreground-900 block">{m.titulo}</span>
                      <span className="text-[11px] text-foreground-400">{m.preset}</span>
                    </button>
                    <button
                      onClick={() => toggleFavorito(m.id)}
                      className={`shrink-0 w-6 h-6 flex items-center justify-center rounded-md cursor-pointer ${
                        favoritos.includes(m.id) ? 'text-accent-500' : 'text-foreground-300 hover:text-foreground-500'
                      }`}
                      title={favoritos.includes(m.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    >
                      <i className={favoritos.includes(m.id) ? 'ri-star-fill' : 'ri-star-line'}></i>
                    </button>
                  </div>
                  <p className="text-xs text-foreground-500 leading-relaxed mt-1">{m.objetivo}</p>
                </div>
              ))}
              {listaFiltrada.length === 0 && (
                <p className="text-xs text-foreground-400 py-4 text-center">
                  {filtro === 'favoritos' ? 'Nenhum prompt favoritado ainda.' : 'Nenhum prompt encontrado.'}
                </p>
              )}
            </div>

            <button
              onClick={() => navigate('/dashboard/configuracoes?tab=ana')}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-xs font-semibold hover:bg-background-100 transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-settings-3-line"></i>
              Gerenciar biblioteca
            </button>
          </div>

          <div className="bg-accent-50 border border-accent-200 rounded-xl p-4 text-xs text-accent-800 leading-relaxed">
            <i className="ri-lightbulb-line mr-1"></i>
            <strong>Dica:</strong> configure a chave OpenAI no backend para otimizar e refinar o prompt. Sem a chave, o sistema mantém o modelo local.
          </div>
        </div>
      </div>

      {/* Ação */}
      <div className="flex items-center justify-end">
        <button
          onClick={gerar}
          disabled={carregando}
          className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 px-8 py-3 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer whitespace-nowrap"
        >
          {carregando ? (
            <>
              <div className="w-4 h-4 border-2 border-background-50/30 border-t-background-50 rounded-full animate-spin"></div>
              Gerando prompt...
            </>
          ) : (
            <>
              <i className="ri-magic-line"></i>
              Gerar prompt de busca
            </>
          )}
        </button>
      </div>

      {erro && (
        <div className="bg-accent-50 border border-accent-200 text-accent-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-error-warning-line"></i>
          {erro}
        </div>
      )}

      {aviso && resultado && (
        <div className="bg-secondary-50 border border-secondary-200 text-secondary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {aviso}
        </div>
      )}

      {resultado && (
        <section className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
            <div>
              <h3 className="font-heading font-bold text-foreground-900 text-sm">Prompt gerado</h3>
              <p className="text-xs text-foreground-500">Copie e cole na sua ferramenta de busca de leads.</p>
            </div>
            <button
              onClick={copiar}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-background-100 hover:bg-background-200 text-foreground-800 rounded-lg text-sm font-medium transition-all cursor-pointer whitespace-nowrap"
            >
              <i className={copiado ? 'ri-check-line text-primary-600' : 'ri-file-copy-line'}></i>
              {copiado ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <div className="p-6">
            <pre className="whitespace-pre-wrap text-sm text-foreground-800 leading-relaxed font-sans">
              {resultado}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
}
