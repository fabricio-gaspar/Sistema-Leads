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
import AnaAutomaticOperation from './AnaAutomaticOperation';
import './command-center.css';

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
  const initialParams = new URLSearchParams(window.location.search);
  const [section, setSection] = useState<'behavior' | 'operation'>(initialParams.get('section') === 'operation' ? 'operation' : 'behavior');
  const { settings } = useEmpresaSettingsStore();
  const requestedStep = Number(initialParams.get('step'));
  const [step, setStep] = useState(Number.isInteger(requestedStep) && requestedStep >= 0 && requestedStep < steps.length ? requestedStep : 0);
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
  const [catalogMediaImagesEnabled, setCatalogMediaImagesEnabled] = useState(false);
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

  const chooseSection = (nextSection: 'behavior' | 'operation') => {
    setSection(nextSection);
    const url = new URL(window.location.href);
    url.searchParams.set('section', nextSection);
    window.history.replaceState(null, '', url.toString());
  };

  const chooseStep = (nextStep: number) => {
    setStep(nextStep);
    const url = new URL(window.location.href);
    url.searchParams.set('section', 'behavior');
    url.searchParams.set('step', String(nextStep));
    window.history.replaceState(null, '', url.toString());
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
          setCatalogMediaImagesEnabled(configuration.catalogMediaImagesEnabled === true);
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
        catalogMediaImagesEnabled,
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
      <div className="mt rounded-lg border border-background-200 bg-background-100/40 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={catalogMediaImagesEnabled}
            disabled={!allowedChannels.whatsapp}
            onChange={(event) => { markDirty(); setCatalogMediaImagesEnabled(event.target.checked); }}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-semibold text-foreground-900"><i className="ri-image-line mr-1.5 text-primary-700" />Enviar imagem oficial quando houver correspondência confiável</span>
            <span className="mt-1 block text-xs leading-5 text-foreground-600">A Ana pode incluir uma única imagem pública de produto, serviço ou catálogo aprovado, com a própria legenda da resposta. Não envia imagem na apresentação inicial, em orçamento ou quando faltar correspondência confiável.</span>
          </span>
        </label>
        {!allowedChannels.whatsapp && <p className="mt-2 text-xs text-foreground-500">Ative o canal WhatsApp para liberar esta opção.</p>}
        {allowedChannels.whatsapp && !catalogMediaImagesEnabled && <p className="mt-2 text-xs text-foreground-500">Desligado por padrão até a homologação controlada do envio de mídia.</p>}
      </div>
      <label className="mt">Limite diário de mensagens por lead</label>
      <input type="number" min="1" max="20" value={limit} onChange={(event) => { markDirty(); setLimit(Number(event.target.value)); }} />
      <div className="review">
        <strong>{settings.organizacao.nomeComercial || settings.organizacao.nome || 'Sua empresa'}</strong>
        <span>{business || 'Oferta a configurar'}</span>
        <span>{splitPlaybookLines(valueProposition).length} ofertas aprovadas · {splitPlaybookLines(handoffTriggers).length} gatilhos de handoff</span>
        <span>{Object.values(allowedChannels).filter(Boolean).length} canais permitidos · limite de {limit} mensagens/dia</span>
        <span>{catalogMediaImagesEnabled ? 'Imagem oficial habilitada para correspondências confiáveis' : 'Imagem oficial da Ana desabilitada'}</span>
      </div>
      <p className="hint">Consentimento, opt-out e pausa por risco alto são proteções obrigatórias. Publicar não liga nenhum canal real nem testa o envio de mídia.</p>
    </>,
  ][step];

  return (
    <div className={`ana-config ana-cc ${embedded ? 'w-full' : 'wf-page'} mx-auto`}>
      <header className="ana-cc-header">
        <div>
          <p className="eyebrow">WayFlex / Inteligência comercial</p>
          <h1>Ana</h1>
          <p>Defina o conhecimento, a conversa e os limites antes de publicar uma nova versão.</p>
        </div>
        <span className={`ana-cc-version ${loadFailed ? 'is-error' : isDirty ? 'is-dirty' : loadSucceeded && publishedVersion ? 'is-published' : ''}`} role="status">
          <i className={loadFailed ? 'ri-error-warning-line' : isDirty ? 'ri-edit-circle-line' : loadSucceeded && publishedVersion ? 'ri-checkbox-circle-line' : 'ri-time-line'} aria-hidden="true" />
          {loadingConfiguration ? 'Conferindo versão' : loadFailed ? 'Falha na leitura' : isDirty ? 'Alterações não publicadas' : publishedVersion ? `Versão publicada · v${publishedVersion}` : 'Sem versão publicada'}
        </span>
      </header>
      <div className="ana-cc-summary" aria-label="Resumo da política da Ana">
        <div><span>Política publicada</span><strong>{loadingConfiguration ? 'Carregando' : loadFailed ? 'Indisponível' : publishedVersion ? `v${publishedVersion}` : 'Pendente'}</strong></div>
        <div><span>Canais permitidos</span><strong>{loadSucceeded ? Object.values(allowedChannels).filter(Boolean).length : '—'}</strong></div>
        <div><span>Limite por lead</span><strong>{loadSucceeded ? `${limit} / dia` : '—'}</strong></div>
      </div>
      <nav className="ana-cc-switch" aria-label="Áreas da configuração da Ana">
        <button type="button" onClick={() => chooseSection('behavior')} aria-current={section === 'behavior' ? 'page' : undefined} className={section === 'behavior' ? 'active' : ''}><i className="ri-message-3-line" aria-hidden="true" /> Comportamento e conhecimento</button>
        <button type="button" onClick={() => chooseSection('operation')} aria-current={section === 'operation' ? 'page' : undefined} className={section === 'operation' ? 'active' : ''}><i className="ri-robot-2-line" aria-hidden="true" /> Operação automática</button>
      </nav>
      {section === 'operation' ? <div className="ana-cc-operation"><AnaAutomaticOperation /></div> : <div className="ana-cc-workspace">
      <nav className="steps" aria-label="Etapas da configuração da Ana">
        {steps.map((item, index) => (
          <button key={item.title} type="button" title={`${index + 1}. ${item.title}`} aria-current={index === step ? 'step' : undefined} onClick={() => chooseStep(index)} className={index === step ? 'active' : index < step ? 'done' : ''}>
            <span>{index + 1}</span>
            <b>{item.title}</b>
            <small className="step-description">{item.description}</small>
          </button>
        ))}
      </nav>
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
        {saveError && <div className="mx-6 mb-4 rounded-xl border border-[#BD3D32]/25 bg-[#BD3D32]/10 px-4 py-3 text-sm text-[#A52F27]"><i className="ri-error-warning-line mr-2" />{saveError}{loadFailed && <button type="button" className="ml-2 font-semibold underline" onClick={() => setLoadAttempt((current) => current + 1)}>Tentar carregar novamente</button>}</div>}
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
      </div>}
    </div>
  );
}
