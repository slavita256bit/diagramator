import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DiagramPage } from "@/pages/diagram";
import { AppProviders } from "./providers/AppProviders";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <DiagramPage />
    </AppProviders>
  </StrictMode>,
);
