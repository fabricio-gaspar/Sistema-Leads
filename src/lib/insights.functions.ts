import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string; claims?: any };

// ============ Stage 6: Insights de score/prontidão ============
export const getScoringInsights = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const [leadsRes, qualRes] = await Promise.all([
      ctx.supabase
        .from("leads")
        .select("id, origin, temp, score, score_source, stage")
        .not("stage", "eq", "Perdido"),
      ctx.supabase
        .from("lead_qualifications")
        .select("lead_id, readiness_score, sentiment, urgency"),
    ]);
    if (leadsRes.error) throw new Error(leadsRes.error.message);
    if (qualRes.error) throw new Error(qualRes.error.message);
    const leads = (leadsRes.data ?? []) as Array<{
      id: string;
      origin: string | null;
      temp: string;
      score: number;
      score_source: string | null;
    }>;
    const quals = (qualRes.data ?? []) as Array<{
      lead_id: string;
      readiness_score: number | null;
      sentiment: string | null;
      urgency: string | null;
    }>;

    // Média de score por origem
    const byOrigin = new Map<string, { total: number; count: number; hot: number }>();
    for (const l of leads) {
      const key = l.origin || "Outros";
      const bucket = byOrigin.get(key) ?? { total: 0, count: 0, hot: 0 };
      bucket.total += Number(l.score || 0);
      bucket.count += 1;
      if (l.temp === "hot") bucket.hot += 1;
      byOrigin.set(key, bucket);
    }
    const scoreByOrigin = [...byOrigin.entries()]
      .map(([origin, b]) => ({
        origin,
        avgScore: b.count ? Math.round(b.total / b.count) : 0,
        leads: b.count,
        hotRate: b.count ? Math.round((b.hot / b.count) * 100) : 0,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 8);

    // Fonte de scoring
    const bySource = new Map<string, number>();
    for (const l of leads) {
      const key = l.score_source || "não classificado";
      bySource.set(key, (bySource.get(key) ?? 0) + 1);
    }

    // Prontidão média
    const readinessValues = quals
      .map((q) => q.readiness_score)
      .filter((v): v is number => typeof v === "number");
    const avgReadiness = readinessValues.length
      ? Math.round(readinessValues.reduce((a, b) => a + b, 0) / readinessValues.length)
      : null;
    const readyForHandoff = readinessValues.filter((v) => v >= 70).length;

    const sentimentMap = new Map<string, number>();
    for (const q of quals) {
      if (!q.sentiment) continue;
      sentimentMap.set(q.sentiment, (sentimentMap.get(q.sentiment) ?? 0) + 1);
    }

    return {
      scoreByOrigin,
      scoreSources: [...bySource.entries()].map(([source, count]) => ({ source, count })),
      qualification: {
        total: quals.length,
        avgReadiness,
        readyForHandoff,
        sentiments: [...sentimentMap.entries()].map(([sentiment, count]) => ({ sentiment, count })),
      },
    };
  });

// ============ Stage 7: Snapshot de conformidade / LGPD ============
export const getComplianceSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [optOutRes, suppressionsRes, consentRes, auditRes] = await Promise.all([
      ctx.supabase
        .from("leads")
        .select("id, company, contact, updated_at")
        .eq("opt_out", true)
        .order("updated_at", { ascending: false })
        .limit(200),
      ctx.supabase
        .from("contact_suppressions")
        .select("contact_hash, channel, reason, created_at, lead_id")
        .order("created_at", { ascending: false })
        .limit(200),
      ctx.supabase
        .from("consent_events")
        .select("id, event, channel, source, created_at, lead_id")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(200),
      ctx.supabase
        .from("audit_logs")
        .select("id, action, detail, actor_name, actor_type, occurred_at")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(500),
    ]);
    if (optOutRes.error) throw new Error(optOutRes.error.message);
    if (suppressionsRes.error) throw new Error(suppressionsRes.error.message);
    if (consentRes.error) throw new Error(consentRes.error.message);
    if (auditRes.error) throw new Error(auditRes.error.message);

    const consentEvents = (consentRes.data ?? []) as Array<{ event: string }>;
    const byEvent = new Map<string, number>();
    for (const row of consentEvents) {
      byEvent.set(row.event, (byEvent.get(row.event) ?? 0) + 1);
    }

    return {
      optOutLeads: optOutRes.data ?? [],
      suppressions: suppressionsRes.data ?? [],
      consentSummary: [...byEvent.entries()].map(([event, count]) => ({ event, count })),
      recentConsent: (consentRes.data ?? []).slice(0, 30),
      auditLogs: auditRes.data ?? [],
    };
  });
