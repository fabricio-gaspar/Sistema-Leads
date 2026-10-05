// Tipos legados preservados temporariamente enquanto o domínio de orçamentos é
// movido para src/lib/crm. Não há dados simulados carregados neste módulo.
export interface ItemCatalogo {
  id: string;
  nome: string;
  preco: number;
  unidade: string;
}

export interface ItemProposta {
  precoConfirmado?: boolean;
  id: string;
  nome: string;
  quantidade: number;
  preco: number;
}

export interface Proposta {
  createdAt?: string;
  id: string;
  numero: string;
  lead: string;
  leadId?: string;
  empresa: string;
  valor: number;
  status: 'rascunho' | 'enviada' | 'visualizada' | 'aceita' | 'recusada' | 'expirada' | 'aguardando_aprovacao';
  validade: string;
  responsavel: string;
  data: string;
  canal: string;
  itens: ItemProposta[];
  descontoPct: number;
  versao: number;
  motivoPerda?: string;
  aprovador?: string;
  propostaPaiId?: string;
  descontoAprovado?: boolean;
  bloqueadaEnvio?: boolean;
  templateId?: string;
  formaPagamento?: string;
  garantia?: string;
  termos?: string;
}
