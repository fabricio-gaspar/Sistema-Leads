-- Ajusta a função de auto-atribuição para ser segura
ALTER FUNCTION public.auto_assign_admin_fabricio() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.auto_assign_admin_fabricio() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_assign_admin_fabricio() FROM authenticated;

-- Refina as políticas de login para serem seguras
-- Permite que usuários vejam seu próprio perfil e roles durante o carregamento inicial
DROP POLICY IF EXISTS "allow_first_login_profiles" ON public.profiles;
CREATE POLICY "allow_self_profile_read" ON public.profiles 
FOR SELECT TO authenticated 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "allow_first_login_roles" ON public.user_roles;
CREATE POLICY "allow_self_role_read" ON public.user_roles 
FOR SELECT TO authenticated 
USING (auth.uid() = user_id);
