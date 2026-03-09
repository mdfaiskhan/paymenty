import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { AnalyticsProvider } from "./context/AnalyticsContext";
import { BusinessProvider } from "./context/BusinessContext";
import "./styles/layout.scss";
import "./styles/components.scss";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <BusinessProvider>
          <AnalyticsProvider>
            <App />
          </AnalyticsProvider>
        </BusinessProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
