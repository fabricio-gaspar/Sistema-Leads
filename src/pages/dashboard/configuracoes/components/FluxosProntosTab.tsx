import { useState } from 'react';
import AutocompleteTextarea from '@/components/feature/AutocompleteTextarea';
import {
  useFluxosAutomatizacaoStore,
  GATILHOS_FLUXO,
  rotuloGatilho,
  type FluxoAutomatizacao,
  type PassoFluxo,
} from '@/hooks/useFluxosAutomatizacaoStore';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import { useVariaveisGlobaisStore } from '@/hooks/useVariaveisGlobaisStore';
import { montarValoresVariaveis, resolverVariaveis } from '@/lib/variaveis';

const CANAIS = ['WhatsApp', 'E-mail'];

interface FormState {
  nome: string;
  gatilho: string;
  descricao: string;
  passos: PassoFluxo[];
}

const formVazio = (): FormState => ({
  nome: '',
  gatilho: 'novo_lead',
  descricao: '',
  passos: [{ id: `p-${Date.now()}`, diasApos: 0, canal: 'WhatsApp', mensagem: '' }],
});

export default function FluxosProntosTab() {
  const { fluxos, atualizar, adicionar, excluir } = useFluxosAutomatizacaoStore();
  const { settings: { organizacao } } = useEmpresaSettingsStore();
  const { variaveis } = useVariaveisGlobaisStore();
  const [toast, setToast] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<FluxoAutomatizacao | null>(null);
  const [form, setForm] = useState<FormState>(formVazio());
  const [previaId, setPreviaId] = useState<string | null>(null);

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm(formVazio());
    setModalAberto(true);
  };

  const abrirEdicao = (f: FluxoAutomatizacao) => {
    setEditando(f);
    setForm({ nome: f.nome, gatilho: f.gatilho, descricao: f.descricao, passos: f.passos });
    setModalAberto(true);
  };

  const salvar = () => {
    if (!form.nome.trim()) {
      mostrarToast('Dê um nome ao fluxo.');
      return;
    }
    if (form.passos.some((p) => !p.mensagem.trim())) {
      mostrarToast('Preencha a mensagem de todos os passos.');
      return;
    }
    const passos = [...form.passos].sort((a, b) => a.diasApos - b.diasApos);
    const base = {
      nome: form.nome.trim(),
      gatilho: form.gatilho,
      descricao: form.descricao.trim(),
      passos,
    };
    if (editando) {
      atualizar(editando.id, base);
      mostrarToast('Fluxo atualizado.');
    } else {
      adicionar({ id: crypto.randomUUID(), ...base, ativo: false });
      mostrarToast('Fluxo criado.');
    }
    setModalAberto(false);
  };

  const toggleAtivo = (f: FluxoAutomatizacao) => {
    atualizar(f.id, { ativo: !f.ativo });
    mostrarToast(f.ativo ? `Fluxo "${f.nome}" desativado.` : `Fluxo "${f.nome}" ativado.`);
  };

  const excluirFluxo = (f: FluxoAutomatizacao) => {
    excluir(f.id);
    mostrarToast(`Fluxo "${f.nome}" excluído.`);
  };

  const addPasso = () => {
    setForm((prev) => ({
      ...prev,
      passos: [...prev.passos, { id: `p-${Date.now()}`, diasApos: 1, canal: 'WhatsApp', mensagem: '' }],
    }));
  };

  const editarPasso = (id: string, mudanca: Partial<PassoFluxo>) => {
    setForm((prev) => ({
      ...prev,
      passos: prev.passos.map((p) => (p.id === id ? { ...p, ...mudanca } : p)),
    }));
  };

  const removerPasso = (id: string) => {
    setForm((prev) => ({ ...prev, passos: prev.passos.filter((p) => p.id !== id) }));
  };

  // Pré-visualização com lead de teste + dados da empresa + variáveis globais.
  const valores = montarValoresVariaveis({
    lead: { nome: 'Lead de demonstração', empresa: 'Empresa de demonstração', oferta: 'solução industrial' },
    organizacao,
    customVars: variaveis,
  });
  valores.validade = '30/09/2026';

  const fluxosAtivos = fluxos.filter((f) => f.ativo).length;

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
          <i className="ri-flow-chart"></i>
          Fluxos de automação prontos
        </p>
        <p className="mt-1.5 text-primary-700 leading-relaxed">
          Sequências prontas (boas-vindas, follow-up pós-orçamento, reativação, aniversário) já com as
          mensagens preenchidas e editáveis. Ative um fluxo e ele <b>monta as mensagens automaticamente</b>
          conforme o gatilho, com as variáveis {'{nome}'}, {'{empresa}'} e {'{assinatura}'} resolvidas.
          <span className="ml-1 font-semibold">{fluxosAtivos} de {fluxos.length} ativos</span>.
        </p>
      </div>

      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Fluxos</h3>
            <p className="text-xs text-foreground-500">Sequências de mensagens com gatilho, timing e canal.</p>
          </div>
          <button
            onClick={abrirNovo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Novo fluxo
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
          {fluxos.map((f) => (
            <div key={f.id} className={`rounded-xl border p-4 ${f.ativo ? 'border-primary-300 bg-primary-50/40' : 'border-background-200/70 bg-background-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground-900 text-sm">{f.nome}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-secondary-100 text-secondary-800">
                    {rotuloGatilho(f.gatilho)}
                  </span>
                </div>
                <button
                  onClick={() => toggleAtivo(f)}
                  className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 cursor-pointer ${f.ativo ? 'bg-primary-500' : 'bg-background-300'}`}
                  title={f.ativo ? 'Desativar' : 'Ativar'}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${f.ativo ? 'translate-x-5' : ''}`}></span>
                </button>
              </div>
              <p className="text-xs text-foreground-500 mt-2 min-h-[32px]">{f.descricao}</p>
              <div className="mt-3 space-y-1.5">
                {f.passos.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs text-foreground-600">
                    <span className="w-14 flex-shrink-0 font-medium text-foreground-500">
                      {p.diasApos === 0 ? 'Imediato' : `Dia ${p.diasApos}`}
                    </span>
                    <span className="w-16 flex-shrink-0 text-foreground-500">{p.canal}</span>
                    <span className="truncate flex-1 text-foreground-400">{p.mensagem}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-background-100">
                <button
                  onClick={() => setPreviaId(previaId === f.id ? null : f.id)}
                  className="px-2.5 py-1.5 bg-background-100 hover:bg-background-200 text-foreground-600 rounded-md text-xs cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-eye-line mr-1"></i>Ver mensagens
                </button>
                <button
                  onClick={() => abrirEdicao(f)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer"
                  title="Editar"
                >
                  <i className="ri-edit-line"></i>
                </button>
                <button
                  onClick={() => excluirFluxo(f)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-accent-50 text-accent-600 cursor-pointer"
                  title="Excluir"
                >
                  <i className="ri-delete-bin-6-line"></i>
                </button>
              </div>

              {previaId === f.id && (
                <div className="mt-3 bg-background-100 rounded-lg p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-foreground-500 uppercase tracking-wide">Mensagens resolvidas (lead de teste)</p>
                  {f.passos.map((p) => (
                    <div key={p.id} className="bg-background-50 rounded-lg px-3 py-2">
                      <p className="text-[11px] font-medium text-secondary-700">
                        {p.diasApos === 0 ? 'Imediato' : `Dia ${p.diasApos}`} · {p.canal}
                      </p>
                      <p className="text-xs text-foreground-700 leading-relaxed whitespace-pre-line mt-1">
                        {resolverVariaveis(p.mensagem, valores)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {fluxos.length === 0 && (
            <p className="col-span-full text-center text-foreground-400 text-sm py-8">
              Nenhum fluxo ainda. Crie o primeiro para automatizar suas sequências de contato.
            </p>
          )}
        </div>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setModalAberto(false)}>
          <div className="bg-background-50 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between sticky top-0 bg-background-50 z-10">
              <h3 className="font-heading font-bold text-foreground-950">{editando ? 'Editar fluxo' : 'Novo fluxo'}</h3>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome</label>
                  <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="ex.: Boas-vindas e apresentação" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Gatilho</label>
                  <select value={form.gatilho} onChange={(e) => setForm({ ...form, gatilho: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                    {GATILHOS_FLUXO.map((g) => (
                      <option key={g.valor} value={g.valor}>{g.rotulo}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Descrição</label>
                <input type="text" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="O que este fluxo faz?" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground-800">Passos (mensagens)</label>
                  <button onClick={addPasso} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary-500 hover:bg-secondary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap">
                    <i className="ri-add-line"></i>
                    Adicionar passo
                  </button>
                </div>
                <div className="space-y-2">
                  {form.passos.map((p) => (
                    <div key={p.id} className="bg-background-100 rounded-lg p-3 space-y-2">
                      <div className="flex gap-2 items-center">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-foreground-500 whitespace-nowrap">Dias após</label>
                          <input
                            type="number"
                            min={0}
                            max={365}
                            value={p.diasApos}
                            onChange={(e) => editarPasso(p.id, { diasApos: Math.max(0, Number(e.target.value)) })}
                            className="w-16 px-2 py-1.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
                          />
                        </div>
                        <select
                          value={p.canal}
                          onChange={(e) => editarPasso(p.id, { canal: e.target.value })}
                          className="flex-1 px-3 py-1.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
                        >
                          {CANAIS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={() => removerPasso(p.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-50 hover:bg-accent-50 text-accent-600 cursor-pointer" title="Remover passo">
                          <i className="ri-close-line"></i>
                        </button>
                      </div>
                      <AutocompleteTextarea
                        value={p.mensagem}
                        onChange={(v) => editarPasso(p.id, { mensagem: v })}
                        rows={2}
                        tipo="mensagem"
                        placeholder="Mensagem com variáveis {nome}, {empresa}, {assinatura}..."
                      />
                    </div>
                  ))}
                  {form.passos.length === 0 && (
                    <p className="text-xs text-foreground-400">Adicione ao menos um passo ao fluxo.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvar} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">
                {editando ? 'Salvar' : 'Criar fluxo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
