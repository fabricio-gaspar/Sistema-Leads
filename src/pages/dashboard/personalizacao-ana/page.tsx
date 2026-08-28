import { useState } from 'react';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import { saveAnaPersonalization } from '@/lib/crm/anaPersonalizationRepository';
import { DEFAULT_HANDOFF_TRIGGERS, DEFAULT_QUALIFICATION_QUESTIONS, joinPlaybookLines, splitPlaybookLines } from '@/lib/anaCommercialPlaybook';

const steps = ['Negócio', 'Oferta e base', 'Voz', 'Qualificação', 'Orçamentos', 'Cadências', 'Handoff', 'Canais', 'Limites e risco', 'Revisar'];

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
  const [handoffTriggers, setHandoffTriggers] = useState(joinPlaybookLines(settings.handoff.filter((rule) => rule.status !== 'inativo').map((rule) => rule.gatilho)) || joinPlaybookLines(DEFAULT_HANDOFF_TRIGGERS));
  const [tone, setTone] = useState<'consultivo' | 'direto' | 'acolhedor' | 'tecnico'>('tecnico');
  const [approvedKnowledge, setApprovedKnowledge] = useState('Site institucional da Wayflex\nCatálogo de soluções em borracha, silicone e poliuretano\nInformações de peças técnicas sob medida, vedação, reposição e projetos especiais\nCertificação ISO 9001:2015\nPolítica comercial publicada');
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
      salvar({ ramo: business, publico: audience, saudacao: greeting, assinatura: signature, limiteMensagens: limit, diferenciais: valuePropositionItems });
      await saveAnaPersonalization({
        business, audience, greeting, signature, dailyMessageLimit: limit,
        valueProposition: valuePropositionItems, qualificationQuestions: qualificationItems, handoffTriggers: handoffItems,
        tone, approvedKnowledge: splitPlaybookLines(approvedKnowledge),
        quotePolicy: { requireHumanApproval: true, neverInventPrices: true, discountLimit },
        cadencePolicy: { firstFollowUpHours, secondFollowUpHours, timeoutHours, businessHoursOnly },
        handoffPolicy: { requireSummary: true, pauseAnaUntilReturn: true, lowConfidenceThreshold },
        allowedChannels: Object.entries(allowedChannels).filter(([, enabled]) => enabled).map(([channel]) => channel),
        riskPolicy: { requireConsent: true, stopOnOptOut: true, pauseOnHighRisk: true },
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };
  const content = [
    <><label>O que sua empresa oferece?</label><input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Ex.: desenvolvimento de sistemas" /><label className="mt">Quem é o cliente ideal?</label><textarea value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Segmentos, decisores, região e necessidade principal" /></>,
    <><label>Quais diferenciais e ofertas a Ana pode apresentar?</label><textarea value={valueProposition} onChange={(e) => setValueProposition(e.target.value)} placeholder="Um item por linha: diferenciais, catálogo, prova técnica ou condição comercial" /><label className="mt">Quais fontes de conhecimento estão aprovadas?</label><textarea value={approvedKnowledge} onChange={(e) => setApprovedKnowledge(e.target.value)} placeholder="Um item por linha" /><p className="hint">A Ana só pode usar catálogo, documentos e políticas aprovadas por esta empresa. Sem base aprovada, ela transfere o atendimento.</p></>,
    <><label>Tom de voz</label><select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}><option value="consultivo">Consultivo e profissional</option><option value="direto">Direto e objetivo</option><option value="acolhedor">Acolhedor e próximo</option><option value="tecnico">Técnico e preciso</option></select><label className="mt">Saudação inicial</label><textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} /><label className="mt">Assinatura</label><input value={signature} onChange={(e) => setSignature(e.target.value)} /></>,
    <><label>Quais perguntas a Ana deve priorizar?</label><textarea value={qualificationQuestions} onChange={(e) => setQualificationQuestions(e.target.value)} placeholder="Uma pergunta por linha" /><p className="hint">Ela usa essas perguntas para qualificar antes de preparar um orçamento ou sugerir reunião.</p></>,
    <><label>Regra de orçamento</label><p className="hint">A Ana prepara rascunhos somente com o catálogo aprovado; nunca inventa preço, prazo ou item. O envio e qualquer desconto seguem aprovação humana.</p><label className="mt">Desconto máximo sem nova aprovação (%)</label><input type="number" min="0" max="100" value={discountLimit} onChange={(e) => setDiscountLimit(Number(e.target.value))} /></>,
    <><label>Cadência de contato</label><div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div><label>1º follow-up (h)</label><input type="number" min="1" value={firstFollowUpHours} onChange={(e) => setFirstFollowUpHours(Number(e.target.value))} /></div><div><label>2º follow-up (h)</label><input type="number" min="2" value={secondFollowUpHours} onChange={(e) => setSecondFollowUpHours(Number(e.target.value))} /></div><div><label>Encerrar por silêncio (h)</label><input type="number" min="3" value={timeoutHours} onChange={(e) => setTimeoutHours(Number(e.target.value))} /></div></div><label className="mt flex items-center gap-2"><input type="checkbox" checked={businessHoursOnly} onChange={(e) => setBusinessHoursOnly(e.target.checked)} /> Respeitar apenas o horário comercial configurado</label></>,
    <><label>Quando a Ana deve chamar um humano?</label><textarea value={handoffTriggers} onChange={(e) => setHandoffTriggers(e.target.value)} placeholder="Um gatilho por linha" /><label className="mt">Confiança mínima antes de seguir sem humano (%)</label><input type="number" min="1" max="100" value={lowConfidenceThreshold} onChange={(e) => setLowConfidenceThreshold(Number(e.target.value))} /><p className="hint">A transferência pausa a Ana, registra motivo, resumo, prioridade e próxima ação até alguém devolver o atendimento.</p></>,
    <><label>Canais permitidos para a Ana</label>{([{ id: 'whatsapp', label: 'WhatsApp' }, { id: 'email', label: 'E-mail' }, { id: 'instagram', label: 'Instagram / Meta' }, { id: 'voice', label: 'VoIP (futuro)' }] as const).map((channel) => <label key={channel.id} className="mt flex items-center gap-2"><input type="checkbox" checked={allowedChannels[channel.id]} onChange={(e) => setAllowedChannels((current) => ({ ...current, [channel.id]: e.target.checked }))} /> {channel.label}</label>)}<p className="hint">Ativar aqui não conecta provedores. A conexão e o teste continuam em Canais e integrações.</p></>,
    <><label>Limites, consentimento e risco</label><label className="mt">Limite diário de mensagens por lead</label><input type="number" min="1" max="20" value={limit} onChange={(e) => setLimit(Number(e.target.value))} /><div className="review"><span>Consentimento obrigatório antes de novos disparos</span><span>Opt-out bloqueia novas cadências</span><span>Risco alto do WhatsApp pausa envios da Ana</span></div><p className="hint">Essas proteções são obrigatórias e não podem ser desativadas por uma configuração comercial.</p></>,
    <><label>Pronto para revisar e publicar</label><div className="review"><strong>{settings.organizacao.nomeComercial || settings.organizacao.nome || 'Sua empresa'}</strong><span>{business || 'Oferta a configurar'}</span><span>{tone} · {splitPlaybookLines(approvedKnowledge).length} fontes aprovadas</span><span>{splitPlaybookLines(valueProposition).length} diferenciais publicados</span><span>{splitPlaybookLines(handoffTriggers).length} gatilhos de handoff</span><span>{Object.values(allowedChannels).filter(Boolean).length} canais permitidos</span><span>Limite: {limit} mensagens/dia</span></div><p className="hint">A publicação fica vinculada à sua organização e cria uma versão auditável da Ana. Nenhum canal é ativado por esta tela.</p></>,
  ][step];
  return <div className={`ana-config ${embedded ? 'w-full' : 'wf-page'} mx-auto`}><header><p className="eyebrow">Configurações · Personalização</p><h1>Personalização da Ana</h1><p>Defina em um único lugar como a Ana representa sua empresa, qualifica oportunidades e transfere decisões para um humano.</p></header><nav className="steps" aria-label="Etapas da personalização">{steps.map((name, index) => <button key={name} type="button" title={`${index + 1}. ${name}`} aria-current={index === step ? 'step' : undefined} onClick={() => setStep(index)} className={index === step ? 'active' : index < step ? 'done' : ''}><span>{index + 1}</span><b>{name}</b></button>)}</nav><section className="card"><div className="card-head"><div><p className="eyebrow">Etapa {step + 1} de {steps.length}</p><h2>{steps[step]}</h2></div>{saved && <span className="saved">Personalização publicada</span>}</div><div className="form">{content}</div><footer><button className="secondary" disabled={step === 0 || saving} onClick={() => setStep((n) => n - 1)}>Voltar</button><div className="form-actions"><button className="secondary" disabled={saving} onClick={() => void save()}>Salvar rascunho</button><button className="primary" disabled={saving} onClick={() => { void save(); setStep((n) => Math.min(steps.length - 1, n + 1)); }}>{saving ? 'Salvando...' : step === steps.length - 1 ? 'Salvar revisão' : 'Salvar e continuar'}</button></div></footer></section></div>;
}
