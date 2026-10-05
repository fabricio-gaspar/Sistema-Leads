# Fase 9 — Resiliência de inicialização

## Objetivo

Evitar que uma configuração incompleta do Supabase ou uma exceção não tratada resulte em tela em branco no frontend.

## Entregas

- A ausência de `VITE_PUBLIC_SUPABASE_URL` ou de uma chave pública renderiza uma tela de configuração, sem inicializar sessão ou efetuar chamadas externas.
- `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY` é a opção preferida; `VITE_PUBLIC_SUPABASE_ANON_KEY` permanece como compatibilidade legada.
- Um Error Boundary global isola falhas de renderização e disponibiliza recarregamento explícito.
- Os detalhes do erro ficam somente no console para diagnóstico técnico.

## Limites

- Nenhuma migration foi criada ou aplicada nesta fase.
- O ambiente continua sem integração Supabase remota até que a conexão seja autorizada pelo responsável do projeto.
