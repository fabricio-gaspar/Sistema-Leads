import { useState } from 'react';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import { saveAnaPersonalization } from '@/lib/crm/anaPersonalizationRepository';
import { DEFAULT_HANDOFF_TRIGGERS, DEFAULT_QUALIFICATION_QUESTIONS, joinPlaybookLines, splitPlaybookLines } from '@/lib/anaCommercialPlaybook';

const steps = ['Negócio', 'Cliente ideal', 'Oferta', 'Voz', 'Qualificação', 'Limites', 'Revisar'];

export default function PersonalizacaoAna() {
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
  const save = async () => {
    const valuePropositionItems = splitPlaybookLines(valueProposition);
    const qualificationItems = splitPlaybookLines(qualificationQuestions, DEFAULT_QUALIFICATION_QUESTIONS);
    const handoffItems = splitPlaybookLines(handoffTriggers, DEFAULT_HANDOFF_TRIGGERS);
    setSaving(true);
    try {
      salvar({ ramo: business, publico: audience, saudacao: greeting, assinatura: signature, limiteMensagens: limit, diferenciais: valuePropositionItems });
      await saveAnaPersonalization({ business, audience, greeting, signature, dailyMessageLimit: limit, valueProposition: valuePropositionItems, qualificationQuestions: qualificationItems, handoffTriggers: handoffItems });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };
  const content = [
    <><label>O que sua empresa oferece?</label><input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Ex.: desenvolvimento de sistemas" /></>,
    <><label>Quem é o cliente ideal?</label><textarea value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Segmentos, decisores, região e necessidade principal" /></>,
    <><label>Quais diferenciais e ofertas a Ana pode apresentar?</label><textarea value={valueProposition} onChange={(e) => setValueProposition(e.target.value)} placeholder="Um item por linha: diferenciais, catálogo, prova técnica ou condição comercial" /><p className="hint">A Ana usa apenas estas informações da sua empresa ao responder. Não há conteúdo compartilhado entre organizações.</p></>,
    <><label>Saudação inicial</label><textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} /><label className="mt">Assinatura</label><input value={signature} onChange={(e) => setSignature(e.target.value)} /></>,
    <><label>Quais perguntas a Ana deve priorizar?</label><textarea value={qualificationQuestions} onChange={(e) => setQualificationQuestions(e.target.value)} placeholder="Uma pergunta por linha" /><p className="hint">Ela usa essas perguntas para qualificar antes de preparar um orçamento ou sugerir reunião.</p></>,
    <><label>Quando a Ana deve chamar um humano?</label><textarea value={handoffTriggers} onChange={(e) => setHandoffTriggers(e.target.value)} placeholder="Um gatilho por linha" /><label className="mt">Limite diário de mensagens por lead</label><input type="number" min="1" max="20" value={limit} onChange={(e) => setLimit(Number(e.target.value))} /><p className="hint">Urgência, reclamação, desconto ou negociação continuam exigindo controle humano.</p></>,
    <><label>Pronto para revisar</label><div className="review"><strong>{settings.organizacao.nomeComercial || settings.organizacao.nome || 'Sua empresa'}</strong><span>{business || 'Oferta a configurar'}</span><span>{audience || 'Cliente ideal a configurar'}</span><span>{splitPlaybookLines(valueProposition).length} diferenciais publicados</span><span>{splitPlaybookLines(handoffTriggers).length} gatilhos de handoff</span><span>Limite: {limit} mensagens/dia</span></div><p className="hint">A publicação fica vinculada à sua organização. Nenhum canal é ativado por esta tela.</p></>,
  ][step];
  return <div className="p-4 md:p-6 max-w-4xl mx-auto"><header><p className="eyebrow">Configuração guiada</p><h1>Personalização da Ana</h1><p>Configure uma assistente comercial clara, supervisionada e preparada para transferir ao humano.</p></header><div className="steps">{steps.map((name, index) => <button key={name} onClick={() => setStep(index)} className={index === step ? 'active' : index < step ? 'done' : ''}><span>{index + 1}</span>{name}</button>)}</div><section className="card"><div className="card-head"><div><p className="eyebrow">Etapa {step + 1} de {steps.length}</p><h2>{steps[step]}</h2></div>{saved && <span className="saved">Personalização publicada</span>}</div><div className="form">{content}</div><footer><button className="secondary" disabled={step === 0 || saving} onClick={() => setStep((n) => n - 1)}>Voltar</button><div><button className="secondary" disabled={saving} onClick={() => void save()}>Salvar rascunho</button><button className="primary" disabled={saving} onClick={() => { void save(); setStep((n) => Math.min(steps.length - 1, n + 1)); }}>{saving ? 'Salvando...' : step === steps.length - 1 ? 'Salvar revisão' : 'Salvar e continuar'}</button></div></footer></section></div>;
}
