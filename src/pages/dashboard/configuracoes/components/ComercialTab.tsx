import { useState } from 'react';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';

export default function ComercialTab() {
  const { settings, salvar: salvarConfig } = useEmpresaSettingsStore();
  const [regras, setRegras] = useState(settings.regras);
  const [toast, setToast] = useState('');

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const atualizar = <K extends keyof typeof regras>(campo: K, valor: (typeof regras)[K]) => {
    setRegras((r) => ({ ...r, [campo]: valor }));
  };

  const salvar = () => {
    salvarConfig({ regras });
    mostrarToast('Regras comerciais salvas!');
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      {/* Descontos e aprovação */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70">
          <h3 className="font-heading font-bold text-foreground-900 text-sm">Limites de desconto e aprovação</h3>
          <p className="text-xs text-foreground-500">Define quanto cada agente pode conceder sem aprovação superior.</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Desconto máximo padrão (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={regras.descontoMaximoPadrao}
              onChange={(e) => atualizar('descontoMaximoPadrao', Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
            />
            <p className="text-xs text-foreground-500 mt-1">Nenhum usuário pode ultrapassar este limite.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Exige aprovação acima de (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={regras.descontoExigeAprovacaoAcima}
              onChange={(e) => atualizar('descontoExigeAprovacaoAcima', Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
            />
            <p className="text-xs text-foreground-500 mt-1">Descontos acima deste valor exigem aprovação de cargo superior.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Cargo mínimo para aprovar desconto</label>
            <select
              value={regras.cargoMinimoAprovacao}
              onChange={(e) => atualizar('cargoMinimoAprovacao', e.target.value)}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
            >
              {['Vendedor', 'SDR', 'Gestor Comercial', 'Administrador'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col justify-end gap-4">
            <button onClick={() => atualizar('anaPodeAplicarDesconto', !regras.anaPodeAplicarDesconto)} className="flex items-center gap-3 cursor-pointer">
              <span className={`w-10 h-5 rounded-full relative transition-colors ${regras.anaPodeAplicarDesconto ? 'bg-primary-500' : 'bg-background-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${regras.anaPodeAplicarDesconto ? 'translate-x-5' : ''}`}></span>
              </span>
              <span className="text-sm text-foreground-700">Ana pode aplicar desconto</span>
            </button>
            <div className={`flex items-center gap-3 ${regras.anaPodeAplicarDesconto ? '' : 'opacity-50 pointer-events-none'}`}>
              <label className="text-sm text-foreground-700 whitespace-nowrap">Limite da Ana (%):</label>
              <input
                type="number"
                min={0}
                max={100}
                value={regras.anaDescontoMaximo}
                onChange={(e) => atualizar('anaDescontoMaximo', Number(e.target.value))}
                className="w-24 px-3 py-2 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Proposta e orçamento */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <h3 className="font-heading font-bold text-foreground-900 text-sm mb-1">Padrões de proposta e orçamento</h3>
        <p className="text-xs text-foreground-500 mb-5">Valores iniciais aplicados a novas propostas.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Validade da proposta (dias)</label>
            <input
              type="number"
              min={1}
              value={regras.validadePropostaDias}
              onChange={(e) => atualizar('validadePropostaDias', Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Prazo de entrega padrão (dias)</label>
            <input
              type="number"
              min={1}
              value={regras.prazoEntregaPadraoDias}
              onChange={(e) => atualizar('prazoEntregaPadraoDias', Number(e.target.value))}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
            />
          </div>
          <div className="flex flex-col justify-end gap-4">
            <button onClick={() => atualizar('gerarPdf', !regras.gerarPdf)} className="flex items-center gap-3 cursor-pointer">
              <span className={`w-10 h-5 rounded-full relative transition-colors ${regras.gerarPdf ? 'bg-primary-500' : 'bg-background-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${regras.gerarPdf ? 'translate-x-5' : ''}`}></span>
              </span>
              <span className="text-sm text-foreground-700">Gerar PDF da proposta</span>
            </button>
          </div>
        </div>
        <div className="mt-6">
          <label className="block text-sm font-medium text-foreground-800 mb-1.5">Condições de pagamento padrão</label>
          <textarea
            value={regras.condicoesPagamentoPadrao}
            onChange={(e) => atualizar('condicoesPagamentoPadrao', e.target.value)}
            rows={3}
            maxLength={500}
            className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 resize-none"
          />
        </div>
      </section>

      {/* Negociação */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <h3 className="font-heading font-bold text-foreground-900 text-sm mb-1">Regras de negociação e fechamento</h3>
        <p className="text-xs text-foreground-500 mb-5">Como o sistema conduz negociação e registro de perdas.</p>
        <div className="flex flex-col gap-4">
          <button onClick={() => atualizar('transferirNegociacaoHumano', !regras.transferirNegociacaoHumano)} className="flex items-center gap-3 cursor-pointer">
            <span className={`w-10 h-5 rounded-full relative transition-colors ${regras.transferirNegociacaoHumano ? 'bg-primary-500' : 'bg-background-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${regras.transferirNegociacaoHumano ? 'translate-x-5' : ''}`}></span>
            </span>
            <div>
              <p className="text-sm text-foreground-700">Transferir negociação para humano</p>
              <p className="text-xs text-foreground-500">Quando houver condição comercial, a Ana encerra a tratativa e transfere.</p>
            </div>
          </button>
          <button onClick={() => atualizar('motivoPerdaObrigatorio', !regras.motivoPerdaObrigatorio)} className="flex items-center gap-3 cursor-pointer">
            <span className={`w-10 h-5 rounded-full relative transition-colors ${regras.motivoPerdaObrigatorio ? 'bg-primary-500' : 'bg-background-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${regras.motivoPerdaObrigatorio ? 'translate-x-5' : ''}`}></span>
            </span>
            <div>
              <p className="text-sm text-foreground-700">Exigir motivo ao marcar lead como perdido</p>
              <p className="text-xs text-foreground-500">Garante relatórios de perda confiáveis.</p>
            </div>
          </button>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={salvar}
          className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
        >
          Salvar regras
        </button>
      </div>
    </div>
  );
}