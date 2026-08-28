import { Navigate, type RouteObject } from "react-router-dom";
import { lazy } from 'react';
import Landing from '../pages/landing/page';
import Login from '../pages/login/page';
import Register from '../pages/register/page';
import ResetPassword from '../pages/reset-password/page';

const NotFound = lazy(() => import('../pages/NotFound'));
const Dashboard = lazy(() => import('../pages/dashboard/page'));
const Empresa = lazy(() => import('../pages/dashboard/empresa/page'));
const BuscaLeads = lazy(() => import('../pages/dashboard/busca-leads/page'));
const Atendimento = lazy(() => import('../pages/dashboard/atendimento/page'));
const Leads = lazy(() => import('../pages/dashboard/leads/page'));
const MidiaDrive = lazy(() => import('../pages/dashboard/midia-drive/page'));
const DashboardConfiguracoes = lazy(() => import('../pages/dashboard/configuracoes/page'));
const KanbanCRM = lazy(() => import('../pages/dashboard/kanban/page'));
const FunilConversao = lazy(() => import('../pages/dashboard/funil/page'));
const Relatorios = lazy(() => import('../pages/dashboard/relatorios/page'));
const Agenda = lazy(() => import('../pages/dashboard/agenda/page'));
const Orcamentos = lazy(() => import('../pages/dashboard/orcamentos/page'));
const Equipe = lazy(() => import('../pages/dashboard/equipe/page'));
const DashboardLayout = lazy(() => import('../components/feature/DashboardLayout'));
const CalendarioEditorial = lazy(() => import('../pages/dashboard/campanhas/calendario/page'));
const CriarPublicacao = lazy(() => import('../pages/dashboard/campanhas/publicacao/page'));
const ContasConectadas = lazy(() => import('../pages/dashboard/campanhas/contas/page'));

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
        element: <Empresa />,
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
        element: <MidiaDrive />,
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
        path: "campanhas/calendario",
        element: <CalendarioEditorial />,
      },
      {
        path: "campanhas/publicacao",
        element: <CriarPublicacao />,
      },
      {
        path: "campanhas/contas",
        element: <ContasConectadas />,
      },
      {
        path: "orcamentos",
        element: <Orcamentos />,
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
