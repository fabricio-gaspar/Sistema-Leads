import { Navigate } from 'react-router-dom';

export default function RegistroSistema() {
  return <Navigate to="/dashboard/configuracoes?tab=registro" replace />;
}
