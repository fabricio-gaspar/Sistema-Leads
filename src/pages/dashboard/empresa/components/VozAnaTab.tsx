import { useState } from 'react';
import { perfilAna } from '@/mocks/anaComercial';
import { objecoesFAQ, assinaturaCta, identidadeAna } from '@/mocks/empresaExtra';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';

export default function VozAnaTab() {
  const { settings, salvar: salvarConfig } = useEmpresaSettingsStore();
  const [saved, setSaved] = useState(false);
  const [tom, setTom] = useState(perfilAna.tom);
  const [personalidade, setPersonalidade] = useState(perfilAna.personalidade);
  const [nuncaFazer, setNuncaFazer] = useState(perfilAna.nuncaFazer);
  const [saudacao, setSaudacao] = useState(settings.saudacao || identidadeAna.saudacao);
  const [corBalao, setCorBalao] = useState(settings.corBalao || identidadeAna.corBalao);
  const [assinatura, setAssinatura] = useState(settings.assinatura || assinaturaCta.assinatura);

  const salvar = () => {
    salvarConfig({ saudacao, corBalao, assinatura });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const corBalaoClasse: Record<string, string> = {
    primary: 'bg-primary-500 text-background-50 dark:text-foreground-950',
    accent: 'bg-accent-500 text-background-50 dark:text-foreground-950',
    secondary: 'bg-secondary-500 text-background-50 dark:text-foreground-950',
  };

  return (
    <div className="space-y-6">
      {/* Voz e personalidade */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
            <i className="ri-user-voice-line text-primary-600"></i>
          </div>
          <div>
            <h3 className="font-heading font-bold text-foreground-900">Voz e personalidade da Ana</h3>
            <p className="text-sm text-foreground-500">Como a Ana se apresenta e se comporta em cada conversa.</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Função</label>
            <p className="text-sm text-foreground-700 bg-background-100/70 border border-background-200/70 rounded-lg p-3">
              {perfilAna.funcao}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Objetivo principal</label>
            <textarea
              value={perfilAna.objetivo}
              readOnly
              rows={3}
              className="w-full px-4 py-2.5 bg-background-100/70 border border-background-200/70 rounded-lg text-sm text-foreground-700 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-2">Tom de comunicação</label>
            <div className="flex flex-wrap gap-2">
              {tom.map((t) => (
                <span key={t} className="inline-flex items-center gap-2 bg-primary-100 text-primary-800 px-3 py-1.5 rounded-full text-sm">
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-2">Traços de personalidade</label>
            <div className="flex flex-wrap gap-2">
              {personalidade.map((p) => (
                <span key={p} className="inline-flex items-center gap-2 bg-secondary-100 text-secondary-900 px-3 py-1.5 rounded-full text-sm">
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-background-100/50 border border-background-200/70 rounded-lg p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary-700 mb-3">
                <i className="ri-check-double-line"></i>
                A Ana deve
              </p>
              <ul className="space-y-2">
                {perfilAna.deveFazer.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-sm text-foreground-700">
                    <i className="ri-check-line text-primary-500 mt-0.5"></i>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-background-100/50 border border-background-200/70 rounded-lg p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-accent-700 mb-3">
                <i className="ri-forbid-line"></i>
                A Ana nunca deve
              </p>
              <ul className="space-y-2">
                {nuncaFazer.map((n) => (
                  <li key={n} className="flex items-start gap-2 text-sm text-foreground-700">
                    <i className="ri-close-circle-line text-accent-500 mt-0.5"></i>
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Objeções e FAQ */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-accent-100 rounded-lg flex items-center justify-center">
            <i className="ri-question-answer-line text-accent-600"></i>
          </div>
          <div>
            <h3 className="font-heading font-bold text-foreground-900">Objeções e respostas padrão</h3>
            <p className="text-sm text-foreground-500">Como a Ana rebate as dúvidas mais comuns dos leads.</p>
          </div>
        </div>
        <div className="space-y-3">
          {objecoesFAQ.map((o) => (
            <div key={o.id} className="bg-background-100/50 border border-background-200/70 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-foreground-900 text-sm">"{o.objecao}"</span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    o.prioridade === 'alta'
                      ? 'bg-accent-100 text-accent-700'
                      : o.prioridade === 'media'
                        ? 'bg-secondary-100 text-secondary-700'
                        : 'bg-background-200 text-foreground-600'
                  }`}
                >
                  {o.prioridade}
                </span>
              </div>
              <p className="text-sm text-foreground-700 leading-relaxed">{o.resposta}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Assinatura e CTA */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
            <i className="ri-pen-nib-line text-primary-600"></i>
          </div>
          <div>
            <h3 className="font-heading font-bold text-foreground-900">Assinatura e links de ação</h3>
            <p className="text-sm text-foreground-500">Como a Ana encerra as mensagens e para onde direciona os leads.</p>
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Assinatura</label>
            <textarea
              value={assinatura}
              onChange={(e) => setAssinatura(e.target.value)}
              rows={4}
              maxLength={500}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 resize-none focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-2">Links de chamada para ação (CTA)</label>
            <div className="space-y-2">
              {assinaturaCta.ctas.map((c) => (
                <div key={c.id} className="flex items-center gap-3 bg-background-100/50 border border-background-200/70 rounded-lg p-3">
                  <div className="w-9 h-9 bg-secondary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className={`${c.icone} text-secondary-700`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground-900 text-sm">{c.nome}</p>
                    <p className="text-xs text-foreground-500 truncate">{c.link}</p>
                    <p className="text-xs text-foreground-500">{c.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Identidade visual */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-accent-100 rounded-lg flex items-center justify-center">
            <i className="ri-palette-line text-accent-600"></i>
          </div>
          <div>
            <h3 className="font-heading font-bold text-foreground-900">Identidade visual da Ana</h3>
            <p className="text-sm text-foreground-500">Nome, avatar e aparência do balão de mensagem.</p>
          </div>
        </div>
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center">
              <span className="text-background-50 dark:text-foreground-950 font-heading font-bold text-2xl">{identidadeAna.nome.charAt(0)}</span>
            </div>
            <div>
              <p className="font-heading font-bold text-foreground-950 text-lg">{identidadeAna.nome}</p>
              <p className="text-sm text-foreground-500">{identidadeAna.funcao}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Saudação inicial</label>
            <input
              type="text"
              value={saudacao}
              onChange={(e) => setSaudacao(e.target.value)}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-2">Cor do balão de mensagem</label>
            <div className="flex flex-wrap gap-3">
              {identidadeAna.corBalaoOpcoes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCorBalao(c.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border cursor-pointer whitespace-nowrap transition-all ${
                    corBalao === c.id ? 'border-primary-300 ring-2 ring-primary-400/20' : 'border-background-300 hover:border-background-400'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full ${corBalaoClasse[c.id]}`}></span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-background-100/50 border border-background-200/70 rounded-lg p-4 max-w-md">
            <p className="text-xs text-foreground-500 mb-2">Prévia do balão</p>
            <div className={`${corBalaoClasse[corBalao]} px-4 py-3 rounded-2xl rounded-tl-md text-sm`}>
              {saudacao}
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="inline-flex items-center gap-2 text-primary-700 text-sm font-medium">
            <i className="ri-checkbox-circle-line"></i>
            Voz da Ana salva!
          </span>
        )}
        <button
          onClick={salvar}
          className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-8 py-3 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-save-line"></i>
          Salvar voz da Ana
        </button>
      </div>
    </div>
  );
}