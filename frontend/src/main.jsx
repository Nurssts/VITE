import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter/wght.css"; // self-hosted: works offline, no request to Google
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Offline support in production builds only (the dev server must never be cached).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`).catch(() => {});
  });
}
