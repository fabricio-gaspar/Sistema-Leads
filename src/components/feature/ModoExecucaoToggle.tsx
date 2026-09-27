import { useOperationalMode } from '@/hooks/useOperationalMode';

export default function ModoExecucaoToggle() {
  const { mode, refresh } = useOperationalMode();
  const labels = { loading: 'Verificando Ambiente Real', preparing: 'Ambiente Real · configuração pendente', real: 'Ambiente Real ativo', unavailable: 'Ambiente indisponível' } as const;
  return <button type="button" onClick={() => void refresh()} disabled={mode === 'loading'} className="wf-mode-toggle inline-flex min-h-9 items-center gap-2 rounded-full border border-background-200 bg-background-50 px-3 text-xs font-semibold text-foreground-600 disabled:cursor-wait" title="Estado consultado diretamente na empresa. Clique para atualizar." aria-label={`${labels[mode]}. Atualizar consulta`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${mode === 'real' ? 'bg-primary-500' : mode === 'unavailable' ? 'bg-accent-500' : 'bg-[#BC8B42]'}`} /><span aria-live="polite">{labels[mode]}</span></button>;
}
