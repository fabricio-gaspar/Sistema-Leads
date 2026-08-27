import { useState } from 'react';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';

const steps = ['Negócio', 'Cliente ideal', 'Oferta', 'Voz', 'Qualificação', 'Limites', 'Revisar'];

export default function PersonalizacaoAna() {
  const { settings, salvar } = useEmpresaSettingsStore();
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [business, setBusiness] = useState(settings.ramo);
  const [audience, setAudience] = useState(settings.publico);
  const [greeting, setGreeting] = useState(settings.saudacao);
  const [signature, setSignature] = useState(settings.assinatura);
  const [limit, setLimit] = useState(settings.limiteMensagens);
  const save = () => { salvar({ ramo: business, publico: audience, saudacao: greeting, assinatura: signature, limiteMensagens: limit }); setSaved(true); setTimeout(() => setSaved(false), 2500); };
  const content = [
    <><label>O que sua empresa oferece?</label><input value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Ex.: desenvolvimento de sistemas" /></>,
    <><label>Quem é o cliente ideal?</label><textarea value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Segmentos, decisores, região e necessidade principal" /></>,
    <><label>Como a Ana deve conduzir o orçamento?</label><p className="hint">A Ana qualifica, esclarece e encaminha. A proposta é sempre tratada como orçamento; não há checkout ou cobrança direta.</p></>,
    <><label>Saudação inicial</label><textarea value={greeting} onChange={(e) => setGreeting(e.target.value)} /><label className="mt">Assinatura</label><input value={signature} onChange={(e) => setSignature(e.target.value)} /></>,
    <><label>Qualificação</label><p className="hint">A Ana coleta contexto, necessidade, prazo e faixa de investimento antes de sugerir o próximo passo.</p></>,
    <><label>Limite diário de mensagens por lead</label><input type="number" min="1" max="20" value={limit} onChange={(e) => setLimit(Number(e.target.value))} /><p className="hint">Transferências, baixa confiança, pedido de desconto sensível e opt-out exigem controle humano.</p></>,
    <><label>Pronto para revisar</label><div className="review"><strong>{settings.organizacao.nomeComercial || settings.organizacao.nome || 'Sua empresa'}</strong><span>{business || 'Oferta a configurar'}</span><span>{audience || 'Cliente ideal a configurar'}</span><span>Limite: {limit} mensagens/dia</span></div><p className="hint">Salvar mantém tudo como rascunho. Nenhum canal é ativado por esta tela.</p></>,
  ][step];
  return <div className="p-4 md:p-6 max-w-4xl mx-auto"><header><p className="eyebrow">Configuração guiada</p><h1>Personalização da Ana</h1><p>Configure uma assistente comercial clara, supervisionada e preparada para transferir ao humano.</p></header><div className="steps">{steps.map((name, index) => <button key={name} onClick={() => setStep(index)} className={index === step ? 'active' : index < step ? 'done' : ''}><span>{index + 1}</span>{name}</button>)}</div><section className="card"><div className="card-head"><div><p className="eyebrow">Etapa {step + 1} de {steps.length}</p><h2>{steps[step]}</h2></div>{saved && <span className="saved">Rascunho salvo</span>}</div><div className="form">{content}</div><footer><button className="secondary" disabled={step === 0} onClick={() => setStep((n) => n - 1)}>Voltar</button><div><button className="secondary" onClick={save}>Salvar rascunho</button><button className="primary" onClick={() => { save(); setStep((n) => Math.min(steps.length - 1, n + 1)); }}>{step === steps.length - 1 ? 'Salvar revisão' : 'Salvar e continuar'}</button></div></footer></section></div>;
}
