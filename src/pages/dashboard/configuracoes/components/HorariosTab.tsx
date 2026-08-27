import { useState } from 'react';
import { useConfiguracaoStore } from '@/hooks/useConfiguracaoStore';

export default function HorariosTab() {
  const { config, atualizar } = useConfiguracaoStore();
  const [toast, setToast] = useState('');
  const dias = config.diasSemana;
  const feriados = config.feriados;

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const toggleDia = (index: number) => {
    atualizar({ diasSemana: dias.map((d, i) => (i === index ? { ...d, ativo: !d.ativo } : d)) });
  };

  const alterarHorario = (index: number, campo: 'inicio' | 'fim', valor: string) => {
    atualizar({ diasSemana: dias.map((d, i) => (i === index ? { ...d, [campo]: valor } : d)) });
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
        <div className="px-6 py-4 border-b border-background-200/70">
          <h3 className="font-heading font-bold text-foreground-900 text-sm">Horários de Atendimento</h3>
          <p className="text-xs text-foreground-500">Define quando a Ana e a equipe podem enviar mensagens.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Dia</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Ativo</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Início</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Fim</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((d, i) => (
                <tr key={d.dia} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5 font-medium text-foreground-900">{d.dia}</td>
                  <td className="px-6 py-3.5">
                    <button
                      onClick={() => toggleDia(i)}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${d.ativo ? 'bg-primary-500' : 'bg-background-300'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-background-50 rounded-full transition-transform ${d.ativo ? 'translate-x-5' : ''}`}></span>
                    </button>
                  </td>
                  <td className="px-6 py-3.5">
                    <input
                      type="time"
                      value={d.inicio}
                      onChange={(e) => alterarHorario(i, 'inicio', e.target.value)}
                      className="px-3 py-2 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-3.5">
                    <input
                      type="time"
                      value={d.fim}
                      onChange={(e) => alterarHorario(i, 'fim', e.target.value)}
                      className="px-3 py-2 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70">
          <h3 className="font-heading font-bold text-foreground-900 text-sm">Feriados</h3>
          <p className="text-xs text-foreground-500">Dias em que o atendimento está suspenso.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Data</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Nome</th>
              </tr>
            </thead>
            <tbody>
              {feriados.map((f) => (
                <tr key={f.data} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5 text-foreground-700">{new Date(f.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                  <td className="px-6 py-3.5 text-foreground-700">{f.nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => mostrarToast('Horários de atendimento salvos!')}
          className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap"
        >
          Salvar alterações
        </button>
      </div>
    </div>
  );
}