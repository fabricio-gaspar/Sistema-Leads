import { useState } from 'react';
import { conhecimentoInicial, categoriasConhecimento } from '@/mocks/conhecimentoData';
import type { Conversa } from '@/mocks/atendimentoData';
import type { Lead } from '@/mocks/leadsData';

interface ConversaDrawerProps {
  conversa: Conversa;
  lead?: Lead | null;
  onClose: () => void;
  onInserirResposta: (texto: string) => void;
}

type Aba = 'resumo' | 'historico' | 'tarefas' | 'base';

const abas: { id: Aba; label: string; icone: string }[] = [
  { id: 'resumo', label: 'Resumo', icone: 'ri-file-user-line' },
  { id: 'historico', label: 'Histórico', icone: 'ri-history-line' },
  { id: 'tarefas', label: 'Tarefas', icone: 'ri-task-line' },
  { id: 'base', label: 'Base da Ana', icone: 'ri-book-open-line' },
];

const statusLabel: Record<string, string> = {
  ativo: 'Ativo',
  aguardando: 'Aguardando',
  resolvido: 'Resolvido',
  transferido: 'Transferido',
};

const intencaoLabel: Record<string, string> = {
  INTERESSE: 'Interesse',
  DUVIDA: 'Dúvida',
  OBJECAO: 'Objeção',
  PRECO: 'Preço',
  ORCAMENTO: 'Orçamento',
  AGENDAMENTO: 'Agendamento',
  NEGATIVO: 'Negativo',
  OPT_OUT: 'Opt-out',
  NEUTRO: 'Neutro',
};

export default function ConversaDrawer({ conversa, lead, onClose, onInserirResposta }: ConversaDrawerProps) {
  const [aba, setAba] = useState<Aba>('resumo');
  const [buscaBase, setBuscaBase] = useState('');
  const [tarefas, setTarefas] = useState([
    { id: 'dt1', texto: 'Confirmar necessidade do lead', concluida: conversa.fila === 'Qualificação' },
    { id: 'dt2', texto: 'Enviar proposta comercial', concluida: conversa.fila === 'Propostas' },
    { id: 'dt3', texto: 'Agendar call de fechamento', concluida: false },
  ]);

  const baseFiltrada = conhecimentoInicial.filter((e) => {
    if (e.status !== 'ativo') return false;
    if (!buscaBase.trim()) return true;
    const t = buscaBase.toLowerCase();
    return (
      e.titulo.toLowerCase().includes(t) ||
      e.conteudo.toLowerCase().includes(t) ||
      e.palavrasChave.some((p) => p.toLowerCase().includes(t))
    );
  });

  const catNome = (id: string) => {
    const c = categoriasConhecimento.find((x) => x.id === id);
    return c ? c.nome : id;
  };

  const historico = [
    { acao: 'Conversa iniciada', detalhe: `Protocolo ${conversa.protocolo} via ${conversa.canal}`, data: 'hoje' },
    { acao: 'Ana assumiu o primeiro contato', detalhe: 'Mensagem de boas-vindas disparada', data: 'hoje' },
    { acao: `Status: ${statusLabel[conversa.status]}`, detalhe: `Fila: ${conversa.fila}`, data: 'hoje' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-foreground-950/50 flex justify-end" onClick={onClose}>
      <div
        className="bg-background-50 w-full max-w-sm h-full flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-background-200/70 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-foreground-950 text-base">{conversa.contato}</h3>
            <p className="text-xs text-foreground-500">{conversa.empresa} · {conversa.protocolo}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer flex-shrink-0"
          >
            <i className="ri-close-line text-lg"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4 border-b border-background-200/70">
          <div className="flex gap-1 p-1 bg-background-100 rounded-lg">
            {abas.map((a) => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`flex-1 flex items-center justify-center gap-1 px-1 py-2 rounded-md text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-all ${
                  aba === a.id ? 'bg-background-50 text-primary-700 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'
                }`}
              >
                <i className={a.icone}></i>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {aba === 'resumo' && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                  {conversa.canal}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent-100 text-accent-700">
                  {statusLabel[conversa.status]}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary-100 text-secondary-800">
                  {conversa.fila}
                </span>
              </div>

              {lead && (
                <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-secondary-800 mb-3 flex items-center gap-1.5">
                    <i className="ri-brain-line"></i> Análise da Ana
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-foreground-500 text-xs">Intenção</p>
                      <p className="text-foreground-900 font-medium">{lead.intencao ? intencaoLabel[lead.intencao] || lead.intencao : '—'}</p>
                    </div>
                    <div>
                      <p className="text-foreground-500 text-xs">Score</p>
                      <p className="text-foreground-900 font-medium">{lead.score}</p>
                    </div>
                    <div>
                      <p className="text-foreground-500 text-xs">Confiança</p>
                      <p className="text-foreground-900 font-medium">{lead.confianca ?? 100}%</p>
                    </div>
                    <div>
                      <p className="text-foreground-500 text-xs">Próxima ação</p>
                      <p className="text-foreground-900 font-medium">{lead.proximaAcao || '—'}</p>
                    </div>
                  </div>
                  {lead.motivoTransferencia && (
                    <p className="text-xs text-accent-700 mt-3">
                      <i className="ri-user-shared-line mr-1"></i>
                      {lead.motivoTransferencia}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground-500 text-xs">SLA restante</span>
                  <span className="text-foreground-900 font-medium">{conversa.sla}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-500 text-xs">Mensagens</span>
                  <span className="text-foreground-900 font-medium">{conversa.mensagens.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-500 text-xs">Não lidas</span>
                  <span className="text-foreground-900 font-medium">{conversa.naoLidas}</span>
                </div>
                <div className="pt-3 border-t border-background-200/70">
                  <span className="text-foreground-500 text-xs">Última mensagem</span>
                  <p className="text-foreground-800 mt-1">{conversa.ultimaMensagem}</p>
                </div>
              </div>
            </>
          )}

          {aba === 'historico' && (
            <div className="space-y-0">
              {historico.map((h, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-500 mt-1"></div>
                    {i < historico.length - 1 && <div className="w-px flex-1 bg-background-200"></div>}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-foreground-900">{h.acao}</p>
                    <p className="text-xs text-foreground-500">{h.detalhe}</p>
                    <p className="text-[10px] text-foreground-400 mt-0.5">{h.data}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {aba === 'tarefas' && (
            <div className="space-y-3">
              {tarefas.map((t) => (
                <label key={t.id} className="flex items-center gap-3 p-3 bg-background-100/50 border border-background-200/70 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={t.concluida}
                    onChange={() =>
                      setTarefas((prev) =>
                        prev.map((x) => (x.id === t.id ? { ...x, concluida: !x.concluida } : x))
                      )
                    }
                    className="w-4 h-4 cursor-pointer accent-primary-500"
                  />
                  <span className={`text-sm ${t.concluida ? 'text-foreground-400 line-through' : 'text-foreground-800'}`}>
                    {t.texto}
                  </span>
                </label>
              ))}
            </div>
          )}

          {aba === 'base' && (
            <>
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
                <input
                  type="text"
                  value={buscaBase}
                  onChange={(e) => setBuscaBase(e.target.value)}
                  placeholder="Buscar na base da Ana..."
                  className="w-full pl-9 pr-4 py-2 bg-background-100 border border-background-200/70 rounded-lg text-sm text-foreground-800 placeholder-foreground-400 focus:outline-none focus:border-primary-400"
                />
              </div>
              <div className="space-y-3">
                {baseFiltrada.map((e) => (
                  <div key={e.id} className="border border-background-200/70 rounded-lg p-3">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-secondary-100 text-secondary-800 mb-1.5">
                      {catNome(e.categoria)}
                    </span>
                    <p className="text-sm font-medium text-foreground-900 leading-tight">{e.titulo}</p>
                    <p className="text-xs text-foreground-500 mt-1 line-clamp-3">{e.conteudo}</p>
                    <button
                      onClick={() => onInserirResposta(e.conteudo)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-add-line"></i>
                      Usar como resposta
                    </button>
                  </div>
                ))}
                {baseFiltrada.length === 0 && (
                  <p className="text-center text-foreground-400 text-sm py-6">Nenhum conteúdo encontrado.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}