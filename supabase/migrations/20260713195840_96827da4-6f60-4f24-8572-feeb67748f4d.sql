
-- =========== ENUMS ===========
CREATE TYPE public.app_role AS ENUM ('administrador', 'vendedor', 'sdr', 'cx');
CREATE TYPE public.lead_temp AS ENUM ('hot', 'warm', 'cold');
CREATE TYPE public.lead_stage AS ENUM ('Prospecção', 'Qualificado', 'Proposta', 'Negociação', 'Pedido', 'Fechado', 'Perdido');
CREATE TYPE public.owner_type AS ENUM ('ia', 'human');
CREATE TYPE public.message_sender AS ENUM ('ia', 'human', 'client');
CREATE TYPE public.message_type AS ENUM ('ia', 'ia-escalated', 'human', 'client');

-- =========== UPDATED_AT HELPER ===========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========== PROFILES ===========
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  avatar text,
  active boolean NOT NULL DEFAULT true,
  can_use_ia boolean NOT NULL DEFAULT true,
  discount_limit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_self" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== USER_ROLES ===========
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "user_roles_select_all" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

-- =========== COMPANY_SETTINGS ===========
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  segment text,
  website text,
  address text,
  phone text,
  email text,
  description text,
  tone_of_voice text,
  differentiators text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_select_all" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "company_admin_write" ON public.company_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'))
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));
CREATE TRIGGER trg_company_updated BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== SERVICES ===========
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  unit text,
  term text,
  max_discount numeric(5,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_all_auth" ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== OBJECTIONS ===========
CREATE TABLE public.objections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL,
  response text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.objections TO authenticated;
GRANT ALL ON public.objections TO service_role;
ALTER TABLE public.objections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "objections_all_auth" ON public.objections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_objections_updated BEFORE UPDATE ON public.objections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== LEADS ===========
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  contact text,
  title text,
  phone text,
  email text,
  segment text,
  uf text,
  distance integer,
  score integer NOT NULL DEFAULT 0,
  temp lead_temp NOT NULL DEFAULT 'warm',
  stage lead_stage NOT NULL DEFAULT 'Prospecção',
  value numeric(12,2) NOT NULL DEFAULT 0,
  owner owner_type NOT NULL DEFAULT 'ia',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  stale_hours integer NOT NULL DEFAULT 0,
  escalated boolean NOT NULL DEFAULT false,
  escalation_reason text,
  sla_info text,
  last_contact text,
  lost_reason text,
  origin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_stage ON public.leads(stage);
CREATE INDEX idx_leads_assigned ON public.leads(assigned_to);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_all_auth" ON public.leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== LEAD_MESSAGES ===========
CREATE TABLE public.lead_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sender message_sender NOT NULL,
  sender_name text NOT NULL,
  type message_type NOT NULL,
  text text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_messages_lead ON public.lead_messages(lead_id, sent_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_messages TO authenticated;
GRANT ALL ON public.lead_messages TO service_role;
ALTER TABLE public.lead_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_messages_all_auth" ON public.lead_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========== LEAD_TASKS ===========
CREATE TABLE public.lead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  text text NOT NULL,
  due_at timestamptz,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_label text,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_tasks TO authenticated;
GRANT ALL ON public.lead_tasks TO service_role;
ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_tasks_all_auth" ON public.lead_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_lead_tasks_updated BEFORE UPDATE ON public.lead_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== PROPOSALS ===========
CREATE TABLE public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  client text NOT NULL,
  items text NOT NULL,
  value numeric(12,2) NOT NULL DEFAULT 0,
  discount text,
  creator owner_type NOT NULL DEFAULT 'ia',
  creator_name text,
  status text NOT NULL DEFAULT 'Rascunho',
  need_approval boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposals_all_auth" ON public.proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_proposals_updated BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== ORDERS ===========
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  company text NOT NULL,
  seller_name text NOT NULL,
  seller_type owner_type NOT NULL DEFAULT 'human',
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  items text NOT NULL,
  value numeric(12,2) NOT NULL DEFAULT 0,
  payment text,
  contract_status text,
  status text NOT NULL DEFAULT 'Aguardando pagamento',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_all_auth" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== DOCUMENTS ===========
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text,
  size text,
  uses integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Processando...',
  storage_path text,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_all_auth" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_documents_updated BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== UNANSWERED_QUESTIONS ===========
CREATE TABLE public.unanswered_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unanswered_questions TO authenticated;
GRANT ALL ON public.unanswered_questions TO service_role;
ALTER TABLE public.unanswered_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unanswered_all_auth" ON public.unanswered_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_unanswered_updated BEFORE UPDATE ON public.unanswered_questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== TASKS (agenda do dia) ===========
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  due_at timestamptz,
  time_label text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  owner_label text,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_all_auth" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========== AUDIT_LOGS ===========
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  actor_type owner_type NOT NULL DEFAULT 'human',
  action text NOT NULL,
  detail text,
  rule text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_occurred ON public.audit_logs(occurred_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_all" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_insert_all" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "audit_admin_delete" ON public.audit_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'administrador'));

-- =========== VENDOR_SESSIONS ===========
CREATE TABLE public.vendor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  minutes integer,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  token text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_sessions TO authenticated;
GRANT ALL ON public.vendor_sessions TO service_role;
ALTER TABLE public.vendor_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendor_sessions_all_auth" ON public.vendor_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========== SCORE_WEIGHTS ===========
CREATE TABLE public.score_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment integer NOT NULL DEFAULT 30,
  whatsapp integer NOT NULL DEFAULT 20,
  site integer NOT NULL DEFAULT 15,
  porte integer NOT NULL DEFAULT 15,
  google integer NOT NULL DEFAULT 10,
  regiao integer NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.score_weights TO authenticated;
GRANT ALL ON public.score_weights TO service_role;
ALTER TABLE public.score_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "score_weights_all_auth" ON public.score_weights FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_score_weights_updated BEFORE UPDATE ON public.score_weights FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed inicial da linha única de pesos
INSERT INTO public.score_weights DEFAULT VALUES;

-- =========== TRIGGER: cria profile automaticamente ao criar usuário ===========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
