import { hasProspectingActivityEvidence } from './prospectingScore.ts';

type Candidate = {
  id?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  source_record_id?: string | null;
  source_url?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnae_descricao?: string | null;
  segment?: string | null;
  municipio?: string | null;
  uf?: string | null;
  score?: number | null;
  deterministic_score?: number | null;
};
type Requirements = { exigeWhatsApp?: boolean; exigeEmail?: boolean; exigeSite?: boolean; minimumScore?: number; atividades?: string[] };

function normalizeKey(value: string | null | undefined): string {
  return (value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

function domainKey(value: string | null | undefined): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  try { return new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return normalizeKey(raw); }
}

function candidateKeys(candidate: Candidate): string[] {
  const sourceRecord = normalizeKey(candidate.source_record_id || candidate.id);
  const sourceUrl = normalizeKey(candidate.source_url);
  const website = domainKey(candidate.website);
  const company = normalizeKey(candidate.razao_social || candidate.nome_fantasia);
  const location = `${normalizeKey(candidate.municipio)}|${normalizeKey(candidate.uf)}`;
  return [
    sourceRecord ? `source:${sourceRecord}` : '',
    sourceUrl ? `url:${sourceUrl}` : '',
    website ? `domain:${website}` : '',
    company && location !== '|' ? `company:${company}|${location}` : '',
  ].filter(Boolean);
}

function scoreOf(candidate: Candidate): number {
  const score = candidate.score ?? candidate.deterministic_score ?? 0;
  return typeof score === 'number' && Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
}

/** `exigeWhatsApp` is a legacy wire field for the UI's "Telefone ou WhatsApp" option. */
export function filterProspectingCandidates<T extends Candidate>(candidates: T[], filters: Requirements, limit: number) {
  const seen = new Set<string>();
  let rejectedByDuplicate = 0;
  const uniqueCandidates = [...candidates].sort((left, right) => scoreOf(right) - scoreOf(left)).filter((candidate) => {
    const keys = candidateKeys(candidate);
    if (!keys.length) return true;
    if (keys.some((key) => seen.has(key))) {
      rejectedByDuplicate += 1;
      return false;
    }
    keys.forEach((key) => seen.add(key));
    return true;
  });
  let rejectedByContact = 0;
  let rejectedByEmail = 0;
  let rejectedByWebsite = 0;
  let rejectedByMinimumScore = 0;
  let rejectedByActivityEvidence = 0;
  const minimumScore = typeof filters.minimumScore === 'number' && Number.isFinite(filters.minimumScore)
    ? Math.max(0, Math.min(100, Math.round(filters.minimumScore)))
    : 0;
  const matches = uniqueCandidates.filter((candidate) => {
    const noContact = Boolean(filters.exigeWhatsApp && !candidate.telefone && !candidate.whatsapp);
    const noEmail = Boolean(filters.exigeEmail && !candidate.email);
    const noWebsite = Boolean(filters.exigeSite && !candidate.website);
    const belowMinimumScore = Boolean(minimumScore && scoreOf(candidate) < minimumScore);
    const missingActivityEvidence = Boolean(minimumScore >= 50 && ![candidate.cnae_descricao, candidate.segment]
      .some((sourceActivity) => hasProspectingActivityEvidence(sourceActivity, filters.atividades)));
    if (noContact) rejectedByContact += 1;
    if (noEmail) rejectedByEmail += 1;
    if (noWebsite) rejectedByWebsite += 1;
    if (belowMinimumScore) rejectedByMinimumScore += 1;
    if (missingActivityEvidence) rejectedByActivityEvidence += 1;
    return !noContact && !noEmail && !noWebsite && !belowMinimumScore && !missingActivityEvidence;
  });
  matches.sort((left, right) => scoreOf(right) - scoreOf(left));
  return {
    leads: matches.slice(0, limit),
    diagnostics: { normalizedCount: uniqueCandidates.length, matchedCount: matches.length, rejectedByContact, rejectedByEmail, rejectedByWebsite, rejectedByDuplicate, rejectedByMinimumScore, rejectedByActivityEvidence },
  };
}
