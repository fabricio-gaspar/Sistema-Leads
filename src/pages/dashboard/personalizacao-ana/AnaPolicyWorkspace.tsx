import { useEffect, useMemo, useState } from 'react';
import AnaAutomaticOperation from './AnaAutomaticOperation';
import {
  discardAnaPolicyDraft,
  loadAnaPolicy,
  publishAnaPolicy,
  saveAnaPolicyDraft,
  setAnaMasterEnabled,
  simulateAnaPolicy,
  type AnaModuleKey,
  type AnaPolicy,
  type AnaPolicyState,
} from '@/lib/crm/anaPolicyRepository';
import './policy-workspace.css';

const modules: Array<{ key: AnaModuleKey; name: string; description: string }> = [
  { key: 'company', name: 'Empresa e público', description: 'Como a Ana apresenta a Wayflex.' },
  { key: 'offer', name: 'Oferta permitida', description: 'Produtos, serviços e fontes aprovadas.' },
  { key: 'conversation', name: 'Conversa e qualificação', description: 'Tom, perguntas e respostas.' },
  { key: 'commercial', name: 'Reunião e orçamento', description: 'Ações que precisam de aprovação.' },
  { key: 'cadence', name: 'Cadência e handoff', description: 'Acompanhamento e transferência.' },
  { key: 'channels', name: 'Canais e publicar', description: 'Onde a Ana pode atuar.' },
];

const emptyPolicy: AnaPolicy = {
  modules: Object.fromEntries(modules.map(({ key }) => [key, { enabled: true, reviewed: false }])) as AnaPolicy['modules'],
  limits: { channels: [], perLead: 10, humanApproval: true, stopOnOptOut: true },
};

function copyPolicy(policy: AnaPolicy): AnaPolicy { return JSON.parse(JSON.stringify(policy)) as AnaPolicy; }
function lines(value: unknown): string { return Array.isArray(value) ? value.join('\n') : typeof value === 'string' ? value : ''; }
function setLines(value: string): string[] { return value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 20); }

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={`ana-toggle ${checked ? 'is-on' : ''}`}><span /></button>;
}

export default function AnaPolicyWorkspace() {
  const [state, setState] = useState<AnaPolicyState | null>(null);
  const [policy, setPolicy] = useState<AnaPolicy>(emptyPolicy);
  const [selected, setSelected] = useState<AnaModuleKey>('company');
  const [view, setView] = useState<'policy' | 'operation' | 'history'>('policy');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [simulation, setSimulation] = useState<{ question: string; response: string; modules: string[]; sources: string[]; rules: string[]; decision: string } | null>(null);
  const [question, setQuestion] = useState('Como a Wayflex pode me ajudar?');

  const refresh = async () => {
    setLoading(true);
    try { const next = await loadAnaPolicy(); setState(next); setPolicy(copyPolicy(next.policy)); setNotice(null); }
    catch { setNotice({ tone: 'error', text: 'Não foi possível carregar a política da Ana. Nenhuma alteração foi aplicada.' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);

  const draft = Boolean(state?.draft);
  const selectedModule = modules.find((item) => item.key === selected) ?? modules[0];
  const activeCount = useMemo(() => modules.filter(({ key }) => policy.modules[key]?.enabled).length, [policy]);
  const change = (next: AnaPolicy) => { setPolicy(next); setNotice(null); };
  const updateModule = (key: AnaModuleKey, enabled: boolean) => {
    if (!enabled && ['commercial', 'cadence', 'channels'].includes(key) && !window.confirm(`Desativar ${modules.find((item) => item.key === key)?.name}? Novas ações desse módulo serão interrompidas.`)) return;
    const next = copyPolicy(policy); next.modules[key] = { ...next.modules[key], enabled, reviewed: false }; change(next);
  };
  const saveDraft = async () => { setBusy('save'); try { const next = await saveAnaPolicyDraft(policy); setState(next); setPolicy(copyPolicy(next.policy)); setNotice({ tone: 'success', text: 'Rascunho salvo. A produção continua usando a versão publicada.' }); } catch { setNotice({ tone: 'error', text: 'Não foi possível salvar o rascunho.' }); } finally { setBusy(null); } };
  const publish = async () => {
    if (!window.confirm('Publicar esta política? A versão publicada passa a valer para novas decisões da Ana.')) return;
    setBusy('publish'); try { const next = await publishAnaPolicy(policy); setState(next); setPolicy(copyPolicy(next.policy)); setNotice({ tone: 'success', text: `Política v${next.published?.number ?? ''} publicada e registrada na auditoria.` }); } catch (error) { setNotice({ tone: 'error', text: error instanceof Error && error.message === 'ana_policy_channel_required' ? 'Selecione ao menos um canal permitido antes de publicar.' : 'A publicação foi bloqueada pela validação do backend.' }); } finally { setBusy(null); }
  };
  const discard = async () => { if (!window.confirm('Descartar o rascunho atual? Esta ação não altera a versão publicada.')) return; setBusy('discard'); try { const next = await discardAnaPolicyDraft(); setState(next); setPolicy(copyPolicy(next.policy)); setNotice({ tone: 'success', text: 'Rascunho descartado.' }); } catch { setNotice({ tone: 'error', text: 'Não foi possível descartar o rascunho.' }); } finally { setBusy(null); } };
  const toggleMaster = async (enabled: boolean) => {
    if (enabled && state?.canUseIa !== true) { setNotice({ tone: 'error', text: 'A Ana só pode ser ativada depois que a IA for validada em Configurações > APIs.' }); return; }
    if (!enabled && !window.confirm('Pausar a Ana? Novas ações automáticas serão interrompidas; histórico e atendimento humano permanecem intactos.')) return;
    setBusy('master'); try { const next = await setAnaMasterEnabled(enabled); setState(next); setNotice({ tone: 'success', text: enabled ? 'Ana ativada.' : 'Ana pausada; atendimento humano preservado.' }); } catch { setNotice({ tone: 'error', text: 'Não foi possível atualizar o estado mestre da Ana.' }); } finally { setBusy(null); }
  };
  const simulate = async () => { setBusy('simulate'); try { const result = await simulateAnaPolicy(question); setSimulation(result.simulation); setNotice({ tone: 'success', text: 'Simulação concluída sem enviar mensagem ou alterar produção.' }); } catch { setNotice({ tone: 'error', text: 'Não foi possível executar a simulação.' }); } finally { setBusy(null); } };

  const textField = (label: string, value: string, onChange: (value: string) => void, multiline = false) => <label className="ana-field"><span>{label}</span>{multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} /> : <input value={value} onChange={(event) => onChange(event.target.value)} />}</label>;
  const policyContent = () => {
    if (selected === 'company') return <>{textField('O que sua empresa oferece?', String(policy.business ?? ''), (value) => change({ ...policy, business: value }))}{textField('Quem é o cliente ideal?', String(policy.audience ?? ''), (value) => change({ ...policy, audience: value }), true)}<div className="ana-safety-note"><i className="ri-information-line" /> Escopo atual: apresentação e qualificação. Sem envio automático neste módulo.</div></>;
    if (selected === 'offer') return <>{textField('Ofertas e diferenciais permitidos', lines(policy.valueProposition), (value) => change({ ...policy, valueProposition: setLines(value) }), true)}{textField('Conhecimento aprovado', lines(policy.approvedKnowledge), (value) => change({ ...policy, approvedKnowledge: setLines(value) }), true)}<p className="ana-help">A Ana deve responder somente com itens cadastrados e fontes revisadas no catálogo.</p></>;
    if (selected === 'conversation') return <>{textField('Saudação inicial', String(policy.greeting ?? ''), (value) => change({ ...policy, greeting: value }), true)}{textField('Perguntas de qualificação', lines(policy.qualificationQuestions), (value) => change({ ...policy, qualificationQuestions: setLines(value) }), true)}<div className="ana-inline-field"><span>Tom de voz</span><select value={String(policy.tone ?? 'tecnico')} onChange={(event) => change({ ...policy, tone: event.target.value })}><option value="tecnico">Técnico e preciso</option><option value="consultivo">Consultivo e profissional</option><option value="direto">Direto e objetivo</option><option value="acolhedor">Acolhedor e próximo</option></select></div></>;
    if (selected === 'commercial') return <><div className="ana-safety-note"><i className="ri-shield-check-line" /> Preço, desconto, reunião e orçamento exigem revisão humana.</div><div className="ana-grid-fields">{textField('Desconto máximo (%)', String((policy.quotePolicy as Record<string, unknown> | undefined)?.discountLimit ?? 0), (value) => change({ ...policy, quotePolicy: { ...(policy.quotePolicy as Record<string, unknown> ?? {}), discountLimit: Number(value) || 0 } }))}{textField('Limite por lead', String(policy.limits.perLead), (value) => change({ ...policy, limits: { ...policy.limits, perLead: Number(value) || 1 } }))}</div></>;
    if (selected === 'cadence') return <>{textField('Gatilhos de transferência', lines(policy.handoffTriggers), (value) => change({ ...policy, handoffTriggers: setLines(value) }), true)}<div className="ana-grid-fields">{textField('1º follow-up (horas)', String((policy.cadencePolicy as Record<string, unknown> | undefined)?.firstFollowUpHours ?? 24), (value) => change({ ...policy, cadencePolicy: { ...(policy.cadencePolicy as Record<string, unknown> ?? {}), firstFollowUpHours: Number(value) || 24 } }))}{textField('Revisar silêncio (horas)', String((policy.cadencePolicy as Record<string, unknown> | undefined)?.timeoutHours ?? 120), (value) => change({ ...policy, cadencePolicy: { ...(policy.cadencePolicy as Record<string, unknown> ?? {}), timeoutHours: Number(value) || 120 } }))}</div><div className="ana-safety-note"><i className="ri-stop-circle-line" /> Opt-out pausa a cadência automaticamente.</div></>;
    return <><div className="ana-channel-list">{['whatsapp', 'email'].map((channel) => <label key={channel}><input type="checkbox" checked={policy.limits.channels.includes(channel)} onChange={(event) => change({ ...policy, limits: { ...policy.limits, channels: event.target.checked ? [...policy.limits.channels, channel] : policy.limits.channels.filter((item) => item !== channel) } })} />{channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}</label>)}</div><p className="ana-help">A conexão real e o teste dos provedores continuam em Configurações &gt; Canais e APIs.</p></>;
  };

  return <div className="ana-policy-page">
    <header className="ana-policy-header"><div><p className="wf-eyebrow">Administração</p><h1>Configurar a Ana</h1><p>Política comercial, limites e publicação.</p></div><div className="ana-policy-header-actions"><span className={`ana-published-badge ${state?.masterEnabled ? 'is-active' : ''}`}><i className="ri-checkbox-circle-line" /> Versão publicada · v{state?.published?.number ?? '—'}</span><label className="ana-master"><span>Ana ativa</span><Toggle checked={state?.masterEnabled === true} onChange={toggleMaster} label="Ativar ou pausar a Ana" disabled={busy === 'master' || loading} /><b>{state?.masterEnabled ? 'Ativa' : 'Pausada'}</b></label><button type="button" className="ana-outline-button" onClick={() => setView('history')}><i className="ri-history-line" /> Histórico</button><button type="button" className="ana-outline-button" onClick={() => setView('operation')}><i className="ri-play-line" /> Testar em sandbox</button><button type="button" className="ana-dark-button" onClick={publish} disabled={busy !== null || loading}><i className="ri-upload-cloud-2-line" /> Revisar e publicar</button></div></header>
    {draft && <div className="ana-draft-alert"><div><i className="ri-file-edit-line" /><span><strong>Rascunho v{state?.draft?.number} com alterações</strong><small>Nada muda nas conversas até a publicação.</small></span></div><button type="button" onClick={() => setView('history')}>Comparar versões <i className="ri-arrow-right-line" /></button></div>}
    {notice && <div className={`ana-notice ${notice.tone}`} role="status"><i className={notice.tone === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} />{notice.text}</div>}
    <nav className="ana-policy-tabs" aria-label="Áreas da configuração"><button className={view === 'policy' ? 'active' : ''} onClick={() => setView('policy')}><i className="ri-sliders-3-line" /> Política comercial</button><button className={view === 'operation' ? 'active' : ''} onClick={() => setView('operation')}><i className="ri-settings-3-line" /> Operação automática</button><button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}><i className="ri-history-line" /> Histórico</button></nav>
    {loading ? <div className="ana-policy-loading">Conferindo a política publicada…</div> : view === 'operation' ? <AnaAutomaticOperation /> : view === 'history' ? <section className="ana-history-panel"><div className="ana-panel-title"><div><p className="wf-eyebrow">Auditoria</p><h2>Histórico da Ana</h2><p>Publicações, pausas, rascunhos e simulações.</p></div></div>{(state?.audit ?? []).length === 0 ? <p className="ana-help">Nenhum evento registrado.</p> : <div className="ana-history-list">{state?.audit.map((event) => <div key={event.id}><span className="ana-history-icon"><i className="ri-history-line" /></span><div><strong>{event.action.replace('ana.', '').replaceAll('_', ' ')}</strong><small>{event.detail || 'Sem detalhe adicional.'}</small><em>{event.actor_name || 'Sistema'} · {new Date(event.created_at).toLocaleString('pt-BR')}</em></div></div>)}</div>}</section> : <><div className="ana-policy-workspace"><aside className="ana-module-panel"><div className="ana-panel-title"><div><h2>Módulos da política</h2><p>Ative e configure cada módulo da Ana.</p></div></div>{modules.map((item, index) => <button type="button" key={item.key} className={`ana-module-row ${selected === item.key ? 'selected' : ''}`} onClick={() => setSelected(item.key)}><span className="ana-module-number">{index + 1}</span><span className="ana-module-copy"><strong>{item.name}</strong><small>{item.description}</small></span><span className={`ana-module-state ${policy.modules[item.key].enabled ? 'on' : 'off'}`}>{policy.modules[item.key].enabled ? 'Ativo' : 'Desativado'}</span><Toggle checked={policy.modules[item.key].enabled} onChange={(value) => updateModule(item.key, value)} label={`Usar módulo ${item.name}`} /></button>)}</aside><main className="ana-module-editor"><div className="ana-panel-title"><div><p className="wf-eyebrow">Módulo {modules.findIndex((item) => item.key === selected) + 1} de 6</p><h2>{selectedModule.name}</h2><p>{selectedModule.description}</p></div><div className="ana-editor-status"><span className="ana-reviewed-badge">{policy.modules[selected].reviewed ? 'Revisado' : 'Em revisão'}</span><label>Usar este módulo <Toggle checked={policy.modules[selected].enabled} onChange={(value) => updateModule(selected, value)} label={`Usar este módulo: ${selectedModule.name}`} /></label></div></div><div className="ana-editor-content">{policyContent()}</div><footer className="ana-editor-footer"><button type="button" className="ana-outline-button" onClick={saveDraft} disabled={busy !== null}><i className="ri-file-edit-line" /> {busy === 'save' ? 'Salvando…' : 'Salvar rascunho'}</button><button type="button" className="ana-dark-button" onClick={() => setSelected(modules[(modules.findIndex((item) => item.key === selected) + 1) % modules.length].key)}>Continuar <i className="ri-arrow-right-line" /></button></footer></main><aside className="ana-side-stack"><section className="ana-side-card"><div className="ana-panel-title"><div><h2>Limites e segurança</h2><p>Controles ativos nesta política.</p></div></div><div className="ana-side-stat"><span><i className="ri-message-3-line" /> Canais permitidos</span><strong>{policy.limits.channels.length}</strong></div><div className="ana-side-stat"><span><i className="ri-bar-chart-line" /> Limite por lead</span><strong>{policy.limits.perLead} / dia</strong></div><div className="ana-side-stat"><span><i className="ri-user-follow-line" /> Aprovação humana</span><b><Toggle checked={policy.limits.humanApproval} onChange={(value) => change({ ...policy, limits: { ...policy.limits, humanApproval: value } })} label="Exigir aprovação humana" />{policy.limits.humanApproval ? 'Ativo' : 'Desativado'}</b></div><div className="ana-side-stat"><span><i className="ri-pause-circle-line" /> Pausa por opt-out</span><b><Toggle checked={policy.limits.stopOnOptOut} onChange={(value) => change({ ...policy, limits: { ...policy.limits, stopOnOptOut: value } })} label="Pausar por opt-out" />{policy.limits.stopOnOptOut ? 'Ativo' : 'Desativado'}</b></div></section><section className="ana-side-card ana-sandbox-card"><div className="ana-panel-title"><div><h2>Teste seguro</h2><p>Simule sem enviar mensagens.</p></div></div><textarea value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Pergunta da simulação" /><button type="button" className="ana-outline-button full" onClick={simulate} disabled={busy !== null}><i className="ri-play-line" /> {busy === 'simulate' ? 'Simulando…' : 'Abrir simulador'}</button>{simulation && <div className="ana-simulation-result"><strong>Resposta prevista</strong><p>{simulation.response}</p><small>Módulos: {simulation.modules.join(', ') || 'nenhum'}</small><small>Fontes: {simulation.sources.join(', ')}</small><small>Regras: {simulation.rules.join(' · ')}</small></div>}</section></aside></div><div className="ana-activity-strip"><div><i className="ri-time-line" /><span><strong>Atividade recente</strong><small>Últimas alterações registradas nesta política.</small></span></div><span>{activeCount} de 6 módulos ativos · {state?.audit.length ?? 0} eventos</span></div>{draft && <div className="ana-sticky-bar"><span><i className="ri-alert-line" /> Alterações não publicadas</span><button type="button" className="ana-outline-button" onClick={discard} disabled={busy !== null}>Descartar</button><button type="button" className="ana-outline-button" onClick={saveDraft} disabled={busy !== null}>Salvar rascunho</button><button type="button" className="ana-dark-button" onClick={publish} disabled={busy !== null}>Revisar e publicar</button></div>}</>}
  </div>;
}
