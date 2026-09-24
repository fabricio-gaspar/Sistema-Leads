import { useNavigate, type NavigateFunction } from "react-router-dom";
import { useRoutes } from "react-router-dom";
import { createElement, Suspense, useEffect } from "react";
import routes from "./config";

let navigateResolver: (navigate: ReturnType<typeof useNavigate>) => void;

declare global {
  interface Window {
    REACT_APP_NAVIGATE: ReturnType<typeof useNavigate>;
  }
}

export const navigatePromise = new Promise<NavigateFunction>((resolve) => {
  navigateResolver = resolve;
});

export function AppRoutes() {
  const element = useRoutes(routes);
  const navigate = useNavigate();
  useEffect(() => {
    window.REACT_APP_NAVIGATE = navigate;
    navigateResolver(window.REACT_APP_NAVIGATE);
  });
  return createElement(
    Suspense,
    {
      fallback: createElement(
        'main',
        { className: 'flex min-h-screen items-center justify-center bg-background-50 px-6', 'aria-busy': true },
        createElement('p', { className: 'text-sm font-medium text-foreground-600' }, 'Carregando Sistema de Leads...'),
      ),
    },
    element,
  );
}
