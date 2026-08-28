import { useState } from 'react';
import { useSocialStore } from '@/hooks/useSocialStore';
import { campanhasSociais } from '@/mocks/socialData';
import type { PostObjetivo, SocialMedia, SocialNetwork, SocialPost } from '@/mocks/socialData';
import { networkMeta, objetivoLabel } from '@/pages/dashboard/campanhas/socialMeta';

const redesDisponiveis: SocialNetwork[] = ['LINKEDIN', 'INSTAGRAM', 'FACEBOOK'];

const objetivos: PostObjetivo[] = [
  'reconhecimento',
  'trafego',
  'geracao_leads',
  'autoridade',
  'relacionamento',
  'oferta',
];

const tiposMidia = [
  { value: 'imagem', label: 'Imagem' },
  { value: 'video', label: 'Vídeo' },
  { value: 'carrossel', label: 'Carrossel' },
  { value: 'documento', label: 'Documento' },
];

interface FormState {
  nomeInterno: string;
  campanha: string;
  objetivo: PostObjetivo;
  redes: SocialNetwork[];
  dataHora: string;
  responsavel: string;
  aprovador: string;
  tags: string;
  tema: string;
  mensagemBase: string;
  cta: string;
  link: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  hashtags: string;
  mencoes: string;
  linkedin: string;
  instagram: string;
  facebook: string;
}

const formInicial: FormState = {
  nomeInterno: '',
  campanha: '',
  objetivo: 'reconhecimento',
  redes: [],
  dataHora: '',
  responsavel: '',
  aprovador: '',
  tags: '',
  tema: '',
  mensagemBase: '',
  cta: '',
  link: '',
  utmSource: '',
  utmMedium: '',
  utmCampaign: '',
  hashtags: '',
  mencoes: '',
  linkedin: '',
  instagram: '',
  facebook: '',
};

export default function CriarPublicacao() {
  const { contas, criarPost } = useSocialStore();
  const [form, setForm] = useState<FormState>(formInicial);
  const [midia, setMidia] = useState<SocialMedia[]>([]);
  const [novaMidia, setNovaMidia] = useState({ nomeArquivo: '', tipo: 'imagem', altText: '' });
  const [preview, setPreview] = useState(false);
  const [toast, setToast] = useState('');

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const set = (campo: keyof FormState, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  const toggleRede = (r: SocialNetwork) => {
    setForm((f) => ({
      ...f,
      redes: f.redes.includes(r) ? f.redes.filter((x) => x !== r) : [...f.redes, r],
    }));
  };

  const contaDaRede = (r: SocialNetwork) => contas.find((c) => c.network === r);

  const adaptarParaRedes = () => {
    if (!form.mensagemBase.trim()) {
      mostrarToast('Preencha a mensagem-base antes de adaptar.');
      return;
    }
    setForm((f) => ({
      ...f,
      linkedin: f.linkedin || f.mensagemBase,
      instagram: f.instagram || f.mensagemBase,
      facebook: f.facebook || f.mensagemBase,
    }));
    mostrarToast('Mensagem-base aplicada às redes selecionadas.');
  };

  const gerarComAna = () => {
    if (!form.tema.trim() && !form.mensagemBase.trim()) {
      mostrarToast('Informe o tema ou a mensagem-base para a Ana gerar o conteúdo.');
      return;
    }
    const base = form.mensagemBase || form.tema;
    setForm((f) => ({
      ...f,
      linkedin: f.linkedin || `${base} Quer saber como a Wayflex pode ajudar a sua empresa com soluções industriais de borracha? ${f.cta || ''}`.trim(),
      instagram: f.instagram || `${base} ✨ ${f.cta || ''}`.trim(),
      facebook: f.facebook || `${base} Saiba mais! ${f.cta || ''}`.trim(),
    }));
    mostrarToast('Sugestão da Ana aplicada (simulada — IA real será conectada depois).');
  };

  const adicionarMidia = () => {
    if (!novaMidia.nomeArquivo.trim()) {
      mostrarToast('Informe o nome do arquivo.');
      return;
    }
    setMidia((m) => [
      ...m,
      {
        id: `md-${Date.now()}`,
        nomeArquivo: novaMidia.nomeArquivo.trim(),
        tipo: novaMidia.tipo as SocialMedia['tipo'],
        mimeType: novaMidia.tipo === 'video' ? 'video/mp4' : 'image/png',
        tamanho: '—',
        largura: 0,
        altura: 0,
        altText: novaMidia.altText.trim(),
      },
    ]);
    setNovaMidia({ nomeArquivo: '', tipo: 'imagem', altText: '' });
    mostrarToast('Mídia adicionada (upload real após conectar o Storage).');
  };

  const removerMidia = (id: string) => setMidia((m) => m.filter((x) => x.id !== id));

  const montarPost = (status: SocialPost['status']): SocialPost | null => {
    if (!form.nomeInterno.trim()) {
      mostrarToast('Informe o nome interno da publicação.');
      return null;
    }
    if (!form.campanha) {
      mostrarToast('Selecione a campanha.');
      return null;
    }
    if (form.redes.length === 0) {
      mostrarToast('Selecione ao menos uma rede.');
      return null;
    }
    if (status === 'AGUARDANDO_APROVACAO' && !form.dataHora) {
      mostrarToast('Informe data e hora de publicação.');
      return null;
    }
    const semConteudo = form.redes.some((r) => {
      const texto = r === 'LINKEDIN' ? form.linkedin : r === 'INSTAGRAM' ? form.instagram : form.facebook;
      return !texto.trim();
    });
    if (status === 'AGUARDANDO_APROVACAO' && semConteudo) {
      mostrarToast('Preencha o conteúdo específico de cada rede selecionada.');
      return null;
    }

    const agora = new Date().toISOString();
    const dataIso = form.dataHora ? `${form.dataHora}:00` : '';
    return {
      id: `sp-${Date.now()}`,
      nomeInterno: form.nomeInterno.trim(),
      campanha: form.campanha,
      objetivo: form.objetivo,
      redes: form.redes,
      contasPorRede: form.redes.map((r) => ({
        network: r,
        accountId: contaDaRede(r)?.id || '',
      })),
      dataHora: dataIso,
      timezone: 'America/Sao_Paulo',
      status,
      responsavel: form.responsavel.trim() || 'Você',
      aprovador: form.aprovador.trim(),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      tema: form.tema.trim(),
      mensagemBase: form.mensagemBase.trim(),
      cta: form.cta.trim(),
      link: form.link.trim(),
      utmSource: form.utmSource.trim(),
      utmMedium: form.utmMedium.trim(),
      utmCampaign: form.utmCampaign.trim(),
      hashtags: form.hashtags.split(',').map((t) => t.trim().replace(/^#/, '')).filter(Boolean),
      mencoes: form.mencoes.split(',').map((t) => t.trim()).filter(Boolean),
      conteudoPorRede: {
        LINKEDIN: form.linkedin.trim(),
        INSTAGRAM: form.instagram.trim(),
        FACEBOOK: form.facebook.trim(),
      },
      midia,
      aprovadoEm: null,
      publicadoEm: null,
      erro: null,
      tentativas: 0,
      criadoEm: agora,
    };
  };

  const salvarRascunho = () => {
    const post = montarPost('RASCUNHO');
    if (!post) return;
    criarPost(post);
    mostrarToast('Rascunho salvo.');
    setForm(formInicial);
    setMidia([]);
  };

  const enviarAprovacao = () => {
    const post = montarPost('AGUARDANDO_APROVACAO');
    if (!post) return;
    criarPost(post);
    mostrarToast('Enviado para aprovação.');
    setForm(formInicial);
    setMidia([]);
  };

  const input = (
    label: string,
    campo: keyof FormState,
    placeholder: string,
    tipo: 'text' | 'textarea' = 'text',
  ) => (
    <div>
      <label className="block text-xs font-medium text-foreground-600 mb-1">{label}</label>
      {tipo === 'textarea' ? (
        <textarea
          value={form[campo] as string}
          onChange={(e) => set(campo, e.target.value)}
          placeholder={placeholder}
          rows={3}
          maxLength={500}
          className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
        />
      ) : (
        <input
          type="text"
          value={form[campo] as string}
          onChange={(e) => set(campo, e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
      )}
    </div>
  );

  return (
    <div className="wf-page">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-2">Criar Publicação</h1>
          <p className="text-foreground-600 text-sm">Prepare o conteúdo, adapte por rede e envie para aprovação.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreview(true)}
            className="px-4 py-2.5 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
          >
            Pré-visualizar
          </button>
          <button
            onClick={salvarRascunho}
            className="px-4 py-2.5 border border-background-300 text-foreground-700 hover:bg-background-100 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
          >
            Salvar rascunho
          </button>
          <button
            onClick={enviarAprovacao}
            className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
          >
            Enviar para aprovação
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      {/* Dados da publicação */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6 mb-5">
        <h2 className="font-heading font-bold text-foreground-900 mb-4 flex items-center gap-2">
          <i className="ri-file-text-line text-primary-600"></i> Dados da publicação
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input('Nome interno *', 'nomeInterno', 'Ex.: Lançamento - novo site')}
          <div>
            <label className="block text-xs font-medium text-foreground-600 mb-1">Campanha *</label>
            <select
              value={form.campanha}
              onChange={(e) => set('campanha', e.target.value)}
              className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800 cursor-pointer"
            >
              <option value="">Selecione...</option>
              {campanhasSociais.map((c) => (
                <option key={c.id} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-600 mb-1">Objetivo</label>
            <select
              value={form.objetivo}
              onChange={(e) => set('objetivo', e.target.value)}
              className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800 cursor-pointer"
            >
              {objetivos.map((o) => (
                <option key={o} value={o}>{objetivoLabel[o]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-600 mb-1">Data e hora</label>
            <input
              type="datetime-local"
              value={form.dataHora}
              onChange={(e) => set('dataHora', e.target.value)}
              className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800"
            />
            <p className="text-[11px] text-foreground-400 mt-1">Timezone: America/São Paulo (convertido para UTC ao agendar).</p>
          </div>
          {input('Responsável', 'responsavel', 'Ex.: Fabrício')}
          {input('Aprovador', 'aprovador', 'Ex.: Carlos Mendes')}
          {input('Tags (separadas por vírgula)', 'tags', 'lançamento, site')}
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-foreground-600 mb-2">Redes selecionadas *</label>
          <div className="flex flex-wrap gap-2">
            {redesDisponiveis.map((r) => {
              const ativa = form.redes.includes(r);
              const conta = contaDaRede(r);
              return (
                <button
                  key={r}
                  onClick={() => toggleRede(r)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                    ativa
                      ? 'bg-primary-500 border-primary-500 text-background-50'
                      : 'bg-background-50 border-background-300 text-foreground-700 hover:border-background-400'
                  }`}
                >
                  <i className={networkMeta[r].icone}></i>
                  {networkMeta[r].label}
                  {conta && <span className={`text-[10px] ${ativa ? 'opacity-80' : 'text-foreground-400'}`}>· {conta.accountName}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Conteúdo geral */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6 mb-5">
        <h2 className="font-heading font-bold text-foreground-900 mb-4 flex items-center gap-2">
          <i className="ri-edit-line text-primary-600"></i> Conteúdo geral
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {input('Tema', 'tema', 'Sobre o que é a publicação')}
          {input('CTA', 'cta', 'Ex.: Acesse e conheça')}
        </div>
        <div className="mt-4">
          {input('Mensagem-base', 'mensagemBase', 'Texto base que será adaptado para cada rede', 'textarea')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {input('Link', 'link', 'https://...')}
          {input('UTM source', 'utmSource', 'linkedin')}
          {input('UTM medium', 'utmMedium', 'social')}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {input('UTM campaign', 'utmCampaign', 'lancamento_site')}
          {input('Hashtags (vírgula)', 'hashtags', 'wayflex, borracha')}
          {input('Menções (vírgula)', 'mencoes', '@empresa')}
        </div>
      </section>

      {/* Conteúdo por rede */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-bold text-foreground-900 flex items-center gap-2">
            <i className="ri-pages-line text-primary-600"></i> Conteúdo por rede
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={adaptarParaRedes}
              className="px-3 py-2 bg-secondary-100 hover:bg-secondary-200 text-secondary-800 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <i className="ri-layout-line mr-1"></i>Adaptar para cada rede
            </button>
            <button
              onClick={gerarComAna}
              className="px-3 py-2 bg-primary-100 hover:bg-primary-200 text-primary-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <i className="ri-robot-line mr-1"></i>Gerar com Ana
            </button>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground-600 mb-1">LinkedIn</label>
            <textarea
              value={form.linkedin}
              onChange={(e) => set('linkedin', e.target.value)}
              placeholder="Texto específico para LinkedIn"
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-600 mb-1">Instagram (legenda)</label>
            <textarea
              value={form.instagram}
              onChange={(e) => set('instagram', e.target.value)}
              placeholder="Legenda específica para Instagram"
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground-600 mb-1">Facebook</label>
            <textarea
              value={form.facebook}
              onChange={(e) => set('facebook', e.target.value)}
              placeholder="Texto específico para Facebook"
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          </div>
        </div>
      </section>

      {/* Mídia */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6 mb-5">
        <h2 className="font-heading font-bold text-foreground-900 mb-4 flex items-center gap-2">
          <i className="ri-image-line text-primary-600"></i> Mídia
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input
            type="text"
            value={novaMidia.nomeArquivo}
            onChange={(e) => setNovaMidia((m) => ({ ...m, nomeArquivo: e.target.value }))}
            placeholder="Nome do arquivo"
            className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800"
          />
          <select
            value={novaMidia.tipo}
            onChange={(e) => setNovaMidia((m) => ({ ...m, tipo: e.target.value }))}
            className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800 cursor-pointer"
          >
            {tiposMidia.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={novaMidia.altText}
            onChange={(e) => setNovaMidia((m) => ({ ...m, altText: e.target.value }))}
            placeholder="Texto alternativo"
            className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800"
          />
          <button
            onClick={adicionarMidia}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-md text-sm font-semibold cursor-pointer whitespace-nowrap"
          >
            Adicionar
          </button>
        </div>

        {midia.length === 0 ? (
          <p className="text-xs text-foreground-400">Nenhuma mídia adicionada. Upload real disponível após conectar o Storage.</p>
        ) : (
          <div className="space-y-2">
            {midia.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 bg-background-100 rounded-lg">
                <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
                  <i className={`${m.tipo === 'video' ? 'ri-video-line' : 'ri-image-line'} text-primary-600`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground-900 truncate">{m.nomeArquivo}</p>
                  <p className="text-xs text-foreground-500">{m.tipo} {m.altText && `· ${m.altText}`}</p>
                </div>
                <button
                  onClick={() => removerMidia(m.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-foreground-400 hover:text-accent-600 hover:bg-background-200 cursor-pointer"
                >
                  <i className="ri-delete-bin-line"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal de prévia */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setPreview(false)}>
          <div className="bg-background-50 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Prévia da publicação</h3>
              <button onClick={() => setPreview(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {form.redes.length === 0 ? (
                <p className="text-sm text-foreground-500">Selecione ao menos uma rede para visualizar a prévia.</p>
              ) : (
                form.redes.map((r) => {
                  const texto = r === 'LINKEDIN' ? form.linkedin : r === 'INSTAGRAM' ? form.instagram : form.facebook;
                  return (
                    <div key={r} className="border border-background-200/70 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${networkMeta[r].cor}`}>
                          <i className={networkMeta[r].icone}></i>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground-900">{contaDaRede(r)?.accountName || networkMeta[r].label}</p>
                          <p className="text-xs text-foreground-400">{networkMeta[r].label}</p>
                        </div>
                      </div>
                      <p className="text-sm text-foreground-800">{texto || 'Sem conteúdo'}</p>
                      {form.link && <p className="text-xs text-primary-600 mt-2">{form.link}</p>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
