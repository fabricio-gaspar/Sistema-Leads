// Perfis de demonstração usados exclusivamente para preencher a interface.
// Autenticação e autorização são tratadas pelo Supabase Auth e pelas políticas
// de banco; esta fixture não contém credenciais nem participa do login.

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
  company: string;
  avatar: string;
}

export const mockUsers: MockUser[] = [
  {
    id: 'u-1',
    name: 'Fabrício',
    email: 'fabricio@wfdigital.com.br',
    role: 'Administrador',
    company: 'Wayflex',
    avatar: 'F',
  },
  {
    id: 'u-2',
    name: 'Marina Sales',
    email: 'marina@wfdigital.com.br',
    role: 'Gestor Comercial',
    company: 'Wayflex',
    avatar: 'M',
  },
  {
    id: 'u-3',
    name: 'João Vendedor',
    email: 'joao@wfdigital.com.br',
    role: 'Vendedor',
    company: 'Wayflex',
    avatar: 'J',
  },
];
