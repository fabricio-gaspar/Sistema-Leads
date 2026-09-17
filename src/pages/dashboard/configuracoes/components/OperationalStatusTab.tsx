import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { activateRealEnvironment, activateServerScheduler, configureWhatsAppInbound, loadOperationalStatus, setOperationalKillSwitch, type OperationalStatus } from '@/lib/crm/operationalDiagnosticsRepository';
import TestLeadCleanupPanel from './TestLeadCleanupPanel';

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString('pt-BR') : 'Ainda não registrado';
}

function inboundActionLabel(state: OperationalStatus['webhookDiagnostic']['state']): string {
  if (state === 'not_configured') return 'Cadastrar entrada na Z-API';
  if (state === 'credentials_changed') return 'Atualizar entrada Z-API';
  if (state === 'homologated') return 'Entrada homologada';
  return 'Recadastrar entrada';
}

export default function OperationalStatusTab() {
  const [status, setStatus] = useState<OperationalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [settingUp, setSettingUp] = useState<'whatsapp' | 'scheduler' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestedSetup = new URLSearchParams(window.location.search).get('setup');

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setStatus(await loadOperationalStatus()); setError(''); }
    catch { setError('Não foi possível consultar o estado operacional. Atualize e tente novamente.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const setupWhatsAppInbound = async () => {
    if (settingUp) return;
    setSettingUp('whatsapp'); setError(''); setNotice('');
    try {
      const result = await configureWhatsAppInbound();
      setStatus(result.status); setNotice(result.message);
    } catch {
      setError('Não foi possível cadastrar a entrada da Z-API. A saída validada foi preservada; revise a conexão do WhatsApp e tente novamente.');
    } finally { setSettingUp(null); }
  };

  const setupScheduler = async () => {
    if (settingUp) return;
    setSettingUp('scheduler'); setError(''); setNotice('');
    try {
      const result = await activateServerScheduler();
      setStatus(result.status); setNotice(result.message);
    } catch {
      setError('Não foi possível preparar o worker server-side. Nenhuma automação real foi liberada; tente novamente ou consulte o Registro do Sistema.');
    } finally { setSettingUp(null); }
  };

  const changeKillSwitch = async () => {
    if (!status || changing) return;
    const next = !status.killSwitch;
    const message = next
      ? 'Pausar toda automação da Ana agora? Nenhuma nova ação automática será liberada enquanto a pausa estiver ligada.'
      : 'Liberar a automação? Os demais requisitos de segurança ainda serão verificados pelo servidor.';
    if (!window.confirm(message)) return;
    setChanging(true);
    try { setStatus(await setOperationalKillSwitch(next)); setError(''); }
    catch { setError('A pausa global não foi atualizada. O estado anterior foi preservado.'); }
    finally { setChanging(false); }
  };

  const prepareRealEnvironment = async () => {
    if (!status || changing) return;
    if (!window.confirm('Verificar e preparar o Ambiente Real? O servidor aplicará somente as etapas internas seguras.')) return;
    setChanging(true);
    try {
      const result = await activateRealEnvironment();
      setStatus(result.status); setNotice(result.message); setError('');
    }
    catch { setError('Não foi possível concluir a preparação. As proteções atuais foram preservadas.'); }
    finally { setChanging(false); }
  };

  if (loading) return <div className="wf-surface p-6 text-sm text-foreground-500">Consultando o estado operacional…</div>;
  if (!status) return <div className="wf-surface p-6 text-sm text-accent-700">{error || 'Estado operacional indisponível.'}</div>;
  const webhookCheck = status.checks.find((item) => item.id === 'whatsapp_webhook');
  const whatsappCheck = status.checks.find((item) => item.id === 'whatsapp');
  const inbound = status.webhookDiagnostic;

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800">{error}</div>}
      {notice && <div className="rounded-xl border border-[#34C759]/25 bg-[#34C759]/10 px-4 py-3 text-sm text-[#237A3B]">{notice}</div>}
      <section className="wf-surface overflow-hidden" aria-label="Assistente de ativação">
        <div className="border-b border-background-200/70 px-5 py-4 md:px-6">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Assistente de ativação</p>
          <h2 className="mt-1 font-heading text-lg font-bold text-foreground-950">Conclua cada etapa no módulo certo</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-foreground-500">A validação da instância Z-API e a entrada das respostas são etapas diferentes. O assistente registra o que é seguro no backend e só pede uma ação externa quando ela for indispensável.</p>
        </div>
        <div className="grid gap-3 p-5 lg:grid-cols-2 md:p-6">
          <article className={`rounded-2xl border p-4 ${requestedSetup === 'whatsapp-webhook' ? 'border-primary-300 bg-primary-50' : 'border-background-200 bg-background-50/60'}`}>
            <div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-700"><i className="ri-chat-check-line text-lg" /></div><span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold ${webhookCheck?.ok ? 'border-[#34C759]/25 bg-[#34C759]/10 text-[#237A3B]' : 'border-[#FF9500]/25 bg-[#FF9500]/10 text-[#B76100]'}`}>{webhookCheck?.ok ? 'HOMOLOGADO' : 'PENDENTE'}</span></div>
            <h3 className="mt-3 text-sm font-bold text-foreground-950">1. Receber respostas do WhatsApp</h3>
            <p className="mt-1 text-xs leading-relaxed text-foreground-500">{inbound.detail}</p>
            {inbound.state === 'waiting_callback' && <div className="mt-3 rounded-xl border border-[#FF9500]/25 bg-[#FF9500]/10 px-3 py-2.5 text-xs leading-relaxed text-[#8A5200]"><strong className="block text-[#754600]">O que falta agora</strong>{inbound.testLead ? <>No WhatsApp do contato <strong>{inbound.testLead.label}</strong> (final <strong>{inbound.testLead.phoneSuffix}</strong>), envie uma mensagem individual para o número conectado à Z-API. Depois clique em “Atualizar diagnóstico”.</> : <>Cadastre um lead com WhatsApp antes de realizar o teste. O sistema não cria um lead fictício para liberar o ambiente.</>}</div>}
            {inbound.state === 'credentials_changed' && <div className="mt-3 rounded-xl border border-[#FF9500]/25 bg-[#FF9500]/10 px-3 py-2.5 text-xs leading-relaxed text-[#8A5200]"><strong className="block text-[#754600]">A entrada precisa ser atualizada.</strong>As credenciais da instância mudaram desde o último cadastro. Atualize a entrada abaixo; depois envie uma mensagem individual do lead para concluir a homologação.</div>}
            {inbound.state === 'lead_not_matched' && <div className="mt-3 rounded-xl border border-[#FF3B30]/25 bg-[#FF3B30]/10 px-3 py-2.5 text-xs leading-relaxed text-[#A52620]"><strong className="block">A mensagem chegou, mas não pertence a um lead cadastrado.</strong>Abra o lead usado no teste, confira o WhatsApp salvo e envie outra mensagem somente depois de corrigir o número.</div>}
            {inbound.state === 'unsupported_callback' && <div className="mt-3 rounded-xl border border-[#FF9500]/25 bg-[#FF9500]/10 px-3 py-2.5 text-xs leading-relaxed text-[#8A5200]"><strong className="block text-[#754600]">O callback chegou, mas não vale como resposta individual.</strong>{inbound.detail} Depois, clique em “Atualizar diagnóstico”.</div>}
            <ol className="mt-3 space-y-1.5 text-xs leading-relaxed text-foreground-600"><li><strong>1.</strong> {whatsappCheck?.ok ? 'A instância Z-API já está validada para saída.' : 'Valide primeiro a instância Z-API no módulo de Canais.'}</li><li><strong>2.</strong> {inbound.state === 'not_configured' ? 'Cadastre a entrada abaixo; nenhum token ou URL ficará exposto.' : inbound.state === 'credentials_changed' ? 'As credenciais foram atualizadas; recadastre a entrada abaixo antes do próximo teste.' : `A entrada foi cadastrada em ${formatDate(inbound.registeredAt)}.`}</li><li><strong>3.</strong> Envie uma mensagem de texto direta de um <Link to="/dashboard/leads" className="font-semibold text-primary-700 hover:underline">lead cadastrado</Link> para o WhatsApp conectado à Z-API. A Ana registra e analisa a entrada quando o fluxo estiver homologado.</li></ol>
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void setupWhatsAppInbound()} disabled={settingUp === 'whatsapp' || !whatsappCheck?.ok || webhookCheck?.ok} className="wf-btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-60"><i className="ri-link" />{settingUp === 'whatsapp' ? 'Cadastrando…' : !whatsappCheck?.ok ? 'Valide o WhatsApp primeiro' : inboundActionLabel(inbound.state)}</button><button type="button" onClick={() => void refresh()} className="wf-btn-secondary text-xs"><i className="ri-refresh-line" />Atualizar diagnóstico</button><Link to="/dashboard/configuracoes?tab=conexoes" className="wf-btn-secondary text-xs">Ver canal WhatsApp</Link></div>
          </article>
          <article className={`rounded-2xl border p-4 ${requestedSetup === 'worker' ? 'border-primary-300 bg-primary-50' : 'border-background-200 bg-background-50/60'}`}>
            <div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5856D6]/10 text-[#5856D6]"><i className="ri-server-line text-lg" /></div><span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold ${status.checks.find((item) => item.id === 'scheduler')?.ok ? 'border-[#34C759]/25 bg-[#34C759]/10 text-[#237A3B]' : 'border-[#FF9500]/25 bg-[#FF9500]/10 text-[#B76100]'}`}>{status.checks.find((item) => item.id === 'scheduler')?.ok ? 'ATIVO' : 'PENDENTE'}</span></div>
            <h3 className="mt-3 text-sm font-bold text-foreground-950">2. Processar automações 24/7</h3>
            <p className="mt-1 text-xs leading-relaxed text-foreground-500">{status.checks.find((item) => item.id === 'scheduler')?.detail}</p>
            <ol className="mt-3 space-y-1.5 text-xs leading-relaxed text-foreground-600"><li>Ao preparar, o sistema cria uma credencial interna no cofre e ativa o agendador do servidor.</li><li>Você não precisa cadastrar chave, e-mail ou URL para este módulo.</li><li>Enquanto o heartbeat não for confirmado, o backend mantém automações externas bloqueadas.</li></ol>
            <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void setupScheduler()} disabled={settingUp === 'scheduler' || status.checks.find((item) => item.id === 'scheduler')?.ok} className="wf-btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-60"><i className="ri-play-circle-line" />{settingUp === 'scheduler' ? 'Preparando…' : status.checks.find((item) => item.id === 'scheduler')?.ok ? 'Worker ativo' : 'Preparar worker 24/7'}</button><button type="button" onClick={() => void refresh()} className="wf-btn-secondary text-xs"><i className="ri-refresh-line" />Verificar heartbeat</button></div>
          </article>
        </div>
      </section>
      <section className="wf-surface p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Fonte operacional</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-foreground-950">{status.mode === 'real' ? status.productionReady ? 'Ambiente Real ativo' : 'Ambiente Real ativo · automação em preparação' : 'Ambiente Real em preparação'}</h2>
            <p className="mt-1 max-w-2xl text-sm text-foreground-500">
              Este estado vem diretamente da empresa e das integrações. Nenhum botão nesta tela altera o navegador para simular produção.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${status.productionReady ? 'border-primary-200 bg-primary-50 text-primary-800' : 'border-accent-200 bg-accent-50 text-accent-800'}`}>
              <span className={`h-2 w-2 rounded-full ${status.productionReady ? 'bg-primary-500' : 'bg-accent-500'}`} />
              {status.productionReady ? 'Automação pronta' : status.mode === 'real' ? 'Comunicação ativa · automação pendente' : 'Verificações pendentes'}
            </div>
            <button
              type="button"
              disabled={changing || status.productionReady}
              onClick={() => void prepareRealEnvironment()}
              className={`wf-btn text-xs disabled:cursor-not-allowed disabled:opacity-50 ${status.productionReady ? 'wf-btn-secondary' : 'wf-btn-primary'}`}
              title={!status.productionReady ? 'O servidor verificará a preparação e exibirá somente as pendências reais.' : undefined}
            >
              <i className={status.productionReady ? 'ri-shield-check-line' : 'ri-rocket-line'} />
              {changing ? 'Atualizando…' : status.productionReady ? 'Automação pronta' : 'Verificar preparação'}
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {status.checks.map((check) => (
            <div key={check.id} className={`rounded-xl border p-3 ${check.ok ? 'border-primary-100 bg-primary-50/50' : 'border-background-200 bg-background-100/60'}`}>
              <div className="flex items-center gap-2"><i className={`${check.ok ? 'ri-checkbox-circle-fill text-primary-600' : 'ri-error-warning-line text-accent-600'}`} /><p className="text-xs font-semibold text-foreground-800">{check.label}</p></div>
              <p className="mt-1 text-xs leading-relaxed text-foreground-500">{check.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <TestLeadCleanupPanel />

      <section className="wf-surface p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-950">Pausa global da automação</h3>
            <p className="mt-1 text-sm text-foreground-500">Este é o kill switch consultado pela Ana e pela fila de saída.</p>
          </div>
          <button type="button" onClick={() => void changeKillSwitch()} disabled={changing} className={`wf-btn ${status.killSwitch ? 'wf-btn-primary' : 'wf-btn-secondary'} disabled:opacity-60`}>
            <i className={status.killSwitch ? 'ri-play-circle-line' : 'ri-pause-circle-line'} />
            {changing ? 'Atualizando…' : status.killSwitch ? 'Liberar automação' : 'Pausar automação'}
          </button>
        </div>
        <p className={`mt-4 rounded-xl px-3 py-2 text-xs ${status.killSwitch ? 'bg-accent-50 text-accent-800' : 'bg-primary-50 text-primary-800'}`}>
          {status.killSwitch ? 'A automação está pausada pelo controle global.' : 'A pausa global está desligada; a Ana ainda exige os demais requisitos acima antes de agir.'}
        </p>
      </section>

      <section className="wf-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-background-200/70 px-5 py-4">
          <div><h3 className="font-heading font-bold text-foreground-950">Conexões verificadas</h3><p className="mt-0.5 text-xs text-foreground-500">Status remoto, sem presets locais.</p></div>
          <button type="button" onClick={() => void refresh()} className="wf-btn-secondary text-xs"><i className="ri-refresh-line" />Atualizar</button>
        </div>
        <div className="divide-y divide-background-200/70">
          {status.integrations.map((item) => (
            <div key={item.key} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-semibold text-foreground-800">{item.label}</p><p className="text-xs text-foreground-500">{item.detail || item.provider || 'Sem detalhe de status.'}</p></div>
              <div className="text-left sm:text-right"><span className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold ${item.health === 'online' ? 'border-[#34C759]/25 bg-[#34C759]/10 text-[#237A3B]' : item.health === 'stale' ? 'border-[#FF9500]/25 bg-[#FF9500]/10 text-[#B76100]' : 'border-[#FF3B30]/25 bg-[#FF3B30]/10 text-[#D92D27]'}`}>{item.health === 'online' ? 'ONLINE' : item.health === 'stale' ? 'VALIDAÇÃO VENCIDA' : 'OFFLINE'}</span><p className="mt-1 text-[11px] text-foreground-400">Última validação: {formatDate(item.lastTestedAt)}</p></div>
            </div>
          ))}
          {status.integrations.length === 0 && <p className="px-5 py-8 text-sm text-foreground-500">Nenhuma conexão foi configurada para esta empresa.</p>}
        </div>
      </section>
    </div>
  );
}
