import { useState } from 'react';
import { templatesAbordagem } from '@/mocks/businessData';

const canais = [
  { id: 'whatsapp', nome: 'WhatsApp', icone: 'ri-whatsapp-line', desc: 'Primeiro contato automático via WA-AKG' },
  { id: 'email', nome: 'E-mail', icone: 'ri-mail-line', desc: 'Follow-up transacional via Resend' },
  { id: 'telefone', nome: 'Telefone', icone: 'ri-phone-line', desc: 'Tarefa humana de ligação / VoIP' },
];

export default function AbordagemTab() {
  const [canaisAtivos, setCanaisAtivos] = useState<string[]>(['whatsapp', 'email']);
  const [multicanal, setMulticanal] = useState(true);
  const [whatsapp, setWhatsapp] = useState(templatesAbordagem.whatsapp);
  const [email, setEmail] = useState(templatesAbordagem.email);
  const [telefone, setTelefone] = useState(templatesAbordagem.telefone);
  const [preview, setPreview] = useState<'whatsapp' | 'email' | 'telefone'>('whatsapp');
  const [saved, setSaved] = useState(false);

  const toggleCanal = (id: string) => {
    if (canaisAtivos.includes(id)) {
      setCanaisAtivos(canaisAtivos.filter((c) => c !== id));
    } else {
      setCanaisAtivos([...canaisAtivos, id]);
    }
  };

  const templates: Record<string, string> = { whatsapp, email, telefone };

  const salvar = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        {/* Canais */}
        <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
          <h3 className="font-heading font-bold text-foreground-900 mb-4">Canais de abordagem</h3>
          <div className="space-y-3">
            {canais.map((c) => {
              const ativo = canaisAtivos.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCanal(c.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer text-left ${
                    ativo
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-background-200 bg-background-50 hover:border-background-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ativo ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-500'}`}>
                    <i className={`${c.icone} text-lg`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground-900">{c.nome}</p>
                    <p className="text-xs text-foreground-500">{c.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${ativo ? 'border-primary-500 bg-primary-500' : 'border-background-300'}`}>
                    {ativo && <i className="ri-check-line text-background-50 text-xs"></i>}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setMulticanal(!multicanal)}
            className="mt-4 w-full flex items-center justify-between p-4 rounded-lg border border-background-200 bg-background-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary-100 text-secondary-700 flex items-center justify-center">
                <i className="ri-stack-line text-lg"></i>
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground-900">Abordagem multicanal</p>
                <p className="text-xs text-foreground-500">Sequência: WhatsApp → E-mail → Ligação</p>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full relative transition-colors ${multicanal ? 'bg-primary-500' : 'bg-background-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-background-50 rounded-full transition-all ${multicanal ? 'left-5' : 'left-0.5'}`}></div>
            </div>
          </button>
        </div>

        {/* Templates */}
        <div className="bg-background-50 border border-background-200/70 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-foreground-900">Mensagens personalizadas</h3>
            <div className="flex gap-1 bg-background-100 rounded-full p-1">
              {(['whatsapp', 'email', 'telefone'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPreview(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all cursor-pointer ${
                    preview === t ? 'bg-background-50 text-foreground-900 shadow-sm' : 'text-foreground-500'
                  }`}
                >
                  {t === 'whatsapp' ? 'WhatsApp' : t === 'email' ? 'E-mail' : 'Telefone'}
                </button>
              ))}
            </div>
          </div>

          {preview === 'whatsapp' && (
            <textarea
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              rows={6}
              maxLength={500}
              className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 resize-none"
            />
          )}
          {preview === 'email' && (
            <textarea
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              rows={8}
              maxLength={500}
              className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 resize-none"
            />
          )}
          {preview === 'telefone' && (
            <textarea
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              rows={4}
              maxLength={500}
              className="w-full px-4 py-3 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 resize-none"
            />
          )}

          <p className="text-xs text-foreground-500 mt-2">
            Variáveis disponíveis: {'{nome}'}, {'{empresa}'}, {'{segmento}'} e {'{servico}'}.
          </p>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-6">
        <div className="bg-background-950 rounded-xl p-6 text-background-50">
          <h3 className="font-heading font-bold mb-1">Pré-visualização</h3>
          <p className="text-background-400 text-xs mb-5">Exemplo com dados fictícios do lead</p>

          {preview === 'whatsapp' && (
            <div className="bg-background-800/60 rounded-lg p-4">
              <p className="text-sm text-background-200 whitespace-pre-wrap">{templates.whatsapp}</p>
              <div className="flex justify-end mt-4">
                <span className="bg-primary-500 text-background-50 text-xs px-3 py-1.5 rounded-full">Enviado via WhatsApp</span>
              </div>
            </div>
          )}
          {preview === 'email' && (
            <div className="bg-background-50 rounded-lg p-5 text-foreground-800">
              <div className="border-b border-background-200 pb-3 mb-3">
                <p className="text-xs text-foreground-500">De: contato@wayflex.ind.br</p>
                <p className="text-xs text-foreground-500">Para: carlos@techsolutions.com.br</p>
              </div>
              <p className="text-sm whitespace-pre-wrap">{templates.email}</p>
            </div>
          )}
          {preview === 'telefone' && (
            <div className="bg-background-800/60 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
                  <i className="ri-phone-line text-background-50 text-sm"></i>
                </div>
                <span className="text-sm text-background-200">Roteiro de ligação</span>
              </div>
              <p className="text-sm text-background-200 whitespace-pre-wrap">{templates.telefone}</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {['Ordem: WhatsApp → E-mail → Ligação', 'Pausa ao receber resposta', 'Respeitar opt-out'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-xs text-background-300 bg-background-800/50 px-3 py-1.5 rounded-full">
                <i className="ri-checkbox-circle-line text-primary-400"></i>
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="inline-flex items-center gap-2 text-primary-700 text-sm font-medium">
              <i className="ri-checkbox-circle-line"></i>
              Abordagem salva!
            </span>
          )}
          <button
            onClick={salvar}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-8 py-3 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <i className="ri-save-line"></i>
            Salvar abordagem
          </button>
        </div>
      </div>
    </div>
  );
}
