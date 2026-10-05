import { useState } from 'react';
import { usePipelineStore } from '@/hooks/usePipelineStore';
import type { PipelineStage } from '@/hooks/usePipelineStore';

const tipoCores: Record<string, string> = {
  aberta: 'bg-primary-100 text-primary-700',
  ganha: 'bg-accent-100 text-accent-700',
  perdida: 'bg-secondary-100 text-secondary-700',
  pausada: 'bg-background-200 text-foreground-500',
};

const tipoLabel: Record<string, string> = {
  aberta: 'Aberta',
  ganha: 'Ganha',
  perdida: 'Perdida',
  pausada: 'Pausada',
};

const tiposDisponiveis = ['aberta', 'ganha', 'perdida', 'pausada'] as const;

export default function PipelineTab() {
  const { stages, atualizar, adicionar, excluir, reordenar } = usePipelineStore();
  const [toast, setToast] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<PipelineStage | null>(null);
  const [form, setForm] = useState({
    nome: '',
    tipo: 'aberta' as PipelineStage['tipo'],
    cor: '#168654',
    slaHoras: 24,
    permiteAutomacao: true,
  });

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const mover = (index: number, direcao: 'cima' | 'baixo') => {
    const novo = [...stages];
    if (direcao === 'cima' && index > 0) {
      [novo[index], novo[index - 1]] = [novo[index - 1], novo[index]];
    } else if (direcao === 'baixo' && index < novo.length - 1) {
      [novo[index], novo[index + 1]] = [novo[index + 1], novo[index]];
    }
    reordenar(novo.map((s, i) => ({ ...s, ordem: i + 1 })));
  };

  const toggleAtiva = (id: string) => {
    const s = stages.find((x) => x.id === id);
    if (s) atualizar(id, { ativa: !s.ativa });
  };

  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: '', tipo: 'aberta', cor: '#168654', slaHoras: 24, permiteAutomacao: true });
    setModalAberto(true);
  };

  const abrirEdicao = (s: PipelineStage) => {
    setEditando(s);
    setForm({ nome: s.nome, tipo: s.tipo, cor: s.cor, slaHoras: s.slaHoras, permiteAutomacao: s.permiteAutomacao });
    setModalAberto(true);
  };

  const salvar = () => {
    if (!form.nome.trim()) {
      mostrarToast('Informe o nome da etapa.');
      return;
    }
    if (editando) {
      atualizar(editando.id, {
        nome: form.nome.trim(),
        tipo: form.tipo,
        cor: form.cor,
        slaHoras: form.slaHoras,
        permiteAutomacao: form.permiteAutomacao,
      });
      mostrarToast('Etapa atualizada.');
    } else {
      adicionar({
        id: `STG-${Date.now()}`,
        nome: form.nome.trim(),
        ordem: stages.length + 1,
        cor: form.cor,
        tipo: form.tipo,
        permiteAutomacao: form.permiteAutomacao,
        exigeMotivo: false,
        exigeResponsavel: false,
        slaHoras: form.slaHoras,
        ativa: true,
      });
      mostrarToast('Nova etapa criada.');
    }
    setModalAberto(false);
  };

  const excluirEtapa = (s: PipelineStage) => {
    if (s.tipo === 'ganha' || s.tipo === 'perdida') {
      mostrarToast('Etapas de resultado (ganha/perdida) não podem ser excluídas — apenas inativadas.');
      return;
    }
    excluir(s.id);
    mostrarToast(`Etapa "${s.nome}" excluída.`);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-900 text-sm">Etapas do Pipeline</h3>
            <p className="text-xs text-foreground-500">Ordene, configure SLA e regras por etapa.</p>
          </div>
          <button
            onClick={abrirNovo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <i className="ri-add-line"></i>
            Nova etapa
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-10">Ordem</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Nome</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Tipo</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">SLA</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden lg:table-cell">Automação</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Ativa</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-28"></th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s, i) => (
                <tr key={s.id} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5 text-foreground-700 font-medium">{s.ordem}</td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.cor }}></span>
                      <span className="font-medium text-foreground-900">{s.nome}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${tipoCores[s.tipo]}`}>
                      {tipoLabel[s.tipo]}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">
                    {s.slaHoras > 0 ? `${s.slaHoras}h` : '—'}
                  </td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden lg:table-cell">
                    {s.permiteAutomacao ? (
                      <span className="inline-flex items-center gap-1 text-xs text-primary-600">
                        <i className="ri-robot-line"></i> Ana
                      </span>
                    ) : (
                      <span className="text-xs text-foreground-400">Manual</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    <button
                      onClick={() => toggleAtiva(s.id)}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${s.ativa ? 'bg-primary-500' : 'bg-background-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${s.ativa ? 'translate-x-5' : ''}`}></span>
                    </button>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => mover(i, 'cima')}
                        disabled={i === 0}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-background-100 text-foreground-500 disabled:opacity-30 cursor-pointer"
                        title="Mover para cima"
                      >
                        <i className="ri-arrow-up-line text-xs"></i>
                      </button>
                      <button
                        onClick={() => mover(i, 'baixo')}
                        disabled={i === stages.length - 1}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-background-100 text-foreground-500 disabled:opacity-30 cursor-pointer"
                        title="Mover para baixo"
                      >
                        <i className="ri-arrow-down-line text-xs"></i>
                      </button>
                      <button
                        onClick={() => abrirEdicao(s)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-background-100 text-foreground-500 cursor-pointer"
                        title="Editar etapa e SLA"
                      >
                        <i className="ri-edit-line text-xs"></i>
                      </button>
                      <button
                        onClick={() => excluirEtapa(s)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-accent-50 text-accent-600 cursor-pointer"
                        title="Excluir etapa"
                      >
                        <i className="ri-delete-bin-6-line text-xs"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <h4 className="font-heading font-bold text-foreground-900 text-sm mb-3">Regras do pipeline</h4>
        <ul className="space-y-2 text-sm text-foreground-600">
          <li className="flex items-start gap-2">
            <i className="ri-check-line text-primary-500 mt-0.5"></i>
            <span>Deve existir pelo menos uma etapa <strong>inicial</strong>, uma <strong>ganha</strong> e uma <strong>perdida</strong>.</span>
          </li>
          <li className="flex items-start gap-2">
            <i className="ri-check-line text-primary-500 mt-0.5"></i>
            <span>Perda de lead <strong>exige motivo</strong> obrigatório.</span>
          </li>
          <li className="flex items-start gap-2">
            <i className="ri-check-line text-primary-500 mt-0.5"></i>
            <span>Etapas finais <strong>cancelam automações</strong> pendentes.</span>
          </li>
          <li className="flex items-start gap-2">
            <i className="ri-check-line text-primary-500 mt-0.5"></i>
            <span>Etapas <strong>ganha/perdida</strong> não podem ser excluídas — apenas <strong>inativadas</strong>.</span>
          </li>
        </ul>
      </div>

      {/* Modal nova/editar etapa */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setModalAberto(false)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">{editando ? 'Editar etapa' : 'Nova etapa'}</h3>
              <button onClick={() => setModalAberto(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome</label>
                <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Proposta Enviada" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">Tipo</label>
                  <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as PipelineStage['tipo'] })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                    {tiposDisponiveis.map((t) => <option key={t} value={t}>{tipoLabel[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground-800 mb-1.5">SLA (horas)</label>
                  <input type="number" min={0} value={form.slaHoras} onChange={(e) => setForm({ ...form, slaHoras: Math.max(0, Number(e.target.value)) })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground-800">Cor</label>
                <input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="w-10 h-8 rounded cursor-pointer border border-background-300" />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer">
                <input type="checkbox" checked={form.permiteAutomacao} onChange={(e) => setForm({ ...form, permiteAutomacao: e.target.checked })} className="w-4 h-4 accent-primary-500 cursor-pointer" />
                Permitir atuação da Ana (automação)
              </label>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvar} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">
                {editando ? 'Salvar' : 'Criar etapa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
