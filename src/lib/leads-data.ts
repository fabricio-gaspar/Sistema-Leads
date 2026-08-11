// Utilidades compartilhadas de formatação. Os dados de leads vivem no Supabase.
export function formatBRL(n: number) {
  return (n ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}
