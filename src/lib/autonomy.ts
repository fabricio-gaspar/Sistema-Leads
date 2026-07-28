// Autonomy modes per funnel stage.
// - auto:   sistema executa sozinho
// - assist: sistema prepara/rascunha e humano confirma
// - manual: apenas humano executa
export type AutonomyMode = "auto" | "assist" | "manual";

export type AutonomyStage =
  | "prospect_to_lead"
  | "first_contact"
  | "ai_reply"
  | "qualification"
  | "proposal_send"
  | "proposal_followup"
  | "appointment"
  | "closing"
  | "nurture";

export const AUTONOMY_STAGES: {
  key: AutonomyStage;
  label: string;
  description: string;
  allowAuto: boolean;
}[] = [
  { key: "prospect_to_lead", label: "Converter prospecção em lead", description: "Ao aprovar um prospecto (ou por score mínimo), cria o lead e inicia a cadência.", allowAuto: true },
  { key: "first_contact",    label: "Primeiro contato",              description: "Disparo automático de WhatsApp → E-mail → tarefa de telefone.", allowAuto: true },
  { key: "ai_reply",         label: "Respostas da Ana",              description: "A Ana responde clientes com base na base de conhecimento aprovada.", allowAuto: true },
  { key: "qualification",    label: "Qualificação",                  description: "Preenche intenção, dor, urgência, decisor, orçamento, prontidão.", allowAuto: true },
  { key: "proposal_send",    label: "Envio de orçamento",            description: "Monta e envia proposta quando o lead demonstra intenção suficiente.", allowAuto: true },
  { key: "proposal_followup",label: "Follow-up de orçamento",        description: "Retomadas automáticas de propostas sem resposta.", allowAuto: true },
  { key: "appointment",      label: "Agendamento de reunião",        description: "Oferece horário, confirma e gera .ics/convite.", allowAuto: true },
  { key: "closing",          label: "Fechamento (contrato/pedido)",  description: "Fechamento comercial. Recomendado manter humano por compliance.", allowAuto: false },
  { key: "nurture",          label: "Nurture de leads frios",        description: "Sequência de reengajamento para leads sem resposta.", allowAuto: true },
];

export const DEFAULT_AUTONOMY: Record<AutonomyStage, AutonomyMode> = {
  prospect_to_lead:  "assist",
  first_contact:     "auto",
  ai_reply:          "auto",
  qualification:     "auto",
  proposal_send:     "assist",
  proposal_followup: "auto",
  appointment:       "assist",
  closing:           "manual",
  nurture:           "auto",
};

export function readAutonomy(raw: unknown): Record<AutonomyStage, AutonomyMode> {
  const out = { ...DEFAULT_AUTONOMY };
  if (raw && typeof raw === "object") {
    for (const stage of AUTONOMY_STAGES) {
      const v = (raw as Record<string, unknown>)[stage.key];
      if (v === "auto" || v === "assist" || v === "manual") out[stage.key] = v;
    }
  }
  return out;
}

export function autonomyOf(raw: unknown, stage: AutonomyStage): AutonomyMode {
  return readAutonomy(raw)[stage];
}

export const AUTONOMY_LABEL: Record<AutonomyMode, string> = {
  auto: "Automático",
  assist: "Sistema prepara, humano confirma",
  manual: "Somente humano",
};
