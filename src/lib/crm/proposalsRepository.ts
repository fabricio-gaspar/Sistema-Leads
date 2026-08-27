import { supabase } from '@/lib/supabase';
import { resolveOrganizationSession } from '@/lib/organizationSession';
import { isUuid } from '@/lib/crm/leadMapper';
import type { ItemProposta, Proposta } from '@/mocks/propostasData';

type JsonRecord = Record<string, unknown>;

interface ProposalLineRow {
  id: string;
  description: string;
  quantity: number | string;
  unit_price: number | string;
}

interface ProposalRow {
  id: string;
  opportunity_id: string;
  number: string;
  status: 'draft' | 'pending_approval' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  valid_until: string | null;
  subtotal_amount: number | string;
  discount_pct: number | string;
  version: number;
  parent_proposal_id: string | null;
  metadata: JsonRecord;
  created_at: string;
  crm_opportunities: {
    lead_id: string;
    crm_leads: { primary_contact_name: string | null; company_name: string } | Array<{ primary_contact_name: string | null; company_name: string }>;
  } | Array<{
    lead_id: string;
    crm_leads: { primary_contact_name: string | null; company_name: string } | Array<{ primary_contact_name: string | null; company_name: string }>;
  }>;
  crm_proposal_lines: ProposalLineRow[];
}

const statusToDb: Record<Proposta['status'], ProposalRow['status']> = {
  rascunho: 'draft',
  aguardando_aprovacao: 'pending_approval',
  enviada: 'sent',
  visualizada: 'viewed',
  aceita: 'accepted',
  recusada: 'rejected',
  expirada: 'expired',
};

const statusFromDb: Record<ProposalRow['status'], Proposta['status']> = {
  draft: 'rascunho',
  pending_approval: 'aguardando_aprovacao',
  sent: 'enviada',
  viewed: 'visualizada',
  accepted: 'aceita',
  rejected: 'recusada',
  expired: 'expirada',
};

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function one<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function proposalMetadata(proposal: Proposta): JsonRecord {
  return {
    responsavel: proposal.responsavel,
    canal: proposal.canal,
    motivoPerda: proposal.motivoPerda ?? null,
    aprovador: proposal.aprovador ?? null,
    descontoAprovado: proposal.descontoAprovado ?? false,
    bloqueadaEnvio: proposal.bloqueadaEnvio ?? false,
    templateId: proposal.templateId ?? null,
    formaPagamento: proposal.formaPagamento ?? null,
    garantia: proposal.garantia ?? null,
    termos: proposal.termos ?? null,
  };
}

function proposalLines(proposal: Proposta) {
  return proposal.itens.map((item) => ({
    description: item.nome.trim(),
    quantity: item.quantidade,
    unit_price: item.preco,
  }));
}

function proposalFingerprint(proposal: Proposta): string {
  return JSON.stringify({
    numero: proposal.numero,
    leadId: proposal.leadId,
    validade: proposal.validade,
    valor: proposal.valor,
    status: proposal.status,
    versao: proposal.versao,
    propostaPaiId: proposal.propostaPaiId,
    descontoPct: proposal.descontoPct,
    itens: proposal.itens.map(({ nome, quantidade, preco }) => ({ nome, quantidade, preco })),
    metadata: proposalMetadata(proposal),
  });
}

export function persistentProposalId(id: string): string {
  return isUuid(id) ? id : crypto.randomUUID();
}

export function newProposalNumber(now = new Date(), random = crypto.randomUUID): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `PRP-${date}-${random().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
}

export function proposalRowToProposal(row: ProposalRow): Proposta {
  const opportunity = one(row.crm_opportunities);
  const lead = one(opportunity?.crm_leads);
  const metadata = row.metadata ?? {};
  const items: ItemProposta[] = (row.crm_proposal_lines ?? []).map((line) => ({
    id: line.id,
    nome: line.description,
    quantidade: numberValue(line.quantity),
    preco: numberValue(line.unit_price),
  }));
  return {
    id: row.id,
    numero: row.number,
    lead: lead?.primary_contact_name || 'Contato não informado',
    leadId: opportunity?.lead_id,
    empresa: lead?.company_name || 'Empresa não informada',
    valor: numberValue(row.subtotal_amount),
    status: statusFromDb[row.status],
    validade: row.valid_until ?? row.created_at.slice(0, 10),
    responsavel: stringValue(metadata.responsavel, 'Usuário'),
    data: row.created_at.slice(0, 10),
    canal: stringValue(metadata.canal, 'Manual'),
    itens: items,
    descontoPct: numberValue(row.discount_pct),
    versao: Math.max(1, numberValue(row.version, 1)),
    motivoPerda: stringValue(metadata.motivoPerda) || undefined,
    aprovador: stringValue(metadata.aprovador) || undefined,
    propostaPaiId: row.parent_proposal_id ?? undefined,
    descontoAprovado: booleanValue(metadata.descontoAprovado),
    bloqueadaEnvio: booleanValue(metadata.bloqueadaEnvio),
    templateId: stringValue(metadata.templateId) || undefined,
    formaPagamento: stringValue(metadata.formaPagamento) || undefined,
    garantia: stringValue(metadata.garantia) || undefined,
    termos: stringValue(metadata.termos) || undefined,
  };
}

export async function loadOperationalProposals(): Promise<Proposta[]> {
  const session = await resolveOrganizationSession();
  const { data, error } = await supabase
    .from('crm_proposals')
    .select('id, opportunity_id, number, status, valid_until, subtotal_amount, discount_pct, version, parent_proposal_id, metadata, created_at, crm_opportunities!inner(lead_id, crm_leads!inner(primary_contact_name, company_name)), crm_proposal_lines(id, description, quantity, unit_price)')
    .eq('organization_id', session.organizationId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ProposalRow[]).map(proposalRowToProposal);
}

async function createOperationalProposal(proposal: Proposta): Promise<void> {
  const session = await resolveOrganizationSession();
  if (!proposal.leadId || !isUuid(proposal.leadId)) throw new Error('proposal_lead_required');
  const { error } = await supabase.rpc('create_crm_proposal', {
    target_proposal_id: proposal.id,
    target_organization_id: session.organizationId,
    target_lead_id: proposal.leadId,
    proposal_number: proposal.numero,
    proposal_valid_until: proposal.validade,
    proposal_subtotal_amount: proposal.valor,
    proposal_discount_pct: proposal.descontoPct,
    proposal_status: statusToDb[proposal.status] === 'pending_approval' ? 'pending_approval' : 'draft',
    proposal_parent_id: proposal.propostaPaiId && isUuid(proposal.propostaPaiId) ? proposal.propostaPaiId : null,
    proposal_metadata: proposalMetadata(proposal),
    proposal_lines: proposalLines(proposal),
  });
  if (error) throw error;
}

async function updateOperationalProposal(proposal: Proposta): Promise<void> {
  const { error } = await supabase.rpc('update_crm_proposal', {
    target_proposal_id: proposal.id,
    proposal_valid_until: proposal.validade,
    proposal_subtotal_amount: proposal.valor,
    proposal_discount_pct: proposal.descontoPct,
    proposal_status: statusToDb[proposal.status],
    proposal_metadata: proposalMetadata(proposal),
    proposal_lines: proposalLines(proposal),
  });
  if (error) throw error;
}

export async function persistOperationalProposals(previous: Proposta[], next: Proposta[]): Promise<Proposta[]> {
  const previousById = new Map(previous.map((proposal) => [proposal.id, proposal]));
  const nextWithPersistentIds = next.map((proposal) => ({ ...proposal, id: persistentProposalId(proposal.id) }));
  const nextIds = new Set(nextWithPersistentIds.map((proposal) => proposal.id));

  for (const proposal of nextWithPersistentIds) {
    const oldProposal = previousById.get(proposal.id);
    if (!oldProposal) await createOperationalProposal(proposal);
    else if (proposalFingerprint(oldProposal) !== proposalFingerprint(proposal)) await updateOperationalProposal(proposal);
  }

  for (const proposal of previous) {
    if (!nextIds.has(proposal.id) && isUuid(proposal.id)) {
      const { error } = await supabase.rpc('archive_crm_proposal', { target_proposal_id: proposal.id });
      if (error) throw error;
    }
  }
  return nextWithPersistentIds;
}

export const proposalMappers = { proposalRowToProposal, newProposalNumber, persistentProposalId };
