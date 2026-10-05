/** Narrow, deterministic authorization of the date/time the lead actually said. */
export function validatedAnaMeetingRequest(payload: unknown, inboundValue: unknown, now = Date.now()) {
  const input = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const startsAt = typeof input.starts_at === 'string' ? input.starts_at : '';
  const parsed = Date.parse(startsAt);
  const duration = typeof input.duration_minutes === 'number' && Number.isFinite(input.duration_minutes) ? Math.round(input.duration_minutes) : 30;
  if (!/(?:z|[+-]\d{2}:\d{2})$/i.test(startsAt) || !Number.isFinite(parsed) || parsed < now + 300_000 || parsed > now + 90 * 86_400_000 || duration < 15 || duration > 120) return null;
  const inbound = typeof inboundValue === 'string' ? inboundValue.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
  const times = [...inbound.matchAll(/\b([01]?\d|2[0-3])(?::([0-5]\d)|h([0-5]\d)?)\b/g)];
  // Ambiguous ranges, multiple suggestions and colloquial periods require a human.
  if (times.length !== 1) return null;
  const parts = (instant: number) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant).map(part => [part.type, part.value]));
  const requested = parts(parsed); const today = parts(now);
  if (Number(requested.hour) !== Number(times[0][1]) || Number(requested.minute) !== Number(times[0][2] ?? times[0][3] ?? 0)) return null;
  const localToday = Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day));
  const possibleDates: number[] = [];
  const literalDate = (year: number, month: number, day: number) => {
    const instant = Date.UTC(year, month - 1, day); const date = new Date(instant);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? instant : NaN;
  };
  for (const match of inbound.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) possibleDates.push(literalDate(Number(match[1]), Number(match[2]), Number(match[3])));
  for (const match of inbound.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g)) possibleDates.push(literalDate(Number(match[3] ?? today.year), Number(match[2]), Number(match[1])));
  if (/\bhoje\b/.test(inbound)) possibleDates.push(localToday);
  if (/\bamanha\b/.test(inbound)) possibleDates.push(localToday + 86_400_000);
  const weekdays = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  weekdays.forEach((weekday, index) => { if (new RegExp(`\\b${weekday}\\b`).test(inbound)) possibleDates.push(localToday + ((index - new Date(localToday).getUTCDay() + 7) % 7) * 86_400_000); });
  const chosenDate = Date.UTC(Number(requested.year), Number(requested.month) - 1, Number(requested.day));
  if (new Set(possibleDates).size !== 1 || possibleDates[0] !== chosenDate) return null;
  return { startsAt: new Date(parsed).toISOString(), endsAt: new Date(parsed + duration * 60_000).toISOString(), duration };
}
