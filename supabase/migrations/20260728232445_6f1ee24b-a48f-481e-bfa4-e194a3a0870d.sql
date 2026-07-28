
CREATE TABLE public.prospecting_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  quantity INTEGER NOT NULL DEFAULT 10 CHECK (quantity BETWEEN 1 AND 100),
  days_of_week INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  time_of_day TEXT NOT NULL DEFAULT '09:00',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  auto_approve_min_score INTEGER NOT NULL DEFAULT 70 CHECK (auto_approve_min_score BETWEEN 0 AND 100),
  sequence_id UUID REFERENCES public.outreach_sequences(id) ON DELETE SET NULL,
  assignment_strategy TEXT NOT NULL DEFAULT 'owner' CHECK (assignment_strategy IN ('owner','round_robin','ia_only')),
  daily_cap INTEGER NOT NULL DEFAULT 30 CHECK (daily_cap BETWEEN 1 AND 500),
  monthly_cap INTEGER NOT NULL DEFAULT 500 CHECK (monthly_cap BETWEEN 1 AND 10000),
  quiet_hours_start TEXT NOT NULL DEFAULT '20:00',
  quiet_hours_end TEXT NOT NULL DEFAULT '08:00',
  active BOOLEAN NOT NULL DEFAULT true,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospecting_schedules TO authenticated;
GRANT ALL ON public.prospecting_schedules TO service_role;
ALTER TABLE public.prospecting_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules_select_own_or_admin" ON public.prospecting_schedules
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "schedules_insert_own" ON public.prospecting_schedules
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "schedules_update_own_or_admin" ON public.prospecting_schedules
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));
CREATE POLICY "schedules_delete_own_or_admin" ON public.prospecting_schedules
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'));

CREATE INDEX prospecting_schedules_next_run_idx ON public.prospecting_schedules(next_run_at) WHERE active = true;
CREATE INDEX prospecting_schedules_owner_idx ON public.prospecting_schedules(owner_id);

CREATE TRIGGER trg_prospecting_schedules_updated_at
  BEFORE UPDATE ON public.prospecting_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.prospecting_schedule_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.prospecting_schedules(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed','skipped')),
  found_count INTEGER NOT NULL DEFAULT 0,
  approved_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prospecting_schedule_runs TO authenticated;
GRANT ALL ON public.prospecting_schedule_runs TO service_role;
ALTER TABLE public.prospecting_schedule_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_runs_select_own_or_admin" ON public.prospecting_schedule_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prospecting_schedules s
      WHERE s.id = prospecting_schedule_runs.schedule_id
        AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
    )
  );

CREATE INDEX prospecting_schedule_runs_sched_idx ON public.prospecting_schedule_runs(schedule_id, started_at DESC);
