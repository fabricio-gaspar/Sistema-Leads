import AbordagemTab from './AbordagemTab';
import ApresentacaoTab from './ApresentacaoTab';

export default function AbordagemAnaTab() {
  return (
    <div className="space-y-8">
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <AbordagemTab />
      </section>
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <ApresentacaoTab />
      </section>
    </div>
  );
}