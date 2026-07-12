import { createFileRoute } from "@tanstack/react-router";
import rawHtml from "../../public/crm/index.html?raw";

// Absolutiza os paths do reference (style.css / app.js) para /crm/
const html = rawHtml
  .replace('href="style.css"', 'href="/crm/style.css"')
  .replace('src="app.js"', 'src="/crm/app.js"');

export const Route = createFileRoute("/")({ component: CRMFrame });

function CRMFrame() {
  return (
    <iframe
      srcDoc={html}
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
