import { useState } from 'react';
import type { CampoIntegracao } from '@/mocks/businessData';
import { useIntegracoesStore, type OperationalIntegration } from '@/hooks/useIntegracoesStore';
import { useFontesStore } from '@/hooks/useFontesStore';
import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

const statusMeta = {
  conectado: { label: 'Pronta', className: 'border-[#34C759]/25 bg-[#34C759]/12 text-[#218838]' },
  pendente: { label: 'Offline', className: 'border-[#E5E5EA] bg-[#F2F2F7] text-[#6E6E73]' },
  erro: { label: 'Offline · erro', className: 'border-[#FF3B30]/25 bg-[#FF3B30]/10 text-[#D92D27]' },
  sandbox: { label: 'Protegida', className: 'border-[#AF52DE]/25 bg-[#AF52DE]/10 text-[#7A2CAD]' },
};

function errorMessage(code: string, name: string) {
  const messages: Record<string, string> = {
    integration_credentials_missing: `Salve as credenciais de ${name} antes de testar.`,
    source_credentials_missing: `Revise as credenciais de ${name} e salve novamente.`,
    source_not_configured: `${name} ainda não foi configurada.`,
    provider_error: `${name} recusou a validação. Confira chave, permissões e conta.`,
    ai_provider_required: 'Escolha OpenAI ou Claude como provedor principal.',
    ai_provider_key_required: 'Informe a chave do provedor principal selecionado.',
    ai_provider_key_missing: 'A chave do provedor principal não foi encontrada no cofre.',
    ai_provider_invalid: 'O provedor principal salvo não é válido. Configure OpenAI ou Claude novamente.',
    organization_access_denied: 'Seu usuário não possui permissão administrativa para configurar esta conexão.',
  };
  return messages[code] || `Não foi possível validar ${name}. ${code || 'Tente novamente.'}`;
}

function CredentialField({ field, value, onChange }: { field: CampoIntegracao; value: string; onChange: (value: string) => void }) {
  const inputClass = 'w-full rounded-xl border border-[#E5E5EA] bg-[#F2F2F7] px-3.5 py-2.5 text-sm text-[#1D1D1F] placeholder:text-[#86868B] outline-none transition focus:border-[#0071E3] focus:bg-white focus:ring-2 focus:ring-[#0071E3]/20';
  return <label className="block text-sm font-semibold text-[#3A3A3C]"><span className="mb-1.5 block">{field.rotulo}{field.obrigatorio && <span className="ml-1 text-[#FF3B30]">*</span>}</span>{field.tipo === 'selecao' ? <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Selecione…</option>{(field.opcoes || []).map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input className={inputClass} type={field.tipo === 'senha' ? 'password' : 'text'} value={value} placeholder={field.placeholder} autoComplete="off" onChange={(event) => onChange(event.target.value)} />}{field.ajuda && <span className="mt-1.5 block text-xs font-normal text-[#86868B]">{field.ajuda}</span>}</label>;
}

function ConfigureModal({ integration, onClose, onSaved }: { integration: OperationalIntegration; onClose: () => void; onSaved: () => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    const missing = integration.campos.filter((field) => field.obrigatorio && !values[field.id]?.trim()).map((field) => field.rotulo);
    if (integration.remoteKey === 'apify' && !values.actor_id?.trim() && !values.task_id?.trim()) missing.push('Actor ID ou Task ID');
    if (missing.length) { setError(`Preencha: ${[...new Set(missing)].join(', ')}.`); return; }
    setSaving(true); setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('configurar-integracao', { body: { canal: integration.remoteKey, credenciais: values } });
      if (invokeError || !data?.ok) throw new Error(data?.erro || await detalheDoErroDeFuncao(invokeError));
      await onSaved();
      onClose();
    } catch (cause) { setError(errorMessage(cause instanceof Error ? cause.message : '', integration.nome)); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1D1D1F]/45 p-4" onClick={onClose}><section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E5E5EA] bg-white shadow-xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-[#E5E5EA] px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#0071E3]">Cofre seguro</p><h3 className="mt-1 text-lg font-bold tracking-tight text-[#1D1D1F]">Configurar {integration.nome}</h3><p className="mt-1 text-xs text-[#6E6E73]">As chaves são enviadas diretamente ao backend e não permanecem no navegador.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-[#6E6E73] hover:bg-[#F2F2F7]" aria-label="Fechar"><i className="ri-close-line text-lg" /></button></header><div className="space-y-4 p-5">{error && <div className="rounded-xl border border-[#FF3B30]/25 bg-[#FF3B30]/10 px-3.5 py-3 text-sm text-[#D92D27]">{error}</div>}{integration.campos.map((field) => <CredentialField key={field.id} field={field} value={values[field.id] || ''} onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))} />)}</div><footer className="flex justify-end gap-2 border-t border-[#E5E5EA] px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={saving} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar credenciais'}</button></footer></section></div>;
}

export default function IntegracoesTab({ category }: { category?: OperationalIntegration['operationalCategory'] }) {
  const { integracoes, recarregar } = useIntegracoesStore();
  const { recarregar: recarregarFontes } = useFontesStore();
  const [configuring, setConfiguring] = useState<OperationalIntegration | null>(null);
  const [testing, setTesting] = useState<OperationalIntegration['remoteKey'] | null>(null);
  const [notice, setNotice] = useState('');

  const refresh = async () => { await Promise.all([recarregar(), recarregarFontes()]); };
  const test = async (integration: OperationalIntegration) => {
    setTesting(integration.remoteKey); setNotice('');
    try {
      const { data, error } = await supabase.functions.invoke('testar-integracao', { body: { canal: integration.remoteKey } });
      if (error || !data?.pronto) throw new Error(error ? await detalheDoErroDeFuncao(error) : data?.erro || data?.detalhe);
      await refresh();
      setNotice(`${integration.nome} foi validada. O teste não gerou conversa nem enviou mensagem a leads.`);
    } catch (cause) { setNotice(errorMessage(cause instanceof Error ? cause.message : '', integration.nome)); }
    finally { setTesting(null); }
  };

  const visibleIntegrations = category ? integracoes.filter((integration) => integration.operationalCategory === category) : integracoes;

  return <div className="space-y-4">
    {notice && <div className="rounded-xl border border-[#0071E3]/20 bg-[#0071E3]/8 px-4 py-3 text-sm text-[#1559A6]">{notice}</div>}
    <div className="rounded-xl border border-[#0071E3]/20 bg-[#F2F7FF] px-4 py-3 text-sm text-[#365B83]"><strong>Fonte única.</strong> Os estados abaixo vêm da tabela de integrações da empresa. “Configurar” guarda segredos no cofre do backend; “Testar” apenas valida o provedor.</div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {visibleIntegrations.map((integration) => {
        const meta = statusMeta[integration.status];
        return <article key={integration.remoteKey} className="flex min-h-[224px] flex-col rounded-2xl border border-[#E5E5EA] bg-white p-4 shadow-2xs"><div className="flex items-start justify-between gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F2F2F7] text-[#0071E3]"><i className={`${integration.icone} text-base`} /></div><span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${meta.className}`}>{meta.label}</span></div><h3 className="mt-3 text-sm font-bold text-[#1D1D1F]">{integration.nome}</h3><p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-[#6E6E73]">{integration.descricao}</p><div className="mt-3 space-y-1 text-[10px] text-[#86868B]"><p>Último teste: {integration.ultimoTeste}</p>{integration.lastError && <p className="line-clamp-2 text-[#D92D27]">{integration.lastError}</p>}</div><div className="mt-auto grid grid-cols-2 gap-2 pt-3"><button type="button" onClick={() => setConfiguring(integration)} className="wf-btn-secondary justify-center text-xs">Configurar</button><button type="button" disabled={testing === integration.remoteKey} onClick={() => void test(integration)} className="wf-btn-primary justify-center text-xs disabled:opacity-60">{testing === integration.remoteKey ? 'Validando…' : 'Testar'}</button></div></article>;
      })}
    </div>
    {visibleIntegrations.length === 0 && <div className="rounded-2xl border border-dashed border-[#E5E5EA] bg-white p-6 text-sm text-[#6E6E73]">Nenhum conector desta categoria está disponível para esta empresa.</div>}
    {configuring && <ConfigureModal integration={configuring} onClose={() => setConfiguring(null)} onSaved={refresh} />}
  </div>;
}
