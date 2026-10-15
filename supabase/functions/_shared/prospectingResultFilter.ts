type Candidate = { telefone?: string | null; whatsapp?: string | null; email?: string | null; website?: string | null };
type Requirements = { exigeWhatsApp?: boolean; exigeEmail?: boolean; exigeSite?: boolean };

/** `exigeWhatsApp` is a legacy wire field for the UI's "Telefone ou WhatsApp" option. */
export function filterProspectingCandidates<T extends Candidate>(candidates: T[], filters: Requirements, limit: number) {
  let rejectedByContact = 0;
  let rejectedByEmail = 0;
  let rejectedByWebsite = 0;
  const matches = candidates.filter((candidate) => {
    const noContact = Boolean(filters.exigeWhatsApp && !candidate.telefone && !candidate.whatsapp);
    const noEmail = Boolean(filters.exigeEmail && !candidate.email);
    const noWebsite = Boolean(filters.exigeSite && !candidate.website);
    if (noContact) rejectedByContact += 1;
    if (noEmail) rejectedByEmail += 1;
    if (noWebsite) rejectedByWebsite += 1;
    return !noContact && !noEmail && !noWebsite;
  });
  return {
    leads: matches.slice(0, limit),
    diagnostics: { normalizedCount: candidates.length, matchedCount: matches.length, rejectedByContact, rejectedByEmail, rejectedByWebsite },
  };
}
