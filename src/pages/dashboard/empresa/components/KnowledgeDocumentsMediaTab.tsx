import AnaKnowledgeLibraryTab from './AnaKnowledgeLibraryTab';
import KnowledgeCatalogManagerTab from './KnowledgeCatalogManagerTab';

/** Mantém a biblioteca já aprovada e acrescenta documentos relacionáveis à base comercial. */
export default function KnowledgeDocumentsMediaTab() {
  return <div className="space-y-5">
    <KnowledgeCatalogManagerTab itemType="document" />
    <section className="rounded-xl border border-background-200/70 bg-background-50 p-5">
      <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Biblioteca existente</p><h2 className="mt-1 font-heading text-lg font-bold text-foreground-950">Documentos já aprovados para a Ana</h2><p className="mt-1 text-sm leading-6 text-foreground-600">O acervo existente permanece disponível. Para um documento que também precise de relacionamento comercial e envio pela Central, registre-o acima com a URL de origem.</p></div>
      <AnaKnowledgeLibraryTab />
    </section>
  </div>;
}
