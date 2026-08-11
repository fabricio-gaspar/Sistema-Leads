-- 1. Cria o perfil se não existir (mesmo sem UUID fixo, o trigger lidaria, mas vamos garantir o que pudermos)
-- Como não sabemos o UUID do auth.users até o Fabricio logar, vamos ajustar o trigger para ser mais agressivo.

CREATE OR REPLACE FUNCTION public.force_admin_on_login()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- Busca a organização principal
    SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'wf-digital' LIMIT 1;
    
    -- Se não existir a organização, cria uma padrão
    IF v_org_id IS NULL THEN
        INSERT INTO public.organizations (name, slug) 
        VALUES ('WF Digital', 'wf-digital')
        RETURNING id INTO v_org_id;
    END IF;

    -- Se for o Fabricio
    IF NEW.email = 'fabricio@wfdigital.com.br' THEN
        -- Garante Perfil Ativo
        INSERT INTO public.profiles (id, name, email, active, can_use_ia)
        VALUES (NEW.id, 'Fabricio Gaspar', NEW.email, true, true)
        ON CONFLICT (id) DO UPDATE SET active = true;

        -- Garante Role de Administrador
        INSERT INTO public.user_roles (organization_id, user_id, role)
        VALUES (v_org_id, NEW.id, 'administrador')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Garante que o trigger rode sempre que um usuário for confirmado ou criado
DROP TRIGGER IF EXISTS tr_force_admin_fabricio ON auth.users;
CREATE TRIGGER tr_force_admin_fabricio
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.force_admin_on_login();

-- 2. Permite que QUALQUER usuário logado leia seu próprio role/profile para evitar o redirect infinito
-- Isso resolve o problema de o frontend não saber quem é o usuário recém-criado.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_self_read" ON public.profiles;
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "user_roles_self_read" ON public.user_roles;
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Caso o Fabricio já tenha tentado logar e falhado, vamos tentar encontrar o ID dele se ele existir em auth.users
DO $$
DECLARE
    f_uid UUID;
    v_org_id UUID;
BEGIN
    SELECT id INTO f_uid FROM auth.users WHERE email = 'fabricio@wfdigital.com.br' LIMIT 1;
    SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'wf-digital' LIMIT 1;

    IF f_uid IS NOT NULL AND v_org_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, name, email, active, can_use_ia)
        VALUES (f_uid, 'Fabricio Gaspar', 'fabricio@wfdigital.com.br', true, true)
        ON CONFLICT (id) DO UPDATE SET active = true;

        INSERT INTO public.user_roles (organization_id, user_id, role)
        VALUES (v_org_id, f_uid, 'administrador')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END $$;
