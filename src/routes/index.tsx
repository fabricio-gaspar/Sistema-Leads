import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: CRMFrame });

function CRMFrame() {
  return (
    <iframe
      src="/crm/index.html"
      title="WF Digital CRM"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: 0,
        margin: 0,
        padding: 0,
      }}
    />
  );
}
