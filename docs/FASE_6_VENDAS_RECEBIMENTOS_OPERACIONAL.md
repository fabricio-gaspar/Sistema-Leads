# Fase 6 — Vendas e Recebimentos Operacionais

## Entrega

O fluxo comercial passa a ter uma fonte relacional única para vendas e recebimentos:

- `crm_sales` representa a venda originada por uma proposta aceita;
- `crm_receivables` representa o título inicial a receber da venda;
- uma RPC atômica aceita a proposta, fecha a oportunidade, cria venda e cria recebimento;
- a tela de Orçamentos usa a venda relacional para listar e atualizar recebimentos.

## Controles comerciais

- Uma proposta gera somente uma venda, protegida por chave única da organização e proposta.
- O valor gravado na venda é o total final da proposta, após descontos.
- Propostas aceitas e vendas pagas não podem ser arquivadas pelo navegador.
- Alterar o status financeiro exige `owner`, `admin` ou `manager`; vendedores continuam podendo consultar os próprios dados de operação conforme o RLS da organização.
- Toda criação, alteração de pagamento e arquivamento permitido gera evento em `audit_logs`.
- Não há integração com PIX, banco, boleto, cartão ou gateway nesta fase. O status é operacional e deverá ser alimentado por integração controlada ou conciliação na fase própria.

## Homologação

1. Aplicar migrations das Fases 1 a 6, na ordem, em uma branch Supabase de homologação.
2. Testar com duas organizações e confirmar que um ID de proposta/venda da outra empresa é recusado pelas RPCs.
3. Validar: proposta enviada → aceite → venda pendente → recebimento pago → tentativa de arquivamento bloqueada.
4. Testar um vendedor e um gestor: o vendedor não deve conseguir marcar pagamento; o gestor deve conseguir.

As migrations continuam apenas versionadas; nenhuma alteração foi aplicada remotamente.
