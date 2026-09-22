import React, { Component, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { App } from "./JanApp.jsx";
import "./styles/global.css";
import "./styles/docs.css";
import "./styles/chat.css";

function Observability() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  return <><Analytics route={path} path={path} /><SpeedInsights route={path} /></>;
}

class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  render() {
    if (this.state.hasError) return <main className="app-error" role="alert"><h1>Jan needs a refresh</h1><p>Your saved conversations are safe. Reload to continue.</p><button type="button" onClick={() => window.location.reload()}>Reload Jan</button></main>;
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary><App /><Observability /></AppErrorBoundary>
  </React.StrictMode>,
);
