import { useState } from 'react';
import { useConfiguracaoStore } from '@/hooks/useConfiguracaoStore';
import { useIntegracoesStore } from '@/hooks/useIntegracoesStore';
import type { ModoExecucao } from '@/lib/tipos';
import type { Integracao } from '@/mocks/businessData';

const integracaoParaModulo: Record<string, string> = {
  'int-1': 'whatsapp',
  'int-2': 'email',
  'int-5': 'agendamento',
  'int-6': 'ia',
};

function integracaoTemCredenciais(it: Integracao): boolean {
  const obrigatorios = (it.campos || []).filter((c) => c?.obrigatorio);
  if (obrigatorios.length === 0) return false;
  return obrigatorios.every((c) => (it.credenciais?.[c.id] ?? '').trim() !== '');
}

export default function ModoExecucaoToggle() {
  const { config, atualizar } = useConfiguracaoStore();
  const { integracoes } = useIntegracoesStore();
  const [confirmarReal, setConfirmarReal] = useState(false);
  const [toast, setToast] = useState('');

  const modoAtual = config.modoExecucao;
  const ehReal = modoAtual !== 'DEMO';

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const modulosComCredencial = (): Set<string> => {
    const comCredencial = new Set<string>();
    if (config.estadosModulos) {
      Object.entries(config.estadosModulos).forEach(([chave, mod]) => {
        if (mod?.temCredenciais) comCredencial.add(chave);
      });
    }
    integracoes.forEach((it) => {
      const chave = integracaoParaModulo[it.id];
      if (chave && integracaoTemCredenciais(it)) comCredencial.add(chave);
    });
    return comCredencial;
  };

  const aplicar = (modo: ModoExecucao) => {
    try {
      if (modo === 'PRODUCAO') {
        const comCredencial = modulosComCredencial();
        const estadosAtualizados = { ...(config.estadosModulos || {}) };
        let ativados = 0;
        Object.keys(estadosAtualizados).forEach((chave) => {
          const mod = estadosAtualizados[chave];
          if (comCredencial.has(chave) && mod && mod.estado === 'DESLIGADO') {
            estadosAtualizados[chave] = { ...mod, estado: 'ATIVO', temCredenciais: true };
            ativados += 1;
          }
        });
        atualizar({ modoExecucao: modo, estadosModulos: estadosAtualizados });
        setConfirmarReal(false);
        mostrarToast(
          ativados > 0
            ? `Modo Real ativado — ${ativados} módulo(s) com credencial ligados automaticamente.`
            : 'Modo Real ativado — nenhum módulo com credencial para ligar ainda.',
        );
        return;
      }
      atualizar({ modoExecucao: modo });
      setConfirmarReal(false);
      mostrarToast('Modo Demo ativado — nada sai do navegador.');
    } catch (err) {
      console.error('[ModoExecucaoToggle] erro ao aplicar modo', err);
      setConfirmarReal(false);
      mostrarToast('Erro ao mudar modo — verifique o console.');
    }
  };

  const selecionar = (modo: ModoExecucao) => {
    if (modo === modoAtual) return;
    if (modo === 'PRODUCAO' && !ehReal) {
      setConfirmarReal(true);
      return;
    }
    aplicar(modo);
  };

  return (
    <div className="relative">
      {/* Toggle Demo / Real */}
      <div className="flex items-center gap-1 p-1 bg-background-100 rounded-full border border-background-200/70">
        <button
          type="button"
          onClick={() => selecionar('DEMO')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
            !ehReal ? 'bg-secondary-500 text-background-50' : 'text-foreground-500 hover:text-foreground-700'
          }`}
        >
          <i className="ri-flask-line"></i>
          Demo
        </button>
        <button
          type="button"
          onClick={() => selecionar('PRODUCAO')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
            ehReal ? 'bg-primary-500 text-background-50' : 'text-foreground-500 hover:text-foreground-700'
          }`}
        >
          <i className="ri-rocket-line"></i>
          Real
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="absolute right-0 top-full mt-2 px-4 py-2.5 bg-background-50 border border-background-200/70 rounded-lg text-xs text-foreground-700 whitespace-nowrap z-50">
          <i className="ri-checkbox-circle-fill text-primary-600 mr-1.5"></i>
          {toast}
        </div>
      )}

      {/* Modal de confirmação */}
      {confirmarReal && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-foreground-950/40"
            onClick={() => setConfirmarReal(false)}
            role="button"
            aria-label="Fechar modal"
          />
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-background-50 border border-background-200/70 rounded-xl p-6 w-full max-w-md pointer-events-auto shadow-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center flex-shrink-0">
                  <i className="ri-alert-line text-accent-700 text-lg"></i>
                </div>
                <div>
                  <h3 className="font-heading font-bold text-foreground-900 text-sm">Ativar modo real?</h3>
                  <p className="text-xs text-foreground-500 mt-1 leading-relaxed">
                    Você está saindo do <strong>Modo Demo</strong>. A partir daqui, com os módulos ativos e
                    credenciais configuradas, as mensagens e e-mails podem ter <strong>efeito real</strong>.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-5 justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmarReal(false)}
                  className="px-4 py-2 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => aplicar('PRODUCAO')}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap"
                >
                  Sim, ativar real
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}