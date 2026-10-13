import { useState } from 'react';
import type { CampoIntegracao } from '@/mocks/businessData';
import type { OperationalIntegration } from '@/hooks/useIntegracoesStore';
import { supabase } from '@/lib/supabase';
import { detalheDoErroDeFuncao } from '@/lib/transportador';

function errorMessage(code: string, name: string) {
  const messages: Record<string, string> = {
    integration_credentials_missing: `Salve as credenciais de ${name} antes de testar.`,
    apify_credentials_missing: 'A credencial da Apify não foi encontrada no cofre. Configure a fonte novamente.',
    source_credentials_missing: `Revise as credenciais de ${name} e salve novamente.`,
    source_not_configured: `${name} ainda não foi configurada.`,
    provider_error: `${name} recusou a validação. Confira chave, permissões e conta.`,
    ai_provider_required: 'Escolha OpenAI, Claude ou FreeLLMAPI como provedor principal.',
    ai_provider_key_required: 'Informe a chave do provedor principal selecionado.',
    ai_model_required: 'Escolha um modelo permitido para o provedor principal.',
    ai_model_not_allowed: 'O modelo informado não está entre as opções permitidas nesta tela.',
    ai_provider_key_missing: 'A chave do provedor principal não foi encontrada no cofre.',
    ai_provider_invalid: 'O provedor principal salvo não é válido. Configure OpenAI, Claude ou FreeLLMAPI novamente.',
    organization_access_denied: 'Seu usuário não possui permissão administrativa para configurar esta conexão.',
    channel_not_supported: 'Este canal legado foi removido. Configure o WhatsApp em Canais com WA-AKG.',
  };
  return messages[code] || `Não foi possível validar ${name}. ${code || 'Tente novamente.'}`;
}

function CredentialField({ field, value, onChange }: { field: CampoIntegracao; value: string; onChange: (value: string) => void }) {
  const inputClass = 'w-full rounded-xl border border-background-200 bg-background-100 px-3.5 py-2.5 text-sm text-foreground-950 placeholder:text-foreground-400 outline-none transition focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20';
  return <label className="block text-sm font-semibold text-[#3A3A3C]"><span className="mb-1.5 block">{field.rotulo}{field.obrigatorio && <span className="ml-1 text-[#BD3D32]">*</span>}</span>{field.tipo === 'selecao' ? <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Selecione…</option>{(field.opcoes || []).map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input className={inputClass} type={field.tipo === 'senha' ? 'password' : 'text'} value={value} placeholder={field.placeholder} autoComplete="off" onChange={(event) => onChange(event.target.value)} />}{field.ajuda && <span className="mt-1.5 block text-xs font-normal text-[#777E89]">{field.ajuda}</span>}</label>;
}

/** Modal compartilhado apenas para APIs ativas (IA, Apify e Google Places). */
export function IntegrationConfigureModal({ integration, onClose, onSaved }: { integration: OperationalIntegration; onClose: () => void; onSaved: () => Promise<void> }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const configuration = integration.anaProviderConfiguration;
    if (integration.remoteKey !== 'ai') return {};
    if (!configuration) return { provedor_principal: 'FreeLLMAPI', freellm_model: 'free-router' };
    return {
      provedor_principal: configuration.provider === 'openai' ? 'OpenAI' : configuration.provider === 'claude' ? 'Claude' : 'FreeLLMAPI',
      ...(configuration.openaiModel ? { openai_model: configuration.openaiModel } : {}),
      ...(configuration.claudeModel ? { claude_model: configuration.claudeModel } : {}),
      freellm_model: configuration.freellmModel || 'free-router',
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const missing = integration.campos.filter((field) => field.obrigatorio && !values[field.id]?.trim()).map((field) => field.rotulo);
    if (integration.remoteKey === 'apify' && !values.actor_id?.trim() && !values.task_id?.trim()) missing.push('Actor ID ou Task ID');
    const selectedProvider = values.provedor_principal?.trim().toLowerCase();
    if (integration.remoteKey === 'ai' && ['openai', 'claude', 'freellmapi', 'freellm'].includes(selectedProvider)) {
      const modelField = selectedProvider === 'openai' ? 'openai_model' : selectedProvider === 'claude' ? 'claude_model' : 'freellm_model';
      if (!values[modelField]?.trim()) missing.push(`Modelo ${selectedProvider === 'openai' ? 'OpenAI' : selectedProvider === 'claude' ? 'Claude' : 'FreeLLMAPI'}`);
    }
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

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14151A]/45 p-4" onClick={onClose}><section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-background-200 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}><header className="flex items-start justify-between border-b border-background-200 px-5 py-4"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-primary-700">Cofre seguro</p><h3 className="mt-1 text-lg font-bold tracking-tight text-foreground-950">Configurar {integration.nome}</h3><p className="mt-1 text-xs text-foreground-500">As chaves são enviadas diretamente ao backend e não permanecem no navegador.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-foreground-500 hover:bg-background-100" aria-label="Fechar"><i className="ri-close-line text-lg" /></button></header><div className="space-y-4 p-5">{error && <div className="rounded-xl border border-[#BD3D32]/25 bg-[#BD3D32]/10 px-3.5 py-3 text-sm text-[#A52F27]">{error}</div>}{integration.campos.map((field) => <CredentialField key={field.id} field={field} value={values[field.id] || ''} onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))} />)}</div><footer className="flex justify-end gap-2 border-t border-background-200 px-5 py-4"><button type="button" className="wf-btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="wf-btn-primary disabled:opacity-60" disabled={saving} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar credenciais'}</button></footer></section></div>;
}
