-- Seed P0: Garante organização WF Digital e admin Fabricio com restrições corretas

-- 1. Organização principal
INSERT INTO public.organizations (name, slug)
VALUES ('WF Digital', 'wf-digital')
ON CONFLICT (slug) DO NOTHING;

-- 2. Membro Administrador (PK é organization_id, user_id)
INSERT INTO public.organization_members (organization_id, user_id, role, status)
SELECT 
  o.id, 
  u.id, 
  'administrador'::public.app_role, 
  'active'
FROM public.organizations o
CROSS JOIN auth.users u
WHERE o.slug = 'wf-digital' 
  AND u.email = 'fabricio@wfdigital.com.br'
ON CONFLICT (organization_id, user_id) DO UPDATE 
SET role = 'administrador', status = 'active';

-- 3. Papel Administrador global (Unique é organization_id, user_id, role)
INSERT INTO public.user_roles (user_id, organization_id, role)
SELECT 
  u.id, 
  o.id, 
  'administrador'::public.app_role
FROM auth.users u
CROSS JOIN public.organizations o
WHERE u.email = 'fabricio@wfdigital.com.br'
  AND o.slug = 'wf-digital'
ON CONFLICT (organization_id, user_id, role) DO NOTHING;

-- 4. Perfil Ativo
UPDATE public.profiles
SET active = true
WHERE id IN (SELECT id FROM auth.users WHERE email = 'fabricio@wfdigital.com.br');
