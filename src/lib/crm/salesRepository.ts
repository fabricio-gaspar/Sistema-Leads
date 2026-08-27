import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import type { Proposta, Venda } from '@/mocks/propostasData';

type DbPaymentStatus = 'pending' | 'processing' | 'paid' | 'refunded' | 'cancelled';

interface SaleRow {
  id: string;
  proposal_id: string;
  amount: number | string;
  payment_method: string;
  payment_status: DbPaymentStatus;
  receipt_number: string | null;
  created_at: string;
  crm_proposals: {
    number: string;
    crm_opportunities: {
      crm_leads: { primary_contact_name: string | null; company_name: string } | Array<{ primary_contact_name: string | null; company_name: string }>;
    } | Array<{
      crm_leads: { primary_contact_name: string | null; company_name: string } | Array<{ primary_contact_name: string | null; company_name: string }>;
    }>;
  } | Array<{
    number: string;
    crm_opportunities: {
      crm_leads: { primary_contact_name: string | null; company_name: string } | Array<{ primary_contact_name: string | null; company_name: string }>;
    } | Array<{
      crm_leads: { primary_contact_name: string | null; company_name: string } | Array<{ primary_contact_name: string | null; company_name: string }>;
    }>;
  }>;
}

interface SaleMutationRow {
  id: string;
  amount: number | string;
  payment_method: string;
  payment_status: DbPaymentStatus;
  receipt_number: string | null;
  created_at: string;
}

const statusFromDb: Record<DbPaymentStatus, Venda['status']> = {
  pending: 'pendente',
  processing: 'processando',
  paid: 'pago',
  refunded: 'estornado',
  cancelled: 'cancelado',
};

const statusToDb: Record<Venda['status'], DbPaymentStatus> = {
  pendente: 'pending',
  processando: 'processing',
  pago: 'paid',
  estornado: 'refunded',
  cancelado: 'cancelled',
};

function one<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function numberValue(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function saleRowToVenda(row: SaleRow): Venda {
  const proposal = one(row.crm_proposals);
  const opportunity = one(proposal?.crm_opportunities);
  const lead = one(opportunity?.crm_leads);
  return {
    id: row.id,
    lead: lead?.primary_contact_name || 'Contato não informado',
    empresa: lead?.company_name || 'Empresa não informada',
    valor: numberValue(row.amount),
    metodo: row.payment_method,
    status: statusFromDb[row.payment_status],
    data: row.created_at.slice(0, 10),
    comprovante: row.receipt_number || '—',
    proposta: proposal?.number || 'Proposta não informada',
  };
}

function mutationToVenda(row: SaleMutationRow, proposal: Pick<Proposta, 'numero' | 'lead' | 'empresa'>): Venda {
  return {
    id: row.id,
    lead: proposal.lead,
    empresa: proposal.empresa,
    valor: numberValue(row.amount),
    metodo: row.payment_method,
    status: statusFromDb[row.payment_status],
    data: row.created_at.slice(0, 10),
    comprovante: row.receipt_number || '—',
    proposta: proposal.numero,
  };
}

export async function loadOperationalSales(): Promise<Venda[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase
    .from('crm_sales')
    .select('id, proposal_id, amount, payment_method, payment_status, receipt_number, created_at, crm_proposals!inner(number, crm_opportunities!inner(crm_leads!inner(primary_contact_name, company_name)))')
    .eq('organization_id', session.organizationId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as SaleRow[]).map(saleRowToVenda);
}

export async function acceptProposalAndCreateSale(proposal: Proposta): Promise<Venda> {
  const { data, error } = await supabase.rpc('accept_crm_proposal_and_create_sale', {
    target_proposal_id: proposal.id,
    initial_payment_method: 'PIX',
  });
  if (error) throw error;
  return mutationToVenda(data as SaleMutationRow, proposal);
}

export async function updateOperationalSale(sale: Venda): Promise<Venda> {
  const { data, error } = await supabase.rpc('update_crm_sale_payment', {
    target_sale_id: sale.id,
    requested_payment_method: sale.metodo,
    requested_payment_status: statusToDb[sale.status],
    requested_receipt_number: sale.comprovante === '—' ? null : sale.comprovante,
  });
  if (error) throw error;
  return mutationToVenda(data as SaleMutationRow, { numero: sale.proposta, lead: sale.lead, empresa: sale.empresa });
}

export async function archiveOperationalSale(saleId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_crm_sale', { target_sale_id: saleId });
  if (error) throw error;
}

export const saleMappers = { saleRowToVenda, statusFromDb, statusToDb };
