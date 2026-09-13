import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import { loadAnaPersonalization, saveAnaPersonalization } from '@/lib/crm/anaPersonalizationRepository';
import {
  DEFAULT_HANDOFF_TRIGGERS,
  DEFAULT_QUALIFICATION_QUESTIONS,
  joinPlaybookLines,
  splitPlaybookLines,
} from '@/lib/anaCommercialPlaybook';

const steps = [
  { title: 'Empresa e público', description: 'O contexto que a Ana usa para se apresentar.' },
  { title: 'Oferta permitida', description: 'O que ela pode informar e quais fontes são confiáveis.' },
  { title: 'Conversa e qualificação', description: 'Tom de voz e perguntas para avançar o lead.' },
  { title: 'Reunião e orçamento', description: 'Limites comerciais que exigem aprovação humana.' },
  { title: 'Cadência e handoff', description: 'Quando acompanhar, pausar e chamar uma pessoa.' },
  { title: 'Canais e publicar', description: 'Onde ela pode atuar e a revisão final.' },
];

const supportedChannels = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'E-mail' },
] as const;

const WAYFLEX_OFFICIAL_KNOWLEDGE = [
  'Site institucional da Wayflex',
  '17 catálogos oficiais por aplicação',
  '18 segmentos industriais publicados',
  '18 famílias de acessórios industriais',
  'Critérios técnicos, qualificação e limites comerciais aprovados',
];

export default function PersonalizacaoAna({ embedded = false }: { embedded?: boolean }) {
  const { settings } = useEmpresaSettingsStore();
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [business, setBusiness] = useState(settings.ramo);
  const [audience, setAudience] = useState(settings.publico);
  const [greeting, setGreeting] = useState(settings.saudacao);
  const [signature, setSignature] = useState(settings.assinatura);
  const [limit, setLimit] = useState(settings.limiteMensagens);
  const [valueProposition, setValueProposition] = useState(joinPlaybookLines(settings.diferenciais));
  const [qualificationQuestions, setQualificationQuestions] = useState(joinPlaybookLines(DEFAULT_QUALIFICATION_QUESTIONS));
  const [handoffTriggers, setHandoffTriggers] = useState(
    joinPlaybookLines(settings.handoff.filter((rule) => rule.status !== 'inativo').map((rule) => rule.gatilho))
      || joinPlaybookLines(DEFAULT_HANDOFF_TRIGGERS),
  );
  const [tone, setTone] = useState<'consultivo' | 'direto' | 'acolhedor' | 'tecnico'>('tecnico');
  const [approvedKnowledge, setApprovedKnowledge] = useState(
    joinPlaybookLines(WAYFLEX_OFFICIAL_KNOWLEDGE),
  );
  const [discountLimit, setDiscountLimit] = useState(0);
  const [firstFollowUpHours, setFirstFollowUpHours] = useState(24);
  const [secondFollowUpHours, setSecondFollowUpHours] = useState(72);
  const [timeoutHours, setTimeoutHours] = useState(120);
  const [businessHoursOnly, setBusinessHoursOnly] = useState(true);
  const [allowedChannels, setAllowedChannels] = useState({ whatsapp: false, email: false });
  const [lowConfidenceThreshold, setLowConfidenceThreshold] = useState(70);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [loadingConfiguration, setLoadingConfiguration] = useState(true);
  const [loadSucceeded, setLoadSucceeded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const dirtyRef = useRef(false);

  const markDirty = () => {
    dirtyRef.current = true;
    setIsDirty(true);
    setSaved(false);
  };

  useEffect(() => {
    let mounted = true;
    setLoadingConfiguration(true);
    setLoadSucceeded(false);
    setLoadFailed(false);
    void loadAnaPersonalization()
      .then(({ configuration, version }) => {
        if (!mounted) return;
        if (configuration && !dirtyRef.current) {
          setBusiness(configuration.business);
          setAudience(configuration.audience);
          setGreeting(configuration.greeting);
          setSignature(configuration.signature);
          setLimit(configuration.dailyMessageLimit);
          setValueProposition(joinPlaybookLines(configuration.valueProposition));
          setQualificationQuestions(joinPlaybookLines(configuration.qualificationQuestions));
          setHandoffTriggers(joinPlaybookLines(configuration.handoffTriggers));
          setTone(configuration.tone || 'tecnico');
          setApprovedKnowledge(joinPlaybookLines(configuration.approvedKnowledge || []));
          setDiscountLimit(configuration.quotePolicy?.discountLimit ?? 0);
          setFirstFollowUpHours(configuration.cadencePolicy?.firstFollowUpHours ?? 24);
          setSecondFollowUpHours(configuration.cadencePolicy?.secondFollowUpHours ?? 72);
          setTimeoutHours(configuration.cadencePolicy?.timeoutHours ?? 120);
          setBusinessHoursOnly(configuration.cadencePolicy?.businessHoursOnly ?? true);
          setLowConfidenceThreshold(configuration.handoffPolicy?.lowConfidenceThreshold ?? 70);
          const enabled = new Set(configuration.allowedChannels || []);
          setAllowedChannels({ whatsapp: enabled.has('whatsapp'), email: enabled.has('email') });
        }
        setPublishedVersion(version?.number ?? null);
        setLoadSucceeded(true);
      })
      .catch(() => {
        if (mounted) {
          setLoadFailed(true);
          setSaveError('Não foi possível carregar a configuração publicada da Ana. Recarregue antes de editar ou publicar.');
        }
      })
      .finally(() => { if (mounted) setLoadingConfiguration(false); });
    return () => { mounted = false; };
  }, [loadAttempt]);

  const save = async () => {
    if (loadingConfiguration || !isDirty) return false;
    if (!loadSucceeded) {
      setSaveError('A configuração publicada ainda não foi confirmada. Recarregue antes de publicar.');
      return false;
    }
    const valuePropositionItems = splitPlaybookLines(valueProposition);
    const qualificationItems = splitPlaybookLines(qualificationQuestions, DEFAULT_QUALIFICATION_QUESTIONS);
    const handoffItems = splitPlaybookLines(handoffTriggers, DEFAULT_HANDOFF_TRIGGERS);
    const channelList = supportedChannels.filter((channel) => allowedChannels[channel.id]).map((channel) => channel.id);

    if (!channelList.length) {
      setSaveError('Selecione ao menos um canal permitido ou volte para revisar a configuração publicada.');
      return false;
    }
    if (![business, audience, greeting, signature, valueProposition, qualificationQuestions, handoffTriggers, approvedKnowledge].some((value) => value.trim())) {
      setSaveError('Informe ao menos um dado operacional antes de publicar a configuração da Ana.');
      return false;
    }

    setSaving(true);
    setSaveError('');
    try {
      const result = await saveAnaPersonalization({
        business,
        audience,
        greeting,
        signature,
        dailyMessageLimit: limit,
        valueProposition: valuePropositionItems,
        qualificationQuestions: qualificationItems,
        handoffTriggers: handoffItems,
        tone,
        approvedKnowledge: splitPlaybookLines(approvedKnowledge),
        quotePolicy: { requireHumanApproval: true, neverInventPrices: true, discountLimit },
        cadencePolicy: { firstFollowUpHours, secondFollowUpHours, timeoutHours, businessHoursOnly },
        handoffPolicy: { requireSummary: true, pauseAnaUntilReturn: true, lowConfidenceThreshold },
        allowedChannels: channelList,
        riskPolicy: { requireConsent: true, stopOnOptOut: true, pauseOnHighRisk: true },
      });
      setPublishedVersion(result.version.number);
      dirtyRef.current = false;
      setIsDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      return true;
    } catch (error) {
      console.error('[ana-settings] falha ao salvar configuração', error);
      setSaveError('Não foi possível confirmar a gravação no banco. Revise a conexão e tente novamente.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const continueOrPublish = () => {
    if (step === steps.length - 1) {
      void save();
      return;
    }
    setStep((current) => Math.min(steps.length - 1, current + 1));
  };

  const isPublicationStep = step === steps.length - 1;
  const publicationButtonLabel = saving
    ? 'Publicando...'
    : isPublicationStep
      ? isDirty
        ? 'Publicar alteração'
        : 'Altere algum campo para publicar'
      : 'Continuar';

  const content = [
    <>
      <div className="setup-note">A Ana usa estas informações apenas para apresentar a Wayflex e identificar o perfil certo de cliente.</div>
      <label>O que sua empresa oferece?</label>
      <input value={business} onChange={(event) => { markDirty(); setBusiness(event.target.value); }} placeholder="Ex.: desenvolvimento de sistemas" />
      <label className="mt">Quem é o cliente ideal?</label>
      <textarea value={audience} onChange={(event) => { markDirty(); setAudience(event.target.value); }} placeholder="Segmentos, decisores, região e necessidade principal" />
    </>,
    <>
      <div className="setup-note">A Ana só pode informar o que estiver no catálogo ou na <strong>Base aprovada da Ana</strong>. Quando não houver evidência suficiente, ela chama um humano.</div>
      <label>Quais diferenciais e ofertas a Ana pode apresentar?</label>
      <textarea value={valueProposition} onChange={(event) => { markDirty(); setValueProposition(event.target.value); }} placeholder="Um item por linha: diferencial, produto ou prova técnica" />
      <div className="mt rounded-lg border border-primary-200 bg-primary-50 p-4 text-sm text-primary-900">
        <strong>Documentos, fotos, apresentações, portfólio e vídeos:</strong> envie, revise e aprove o conteúdo que a Ana poderá consultar.
        <Link to="/dashboard/configuracoes?tab=empresa&subtab=fontes" className="mt-2 inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline">Abrir Base aprovada da Ana <i className="ri-arrow-right-line" /></Link>
      </div>
      <div className="mt rounded-lg border border-secondary-200 bg-secondary-50 p-4 text-sm text-secondary-900">
        <strong>Conteúdo oficial Wayflex disponível:</strong> a Base aprovada reúne catálogos, segmentos e acessórios com a página-fonte de cada item. A Ana usa esse material para orientar e qualificar; preço, prazo, certificação e especificação continuam sujeitos à validação humana/técnica.
      </div>
      <label className="mt">Resumo das fontes aprovadas</label>
      <textarea value={approvedKnowledge} onChange={(event) => { markDirty(); setApprovedKnowledge(event.target.value); }} placeholder="Um item por linha" />
    </>,
    <>
      <div className="setup-note">A Ana conversa em português, com uma pergunta e uma chamada para ação por vez. Ela não inventa informações comerciais.</div>
      <label>Tom de voz</label>
      <select value={tone} onChange={(event) => { markDirty(); setTone(event.target.value as typeof tone); }}>
        <option value="consultivo">Consultivo e profissional</option>
        <option value="direto">Direto e objetivo</option>
        <option value="acolhedor">Acolhedor e próximo</option>
        <option value="tecnico">Técnico e preciso</option>
      </select>
      <label className="mt">Saudação inicial</label>
      <textarea value={greeting} onChange={(event) => { markDirty(); setGreeting(event.target.value); }} />
      <label className="mt">Assinatura</label>
      <input value={signature} onChange={(event) => { markDirty(); setSignature(event.target.value); }} />
      <label className="mt">Perguntas de qualificação</label>
      <textarea value={qualificationQuestions} onChange={(event) => { markDirty(); setQualificationQuestions(event.target.value); }} placeholder="Uma pergunta por linha" />
    </>,
    <>
      <div className="setup-note">A Ana pode sugerir reunião e preparar orçamento, mas a proposta sempre nasce como rascunho para revisão humana.</div>
      <div className="rule-summary">
        <span>Orçamento é sempre rascunho</span>
        <span>Preço, prazo e item não são inventados</span>
        <span>Envio exige aprovação humana</span>
      </div>
      <label className="mt">Limite de desconto para revisão humana (%)</label>
      <input type="number" min="0" max="100" value={discountLimit} onChange={(event) => { markDirty(); setDiscountLimit(Number(event.target.value)); }} />
    </>,
    <>
      <div className="setup-note">A cadência pausa assim que o lead responde, pede para não receber mensagens ou um humano assume o atendimento.</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div><label>1º follow-up (horas)</label><input type="number" min="1" value={firstFollowUpHours} onChange={(event) => { markDirty(); setFirstFollowUpHours(Number(event.target.value)); }} /></div>
        <div><label>2º follow-up (horas)</label><input type="number" min="2" value={secondFollowUpHours} onChange={(event) => { markDirty(); setSecondFollowUpHours(Number(event.target.value)); }} /></div>
        <div><label>Revisar silêncio (horas)</label><input type="number" min="48" value={timeoutHours} onChange={(event) => { markDirty(); setTimeoutHours(Number(event.target.value)); }} /></div>
      </div>
      <label className="mt flex items-center gap-2"><input type="checkbox" checked={businessHoursOnly} onChange={(event) => { markDirty(); setBusinessHoursOnly(event.target.checked); }} /> Respeitar apenas o horário comercial configurado</label>
      <label className="mt">Quando a Ana deve chamar um humano?</label>
      <textarea value={handoffTriggers} onChange={(event) => { markDirty(); setHandoffTriggers(event.target.value); }} placeholder="Um gatilho por linha" />
      <label className="mt">Confiança mínima antes de seguir sem humano (%)</label>
      <input type="number" min="1" max="100" value={lowConfidenceThreshold} onChange={(event) => { markDirty(); setLowConfidenceThreshold(Number(event.target.value)); }} />
    </>,
    <>
      <div className="setup-note">Escolha apenas os canais em que a Ana pode atuar. A conexão e o teste de cada provedor continuam em <strong>Canais e conexões</strong>.</div>
      <label>Canais permitidos para a Ana</label>
      {supportedChannels.map((channel) => (
        <label key={channel.id} className="mt flex items-center gap-2"><input type="checkbox" checked={allowedChannels[channel.id]} onChange={(event) => { markDirty(); setAllowedChannels((current) => ({ ...current, [channel.id]: event.target.checked })); }} /> {channel.label}</label>
      ))}
      <label className="mt">Limite diário de mensagens por lead</label>
      <input type="number" min="1" max="20" value={limit} onChange={(event) => { markDirty(); setLimit(Number(event.target.value)); }} />
      <div className="review">
        <strong>{settings.organizacao.nomeComercial || settings.organizacao.nome || 'Sua empresa'}</strong>
        <span>{business || 'Oferta a configurar'}</span>
        <span>{splitPlaybookLines(valueProposition).length} ofertas aprovadas · {splitPlaybookLines(handoffTriggers).length} gatilhos de handoff</span>
        <span>{Object.values(allowedChannels).filter(Boolean).length} canais permitidos · limite de {limit} mensagens/dia</span>
      </div>
      <p className="hint">Consentimento, opt-out e pausa por risco alto são proteções obrigatórias. Publicar não liga nenhum canal real.</p>
    </>,
  ][step];

  return (
    <div className={`ana-config ${embedded ? 'w-full' : 'wf-page'} mx-auto`}>
      <header>
        <p className="eyebrow">Configurações · Ana</p>
        <h1>Configure a Ana</h1>
        <p>Em seis passos, defina como ela apresenta sua empresa, qualifica o lead e sugere o próximo passo com controle humano.</p>
        {loadingConfiguration ? <p className="hint mt-2">Carregando a configuração publicada…</p> : publishedVersion ? <p className="hint mt-2">Versão publicada em uso pela Ana: v{publishedVersion}.</p> : <p className="hint mt-2">Ainda não há uma versão publicada; salvar não ativa canais nem automações.</p>}
      </header>
      <section className="ana-map" aria-labelledby="ana-map-title">
        <div className="ana-map__heading">
          <div>
            <p className="eyebrow">Mapa de decisão</p>
            <h2 id="ana-map-title">Como a Ana usa esta configuração</h2>
            <p>Selecione um bloco para revisar as informações e regras daquela etapa.</p>
          </div>
          <span className={`ana-map__status ${isDirty ? 'is-pending' : ''}`}>
            <i className={isDirty ? 'ri-pencil-line' : 'ri-checkbox-circle-line'} aria-hidden="true" />
            {isDirty ? 'Alterações pendentes' : publishedVersion ? `Versão v${publishedVersion}` : 'Não publicada'}
          </span>
        </div>

        <nav className="ana-map__canvas" aria-label="Etapas da configuração da Ana">
          <div className="ana-map__identity">
            <span className="ana-map__identity-icon"><i className="ri-robot-2-line" aria-hidden="true" /></span>
            <span><strong>Ana</strong><small>Assistente de IA da Wayflex</small></span>
            <span className="ana-map__control"><i className="ri-shield-check-line" aria-hidden="true" /> Controle humano</span>
          </div>

          <span className="ana-map__connector" aria-hidden="true" />

          <button type="button" aria-current={step === 0 ? 'step' : undefined} onClick={() => setStep(0)} className={`ana-map__node ana-map__node--company ${step === 0 ? 'is-active' : ''}`}>
            <span className="ana-map__node-icon"><i className="ri-building-2-line" aria-hidden="true" /></span>
            <span className="ana-map__node-copy"><small>Etapa 1</small><strong>Empresa e público</strong><span>Contexto, oferta e cliente ideal</span></span>
            <i className="ri-arrow-right-s-line ana-map__open" aria-hidden="true" />
          </button>

          <span className="ana-map__connector" aria-hidden="true" />

          <button type="button" aria-current={step === 1 ? 'step' : undefined} onClick={() => setStep(1)} className={`ana-map__node ana-map__node--knowledge ${step === 1 ? 'is-active' : ''}`}>
            <span className="ana-map__node-icon"><i className="ri-book-open-line" aria-hidden="true" /></span>
            <span className="ana-map__node-copy"><small>Etapa 2 · Base aprovada</small><strong>Oferta permitida</strong><span>Somente fontes confiáveis e conteúdo aprovado</span></span>
            <i className="ri-arrow-right-s-line ana-map__open" aria-hidden="true" />
          </button>

          <div className="ana-map__branch" aria-label="Conteúdo oficial disponível para a Ana">
            <div className="ana-map__source">
              <i className="ri-file-list-3-line" aria-hidden="true" />
              <span><strong>17</strong><small>Catálogos oficiais</small></span>
            </div>
            <div className="ana-map__source">
              <i className="ri-pie-chart-2-line" aria-hidden="true" />
              <span><strong>18</strong><small>Segmentos industriais</small></span>
            </div>
            <div className="ana-map__source">
              <i className="ri-shopping-cart-2-line" aria-hidden="true" />
              <span><strong>18</strong><small>Famílias de acessórios</small></span>
            </div>
          </div>

          <span className="ana-map__merge ana-map__merge--three" aria-hidden="true" />
          <span className="ana-map__connector" aria-hidden="true" />

          <button type="button" aria-current={step === 2 ? 'step' : undefined} onClick={() => setStep(2)} className={`ana-map__node ana-map__node--conversation ${step === 2 ? 'is-active' : ''}`}>
            <span className="ana-map__node-icon"><i className="ri-question-answer-line" aria-hidden="true" /></span>
            <span className="ana-map__node-copy"><small>Etapa 3</small><strong>Conversa e qualificação</strong><span>Tom, apresentação e perguntas ao lead</span></span>
            <i className="ri-arrow-right-s-line ana-map__open" aria-hidden="true" />
          </button>

          <span className="ana-map__connector" aria-hidden="true" />
          <span className="ana-map__decision"><i className="ri-git-branch-line" aria-hidden="true" /> Próxima decisão</span>

          <div className="ana-map__decisions">
            <button type="button" aria-current={step === 3 ? 'step' : undefined} onClick={() => setStep(3)} className={`ana-map__node ana-map__node--commercial ${step === 3 ? 'is-active' : ''}`}>
              <span className="ana-map__node-icon"><i className="ri-calendar-check-line" aria-hidden="true" /></span>
              <span className="ana-map__node-copy"><small>Etapa 4</small><strong>Reunião e orçamento</strong><span>Lead pronto, sempre com aprovação humana</span></span>
              <i className="ri-arrow-right-s-line ana-map__open" aria-hidden="true" />
            </button>
            <button type="button" aria-current={step === 4 ? 'step' : undefined} onClick={() => setStep(4)} className={`ana-map__node ana-map__node--handoff ${step === 4 ? 'is-active' : ''}`}>
              <span className="ana-map__node-icon"><i className="ri-timer-line" aria-hidden="true" /></span>
              <span className="ana-map__node-copy"><small>Etapa 5</small><strong>Cadência e handoff</strong><span>Sem resposta, risco ou baixa confiança</span></span>
              <i className="ri-arrow-right-s-line ana-map__open" aria-hidden="true" />
            </button>
          </div>

          <span className="ana-map__merge ana-map__merge--two" aria-hidden="true" />
          <span className="ana-map__connector" aria-hidden="true" />

          <button type="button" aria-current={step === 5 ? 'step' : undefined} onClick={() => setStep(5)} className={`ana-map__node ana-map__node--publish ${step === 5 ? 'is-active' : ''}`}>
            <span className="ana-map__node-icon"><i className="ri-send-plane-line" aria-hidden="true" /></span>
            <span className="ana-map__node-copy"><small>Etapa 6</small><strong>Canais e publicar</strong><span>Revisão final; publicar não ativa canais</span></span>
            <i className="ri-arrow-right-s-line ana-map__open" aria-hidden="true" />
          </button>
        </nav>

        <div className="ana-map__pipeline" aria-label="Pipeline comercial canônico">
          <span>Novo</span><i className="ri-arrow-right-line" aria-hidden="true" />
          <span>Apresentado</span><i className="ri-arrow-right-line" aria-hidden="true" />
          <span>Qualificando</span><i className="ri-arrow-right-line" aria-hidden="true" />
          <span>Reunião</span><i className="ri-arrow-right-line" aria-hidden="true" />
          <span>Orçamento</span><i className="ri-arrow-right-line" aria-hidden="true" />
          <span>Ganho / Perdido</span>
        </div>
      </section>
      <section className="card">
        <div className="card-head">
          <div>
            <p className="eyebrow">Etapa {step + 1} de {steps.length}</p>
            <h2>{steps[step].title}</h2>
            <p className="hint">{steps[step].description}</p>
          </div>
        {saved && <span className="saved">Configuração publicada</span>}
        </div>
        <fieldset className="form" disabled={loadingConfiguration || !loadSucceeded || saving} style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}>{content}</fieldset>
        {isPublicationStep && loadSucceeded && !isDirty && !saved && (
          <p className="mx-6 mb-4 text-sm text-foreground-500" role="status">
            A versão v{publishedVersion ?? 'atual'} já está publicada. Altere algum campo para criar e publicar uma nova versão.
          </p>
        )}
        {saveError && <div className="mx-6 mb-4 rounded-xl border border-[#FF3B30]/25 bg-[#FF3B30]/10 px-4 py-3 text-sm text-[#D92D27]"><i className="ri-error-warning-line mr-2" />{saveError}{loadFailed && <button type="button" className="ml-2 font-semibold underline" onClick={() => setLoadAttempt((current) => current + 1)}>Tentar carregar novamente</button>}</div>}
        <footer>
          <button className="secondary" disabled={step === 0 || saving || loadingConfiguration} onClick={() => setStep((current) => current - 1)}>Voltar</button>
          <div className="form-actions">
            <button
              className="primary"
              disabled={saving || loadingConfiguration || (!loadSucceeded || (isPublicationStep && !isDirty))}
              title={isPublicationStep && !isDirty ? 'Edite algum campo para publicar uma nova versão.' : undefined}
              onClick={continueOrPublish}
            >
              {publicationButtonLabel}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
