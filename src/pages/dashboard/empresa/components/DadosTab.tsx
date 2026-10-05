import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import DadosOrganizacaoForm from './DadosOrganizacaoForm';

export default function DadosTab() {
  const { settings, salvar: salvarConfig } = useEmpresaSettingsStore();
  const [difs, setDifs] = useState<string[]>(settings.diferenciais || []);
  const [novoDif, setNovoDif] = useState('');
  const [ramo, setRamo] = useState(settings.ramo || '');
  const [regiao, setRegiao] = useState(settings.regiao || '');
  const [publico, setPublico] = useState(settings.publico || '');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addDif = () => {
    if (novoDif.trim()) {
      setDifs([...difs, novoDif.trim()]);
      setNovoDif('');
    }
  };

  const removeDif = (i: number) => {
    setDifs(difs.filter((_, idx) => idx !== i));
  };

  const salvar = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await salvarConfig({ ramo, regiao, publico, diferenciais: difs });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dados da organização */}
      <DadosOrganizacaoForm />

      {/* Ramo de atividade */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
            <i className="ri-store-2-line text-primary-600"></i>
          </div>
          <h3 className="font-heading font-bold text-foreground-900">Ramo de atividade</h3>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground-800 mb-1.5">Segmento principal</label>
          <input
            type="text"
            value={ramo}
            onChange={(e) => setRamo(e.target.value)}
            placeholder="Descreva o segmento principal da empresa"
        className="w-full px-3.5 py-2.5 bg-background-100 border border-background-200 rounded-xl text-xs text-foreground-950 placeholder-foreground-400 focus:bg-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition"
          />
        </div>
      </section>

      <section className="bg-white border border-[#E3E7ED] rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center">
            <i className="ri-box-3-line text-primary-700"></i>
            </div>
            <div>
              <h3 className="font-heading font-bold text-[#14151A]">Produtos e modelos de orçamento</h3>
              <p className="text-sm text-[#69717D]">O catálogo oficial é a única fonte usada nesta configuração; nenhum produto é criado por dados de demonstração.</p>
            </div>
          </div>
          <Link
            to="/dashboard/configuracoes?tab=produtos"
            className="inline-flex items-center justify-center gap-2 bg-[#F2F4F8] hover:bg-[#E3E7ED] text-[#14151A] border border-[#E3E7ED] rounded-xl px-3 py-2 text-xs font-semibold transition"
          >
            Abrir catálogo oficial
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </section>

      {/* Diferenciais */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center">
            <i className="ri-star-line text-primary-600"></i>
          </div>
          <h3 className="font-heading font-bold text-foreground-900">Diferenciais competitivos</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {difs.map((d, i) => (
            <span key={i} className="inline-flex items-center gap-2 bg-primary-100 text-primary-800 px-3 py-1.5 rounded-full text-sm">
              {d}
              <button onClick={() => removeDif(i)} className="w-4 h-4 flex items-center justify-center cursor-pointer hover:text-accent-600">
                <i className="ri-close-line text-sm"></i>
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={novoDif}
            onChange={(e) => setNovoDif(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDif()}
            placeholder="Adicionar novo diferencial"
            className="flex-1 px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20"
          />
          <button onClick={addDif} className="px-4 py-2.5 bg-secondary-500 hover:bg-secondary-600 text-background-50 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap">
            Adicionar
          </button>
        </div>
      </section>

      {/* Região e público */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-accent-100 rounded-lg flex items-center justify-center">
            <i className="ri-map-pin-line text-accent-600"></i>
          </div>
          <h3 className="font-heading font-bold text-foreground-900">Região e público-alvo</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Região de atendimento</label>
            <input
              type="text"
              value={regiao}
              onChange={(e) => setRegiao(e.target.value)}
              placeholder="Ex.: Sorocaba/SP e atendimento comercial para indústrias"
                  className="w-full px-3.5 py-2.5 bg-background-100 border border-background-200 rounded-xl text-xs text-foreground-950 placeholder-foreground-400 focus:bg-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground-800 mb-1.5">Público-alvo</label>
            <textarea
              value={publico}
              onChange={(e) => setPublico(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 resize-none"
            />
          </div>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {error && (
          <span className="inline-flex items-center gap-2 text-[#BD3D32] text-sm font-medium">
            <i className="ri-error-warning-line"></i>
            {error}
          </span>
        )}
        {saved && (
          <span className="inline-flex items-center gap-2 text-primary-700 text-sm font-medium">
            <i className="ri-checkbox-circle-line"></i>
            Configurações salvas!
          </span>
        )}
        <button
          onClick={salvar}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-8 py-3 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer whitespace-nowrap"
        >
          <i className={saving ? 'ri-loader-4-line animate-spin' : 'ri-save-line'}></i>
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}
