import { Navigate, type RouteObject } from "react-router-dom";
import { lazy } from 'react';
import Landing from '../pages/landing/page';
import Login from '../pages/login/page';
import Register from '../pages/register/page';
import ResetPassword from '../pages/reset-password/page';

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
const DashboardLayout = lazy(() => import('../components/feature/DashboardLayout'));

const routes: RouteObject[] = [
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
    element: <DashboardLayout />,
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
        element: <BuscaLeads />,
      },
      {
        path: "atendimento",
        element: <Atendimento />,
      },
      {
        path: "leads",
        element: <Leads />,
      },
      {
        path: "kanban",
        element: <KanbanCRM />,
      },
      {
        path: "funil",
        element: <FunilConversao />,
      },
      {
        path: "equipe",
        element: <Equipe />,
      },
      {
        path: "midia-drive",
        element: <Navigate to="/dashboard/configuracoes?tab=empresa&subtab=fontes" replace />,
      },
      {
        path: "relatorios",
        element: <Relatorios />,
      },
      {
        path: "agenda",
        element: <Agenda />,
      },
      {
        path: "orcamentos",
        element: <Orcamentos />,
      },
      {
        path: "registro-sistema",
        element: <RegistroSistema />,
      },
      {
        path: "configuracoes",
        element: <DashboardConfiguracoes />,
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
