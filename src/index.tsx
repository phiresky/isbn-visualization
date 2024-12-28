import { isWebGL2Available } from "@react-three/drei";
import { configure } from "mobx";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
configure({ enforceActions: "never", computedRequiresReaction: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

function testCompat() {
  const available = isWebGL2Available();
  if (!available) alert("WebGL2 not available, please upgrade your browser!");
}

testCompat();
