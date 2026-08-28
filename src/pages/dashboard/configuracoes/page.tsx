import { useState } from 'react';
import type { Membro, Supressao } from '@/mocks/businessData';
import { useAuth } from '@/hooks/useAuth';
import { useSupressaoStore } from '@/hooks/useSupressaoStore';
import { useEquipeStore } from '@/hooks/useEquipeStore';
import AbordagemAnaTab from './components/AbordagemAnaTab';
import PipelineTab from './components/PipelineTab';
import FontesTab from './components/FontesTab';
import ProdutosTab from './components/ProdutosTab';
import TemplatesTab from './components/TemplatesTab';
import RespostasRapidasTab from './components/RespostasRapidasTab';
import VariaveisGlobaisTab from './components/VariaveisGlobaisTab';
import BibliotecaPromptsTab from './components/BibliotecaPromptsTab';
import TemplatesPropostaTab from './components/TemplatesPropostaTab';
import TemplatesDocumentoTab from './components/TemplatesDocumentoTab';
import TemasTab from './components/TemasTab';
import FluxosProntosTab from './components/FluxosProntosTab';
import HorariosTab from './components/HorariosTab';
import AutomacoesTab from './components/AutomacoesTab';
import ComercialTab from './components/ComercialTab';
import LogsTab from './components/LogsTab';
import IntegracoesOperacaoTab from './components/IntegracoesOperacaoTab';
import EmpresaTabs from '@/pages/dashboard/empresa/components/EmpresaTabs';
import PersonalizacaoAna from '@/pages/dashboard/personalizacao-ana/page';

interface MenuItem {
  id: string;
  label: string;
  icone: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const groups: MenuGroup[] = [
  {
    title: 'CONTA',
    items: [
      { id: 'empresa', label: 'Empresa', icone: 'ri-store-2-line' },
      { id: 'equipe', label: 'Equipe', icone: 'ri-team-line' },
    ],
  },
  {
    title: 'OPERAÇÃO',
    items: [
      { id: 'pipeline', label: 'Pipeline', icone: 'ri-layout-masonry-line' },
      { id: 'fontes', label: 'Fontes de leads', icone: 'ri-cloud-line' },
      { id: 'produtos', label: 'Produtos', icone: 'ri-shopping-bag-line' },
      { id: 'supressao', label: 'Supressão (LGPD)', icone: 'ri-shield-line' },
      { id: 'logs', label: 'Logs', icone: 'ri-file-list-line' },
    ],
  },
  {
    title: 'CANAIS E INTEGRAÇÕES',
    items: [
      { id: 'integracoes-operacao', label: 'Canais e integrações', icone: 'ri-plug-line' },
    ],
  },
  {
    title: 'PERSONALIZAÇÃO',
    items: [
      { id: 'ana', label: 'Personalização da Ana', icone: 'ri-robot-2-line' },
      { id: 'abordagem', label: 'Materiais institucionais', icone: 'ri-file-user-line' },
      { id: 'templates', label: 'Templates', icone: 'ri-mail-send-line' },
      { id: 'respostas', label: 'Respostas rápidas', icone: 'ri-chat-smile-2-line' },
      { id: 'variaveis', label: 'Variáveis globais', icone: 'ri-braces-line' },
      { id: 'biblioteca', label: 'Biblioteca de prompts', icone: 'ri-sparkling-2-line' },
      { id: 'templates-proposta', label: 'Templates de proposta', icone: 'ri-file-text-line' },
      { id: 'templates-documento', label: 'Templates de documento', icone: 'ri-file-copy-2-line' },
      { id: 'temas', label: 'Temas', icone: 'ri-palette-line' },
      { id: 'fluxos', label: 'Fluxos prontos', icone: 'ri-flow-chart' },
      { id: 'automacoes', label: 'Automações', icone: 'ri-timer-flash-line' },
      { id: 'comercial', label: 'Regras Comerciais', icone: 'ri-price-tag-3-line' },
      { id: 'horarios', label: 'Horários', icone: 'ri-time-line' },
    ],
  },
];

export default function DashboardConfiguracoes() {
  const [tab, setTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'empresa';
  });
  const [toast, setToast] = useState('');
  const { supressoes, adicionar: adicionarSupressaoStore, reativar, excluir: excluirSupressao } = useSupressaoStore();
  const { membros, adicionar: adicionarMembro, atualizar: atualizarMembro, excluir: excluirMembro } = useEquipeStore();
  const [conviteModal, setConviteModal] = useState(false);
  const [convite, setConvite] = useState({ nome: '', email: '', cargo: 'Vendedor' });
  const [editMembroModal, setEditMembroModal] = useState<Membro | null>(null);
  const [editMembroForm, setEditMembroForm] = useState({ cargo: '', departamento: '' });
  const [supModal, setSupModal] = useState(false);
  const [supForm, setSupForm] = useState({ contato: '', canal: 'WhatsApp', motivo: '' });
  const { user } = useAuth();

  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const enviarConvite = () => {
    if (!convite.nome.trim() || !convite.email.trim()) {
      mostrarToast('Preencha nome e e-mail do membro.');
      return;
    }
    const novo: Membro = {
      id: `m-${Date.now()}`,
      nome: convite.nome.trim(),
      email: convite.email.trim(),
      cargo: convite.cargo,
      avatar: convite.nome.trim().charAt(0).toUpperCase(),
      status: 'inativo',
      departamento: 'Comercial',
    };
    adicionarMembro(novo);
    setConviteModal(false);
    setConvite({ nome: '', email: '', cargo: 'Vendedor' });
    mostrarToast(`Convite enviado para ${novo.email}!`);
  };

  const abrirEdicaoMembro = (m: Membro) => {
    setEditMembroModal(m);
    setEditMembroForm({ cargo: m.cargo, departamento: m.departamento });
  };

  const salvarEdicaoMembro = () => {
    if (!editMembroModal) return;
    atualizarMembro(editMembroModal.id, editMembroForm);
    setEditMembroModal(null);
    mostrarToast('Membro atualizado.');
  };

  const reenviarConvite = (m: Membro) => {
    mostrarToast(`Convite reenviado para ${m.email}.`);
  };

  const revogarAcesso = (m: Membro) => {
    atualizarMembro(m.id, { status: 'inativo' });
    mostrarToast(`Acesso de "${m.nome}" revogado.`);
  };

  const removerMembro = (m: Membro) => {
    excluirMembro(m.id);
    mostrarToast(`Membro "${m.nome}" removido.`);
  };

  const adicionarSupressao = () => {
    if (!supForm.contato.trim()) {
      mostrarToast('Informe o contato.');
      return;
    }
    adicionarSupressaoStore({
      contato: supForm.contato.trim(),
      canal: supForm.canal as Supressao['canal'],
      motivo: supForm.motivo.trim() || 'Adicionado manualmente',
      ator: user?.name || 'Você',
      origem: 'Manual',
    });
    setSupModal(false);
    setSupForm({ contato: '', canal: 'WhatsApp', motivo: '' });
    mostrarToast('Contato adicionado à lista de supressão!');
  };

  const reativarSupressao = (id: string) => {
    reativar(id);
    mostrarToast('Contato reativado — voltará a receber contatos.');
  };

  const excluirRegistroSupressao = (id: string) => {
    excluirSupressao(id);
    mostrarToast('Registro excluído da lista de supressão.');
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-heading font-extrabold text-foreground-950 mb-2">
          Configurações
        </h1>
        <p className="text-foreground-600 text-sm">
          Organização, equipe, operação, canais e uma única área para definir como a Ana atua em cada empresa.
        </p>
      </div>

      {toast && (
        <div className="mb-4 bg-primary-100 border border-primary-200 text-primary-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <i className="ri-information-line"></i>
          {toast}
        </div>
      )}

      <div className="flex gap-6 items-start">
        {/* Sidebar */}
        <aside className="hidden lg:block w-[240px] flex-shrink-0 bg-background-50 border border-background-200/70 rounded-xl p-4 sticky top-6">
          {groups.map((group) => (
            <div key={group.title} className="mb-5 last:mb-0">
              <p className="text-[11px] font-bold text-foreground-400 uppercase tracking-wider mb-2 px-3">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      tab === item.id
                        ? 'bg-primary-500/10 text-primary-700'
                        : 'text-foreground-600 hover:bg-background-100 hover:text-foreground-800'
                    }`}
                  >
                    <span className="w-5 h-5 flex items-center justify-center">
                      <i className={item.icone}></i>
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
              {group.title !== 'PERSONALIZAÇÃO' && (
                <div className="mt-4 border-b border-background-200/50" />
              )}
            </div>
          ))}
        </aside>

        {/* Mobile select */}
        <div className="lg:hidden w-full mb-4">
          <select
            value={tab}
            onChange={(e) => setTab(e.target.value)}
            className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer"
          >
            {groups.map((group) => (
              <optgroup key={group.title} label={group.title}>
                {group.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'pipeline' && <PipelineTab />}
          {tab === 'fontes' && <FontesTab />}
          {tab === 'produtos' && <ProdutosTab />}
          {tab === 'templates' && <TemplatesTab />}
          {tab === 'respostas' && <RespostasRapidasTab />}
          {tab === 'variaveis' && <VariaveisGlobaisTab />}
          {tab === 'biblioteca' && <BibliotecaPromptsTab />}
          {tab === 'templates-proposta' && <TemplatesPropostaTab />}
          {tab === 'templates-documento' && <TemplatesDocumentoTab />}
          {tab === 'temas' && <TemasTab />}
          {tab === 'fluxos' && <FluxosProntosTab />}
          {tab === 'horarios' && <HorariosTab />}
          {tab === 'automacoes' && <AutomacoesTab />}
          {tab === 'comercial' && <ComercialTab />}
          {tab === 'logs' && <LogsTab />}

          {/* Abordagem da Ana */}
          {tab === 'abordagem' && <AbordagemAnaTab />}

          {/* Personalização completa da Ana */}
          {tab === 'ana' && <PersonalizacaoAna embedded />}

          {/* Empresa */}
          {tab === 'empresa' && <EmpresaTabs />}

          {/* Canais, conexões e modo operacional */}
          {tab === 'integracoes-operacao' && <IntegracoesOperacaoTab />}

          {/* Equipe */}
          {tab === 'equipe' && (
            <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
                <h3 className="font-heading font-bold text-foreground-900 text-sm">Membros da equipe</h3>
                <button onClick={() => setConviteModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap">
                  <i className="ri-user-add-line"></i>
                  Convidar membro
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-background-200/70 bg-background-100/50">
                      <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Membro</th>
                      <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Cargo</th>
                      <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Departamento</th>
                      <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Status</th>
                      <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-28">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {membros.map((m) => (
                      <tr key={m.id} className="border-b border-background-100 hover:bg-background-50/50">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-background-200 flex items-center justify-center">
                              <span className="text-foreground-700 font-bold text-xs">{m.avatar}</span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground-900">{m.nome}</p>
                              <p className="text-foreground-500 text-xs">{m.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-foreground-700">{m.cargo}</td>
                        <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">{m.departamento}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${m.status === 'ativo' ? 'bg-primary-100 text-primary-700' : 'bg-background-200 text-foreground-500'}`}>
                            {m.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => abrirEdicaoMembro(m)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer"
                              title="Editar cargo"
                            >
                              <i className="ri-edit-line"></i>
                            </button>
                            {m.status === 'ativo' ? (
                              <button
                                onClick={() => revogarAcesso(m)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-accent-50 text-accent-600 cursor-pointer"
                                title="Revogar acesso"
                              >
                                <i className="ri-user-unfollow-line"></i>
                              </button>
                            ) : (
                              <button
                                onClick={() => reenviarConvite(m)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-background-200 text-foreground-500 cursor-pointer"
                                title="Reenviar convite"
                              >
                                <i className="ri-mail-send-line"></i>
                              </button>
                            )}
                            <button
                              onClick={() => removerMembro(m)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-background-100 hover:bg-accent-50 text-accent-600 cursor-pointer"
                              title="Remover membro"
                            >
                              <i className="ri-delete-bin-6-line"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Supressão */}
          {tab === 'supressao' && (
            <div className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-bold text-foreground-900 text-sm">Lista de supressão</h3>
                  <p className="text-xs text-foreground-500">Contatos com opt-out. Cadências são pausadas automaticamente.</p>
                </div>
                <button onClick={() => setSupModal(true)} className="px-4 py-2 bg-secondary-500 hover:bg-secondary-600 text-background-50 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap">
                  Adicionar
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-background-200/70 bg-background-100/50">
                      <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Contato (hash)</th>
                      <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Canal</th>
                      <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden md:table-cell">Motivo</th>
                      <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs hidden lg:table-cell">Data</th>
                      <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs">Status</th>
                      <th className="text-left px-6 py-3 text-foreground-500 font-medium text-xs w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supressoes.map((s) => (
                      <tr key={s.id} className="border-b border-background-100 hover:bg-background-50/50">
                        <td className="px-6 py-3.5 font-mono text-xs text-foreground-700">{s.contato}</td>
                        <td className="px-6 py-3.5 text-foreground-700">{s.canal}</td>
                        <td className="px-6 py-3.5 text-foreground-600 hidden md:table-cell">{s.motivo}</td>
                        <td className="px-6 py-3.5 text-foreground-600 hidden lg:table-cell">{new Date(s.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${s.status === 'ativo' ? 'bg-accent-100 text-accent-700' : 'bg-primary-100 text-primary-700'}`}>
                            {s.status === 'ativo' ? 'Ativo' : 'Reativado'}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-1.5">
                            {s.status === 'ativo' && (
                              <button
                                onClick={() => reativarSupressao(s.id)}
                                className="px-2.5 py-1.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap"
                                title="Reativar contato"
                              >
                                <i className="ri-arrow-go-back-line"></i>
                              </button>
                            )}
                            <button
                              onClick={() => excluirRegistroSupressao(s.id)}
                              className="px-2.5 py-1.5 bg-background-100 hover:bg-accent-50 text-accent-600 rounded-md text-xs cursor-pointer whitespace-nowrap"
                              title="Excluir registro"
                            >
                              <i className="ri-delete-bin-6-line"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Convidar membro */}
      {conviteModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setConviteModal(false)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Convidar membro</h3>
              <button onClick={() => setConviteModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"><i className="ri-close-line text-lg"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Nome</label>
                <input type="text" value={convite.nome} onChange={(e) => setConvite({ ...convite, nome: e.target.value })} placeholder="Nome do colaborador" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">E-mail</label>
                <input type="email" value={convite.email} onChange={(e) => setConvite({ ...convite, email: e.target.value })} placeholder="email@empresa.com" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Cargo</label>
                <select value={convite.cargo} onChange={(e) => setConvite({ ...convite, cargo: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  {['Administrador', 'Gestor Comercial', 'Vendedor', 'SDR', 'CX'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setConviteModal(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={enviarConvite} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Enviar convite</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar membro */}
      {editMembroModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setEditMembroModal(null)}>
          <div className="bg-background-50 rounded-xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">Editar membro</h3>
                <p className="text-sm text-foreground-500">{editMembroModal.nome}</p>
              </div>
              <button onClick={() => setEditMembroModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"><i className="ri-close-line text-lg"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Cargo</label>
                <select value={editMembroForm.cargo} onChange={(e) => setEditMembroForm({ ...editMembroForm, cargo: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  {['Administrador', 'Gestor Comercial', 'Vendedor', 'SDR', 'CX'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Departamento</label>
                <select value={editMembroForm.departamento} onChange={(e) => setEditMembroForm({ ...editMembroForm, departamento: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  {['Direção', 'Comercial', 'Prospecção', 'Atendimento', 'Marketing'].map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setEditMembroModal(null)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={salvarEdicaoMembro} className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar supressão */}
      {supModal && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setSupModal(false)}>
          <div className="bg-background-50 rounded-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <h3 className="font-heading font-bold text-foreground-950">Adicionar à lista de supressão</h3>
              <button onClick={() => setSupModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"><i className="ri-close-line text-lg"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Contato (e-mail ou telefone)</label>
                <input type="text" value={supForm.contato} onChange={(e) => setSupForm({ ...supForm, contato: e.target.value })} placeholder="contato@empresa.com ou (00) 00000-0000" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Canal</label>
                <select value={supForm.canal} onChange={(e) => setSupForm({ ...supForm, canal: e.target.value })} className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900 cursor-pointer">
                  {['WhatsApp', 'E-mail', 'Telefone', 'Instagram'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-800 mb-1.5">Motivo</label>
                <input type="text" value={supForm.motivo} onChange={(e) => setSupForm({ ...supForm, motivo: e.target.value })} placeholder="Opt-out solicitado pelo lead" className="w-full px-4 py-2.5 bg-background-50 border border-background-300 rounded-lg text-sm text-foreground-900" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-background-200/70 flex justify-end gap-2">
              <button onClick={() => setSupModal(false)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Cancelar</button>
              <button onClick={adicionarSupressao} className="px-5 py-2.5 bg-secondary-500 hover:bg-secondary-600 text-background-50 rounded-lg text-sm font-bold cursor-pointer whitespace-nowrap">Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
