import { useState } from 'react';
import {
  useTemplatesDocumentoStore,
  TIPOS_DOCUMENTO,
  rotuloTipoDocumento,
  type TemplateDocumento,
  type TipoDocumento,
} from '@/hooks/useTemplatesDocumentoStore';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import { useVariaveisGlobaisStore } from '@/hooks/useVariaveisGlobaisStore';
import { montarValoresVariaveis, resolverVariaveis } from '@/lib/variaveis';

const formVazio = { nome: '', tipo: 'contrato' as TipoDocumento, conteudo: '' };

export default function TemplatesDocumentoTab() {
  const { templates, atualizar, adicionar, excluir } = useTemplatesDocumentoStore();
  const { settings: { organizacao } } = useEmpresaSettingsStore();
  const { variaveis } = useVariaveisGlobaisStore();
  const [toast, setToast] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<TemplateDocumento | null>(null);
  const [form, setForm] = useState(formVazio);
  const [previaAberta, setPreviaAberta] = useState(false);

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm(formVazio);
    setPreviaAberta(false);
    setModalAberto(true);
  };

  const abrirEdicao = (t: TemplateDocumento) => {
    setEditando(t);
    setForm({ nome: t.nome, tipo: t.tipo, conteudo: t.conteudo });
    setPreviaAberta(false);
    setModalAberto(true);
  };

  const extrairVariaveis = (texto: string): string[] => {
    const unicas = new Set<string>();
    const re = /\{(\w+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
      unicas.add(m[1]);
    }
    return Array.from(unicas);
  };

  const salvar = () => {
    if (!form.nome.trim() || !form.conteudo.trim()) {
      mostrarToast('Preencha o nome e o conteúdo do documento.');
      return;
    }
    const variaveis = extrairVariaveis(form.conteudo);
    if (editando) {
      atualizar(editando.id, { nome: form.nome.trim(), tipo: form.tipo, conteudo: form.conteudo.trim(), variaveis });
      mostrarToast('Documento atualizado.');
    } else {
      adicionar({ id: `td-${Date.now()}`, nome: form.nome.trim(), tipo: form.tipo, conteudo: form.conteudo.trim(), variaveis, ativo: true });
      mostrarToast('Documento criado.');
    }
    setModalAberto(false);
  };

  const toggleAtivo = (t: TemplateDocumento) => {
    atualizar(t.id, { ativo: !t.ativo });
  };

  const excluirTemplate = (t: TemplateDocumento) => {
    excluir(t.id);
    mostrarToast(`Documento "${t.nome}" excluído.`);
  };

  const valores = montarValoresVariaveis({
    lead: { nome: 'Carlos Mendes', empresa: 'Tech Solutions Ltda' },
    organizacao,
    customVars: variaveis,
  });
  valores.validade = '30/09/2026';
  valores.forma_pagamento = '50% na assinatura e 50% na entrega';
  valores.garantia = 'Garantia de 90 dias';
  valores.valor_total = 'R$ 6.100,00';
  valores.data_hoje = new Date().toLocaleDateString('pt-BR');
  const previa = resolverVariaveis(form.conteudo, valores);

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
          <i className="ri-file-copy-2-line"></i>
          Templates de documentos
        </p>
        <p className="mt-1.5 text-primary-700 leading-relaxed">
          Contratos, NDA, termos, checklists e recibos com variáveis. Ao aceitar uma proposta em
          Orçamentos, você pode gerar um documento a partir desses templates. Use{' '}
          <code className="bg-background-50 border border-primary-200 px-1.5 py-0.5 rounded text-xs font-mono">{'{nome}'}</code>,{' '}
          <code className="bg-background-50 border border-primary-200 px-1.5 py-0.5 rounded text-xs font-mono">{'{empresa}'}</code> e demais variáveis.
        </p>
      </div>

      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Documentos</h3>
            <p className="text-xs text-foreground-500">Modelos de documentos com variáveis.</p>
          </div>
          <button
            onClick={abrirNovo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Novo documento
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Nome</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Tipo</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Variáveis</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Ativo</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-24"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5 font-medium text-foreground-900">{t.nome}</td>
                  <td className="px-6 py-3.5">
                    <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-secondary-100 text-secondary-800">
                      {rotuloTipoDocumento(t.tipo)}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {t.variaveis.slice(0, 4).map((v) => (
                        <span key={v} className="px-1.5 py-0.5 rounded bg-background-100 text-foreground-500 font-mono text-[11px]">{'{'}{v}{'}'}</span>
                      ))}
                      {t.variaveis.length > 4 && <span className="text-xs text-foreground-400">+{t.variaveis.length - 4}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <button
                      onClick={() => toggleAtivo(t)}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${t.ativo ? 'bg-primary-500' : 'bg-background-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${t.ativo ? 'translate-x-5' : ''}`}></span>
                    </button>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => abrirEdicao(t)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer"
                        title="Editar"
                      >
                        <i className="ri-edit-line"></i>
                      </button>
                      <button
                        onClick={() => excluirTemplate(t)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-accent-50 text-accent-600 cursor-pointer"
                        title="Excluir"
                      >
                        <i className="ri-delete-bin-6-line"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-foreground-400 text-sm">
                    Nenhum documento cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setModalAberto(false)}>
          <div className="bg-background-50 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between sticky top-0 bg-background-50 z-10">
              <h3 className="font-heading font-bold text-foreground-950">{editando ? 'Editar documento' : 'Novo documento'}</h3>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome</label>
                  <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="ex.: Contrato de prestação de serviços" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoDocumento })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                    {TIPOS_DOCUMENTO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Conteúdo</label>
                <textarea
                  value={form.conteudo}
                  onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                  rows={10}
                  placeholder="Escreva o documento. Use {nome}, {empresa}, {assinatura}..."
                  className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 resize-none font-mono text-[13px] leading-relaxed"
                />
              </div>

              <button
                onClick={() => setPreviaAberta(!previaAberta)}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 cursor-pointer"
              >
                <i className={previaAberta ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                {previaAberta ? 'Ocultar' : 'Ver'} pré-visualização (lead de teste)
              </button>
              {previaAberta && (
                <div className="bg-background-100/70 border border-background-200/70 rounded-lg p-4">
                  <p className="text-sm text-foreground-800 leading-relaxed whitespace-pre-line">{previa}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvar} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">
                {editando ? 'Salvar' : 'Criar documento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
