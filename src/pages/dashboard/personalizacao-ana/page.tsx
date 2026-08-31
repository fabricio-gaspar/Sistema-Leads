import { useState } from 'react';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import { saveAnaPersonalization } from '@/lib/crm/anaPersonalizationRepository';
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

export default function PersonalizacaoAna({ embedded = false }: { embedded?: boolean }) {
  const { settings, salvar } = useEmpresaSettingsStore();
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
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
    'Site institucional da Wayflex\nCatálogo de soluções em borracha, silicone e poliuretano\nInformações técnicas e políticas comerciais aprovadas',
  );
  const [discountLimit, setDiscountLimit] = useState(0);
  const [firstFollowUpHours, setFirstFollowUpHours] = useState(24);
  const [secondFollowUpHours, setSecondFollowUpHours] = useState(72);
  const [timeoutHours, setTimeoutHours] = useState(120);
  const [businessHoursOnly, setBusinessHoursOnly] = useState(true);
  const [allowedChannels, setAllowedChannels] = useState({ whatsapp: true, email: true, instagram: false, voice: false });
  const [lowConfidenceThreshold, setLowConfidenceThreshold] = useState(70);

  const save = async () => {
    const valuePropositionItems = splitPlaybookLines(valueProposition);
    const qualificationItems = splitPlaybookLines(qualificationQuestions, DEFAULT_QUALIFICATION_QUESTIONS);
    const handoffItems = splitPlaybookLines(handoffTriggers, DEFAULT_HANDOFF_TRIGGERS);

    setSaving(true);
    try {
      salvar({
        ramo: business,
        publico: audience,
        saudacao: greeting,
        assinatura: signature,
        limiteMensagens: limit,
        diferenciais: valuePropositionItems,
      });
      await saveAnaPersonalization({
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
        allowedChannels: Object.entries(allowedChannels).filter(([, enabled]) => enabled).map(([channel]) => channel),
        riskPolicy: { requireConsent: true, stopOnOptOut: true, pauseOnHighRisk: true },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const saveAndContinue = async () => {
    await save();
    setStep((current) => Math.min(steps.length - 1, current + 1));
  };

  const content = [
    <>
      <div className="setup-note">A Ana usa estas informações apenas para apresentar a Wayflex e identificar o perfil certo de cliente.</div>
      <label>O que sua empresa oferece?</label>
      <input value={business} onChange={(event) => setBusiness(event.target.value)} placeholder="Ex.: desenvolvimento de sistemas" />
      <label className="mt">Quem é o cliente ideal?</label>
      <textarea value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Segmentos, decisores, região e necessidade principal" />
    </>,
    <>
      <div className="setup-note">A Ana só pode informar o que estiver aprovado aqui ou no catálogo. Quando não tiver base, ela chama um humano.</div>
      <label>Quais diferenciais e ofertas a Ana pode apresentar?</label>
      <textarea value={valueProposition} onChange={(event) => setValueProposition(event.target.value)} placeholder="Um item por linha: diferencial, produto ou prova técnica" />
      <label className="mt">Quais fontes de conhecimento estão aprovadas?</label>
      <textarea value={approvedKnowledge} onChange={(event) => setApprovedKnowledge(event.target.value)} placeholder="Um item por linha" />
    </>,
    <>
      <div className="setup-note">A Ana conversa em português, com uma pergunta e uma chamada para ação por vez. Ela não inventa informações comerciais.</div>
      <label>Tom de voz</label>
      <select value={tone} onChange={(event) => setTone(event.target.value as typeof tone)}>
        <option value="consultivo">Consultivo e profissional</option>
        <option value="direto">Direto e objetivo</option>
        <option value="acolhedor">Acolhedor e próximo</option>
        <option value="tecnico">Técnico e preciso</option>
      </select>
      <label className="mt">Saudação inicial</label>
      <textarea value={greeting} onChange={(event) => setGreeting(event.target.value)} />
      <label className="mt">Assinatura</label>
      <input value={signature} onChange={(event) => setSignature(event.target.value)} />
      <label className="mt">Perguntas de qualificação</label>
      <textarea value={qualificationQuestions} onChange={(event) => setQualificationQuestions(event.target.value)} placeholder="Uma pergunta por linha" />
    </>,
    <>
      <div className="setup-note">A Ana pode sugerir reunião e preparar orçamento, mas a proposta sempre nasce como rascunho para revisão humana.</div>
      <div className="rule-summary">
        <span>Orçamento é sempre rascunho</span>
        <span>Preço, prazo e item não são inventados</span>
        <span>Envio exige aprovação humana</span>
      </div>
      <label className="mt">Desconto máximo sem nova aprovação (%)</label>
      <input type="number" min="0" max="100" value={discountLimit} onChange={(event) => setDiscountLimit(Number(event.target.value))} />
    </>,
    <>
      <div className="setup-note">A cadência pausa assim que o lead responde, pede para não receber mensagens ou um humano assume o atendimento.</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div><label>1º follow-up (horas)</label><input type="number" min="1" value={firstFollowUpHours} onChange={(event) => setFirstFollowUpHours(Number(event.target.value))} /></div>
        <div><label>2º follow-up (horas)</label><input type="number" min="2" value={secondFollowUpHours} onChange={(event) => setSecondFollowUpHours(Number(event.target.value))} /></div>
        <div><label>Revisar silêncio (horas)</label><input type="number" min="48" value={timeoutHours} onChange={(event) => setTimeoutHours(Number(event.target.value))} /></div>
      </div>
      <label className="mt flex items-center gap-2"><input type="checkbox" checked={businessHoursOnly} onChange={(event) => setBusinessHoursOnly(event.target.checked)} /> Respeitar apenas o horário comercial configurado</label>
      <label className="mt">Quando a Ana deve chamar um humano?</label>
      <textarea value={handoffTriggers} onChange={(event) => setHandoffTriggers(event.target.value)} placeholder="Um gatilho por linha" />
      <label className="mt">Confiança mínima antes de seguir sem humano (%)</label>
      <input type="number" min="1" max="100" value={lowConfidenceThreshold} onChange={(event) => setLowConfidenceThreshold(Number(event.target.value))} />
    </>,
    <>
      <div className="setup-note">Escolha apenas os canais em que a Ana pode atuar. A conexão e o teste de cada provedor continuam em <strong>Canais e conexões</strong>.</div>
      <label>Canais permitidos para a Ana</label>
      {([{ id: 'whatsapp', label: 'WhatsApp' }, { id: 'email', label: 'E-mail' }, { id: 'instagram', label: 'Instagram / Meta' }, { id: 'voice', label: 'VoIP (futuro)' }] as const).map((channel) => (
        <label key={channel.id} className="mt flex items-center gap-2"><input type="checkbox" checked={allowedChannels[channel.id]} onChange={(event) => setAllowedChannels((current) => ({ ...current, [channel.id]: event.target.checked }))} /> {channel.label}</label>
      ))}
      <label className="mt">Limite diário de mensagens por lead</label>
      <input type="number" min="1" max="20" value={limit} onChange={(event) => setLimit(Number(event.target.value))} />
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
        <p>Em seis passos, defina como ela apresenta sua empresa, qualifica o lead, agenda reunião e prepara orçamento com controle humano.</p>
      </header>
      <nav className="steps" aria-label="Etapas da configuração da Ana">
        {steps.map((item, index) => (
          <button key={item.title} type="button" title={`${index + 1}. ${item.title}`} aria-current={index === step ? 'step' : undefined} onClick={() => setStep(index)} className={index === step ? 'active' : index < step ? 'done' : ''}>
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
          {saved && <span className="saved">Configuração salva</span>}
        </div>
        <div className="form">{content}</div>
        <footer>
          <button className="secondary" disabled={step === 0 || saving} onClick={() => setStep((current) => current - 1)}>Voltar</button>
          <div className="form-actions">
            <button className="secondary" disabled={saving} onClick={() => void save()}>Salvar rascunho</button>
            <button className="primary" disabled={saving} onClick={() => void saveAndContinue()}>{saving ? 'Salvando...' : step === steps.length - 1 ? 'Publicar configuração' : 'Salvar e continuar'}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
