import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate({ to: "/", replace: true });
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setInfo("Se este e-mail existir na equipe, enviamos um link de redefinição.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-general px-4">
      <div className="w-full max-w-md rounded-xl border border-border-card bg-bg-card p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            WF
          </div>
          <div>
            <div className="text-base font-semibold text-text-title">WF Digital CRM</div>
            <div className="text-[12px] text-text-sec">
              {mode === "signin" ? "Entre na sua conta" : "Recuperar senha"}
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="E-mail">
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="voce@empresa.com"
            />
          </Field>
          {mode === "signin" && (
            <Field label="Senha">
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
              />
            </Field>
          )}

          {error && <div className="rounded-md bg-error-bg px-3 py-2 text-[12px] text-error">{error}</div>}
          {info && <div className="rounded-md bg-success-bg px-3 py-2 text-[12px] text-success">{info}</div>}

          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-[13px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Entrar" : "Enviar link de redefinição"}
          </button>
        </form>

        <div className="mt-4 text-center text-[12px] text-text-sec">
          {mode === "signin" ? (
            <button onClick={() => { setMode("forgot"); setError(null); setInfo(null); }} className="text-primary hover:underline">
              Esqueci minha senha
            </button>
          ) : (
            <button onClick={() => { setMode("signin"); setError(null); setInfo(null); }} className="text-primary hover:underline">
              Voltar para login
            </button>
          )}
        </div>

        <div className="mt-6 border-t pt-4">
          <div className="text-[10px] text-text-ter leading-relaxed bg-bg-general p-3 rounded-lg border border-border-card whitespace-pre-wrap">
            Execute esta instrucao no projeto: Atue como um Arquiteto de Software Sênior, Especialista em Auditoria de Sistemas SaaS, Segurança, Banco de Dados, UX e Qualidade de Software.\n\nFaça uma auditoria técnica completa e minuciosa de todo este sistema, sem alterar nada inicialmente. Analise frontend, backend, banco de dados, autenticação, permissões, integrações e todos os fluxos operacionais.\n\nObjetivo: identificar qualquer erro, inconsistência, falha de segurança, campo desconectado, permissão incorreta, fluxo incompleto ou regra de negócio não aplicada.\n\nA auditoria deve cobrir obrigatoriamente:\n\n1. Frontend\n- Verifique todas as páginas, menus, rotas, botões, filtros, modais, tabelas, cards, formulários e dashboards.\n- Identifique botões sem ação, links quebrados, páginas em branco, carregamentos infinitos, erros de console e componentes que não recebem ou não salvam dados corretamente.\n- Confira responsividade para desktop, tablet e celular.\n- Verifique validações de campos obrigatórios, máscaras, formatos de e-mail, telefone, CPF/CNPJ, datas, números, moeda e mensagens de erro.\n- Confirme que cada tela respeita o perfil e as permissões do usuário autenticado.\n- Localize dados fixos, simulados ou mockados que deveriam vir do banco de dados.\n\n2. Backend e regras de negócio\n- Mapeie todas as APIs, funções, serviços, Edge Functions, webhooks e automações.\n- Verifique se cada ação feita no frontend é corretamente processada, validada e gravada no backend.\n- Identifique endpoints inexistentes, chamadas quebradas, duplicidade de lógica, erros silenciosos, ausência de tratamento de exceção e falta de logs.\n- Valide regras de negócio, cálculos, status, notificações, cadências, aprovações, exclusões, edições e transições entre etapas.\n- Confirme que fluxos críticos não dependem apenas de validação no frontend.\n\n3. Banco de dados\n- Faça o levantamento de todas as tabelas, colunas, tipos de dados, relacionamentos, chaves primárias, chaves estrangeiras, índices, views, triggers e funções.\n- Compare cada campo exibido ou preenchido no sistema com o banco de dados.\n- Para cada tela e formulário, informe:\n  - campo exibido no frontend;\n  - tabela e coluna correspondente no banco;\n  - tipo do dado;\n  - se o campo é obrigatório;\n  - regra de validação;\n  - se salva corretamente;\n  - se é carregado corretamente ao editar;\n  - perfil que pode visualizar, criar, alterar e excluir.\n- Identifique campos existentes no frontend sem coluna no banco, campos do banco sem uso, nomes inconsistentes, dados duplicados, colunas faltantes e relações incorretas.\n- Verifique integridade referencial, registros órfãos, risco de duplicidade e exclusões que podem causar perda de dados.\n- Verifique se campos sensíveis estão protegidos e não são expostos indevidamente.\n\n4. Autenticação, usuários e permissões\n- Audite login, logout, recuperação e redefinição de senha, sessão, expiração de token e proteção de rotas.\n- Verifique todos os perfis de usuários e suas permissões reais.\n- Confirme que permissões são validadas também no backend e no banco, não apenas ocultando botões no frontend.\n- Audite as políticas RLS do Supabase tabela por tabela.\n- Confirme isolamento dos dados por empresa/tenant: um usuário de uma empresa não pode visualizar, editar, exportar ou excluir dados de outra empresa.\n- Identifique riscos de escalonamento de privilégio, acesso indevido por URL/API, vazamento de dados ou políticas permissivas demais.\n\n5. Fluxo completo do sistema\n- Teste mentalmente e tecnicamente cada fluxo de ponta a ponta:\n  cadastro → validação → gravação no banco → consulta → edição → permissões → histórico/auditoria → exclusão ou arquivamento.\n- Verifique todos os módulos e suas integrações entre si.\n- Confirme que dados criados em um módulo aparecem corretamente nos módulos dependentes.\n- Identifique etapas incompletas, status que não evoluem, registros que não são associados corretamente e fluxos que podem travar o usuário.\n- Avalie os cenários normais, erro, dados vazios, duplicidade, usuário sem permissão e falha de integração.\n\n6. Segurança e confiabilidade\n- Verifique exposição de chaves, tokens, senhas, dados pessoais e informações sigilosas.\n- Confira se existem logs de auditoria para operações críticas.\n- Avalie proteção contra acesso indevido, injeções, manipulação de parâmetros, exclusões acidentais e alterações sem rastreabilidade.\n- Verifique se operações críticas possuem confirmação, validação e tratamento de falha.\n- Avalie backups, consistência de migrations e possibilidade de reversão segura.\n\nEntrega obrigatória antes de qualquer alteração:\n\nCrie um relatório técnico organizado por prioridade:\n\n- Crítico: impede uso, causa perda/vazamento de dados ou permite acesso indevido.\n- Alto: quebra fluxos importantes ou gera dados incorretos.\n- Médio: inconsistências funcionais, permissões incompletas ou falhas de UX.\n- Baixo: melhorias, padronização e otimizações.\n\nPara cada item encontrado, informe:\n1. Módulo/tela afetada;\n2. Descrição objetiva do problema;\n3. Evidência técnica;\n4. Impacto para usuário, negócio e segurança;\n5. Causa provável;\n6. Correção recomendada;\n7. Arquivos, tabelas, colunas, políticas RLS ou funções envolvidas;\n8. Prioridade;\n9. Risco de aplicar a correção;\n10. Como validar após a correção.\n\nTambém entregue uma matriz de rastreabilidade contendo:\n\n- Tela/Módulo;\n- Campo do frontend;\n- Tabela;\n- Coluna;\n- Tipo;\n- Obrigatório;\n- Regra de validação;\n- Permissão de visualizar;\n- Permissão de criar;\n- Permissão de editar;\n- Permissão de excluir;\n- Status da integração: correto, incompleto, inexistente ou inconsistente.\n\nNão faça alterações, migrations, exclusões ou mudanças de permissões antes de apresentar o relatório completo e aguardar minha autorização.\n\nApós eu aprovar as correções, implemente em etapas, começando pelos itens críticos, valide cada etapa e informe exatamente o que foi corrigido.
          </div>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          height: 40px;
          border-radius: 6px;
          border: 1px solid var(--border-card, #e2e8f0);
          background: var(--bg-general, #f8fafc);
          padding: 0 12px;
          font-size: 13px;
          color: var(--text-title, #0f172a);
          outline: none;
        }
        .input:focus { border-color: hsl(var(--primary)); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-ter">
        {label}
      </span>
      {children}
    </label>
  );
}