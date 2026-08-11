export function renderErrorPage(error: any) {
  return `
    <div style="padding: 2rem; font-family: sans-serif;">
      <h1>Algo deu errado</h1>
      <pre>${error?.message || 'Erro desconhecido'}</pre>
      <button onclick="window.location.reload()">Recarregar</button>
    </div>
  `;
}
