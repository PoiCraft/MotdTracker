import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import App from "./App";
import { createAppTheme } from "./theme";
import { ColorModeContext } from "./color-mode";
import "./styles.css";

function RootApp() {
  const [mode, setMode] = useState(() => localStorage.getItem("motdtracker-theme-mode") || "light");

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("motdtracker-theme-mode", next);
      return next;
    });
  };

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const colorModeValue = useMemo(() => ({ mode, toggleMode }), [mode]);

  return (
    <ColorModeContext.Provider value={colorModeValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);