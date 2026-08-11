-- Identifica e corrige o acesso público à função has_role
-- Note: Estamos usando app_role ou text dependendo da versão anterior, vamos tentar ambos de forma segura
DO $$ 
BEGIN
    -- Se existir com app_role
    IF EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE proname = 'has_role' AND nspname = 'public') THEN
        -- Revoga de todos e então concede apenas ao que for necessário (o owner já tem acesso)
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC';
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated';
    END IF;
END $$;
