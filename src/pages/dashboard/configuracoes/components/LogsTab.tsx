import { useState } from 'react';
import { useAuditoriaStore } from '@/hooks/useAuditoriaStore';

const eventoIcones: Record<string, string> = {
  LEAD_CREATED: 'ri-user-add-line text-primary-600',
  STAGE_CHANGED: 'ri-arrow-left-right-line text-accent-600',
  MESSAGE_SENT: 'ri-send-plane-line text-primary-600',
  HANDOFF: 'ri-user-shared-line text-secondary-600',
  USER_INVITED: 'ri-user-add-line text-primary-600',
  SETTINGS_CHANGED: 'ri-settings-4-line text-foreground-500',
  OPT_OUT: 'ri-forbid-2-line text-accent-600',
  AUTOMATION_FAILED: 'ri-error-warning-line text-accent-600',
  TEMPLATE_APPROVED: 'ri-check-line text-primary-600',
  CHANNEL_TEST: 'ri-refresh-line text-primary-600',
};

export default function LogsTab() {
  const { registros } = useAuditoriaStore();
  const [busca, setBusca] = useState('');

  const filtrados = registros.filter((l) =>
    (l.evento + l.ator + l.alvo + l.detalhes).toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar eventos, ator ou alvo..."
            className="w-full pl-9 pr-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900"
          />
        </div>
      </div>

      <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-background-200/70">
          <h3 className="font-heading font-bold text-foreground-900 text-sm">Logs e Auditoria</h3>
          <p className="text-xs text-foreground-500">Rastreamento de todas as ações no sistema.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Evento</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Ator</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Alvo</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Detalhes</th>
                <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr key={l.id} className="border-b border-background-100 hover:bg-background-50/50">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-background-100 flex items-center justify-center flex-shrink-0">
                        <i className={`${eventoIcones[l.evento] || 'ri-file-list-line text-foreground-500'} text-sm`}></i>
                      </div>
                      <span className="font-medium text-foreground-900">{l.evento}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-foreground-700">{l.ator}</td>
                  <td className="px-6 py-3.5 text-foreground-700">{l.alvo}</td>
                  <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell max-w-xs truncate">{l.detalhes}</td>
                  <td className="px-6 py-3.5 text-foreground-500 text-xs whitespace-nowrap">{l.data}</td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-foreground-500">
                    Nenhum log encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}