import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';

export default function DadosOrganizacaoForm() {
  const { user } = useAuth();
  const { settings, salvarOrganizacao } = useEmpresaSettingsStore();
  const org = settings.organizacao;
  const [form, setForm] = useState({
    nome: org.nome || '',
    nomeComercial: org.nomeComercial || '',
    cnpj: org.cnpj || '',
    site: org.site || '',
    email: org.email || user?.email || '',
    telefone: org.telefone || '',
    endereco: org.endereco || '',
    fusoHorario: org.fusoHorario || 'America/Sao_Paulo',
    idioma: org.idioma || 'pt-BR',
    assinaturaComercial: org.assinaturaComercial || '',
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const atualizar = (campo: keyof typeof form, valor: string) => setForm((f) => ({ ...f, [campo]: valor }));

  const salvar = async () => {
    setSaving(true);
    setError('');
    try {
      await salvarOrganizacao(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Não foi possível salvar no banco. Nenhuma confirmação foi registrada.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-primary-500 flex items-center justify-center">
          <span className="text-background-50 font-heading font-bold text-lg">{user?.avatar || 'W'}</span>
        </div>
        <div>
          <h3 className="font-heading font-bold text-foreground-900">Dados da organização</h3>
          <p className="text-sm text-foreground-500">Estas informações aparecem nas suas comunicações.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome da empresa</label>
          <input value={form.nome} onChange={(e) => atualizar('nome', e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome comercial</label>
          <input value={form.nomeComercial} onChange={(e) => atualizar('nomeComercial', e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-800 mb-1.5">CNPJ</label>
          <input value={form.cnpj} onChange={(e) => atualizar('cnpj', e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-800 mb-1.5">Site</label>
          <input value={form.site} onChange={(e) => atualizar('site', e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-800 mb-1.5">E-mail corporativo</label>
          <input value={form.email} onChange={(e) => atualizar('email', e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-800 mb-1.5">Telefone principal</label>
          <input value={form.telefone} onChange={(e) => atualizar('telefone', e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-foreground-800 mb-1.5">Endereço</label>
          <input value={form.endereco} onChange={(e) => atualizar('endereco', e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-800 mb-1.5">Fuso horário</label>
          <select value={form.fusoHorario} onChange={(e) => atualizar('fusoHorario', e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
            <option value="America/Sao_Paulo">America/São Paulo (GMT-3)</option>
            <option value="America/Fortaleza">America/Fortaleza (GMT-3)</option>
            <option value="America/Manaus">America/Manaus (GMT-4)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-800 mb-1.5">Idioma</label>
          <select value={form.idioma} onChange={(e) => atualizar('idioma', e.target.value)} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en-US">English (US)</option>
            <option value="es-ES">Español</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-foreground-800 mb-1.5">Assinatura comercial</label>
          <textarea value={form.assinaturaComercial} onChange={(e) => atualizar('assinaturaComercial', e.target.value)} rows={3} maxLength={500} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 resize-none" />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-end gap-3">
        {error && <span className="mr-auto text-sm font-medium text-accent-700"><i className="ri-error-warning-line mr-1" />{error}</span>}
        {saved && (
          <span className="inline-flex items-center gap-2 text-primary-700 text-sm font-medium">
            <i className="ri-checkbox-circle-line"></i>
            Alterações salvas!
          </span>
        )}
        <button disabled={saving} onClick={() => void salvar()} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap disabled:opacity-60">
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </section>
  );
}
