import { useState } from 'react';
import { useFontesStore } from '@/hooks/useFontesStore';
import type { FonteLead } from '@/hooks/useFontesStore';
import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

const statusCores: Record<string, string> = {
  ativo: 'bg-primary-100 text-primary-700',
  pendente: 'bg-accent-100 text-accent-700',
  inativo: 'bg-background-200 text-foreground-500',
  erro: 'bg-accent-100 text-accent-700',
};

const tipoIcones: Record<string, string> = {
  API: 'ri-cloud-line',
  CSV: 'ri-file-upload-line',
  webhook: 'ri-webhook-line',
  formulario: 'ri-survey-line',
  manual: 'ri-user-line',
};

const tipos = ['API', 'CSV', 'webhook', 'formulario', 'manual'];

export default function FontesTab() {
  const { fontes, atualizar, definirAtivacao, recarregar, adicionar, excluir } = useFontesStore();
  const [toast, setToast] = useState('');
  const [testando, setTestando] = useState<string | null>(null);
  const [alterando, setAlterando] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<FonteLead | null>(null);
  const [form, setForm] = useState({ nome: '', tipo: 'API', endpoint: '', mapeamento: '' });

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const testarFonte = async (id: string) => {
    const fonte = fontes.find((item) => item.id === id);
    setTestando(id);
    if (fonte?.sourceKey === 'apify' || fonte?.sourceKey === 'google_places') {
      const { data, error } = await supabase.functions.invoke('testar-integracao', { body: { canal: fonte.sourceKey } });
      setTestando(null);
      if (error || !data?.pronto) {
        const detalhe = error ? await detalheDoErroDeFuncao(error) : data?.erro;
        const mensagem = detalhe === 'integration_credentials_missing'
          ? 'configure e salve as credenciais em Canais e integrações.'
          : detalhe === 'provider_error'
            ? 'o provedor recusou o teste. Confira a chave e as permissões.'
            : detalhe || 'configure as credenciais em Canais e integrações.';
        mostrarToast(`Não foi possível validar ${fonte.nome}: ${mensagem}`);
      } else {
        await recarregar();
        mostrarToast(`${fonte.nome} validada e disponível no Modo Real.`);
      }
      return;
    }
    setTimeout(() => { setTestando(null); mostrarToast('Esta fonte ainda não possui teste de provedor conectado.'); }, 700);
  };

  const toggleStatus = async (id: string) => {
    const f = fontes.find((x) => x.id === id);
    if (!f) return;
    const ativar = f.status !== 'ativo';
    setAlterando(id);
    try {
      await definirAtivacao(id, ativar);
      mostrarToast(ativar ? `${f.nome} ativada para a Busca de Leads.` : `${f.nome} desativada. Ela não aparecerá na Busca de Leads.`);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      mostrarToast(code === 'source_not_validated'
        ? `${f.nome} precisa ser configurada e passar no teste antes de ser ativada.`
        : 'Não foi possível alterar o status da fonte. Tente novamente.');
    } finally {
      setAlterando(null);
    }
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: '', tipo: 'API', endpoint: '', mapeamento: '' });
    setModalAberto(true);
  };

  const abrirEdicao = (f: FonteLead) => {
    setEditando(f);
    setForm({ nome: f.nome, tipo: f.tipo, endpoint: f.endpoint, mapeamento: f.mapeamento });
    setModalAberto(true);
  };

  const salvar = () => {
    if (!form.nome.trim()) {
      mostrarToast('Informe o nome da fonte.');
      return;
    }
    if (editando) {
      atualizar(editando.id, {
        nome: form.nome.trim(),
        tipo: form.tipo,
        endpoint: form.endpoint.trim(),
        mapeamento: form.mapeamento.trim(),
      });
      mostrarToast('Fonte atualizada.');
    } else {
      adicionar({
        id: `f-${Date.now()}`,
        nome: form.nome.trim(),
        tipo: form.tipo,
        status: 'ativo',
        endpoint: form.endpoint.trim() || '—',
        ultimaSincronizacao: '—',
        leadsImportados: 0,
        erros: 0,
        mapeamento: form.mapeamento.trim(),
        tagsPadrao: [],
      });
      mostrarToast('Fonte criada.');
    }
    setModalAberto(false);
  };

  const excluirFonte = (f: FonteLead) => {
    excluir(f.id);
    mostrarToast(`Fonte "${f.nome}" excluída.`);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      <div className="bg-secondary-50 border border-secondary-200 text-secondary-800 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
        <i className="ri-information-line"></i>
        <span>Configure e teste em Canais e integrações. Somente fontes validadas e ativas aparecem na Busca de Leads.</span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground-600">{fontes.length} fontes configuradas.</p>
        <button
          onClick={abrirNovo}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <i className="ri-add-line"></i>
          Nova fonte
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {fontes.map((f) => (
          <div key={f.id} className="bg-background-50 border border-background-200/70 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
                <i className={`${tipoIcones[f.tipo]} text-primary-600`}></i>
              </div>
              <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${statusCores[f.status]}`}>
                {f.status === 'ativo' ? 'Ativo' : f.status === 'erro' ? 'Erro' : f.status === 'pendente' ? 'Pendente' : 'Inativo'}
              </span>
            </div>
            <h4 className="font-heading font-bold text-foreground-900 text-sm mb-1 truncate" title={f.nome}>{f.nome}</h4>
            <p className="text-xs text-foreground-500 truncate" title={f.mapeamento}>{f.tipo} · {f.mapeamento}</p>
            <div className="flex items-center gap-3 text-xs text-foreground-500 my-3">
              <span><strong className="text-foreground-800">{f.leadsImportados.toLocaleString()}</strong> leads</span>
              {f.erros > 0 && <span className="text-accent-600"><strong>{f.erros}</strong> erros</span>}
              <span className="ml-auto text-[11px] text-foreground-400">{f.ultimaSincronizacao === '—' ? 'Sem teste' : f.ultimaSincronizacao}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => testarFonte(f.id)}
                disabled={testando === f.id}
                className="flex-1 px-3 py-1.5 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {testando === f.id ? (
                  <span className="inline-flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-foreground-300 border-t-foreground-700 rounded-full animate-spin"></div>
                    Testando...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <i className="ri-refresh-line"></i> Testar
                  </span>
                )}
              </button>
              <button
                onClick={() => void toggleStatus(f.id)}
                disabled={alterando === f.id}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  f.status === 'ativo' ? 'bg-accent-100 hover:bg-accent-200 text-accent-800' : 'bg-primary-500 hover:bg-primary-600 text-background-50'
                }`}
              >
                {alterando === f.id ? 'Salvando...' : f.status === 'ativo' ? 'Desativar' : 'Ativar'}
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => abrirEdicao(f)}
                className="flex-1 px-3 py-1.5 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <i className="ri-edit-line mr-1"></i> Editar
              </button>
              <button
                onClick={() => excluirFonte(f)}
                className="flex-1 px-3 py-1.5 bg-background-100 hover:bg-accent-50 text-accent-600 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <i className="ri-delete-bin-6-line mr-1"></i> Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal nova/editar fonte */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setModalAberto(false)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">{editando ? 'Editar fonte' : 'Nova fonte'}</h3>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome</label>
                <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Receita Federal" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Tipo</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Endpoint</label>
                <input type="text" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="https://..." className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Mapeamento de campos</label>
                <input type="text" value={form.mapeamento} onChange={(e) => setForm({ ...form, mapeamento: e.target.value })} placeholder="CNPJ, Razão Social, UF..." className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvar} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">
                {editando ? 'Salvar' : 'Criar fonte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
