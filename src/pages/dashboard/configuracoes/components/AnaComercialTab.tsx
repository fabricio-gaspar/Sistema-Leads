import { useState } from 'react';
import {
  perfilAna,
  variaveisDinamicas,
  promptOperacionalAna,
  regrasHandoffAna,
  mensagemHandoffLead,
  controleAna,
} from '@/mocks/anaComercial';
import {
  templatesPrimeiroContato,
  followUpsAna,
  regrasCadencia,
  assuntoEmailApresentacao,
} from '@/mocks/anaTemplates';
import {
  perguntasQualificacao,
  intencoesAna,
  faixasScore,
  sinaisPositivos,
  sinaisRisco,
  objecoesRespostas,
  categoriasBaseConhecimento,
  baseConhecimentoAna,
  informacoesPendentes,
  fluxoHandoff,
} from '@/mocks/anaQualificacao';

function StatusChip({ status }: { status: string }) {
  const cores: Record<string, string> = {
    rascunho: 'bg-accent-100 text-accent-700',
    ativo: 'bg-primary-100 text-primary-700',
    inativo: 'bg-background-200 text-foreground-500',
  };
  const label = status === 'rascunho' ? 'Rascunho' : status === 'ativo' ? 'Ativo' : 'Inativo';
  return (
    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${cores[status] || cores.rascunho}`}>
      {label}
    </span>
  );
}

function SectionCard({ titulo, icone, descricao, children }: { titulo: string; icone: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="bg-background-50 border border-background-200/70 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-background-200/70 flex items-center gap-3">
        <div className="w-9 h-9 bg-secondary-100 text-secondary-700 rounded-lg flex items-center justify-center flex-shrink-0">
          <i className={icone}></i>
        </div>
        <div>
          <h3 className="font-heading font-bold text-foreground-900 text-sm">{titulo}</h3>
          {descricao && <p className="text-xs text-foreground-500">{descricao}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span key={i} className="px-2 py-0.5 rounded-md text-xs bg-background-100 text-foreground-600">{it}</span>
      ))}
    </div>
  );
}

export default function AnaComercialTab() {
  const [preview, setPreview] = useState<{ tipo: 'template' | 'objecao'; titulo: string; texto: string; canais: string[] } | null>(null);

  return (
    <div className="space-y-6">
      <div className="bg-secondary-50 border border-secondary-200 text-secondary-800 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
        <i className="ri-information-line mt-0.5"></i>
        <span>
          <strong>Estrutura comercial da Ana em RASCUNHO.</strong> Nada é enviado nem ativado nesta versão. Revise cada item e
          aprove para liberar o uso futuro. Sem conexão com WhatsApp/e-mail real, nenhuma mensagem sai do sistema.
        </span>
      </div>

      {/* Perfil */}
      <SectionCard titulo="Perfil da Ana" icone="ri-robot-2-line" descricao={`v${perfilAna.versao} · responsável: ${perfilAna.responsavel}`}>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center">
            <span className="text-background-50 font-heading font-bold text-lg">{perfilAna.nome.charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="font-heading font-bold text-foreground-900">{perfilAna.nome}</p>
            <p className="text-sm text-foreground-600">{perfilAna.funcao}</p>
          </div>
          <StatusChip status={perfilAna.status} />
        </div>
        <p className="text-sm text-foreground-700 mb-5">{perfilAna.objetivo}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <p className="text-xs font-semibold text-foreground-500 uppercase mb-2">Personalidade</p>
            <TagList items={perfilAna.personalidade} />
            <p className="text-xs font-semibold text-foreground-500 uppercase mt-4 mb-2">Tom</p>
            <TagList items={perfilAna.tom} />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground-500 uppercase mb-2">A Ana nunca deve</p>
            <ul className="space-y-1.5">
              {perfilAna.nuncaFazer.map((n, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground-700">
                  <i className="ri-close-circle-line text-accent-500 mt-0.5 flex-shrink-0"></i>
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>

      {/* Variáveis */}
      <SectionCard titulo="Variáveis dinâmicas" icone="ri-code-s-slash-line" descricao="Fase 3 — validação de variáveis usadas nos templates e no prompt.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-background-200/70 bg-background-100/50">
                <th className="text-left px-4 py-2.5 text-foreground-500 font-medium text-xs">Variável</th>
                <th className="text-left px-4 py-2.5 text-foreground-500 font-medium text-xs">Descrição</th>
                <th className="text-left px-4 py-2.5 text-foreground-500 font-medium text-xs">No banco</th>
                <th className="text-left px-4 py-2.5 text-foreground-500 font-medium text-xs hidden md:table-cell">Fallback</th>
                <th className="text-left px-4 py-2.5 text-foreground-500 font-medium text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {variaveisDinamicas.map((v) => (
                <tr key={v.variavel} className="border-b border-background-100">
                  <td className="px-4 py-2.5 font-mono text-xs text-primary-700">{v.variavel}</td>
                  <td className="px-4 py-2.5 text-foreground-700">{v.descricao}</td>
                  <td className="px-4 py-2.5">
                    {v.existeNoBanco ? (
                      <span className="inline-flex items-center gap-1 text-primary-700 text-xs"><i className="ri-checkbox-circle-line"></i>Sim</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-accent-600 text-xs"><i className="ri-time-line"></i>Pendente</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-foreground-600 hidden md:table-cell text-xs">{v.fallback || '—'}</td>
                  <td className="px-4 py-2.5"><StatusChip status={v.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Templates */}
      <SectionCard titulo="Templates de primeiro contato" icone="ri-mail-send-line" descricao="Fase 4 — todos em rascunho. Templates de WhatsApp exigem aprovação da Meta.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templatesPrimeiroContato.map((t) => (
            <div key={t.id} className="border border-background-200/70 rounded-lg p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-foreground-900 text-sm">{t.nomeInterno}</p>
                  <p className="text-xs text-foreground-500">{t.canal} · {t.categoria}</p>
                </div>
                <StatusChip status={t.status} />
              </div>
              <p className="text-xs text-foreground-600 line-clamp-3 flex-1">{t.texto}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-background-100">
                <span className="text-xs text-foreground-400">v{t.versao} · {t.variaveis.length} variáveis</span>
                <button
                  onClick={() => setPreview({ tipo: 'template', titulo: t.nomeInterno, texto: t.texto, canais: [t.canal] })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-eye-line"></i>Pré-visualizar
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 bg-background-100 rounded-lg px-4 py-3 text-sm text-foreground-700">
          Assunto do e-mail de apresentação: <span className="font-mono text-primary-700 text-xs">{assuntoEmailApresentacao}</span>
        </div>
      </SectionCard>

      {/* Follow-ups */}
      <SectionCard titulo="Follow-ups e cadência" icone="ri-timer-flash-line" descricao="Fase 5 — rascunho. Nenhum envio automático ativo.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {followUpsAna.map((f) => (
            <div key={f.id} className="border border-background-200/70 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-foreground-900 text-sm">{f.nome}</p>
                <StatusChip status={f.status} />
              </div>
              <p className="text-xs text-foreground-500 mb-2">Disparo: {f.disparo}</p>
              <p className="text-sm text-foreground-700">{f.texto}</p>
              <p className="text-xs text-primary-700 mt-2">{f.proximaAcao}</p>
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold text-foreground-500 uppercase mb-2">Regras da cadência</p>
        <ul className="space-y-1.5">
          {regrasCadencia.map((r, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground-700">
              <i className="ri-checkbox-circle-line text-primary-500 mt-0.5 flex-shrink-0"></i>{r}
            </li>
          ))}
        </ul>
      </SectionCard>

      {/* Perguntas */}
      <SectionCard titulo="Perguntas de qualificação" icone="ri-question-answer-line" descricao="Fase 6 — uma pergunta por vez, escolhida conforme a resposta anterior.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {perguntasQualificacao.map((p) => (
            <div key={p.id} className="flex items-start gap-2.5 bg-background-100 rounded-lg p-3">
              <span className="w-5 h-5 rounded-full bg-secondary-500 text-background-50 flex items-center justify-center text-xs font-bold flex-shrink-0">{p.ordem}</span>
              <div>
                <p className="text-sm text-foreground-700">{p.texto}</p>
                <span className="text-[10px] uppercase text-foreground-400">{p.etapa}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Classificação */}
      <SectionCard titulo="Classificação, intenção e score" icone="ri-focus-3-line" descricao="Fase 7 — faixas e sinais usados para pontuar e priorizar o lead.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <p className="text-xs font-semibold text-foreground-500 uppercase mb-2">Intenções</p>
            <TagList items={intencoesAna} />
            <p className="text-xs font-semibold text-foreground-500 uppercase mt-4 mb-2">Faixas de score</p>
            <div className="space-y-1.5">
              {faixasScore.map((f) => (
                <div key={f.classificacao} className="flex items-center gap-2 text-sm text-foreground-700">
                  <span className="text-xs font-mono bg-background-100 px-2 py-0.5 rounded">{f.faixa}</span>
                  {f.classificacao}
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground-500 uppercase mb-2">Sinais positivos</p>
            <ul className="space-y-1.5">
              {sinaisPositivos.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground-700"><i className="ri-arrow-up-circle-line text-primary-500 mt-0.5"></i>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground-500 uppercase mb-2">Sinais de risco</p>
            <ul className="space-y-1.5">
              {sinaisRisco.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground-700"><i className="ri-alert-line text-accent-500 mt-0.5"></i>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </SectionCard>

      {/* Objeções */}
      <SectionCard titulo="Respostas a objeções" icone="ri-discuss-line" descricao="Fase 8 — sugestões, não envio automático.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {objecoesRespostas.map((o) => (
            <div key={o.id} className="border border-background-200/70 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-foreground-900 text-sm">“{o.objecao}”</p>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${o.transferirHumano ? 'bg-accent-100 text-accent-700' : 'bg-primary-100 text-primary-700'}`}>
                  <i className={o.transferirHumano ? 'ri-user-shared-line' : 'ri-robot-line'}></i>
                  {o.transferirHumano ? 'Humano' : 'Ana'}
                </span>
              </div>
              <p className="text-xs text-foreground-600 line-clamp-2 mb-3">{o.respostaWhatsapp}</p>
              <div className="flex items-center justify-between pt-2 border-t border-background-100">
                <span className="text-xs text-foreground-400">{o.acaoKanban}</span>
                <button
                  onClick={() => setPreview({ tipo: 'objecao', titulo: o.objecao, texto: `WhatsApp:\n${o.respostaWhatsapp}\n\nE-mail:\n${o.respostaEmail}\n\nPróxima pergunta:\n${o.proximaPergunta}`, canais: ['WhatsApp', 'E-mail'] })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background-100 hover:bg-background-200 text-foreground-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-eye-line"></i>Ver
                </button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Prompt */}
      <SectionCard titulo="Prompt operacional" icone="ri-terminal-box-line" descricao={`Fase 9 · v${promptOperacionalAna.versao} · ${promptOperacionalAna.status}`}>
        <div className="bg-foreground-950 rounded-xl p-5 text-background-100 text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
          {promptOperacionalAna.conteudo}
        </div>
      </SectionCard>

      {/* Handoff */}
      <SectionCard titulo="Regras de handoff Ana → Humano" icone="ri-user-shared-line" descricao="Fase 10 — transferência obrigatória e fluxo de entrega.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          {regrasHandoffAna.map((r) => (
            <div key={r.gatilho} className="flex items-start gap-3 border border-background-200/70 rounded-lg p-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${r.prioridade === 'alta' ? 'bg-accent-100 text-accent-700' : 'bg-secondary-100 text-secondary-700'}`}>
                <i className={r.obrigatorio ? 'ri-lock-2-line' : 'ri-lock-unlock-line'}></i>
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground-900 text-sm">{r.gatilho}</p>
                <p className="text-xs text-foreground-500">{r.descricao}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-primary-100 border border-primary-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-primary-800 uppercase mb-2">Mensagem ao lead no handoff</p>
          <p className="text-sm text-primary-900">{mensagemHandoffLead}</p>
        </div>
        <p className="text-xs font-semibold text-foreground-500 uppercase mt-5 mb-2">Fluxo do handoff</p>
        <ol className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {fluxoHandoff.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground-700">
              <span className="w-5 h-5 rounded-full bg-secondary-500 text-background-50 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
              {f}
            </li>
          ))}
        </ol>
      </SectionCard>

      {/* Base de conhecimento */}
      <SectionCard titulo="Base de conhecimento" icone="ri-book-open-line" descricao="Fase 11 — categorias, itens e pendências para aprovação.">
        <div className="mb-4 flex flex-wrap gap-2">
          {categoriasBaseConhecimento.map((c) => (
            <span key={c} className="px-3 py-1.5 rounded-full bg-background-100 text-foreground-700 text-xs">{c}</span>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          {baseConhecimentoAna.map((b) => (
            <div key={b.id} className="border border-background-200/70 rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-semibold text-foreground-900 text-sm">{b.titulo}</p>
                <StatusChip status={b.status} />
              </div>
              <p className="text-xs text-foreground-500 mb-2">{b.categoria}</p>
              <p className="text-sm text-foreground-700">{b.conteudo}</p>
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold text-accent-600 uppercase mb-2 flex items-center gap-2"><i className="ri-time-line"></i>Informações pendentes para aprovação</p>
        <ul className="space-y-1.5">
          {informacoesPendentes.map((i, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-foreground-700"><i className="ri-close-circle-line text-accent-500 mt-0.5 flex-shrink-0"></i>{i}</li>
          ))}
        </ul>
      </SectionCard>

      {/* Controle */}
      <SectionCard titulo="Configurações de controle" icone="ri-shield-check-line" descricao="Fase 12 — proteções desativadas por segurança até aprovação.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground-500 uppercase mb-1">Modo e canais</p>
            <p className="text-sm text-foreground-700">Modo padrão: <strong>{controleAna.modoPadrao}</strong></p>
            <p className="text-sm text-foreground-700">Horário: {controleAna.horarioAtendimento}</p>
            <p className="text-sm text-foreground-700">Canais permitidos: {controleAna.canaisPermitidos.join(', ')}</p>
            <p className="text-sm text-foreground-700">Templates permitidos: {controleAna.templatesPermitidos.length === 0 ? 'nenhum (aguardando aprovação)' : controleAna.templatesPermitidos.join(', ')}</p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground-500 uppercase mb-1">Limites</p>
            <p className="text-sm text-foreground-700">Mensagens por lead/dia: {controleAna.limiteMensagensPorLeadDia}</p>
            <p className="text-sm text-foreground-700">Tempo entre mensagens: {controleAna.tempoEntreMensagensMin} min</p>
            <p className="text-sm text-foreground-700">Follow-up 1: {controleAna.followUp1Horas}h · Follow-up 2: {controleAna.followUp2Horas}h · Timeout: {controleAna.timeoutHoras}h</p>
            <p className="text-sm text-foreground-700">Score handoff: {controleAna.scoreHandoff} · Confiança mínima: {controleAna.confiancaMinima}</p>
          </div>
        </div>
        <div className="mt-5 space-y-2">
          {[
            { label: 'Kill switch da Ana', on: controleAna.killSwitch, safe: true },
            { label: 'Permitir orçamento automático', on: controleAna.permitirOrcamentoAutomatico, safe: false },
            { label: 'Permitir desconto automático', on: controleAna.permitirDescontoAutomatico, safe: false },
            { label: 'Permitir negociação automática', on: controleAna.permitirNegociacaoAutomatica, safe: false },
          ].map((c) => (
            <div key={c.label} className="flex items-center justify-between py-2 border-b border-background-100 last:border-0">
              <span className={`text-sm ${c.on ? 'text-foreground-900 font-medium' : 'text-foreground-600'}`}>{c.label}</span>
              <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${c.safe ? 'bg-primary-100 text-primary-700' : 'bg-accent-100 text-accent-700'}`}>
                {c.on ? 'Ativo' : 'Desativado'}
              </span>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-foreground-950/50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-background-50 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-background-200/70 flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-foreground-950">{preview.titulo}</h3>
                <p className="text-xs text-foreground-500">{preview.canais.join(' · ')}</p>
              </div>
              <button onClick={() => setPreview(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background-100 cursor-pointer"><i className="ri-close-line text-lg"></i></button>
            </div>
            <div className="p-6">
              <div className="bg-background-100 rounded-lg p-4 text-sm text-foreground-800 whitespace-pre-wrap">{preview.texto}</div>
              <div className="pt-4 flex justify-end">
                <button onClick={() => setPreview(null)} className="px-4 py-2.5 border border-background-300 text-foreground-700 rounded-lg text-sm font-semibold hover:bg-background-100 cursor-pointer whitespace-nowrap">Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}