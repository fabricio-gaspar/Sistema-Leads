-- Garante que o usuário existe na tabela profiles
INSERT INTO public.profiles (id, email, full_name, active, organization_id)
SELECT id, email, 'Fabricio Gaspar', true, (SELECT id FROM public.organizations WHERE slug = 'wf-digital' LIMIT 1)
FROM auth.users 
WHERE email = 'fabricio@wfdigital.com.br'
ON CONFLICT (id) DO UPDATE SET active = true, organization_id = EXCLUDED.organization_id;

-- Força o papel de administrador
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'administrador'::app_role
FROM auth.users
WHERE email = 'fabricio@wfdigital.com.br'
ON CONFLICT (user_id, role) DO NOTHING;
