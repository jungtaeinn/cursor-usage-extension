import React from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";
import { OptionsApp } from "./pages/options/App";

document.body.classList.add("page-options");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
);
