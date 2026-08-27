import { useState } from 'react';
import { regioesAtendimento } from '@/mocks/businessData';
import { segmentos } from '@/mocks/leadsData';
import { tiposServicos, categoriasServicos, type CategoriaServico } from '@/mocks/empresaExtra';
import { useEmpresaSettingsStore } from '@/hooks/useEmpresaSettingsStore';
import DadosOrganizacaoForm from './DadosOrganizacaoForm';

export default function DadosTab() {
  const { settings, salvar: salvarConfig } = useEmpresaSettingsStore();
  const [difs, setDifs] = useState<string[]>(settings.diferenciais || []);
  const [novoDif, setNovoDif] = useState('');
  const [ramo, setRamo] = useState(settings.ramo || '');
  const [regiao, setRegiao] = useState(settings.regiao || '');
  const [publico, setPublico] = useState(settings.publico || '');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaServico | 'todas'>('todas');
  const [saved, setSaved] = useState(false);

  const addDif = () => {
    if (novoDif.trim()) {
      setDifs([...difs, novoDif.trim()]);
      setNovoDif('');
    }
  };

  const removeDif = (i: number) => {
    setDifs(difs.filter((_, idx) => idx !== i));
  };

  const salvar = () => {
    salvarConfig({ ramo, regiao, publico, diferenciais: difs });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const tiposFiltrados =
    categoriaFiltro === 'todas' ? tiposServicos : tiposServicos.filter((t) => t.categoria === categoriaFiltro);

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
          <select
            value={ramo}
            onChange={(e) => setRamo(e.target.value)}
            className="w-full max-w-md px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 cursor-pointer"
          >
            {segmentos.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Tipos de produtos e serviços */}
      <section className="bg-background-50 border border-background-200/70 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-accent-100 rounded-lg flex items-center justify-center">
              <i className="ri-box-3-line text-accent-600"></i>
            </div>
            <div>
              <h3 className="font-heading font-bold text-foreground-900">Tipos de produtos e serviços</h3>
              <p className="text-sm text-foreground-500">O que a empresa oferece. Cada projeto é personalizado, por isso sem preço fixo.</p>
            </div>
          </div>
        </div>

        {/* Filtro por categoria */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setCategoriaFiltro('todas')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border cursor-pointer whitespace-nowrap transition-all ${
              categoriaFiltro === 'todas' ? 'bg-primary-500 text-background-50 border-transparent' : 'bg-background-50 border-background-300 text-foreground-600 hover:bg-background-100'
            }`}
          >
            Todas ({tiposServicos.length})
          </button>
          {categoriasServicos.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoriaFiltro(categoriaFiltro === c.id ? 'todas' : c.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border cursor-pointer whitespace-nowrap transition-all ${
                categoriaFiltro === c.id ? 'bg-primary-500 text-background-50 border-transparent' : 'bg-background-50 border-background-300 text-foreground-600 hover:bg-background-100'
              }`}
            >
              <i className={c.icone}></i>
              {c.id}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiposFiltrados.map((t) => (
            <div key={t.id} className="bg-background-100/50 border border-background-200/70 rounded-lg p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-medium text-foreground-900 text-sm">{t.nome}</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0 ${
                  t.tipo === 'Serviço' ? 'bg-primary-100 text-primary-700' : 'bg-accent-100 text-accent-700'
                }`}>
                  {t.tipo}
                </span>
              </div>
              <p className="text-xs text-foreground-500 mb-1">{t.categoria}</p>
              <p className="text-sm text-foreground-700 mb-3">{t.descricao}</p>
              <div className="mt-auto">
                <p className="text-xs font-semibold text-foreground-500 uppercase tracking-wide mb-1.5">O que inclui</p>
                <ul className="space-y-1">
                  {t.inclui.map((item) => (
                    <li key={item} className="flex items-start gap-1.5 text-xs text-foreground-600">
                      <i className="ri-check-line text-accent-500 mt-0.5"></i>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
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
            <select
              value={regiao}
              onChange={(e) => setRegiao(e.target.value)}
              className="w-full max-w-md px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/20 cursor-pointer"
            >
              {regioesAtendimento.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
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
        {saved && (
          <span className="inline-flex items-center gap-2 text-primary-700 text-sm font-medium">
            <i className="ri-checkbox-circle-line"></i>
            Configurações salvas!
          </span>
        )}
        <button
          onClick={salvar}
          className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 px-8 py-3 rounded-lg font-heading font-bold text-sm transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-save-line"></i>
          Salvar configurações
        </button>
      </div>
    </div>
  );
}