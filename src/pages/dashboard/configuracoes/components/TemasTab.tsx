import { useState } from 'react';
import { useTemasStore, type Tema, type TemaCores } from '@/hooks/useTemasStore';

interface FormState {
  nome: string;
  descricao: string;
  primaria: string;
  secundaria: string;
  texto: string;
  assinatura: string;
  padrao: boolean;
}

const formVazio = (): FormState => ({
  nome: '',
  descricao: '',
  primaria: '#168654',
  secundaria: '#14151A',
  texto: '#14151A',
  assinatura: 'Equipe Wayflex',
  padrao: false,
});

export default function TemasTab() {
  const { temas, atualizar, adicionar, excluir, definirPadrao } = useTemasStore();
  const [toast, setToast] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Tema | null>(null);
  const [form, setForm] = useState<FormState>(formVazio());

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm(formVazio());
    setModalAberto(true);
  };

  const abrirEdicao = (t: Tema) => {
    setEditando(t);
    setForm({
      nome: t.nome,
      descricao: t.descricao,
      primaria: t.cores.primaria,
      secundaria: t.cores.secundaria,
      texto: t.cores.texto,
      assinatura: t.assinatura,
      padrao: t.padrao,
    });
    setModalAberto(true);
  };

  const salvar = () => {
    if (!form.nome.trim()) {
      mostrarToast('Dê um nome ao tema.');
      return;
    }
    const cores: TemaCores = { primaria: form.primaria, secundaria: form.secundaria, texto: form.texto };
    const base = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
      cores,
      assinatura: form.assinatura.trim(),
      padrao: form.padrao,
    };
    if (editando) {
      atualizar(editando.id, base);
      mostrarToast('Tema atualizado.');
    } else {
      adicionar({ id: `tm-${Date.now()}`, ...base, logoUrl: '' });
      mostrarToast('Tema criado.');
    }
    setModalAberto(false);
  };

  const excluirTema = (t: Tema) => {
    excluir(t.id);
    mostrarToast(`Tema "${t.nome}" excluído.`);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 text-sm">
        <p className="font-semibold text-primary-800 flex items-center gap-2">
          <i className="ri-palette-line"></i>
          Temas e assinatura visual
        </p>
        <p className="mt-1.5 text-primary-700 leading-relaxed">
          Cores, logo e assinatura padrão aplicados a <b>propostas</b> e <b>documentos</b> com 1 clique.
          O tema marcado como <b>padrão</b> é usado automaticamente ao gerar o PDF de qualquer orçamento.
        </p>
      </div>

      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Temas</h3>
            <p className="text-xs text-foreground-500">Identidade visual das suas propostas e documentos.</p>
          </div>
          <button
            onClick={abrirNovo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Novo tema
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {temas.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border overflow-hidden ${t.padrao ? 'border-secondary-400 ring-1 ring-secondary-300' : 'border-background-200/70'}`}
            >
              {/* Faixa de cores */}
              <div className="h-16 flex items-center justify-between px-4" style={{ backgroundColor: t.cores.primaria }}>
                <span className="text-white font-bold text-sm truncate" style={{ color: '#fff' }}>{t.nome}</span>
                <span className="flex gap-1.5">
                  <span className="w-5 h-5 rounded-full border border-white/40" style={{ backgroundColor: t.cores.secundaria }}></span>
                  <span className="w-5 h-5 rounded-full border border-white/40" style={{ backgroundColor: t.cores.texto }}></span>
                </span>
              </div>
              <div className="p-4">
                <p className="text-sm font-medium text-foreground-900">{t.nome}</p>
                <p className="text-xs text-foreground-500 mt-0.5 min-h-[32px]">{t.descricao}</p>
                <p className="text-[11px] text-foreground-400 mt-2 font-mono">
                  {t.cores.primaria} · {t.cores.secundaria}
                </p>
                <div className="flex items-center justify-between mt-3">
                  {t.padrao ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-secondary-700">
                      <i className="ri-check-double-line"></i> Padrão
                    </span>
                  ) : (
                    <button
                      onClick={() => { definirPadrao(t.id); mostrarToast(`"${t.nome}" agora é o padrão.`); }}
                      className="text-xs font-semibold text-foreground-500 hover:text-primary-700 cursor-pointer whitespace-nowrap"
                    >
                      Tornar padrão
                    </button>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => abrirEdicao(t)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer"
                      title="Editar"
                    >
                      <i className="ri-edit-line"></i>
                    </button>
                    <button
                      onClick={() => excluirTema(t)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-accent-50 text-accent-600 cursor-pointer"
                      title="Excluir"
                    >
                      <i className="ri-delete-bin-6-line"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {temas.length === 0 && (
            <p className="col-span-full text-center text-foreground-400 text-sm py-8">
              Nenhum tema ainda. Crie o primeiro para dar identidade às suas propostas.
            </p>
          )}
        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setModalAberto(false)}>
          <div className="bg-background-50 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between sticky top-0 bg-background-50 z-10">
              <h3 className="font-heading font-bold text-foreground-950">{editando ? 'Editar tema' : 'Novo tema'}</h3>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome</label>
                <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="ex.: Clássico corporativo" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Descrição</label>
                <input type="text" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Para que tipo de proposta serve?" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Cor primária</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.primaria} onChange={(e) => setForm({ ...form, primaria: e.target.value })} className="w-10 h-10 rounded-lg border border-background-300 cursor-pointer bg-transparent p-0.5" />
                    <input type="text" value={form.primaria} onChange={(e) => setForm({ ...form, primaria: e.target.value })} className="flex-1 px-3 py-2 bg-background-50 border border-background-300 rounded-lg text-sm font-mono text-foreground-900" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Cor secundária</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.secundaria} onChange={(e) => setForm({ ...form, secundaria: e.target.value })} className="w-10 h-10 rounded-lg border border-background-300 cursor-pointer bg-transparent p-0.5" />
                    <input type="text" value={form.secundaria} onChange={(e) => setForm({ ...form, secundaria: e.target.value })} className="flex-1 px-3 py-2 bg-background-50 border border-background-300 rounded-lg text-sm font-mono text-foreground-900" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Cor do texto</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} className="w-10 h-10 rounded-lg border border-background-300 cursor-pointer bg-transparent p-0.5" />
                    <input type="text" value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} className="flex-1 px-3 py-2 bg-background-50 border border-background-300 rounded-lg text-sm font-mono text-foreground-900" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Assinatura padrão</label>
                <input type="text" value={form.assinatura} onChange={(e) => setForm({ ...form, assinatura: e.target.value })} placeholder="ex.: Equipe Wayflex" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <label className="flex items-center gap-2.5 text-sm text-foreground-700 cursor-pointer">
                <input type="checkbox" checked={form.padrao} onChange={(e) => setForm({ ...form, padrao: e.target.checked })} className="accent-[oklch(var(--secondary-500))] cursor-pointer" />
                Usar como tema padrão
              </label>

              <div className="bg-background-100/70 border border-background-200/70 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b-2" style={{ borderColor: form.primaria }}>
                  <p className="font-bold" style={{ color: form.primaria }}>{form.nome || 'Nome do tema'}</p>
                  <p className="text-xs" style={{ color: form.texto }}>Proposta comercial</p>
                </div>
                <div className="p-4">
                  <p className="text-sm font-semibold" style={{ color: form.texto }}>Carlos Mendes — Tech Solutions Ltda</p>
                  <p className="text-xs mt-1" style={{ color: form.secundaria }}>Assinatura: {form.assinatura || '—'}</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvar} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">
                {editando ? 'Salvar' : 'Criar tema'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
