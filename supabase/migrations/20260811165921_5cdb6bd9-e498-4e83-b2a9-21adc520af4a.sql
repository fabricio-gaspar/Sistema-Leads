-- 1. Garante que a organização exista
INSERT INTO public.organizations (name, slug)
VALUES ('WF Digital', 'wf-digital')
ON CONFLICT (slug) DO NOTHING;

-- 2. Define uma variável para o ID da organização (usada no insert final)
DO $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'wf-digital' LIMIT 1;

    -- 3. Cria uma política temporária para permitir a leitura de perfis e roles durante o login inicial
    -- Isso evita o erro de "vendedor" ou "SDR" se o usuário ainda não tiver role.
    DROP POLICY IF EXISTS "allow_first_login_profiles" ON public.profiles;
    CREATE POLICY "allow_first_login_profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
    
    DROP POLICY IF EXISTS "allow_first_login_roles" ON public.user_roles;
    CREATE POLICY "allow_first_login_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
    
    -- 4. Como não podemos criar o usuário no auth.users via SQL diretamente (devido ao hash da senha),
    -- vamos criar um gatilho que torna o Fabricio administrador assim que ele se cadastrar ou logar.
    
    CREATE OR REPLACE FUNCTION public.auto_assign_admin_fabricio()
    RETURNS TRIGGER AS $BODY$
    DECLARE
        v_org_id UUID;
    BEGIN
        SELECT id INTO v_org_id FROM public.organizations WHERE slug = 'wf-digital' LIMIT 1;
        
        -- Se for o Fabricio, cria o profile e o user_role
        IF NEW.email = 'fabricio@wfdigital.com.br' THEN
            -- Garante profile
            INSERT INTO public.profiles (id, name, email, active, can_use_ia)
            VALUES (NEW.id, 'Fabricio Gaspar', NEW.email, true, true)
            ON CONFLICT (id) DO UPDATE SET active = true, can_use_ia = true;
            
            -- Garante role de administrador
            INSERT INTO public.user_roles (organization_id, user_id, role)
            VALUES (v_org_id, NEW.id, 'administrador')
            ON CONFLICT (user_id, role) DO NOTHING;
        END IF;
        
        RETURN NEW;
    END;
    $BODY$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS on_auth_user_created_fabricio ON auth.users;
    CREATE TRIGGER on_auth_user_created_fabricio
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.auto_assign_admin_fabricio();

END $$;
