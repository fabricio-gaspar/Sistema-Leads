# R9 — revisão independente e reforço MVCC

Revisão solicitada pelo root; correção do contraexemplo autorizada na mesma frente. Estado exclusivamente local, nenhum calendário/Supabase real acessado ou alterado.

## Contraexemplo confirmado

A primeira versão R9 travava o compromisso pai e adquiria advisory lock por organização/responsável. Isso protegia duas ações sobre o **mesmo pai**, mas não renovava a snapshot em REPEATABLE READ para **dois pais distintos** do mesmo responsável. A segunda transação podia não ver o filho recém-criado pela primeira e criar uma sobreposição sem override.

Prova em PostgreSQL 17.6 temporário: o runner novo recebeu em memória apenas o corpo RPC com a linha anterior de advisory lock (nenhum arquivo de produto alterado para a prova). O caso `differentParents=true`, `sameResponsible=true`, `REPEATABLE READ` terminou com dois filhos e resultado inesperadamente bem-sucedido. Registrado em `EV-R9-MVCC-before.json`. READ COMMITTED detectou conflito; SERIALIZABLE abortou por SSI.

## Correção

- Tabela **privada** `agenda_responsible_revision`, chave org/responsável, sem acesso direto de PUBLIC/anon/authenticated, RLS habilitada.
- Helper privado definer, `search_path=''`, valida contexto atual, membership ativa, resposta autorizada ao lead e responsável ativo. Apenas authenticated pode executar; não recebe identidade do ator por parâmetro.
- `INSERT ... ON CONFLICT DO UPDATE revision=revision+1` na mesma transação cria uma barreira física MVCC. O chamador já autorizou e travou o pai antes da chamada.
- Em RC o segundo aguarda e então observa o conflito; em RR/Serializable a escrita sobre versão concorrente aborta com 40001. Não se muda calendário externo nem se promete exclusividade geral.

## Evidência atual

`agendaR9.integration.mjs`: **31/31** casos (27 existentes + quatro negativos do helper/tabela privados). `agendaR9.concurrent.mjs`: **31 + 9 = 40/40**, incluindo três novos casos de pais distintos. `EV-R9-MVCC-postgres.json` registra as corridas e o estado final de um único filho.

A validação de conflito continua limitada às linhas de appointments visíveis ao chamador por RLS. Isso evita contornar carteira para revelar agenda alheia; **não constitui calendário global exclusivo**. Edições/criações normais fora desta RPC mantêm o fluxo atual de conflito/override. Override explícito da próxima ação continua permitido e testado. Barreiras novas não afetam o isolamento de leitura.

Reprodução: mesmos Node/PG/pg/PGlite temporários documentados em R4; executar `supabase/tests/agendaR9.integration.mjs` com PGlite e `supabase/tests/agendaR9.concurrent.mjs` com native/bin e pg/lib/index.js. Runner só admite cluster local efêmero, socket0700, sem TCP; encerra em finally. Sem claim de homologação E2E.
