import { Navigate, type RouteObject } from "react-router-dom";
import { lazy } from 'react';
import Landing from '../pages/landing/page';
import Login from '../pages/login/page';
import Register from '../pages/register/page';
import ResetPassword from '../pages/reset-password/page';
import OrganizationGate from '@/components/auth/OrganizationGate';
import InvitesPage from '@/components/auth/InvitesPage';

const NotFound = lazy(() => import('../pages/NotFound'));
const Dashboard = lazy(() => import('../pages/dashboard/page'));
const BuscaLeads = lazy(() => import('../pages/dashboard/busca-leads/page'));
const Atendimento = lazy(() => import('../pages/dashboard/atendimento/page'));
const Leads = lazy(() => import('../pages/dashboard/leads/page'));
const DashboardConfiguracoes = lazy(() => import('../pages/dashboard/configuracoes/page'));
const KanbanCRM = lazy(() => import('../pages/dashboard/kanban/page'));
const FunilConversao = lazy(() => import('../pages/dashboard/funil/page'));
const Relatorios = lazy(() => import('../pages/dashboard/relatorios/page'));
const Agenda = lazy(() => import('../pages/dashboard/agenda/page'));
const Orcamentos = lazy(() => import('../pages/dashboard/orcamentos/page'));
const RegistroSistema = lazy(() => import('../pages/dashboard/registro-sistema/page'));
const Equipe = lazy(() => import('../pages/dashboard/equipe/page'));
const MeuWhatsapp = lazy(() => import('../pages/dashboard/meu-whatsapp/page'));
const DashboardLayout = lazy(() => import('../components/feature/DashboardLayout'));
const PermissionRoute = lazy(() => import('../components/feature/PermissionRoute'));

const routes: RouteObject[] = [
  { path: '/convites', element: <InvitesPage /> },
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/apresentacao",
    element: <Landing />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/register",
    element: <Register />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },
  {
    path: "/dashboard",
    element: <OrganizationGate><DashboardLayout /></OrganizationGate>,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "empresa",
        element: <Navigate to="/dashboard/configuracoes?tab=empresa" replace />,
      },
      {
        path: "busca-leads",
        element: <PermissionRoute anyOf={['prospecting.manage']}><BuscaLeads /></PermissionRoute>,
      },
      {
        path: "atendimento",
        element: <PermissionRoute anyOf={['conversations.read_all', 'conversations.reply_all', 'conversations.reply_assigned']}><Atendimento /></PermissionRoute>,
      },
      {
        path: "leads",
        element: <PermissionRoute anyOf={['leads.read_all', 'leads.read_assigned', 'leads.create']}><Leads /></PermissionRoute>,
      },
      {
        path: "kanban",
        element: <PermissionRoute anyOf={['leads.read_all', 'leads.read_assigned']}><KanbanCRM /></PermissionRoute>,
      },
      {
        path: "funil",
        element: <PermissionRoute anyOf={['leads.read_all', 'leads.read_assigned']}><FunilConversao /></PermissionRoute>,
      },
      {
        path: "equipe",
        element: <PermissionRoute anyOf={['team.manage']}><Equipe /></PermissionRoute>,
      },
      {
        path: "midia-drive",
        element: <Navigate to="/dashboard/configuracoes?tab=empresa&subtab=fontes" replace />,
      },
      {
        path: "relatorios",
        element: <PermissionRoute anyOf={['leads.read_all', 'leads.read_assigned']}><Relatorios /></PermissionRoute>,
      },
      {
        path: "agenda",
        element: <PermissionRoute anyOf={['conversations.read_all', 'conversations.reply_all', 'conversations.reply_assigned']}><Agenda /></PermissionRoute>,
      },
      {
        path: "orcamentos",
        element: <PermissionRoute anyOf={['proposals.manage']}><Orcamentos /></PermissionRoute>,
      },
      {
        path: "registro-sistema",
        element: <PermissionRoute anyOf={['audit.view']}><RegistroSistema /></PermissionRoute>,
      },
      {
        path: "configuracoes",
        element: <PermissionRoute anyOf={['configuration.manage']}><DashboardConfiguracoes /></PermissionRoute>,
      },
      {
        path: "meu-whatsapp",
        element: <PermissionRoute anyOf={['channels.view_own', 'channels.manage_all', 'configuration.manage']}><MeuWhatsapp /></PermissionRoute>,
      },
      { path: "personalizacao-ana", element: <Navigate to="/dashboard/configuracoes?tab=ana" replace /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;
