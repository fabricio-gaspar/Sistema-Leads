/* Execute esta instrucao no projeto: # PROMPT MESTRE — AUDITORIA, REAPROVEITAMENTO E RECONSTRUÇÃO FIEL DE TEMPLATE

Atue como um **Arquiteto de Software Sênior, UX/UI Designer Sênior, Front-end Engineer Sênior, Back-end Engineer Sênior e especialista em Design Systems**.

Vou fornecer imagens, screenshots, referências visuais ou templates de outros sistemas.

Sua obrigação é **NUNCA começar alterando o sistema imediatamente**.

Antes de qualquer implementação, execute uma análise completa entre:

1. O sistema atual.
2. A tela/template de referência enviada.
3. Os componentes existentes.
4. As funcionalidades existentes.
5. As funcionalidades visíveis na referência.
6. O banco de dados atual.
7. As rotas existentes.
8. As permissões existentes.
9. Os componentes reutilizáveis existentes.
10. Os recursos que ainda não existem no sistema.

---

# 1. REGRA PRINCIPAL

O objetivo NÃO é reconstruir o sistema do zero.

O objetivo é:

**ANALISAR → COMPARAR → REAPROVEITAR → COMPLETAR → PADRONIZAR → VALIDAR**

Siga obrigatoriamente esta lógica:

### Se o recurso já existir:

* Preserve sua lógica.
* Preserve sua integração com o backend.
* Preserve sua conexão com o banco.
* Preserve suas permissões.
* Preserve suas rotas.
* Preserve seus dados.
* Preserve suas validações.
* Reaproveite o componente sempre que tecnicamente adequado.
* Altere somente sua apresentação visual quando necessário para ficar fiel ao template.

### Se o recurso existir parcialmente:

* Não duplique.
* Analise o que está faltando.
* Complete o componente existente.
* Mantenha compatibilidade com o restante do sistema.

### Se o recurso não existir:

* Crie o recurso.
* Integre corretamente com o restante da aplicação.
* Crie backend, frontend, banco, estados, permissões e validações quando necessário.

### Se o template possuir apenas um elemento visual sem função real:

Não crie uma funcionalidade falsa.

Avalie se:

* deve ser apenas visual;
* deve utilizar dados reais existentes;
* ou se faz sentido criar uma nova funcionalidade integrada.

---

# 2. FIDELIDADE AO TEMPLATE

A referência enviada deve ser considerada a **fonte visual principal** da tela.

Quero alta fidelidade visual.

Analise detalhadamente:

* estrutura geral;
* grid;
* alinhamentos;
* largura dos elementos;
* altura dos elementos;
* proporções;
* espaçamentos;
* margens;
* paddings;
* hierarquia;
* densidade visual;
* menu lateral;
* cabeçalho;
* navegação;
* cards;
* tabelas;
* gráficos;
* indicadores;
* barras de progresso;
* filtros;
* campos;
* botões;
* dropdowns;
* ícones;
* badges;
* estados;
* tipografia;
* tamanho das fontes;
* peso das fontes;
* contraste;
* cores;
* bordas;
* radius;
* sombras;
* divisores;
* background;
* hover;
* focus;
* active;
* disabled;
* loading;
* empty state;
* error state;
* responsive;
* comportamento em diferentes resoluções.

Não faça apenas algo “parecido”.

Faça uma reconstrução visual **o mais fiel possível à referência fornecida**, adaptando somente o que for necessário para comportar as funcionalidades reais do sistema.

---

# 3. NÃO ALTERAR FUNCIONALIDADES EXISTENTES SEM NECESSIDADE

Antes de modificar qualquer componente existente, descubra:

* onde ele é utilizado;
* quais dados recebe;
* quais ações executa;
* quais tabelas consulta;
* quais APIs utiliza;
* quais permissões possui;
* quais componentes dependem dele;
* quais páginas dependem dele.

Não remova funcionalidades apenas porque elas não aparecem na imagem de referência.

A imagem representa uma referência de **design e organização**, não necessariamente todo o escopo funcional do sistema.

Se meu sistema possuir mais recursos que o template:

**mantenha os recursos e adapte-os ao novo padrão visual.**

---

# 4. NÃO DUPLICAR COMPONENTES

Antes de criar qualquer componente novo, procure no projeto por componentes equivalentes.

Exemplos:

* Card
* MetricCard
* DashboardCard
* Button
* Input
* SearchInput
* Select
* Dropdown
* Table
* DataTable
* Badge
* Modal
* Drawer
* Sidebar
* Header
* Navbar
* Tooltip
* Tabs
* Pagination
* Chart
* ProgressBar
* Avatar
* Skeleton
* EmptyState
* ErrorState

Se existir algo equivalente, reutilize ou transforme o componente existente.

Evite criar:

`Card2`

`CardNew`

`NewSidebar`

`DashboardCardV2`

`TableNew`

ou qualquer duplicação desnecessária.

Crie componentes realmente novos somente quando houver justificativa técnica.

---

# 5. DESIGN SYSTEM

Extraia da referência um Design System consistente para aplicação no sistema.

Mapeie:

## Cores

Identifique:

* background principal;
* background secundário;
* sidebar;
* item ativo;
* cor primária;
* cor secundária;
* cor de sucesso;
* alerta;
* erro;
* informação;
* texto principal;
* texto secundário;
* borda;
* cards;
* badges.

Não espalhe cores hardcoded pelo projeto.

Transforme-as em tokens ou variáveis reutilizáveis.

---

# 6. PADRÃO VISUAL DA REFERÊNCIA ATUAL

Para a referência enviada, considere como direção visual:

## Sidebar

Sidebar vertical fixa no lado esquerdo.

Características:

* fundo muito escuro;
* logo no topo;
* navegação vertical;
* ícones discretos;
* texto claro;
* item ativo destacado em verde/teal escuro;
* cantos arredondados;
* espaçamento confortável;
* área do usuário no rodapé.

Itens devem possuir:

* estado normal;
* hover;
* active;
* focus;
* disabled quando aplicável.

---

## Topbar

Área superior clara contendo:

* campo de busca;
* indicadores de status;
* notificações;
* ajuda;
* ações adicionais quando necessário.

Visual:

* leve;
* discreto;
* alinhado;
* sem poluição visual.

---

# 7. DASHBOARD

A estrutura principal deve seguir aproximadamente a referência enviada.

## Cabeçalho

Exemplo:

Dashboard

Texto auxiliar abaixo do título.

---

## Cards de métricas

Cards horizontais distribuídos de forma uniforme.

Cada card pode conter:

* ícone;
* número principal;
* descrição;
* indicador de evolução;
* comparação percentual;
* estado positivo/negativo.

Exemplos visíveis na referência:

* Leads Encontrados
* Leads Abordados
* Convertidos
* Leads Qualificados

Porém:

**use os indicadores reais disponíveis no sistema.**

Não invente números estáticos para produção.

---

# 8. GRÁFICOS

A referência utiliza uma visualização muito limpa.

O gráfico principal possui:

* título;
* filtro temporal;
* meses;
* barras horizontais;
* valores;
* legenda;
* cores consistentes.

Sempre que possível, utilize dados reais.

Caso o sistema já possua gráficos:

reutilize a lógica e adapte apenas o estilo.

---

# 9. INDICADORES

A área lateral de indicadores deve seguir o mesmo padrão visual.

Exemplos:

* Taxa de Resposta
* Taxa de Fechamento
* Taxa de Qualificação

Cada indicador pode possuir:

* descrição;
* percentual;
* barra de progresso;
* cor contextual.

As porcentagens devem ser calculadas a partir dos dados reais quando disponíveis.

---

# 10. TABELAS

A tabela deve seguir visual limpo e moderno.

Exemplo da referência:

* Lead
* Empresa
* Cidade
* Status

A tabela do sistema real pode possuir mais campos.

Não elimine campos necessários à operação.

Quando houver muitas informações, utilize:

* colunas configuráveis;
* ações;
* filtros;
* paginação;
* ordenação;
* busca;
* responsividade;
* menu de ações;
* detalhes em drawer/modal quando necessário.

---

# 11. STATUS

Padronize status através de badges.

Exemplos:

* Novo
* Abordado
* Qualificado
* Convertido

Cada status deve possuir cor consistente em todo o sistema.

Não utilize uma cor diferente para o mesmo status em páginas diferentes.

---

# 12. RESPONSIVIDADE

Não desenvolva a tela pensando somente na resolução da imagem.

Teste:

* 1920px
* 1440px
* 1366px
* 1280px
* tablets
* dispositivos móveis

O layout deverá se adaptar sem quebrar.

Exemplos:

### Desktop

Sidebar fixa + conteúdo completo.

### Tablet

Sidebar compactável.

### Mobile

Menu drawer/hambúrguer.

Cards devem reorganizar automaticamente.

Tabelas devem possuir estratégia adequada de responsividade.

---

# 13. PRIMEIRA ETAPA OBRIGATÓRIA — AUDITORIA

ANTES DE ALTERAR QUALQUER ARQUIVO, me apresente um relatório contendo:

## A. Elementos encontrados no template

Liste:

* estrutura;
* componentes;
* menus;
* cards;
* gráficos;
* tabelas;
* filtros;
* indicadores;
* campos;
* recursos;
* comportamentos.

## B. Elementos equivalentes já existentes no sistema

Para cada item, informe:

* já existe;
* existe parcialmente;
* não existe.

Use classificação:

**EXISTE**

**EXISTE PARCIALMENTE**

**NÃO EXISTE**

---

# 14. MATRIZ DE COMPARAÇÃO

Crie uma matriz como:

| Elemento da Referência | Existe no Sistema | Ação         |
| ---------------------- | ----------------- | ------------ |
| Sidebar                | Sim               | Reestilizar  |
| Dashboard              | Sim               | Reorganizar  |
| Busca Global           | Parcial           | Completar    |
| Card de métricas       | Sim               | Reutilizar   |
| Gráfico                | Sim               | Reestilizar  |
| Indicadores            | Não               | Criar        |
| Leads recentes         | Sim               | Reaproveitar |
| Status                 | Sim               | Padronizar   |

Faça isso com todos os componentes identificados.

---

# 15. MAPA DE IMPACTO

Antes de implementar, determine quais áreas serão afetadas.

Informe:

* páginas;
* componentes;
* hooks;
* serviços;
* APIs;
* banco de dados;
* rotas;
* permissões;
* autenticação;
* componentes compartilhados;
* integrações.

Isso serve para evitar regressões.

---

# 16. SEGUNDA ETAPA — IMPLEMENTAÇÃO

Depois da auditoria, execute as alterações.

Prioridade:

1. preservar funcionamento;
2. reaproveitar componentes;
3. criar o que estiver faltando;
4. aplicar o Design System;
5. reproduzir a estrutura do template;
6. garantir responsividade;
7. validar o sistema.

---

# 17. BANCO DE DADOS

Não altere o banco apenas para atender uma mudança estética.

Só crie:

* tabela;
* coluna;
* relacionamento;
* índice;
* trigger;
* função;
* policy;

quando uma funcionalidade real exigir.

Se precisar alterar o banco:

analise antes a estrutura existente e evite duplicações.

---

# 18. PERMISSÕES E SEGURANÇA

Toda nova funcionalidade deve respeitar:

* autenticação;
* autorização;
* tenant;
* empresa;
* usuário;
* perfil;
* cargo;
* permissões existentes;
* políticas de acesso.

Não transforme componentes protegidos em públicos.

Não remova políticas para facilitar desenvolvimento.

---

# 19. DADOS REAIS

Evite hardcode em telas de produção.

Não deixe permanentemente:

`1247 Leads`

`856 Abordados`

`187 Convertidos`

ou outros dados apenas porque aparecem na referência.

Utilize valores reais da aplicação.

Caso os dados ainda não existam, implemente:

* estado vazio;
* loading;
* skeleton;
* zero state.

---

# 20. NÃO INVENTAR FUNCIONALIDADES

Quando algo na imagem não estiver suficientemente claro:

primeiro analise o contexto.

Não crie comportamento arbitrário.

Utilize a arquitetura e os padrões já existentes no sistema.

---

# 21. CONSISTÊNCIA ENTRE TELAS

Depois que o padrão visual for aprovado, ele deve virar padrão global.

Todas as telas futuras devem respeitar:

* mesma sidebar;
* mesma topbar;
* mesmos cards;
* mesmos inputs;
* mesmos botões;
* mesmos badges;
* mesmas tabelas;
* mesmos modais;
* mesmos drawers;
* mesmos paddings;
* mesmos containers;
* mesmo grid;
* mesma tipografia;
* mesma identidade visual.

---

# 22. QUALIDADE DE CÓDIGO

Não faça alterações rápidas ou improvisadas.

Garanta:

* componentes reutilizáveis;
* tipagem correta;
* código legível;
* arquitetura organizada;
* nomenclatura consistente;
* ausência de duplicação;
* baixo acoplamento;
* manutenção futura simples.

---

# 23. TESTES OBRIGATÓRIOS

Depois de implementar, valide:

### Frontend

* build;
* TypeScript;
* lint;
* rotas;
* componentes;
* responsividade.

### Backend

* APIs;
* autenticação;
* integrações;
* operações CRUD;
* tratamento de erros.

### Banco

* consultas;
* relacionamentos;
* permissões;
* políticas;
* migrations.

### Fluxo

Teste o caminho completo do usuário.

Exemplo:

Dashboard → Leads → Lead → Empresa → Kanban → Funil → Atendimento → Agenda → Relatórios.

---

# 24. AUDITORIA VISUAL FINAL

Faça uma comparação visual entre:

**REFERÊNCIA**

e

**IMPLEMENTAÇÃO**

Verifique:

* posicionamento;
* proporções;
* espaçamento;
* tamanho dos elementos;
* tipografia;
* cores;
* cards;
* bordas;
* radius;
* alinhamento;
* grid;
* sidebar;
* topbar;
* tabelas;
* gráficos.

Corrija diferenças perceptíveis.

---

# 25. NÃO SACRIFICAR FUNCIONALIDADE PELA APARÊNCIA

A prioridade final deverá ser:

**Fidelidade visual + funcionamento real.**

Não aceito:

* tela bonita sem funcionamento;
* botão decorativo;
* gráfico falso;
* filtro sem ação;
* card sem conexão aos dados;
* menu sem rota;
* recurso duplicado;
* componente quebrado;
* dados hardcoded em produção.

---

# 26. REGRA PARA TODA NOVA REFERÊNCIA QUE EU ENVIAR

Sempre que eu enviar uma nova imagem ou template:

1. Analise a imagem.
2. Analise a tela correspondente no sistema.
3. Compare os dois.
4. Identifique o que já existe.
5. Reaproveite o que existe.
6. Complete o que existir parcialmente.
7. Crie apenas o que estiver faltando.
8. Preserve toda funcionalidade existente.
9. Reproduza fielmente o design da referência.
10. Integre tudo ao sistema.
11. Teste.
12. Compare visualmente novamente.
13. Corrija as diferenças.

Nunca comece simplesmente substituindo a página.

---

# 27. RESULTADO ESPERADO

Quero que o sistema final pareça ter sido originalmente desenvolvido com este Design System.

Não quero aparência de:

* vários templates misturados;
* componentes adicionados posteriormente;
* estilos inconsistentes;
* páginas independentes;
* elementos genéricos do Lovable.

Quero aparência de um produto SaaS profissional, consistente e comercial.

---

# ORDEM DE EXECUÇÃO

Execute nesta ordem:

**ETAPA 1 — Auditoria da referência**

**ETAPA 2 — Auditoria da implementação atual**

**ETAPA 3 — Matriz referência × sistema**

**ETAPA 4 — Identificação do que será reutilizado**

**ETAPA 5 — Identificação do que será criado**

**ETAPA 6 — Plano de implementação**

**ETAPA 7 — Implementação**

**ETAPA 8 — Validação funcional**

**ETAPA 9 — Validação do banco e permissões**

**ETAPA 10 — Comparação visual**

**ETAPA 11 — Correções finais**

---

## REGRA FINAL

A imagem/template que eu fornecer determina **como o sistema deve parecer**.

O sistema existente determina **como os recursos devem funcionar**.

Sua tarefa é unir os dois sem perder funcionalidades, dados, segurança ou integrações.

Antes de programar, faça a auditoria.

Depois reaproveite tudo que puder.

Crie somente o que faltar.

E seja visualmente o mais fiel possível à referência que eu fornecer.
Vou te manda a imagem logo a seguir */
import { createFileRoute } from "@tanstack/react-router";
import { Users, Bot, ShoppingCart } from "lucide-react";
import { Card, StatCard } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-title">Dashboard</h1>
        <p className="text-sm text-text-sec">Bem-vindo de volta! Aqui está o resumo da sua prospecção.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Leads Encontrados"
          value="1.247"
          delta="+12%"
          tone="primary"
        />
        <StatCard
          icon={<Bot className="h-5 w-5" />}
          label="Leads Abordados"
          value="856"
          delta="+8%"
          tone="hot"
        />
        <StatCard
          icon={<ShoppingCart className="h-5 w-5" />}
          label="Convertidos"
          value="187"
          delta="+15%"
          tone="success"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Leads Qualificados"
          value="423"
          delta="+18%"
          tone="ia"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold text-text-title">Evolução de Leads</h2>
              <select className="text-[11px] border border-border-card rounded bg-bg-general px-2 py-1 outline-none">
                <option>Últimos 6 meses</option>
              </select>
            </div>
            
            <div className="space-y-4">
              {[
                { m: 'Jan', v: 180, p: '70%' },
                { m: 'Fev', v: 210, p: '82%' },
                { m: 'Mar', v: 195, p: '76%' },
                { m: 'Abr', v: 240, p: '93%' },
                { m: 'Mai', v: 260, p: '100%' },
                { m: 'Jun', v: 247, p: '96%' }
              ].map((item) => (
                <div key={item.m} className="flex items-center gap-4">
                  <div className="w-8 text-[11px] text-text-ter">{item.m}</div>
                  <div className="flex-1 h-6 bg-bg-general rounded-sm overflow-hidden relative">
                    <div 
                      className="h-full bg-primary transition-all duration-500" 
                      style={{ width: item.p }}
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">
                      {item.v}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-6">
              <div className="flex items-center gap-2 text-[10px] text-text-sec">
                <span className="h-2 w-2 rounded-full bg-primary" /> Encontrados
              </div>
              <div className="flex items-center gap-2 text-[10px] text-text-sec">
                <span className="h-2 w-2 rounded-full bg-hot" /> Abordados
              </div>
              <div className="flex items-center gap-2 text-[10px] text-text-sec">
                <span className="h-2 w-2 rounded-full bg-success" /> Convertidos
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-sm font-bold text-text-title mb-6">Indicadores</h2>
          <div className="space-y-8">
            <Indicator label="Taxa de Resposta" value="68.6%" color="bg-primary" />
            <Indicator label="Taxa de Fechamento" value="44.2%" color="bg-hot" />
            <Indicator label="Taxa de Qualificação" color="bg-primary" value="49.4%" />
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="p-4 border-b border-border-card flex items-center justify-between">
          <h2 className="text-sm font-bold text-text-title">Leads Recentes</h2>
          <button className="text-[11px] text-primary font-medium hover:underline">Ver todos</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-bg-general/50 text-text-ter uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3 font-semibold">Lead</th>
                <th className="px-4 py-3 font-semibold">Empresa</th>
                <th className="px-4 py-3 font-semibold">Cidade</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-card">
              <tr className="text-text-body">
                <td className="px-4 py-3">João Silva</td>
                <td className="px-4 py-3">Empresa A</td>
                <td className="px-4 py-3">São Paulo</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full bg-success-bg text-success text-[10px] font-medium">Novo</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Indicator({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-text-body">{label}</span>
        <span className="font-bold text-text-title">{value}</span>
      </div>
      <div className="h-2 w-full bg-bg-general rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: value }} />
      </div>
    </div>
  );
}
