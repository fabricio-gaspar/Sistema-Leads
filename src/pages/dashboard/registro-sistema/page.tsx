import DiagnosticsTab from '../configuracoes/components/DiagnosticsTab';

export default function RegistroSistema() {
  return (
    <div className="wf-page">
      <header className="wf-page-header">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-700">Governança operacional</p>
          <h1 className="wf-page-title mt-1">Registro do Sistema</h1>
          <p className="wf-page-description">Acompanhe eventos, filas, integrações e decisões da Ana com dados reais e sem editar o histórico.</p>
        </div>
      </header>
      <DiagnosticsTab />
    </div>
  );
}
