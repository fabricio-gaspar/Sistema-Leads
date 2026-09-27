import WhatsappAccountPanel from '@/components/feature/WhatsappAccountPanel';

export default function MeuWhatsapp() {
  return <div className="wf-page wf-page--whatsapp">
    <header className="wf-page-header"><div><p className="wf-eyebrow">Canais de atendimento</p><h1 className="wf-page-title">Meu WhatsApp</h1><p className="wf-page-description">Conecte sua conta e acompanhe o estado confirmado pelo provedor. Conexão não comprova autorização de contato nem entrega de mensagens.</p></div></header>
    <section className="wf-surface p-5 sm:p-6">
      <WhatsappAccountPanel />
    </section>
  </div>;
}
