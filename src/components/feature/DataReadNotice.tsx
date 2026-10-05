export default function DataReadNotice({ status, onRetry }: { status: 'loading' | 'ready' | 'error'; onRetry?: () => void }) {
  if (status === 'ready') return null;
  return <div className="wf-module-context mb-4" role={status === 'error' ? 'alert' : 'status'}>
    <span><i className={status === 'error' ? 'ri-error-warning-line mr-2' : 'ri-loader-4-line animate-spin mr-2'} aria-hidden="true" /><strong>{status === 'error' ? 'Leitura indisponível.' : 'Consultando os registros…'}</strong> {status === 'error' ? 'Os dados exibidos podem estar desatualizados; uma lista vazia não confirma ausência de registros.' : 'Aguarde a confirmação antes de interpretar totais ou listas vazias.'}</span>
    {status === 'error' && onRetry && <button className="wf-btn-secondary" onClick={onRetry}>Tentar novamente</button>}
  </div>;
}
