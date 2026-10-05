import EmpresaTabs from './components/EmpresaTabs';

export default function Empresa() {
  return (
    <div className="wf-page">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-2">
          Empresa
        </h1>
        <p className="text-foreground-600 text-sm">
          O cérebro de identidade da Ana: dados do negócio, voz, regras, time e integrações.
        </p>
      </div>

      <EmpresaTabs />
    </div>
  );
}
