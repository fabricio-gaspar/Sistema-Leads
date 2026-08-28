import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useIntegracoesStore } from '@/hooks/useIntegracoesStore';
import { useEnvioLogStore } from '@/hooks/useEnvioLogStore';
import type { Integracao } from '@/mocks/businessData';

const STATUS: Record<Integracao['status'], { dot: string; title: string }> = {
  conectado: { dot: 'bg-emerald-500', title: 'Conectado' },
  sandbox: { dot: 'bg-emerald-400', title: 'Sandbox' },
  pendente: { dot: 'bg-rose-500', title: 'Não conectado' },
  erro: { dot: 'bg-rose-500', title: 'Erro' },
};

export default function IntegracoesStatus() {
  const { integracoes } = useIntegracoesStore();
  const { registros } = useEnvioLogStore();

  const conectados = integracoes.filter((i) => i.status === 'conectado').length;
  const erros = useMemo(() => registros.filter((r) => r.resultado === 'erro'), [registros]);

  return (
    <div className="bg-background-50 border border-background-200/60 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-secondary-100 flex items-center justify-center">
            <i className="ri-plug-line text-secondary-700 text-sm"></i>
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground-800">Integrações</h3>
            <p className="text-[10px] text-foreground-400">
              {conectados} de {integracoes.length} conectadas
            </p>
          </div>
        </div>
        {erros.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-semibold">
            <i className="ri-alert-line"></i>
            {erros.length} erro(s)
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 flex-1">
        {integracoes.map((i) => {
          const s = STATUS[i.status];
          const conectado = i.status === 'conectado' || i.status === 'sandbox';
          return (
            <Link
              key={i.id}
              to="/dashboard/configuracoes"
              title={s.title}
              className="group relative flex flex-col items-center justify-center gap-1.5 rounded-lg border border-background-200/60 bg-background-50 hover:border-background-200 hover:bg-background-100/60 transition-colors cursor-pointer p-3"
            >
              <div className="relative w-9 h-9 rounded-lg bg-background-100 flex items-center justify-center">
                <i className={`${i.icone} text-foreground-600 text-base`}></i>
                <span
                  className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${s.dot} ring-2 ring-background-50`}
                ></span>
              </div>
              <p className="text-[10px] font-medium text-foreground-700 leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">
                {i.nome.replace(' (Z-API)', '').replace(' (Resend)', '').replace(' (Claude + fallback)', '').replace(' (Click-to-Call)', '')}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
