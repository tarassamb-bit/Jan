import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { App } from "./App.jsx";
import "./styles.css";

function Observability() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  return <><Analytics route={path} path={path} /><SpeedInsights route={path} /></>;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <Observability />
  </React.StrictMode>,
);
