import { useMemo, useState } from 'react';
import { useSocialStore } from '@/hooks/useSocialStore';
import { campanhasSociais } from '@/mocks/socialData';
import type { PostStatus, SocialNetwork, SocialPost } from '@/mocks/socialData';
import { formatarDataHora, networkMeta, objetivoLabel, statusPostMeta } from '@/pages/dashboard/campanhas/socialMeta';

type View = 'mes' | 'semana' | 'lista';

const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function dataStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function diaDaData(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

function inicioSemana(d: Date): Date {
  const dia = d.getDay();
  const diff = (dia + 6) % 7;
  const seg = new Date(d);
  seg.setDate(d.getDate() - diff);
  return seg;
}

export default function CalendarioEditorial() {
  const { posts, atualizarPost, duplicarPost, excluirPost } = useSocialStore();
  const [view, setView] = useState<View>('mes');
  const [mesAtual, setMesAtual] = useState<Date>(() => new Date(2026, 7, 1));
  const [semanaInicio, setSemanaInicio] = useState<Date>(() => inicioSemana(new Date(2026, 7, 19)));
  const [busca, setBusca] = useState('');
  const [filtroRede, setFiltroRede] = useState<'TODOS' | SocialNetwork>('TODOS');
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | PostStatus>('TODOS');
  const [filtroResp, setFiltroResp] = useState('');
  const [filtroCampanha, setFiltroCampanha] = useState('');
  const [detalhe, setDetalhe] = useState<SocialPost | null>(null);
  const [editando, setEditando] = useState<SocialPost | null>(null);
  const [editForm, setEditForm] = useState({ nomeInterno: '', campanha: '', dataHora: '', responsavel: '', mensagemBase: '' });
  const [toast, setToast] = useState('');

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  const postsFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return posts.filter((p) => {
      if (termo && !p.nomeInterno.toLowerCase().includes(termo) && !p.tema.toLowerCase().includes(termo)) return false;
      if (filtroRede !== 'TODOS' && !p.redes.includes(filtroRede)) return false;
      if (filtroStatus !== 'TODOS' && p.status !== filtroStatus) return false;
      if (filtroResp && p.responsavel !== filtroResp) return false;
      if (filtroCampanha && p.campanha !== filtroCampanha) return false;
      return true;
    });
  }, [posts, busca, filtroRede, filtroStatus, filtroResp, filtroCampanha]);

  const responsaveis = useMemo(() => Array.from(new Set(posts.map((p) => p.responsavel))).sort(), [posts]);

  const mudarMes = (delta: number) => {
    setMesAtual((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  const mudarSemana = (delta: number) => {
    setSemanaInicio((s) => {
      const n = new Date(s);
      n.setDate(n.getDate() + delta * 7);
      return n;
    });
  };

  const tituloPeriodo = () => {
    if (view === 'mes') {
      return mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    const fim = new Date(semanaInicio);
    fim.setDate(fim.getDate() + 6);
    return `${semanaInicio.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${fim.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  };

  const abrirDetalhe = (p: SocialPost) => {
    const atual = posts.find((x) => x.id === p.id) || p;
    setDetalhe(atual);
  };

  const cancelarPost = (id: string) => {
    atualizarPost(id, { status: 'CANCELADA' });
    setDetalhe(null);
    mostrarToast('Publicação cancelada.');
  };

  const duplicar = (id: string) => {
    duplicarPost(id);
    setDetalhe(null);
    mostrarToast('Publicação duplicada como rascunho.');
  };

  const aprovarPost = (id: string) => {
    atualizarPost(id, { status: 'APROVADA', aprovadoEm: new Date().toISOString() });
    setDetalhe(null);
    mostrarToast('Publicação aprovada.');
  };

  const rejeitarPost = (id: string) => {
    atualizarPost(id, { status: 'RASCUNHO' });
    setDetalhe(null);
    mostrarToast('Publicação rejeitada e devolvida para rascunho.');
  };

  const excluir = (id: string) => {
    excluirPost(id);
    setDetalhe(null);
    mostrarToast('Publicação excluída.');
  };

  const abrirEdicao = (p: SocialPost) => {
    setEditando(p);
    setEditForm({
      nomeInterno: p.nomeInterno,
      campanha: p.campanha,
      dataHora: p.dataHora ? p.dataHora.slice(0, 16) : '',
      responsavel: p.responsavel,
      mensagemBase: p.mensagemBase,
    });
    setDetalhe(null);
  };

  const salvarEdicao = () => {
    if (!editando) return;
    if (!editForm.nomeInterno.trim()) {
      mostrarToast('Informe o nome interno.');
      return;
    }
    atualizarPost(editando.id, {
      nomeInterno: editForm.nomeInterno.trim(),
      campanha: editForm.campanha,
      dataHora: editForm.dataHora ? `${editForm.dataHora}:00` : editando.dataHora,
      responsavel: editForm.responsavel.trim() || editando.responsavel,
      mensagemBase: editForm.mensagemBase.trim(),
    });
    setEditando(null);
    mostrarToast('Publicação atualizada.');
  };

  // Células do mês
  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const primeiroDia = new Date(ano, mes, 1);
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const celulasMes: (number | null)[] = [];
  for (let i = 0; i < primeiroDia.getDay(); i++) celulasMes.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulasMes.push(d);

  const postsPorDia = (dia: string) => postsFiltrados.filter((p) => diaDaData(p.dataHora) === dia);

  const diasDaSemana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(semanaInicio);
    d.setDate(d.getDate() + i);
    return d;
  });

  const chipRede = (p: SocialPost) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {p.redes.map((r) => (
        <span key={r} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${networkMeta[r].cor}`}>
          <i className={networkMeta[r].icone}></i>
        </span>
      ))}
    </div>
  );

  const renderPostMini = (p: SocialPost) => (
    <button
      key={p.id}
      onClick={() => abrirDetalhe(p)}
      className="w-full text-left px-2 py-1.5 rounded-md border border-background-200/70 bg-background-50 hover:border-background-300 transition-all cursor-pointer mb-1"
    >
      <p className="text-[11px] font-medium text-foreground-800 truncate">{p.nomeInterno}</p>
      <p className="text-[10px] text-foreground-400">{p.dataHora ? p.dataHora.slice(11, 16) : ''}</p>
      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${statusPostMeta[p.status].cor}`}>
        {statusPostMeta[p.status].label}
      </span>
    </button>
  );

  return (
    <div className="wf-page">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-2">Calendário Editorial</h1>
          <p className="text-foreground-600 text-sm">Planeje e acompanhe as publicações por rede, status e responsável.</p>
        </div>
        <div className="flex items-center gap-2 bg-background-100 rounded-full p-1">
          {(['mes', 'semana', 'lista'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                view === v ? 'bg-background-50 text-foreground-900 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'
              }`}
            >
              {v === 'mes' ? 'Mês' : v === 'semana' ? 'Semana' : 'Lista'}
            </button>
          ))}
        </div>
      </div>

      {toast && (
        <div className="mb-4 bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      {/* Filtros */}
      <div className="mb-5 bg-background-50 border border-background-200/70 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-1">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar publicação..."
              className="w-full pl-9 pr-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800"
            />
          </div>
          <select
            value={filtroRede}
            onChange={(e) => setFiltroRede(e.target.value as 'TODOS' | SocialNetwork)}
            className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800 cursor-pointer"
          >
            <option value="TODOS">Todas as redes</option>
            <option value="LINKEDIN">LinkedIn</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="FACEBOOK">Facebook</option>
          </select>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as 'TODOS' | PostStatus)}
            className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800 cursor-pointer"
          >
            <option value="TODOS">Todos os status</option>
            {Object.entries(statusPostMeta).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={filtroResp}
            onChange={(e) => setFiltroResp(e.target.value)}
            className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800 cursor-pointer"
          >
            <option value="">Todos os responsáveis</option>
            {responsaveis.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={filtroCampanha}
            onChange={(e) => setFiltroCampanha(e.target.value)}
            className="w-full px-3 py-2 bg-background-50 border border-background-300 rounded-md text-sm text-foreground-800 cursor-pointer"
          >
            <option value="">Todas as campanhas</option>
            {campanhasSociais.map((c) => (
              <option key={c.id} value={c.nome}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Navegação do período */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => (view === 'mes' ? mudarMes(-1) : view === 'semana' ? mudarSemana(-1) : undefined)}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-700 cursor-pointer"
        >
          <i className="ri-arrow-left-s-line"></i>
        </button>
        <h2 className="font-heading font-bold text-foreground-900 text-base capitalize">{tituloPeriodo()}</h2>
        <button
          onClick={() => (view === 'mes' ? mudarMes(1) : view === 'semana' ? mudarSemana(1) : undefined)}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-700 cursor-pointer"
        >
          <i className="ri-arrow-right-s-line"></i>
        </button>
      </div>

      {/* Mês */}
      {view === 'mes' && (
        <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-background-200/70 bg-background-100/50">
            {diasSemana.map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-foreground-500">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {celulasMes.map((dia, i) => {
              if (dia === null) {
                return <div key={`blank-${i}`} className="min-h-[96px] border-r border-b border-background-100 bg-background-50/40"></div>;
              }
              const diaStr = dataStr(ano, mes, dia);
              const doDia = postsPorDia(diaStr);
              return (
                <div key={dia} className="min-h-[96px] border-r border-b border-background-100 p-1.5">
                  <span className="text-xs font-medium text-foreground-500">{dia}</span>
                  <div className="mt-1 space-y-1">
                    {doDia.slice(0, 3).map((p) => renderPostMini(p))}
                    {doDia.length > 3 && (
                      <button
                        onClick={() => mostrarToast(`${doDia.length - 3} publicação(ões) adicional(is) — use a visão de lista.`)}
                        className="text-[10px] text-primary-600 cursor-pointer px-2"
                      >
                        +{doDia.length - 3}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Semana */}
      {view === 'semana' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {diasDaSemana.map((d) => {
            const diaStr = dataStr(d.getFullYear(), d.getMonth(), d.getDate());
            const doDia = postsPorDia(diaStr);
            const hoje = dataStr(2026, 7, 19);
            return (
              <div key={diaStr} className={`bg-background-50 border rounded-xl p-3 ${diaStr === hoje ? 'border-primary-300' : 'border-background-200/70'}`}>
                <div className="text-center mb-2">
                  <p className="text-[10px] uppercase text-foreground-400 font-medium">{diasSemana[d.getDay()]}</p>
                  <p className="text-lg font-heading font-bold text-foreground-900">{d.getDate()}</p>
                </div>
                <div className="space-y-1">
                  {doDia.map((p) => renderPostMini(p))}
                  {doDia.length === 0 && <p className="text-[10px] text-foreground-300 text-center py-2">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista */}
      {view === 'lista' && (
        <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-background-200/70 bg-background-100/50">
                  <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Publicação</th>
                  <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Rede</th>
                  <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Data/hora</th>
                  <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs">Status</th>
                  <th className="text-left px-4 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {postsFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-foreground-400 text-sm">
                      Nenhuma publicação encontrada.
                    </td>
                  </tr>
                ) : (
                  postsFiltrados.map((p) => (
                    <tr key={p.id} className="border-b border-background-100 hover:bg-background-50/50 cursor-pointer" onClick={() => abrirDetalhe(p)}>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-foreground-900">{p.nomeInterno}</p>
                        <p className="text-xs text-foreground-500">{p.campanha} · {objetivoLabel[p.objetivo]}</p>
                      </td>
                      <td className="px-4 py-3.5">{chipRede(p)}</td>
                      <td className="px-4 py-3.5 text-foreground-600">{formatarDataHora(p.dataHora)}</td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${statusPostMeta[p.status].cor}`}>
                          {statusPostMeta[p.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-foreground-600 hidden md:table-cell">{p.responsavel}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de detalhe */}
      {detalhe && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-start justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">{detalhe.nomeInterno}</h3>
                <p className="text-sm text-foreground-500">{detalhe.campanha}</p>
              </div>
              <button onClick={() => setDetalhe(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${statusPostMeta[detalhe.status].cor}`}>
                  {statusPostMeta[detalhe.status].label}
                </span>
                {detalhe.redes.map((r) => (
                  <span key={r} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${networkMeta[r].cor}`}>
                    <i className={networkMeta[r].icone}></i>
                    {networkMeta[r].label}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-foreground-500 text-xs">Data/hora</p>
                  <p className="text-foreground-900">{formatarDataHora(detalhe.dataHora)}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Objetivo</p>
                  <p className="text-foreground-900">{objetivoLabel[detalhe.objetivo]}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Responsável</p>
                  <p className="text-foreground-900">{detalhe.responsavel}</p>
                </div>
                <div>
                  <p className="text-foreground-500 text-xs">Aprovador</p>
                  <p className="text-foreground-900">{detalhe.aprovador || '—'}</p>
                </div>
              </div>

              <div>
                <p className="text-foreground-500 text-xs mb-1">Conteúdo</p>
                <div className="space-y-2">
                  {detalhe.redes.map((r) => {
                    const texto = detalhe.conteudoPorRede[r];
                    if (!texto) return null;
                    return (
                      <div key={r} className="bg-background-100 rounded-lg p-3">
                        <p className="text-[10px] uppercase text-foreground-400 font-semibold mb-1">{networkMeta[r].label}</p>
                        <p className="text-sm text-foreground-800">{texto}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {detalhe.erro && (
                <div className="bg-accent-500/10 border border-accent-300 text-accent-700 rounded-lg p-3 text-sm flex items-start gap-2">
                  <i className="ri-error-warning-line mt-0.5"></i>
                  <span><strong>Falha:</strong> {detalhe.erro} <span className="text-xs">({detalhe.tentativas} tentativa(s))</span></span>
                </div>
              )}

              <div className="pt-3 border-t border-background-200/70 flex justify-end gap-2 flex-wrap">
                {detalhe.status === 'AGUARDANDO_APROVACAO' && (
                  <>
                    <button
                      onClick={() => rejeitarPost(detalhe.id)}
                      className="px-4 py-2 border border-background-300 text-foreground-700 hover:bg-background-100 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
                    >
                      Rejeitar
                    </button>
                    <button
                      onClick={() => aprovarPost(detalhe.id)}
                      className="inline-flex items-center gap-1 px-4 py-2 bg-secondary-500 hover:bg-secondary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-check-line"></i>Aprovar
                    </button>
                  </>
                )}
                {detalhe.status !== 'PUBLICADA' && detalhe.status !== 'CANCELADA' && (
                  <button
                    onClick={() => cancelarPost(detalhe.id)}
                    className="px-4 py-2 border border-background-300 text-foreground-700 hover:bg-background-100 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Cancelar
                  </button>
                )}
                {detalhe.status !== 'PUBLICADA' && (
                  <button
                    onClick={() => abrirEdicao(detalhe)}
                    className="inline-flex items-center gap-1 px-4 py-2 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-edit-line"></i>Editar
                  </button>
                )}
                <button
                  onClick={() => duplicar(detalhe.id)}
                  className="px-4 py-2 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
                >
                  Duplicar
                </button>
                <button
                  onClick={() => excluir(detalhe.id)}
                  className="inline-flex items-center gap-1 px-4 py-2 text-accent-600 hover:bg-accent-50 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-delete-bin-6-line"></i>Excluir
                </button>
                <button
                  onClick={() => setDetalhe(null)}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar publicação */}
      {editando && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setEditando(null)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Editar publicação</h3>
              <button onClick={() => setEditando(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome interno</label>
                <input type="text" value={editForm.nomeInterno} onChange={(e) => setEditForm({ ...editForm, nomeInterno: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Campanha</label>
                <select value={editForm.campanha} onChange={(e) => setEditForm({ ...editForm, campanha: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  {campanhasSociais.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Data e hora</label>
                  <input type="datetime-local" value={editForm.dataHora} onChange={(e) => setEditForm({ ...editForm, dataHora: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Responsável</label>
                  <input type="text" value={editForm.responsavel} onChange={(e) => setEditForm({ ...editForm, responsavel: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Mensagem-base</label>
                <textarea value={editForm.mensagemBase} onChange={(e) => setEditForm({ ...editForm, mensagemBase: e.target.value })} rows={4} maxLength={500} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setEditando(null)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvarEdicao} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
