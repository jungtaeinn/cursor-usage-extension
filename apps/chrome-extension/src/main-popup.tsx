import React from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";
import { Popup } from "./components/Popup";

document.body.classList.add("page-popup");
document.documentElement.dataset.theme = "system";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
